# InvestIQ — AI-Powered Stock Advisor

**InvestIQ** is a production-grade, full-stack AI investment advisor that combines Retrieval-Augmented Generation (RAG), real-time market data, and LLM-powered analysis to deliver institutional-grade stock insights — completely free and open source.

Built with **React 18 + FastAPI + Groq LLaMA 3.3 70B**, it features JWT authentication, SQLite/PostgreSQL database, rate limiting, and 15 integrated financial tools.

![Version](https://img.shields.io/badge/Version-3.0.0-00d4aa) ![AI](https://img.shields.io/badge/AI-LLaMA%203.3%2070B-3b82f6) ![Backend](https://img.shields.io/badge/Backend-FastAPI-009485) ![Frontend](https://img.shields.io/badge/Frontend-React%2018-61DAFB) ![Auth](https://img.shields.io/badge/Auth-JWT-orange) ![DB](https://img.shields.io/badge/DB-SQLAlchemy-red) ![License](https://img.shields.io/badge/License-MIT-yellow)

---

## What This Project Does

InvestIQ is an **AI financial assistant** that works like a personal Bloomberg Terminal. When a user asks a question like *"Should I invest in Apple?"*, here's what happens under the hood:

1. **RAG Retrieval** — The question is embedded using `all-MiniLM-L6-v2` and matched against a FAISS vector database of 1,006 S&P 500 company documents to find relevant financial context
2. **Live Market Data** — Real-time stock prices, PE ratios, market caps, and 52-week ranges are fetched from Yahoo Finance via `yfinance`
3. **News Enrichment** — Latest headlines about the stock are pulled from NewsAPI
4. **AI Analysis** — All context is fed to **Groq LLaMA 3.3 70B** (one of the fastest LLM inference engines), which streams back a professional investment analysis token-by-token via Server-Sent Events (SSE)
5. **Interactive Charts** — The frontend renders live stock charts, technical indicators, and comparison tools using Recharts

Beyond chat, InvestIQ provides **15 financial tools**: stock screener, sector heatmap, what-if backtester, portfolio tracker with P&L, earnings calendar, AI sentiment analysis, technical indicators (SMA/EMA/RSI/MACD/Bollinger Bands), PDF report generation, and more.

---

## Features (15 Total)

| # | Feature | Description |
|---|---------|-------------|
| 1 | **AI Chat Advisor** | Real-time streaming chat (SSE) powered by Groq LLaMA 3.3 70B with RAG context |
| 2 | **RAG Pipeline** | FAISS vector database with 1,006 S&P 500 company embeddings for intelligent retrieval |
| 3 | **Real-Time Market Data** | Live stock prices, indices, and financial metrics via yfinance with TTL caching |
| 4 | **Market News** | Latest business news from NewsAPI integrated into AI analysis |
| 5 | **Stock Screener** | Multi-criteria screener: sector, PE ratio, market cap, dividend yield |
| 6 | **Stock Comparison** | Side-by-side comparison of up to 5 stocks with visual charts |
| 7 | **Technical Analysis** | SMA, EMA, RSI, MACD, Bollinger Bands with interactive charts |
| 8 | **AI Sentiment Analysis** | Groq-powered news sentiment scoring (Bull/Bear/Neutral) |
| 9 | **What-If Backtester** | Backtest any stock: "What if I invested $10K in AAPL 5 years ago?" |
| 10 | **Sector Heatmap** | Visual heatmap of all 11 S&P 500 sectors with live performance data |
| 11 | **Earnings Calendar** | Upcoming earnings dates for top 50 S&P 500 companies |
| 12 | **Portfolio Tracker** | Per-user portfolio with real-time P&L, cost basis, and performance (DB-backed) |
| 13 | **Watchlist + Alerts** | Price alert system with threshold-based notifications (DB-backed) |
| 14 | **AI Investment Reports** | Generate comprehensive PDF-exportable investment analysis reports |
| 15 | **Dark/Light Theme + i18n** | Professional UI with theme toggle and multi-language support |

### Production Features (v3.0)

| Feature | Implementation |
|---------|---------------|
| **JWT Authentication** | Register/Login with bcrypt password hashing + JWT tokens (24h expiry) |
| **SQLite/PostgreSQL Database** | SQLAlchemy ORM with User, Holding, WatchlistItem models |
| **Rate Limiting** | slowapi — 60 req/min default, 20 req/min for AI chat, 10 req/min for auth |
| **Per-User Data Isolation** | Portfolio and watchlist are scoped to authenticated users |
| **Secure API** | Protected endpoints, input validation, ticker sanitization, bounded cache |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        InvestIQ v3.0.0                                    │
├──────────────────────┬───────────────────────────────────────────────────┤
│   React 18 Frontend  │              FastAPI Backend                       │
│   (Vite 5 + Tailwind)│                                                   │
│                      │   ┌──────────┐  ┌───────────┐  ┌──────────────┐  │
│  ┌────────────────┐  │   │ RAG      │  │ Groq AI   │  │ Stock Service│  │
│  │ 9 Pages        │──│──►│ (FAISS)  │  │ LLaMA 3.3 │  │ (yfinance +  │  │
│  │ Login/Register │  │   │ 1006 docs│  │ 70B       │  │  TTL cache)  │  │
│  │ Dashboard/Chat │◄─│───│          │  │ Streaming  │  │              │  │
│  │ Portfolio      │  │   └──────────┘  └───────────┘  └──────────────┘  │
│  │ Screener       │  │   ┌──────────┐  ┌───────────┐  ┌──────────────┐  │
│  │ Heatmap        │  │   │ Auth     │  │ Technical │  │ Database     │  │
│  │ Backtest       │  │   │ (JWT +   │  │ Analysis  │  │ (SQLAlchemy) │  │
│  │ Compare        │  │   │  bcrypt) │  │ SMA/EMA/  │  │ SQLite/PG    │  │
│  │ Watchlist      │  │   │          │  │ RSI/MACD  │  │              │  │
│  │ Earnings       │  │   └──────────┘  └───────────┘  └──────────────┘  │
│  └────────────────┘  │   ┌──────────┐  ┌───────────┐  ┌──────────────┐  │
│                      │   │ News     │  │ Sentiment │  │ Rate Limiter │  │
│  Auth: JWT tokens    │   │ Service  │  │ Service   │  │ (slowapi)    │  │
│  State: AuthContext  │   │(NewsAPI) │  │ (Groq)    │  │ 60/20/10 rpm │  │
│  Storage: localStorage  └──────────┘  └───────────┘  └──────────────┘  │
├──────────────────────┴───────────────────────────────────────────────────┤
│  Infra: TTL Cache │ ThreadPool(10) │ Lazy Loading │ SSE │ Rate Limits   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **AI Model** | Groq LLaMA 3.3 70B | Free, ultra-fast LLM inference (streaming) |
| **Embeddings** | sentence-transformers/all-MiniLM-L6-v2 | Text to 384-dim vectors for RAG |
| **Vector DB** | FAISS | Similarity search over 1,006 S&P 500 documents |
| **Backend** | Python 3.10+, FastAPI, Uvicorn | Async REST API with SSE streaming |
| **Database** | SQLAlchemy + SQLite (dev) / PostgreSQL (prod) | User accounts, portfolios, watchlists |
| **Auth** | JWT (python-jose) + bcrypt | Stateless authentication with 24h token expiry |
| **Rate Limiting** | slowapi | Request throttling per IP address |
| **Frontend** | React 18, Vite 5, TailwindCSS | SPA with lazy-loaded routes and dark mode |
| **Charts** | Recharts | Interactive stock charts, comparisons, technical overlays |
| **Animations** | Framer Motion | Page transitions, loading states |
| **Market Data** | yfinance | Real-time stock prices, history, fundamentals |
| **News** | NewsAPI | Latest market headlines and stock-specific news |
| **PDF Export** | jsPDF + jspdf-autotable | Downloadable AI investment reports |
| **Deployment** | Docker, Render, Railway | Multi-platform deployment ready |

---

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- Groq API Key — free at [console.groq.com](https://console.groq.com)
- NewsAPI Key — free at [newsapi.org](https://newsapi.org)

### 1. Clone and Configure

```bash
git clone https://github.com/yourusername/investiq.git
cd investiq

# Create environment file
cp .env.example .env
# Edit .env — add your GROQ_API_KEY, NEWS_API_KEY, and JWT_SECRET
```

### 2. Start Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

On first run, the system will:
- Create SQLite database automatically (`data/investiq.db`)
- Download the embedding model (~80MB one-time)
- Fetch S&P 500 company list from Wikipedia
- Build FAISS vector index (~1,006 documents)

### 3. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** — register an account and start investing with AI.

### 4. Docker (Production)

```bash
docker-compose up --build
# Frontend: http://localhost  |  Backend: http://localhost:8000
```

---

## Project Structure

```
investiq/
├── backend/
│   ├── main.py                  # FastAPI app, SSE streaming, report generation
│   ├── config.py                # Centralized config from .env
│   ├── database.py              # SQLAlchemy engine + session factory
│   ├── models.py                # User, Holding, WatchlistItem ORM models
│   ├── requirements.txt         # Python dependencies
│   ├── services/
│   │   ├── auth_service.py      # JWT creation, bcrypt hashing, auth dependencies
│   │   ├── groq_service.py      # Groq LLaMA AI chat (singleton client)
│   │   ├── stock_service.py     # Stock data (yfinance) + TTL cache + batch fetch
│   │   ├── news_service.py      # NewsAPI integration
│   │   ├── rag_service.py       # FAISS RAG pipeline (1,006 docs)
│   │   ├── portfolio_service.py # Portfolio and watchlist CRUD (DB-backed)
│   │   ├── technical_analysis.py # SMA, EMA, RSI, MACD, Bollinger Bands
│   │   └── sentiment_service.py # Groq-based sentiment analysis
│   └── routers/
│       ├── auth.py              # /api/auth/* (register, login, profile)
│       ├── chat.py              # /api/chat endpoint
│       ├── stocks.py            # /api/stocks/* endpoints
│       ├── news.py              # /api/news/* endpoints
│       ├── portfolio.py         # /api/portfolio + /api/watchlist (auth required)
│       ├── screener.py          # /api/screener + /api/compare + /api/technical
│       └── analytics.py        # /api/backtest + /api/sentiment + /api/heatmap + /api/earnings
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Router, lazy loading, ErrorBoundary, auth gate
│   │   ├── main.jsx             # React root with AuthProvider
│   │   ├── api/index.js         # API client, TTL cache, SSE streaming, JWT interceptor
│   │   ├── context/
│   │   │   ├── AuthContext.jsx   # Auth state management (login/register/logout)
│   │   │   ├── ThemeContext.jsx  # Dark/light mode toggle
│   │   │   └── LanguageContext.jsx # i18n translations
│   │   ├── pages/               # 9 lazy-loaded pages (incl. LoginPage)
│   │   └── components/          # Sidebar, ChatPanel, StockChart, etc.
│   └── vite.config.js
├── data/                        # SQLite DB + cached S&P 500 data
├── rag/                         # FAISS vector index storage
├── docker-compose.yml           # Full-stack Docker deployment
├── Dockerfile                   # Multi-stage build (backend + frontend + nginx)
├── nginx.conf                   # Production reverse proxy config
├── render.yaml                  # Render.com deployment blueprint
├── Procfile                     # Heroku/Railway deployment
├── .env.example                 # Environment variable template
└── .gitignore
```

---

## API Endpoints (25+)

### Auth

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/register` | POST | No | Create account (email, username, password) |
| `/api/auth/login` | POST | No | Login, receive JWT token |
| `/api/auth/me` | GET | Yes | Get current user profile |
| `/api/auth/me` | PUT | Yes | Update user profile |

### Core

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/health` | GET | No | Service health + RAG/DB/auth status |
| `/api/ping` | GET | No | Ultra-fast liveness check |

### AI Chat (Rate limited: 20/min)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/chat` | POST | No | AI chat with RAG context |
| `/api/chat/stream` | POST | No | Real-time SSE streaming chat |
| `/api/report` | POST | No | AI investment report generation |

### Stocks

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/stocks/sp500` | GET | No | Full S&P 500 company list |
| `/api/stocks/market-summary` | GET | No | Major market indices |
| `/api/stocks/{ticker}` | GET | No | Detailed stock data + history |
| `/api/stocks/{ticker}/history` | GET | No | Price history for charting |

### News

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/news` | GET | No | Top market headlines |
| `/api/news/search?q=` | GET | No | Search news by keyword |

### Analytics

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/screener` | GET | No | Multi-criteria stock screener |
| `/api/screener/sectors` | GET | No | S&P 500 sectors with counts |
| `/api/compare?symbols=` | GET | No | Side-by-side stock comparison |
| `/api/technical/{ticker}` | GET | No | Technical indicators (SMA/EMA/RSI/MACD/BB) |
| `/api/backtest` | GET | No | What-if backtesting |
| `/api/sentiment/{ticker}` | GET | No | AI sentiment analysis |
| `/api/heatmap` | GET | No | Sector performance heatmap |
| `/api/earnings` | GET | No | Upcoming earnings calendar |

### Portfolio (Auth required)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/portfolio` | GET | Yes | Get portfolio holdings with live P&L |
| `/api/portfolio/add` | POST | Yes | Add stock holding |
| `/api/portfolio/{id}` | PUT | Yes | Update holding |
| `/api/portfolio/{id}` | DELETE | Yes | Remove holding |
| `/api/watchlist` | GET | Yes | Get watchlist with alerts |
| `/api/watchlist` | POST | Yes | Add to watchlist |
| `/api/watchlist/{symbol}` | DELETE | Yes | Remove from watchlist |

---

## Performance

| Optimization | Before | After | Improvement |
|-------------|--------|-------|-------------|
| Market Summary (TTL cached) | 2,171ms | 35ms | **98% faster** |
| Sector Heatmap (batch fetch) | 60s | 8s | **87% faster** |
| Server Startup | 45s (blocked) | Instant | **Non-blocking RAG init** |
| Page Load | Full bundle | Lazy chunks | **Route-based code splitting** |

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GROQ_API_KEY` | Yes | — | Groq API key for LLaMA 3.3 70B |
| `NEWS_API_KEY` | Yes | — | NewsAPI key for market news |
| `JWT_SECRET` | Yes | dev fallback | Secret key for JWT token signing |
| `GROQ_MODEL` | No | `llama-3.3-70b-versatile` | Groq model name |
| `EMBEDDING_MODEL` | No | `sentence-transformers/all-MiniLM-L6-v2` | Embedding model |
| `DATABASE_URL` | No | `sqlite:///data/investiq.db` | Database connection string |
| `CORS_ORIGINS` | No | `*` | Allowed origins (comma-separated) |
| `RATE_LIMIT_DEFAULT` | No | `60/minute` | Default rate limit |
| `RATE_LIMIT_CHAT` | No | `20/minute` | AI chat rate limit |
| `RATE_LIMIT_AUTH` | No | `10/minute` | Auth endpoint rate limit |

---

## Deployment

### Vercel (Frontend Hosting)

1. Push to GitHub
2. Go to [vercel.com](https://vercel.com) and create a new project
3. Select the `frontend` directory as the root for deployment
4. Set build command: `npm run build` and output directory: `dist`
5. Deploy — Vercel will auto-build and host your React frontend

### Render.com (Backend Hosting — Optional)

1. Push to GitHub
2. Go to [render.com](https://render.com) and select New Blueprint
3. Connect your repo — `render.yaml` auto-configures backend service
4. Add environment variables: `GROQ_API_KEY`, `NEWS_API_KEY`, `JWT_SECRET`
5. Deploy

### Docker

```bash
docker-compose up --build -d
# Frontend: http://localhost  |  Backend: http://localhost:8000
```

### Railway

1. Push to GitHub then create project on [railway.app](https://railway.app)
2. Add env vars then deploy (uses `Procfile`)

---

## Disclaimer

This is an AI-powered tool for **educational and informational purposes only**. It does not constitute financial advice. Always consult with a certified financial advisor before making investment decisions. Past performance does not guarantee future results.

## License

MIT License — Open source, free to use and modify.
