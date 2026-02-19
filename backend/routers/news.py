from fastapi import APIRouter, Query
from services.news_service import news_service

router = APIRouter()


@router.get("/news")
async def get_market_news(page_size: int = Query(10, le=50)):
    """Get top business/market news headlines"""
    articles = news_service.get_market_news(page_size)
    return {"articles": articles, "total": len(articles)}


@router.get("/news/search")
async def search_news(
    q: str = Query(..., description="Search query"),
    page_size: int = Query(10, le=50),
):
    """Search for news articles by keyword"""
    articles = news_service.search_news(q, page_size)
    return {"articles": articles, "total": len(articles), "query": q}
