from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from contextlib import asynccontextmanager
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
import json
import re
import os
import asyncio
import logging

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

logger = logging.getLogger("investiq")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

from routers import chat, stocks, news
from routers import portfolio, screener, analytics
from routers.auth import router as auth_router
from services.rag_service import rag_service
from services.groq_service import groq_service, SYSTEM_PROMPT
from services.stock_service import stock_service
from services.news_service import news_service
from config import GROQ_API_KEY, GROQ_MODEL, RATE_LIMIT_DEFAULT, RATE_LIMIT_CHAT
from database import init_db

# ── Rate Limiter ──
limiter = Limiter(key_func=get_remote_address, default_limits=[RATE_LIMIT_DEFAULT])

# ── Startup state tracking ──
startup_state = {"rag_ready": False, "rag_error": None}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: init DB + kick off RAG init in background"""
    # Initialize database tables
    init_db()
    logger.info("Database initialized")

    async def _init_rag():
        try:
            await rag_service.initialize()
            startup_state["rag_ready"] = True
            logger.info("RAG pipeline ready")
        except Exception as e:
            startup_state["rag_error"] = str(e)
            logger.error(f"RAG init failed: {e}")

    # Non-blocking: server starts right away, RAG loads in background
    asyncio.create_task(_init_rag())
    yield


app = FastAPI(
    title="InvestIQ — AI Stock Advisor",
    description="AI-powered investment advisor with auth, RAG, real-time data, and rate limiting",
    version="3.0.0",
    lifespan=lifespan,
)

# Rate limiter state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — allow all origins for development/hackathon; restrict in production
allowed_origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True if "*" not in allowed_origins else False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──
app.include_router(auth_router, prefix="/api", tags=["Auth"])
app.include_router(chat.router, prefix="/api", tags=["Chat"])
app.include_router(stocks.router, prefix="/api", tags=["Stocks"])
app.include_router(news.router, prefix="/api", tags=["News"])
app.include_router(portfolio.router, prefix="/api", tags=["Portfolio"])
app.include_router(screener.router, prefix="/api", tags=["Screener"])
app.include_router(analytics.router, prefix="/api", tags=["Analytics"])


# ── Streaming Chat Endpoint ───────────────────────────────

class StreamChatRequest(BaseModel):
    message: str = Field(..., max_length=2000)
    history: Optional[List[dict]] = []

    @field_validator('message')
    @classmethod
    def message_not_empty(cls, v):
        if not v.strip():
            raise ValueError('Message cannot be empty')
        return v.strip()


@app.post("/api/chat/stream")
@limiter.limit(RATE_LIMIT_CHAT)
async def chat_stream(request: Request, body: StreamChatRequest):
    """Server-Sent Events streaming chat — token by token like ChatGPT"""

    # Build context (same as normal chat)
    rag_context = rag_service.get_context(body.message)

    # Extract tickers
    tickers = set()
    exclude = {"I","A","IS","IT","IN","ON","AT","TO","OR","AN","BE","DO","IF","OF","UP","SO","BY","NO","GO","MY","ME","WE","HE","THE","AND","FOR","ARE","BUT","NOT","YOU","ALL","CAN","HAS","HER","WAS","ONE","OUR","OUT","HOW","WHAT","WHEN","WHY","WHICH","LONG","TERM","BEST","GOOD","HIGH","LOW","TOP","STOCK","STOCKS","INVEST","BUY","SELL","HOLD","SHOULD","ABOUT","THINK","TELL","MARKET","PRICE","SHARE","PROFIT","HAVE","WITH","THIS","THAT","FROM","THEY","BEEN","SOME","WILL","WOULD","COULD","MORE","MUCH","THAN","THEM","ALSO","INTO","YEAR","OVER","SUCH","MAKE","LIKE","JUST","SP","PE","EPS","ROE","ROI","ETF","IPO","CEO","CFO","AI","VS","GDP","USA","USD","EUR","GBP","FAQ"}
    dollar_matches = re.findall(r"\$([A-Z]{1,5})\b", body.message.upper())
    tickers.update(dollar_matches)
    word_matches = re.findall(r"\b([A-Z]{2,5})\b", body.message.upper())
    for m in word_matches:
        if m not in exclude:
            tickers.add(m)
    if rag_context:
        doc_tickers = re.findall(r"Ticker:\s*([A-Z]{1,5})", rag_context)
        tickers.update(doc_tickers[:3])

    stock_data_context = ""
    stocks_mentioned = []
    for ticker in list(tickers)[:3]:
        data = stock_service.get_stock_data(ticker, period="1mo")
        if data:
            stocks_mentioned.append({
                "symbol": data["symbol"],
                "name": data["name"],
                "price": data["current_price"] or 0,
                "change": data["change"],
                "change_percent": data["change_percent"],
                "market_cap": data.get("market_cap", 0),
                "pe_ratio": data.get("pe_ratio"),
                "sector": data.get("sector", "N/A"),
            })
            mc = data.get("market_cap", 0)
            stock_data_context += f"\n📊 {data['name']} ({data['symbol']}): ${data['current_price']} ({'+' if data['change'] >= 0 else ''}{data['change_percent']}%), MCap: ${mc:,.0f}, P/E: {data.get('pe_ratio', 'N/A')}\n"

    news_context = ""
    try:
        articles = news_service.search_news(body.message, page_size=5)
        if articles:
            news_context = "\n📰 News:\n" + "\n".join(f"- {a['title']}" for a in articles[:5])
    except Exception:
        pass

    full_context = rag_context + stock_data_context + news_context

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if full_context:
        messages.append({"role": "system", "content": "Real-time data:\n\n" + full_context})
    for msg in (body.history or [])[-10:]:
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": body.message})

    client = groq_service.client  # reuse singleton

    def generate():
        yield f"data: {json.dumps({'type': 'meta', 'stocks_mentioned': stocks_mentioned})}\n\n"
        try:
            stream = client.chat.completions.create(
                model=GROQ_MODEL,
                messages=messages,
                temperature=0.7,
                max_tokens=2048,
                stream=True,
            )
            for chunk in stream:
                if chunk.choices[0].delta.content:
                    token = chunk.choices[0].delta.content
                    yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


# ── Report Generation Endpoint ────────────────────────────

class ReportRequest(BaseModel):
    symbol: str
    include_technical: bool = True
    include_news: bool = True


@app.post("/api/report")
@limiter.limit(RATE_LIMIT_CHAT)
async def generate_report(request: Request, req: ReportRequest):
    """Generate an AI investment report for a stock"""
    data = stock_service.get_stock_data(req.symbol.upper(), period="1y")
    if not data:
        return {"error": f"Could not fetch data for {req.symbol}"}

    context = f"""
Stock: {data['name']} ({data['symbol']})
Price: ${data['current_price']}
Change: {data['change']} ({data['change_percent']}%)
Market Cap: ${data.get('market_cap', 0):,.0f}
P/E: {data.get('pe_ratio', 'N/A')}
Forward P/E: {data.get('forward_pe', 'N/A')}
Div Yield: {data.get('dividend_yield', 'N/A')}%
52W High: ${data.get('52_week_high', 'N/A')}
52W Low: ${data.get('52_week_low', 'N/A')}
Sector: {data.get('sector', 'N/A')}
Industry: {data.get('industry', 'N/A')}
"""

    if req.include_news:
        articles = news_service.search_news(req.symbol, page_size=5)
        if articles:
            context += "\nRecent News:\n" + "\n".join(f"- {a['title']}" for a in articles[:5])

    prompt = f"""Generate a comprehensive investment analysis report for {data['name']} ({data['symbol']}).
Include these sections:
1. **Executive Summary**
2. **Company Overview**
3. **Financial Analysis**
4. **Valuation Assessment**
5. **Risk Factors**
6. **Bull vs Bear Case**
7. **Investment Recommendation**
8. **Key Metrics Table**

Use the real data below."""

    response = groq_service.chat(prompt, context)

    return {
        "symbol": data["symbol"],
        "name": data["name"],
        "report": response,
        "data": {
            "current_price": data["current_price"],
            "change_percent": data["change_percent"],
            "market_cap": data.get("market_cap", 0),
            "pe_ratio": data.get("pe_ratio"),
            "sector": data.get("sector"),
        },
        "generated_at": __import__("datetime").datetime.now().isoformat(),
    }


@app.get("/api/health")
async def health_check():
    status = rag_service.get_status()
    return {
        "status": "healthy",
        "service": "InvestIQ — AI Stock Advisor",
        "version": "3.0.0",
        "rag": status,
        "rag_ready": startup_state["rag_ready"],
        "rag_error": startup_state["rag_error"],
        "auth": "enabled",
        "rate_limiting": "enabled",
        "database": "enabled",
    }


@app.get("/api/ping")
async def ping():
    """Ultra-fast endpoint — responds even while RAG is still loading."""
    return {
        "status": "ok",
        "rag_ready": startup_state["rag_ready"],
    }
