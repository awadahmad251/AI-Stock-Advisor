import yfinance as yf
import pandas as pd
import json
import os
import time
import threading
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from config import DATA_PATH
from services import yahoo_direct

logger = logging.getLogger("investiq")

# ── Fallback yfinance session (used only when yahoo_direct fails) ────
import requests as _requests_lib
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
_yf_session = _requests_lib.Session()
_yf_session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
})
_retry = Retry(total=3, backoff_factor=0.5, status_forcelist=[429, 500, 502, 503, 504])
_yf_session.mount("https://", HTTPAdapter(max_retries=_retry))
_yf_session.mount("http://", HTTPAdapter(max_retries=_retry))

# ── In-memory TTL cache (bounded) ─────────────────────────
_cache = {}
_cache_lock = threading.Lock()
MAX_CACHE_SIZE = 5000


def _cache_get(key, ttl=300):
    """Get value from cache if not expired (TTL in seconds)."""
    with _cache_lock:
        entry = _cache.get(key)
        if entry and (time.time() - entry["ts"]) < ttl:
            return entry["val"]
    return None


def _cache_set(key, value):
    """Store value in cache with current timestamp. Evicts oldest if full."""
    with _cache_lock:
        if len(_cache) >= MAX_CACHE_SIZE:
            # Evict oldest 20%
            sorted_keys = sorted(_cache, key=lambda k: _cache[k]["ts"])
            for k in sorted_keys[:MAX_CACHE_SIZE // 5]:
                del _cache[k]
        _cache[key] = {"val": value, "ts": time.time()}


class StockService:
    def __init__(self):
        self.sp500_list = None
        self._executor = ThreadPoolExecutor(max_workers=10)

    # ── Batch concurrent fetching ──
    def get_stock_data_batch(self, tickers, period="5d"):
        """Fetch stock data for multiple tickers concurrently."""
        results = {}
        futures = {
            self._executor.submit(self.get_stock_data, t, period): t
            for t in tickers
        }
        for fut in as_completed(futures, timeout=60):
            ticker = futures[fut]
            try:
                data = fut.result()
                if data:
                    results[ticker] = data
            except Exception:
                pass
        return results

    def get_sp500_list(self):
        """Get list of S&P 500 companies from Wikipedia (cached locally)"""
        if self.sp500_list is not None:
            return self.sp500_list

        cache_file = os.path.join(DATA_PATH, "sp500_list.json")

        if os.path.exists(cache_file):
            with open(cache_file, "r") as f:
                self.sp500_list = json.load(f)
            return self.sp500_list

        try:
            import requests as _req
            from io import StringIO
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
            resp = _req.get(
                "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies",
                headers=headers, timeout=15
            )
            resp.raise_for_status()
            table = pd.read_html(StringIO(resp.text))
            df = table[0]

            companies = []
            for _, row in df.iterrows():
                companies.append(
                    {
                        "symbol": row["Symbol"],
                        "name": row["Security"],
                        "sector": row["GICS Sector"],
                        "sub_industry": row["GICS Sub-Industry"],
                        "headquarters": str(row.get("Headquarters Location", "N/A")),
                        "date_added": str(row.get("Date added", "N/A")),
                        "founded": str(row.get("Founded", "N/A")),
                    }
                )

            os.makedirs(DATA_PATH, exist_ok=True)
            with open(cache_file, "w") as f:
                json.dump(companies, f, indent=2)

            self.sp500_list = companies
            return companies
        except Exception as e:
            print(f"Error fetching S&P 500 list: {e}")
            return self._get_fallback_companies()

    def get_stock_data(self, ticker: str, period: str = "1mo"):
        """Get detailed stock data for a specific ticker (cached 5 min)"""
        cache_key = f"stock_data:{ticker}:{period}"
        cached = _cache_get(cache_key, ttl=300)
        if cached is not None:
            return cached

        # ── Primary: direct Yahoo API ──
        result = self._get_stock_data_direct(ticker, period)
        if result:
            _cache_set(cache_key, result)
            return result

        # ── Fallback: yfinance library ──
        result = self._get_stock_data_yf(ticker, period)
        if result:
            _cache_set(cache_key, result)
            return result

        return None

    def _get_stock_data_direct(self, ticker: str, period: str = "1mo"):
        """Fetch stock data via direct Yahoo Finance API calls."""
        try:
            summary = yahoo_direct.get_quote_summary(ticker)
            chart = yahoo_direct.get_chart(ticker, period)
            if not summary and not chart:
                return None

            current_price = (summary or {}).get("currentPrice") or 0
            prev_close = (summary or {}).get("previousClose") or 0

            if current_price and prev_close:
                change = round(current_price - prev_close, 2)
                change_pct = round((change / prev_close) * 100, 2)
            else:
                change = 0
                change_pct = 0

            div_yield = (summary or {}).get("dividendYield")

            history_data = []
            if chart:
                import datetime
                timestamps = chart.get("timestamps", [])
                opens = chart.get("opens", [])
                highs = chart.get("highs", [])
                lows = chart.get("lows", [])
                closes = chart.get("closes", [])
                volumes = chart.get("volumes", [])
                for i in range(len(timestamps)):
                    try:
                        dt = datetime.datetime.fromtimestamp(timestamps[i])
                        history_data.append({
                            "date": str(dt.date()),
                            "open": round(float(opens[i] or 0), 2),
                            "high": round(float(highs[i] or 0), 2),
                            "low": round(float(lows[i] or 0), 2),
                            "close": round(float(closes[i] or 0), 2),
                            "volume": int(volumes[i] or 0),
                        })
                    except (ValueError, TypeError, IndexError):
                        continue

            s = summary or {}
            return {
                "symbol": ticker.upper(),
                "name": s.get("longName") or s.get("shortName") or ticker,
                "current_price": current_price,
                "previous_close": prev_close,
                "change": change,
                "change_percent": change_pct,
                "market_cap": s.get("marketCap", 0),
                "pe_ratio": s.get("trailingPE"),
                "forward_pe": s.get("forwardPE"),
                "dividend_yield": round(div_yield, 2) if div_yield else None,
                "52_week_high": s.get("fiftyTwoWeekHigh"),
                "52_week_low": s.get("fiftyTwoWeekLow"),
                "volume": s.get("volume", 0),
                "avg_volume": 0,
                "sector": s.get("sector") or "N/A",
                "industry": s.get("industry") or "N/A",
                "description": s.get("longBusinessSummary", "")[:500],
                "history": history_data,
            }
        except Exception as e:
            logger.warning(f"yahoo_direct stock_data {ticker}: {e}")
            return None

    def _get_stock_data_yf(self, ticker: str, period: str = "1mo"):
        """Fallback: fetch stock data via yfinance library."""
        try:
            stock = yf.Ticker(ticker, session=_yf_session)
            info = stock.info
            hist = stock.history(period=period)

            current_price = info.get(
                "currentPrice", info.get("regularMarketPrice", 0)
            )
            prev_close = info.get("previousClose", 0)

            if current_price and prev_close:
                change = round(current_price - prev_close, 2)
                change_pct = round((change / prev_close) * 100, 2)
            else:
                change = 0
                change_pct = 0

            div_yield = info.get("dividendYield", None)

            history_data = []
            for date, row in hist.iterrows():
                try:
                    history_data.append(
                        {
                            "date": str(date.date()),
                            "open": round(float(row["Open"]), 2),
                            "high": round(float(row["High"]), 2),
                            "low": round(float(row["Low"]), 2),
                            "close": round(float(row["Close"]), 2),
                            "volume": int(row["Volume"]),
                        }
                    )
                except (ValueError, TypeError):
                    continue

            result = {
                "symbol": ticker.upper(),
                "name": info.get("longName", info.get("shortName", ticker)),
                "current_price": current_price,
                "previous_close": prev_close,
                "change": change,
                "change_percent": change_pct,
                "market_cap": info.get("marketCap", 0),
                "pe_ratio": info.get("trailingPE", None),
                "forward_pe": info.get("forwardPE", None),
                "dividend_yield": round(div_yield, 2) if div_yield else None,
                "52_week_high": info.get("fiftyTwoWeekHigh", None),
                "52_week_low": info.get("fiftyTwoWeekLow", None),
                "volume": info.get("volume", 0),
                "avg_volume": info.get("averageVolume", 0),
                "sector": info.get("sector", "N/A"),
                "industry": info.get("industry", "N/A"),
                "description": info.get("longBusinessSummary", ""),
                "history": history_data,
            }
            return result
        except Exception as e:
            logger.warning(f"yfinance stock_data {ticker}: {e}")
            return None

    def get_stock_history(self, ticker: str, period: str = "1y"):
        """Get historical price data for charts (cached 5 min)"""
        cache_key = f"stock_history:{ticker}:{period}"
        cached = _cache_get(cache_key, ttl=300)
        if cached is not None:
            return cached

        # ── Primary: direct Yahoo API ──
        chart = yahoo_direct.get_chart(ticker, period)
        if chart and chart.get("timestamps"):
            import datetime
            result = []
            ts = chart["timestamps"]
            for i in range(len(ts)):
                try:
                    dt = datetime.datetime.fromtimestamp(ts[i])
                    result.append({
                        "date": str(dt.date()),
                        "open": round(float(chart["opens"][i] or 0), 2),
                        "high": round(float(chart["highs"][i] or 0), 2),
                        "low": round(float(chart["lows"][i] or 0), 2),
                        "close": round(float(chart["closes"][i] or 0), 2),
                        "volume": int(chart["volumes"][i] or 0),
                    })
                except (ValueError, TypeError, IndexError):
                    continue
            if result:
                _cache_set(cache_key, result)
                return result

        # ── Fallback: yfinance ──
        try:
            stock = yf.Ticker(ticker, session=_yf_session)
            hist = stock.history(period=period)
            result = [
                {
                    "date": str(date.date()),
                    "open": round(float(row["Open"]), 2),
                    "high": round(float(row["High"]), 2),
                    "low": round(float(row["Low"]), 2),
                    "close": round(float(row["Close"]), 2),
                    "volume": int(row["Volume"]),
                }
                for date, row in hist.iterrows()
            ]
            _cache_set(cache_key, result)
            return result
        except Exception as e:
            logger.warning(f"yfinance history {ticker}: {e}")
            return []

    def get_market_summary(self):
        """Get major market indices + top company stocks (cached 5 min, concurrent)"""
        cache_key = "market_summary"
        cached = _cache_get(cache_key, ttl=300)
        if cached is not None:
            return cached

        indices = {
            "^GSPC": "S&P 500",
            "^DJI": "Dow Jones",
            "^IXIC": "NASDAQ",
            "^RUT": "Russell 2000",
            "^VIX": "VIX",
        }

        top_stocks = {
            "AAPL": "Apple",
            "MSFT": "Microsoft",
            "GOOGL": "Alphabet",
            "AMZN": "Amazon",
            "NVDA": "NVIDIA",
            "META": "Meta",
            "TSLA": "Tesla",
            "JPM": "JPMorgan",
            "V": "Visa",
            "WMT": "Walmart",
        }

        def fetch_ticker(symbol, name, is_index=False):
            try:
                # ── Primary: direct Yahoo API ──
                sp = yahoo_direct.get_simple_price(symbol)
                if sp:
                    return {
                        "symbol": symbol,
                        "name": name,
                        "price": sp["price"],
                        "change": sp["change"],
                        "change_percent": sp["changePercent"],
                        "type": "index" if is_index else "stock",
                    }
                # ── Fallback: yfinance ──
                tkr = yf.Ticker(symbol, session=_yf_session)
                hist = tkr.history(period="5d")
                if len(hist) >= 2:
                    current = round(float(hist["Close"].iloc[-1]), 2)
                    prev = round(float(hist["Close"].iloc[-2]), 2)
                    change = round(current - prev, 2)
                    change_pct = round((change / prev) * 100, 2) if prev else 0
                else:
                    info = tkr.info
                    current = info.get("regularMarketPrice", 0)
                    change = info.get("regularMarketChange", 0)
                    change_pct = info.get("regularMarketChangePercent", 0)
                return {
                    "symbol": symbol,
                    "name": name,
                    "price": current,
                    "change": change,
                    "change_percent": change_pct,
                    "type": "index" if is_index else "stock",
                }
            except Exception as e:
                logger.warning(f"fetch_ticker {name}: {e}")
                return None

        futures = {}
        for sym, name in indices.items():
            futures[self._executor.submit(fetch_ticker, sym, name, True)] = sym
        for sym, name in top_stocks.items():
            futures[self._executor.submit(fetch_ticker, sym, name, False)] = sym

        results = []
        for fut in as_completed(futures, timeout=45):
            result = fut.result()
            if result:
                results.append(result)

        # Sort: indices first (in order), then stocks (in order)
        index_order = list(indices.keys())
        stock_order = list(top_stocks.keys())
        full_order = index_order + stock_order

        results.sort(key=lambda x: full_order.index(x["symbol"]) if x["symbol"] in full_order else 99)

        # Return structured response
        summary = {
            "indices": [r for r in results if r.get("type") == "index"],
            "stocks": [r for r in results if r.get("type") == "stock"],
            "all": results,
        }

        _cache_set(cache_key, summary)
        return summary

    def _get_fallback_companies(self):
        """Fallback list of top S&P 500 companies"""
        return [
            {"symbol": "AAPL", "name": "Apple Inc.", "sector": "Information Technology", "sub_industry": "Technology Hardware, Storage & Peripherals", "headquarters": "Cupertino, California", "date_added": "1982-11-30", "founded": "1976"},
            {"symbol": "MSFT", "name": "Microsoft Corporation", "sector": "Information Technology", "sub_industry": "Systems Software", "headquarters": "Redmond, Washington", "date_added": "1994-06-01", "founded": "1975"},
            {"symbol": "GOOGL", "name": "Alphabet Inc. (Class A)", "sector": "Communication Services", "sub_industry": "Interactive Media & Services", "headquarters": "Mountain View, California", "date_added": "2014-04-03", "founded": "1998"},
            {"symbol": "AMZN", "name": "Amazon.com Inc.", "sector": "Consumer Discretionary", "sub_industry": "Broadline Retail", "headquarters": "Seattle, Washington", "date_added": "2005-11-18", "founded": "1994"},
            {"symbol": "NVDA", "name": "NVIDIA Corporation", "sector": "Information Technology", "sub_industry": "Semiconductors", "headquarters": "Santa Clara, California", "date_added": "2001-11-30", "founded": "1993"},
            {"symbol": "META", "name": "Meta Platforms Inc.", "sector": "Communication Services", "sub_industry": "Interactive Media & Services", "headquarters": "Menlo Park, California", "date_added": "2013-12-23", "founded": "2004"},
            {"symbol": "BRK-B", "name": "Berkshire Hathaway Inc.", "sector": "Financials", "sub_industry": "Multi-Sector Holdings", "headquarters": "Omaha, Nebraska", "date_added": "2010-02-16", "founded": "1839"},
            {"symbol": "JPM", "name": "JPMorgan Chase & Co.", "sector": "Financials", "sub_industry": "Diversified Banks", "headquarters": "New York City, New York", "date_added": "1975-06-30", "founded": "1799"},
            {"symbol": "TSLA", "name": "Tesla Inc.", "sector": "Consumer Discretionary", "sub_industry": "Automobile Manufacturers", "headquarters": "Austin, Texas", "date_added": "2020-12-21", "founded": "2003"},
            {"symbol": "V", "name": "Visa Inc.", "sector": "Financials", "sub_industry": "Transaction & Payment Processing Services", "headquarters": "San Francisco, California", "date_added": "2009-12-21", "founded": "1958"},
            {"symbol": "JNJ", "name": "Johnson & Johnson", "sector": "Health Care", "sub_industry": "Pharmaceuticals", "headquarters": "New Brunswick, New Jersey", "date_added": "1973-06-30", "founded": "1886"},
            {"symbol": "WMT", "name": "Walmart Inc.", "sector": "Consumer Staples", "sub_industry": "Consumer Staples Merchandise Retail", "headquarters": "Bentonville, Arkansas", "date_added": "1982-08-31", "founded": "1962"},
            {"symbol": "UNH", "name": "UnitedHealth Group", "sector": "Health Care", "sub_industry": "Managed Health Care", "headquarters": "Minnetonka, Minnesota", "date_added": "1994-07-01", "founded": "1977"},
            {"symbol": "XOM", "name": "Exxon Mobil Corporation", "sector": "Energy", "sub_industry": "Integrated Oil & Gas", "headquarters": "Spring, Texas", "date_added": "1957-03-04", "founded": "1999"},
            {"symbol": "PG", "name": "Procter & Gamble", "sector": "Consumer Staples", "sub_industry": "Household Products", "headquarters": "Cincinnati, Ohio", "date_added": "1957-03-04", "founded": "1837"},
            {"symbol": "MA", "name": "Mastercard Inc.", "sector": "Financials", "sub_industry": "Transaction & Payment Processing Services", "headquarters": "Purchase, New York", "date_added": "2008-07-18", "founded": "1966"},
            {"symbol": "HD", "name": "The Home Depot", "sector": "Consumer Discretionary", "sub_industry": "Home Improvement Retail", "headquarters": "Atlanta, Georgia", "date_added": "1988-03-31", "founded": "1978"},
            {"symbol": "CVX", "name": "Chevron Corporation", "sector": "Energy", "sub_industry": "Integrated Oil & Gas", "headquarters": "San Ramon, California", "date_added": "1957-03-04", "founded": "1879"},
            {"symbol": "LLY", "name": "Eli Lilly and Company", "sector": "Health Care", "sub_industry": "Pharmaceuticals", "headquarters": "Indianapolis, Indiana", "date_added": "1970-08-31", "founded": "1876"},
            {"symbol": "ABBV", "name": "AbbVie Inc.", "sector": "Health Care", "sub_industry": "Pharmaceuticals", "headquarters": "North Chicago, Illinois", "date_added": "2012-12-31", "founded": "2013"},
        ]


stock_service = StockService()
