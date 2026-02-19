from fastapi import APIRouter, Query, HTTPException
import re
from services.stock_service import stock_service

router = APIRouter()

TICKER_PATTERN = re.compile(r'^[A-Z]{1,5}(\.?[A-Z])?$')

def validate_ticker(ticker: str) -> str:
    t = ticker.upper().strip()
    if not TICKER_PATTERN.match(t):
        raise HTTPException(status_code=400, detail=f"Invalid ticker: {ticker}")
    return t


@router.get("/stocks/sp500")
async def get_sp500_list():
    """Get the full list of S&P 500 companies"""
    companies = stock_service.get_sp500_list()
    return {"companies": companies, "total": len(companies)}


@router.get("/stocks/market-summary")
async def get_market_summary():
    """Get major market indices + top company stock prices"""
    summary = stock_service.get_market_summary()
    # summary is now a dict: {indices: [...], stocks: [...], all: [...]}
    if isinstance(summary, dict):
        return summary
    # Backward compat if cache still has old format
    return {"indices": summary, "stocks": [], "all": summary}


@router.get("/stocks/{ticker}")
async def get_stock(ticker: str):
    """Get detailed stock data for a specific ticker"""
    t = validate_ticker(ticker)
    data = stock_service.get_stock_data(t)
    if data:
        return data
    return {"error": f"Could not fetch data for {t}"}


@router.get("/stocks/{ticker}/history")
async def get_stock_history(
    ticker: str, period: str = Query("1y", description="Period: 1d,5d,1mo,3mo,6mo,1y,2y,5y,max")
):
    """Get historical price data for charting"""
    t = validate_ticker(ticker)
    history = stock_service.get_stock_history(t, period)
    return {"ticker": t, "period": period, "data": history}
