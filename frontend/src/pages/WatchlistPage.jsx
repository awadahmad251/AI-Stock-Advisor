import { useState, useEffect, useCallback } from 'react';
import { Eye, Plus, Trash2, Bell, TrendingUp, TrendingDown, RefreshCcw, AlertTriangle } from 'lucide-react';
import { getWatchlist, addToWatchlist, removeFromWatchlist } from '../api';
import { useLanguage } from '../context/LanguageContext';

export default function WatchlistPage() {
  const { t } = useLanguage();
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ symbol: '', alertAbove: '', alertBelow: '' });
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getWatchlist();
      setWatchlist(data.watchlist || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.symbol) return;
    setAdding(true);
    try {
      await addToWatchlist(
        form.symbol.toUpperCase(),
        form.alertAbove ? parseFloat(form.alertAbove) : null,
        form.alertBelow ? parseFloat(form.alertBelow) : null
      );
      setForm({ symbol: '', alertAbove: '', alertBelow: '' });
      setShowAdd(false);
      await load();
    } catch (e) {
      alert('Failed: ' + (e.response?.data?.detail || e.message));
    }
    setAdding(false);
  };

  const handleRemove = async (symbol) => {
    try {
      await removeFromWatchlist(symbol);
      await load();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-3 text-gray-400">
          <RefreshCcw className="w-5 h-5 animate-spin" />
          <span>Loading watchlist...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-gold to-accent-green flex items-center justify-center">
            <Eye className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{t('watchlist')}</h1>
            <p className="text-xs text-gray-500">{watchlist.length} stocks watched</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-accent-green/10 text-accent-green border border-accent-green/30 hover:bg-accent-green/20 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add Stock
        </button>
      </div>

      {/* Add Form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="rounded-xl bg-dark-100 border border-accent-green/20 p-4 animate-slide-up">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <input
              type="text" placeholder="Symbol (e.g. AAPL)" value={form.symbol}
              onChange={(e) => setForm({ ...form, symbol: e.target.value })}
              className="bg-dark-200 border border-dark-400/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-green/50"
              required
            />
            <input
              type="number" placeholder="Alert above $" value={form.alertAbove} step="0.01"
              onChange={(e) => setForm({ ...form, alertAbove: e.target.value })}
              className="bg-dark-200 border border-dark-400/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-green/50"
            />
            <input
              type="number" placeholder="Alert below $" value={form.alertBelow} step="0.01"
              onChange={(e) => setForm({ ...form, alertBelow: e.target.value })}
              className="bg-dark-200 border border-dark-400/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-green/50"
            />
            <button type="submit" disabled={adding}
              className="bg-accent-green text-dark font-semibold text-sm rounded-lg px-4 py-2 hover:bg-accent-green/90 disabled:opacity-50 transition-colors">
              {adding ? '...' : t('add')}
            </button>
          </div>
        </form>
      )}

      {/* Watchlist Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {watchlist.map((item) => {
          const isPositive = (item.change_percent || 0) >= 0;
          const alertTriggered = item.alert_triggered;
          return (
            <div
              key={item.symbol}
              className={`rounded-xl bg-dark-100 border p-4 transition-all hover:scale-[1.01] ${
                alertTriggered ? 'border-accent-gold/50 animate-pulse-slow' : 'border-dark-300/50'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-lg">{item.symbol}</h3>
                    {alertTriggered && (
                      <span className="flex items-center gap-0.5 text-xs text-accent-gold bg-accent-gold/10 px-2 py-0.5 rounded-full">
                        <Bell className="w-3 h-3" /> Alert
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{item.name || ''}</p>
                </div>
                <button onClick={() => handleRemove(item.symbol)} className="text-gray-500 hover:text-accent-red transition-colors p-1 rounded hover:bg-dark-300">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-end justify-between">
                <div>
                  <p className="text-2xl font-bold text-white font-mono">
                    ${item.current_price?.toFixed(2) || '—'}
                  </p>
                  <span className={`flex items-center gap-1 text-sm font-mono font-medium mt-1 ${
                    isPositive ? 'text-accent-green' : 'text-accent-red'
                  }`}>
                    {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {isPositive ? '+' : ''}{item.change_percent?.toFixed(2)}%
                  </span>
                </div>
                <div className="text-right text-[10px] text-gray-500 space-y-0.5">
                  {item.alert_above && <p>Alert ↑ ${item.alert_above}</p>}
                  {item.alert_below && <p>Alert ↓ ${item.alert_below}</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {watchlist.length === 0 && (
        <div className="rounded-xl bg-dark-100 border border-dark-300/50 p-12 text-center">
          <Eye className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Your watchlist is empty. Add stocks to track them.</p>
        </div>
      )}
    </div>
  );
}
