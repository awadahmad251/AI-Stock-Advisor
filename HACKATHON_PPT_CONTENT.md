# InvestIQ — AI-Powered Stock Advisor
## Hackathon Presentation Content

---

## SLIDE 1: Title Slide

**InvestIQ**
*AI-Powered Stock Advisor for Smarter Investing*

Team: [Your Team Name]
Hackathon: [Event Name] | February 2026

---

## SLIDE 2: The Problem

### Why do retail investors struggle?

- **Information Overload**: Thousands of stocks, endless financial data, contradictory news
- **No Personalized Guidance**: Generic advice doesn't fit individual portfolios
- **Expensive Tools**: Bloomberg Terminal costs $24,000/year — inaccessible to most people
- **Emotional Decision-Making**: Fear and greed drive poor investment choices

> **80% of retail investors underperform the market** — often because they lack the right tools.

---

## SLIDE 3: Our Solution

### InvestIQ: Your AI Financial Advisor

A **full-stack AI-powered platform** that gives every investor access to:
- Real-time market data and analytics
- AI chatbot trained on financial knowledge (RAG-powered)
- Technical analysis and stock screening
- Portfolio management with performance tracking
- What-if backtesting and sentiment analysis

**All free. All in one place.**

---

## SLIDE 4: Key Features (Overview)

| Feature | What It Does |
|---------|-------------|
| AI Chatbot | Answers investment questions using RAG + LLM |
| Live Market Data | Real-time prices for indices & 500+ stocks |
| Stock Screener | Filter stocks by sector, market cap, P/E, etc. |
| Technical Analysis | RSI, MACD, Bollinger Bands, moving averages |
| Portfolio Tracker | Manage holdings, track gains/losses |
| What-If Backtester | "What if I invested $10K in AAPL 5 years ago?" |
| News & Sentiment | AI-analyzed financial news sentiment |
| Stock Comparison | Compare 2 stocks side-by-side |
| Earnings Calendar | Upcoming earnings for S&P 500 companies |
| Sector Heatmap | Visual sector performance overview |
| PDF Export | Download analysis reports |

---

## SLIDE 5: Architecture Diagram

```
┌─────────────────────────────────┐
│      Frontend (React + Vite)    │  ← Vercel (CDN)
│  TailwindCSS · Chart.js · SPA  │
└──────────────┬──────────────────┘
               │ HTTPS API calls
┌──────────────▼──────────────────┐
│     Backend (FastAPI + Python)  │  ← HF Spaces (Docker)
│                                 │
│  ┌──────────┐  ┌─────────────┐  │
│  │ RAG      │  │ Yahoo       │  │
│  │ (FAISS + │  │ Finance API │  │
│  │ MiniLM)  │  │ (Direct)    │  │
│  └──────────┘  └─────────────┘  │
│                                 │
│  ┌──────────┐  ┌─────────────┐  │
│  │ Groq AI  │  │ NewsAPI     │  │
│  │ LLaMA 3  │  │ Sentiment   │  │
│  │ 70B      │  │ Analysis    │  │
│  └──────────┘  └─────────────┘  │
│                                 │
│  ┌──────────┐  ┌─────────────┐  │
│  │ SQLite   │  │ JWT Auth    │  │
│  │ Database │  │ + bcrypt    │  │
│  └──────────┘  └─────────────┘  │
└─────────────────────────────────┘
```

---

## SLIDE 6: AI & RAG System (The Brain)

### How our AI Chatbot works:

1. **Knowledge Base**: 1,006 financial documents (investment strategies, market concepts, stock analysis guides)
2. **Embedding**: Documents converted to vectors using `all-MiniLM-L6-v2` sentence transformer
3. **FAISS Index**: Facebook's similarity search — finds relevant docs in <10ms
4. **LLM**: Groq-hosted LLaMA 3.3 70B generates expert-level responses
5. **Streaming**: Real-time token-by-token response delivery

### RAG Flow:
```
User Question → Embed → FAISS Search → Top-5 Relevant Docs → 
LLM Prompt (System + Context + Question) → Streaming Response
```

**Why RAG?** Prevents hallucination by grounding AI responses in verified financial knowledge.

---

## SLIDE 7: Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React 18 + Vite 5 | Fast SPA with hot reload |
| Styling | TailwindCSS | Dark theme, responsive design |
| Charts | Chart.js + react-chartjs-2 | Interactive financial charts |
| Backend | FastAPI (Python) | Async, fast, auto-docs |
| AI Model | Groq LLaMA 3.3 70B | Free, fast inference (~250 tokens/s) |
| RAG | FAISS + sentence-transformers | Semantic search over knowledge base |
| Database | SQLite + SQLAlchemy | Lightweight, zero-config |
| Auth | JWT + bcrypt | Industry-standard security |
| Stock Data | Yahoo Finance v8 API | Real-time market data |
| News | NewsAPI | Latest financial headlines |
| Hosting | Vercel + HF Spaces | 100% free deployment |

---

## SLIDE 8: Live Demo Highlights

### Demo Flow (suggested order):

1. **Login** → Show auth system (JWT-secured)
2. **Dashboard** → Live ticker bar scrolling real market data
3. **Market Summary** → S&P 500, Dow Jones, NASDAQ live indices
4. **Stock Detail** → Search "AAPL" → see price, chart, stats, description
5. **AI Chat** → Ask: *"Should I invest in NVIDIA for long term?"*
6. **Screener** → Filter by sector: Technology, market cap > $100B
7. **Compare** → AAPL vs MSFT side-by-side
8. **Backtester** → "$10,000 in Tesla 5 years ago" → show growth
9. **Portfolio** → Add holdings, see total P&L
10. **News** → Sentiment-analyzed headlines

---

## SLIDE 9: Security & Performance

### Security
- **JWT Authentication** with 24-hour token expiry
- **bcrypt password hashing** (industry standard)
- **Rate limiting** (SlowAPI) prevents abuse
- **CORS protection** with whitelisted origins
- **401 auto-logout** with token refresh on page reload

### Performance
- **5-minute server-side cache** for stock data (reduces API calls 95%)
- **Concurrent fetching** (ThreadPoolExecutor) for market summary
- **Streaming AI responses** (no waiting for full generation)
- **FAISS vector search** in <10ms for 1,006 documents
- **Vite build** — frontend bundle optimized & gzipped

---

## SLIDE 10: Challenges & Solutions

| Challenge | Solution |
|-----------|----------|
| Yahoo Finance blocks cloud IPs | Built custom direct API client with cookie/crumb auth |
| yfinance library fails on shared servers | Created `yahoo_direct.py` — bypasses yfinance entirely |
| Free hosting with Docker support | HF Spaces (free Docker hosting, GPU-optional) |
| FAISS binary files rejected by git | Auto-rebuild index from JSON documents on startup |
| Dockerfile encoding corruption | Detected UTF-16 mix, rewrote as clean UTF-8 |
| Auth lost on page refresh | Added retry logic (3 attempts) for backend cold starts |

---

## SLIDE 11: What Makes InvestIQ Unique?

1. **RAG-Powered AI** — Not just ChatGPT wrapper. Grounded in 1,006 curated financial documents
2. **15+ Integrated Features** — One platform replaces 5-6 separate tools
3. **100% Free Stack** — No paid APIs, no credit card needed anywhere
4. **Real-Time Data** — Live Yahoo Finance integration, not cached/fake data
5. **Production-Ready** — Docker deployment, JWT auth, rate limiting, error handling
6. **Beautiful UI** — Professional dark theme with glassmorphism design

---

## SLIDE 12: Future Roadmap

- **Options Chain Analysis** — Visualize calls/puts for any stock
- **Multi-language Support** — Already have i18n framework (English + Urdu)
- **Social Features** — Share portfolios, follow top investors
- **AI Price Predictions** — ML-based price forecasting with confidence intervals
- **Mobile App** — React Native version
- **Paper Trading** — Practice trading with virtual money
- **Webhook Alerts** — Get notified on price targets

---

## SLIDE 13: Impact & Target Users

### Who benefits?
- **Beginner Investors**: Learn through AI-guided Q&A
- **Students**: Free access to professional-grade tools
- **Portfolio Managers**: Quick screening and analysis
- **Day Traders**: Real-time data + technical indicators

### By the numbers:
- **15+** integrated features
- **1,006** RAG documents for AI knowledge
- **500+** stocks tracked (full S&P 500)
- **5** market indices monitored live
- **<10ms** AI knowledge retrieval
- **$0** total hosting cost

---

## SLIDE 14: Closing Slide

### InvestIQ
*Democratizing Investment Intelligence with AI*

**Live Demo**: [Your Vercel URL]
**GitHub**: github.com/awadahmad251/AI-Stock-Advisor
**Tech**: React + FastAPI + Groq LLaMA 3.3 + FAISS RAG

> "Everyone deserves access to smart investment tools — not just Wall Street."

**Thank you!**

---

## SPEAKER NOTES / TALKING POINTS:

### Opening (30 seconds):
"Imagine having a personal financial advisor who knows every stock, every sector, and every investment strategy — available 24/7, for free. That's InvestIQ."

### Problem pitch (45 seconds):
"Retail investors are at a massive disadvantage. Professional tools cost thousands, financial news is overwhelming, and emotional decisions destroy returns. 80% of individual investors underperform the market."

### Solution pitch (60 seconds):
"InvestIQ combines real-time market data with an AI advisor powered by RAG — Retrieval Augmented Generation. Our AI doesn't hallucinate because it's grounded in over 1,000 curated financial documents. Ask it about any stock, strategy, or concept and get expert-level answers instantly."

### Tech explanation (60 seconds):
"Under the hood: React frontend on Vercel, FastAPI backend on Hugging Face Spaces with Docker. We use Groq's LLaMA 3.3 70B for AI — it generates 250 tokens per second. FAISS vector search retrieves relevant knowledge in under 10 milliseconds. All hosted 100% free."

### Closing (30 seconds):
"Wall Street has Bloomberg. Now retail investors have InvestIQ. It's free, it's live, and it's powered by the same AI technology that's reshaping the world. Thank you."
