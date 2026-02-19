import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import PageSkeleton from './components/PageSkeleton';
import ErrorBoundary from './components/ErrorBoundary';
import { getMarketSummary, ping, checkHealth } from './api';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';

// Lazy-loaded pages — only downloaded when user navigates to them
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const PortfolioPage = lazy(() => import('./pages/PortfolioPage'));
const ScreenerPage = lazy(() => import('./pages/ScreenerPage'));
const HeatmapPage = lazy(() => import('./pages/HeatmapPage'));
const BacktestPage = lazy(() => import('./pages/BacktestPage'));
const ComparePage = lazy(() => import('./pages/ComparePage'));
const WatchlistPage = lazy(() => import('./pages/WatchlistPage'));
const EarningsPage = lazy(() => import('./pages/EarningsPage'));

export default function App() {
  const { isAuthenticated, loading: authLoading, logout } = useAuth();
  const [marketData, setMarketData] = useState([]);
  const [tickerData, setTickerData] = useState([]);
  // 'connecting' | 'loading-ai' | 'ready'
  const [connState, setConnState] = useState('connecting');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Listen for auth:expired events (401 from interceptor)
  useEffect(() => {
    const handler = () => logout();
    window.addEventListener('auth:expired', handler);
    return () => window.removeEventListener('auth:expired', handler);
  }, [logout]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let retryTimer = null;
    let cancelled = false;

    const tryConnect = async () => {
      try {
        // First try the fast /api/ping — responds even while RAG loads
        const res = await ping();
        if (res.rag_ready) {
          setConnState('ready');
          return 'ready';
        }
        setConnState('loading-ai');
        return 'loading-ai';
      } catch {
        // If ping fails, try full health check as fallback
        try {
          await checkHealth();
          setConnState('ready');
          return 'ready';
        } catch {
          setConnState('connecting');
          return 'connecting';
        }
      }
    };

    const loadMarket = async () => {
      try {
        const mkt = await getMarketSummary();
        // New structured response: { indices: [...], stocks: [...], all: [...] }
        if (mkt.all) {
          setTickerData(mkt.all);
          setMarketData(mkt.indices || []);
        } else {
          // Backward compat with old format
          const items = mkt.indices || mkt || [];
          setMarketData(items);
          setTickerData(items);
        }
      } catch (e) {
        console.error('Market data error:', e);
      }
    };

    const init = async () => {
      const state = await tryConnect();
      if (state !== 'connecting') {
        loadMarket();
      }

      // Poll every 3s until fully ready
      retryTimer = setInterval(async () => {
        if (cancelled) return;
        const s = await tryConnect();
        if (s === 'ready') {
          clearInterval(retryTimer);
          retryTimer = null;
          loadMarket();
        } else if (s === 'loading-ai') {
          loadMarket(); // data APIs work even before RAG is done
        }
      }, 3000);
    };

    init();
    // Refresh market data every 5 min once connected
    const marketInterval = setInterval(() => {
      if (connState === 'ready' || connState === 'loading-ai') loadMarket();
    }, 300000);

    return () => {
      cancelled = true;
      if (retryTimer) clearInterval(retryTimer);
      clearInterval(marketInterval);
    };
  }, [isAuthenticated]);

  // Show loading spinner while checking stored token
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-dark">
        <div className="w-8 h-8 border-2 border-accent-green/30 border-t-accent-green rounded-full animate-spin" />
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-dark dark:bg-dark light:bg-gray-50">
      {/* Sidebar Navigation */}
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header marketData={tickerData} onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />

        {connState === 'connecting' && (
          <div className="bg-accent-red/10 border-b border-accent-red/30 px-6 py-2 text-center text-sm text-accent-red flex items-center justify-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-accent-red animate-pulse" />
            Connecting to backend server... Start it with: <code className="bg-dark-200 px-2 py-0.5 rounded text-xs">cd backend &amp;&amp; uvicorn main:app --reload</code>
          </div>
        )}

        {connState === 'loading-ai' && (
          <div className="bg-accent-gold/10 border-b border-accent-gold/30 px-6 py-2 text-center text-sm text-accent-gold flex items-center justify-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-accent-gold animate-pulse" />
            Loading AI model... Stock data is available, chat will be ready in a moment.
          </div>
        )}

        <main className="flex-1 overflow-y-auto">
          <ErrorBoundary>
            <Suspense fallback={<PageSkeleton />}>
              <Routes>
                <Route path="/" element={<DashboardPage marketData={marketData} backendReady={connState !== 'connecting'} />} />
                <Route path="/portfolio" element={<PortfolioPage />} />
                <Route path="/screener" element={<ScreenerPage />} />
                <Route path="/heatmap" element={<HeatmapPage />} />
                <Route path="/backtest" element={<BacktestPage />} />
                <Route path="/compare" element={<ComparePage />} />
                <Route path="/watchlist" element={<WatchlistPage />} />
                <Route path="/earnings" element={<EarningsPage />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
