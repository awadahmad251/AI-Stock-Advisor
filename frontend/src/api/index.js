import axios from 'axios';

// In production, VITE_API_URL points to the Koyeb backend (e.g. https://xxx.koyeb.app/api)
// In development, falls back to /api which Vite proxies to localhost:8000
const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 120000,
});

// ── Attach JWT token to every request ────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('investiq_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Auto-logout on 401 ──────────────────────────────────
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/')) {
      // Token expired — let AuthContext handle logout
      window.dispatchEvent(new Event('auth:expired'));
    }
    return Promise.reject(err);
  }
);

// ── Client-side response cache (TTL-based) ──────────────
const _apiCache = new Map();

function cachedGet(url, config = {}, ttlMs = 300000) {
  const key = url + JSON.stringify(config.params || {});
  const entry = _apiCache.get(key);
  if (entry && Date.now() - entry.ts < ttlMs) {
    return Promise.resolve(entry.data);
  }
  return api.get(url, config).then((res) => {
    _apiCache.set(key, { data: res.data, ts: Date.now() });
    return res.data;
  });
}

// ── Ping (responds even while RAG is loading) ──
export const ping = async () => {
  const response = await api.get('/ping', { timeout: 3000 });
  return response.data;
};

// ── Chat ──
export const sendMessage = async (message, history = []) => {
  const response = await api.post('/chat', { message, history });
  return response.data;
};

// ── Streaming Chat (SSE) ──
export const streamMessage = (message, history = [], onToken, onMeta, onDone, onError) => {
  const controller = new AbortController();
  const token = localStorage.getItem('investiq_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  fetch(`${API_BASE}/chat/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message, history }),
    signal: controller.signal,
  })
    .then(async (response) => {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finished = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'token') onToken?.(data.content);
              else if (data.type === 'meta') onMeta?.(data);
              else if (data.type === 'done') { finished = true; onDone?.(); }
              else if (data.type === 'error') onError?.(data.content);
            } catch {}
          }
        }
      }
      if (!finished) onDone?.();
    })
    .catch((err) => {
      if (err.name !== 'AbortError') onError?.(err.message);
    });

  return controller;
};

// ── Stocks (cached) ──
export const getMarketSummary = () => cachedGet('/stocks/market-summary', {}, 300000);

export const getSP500List = () => cachedGet('/stocks/sp500', {}, 600000);

export const getStockData = (ticker) => cachedGet(`/stocks/${ticker}`, {}, 300000);

export const getStockHistory = (ticker, period = '1y') =>
  cachedGet(`/stocks/${ticker}/history`, { params: { period } }, 300000);

// ── News (cached 3 min) ──
export const getMarketNews = (pageSize = 10) =>
  cachedGet('/news', { params: { page_size: pageSize } }, 180000);

export const searchNews = (query, pageSize = 10) =>
  cachedGet('/news/search', { params: { q: query, page_size: pageSize } }, 180000);

// ── Portfolio ──
export const getPortfolio = async (portfolioId = 'default') => {
  const response = await api.get('/portfolio', { params: { portfolio_id: portfolioId } });
  return response.data;
};

export const addHolding = async (symbol, shares, buyPrice, buyDate = '') => {
  const response = await api.post('/portfolio/add', { symbol, shares, buy_price: buyPrice, buy_date: buyDate });
  return response.data;
};

export const removeHolding = async (holdingId) => {
  const response = await api.delete(`/portfolio/${holdingId}`);
  return response.data;
};

// ── Watchlist ──
export const getWatchlist = async () => {
  const response = await api.get('/watchlist');
  return response.data;
};

export const addToWatchlist = async (symbol, alertAbove = null, alertBelow = null) => {
  const response = await api.post('/watchlist', { symbol, alert_above: alertAbove, alert_below: alertBelow });
  return response.data;
};

export const removeFromWatchlist = async (symbol) => {
  const response = await api.delete(`/watchlist/${symbol}`);
  return response.data;
};

// ── Screener (cached 5 min) ──
export const screenStocks = (params = {}) =>
  cachedGet('/screener', { params, timeout: 300000 }, 300000);

export const getSectors = () => cachedGet('/screener/sectors', {}, 600000);

// ── Compare (cached 5 min) ──
export const compareStocks = (symbols) =>
  cachedGet('/compare', { params: { symbols }, timeout: 120000 }, 300000);

// ── Symbol Search (not cached — fast autocomplete) ──
export const searchSymbol = async (q) => {
  const { data } = await api.get('/search-symbol', { params: { q }, timeout: 10000 });
  return data;
};

// ── Technical Analysis (cached 5 min) ──
export const getTechnicalAnalysis = (ticker, period = '6mo') =>
  cachedGet(`/technical/${ticker}`, { params: { period } }, 300000);

// ── Analytics (cached where sensible) ──
export const runBacktest = (symbol, investment = 10000, period = '5y') =>
  cachedGet('/backtest', { params: { symbol, investment, period }, timeout: 300000 }, 300000);

export const getSentiment = (ticker) =>
  cachedGet(`/sentiment/${ticker}`, { timeout: 60000 }, 300000);

export const getSectorHeatmap = () =>
  cachedGet('/heatmap', { timeout: 120000 }, 300000);

export const getEarningsCalendar = (force = false) => {
  if (force) {
    return api.get('/earnings', { timeout: 120000 }).then((res) => {
      // update client cache for future calls
      const key = '/earnings' + JSON.stringify({});
      _apiCache.set(key, { data: res.data, ts: Date.now() });
      return res.data;
    });
  }
  return cachedGet('/earnings', { timeout: 120000 }, 600000);
};

// ── Reports ──
export const generateReport = async (symbol) => {
  const response = await api.post('/report', { symbol }, { timeout: 120000 });
  return response.data;
};

// ── Health ──
export const checkHealth = async () => {
  const response = await api.get('/health', { timeout: 5000 });
  return response.data;
};

// ── Auth ──
export const loginUser = async (email, password) => {
  const response = await api.post('/auth/login', { email, password });
  return response.data;
};

export const registerUser = async (email, username, password, full_name = '') => {
  const response = await api.post('/auth/register', { email, username, password, full_name });
  return response.data;
};

export const getMe = async (token) => {
  const response = await api.get('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};
