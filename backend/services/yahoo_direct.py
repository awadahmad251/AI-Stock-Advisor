"""
Direct Yahoo Finance API client.
Bypasses the yfinance library which gets blocked on cloud/shared IPs.
Uses Yahoo's v8 chart API with proper cookie/crumb handling.
"""
import requests
import time
import logging
import threading

logger = logging.getLogger("investiq")

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json,text/html,application/xhtml+xml,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://finance.yahoo.com/",
    "Origin": "https://finance.yahoo.com",
}

_PERIOD_MAP = {
    "1d": ("1d", "5m"),
    "5d": ("5d", "1d"),
    "1mo": ("1mo", "1d"),
    "3mo": ("3mo", "1d"),
    "6mo": ("6mo", "1d"),
    "1y": ("1y", "1d"),
    "2y": ("2y", "1wk"),
    "5y": ("5y", "1wk"),
    "10y": ("10y", "1mo"),
    "max": ("max", "1mo"),
}

# ── Cookie / crumb cache ──────────────────────────────────
_cookie_lock = threading.Lock()
_cookie_cache = {"cookie": None, "crumb": None, "ts": 0}


def _refresh_cookie_crumb(session: requests.Session) -> tuple:
    """Fetch Yahoo consent cookie + crumb (valid ~30min)."""
    with _cookie_lock:
        if _cookie_cache["cookie"] and (time.time() - _cookie_cache["ts"] < 1500):
            return _cookie_cache["cookie"], _cookie_cache["crumb"]

        logger.info("yahoo_direct: refreshing cookie/crumb")
        try:
            # Step 1 – hit fc.yahoo.com to get A3 consent cookie
            session.get("https://fc.yahoo.com", headers=_HEADERS, timeout=10,
                        allow_redirects=True)
        except Exception:
            pass  # expected to fail / redirect, but sets cookie

        try:
            # Step 2 – get crumb
            crumb_url = "https://query2.finance.yahoo.com/v1/test/getcrumb"
            r = session.get(crumb_url, headers=_HEADERS, timeout=10)
            crumb = r.text.strip() if r.status_code == 200 else None
        except Exception:
            crumb = None

        _cookie_cache["cookie"] = session.cookies
        _cookie_cache["crumb"] = crumb
        _cookie_cache["ts"] = time.time()
        return session.cookies, crumb


def _make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update(_HEADERS)
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry
    retry = Retry(total=2, backoff_factor=0.3,
                  status_forcelist=[429, 500, 502, 503, 504])
    s.mount("https://", HTTPAdapter(max_retries=retry))
    return s


_session = _make_session()


def get_chart(symbol: str, period: str = "5d") -> dict | None:
    """
    Fetch OHLCV data from Yahoo v8 chart API.
    Returns dict with keys: dates, opens, highs, lows, closes, volumes
    or None on failure.
    """
    yperiod, interval = _PERIOD_MAP.get(period, ("5d", "1d"))
    _refresh_cookie_crumb(_session)

    url = f"https://query2.finance.yahoo.com/v8/finance/chart/{symbol}"
    params = {
        "range": yperiod,
        "interval": interval,
        "includePrePost": "false",
        "events": "div,splits",
    }
    if _cookie_cache["crumb"]:
        params["crumb"] = _cookie_cache["crumb"]

    try:
        r = _session.get(url, params=params, timeout=15)
        if r.status_code != 200:
            logger.warning(f"yahoo_direct chart {symbol}: HTTP {r.status_code}")
            return None
        data = r.json()
        result = data.get("chart", {}).get("result")
        if not result:
            logger.warning(f"yahoo_direct chart {symbol}: empty result")
            return None

        meta = result[0].get("meta", {})
        ts = result[0].get("timestamp", [])
        indicators = result[0].get("indicators", {})
        quote = indicators.get("quote", [{}])[0]

        return {
            "symbol": symbol,
            "currency": meta.get("currency", "USD"),
            "exchangeName": meta.get("exchangeName", ""),
            "regularMarketPrice": meta.get("regularMarketPrice"),
            "previousClose": meta.get("chartPreviousClose") or meta.get("previousClose"),
            "timestamps": ts,
            "opens": quote.get("open", []),
            "highs": quote.get("high", []),
            "lows": quote.get("low", []),
            "closes": quote.get("close", []),
            "volumes": quote.get("volume", []),
        }
    except Exception as e:
        logger.error(f"yahoo_direct chart {symbol}: {e}")
        return None


def get_quote_summary(symbol: str) -> dict | None:
    """
    Fetch detailed quote info from Yahoo quoteSummary API.
    Returns dict with common stock fields or None.
    """
    _refresh_cookie_crumb(_session)

    url = f"https://query2.finance.yahoo.com/v10/finance/quoteSummary/{symbol}"
    params = {
        "modules": "price,summaryDetail,defaultKeyStatistics,financialData,assetProfile,calendarEvents",
    }
    if _cookie_cache["crumb"]:
        params["crumb"] = _cookie_cache["crumb"]

    try:
        r = _session.get(url, params=params, timeout=15)
        if r.status_code != 200:
            logger.warning(f"yahoo_direct summary {symbol}: HTTP {r.status_code}")
            return None
        data = r.json()
        results = data.get("quoteSummary", {}).get("result")
        if not results:
            return None

        price = results[0].get("price", {})
        summary = results[0].get("summaryDetail", {})
        stats = results[0].get("defaultKeyStatistics", {})
        fin = results[0].get("financialData", {})
        profile = results[0].get("assetProfile", {})

        def _val(d, k):
            v = d.get(k, {})
            if isinstance(v, dict):
                return v.get("raw") or v.get("fmt")
            return v

        # parse earnings date from calendarEvents if present
        cal = results[0].get('calendarEvents', {})
        earnings_date = None
        try:
            earnings = cal.get('earnings', {})
            if earnings:
                ed = earnings.get('earningsDate')
                # earningsDate may be a list of dicts or a single dict/value
                if isinstance(ed, list) and len(ed) > 0:
                    first = ed[0]
                    if isinstance(first, dict):
                        earnings_date = first.get('raw') or first.get('fmt')
                    else:
                        earnings_date = first
                elif isinstance(ed, dict):
                    earnings_date = ed.get('raw') or ed.get('fmt')
                else:
                    earnings_date = ed
        except Exception:
            earnings_date = None

        return {
            "symbol": symbol,
            "shortName": _val(price, "shortName"),
            "longName": _val(price, "longName"),
            "currentPrice": _val(price, "regularMarketPrice"),
            "previousClose": _val(summary, "previousClose") or _val(price, "regularMarketPreviousClose"),
            "open": _val(summary, "open") or _val(price, "regularMarketOpen"),
            "dayHigh": _val(summary, "dayHigh") or _val(price, "regularMarketDayHigh"),
            "dayLow": _val(summary, "dayLow") or _val(price, "regularMarketDayLow"),
            "volume": _val(summary, "volume") or _val(price, "regularMarketVolume"),
            "marketCap": _val(price, "marketCap"),
            "fiftyTwoWeekHigh": _val(summary, "fiftyTwoWeekHigh"),
            "fiftyTwoWeekLow": _val(summary, "fiftyTwoWeekLow"),
            "trailingPE": _val(summary, "trailingPE"),
            "forwardPE": _val(stats, "forwardPE") or _val(summary, "forwardPE"),
            "dividendYield": _val(summary, "dividendYield"),
            "beta": _val(summary, "beta") or _val(stats, "beta"),
            "trailingEps": _val(stats, "trailingEps"),
            "targetMeanPrice": _val(fin, "targetMeanPrice"),
            "recommendationKey": _val(fin, "recommendationKey"),
            "sector": profile.get("sector", ""),
            "industry": profile.get("industry", ""),
            "longBusinessSummary": (profile.get("longBusinessSummary") or "")[:500],
            "currency": _val(price, "currency") or "USD",
            "earnings_date": earnings_date,
            "exchange": _val(price, "exchangeName"),
        }
    except Exception as e:
        logger.error(f"yahoo_direct summary {symbol}: {e}")
        return None


def get_simple_price(symbol: str) -> dict | None:
    """Quick fetch: just current price + previous close for ticker bar."""
    chart = get_chart(symbol, "5d")
    if not chart:
        return None
    closes = [c for c in (chart.get("closes") or []) if c is not None]
    if len(closes) < 2:
        return None
    current = round(closes[-1], 2)
    prev = round(closes[-2], 2)
    change = round(current - prev, 2)
    pct = round((change / prev) * 100, 2) if prev else 0
    return {
        "symbol": symbol,
        "price": current,
        "change": change,
        "changePercent": pct,
    }
