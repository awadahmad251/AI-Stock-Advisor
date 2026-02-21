from fastapi import APIRouter, Query, HTTPException
from services.stock_service import stock_service, _yf_session
from services.news_service import news_service
from services.sentiment_service import analyze_sentiment
from services import yahoo_direct
import asyncio
import re
import yfinance as yf

router = APIRouter()

# simple in-memory cache for earnings (TTL seconds)
_earnings_cache = {"ts": 0, "val": None}
_EARNINGS_TTL = 120

TICKER_PATTERN = re.compile(r'^[A-Z]{1,5}(\.?[A-Z])?$')

def validate_ticker(ticker: str) -> str:
    t = ticker.upper().strip()
    if not TICKER_PATTERN.match(t):
        raise HTTPException(status_code=400, detail=f"Invalid ticker: {ticker}")
    return t


@router.get("/backtest")
async def backtest(
    symbol: str = Query(..., description="Stock ticker"),
    investment: float = Query(10000, description="Initial investment in USD"),
    period: str = Query("5y", description="Period: 1y, 2y, 5y, 10y, max"),
):
    """What-if backtester: how much would $X invested Y years ago be worth today?"""
    try:
        sym = validate_ticker(symbol)

        # Primary: direct Yahoo API
        chart_data = yahoo_direct.get_chart(sym, period)
        hist_dates = []
        hist_closes = []
        if chart_data and chart_data.get("timestamps"):
            import datetime
            for i, ts in enumerate(chart_data["timestamps"]):
                c = chart_data["closes"][i]
                if c is not None:
                    hist_dates.append(datetime.datetime.fromtimestamp(ts).date())
                    hist_closes.append(float(c))

        # Fallback: yfinance
        if len(hist_closes) < 2:
            stock = yf.Ticker(sym, session=_yf_session)
            hist = stock.history(period=period)
            if hist.empty or len(hist) < 2:
                return {"error": f"Not enough data for {symbol}"}
            hist_dates = [d.date() for d in hist.index]
            hist_closes = [float(row["Close"]) for _, row in hist.iterrows()]

        if len(hist_closes) < 2:
            return {"error": f"Not enough data for {symbol}"}

        start_price = hist_closes[0]
        end_price = hist_closes[-1]
        shares_bought = investment / start_price
        final_value = shares_bought * end_price
        total_return = final_value - investment
        total_return_pct = (total_return / investment) * 100

        # Build growth chart
        chart = []
        for i in range(len(hist_closes)):
            try:
                price = hist_closes[i]
                value = shares_bought * price
                chart.append({
                    "date": str(hist_dates[i]),
                    "price": round(price, 2),
                    "value": round(value, 2),
                })
            except (ValueError, TypeError):
                continue

        # Calculate annualized return
        days = (hist_dates[-1] - hist_dates[0]).days
        years = days / 365.25
        annualized = ((final_value / investment) ** (1 / years) - 1) * 100 if years > 0 else 0

        # Max drawdown
        running_max = float('-inf')
        max_drawdown = 0
        for point in chart:
            running_max = max(running_max, point["value"])
            drawdown = (point["value"] - running_max) / running_max * 100
            max_drawdown = min(max_drawdown, drawdown)

        return {
            "symbol": sym,
            "investment": investment,
            "period": period,
            "start_date": str(hist_dates[0]),
            "end_date": str(hist_dates[-1]),
            "start_price": round(start_price, 2),
            "end_price": round(end_price, 2),
            "shares_bought": round(shares_bought, 4),
            "final_value": round(final_value, 2),
            "total_return": round(total_return, 2),
            "total_return_percent": round(total_return_pct, 2),
            "annualized_return": round(annualized, 2),
            "max_drawdown": round(max_drawdown, 2),
            "years": round(years, 1),
            "chart": chart[::max(1, len(chart) // 200)],  # limit chart points
        }
    except Exception as e:
        return {"error": str(e)}


@router.get("/sentiment/{ticker}")
async def get_sentiment(ticker: str):
    """Get AI sentiment analysis for a stock based on recent news"""
    t = validate_ticker(ticker)
    articles = news_service.search_news(t, page_size=10)

    if not articles:
        return {
            "ticker": t,
            "sentiment": {"score": 0, "label": "Neutral", "summary": "No recent news found", "key_factors": []},
            "article_count": 0,
        }

    headlines = [a["title"] for a in articles if a.get("title")]
    sentiment = analyze_sentiment(t, headlines)

    return {
        "ticker": t,
        "sentiment": sentiment,
        "article_count": len(articles),
        "recent_headlines": headlines[:5],
    }


@router.get("/heatmap")
async def sector_heatmap():
    """Get sector performance data for heatmap — concurrent batch fetch"""
    companies = stock_service.get_sp500_list()

    # Group by sector
    sectors = {}
    for c in companies:
        sector = c["sector"]
        if sector not in sectors:
            sectors[sector] = []
        sectors[sector].append(c["symbol"])

    # Collect all sample tickers
    sample_map = {}
    all_sample_tickers = []
    for sector, symbols in sectors.items():
        sample = symbols[:5]
        sample_map[sector] = sample
        all_sample_tickers.extend(sample)

    # Batch concurrent fetch (all sectors at once)
    batch = stock_service.get_stock_data_batch(all_sample_tickers, period="5d")

    heatmap = []
    for sector, symbols in sectors.items():
        sample = sample_map[sector]
        changes = []
        for sym in sample:
            data = batch.get(sym)
            if data and data.get("change_percent") is not None:
                changes.append(data["change_percent"])

        avg_change = sum(changes) / len(changes) if changes else 0

        heatmap.append({
            "sector": sector,
            "change_percent": round(avg_change, 2),
            "num_stocks": len(symbols),
            "sample_stocks": sample[:3],
        })

    heatmap.sort(key=lambda x: x["change_percent"], reverse=True)
    return {"sectors": heatmap}


@router.get("/earnings")
async def earnings_calendar():
    """Get upcoming earnings dates for major S&P 500 stocks — concurrent"""
    # caching to avoid repeated heavy fetches
    import time
    now = time.time()
    if _earnings_cache["val"] and (now - _earnings_cache["ts"] < _EARNINGS_TTL):
        return {"earnings": _earnings_cache["val"]}

    companies = stock_service.get_sp500_list()
    # use batch fetch but limit scope to first 15 tickers to reduce latency
    symbols = [c["symbol"] for c in companies[:15]]
    batch = stock_service.get_stock_data_batch(symbols, period="1d")

    earnings = []
    for sym in symbols:
        data = batch.get(sym)
        if not data:
            continue
        ed = data.get("earnings_date") or data.get("earnings")
        if ed:
            # normalize date string to YYYY-MM-DD if possible
            ed_str = str(ed)
            if len(ed_str) >= 10:
                ed_str = ed_str[:10]
            earnings.append({
                "symbol": data.get("symbol", sym),
                "name": data.get("name") or next((c["name"] for c in companies if c["symbol"] == sym), sym),
                "earnings_date": ed_str,
                "sector": data.get("sector") or next((c["sector"] for c in companies if c["symbol"] == sym), "N/A"),
            })

    earnings.sort(key=lambda x: x.get("earnings_date", "9999"))
    _earnings_cache["val"] = earnings
    _earnings_cache["ts"] = now
    return {"earnings": earnings}
