import requests
from config import NEWS_API_KEY


class NewsService:
    def __init__(self):
        self.base_url = "https://newsapi.org/v2"
        self.api_key = NEWS_API_KEY

    def get_market_news(self, page_size=10):
        """Get top business/market headlines"""
        try:
            response = requests.get(
                f"{self.base_url}/top-headlines",
                params={
                    "category": "business",
                    "language": "en",
                    "pageSize": page_size,
                    "apiKey": self.api_key,
                },
                timeout=10,
            )
            data = response.json()
            if data.get("status") == "ok":
                return self._format_articles(data.get("articles", []))
            return []
        except Exception as e:
            print(f"Error fetching market news: {e}")
            return []

    def search_news(self, query, page_size=10):
        """Search for news articles by query"""
        try:
            response = requests.get(
                f"{self.base_url}/everything",
                params={
                    "q": query,
                    "language": "en",
                    "sortBy": "publishedAt",
                    "pageSize": page_size,
                    "apiKey": self.api_key,
                },
                timeout=10,
            )
            data = response.json()
            if data.get("status") == "ok":
                return self._format_articles(data.get("articles", []))
            return []
        except Exception as e:
            print(f"Error searching news for '{query}': {e}")
            return []

    def _format_articles(self, articles):
        """Format articles to a consistent structure"""
        formatted = []
        for article in articles:
            if not article.get("title") or article["title"] == "[Removed]":
                continue
            formatted.append(
                {
                    "title": article.get("title", ""),
                    "description": article.get("description", ""),
                    "url": article.get("url", ""),
                    "image": article.get("urlToImage", ""),
                    "source": article.get("source", {}).get("name", "Unknown"),
                    "published_at": article.get("publishedAt", ""),
                    "author": article.get("author", ""),
                }
            )
        return formatted


news_service = NewsService()
