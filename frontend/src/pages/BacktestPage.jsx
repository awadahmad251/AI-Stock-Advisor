import { useState } from 'react';
import { BarChart3, Loader, DollarSign, TrendingUp, Calendar } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { runBacktest } from '../api';
import { useLanguage } from '../context/LanguageContext';

const PERIODS = ['1y', '2y', '3y', '5y', '10y'];

export default function BacktestPage() {
  const { t } = useLanguage();
  const [symbol, setSymbol] = useState('');
  const [investment, setInvestment] = useState('10000');
  const [period, setPeriod] = useState('5y');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleRun = async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const data = await runBacktest(symbol.toUpperCase(), parseFloat(investment), period);
      setResult(data);
    } catch (e) {
      console.error(e);
      alert('Backtest failed: ' + (e.response?.data?.detail || e.message));
    }
    setLoading(false);
  };

  const chartData = (result?.chart || result?.history || []).map((h) => ({
    date: h.date,
    value: h.value,
  }));

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-purple to-accent-blue flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">{t('backtest')}</h1>
          <p className="text-xs text-gray-500">What if you had invested? See historical returns</p>
        </div>
      </div>

      {/* Controls */}
      <div className="rounded-xl bg-dark-100 border border-dark-300/50 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            type="text" placeholder={t('enterTicker')} value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="bg-dark-200 border border-dark-400/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-green/50"
          />
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="number" placeholder={t('investment')} value={investment}
              onChange={(e) => setInvestment(e.target.value)}
              className="bg-dark-200 border border-dark-400/50 rounded-lg pl-8 pr-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-green/50 w-full"
            />
          </div>
          <div className="flex gap-1">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`flex-1 px-2 py-2 rounded-lg text-xs font-semibold uppercase transition-colors ${
                  period === p
                    ? 'bg-accent-green/20 text-accent-green border border-accent-green/30'
                    : 'bg-dark-200 text-gray-400 hover:text-white border border-dark-400/50'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            onClick={handleRun}
            disabled={!symbol || loading}
            className="bg-accent-green text-dark font-semibold text-sm rounded-lg px-4 py-2.5 hover:bg-accent-green/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
          >
            {loading ? <Loader className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
            {t('run')}
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4 animate-slide-up">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl bg-dark-100 border border-dark-300/50 p-4">
              <p className="text-xs text-gray-500 mb-1">Initial Investment</p>
              <p className="text-xl font-bold text-white font-mono">${parseFloat(result.initial_investment || investment).toLocaleString()}</p>
            </div>
            <div className="rounded-xl bg-dark-100 border border-dark-300/50 p-4">
              <p className="text-xs text-gray-500 mb-1">Final Value</p>
              <p className="text-xl font-bold text-accent-green font-mono">${parseFloat(result.final_value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
            </div>
            <div className="rounded-xl bg-dark-100 border border-dark-300/50 p-4">
              <p className="text-xs text-gray-500 mb-1">Total Return</p>
              <p className={`text-xl font-bold font-mono ${(result.total_return_percent || 0) >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                {(result.total_return_percent || 0) >= 0 ? '+' : ''}{(result.total_return_percent || 0).toFixed(2)}%
              </p>
            </div>
            <div className="rounded-xl bg-dark-100 border border-dark-300/50 p-4">
              <p className="text-xs text-gray-500 mb-1">Annualized Return</p>
              <p className={`text-xl font-bold font-mono ${(result.annualized_return || 0) >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                {(result.annualized_return || 0) >= 0 ? '+' : ''}{(result.annualized_return || 0).toFixed(2)}%
              </p>
            </div>
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <div className="rounded-xl bg-dark-100 border border-dark-300/50 p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Portfolio Value Over Time</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="backtestGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00d4aa" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#00d4aa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#252d3f" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false}
                    tickFormatter={(v) => new Date(v).toLocaleDateString('en', { month: 'short', year: '2-digit' })}
                    interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={55} />
                  <Tooltip
                    contentStyle={{ background: '#1c2333', border: '1px solid #313a4f', borderRadius: '8px', fontSize: '11px', color: '#e5e7eb' }}
                    formatter={(v) => [`$${parseFloat(v).toLocaleString('en-US', { maximumFractionDigits: 2 })}`, 'Value']}
                    labelFormatter={(l) => new Date(l).toLocaleDateString()}
                  />
                  <Area type="monotone" dataKey="value" stroke="#00d4aa" strokeWidth={2} fill="url(#backtestGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
