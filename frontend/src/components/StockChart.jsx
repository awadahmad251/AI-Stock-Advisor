import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { X, TrendingUp, TrendingDown, Loader } from 'lucide-react';
import { getStockData } from '../api';

const PERIODS = ['1mo', '3mo', '6mo', '1y', '2y'];

export default function StockChart({ ticker, onClose }) {
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState('3mo');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ticker) return;
    setLoading(true);
    getStockData(ticker)
      .then((d) => {
        if (!d.error) setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [ticker]);

  if (loading) {
    return (
      <div className="rounded-xl bg-dark-100 border border-dark-300/50 p-4">
        <div className="flex items-center justify-center h-48">
          <Loader className="w-5 h-5 text-accent-green animate-spin" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const isPositive = (data.change || 0) >= 0;
  const history = data.history || [];
  const chartColor = isPositive ? '#00d4aa' : '#ff4757';

  // Filter history based on selected period
  const now = new Date();
  const periodDays = { '1mo': 30, '3mo': 90, '6mo': 180, '1y': 365, '2y': 730 };
  const cutoff = new Date(now - periodDays[period] * 86400000);
  const filteredHistory = history.filter((h) => new Date(h.date) >= cutoff);

  return (
    <div className="rounded-xl bg-dark-100 border border-dark-300/50 p-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-white text-base">{data.symbol}</h3>
            <span className={`flex items-center gap-0.5 text-xs font-mono font-semibold px-2 py-0.5 rounded-full ${
              isPositive ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-red/10 text-accent-red'
            }`}>
              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {isPositive ? '+' : ''}{data.change_percent?.toFixed(2)}%
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{data.name}</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-300 p-1 rounded hover:bg-dark-300 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Price */}
      <div className="mb-3">
        <span className="text-2xl font-bold text-white font-mono">
          ${data.current_price?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </span>
        <span className={`ml-2 text-sm font-mono ${isPositive ? 'text-accent-green' : 'text-accent-red'}`}>
          {isPositive ? '+' : ''}${data.change?.toFixed(2)}
        </span>
      </div>

      {/* Period Selector */}
      <div className="flex gap-1 mb-3">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase transition-colors ${
              period === p
                ? 'bg-accent-green/20 text-accent-green border border-accent-green/30'
                : 'text-gray-500 hover:text-gray-300 hover:bg-dark-300'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Chart */}
      {filteredHistory.length > 0 ? (
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={filteredHistory}>
            <defs>
              <linearGradient id={`gradient-${ticker}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColor} stopOpacity={0.3} />
                <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => {
                const d = new Date(v);
                return `${d.getMonth() + 1}/${d.getDate()}`;
              }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fontSize: 9, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${v}`}
              width={55}
            />
            <Tooltip
              contentStyle={{
                background: '#1c2333',
                border: '1px solid #313a4f',
                borderRadius: '8px',
                fontSize: '11px',
                color: '#e5e7eb',
              }}
              formatter={(value) => [`$${value.toFixed(2)}`, 'Price']}
              labelFormatter={(label) => new Date(label).toLocaleDateString()}
            />
            <Area
              type="monotone"
              dataKey="close"
              stroke={chartColor}
              strokeWidth={1.5}
              fill={`url(#gradient-${ticker})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-40 flex items-center justify-center text-gray-500 text-xs">
          No chart data available
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        {[
          { label: 'Market Cap', value: data.market_cap ? `$${(data.market_cap / 1e9).toFixed(1)}B` : 'N/A' },
          { label: 'P/E Ratio', value: data.pe_ratio ? data.pe_ratio.toFixed(2) : 'N/A' },
          { label: 'Div Yield', value: data.dividend_yield ? `${data.dividend_yield}%` : 'N/A' },
          { label: '52W Range', value: data['52_week_low'] && data['52_week_high'] ? `$${data['52_week_low']?.toFixed(0)}-$${data['52_week_high']?.toFixed(0)}` : 'N/A' },
        ].map((metric, i) => (
          <div key={i} className="px-2.5 py-2 rounded-lg bg-dark-200/50 border border-dark-400/30">
            <p className="text-[10px] text-gray-500 uppercase">{metric.label}</p>
            <p className="text-xs font-semibold text-gray-200 font-mono">{metric.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
