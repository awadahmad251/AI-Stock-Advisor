import re
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from services.groq_service import groq_service
from services.rag_service import rag_service
from services.stock_service import stock_service
from services.news_service import news_service


router = APIRouter()


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []


class StockMention(BaseModel):
    symbol: str
    name: str
    price: float
    change: float
    change_percent: float


class ChatResponse(BaseModel):
    response: str
    stocks_mentioned: list = []


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Main chat endpoint — processes user query through RAG pipeline and Groq LLaMA"""

    # 1. Search RAG knowledge base for relevant S&P 500 context
    rag_context = rag_service.get_context(request.message)

    # 2. Extract stock tickers from the user's query + RAG results
    tickers = extract_tickers(request.message, rag_context)

    # 3. Fetch real-time data for mentioned stocks
    stock_data_context = ""
    stocks_mentioned = []

    for ticker in tickers[:3]:  # Limit to 3 to keep response fast
        data = stock_service.get_stock_data(ticker, period="1mo")
        if data:
            stocks_mentioned.append(
                {
                    "symbol": data["symbol"],
                    "name": data["name"],
                    "price": data["current_price"] or 0,
                    "change": data["change"],
                    "change_percent": data["change_percent"],
                    "market_cap": data.get("market_cap", 0),
                    "pe_ratio": data.get("pe_ratio"),
                    "sector": data.get("sector", "N/A"),
                }
            )

            mc = data.get("market_cap", 0)
            mc_str = f"${mc:,.0f}" if mc else "N/A"
            pe_str = f"{data['pe_ratio']:.2f}" if data.get("pe_ratio") else "N/A"
            fpe_str = f"{data['forward_pe']:.2f}" if data.get("forward_pe") else "N/A"
            dy_str = f"{data['dividend_yield']:.2f}%" if data.get("dividend_yield") else "N/A"
            wh = f"${data['52_week_high']}" if data.get("52_week_high") else "N/A"
            wl = f"${data['52_week_low']}" if data.get("52_week_low") else "N/A"
            vol = f"{data['volume']:,}" if data.get("volume") else "N/A"

            stock_data_context += (
                f"\n\n📊 Real-Time Data for {data['name']} ({data['symbol']}):\n"
                f"  - Current Price: ${data['current_price']}\n"
                f"  - Daily Change: ${data['change']} ({data['change_percent']}%)\n"
                f"  - Market Cap: {mc_str}\n"
                f"  - P/E Ratio (TTM): {pe_str}\n"
                f"  - Forward P/E: {fpe_str}\n"
                f"  - Dividend Yield: {dy_str}\n"
                f"  - 52-Week Range: {wl} — {wh}\n"
                f"  - Volume: {vol}\n"
                f"  - Sector: {data.get('sector', 'N/A')}\n"
                f"  - Industry: {data.get('industry', 'N/A')}\n"
            )

    # 4. Fetch recent news related to the query
    news_context = ""
    try:
        news_articles = news_service.search_news(request.message, page_size=5)
        if news_articles:
            news_context = "\n\n📰 Recent Relevant News:\n"
            for article in news_articles[:5]:
                news_context += f"  - {article.get('title', 'N/A')} (Source: {article.get('source', 'Unknown')})\n"
                desc = article.get("description", "")
                if desc:
                    news_context += f"    {desc[:200]}\n"
    except Exception as e:
        print(f"News fetch error: {e}")

    # 5. Combine all context and send to Groq LLaMA
    full_context = rag_context + stock_data_context + news_context

    history = [
        {"role": msg.role, "content": msg.content}
        for msg in (request.history or [])
    ]

    response = groq_service.chat(request.message, full_context, history)

    return ChatResponse(
        response=response,
        stocks_mentioned=stocks_mentioned,
    )


def extract_tickers(query: str, context: str) -> list:
    """Extract stock tickers mentioned in the user's query or RAG context"""
    tickers = set()

    # Words that look like tickers but aren't
    exclude = {
        "I", "A", "IS", "IT", "IN", "ON", "AT", "TO", "OR", "AN", "BE", "DO",
        "IF", "OF", "UP", "SO", "BY", "NO", "GO", "MY", "ME", "WE", "HE",
        "THE", "AND", "FOR", "ARE", "BUT", "NOT", "YOU", "ALL", "CAN", "HAS",
        "HER", "WAS", "ONE", "OUR", "OUT", "HOW", "WHAT", "WHEN", "WHY",
        "WHICH", "LONG", "TERM", "BEST", "GOOD", "HIGH", "LOW", "TOP",
        "STOCK", "STOCKS", "INVEST", "BUY", "SELL", "HOLD", "SHOULD",
        "ABOUT", "THINK", "TELL", "MARKET", "PRICE", "SHARE", "PROFIT",
        "HAVE", "WITH", "THIS", "THAT", "FROM", "THEY", "BEEN", "SOME",
        "WILL", "WOULD", "COULD", "MORE", "MUCH", "THAN", "THEM", "ALSO",
        "INTO", "YEAR", "OVER", "SUCH", "MAKE", "LIKE", "JUST", "WHAT",
        "SP", "PE", "EPS", "ROE", "ROI", "ETF", "IPO", "CEO", "CFO",
        "AI", "VS", "GDP", "USA", "USD", "EUR", "GBP", "FAQ",
    }

    # Look for $TICKER patterns
    dollar_matches = re.findall(r"\$([A-Z]{1,5})\b", query.upper())
    tickers.update(dollar_matches)

    # Look for uppercase words that could be tickers
    word_matches = re.findall(r"\b([A-Z]{2,5})\b", query.upper())
    for match in word_matches:
        if match not in exclude:
            tickers.add(match)

    # Extract from RAG context
    if context:
        doc_tickers = re.findall(r"Ticker:\s*([A-Z]{1,5})", context)
        tickers.update(doc_tickers[:3])

    return list(tickers)[:5]
