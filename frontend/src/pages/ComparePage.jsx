import { useState, useRef, useEffect, useCallback } from 'react';
import { GitCompare, Loader, Plus, X, Search } from 'lucide-react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { compareStocks, searchSymbol } from '../api';
import { useLanguage } from '../context/LanguageContext';

const COLORS = ['#00d4aa', '#3b82f6', '#8b5cf6', '#f5a623', '#ff4757'];

/* ── Autocomplete input for stock search ── */
function StockInput({ value, displayValue, onChange, onSelect, onClear, placeholder, canRemove }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const close = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setShowDropdown(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const doSearch = useCallback(async (q) => {
    if (q.length < 1) { setSuggestions([]); return; }
    setSearching(true);
    try {
      const res = await searchSymbol(q);
      setSuggestions(res.results || []);
    } catch { setSuggestions([]); }
    setSearching(false);
  }, []);

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val.toUpperCase());
    setShowDropdown(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 250);
  };

  const handleSelect = (item) => {
    setQuery('');
    onSelect(item.symbol, item.name);
    setShowDropdown(false);
    setSuggestions([]);
  };

  const inputDisplay = displayValue || value;

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="flex items-center gap-1">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={displayValue ? displayValue : query || value}
            placeholder={placeholder}
            onChange={handleInput}
            onFocus={() => { if (displayValue) { setQuery(''); onChange(''); onSelect('', ''); } if (suggestions.length) setShowDropdown(true); }}
            className="bg-dark-200 border border-dark-400/50 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-green/50 w-48"
          />
        </div>
        {canRemove && (
          <button onClick={onClear} className="text-gray-500 hover:text-accent-red p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-72 bg-dark-100 border border-dark-300 rounded-lg shadow-2xl max-h-56 overflow-y-auto">
          {suggestions.map((item) => (
            <button
              key={item.symbol}
              onClick={() => handleSelect(item)}
              className="w-full text-left px-3 py-2 hover:bg-dark-200 transition-colors flex items-center justify-between gap-2"
            >
              <div>
                <span className="text-accent-green font-mono font-semibold text-sm">{item.symbol}</span>
                <span className="text-gray-400 text-xs ml-2">{item.name}</span>
              </div>
              <span className="text-gray-600 text-[10px] shrink-0">{item.sector}</span>
            </button>
          ))}
        </div>
      )}
      {showDropdown && searching && (
        <div className="absolute z-50 top-full mt-1 w-72 bg-dark-100 border border-dark-300 rounded-lg shadow-2xl px-3 py-3 text-xs text-gray-500 flex items-center gap-2">
          <Loader className="w-3 h-3 animate-spin" /> Searching...
        </div>
      )}
    </div>
  );
}

export default function ComparePage() {
  const { t } = useLanguage();
  const [entries, setEntries] = useState([
    { symbol: '', displayName: '' },
    { symbol: '', displayName: '' },
  ]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const addEntry = () => {
    if (entries.length < 5) setEntries([...entries, { symbol: '', displayName: '' }]);
  };

  const removeEntry = (idx) => {
    if (entries.length > 2) setEntries(entries.filter((_, i) => i !== idx));
  };

  const updateSymbol = (idx, sym) => {
    const copy = [...entries];
    copy[idx] = { symbol: sym, displayName: '' };
    setEntries(copy);
  };

  const selectSymbol = (idx, sym, name) => {
    const copy = [...entries];
    copy[idx] = { symbol: sym, displayName: sym ? `${sym} — ${name}` : '' };
    setEntries(copy);
  };

  const handleCompare = async () => {
    const valid = entries.filter((e) => e.symbol.trim());
    if (valid.length < 2) {
      setError('Enter at least 2 stock symbols or names to compare');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const data = await compareStocks(valid.map((e) => e.symbol).join(','));
      if (!data?.stocks?.length) {
        setError('No data found. Try using ticker symbols like AAPL, MSFT, GOOGL.');
      }
      setResult(data);
    } catch (e) {
      console.error(e);
      setError('Failed to fetch comparison data. Please try again.');
    }
    setLoading(false);
  };

  const stocks = result?.stocks || [];

  // Radar data: normalize metrics 0-100
  const radarMetrics = ['pe_ratio', 'dividend_yield', 'change_percent', 'market_cap_B'];
  const radarLabels = { pe_ratio: 'P/E Ratio', dividend_yield: 'Dividend', change_percent: 'Performance', market_cap_B: 'Size' };

  const radarData = radarMetrics.map((metric) => {
    const entry = { metric: radarLabels[metric] || metric };
    const vals = stocks.map((s) => {
      if (metric === 'market_cap_B') return (s.market_cap || 0) / 1e9;
      return s[metric] || 0;
    });
    const maxVal = Math.max(...vals.map(Math.abs), 1);
    stocks.forEach((s, i) => {
      const v = metric === 'market_cap_B' ? (s.market_cap || 0) / 1e9 : (s[metric] || 0);
      entry[s.symbol] = Math.abs(v / maxVal * 100);
    });
    return entry;
  });

  // Bar chart data
  const barData = stocks.map((s) => ({
    symbol: s.symbol,
    price: s.current_price || 0,
    change: s.change_percent || 0,
    pe: s.pe_ratio || 0,
    dividend: s.dividend_yield || 0,
  }));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-green to-accent-purple flex items-center justify-center">
          <GitCompare className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">{t('compare')}</h1>
          <p className="text-xs text-gray-500">Search by company name or ticker symbol — compare up to 5 stocks</p>
        </div>
      </div>

      {/* Input */}
      <div className="rounded-xl bg-dark-100 border border-dark-300/50 p-4">
        <div className="flex flex-wrap gap-3 items-start">
          {entries.map((entry, i) => (
            <StockInput
              key={i}
              value={entry.symbol}
              displayValue={entry.displayName}
              onChange={(val) => updateSymbol(i, val)}
              onSelect={(sym, name) => selectSymbol(i, sym, name)}
              onClear={() => removeEntry(i)}
              placeholder={`Stock ${i + 1} (e.g. Apple)`}
              canRemove={entries.length > 2}
            />
          ))}
          {entries.length < 5 && (
            <button onClick={addEntry} className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-white bg-dark-200 border border-dark-400/50 hover:bg-dark-300 transition-colors mt-0.5">
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          )}
          <button
            onClick={handleCompare}
            disabled={loading || entries.filter((e) => e.symbol.trim()).length < 2}
            className="bg-accent-green text-dark font-semibold text-sm rounded-lg px-5 py-2 hover:bg-accent-green/90 disabled:opacity-50 transition-colors flex items-center gap-1.5 ml-auto mt-0.5"
          >
            {loading ? <Loader className="w-4 h-4 animate-spin" /> : <GitCompare className="w-4 h-4" />}
            {t('compare')}
          </button>
        </div>
        {error && <p className="text-accent-red text-xs mt-2">{error}</p>}
      </div>

      {/* Results */}
      {stocks.length > 0 && (
        <div className="space-y-4 animate-slide-up">
          {/* Comparison Table */}
          <div className="rounded-xl bg-dark-100 border border-dark-300/50 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-300/50">
                  <th className="text-left text-xs font-semibold text-gray-400 px-4 py-3">Metric</th>
                  {stocks.map((s) => (
                    <th key={s.symbol} className="text-right text-xs font-semibold px-4 py-3">
                      <span className="text-accent-green">{s.symbol}</span>
                      <span className="text-gray-500 font-normal ml-1 hidden sm:inline">{s.name?.split(' ')[0]}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Price', key: 'current_price', fmt: (v) => `$${v?.toFixed(2) || '—'}` },
                  { label: 'Change %', key: 'change_percent', fmt: (v) => `${v >= 0 ? '+' : ''}${v?.toFixed(2) || 0}%`, color: true },
                  { label: 'Market Cap', key: 'market_cap', fmt: (v) => v ? `$${(v / 1e9).toFixed(1)}B` : '—' },
                  { label: 'P/E Ratio', key: 'pe_ratio', fmt: (v) => v?.toFixed(1) || '—' },
                  { label: 'Div Yield', key: 'dividend_yield', fmt: (v) => v ? `${v.toFixed(2)}%` : '—' },
                  { label: '52W High', key: '52_week_high', fmt: (v) => `$${v?.toFixed(2) || '—'}` },
                  { label: '52W Low', key: '52_week_low', fmt: (v) => `$${v?.toFixed(2) || '—'}` },
                  { label: 'Sector', key: 'sector', fmt: (v) => v || '—' },
                  { label: 'YTD Return', key: 'ytd_return', fmt: (v) => v != null ? `${v >= 0 ? '+' : ''}${v}%` : '—', color: true },
                ].map((metric) => (
                  <tr key={metric.label} className="border-b border-dark-300/30 hover:bg-dark-200/50">
                    <td className="px-4 py-3 text-sm text-gray-300">{metric.label}</td>
                    {stocks.map((s) => {
                      const val = s[metric.key];
                      const colorClass = metric.color && val != null
                        ? (val >= 0 ? 'text-accent-green' : 'text-accent-red')
                        : 'text-white';
                      return (
                        <td key={s.symbol} className={`px-4 py-3 text-sm font-mono text-right ${colorClass}`}>
                          {metric.fmt(val)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Performance Bar Chart */}
            <div className="rounded-xl bg-dark-100 border border-dark-300/50 p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Performance Comparison</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#252d3f" />
                  <XAxis dataKey="symbol" tick={{ fontSize: 11, fill: '#e5e7eb' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false}
                    tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={{ background: '#1c2333', border: '1px solid #313a4f', borderRadius: '8px', fontSize: '11px' }} />
                  <Bar dataKey="change" name="Change %" radius={[4, 4, 0, 0]}>
                    {barData.map((entry, i) => (
                      <Cell key={i} fill={entry.change >= 0 ? '#00d4aa' : '#ff4757'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Radar Chart */}
            {radarData.length > 0 && (
              <div className="rounded-xl bg-dark-100 border border-dark-300/50 p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Radar Comparison</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#252d3f" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                    <PolarRadiusAxis tick={false} axisLine={false} />
                    {stocks.map((s, i) => (
                      <Radar key={s.symbol} name={s.symbol} dataKey={s.symbol}
                        stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.15} strokeWidth={2} />
                    ))}
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
