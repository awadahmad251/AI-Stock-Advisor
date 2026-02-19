import { useState, useEffect, useCallback } from 'react';
import { Briefcase, Plus, Trash2, TrendingUp, TrendingDown, DollarSign, PieChart, RefreshCcw, FileDown } from 'lucide-react';
import { PieChart as RPieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { getPortfolio, addHolding, removeHolding, generateReport } from '../api';
import { useLanguage } from '../context/LanguageContext';
import { exportPortfolioPDF } from '../utils/pdfExport';

const COLORS = ['#00d4aa', '#3b82f6', '#8b5cf6', '#f5a623', '#ff4757', '#06b6d4', '#ec4899', '#84cc16'];

export default function PortfolioPage() {
  const { t } = useLanguage();
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ symbol: '', shares: '', buyPrice: '', buyDate: '' });
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPortfolio();
      setPortfolio(data);
    } catch (e) {
      console.error('Portfolio error:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.symbol || !form.shares || !form.buyPrice) return;
    setAdding(true);
    try {
      await addHolding(form.symbol.toUpperCase(), parseFloat(form.shares), parseFloat(form.buyPrice), form.buyDate);
      setForm({ symbol: '', shares: '', buyPrice: '', buyDate: '' });
      setShowAdd(false);
      await load();
    } catch (e) {
      alert('Failed to add holding: ' + (e.response?.data?.detail || e.message));
    }
    setAdding(false);
  };

  const handleRemove = async (id) => {
    try {
      await removeHolding(id);
      await load();
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportPDF = () => {
    if (portfolio) exportPortfolioPDF(portfolio);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-3 text-gray-400">
          <RefreshCcw className="w-5 h-5 animate-spin" />
          <span>Loading portfolio...</span>
        </div>
      </div>
    );
  }

  const holdings = portfolio?.holdings || [];
  const totalValue = holdings.reduce((sum, h) => sum + (h.market_value || 0), 0);
  const totalCost = holdings.reduce((sum, h) => sum + (h.shares * h.buy_price), 0);
  const totalPnL = totalValue - totalCost;
  const totalPnLPct = totalCost > 0 ? ((totalPnL / totalCost) * 100) : 0;

  // Pie chart data
  const pieData = holdings
    .filter((h) => h.market_value > 0)
    .map((h) => ({ name: h.symbol, value: h.market_value }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{t('portfolio')}</h1>
            <p className="text-xs text-gray-500">{holdings.length} {t('holdings')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportPDF} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-dark-200 border border-dark-400/50 text-gray-300 hover:text-white hover:bg-dark-300 transition-colors">
            <FileDown className="w-3.5 h-3.5" /> PDF
          </button>
          <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-accent-green/10 text-accent-green border border-accent-green/30 hover:bg-accent-green/20 transition-colors">
            <Plus className="w-3.5 h-3.5" /> {t('addHolding')}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl bg-dark-100 border border-dark-300/50 p-4">
          <p className="text-xs text-gray-500 mb-1">{t('totalValue')}</p>
          <p className="text-2xl font-bold text-white font-mono">${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div className="rounded-xl bg-dark-100 border border-dark-300/50 p-4">
          <p className="text-xs text-gray-500 mb-1">{t('totalPnL')}</p>
          <p className={`text-2xl font-bold font-mono ${totalPnL >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className={`text-xs font-mono ${totalPnL >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
            {totalPnLPct >= 0 ? '+' : ''}{totalPnLPct.toFixed(2)}%
          </p>
        </div>
        <div className="rounded-xl bg-dark-100 border border-dark-300/50 p-4 flex items-center justify-center">
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={100}>
              <RPieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={40} innerRadius={25}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`} />
              </RPieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-gray-500">No holdings yet</p>
          )}
        </div>
      </div>

      {/* Add Holding Form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="rounded-xl bg-dark-100 border border-accent-green/20 p-4 animate-slide-up">
          <h3 className="text-sm font-semibold text-gray-200 mb-3">{t('addHolding')}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <input
              type="text" placeholder={t('symbol')} value={form.symbol}
              onChange={(e) => setForm({ ...form, symbol: e.target.value })}
              className="bg-dark-200 border border-dark-400/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-green/50"
              required
            />
            <input
              type="number" placeholder={t('shares')} value={form.shares} step="0.01"
              onChange={(e) => setForm({ ...form, shares: e.target.value })}
              className="bg-dark-200 border border-dark-400/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-green/50"
              required
            />
            <input
              type="number" placeholder={t('buyPrice')} value={form.buyPrice} step="0.01"
              onChange={(e) => setForm({ ...form, buyPrice: e.target.value })}
              className="bg-dark-200 border border-dark-400/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-green/50"
              required
            />
            <input
              type="date" placeholder={t('buyDate')} value={form.buyDate}
              onChange={(e) => setForm({ ...form, buyDate: e.target.value })}
              className="bg-dark-200 border border-dark-400/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-green/50"
            />
            <button type="submit" disabled={adding}
              className="bg-accent-green text-dark font-semibold text-sm rounded-lg px-4 py-2 hover:bg-accent-green/90 disabled:opacity-50 transition-colors">
              {adding ? '...' : t('add')}
            </button>
          </div>
        </form>
      )}

      {/* Holdings Table */}
      <div className="rounded-xl bg-dark-100 border border-dark-300/50 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark-300/50">
              <th className="text-left text-xs font-semibold text-gray-400 px-4 py-3">{t('symbol')}</th>
              <th className="text-right text-xs font-semibold text-gray-400 px-4 py-3">{t('shares')}</th>
              <th className="text-right text-xs font-semibold text-gray-400 px-4 py-3">{t('buyPrice')}</th>
              <th className="text-right text-xs font-semibold text-gray-400 px-4 py-3">Current</th>
              <th className="text-right text-xs font-semibold text-gray-400 px-4 py-3">Value</th>
              <th className="text-right text-xs font-semibold text-gray-400 px-4 py-3">P&L</th>
              <th className="text-right text-xs font-semibold text-gray-400 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => {
              const pnl = (h.market_value || 0) - h.shares * h.buy_price;
              const pnlPct = h.buy_price > 0 ? ((h.current_price - h.buy_price) / h.buy_price * 100) : 0;
              return (
                <tr key={h.id} className="border-b border-dark-300/30 hover:bg-dark-200/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-bold text-white text-sm">{h.symbol}</span>
                  </td>
                  <td className="text-right px-4 py-3 text-sm font-mono text-gray-300">{h.shares}</td>
                  <td className="text-right px-4 py-3 text-sm font-mono text-gray-300">${h.buy_price?.toFixed(2)}</td>
                  <td className="text-right px-4 py-3 text-sm font-mono text-white">${h.current_price?.toFixed(2) || '—'}</td>
                  <td className="text-right px-4 py-3 text-sm font-mono text-white">${(h.market_value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                  <td className="text-right px-4 py-3">
                    <div className={`text-sm font-mono font-medium flex items-center justify-end gap-1 ${pnl >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                      {pnl >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {pnl >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                    </div>
                  </td>
                  <td className="text-right px-4 py-3">
                    <button onClick={() => handleRemove(h.id)} className="text-gray-500 hover:text-accent-red transition-colors p-1 rounded hover:bg-dark-300">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {holdings.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-500 text-sm">
                  No holdings yet. Click "{t('addHolding')}" to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
