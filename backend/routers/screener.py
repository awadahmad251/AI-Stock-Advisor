from fastapi import APIRouter, Query
from services.stock_service import stock_service
from services.technical_analysis import get_all_indicators

router = APIRouter()


@router.get("/screener")
async def stock_screener(
    sector: str = Query(None, description="Filter by sector"),
    min_pe: float = Query(None),
    max_pe: float = Query(None),
    min_market_cap: float = Query(None, description="Min market cap in billions"),
    max_market_cap: float = Query(None, description="Max market cap in billions"),
    min_dividend: float = Query(None, description="Min dividend yield %"),
    sort_by: str = Query("market_cap", description="Sort field: market_cap, pe_ratio, dividend_yield, change_percent, name"),
    sort_order: str = Query("desc", description="asc or desc"),
    limit: int = Query(50, le=500),
    offset: int = Query(0),
):
    """Screen S&P 500 stocks with filters — uses concurrent batch fetching"""
    companies = stock_service.get_sp500_list()

    # Apply sector filter at list level
    if sector:
        companies = [c for c in companies if c["sector"].lower() == sector.lower()]

    # Limit scope to avoid excessive calls
    tickers = [c["symbol"] for c in companies[:limit + offset + 20]]

    # Concurrent batch fetch
    batch = stock_service.get_stock_data_batch(tickers, period="5d")

    results = []
    for company in companies:
        data = batch.get(company["symbol"])
        if not data:
            continue

        # Apply filters
        pe = data.get("pe_ratio")
        mc = data.get("market_cap", 0)
        mc_b = mc / 1e9 if mc else 0
        dy = data.get("dividend_yield")

        if min_pe is not None and (pe is None or pe < min_pe):
            continue
        if max_pe is not None and (pe is None or pe > max_pe):
            continue
        if min_market_cap is not None and mc_b < min_market_cap:
            continue
        if max_market_cap is not None and mc_b > max_market_cap:
            continue
        if min_dividend is not None and (dy is None or dy < min_dividend):
            continue

        results.append({
            "symbol": data["symbol"],
            "name": data["name"],
                "sector": company["sector"] if not data.get("sector") or str(data.get("sector")).strip().upper() in ("N/A", "") or not str(data.get("sector")).strip() else data["sector"],
            "current_price": data["current_price"],
            "change_percent": data["change_percent"],
            "market_cap": mc,
            "market_cap_b": round(mc_b, 1),
            "pe_ratio": pe,
            "forward_pe": data.get("forward_pe"),
            "dividend_yield": dy,
            "52_week_high": data.get("52_week_high"),
            "52_week_low": data.get("52_week_low"),
            "volume": data.get("volume", 0),
        })

    # Sort
    def sort_key(x):
        val = x.get(sort_by)
        if val is None:
            return float('-inf') if sort_order == "desc" else float('inf')
        return val

    results.sort(key=sort_key, reverse=(sort_order == "desc"))

    total = len(results)
    results = results[offset:offset + limit]

    return {"results": results, "total": total, "offset": offset, "limit": limit}


@router.get("/screener/sectors")
async def get_sectors():
    """Get all available sectors"""
    companies = stock_service.get_sp500_list()
    sectors = {}
    for c in companies:
        s = c["sector"]
        sectors[s] = sectors.get(s, 0) + 1
    return {"sectors": [{"name": k, "count": v} for k, v in sorted(sectors.items())]}


@router.get("/search-symbol")
async def search_symbol(q: str = Query(..., min_length=1, description="Search query — company name or partial ticker")):
    """Search for stock symbols by company name or ticker prefix"""
    query = q.strip().upper()
    companies = stock_service.get_sp500_list()
    matches = []
    for c in companies:
        name_upper = c["name"].upper()
        sym_upper = c["symbol"].upper()
        # Exact symbol match
        if sym_upper == query:
            matches.insert(0, {"symbol": c["symbol"], "name": c["name"], "sector": c.get("sector", "")})
        # Starts-with on symbol or name
        elif sym_upper.startswith(query) or name_upper.startswith(query):
            matches.append({"symbol": c["symbol"], "name": c["name"], "sector": c.get("sector", "")})
        # Contains match (lower priority)
        elif query in name_upper or query in sym_upper:
            matches.append({"symbol": c["symbol"], "name": c["name"], "sector": c.get("sector", "")})
    return {"results": matches[:10]}


def _resolve_symbol(raw: str, companies: list) -> str:
    """Resolve a company name or partial name to a ticker symbol."""
    raw_upper = raw.strip().upper()

    # 1. Exact ticker match — highest priority
    for c in companies:
        if c["symbol"].upper() == raw_upper:
            return c["symbol"]

    # 2. Exact company name match
    for c in companies:
        if c["name"].upper() == raw_upper:
            return c["symbol"]

    # 3. Name starts with input or input is in the first part of name
    for c in companies:
        name_upper = c["name"].upper()
        first_word = name_upper.split()[0] if name_upper.split() else ""
        name_before_comma = name_upper.split(",")[0]
        if name_upper.startswith(raw_upper) or raw_upper == first_word or raw_upper in name_before_comma:
            return c["symbol"]

    # 4. Fuzzy: input contained anywhere in name
    for c in companies:
        if raw_upper in c["name"].upper():
            return c["symbol"]

    # 5. Fallback: treat as ticker symbol
    return raw_upper


@router.get("/compare")
async def compare_stocks(symbols: str = Query(..., description="Comma-separated tickers or company names")):
    """Compare multiple stocks side by side — concurrent batch fetch. Accepts both ticker symbols and company names."""
    raw_inputs = [s.strip().upper() for s in symbols.split(",") if s.strip()][:6]
    companies = stock_service.get_sp500_list()
    tickers = [_resolve_symbol(r, companies) for r in raw_inputs]

    batch = stock_service.get_stock_data_batch(tickers, period="1y")
    results = []

    for ticker in tickers:
        data = batch.get(ticker)
        if not data:
            continue

        hist = data.get("history", [])
        ytd_return = None
        if len(hist) > 1:
            ytd_return = round(((hist[-1]["close"] - hist[0]["close"]) / hist[0]["close"]) * 100, 2)

        results.append({
            "symbol": data["symbol"],
            "name": data["name"],
            "current_price": data["current_price"],
            "change_percent": data["change_percent"],
            "market_cap": data.get("market_cap", 0),
            "pe_ratio": data.get("pe_ratio"),
            "forward_pe": data.get("forward_pe"),
            "dividend_yield": data.get("dividend_yield"),
            "52_week_high": data.get("52_week_high"),
            "52_week_low": data.get("52_week_low"),
            "volume": data.get("volume", 0),
            "avg_volume": data.get("avg_volume", 0),
            "sector": data.get("sector", "N/A"),
            "industry": data.get("industry", "N/A"),
            "description": data.get("description", "")[:300],
            "ytd_return": ytd_return,
        })

    return {"stocks": results}


@router.get("/technical/{ticker}")
async def get_technical_analysis(
    ticker: str,
    period: str = Query("6mo", description="1mo,3mo,6mo,1y,2y"),
):
    """Get stock history with all technical indicators"""
    history = stock_service.get_stock_history(ticker.upper(), period)
    if not history:
        return {"error": f"No data for {ticker}"}

    enriched = get_all_indicators(history)
    return {"ticker": ticker.upper(), "period": period, "data": enriched}
