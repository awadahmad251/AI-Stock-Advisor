import { useState, useEffect } from 'react';
import { Search, Filter, TrendingUp, TrendingDown, Loader, RefreshCcw } from 'lucide-react';
import { screenStocks, getSectors } from '../api';
import { useLanguage } from '../context/LanguageContext';
import SentimentBadge from '../components/SentimentBadge';

export default function ScreenerPage() {
  const { t } = useLanguage();
  const [results, setResults] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    sector: '',
    min_pe: '',
    max_pe: '',
    min_market_cap: '',
    min_dividend: '',
    limit: 50,
  });

  useEffect(() => {
    // Auto-load top stocks on page load
    setLoading(true);
    Promise.all([
      getSectors().then((d) => setSectors(d.sectors || [])).catch(() => {}),
      screenStocks({ limit: 20 }).then((d) => setResults(d.results || [])).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.sector) params.sector = filters.sector;
      if (filters.min_pe) params.min_pe = parseFloat(filters.min_pe);
      if (filters.max_pe) params.max_pe = parseFloat(filters.max_pe);
      if (filters.min_market_cap) params.min_market_cap = parseFloat(filters.min_market_cap);
      if (filters.min_dividend) params.min_dividend = parseFloat(filters.min_dividend);
      params.limit = filters.limit;
      const data = await screenStocks(params);
      setResults(data.results || []);
    } catch (e) {
      console.error('Screener error:', e);
    }
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-gold to-accent-red flex items-center justify-center">
          <Search className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">{t('screener')}</h1>
          <p className="text-xs text-gray-500">Filter S&P 500 stocks by key metrics</p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl bg-dark-100 border border-dark-300/50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-accent-gold" />
          <h3 className="text-sm font-semibold text-gray-300">{t('filter')}</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <select
            value={filters.sector}
            onChange={(e) => setFilters({ ...filters, sector: e.target.value })}
            className="bg-dark-200 border border-dark-400/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-green/50"
          >
            <option value="">{t('allSectors')}</option>
            {sectors.map((s) => <option key={s.name} value={s.name}>{s.name} ({s.count})</option>)}
          </select>
          <input
            type="number" placeholder="Min P/E" value={filters.min_pe}
            onChange={(e) => setFilters({ ...filters, min_pe: e.target.value })}
            className="bg-dark-200 border border-dark-400/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-green/50"
          />
          <input
            type="number" placeholder="Max P/E" value={filters.max_pe}
            onChange={(e) => setFilters({ ...filters, max_pe: e.target.value })}
            className="bg-dark-200 border border-dark-400/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-green/50"
          />
          <input
            type="number" placeholder="Min Mkt Cap ($B)" value={filters.min_market_cap}
            onChange={(e) => setFilters({ ...filters, min_market_cap: e.target.value })}
            className="bg-dark-200 border border-dark-400/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-green/50"
          />
          <input
            type="number" placeholder="Min Div Yield %" value={filters.min_dividend} step="0.1"
            onChange={(e) => setFilters({ ...filters, min_dividend: e.target.value })}
            className="bg-dark-200 border border-dark-400/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-green/50"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="bg-accent-green text-dark font-semibold text-sm rounded-lg px-4 py-2 hover:bg-accent-green/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
          >
            {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {t('search')}
          </button>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="rounded-xl bg-dark-100 border border-dark-300/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-dark-300/50">
            <p className="text-xs text-gray-400">{results.length} stocks found</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-300/50">
                  {['Symbol', 'Name', 'Price', 'Change', 'P/E', 'Mkt Cap', 'Div Yield', 'Sector'].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-400 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((stock, i) => {
                  const isPositive = (stock.change_percent || 0) >= 0;
                  return (
                    <tr key={i} className="border-b border-dark-300/30 hover:bg-dark-200/50 transition-colors">
                      <td className="px-4 py-3 font-bold text-white text-sm">{stock.symbol}</td>
                      <td className="px-4 py-3 text-sm text-gray-300 max-w-[150px] truncate">{stock.name}</td>
                      <td className="px-4 py-3 text-sm font-mono text-white">${stock.current_price?.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1 text-xs font-mono font-medium ${isPositive ? 'text-accent-green' : 'text-accent-red'}`}>
                          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {isPositive ? '+' : ''}{stock.change_percent?.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-300">{stock.pe_ratio?.toFixed(1) || '—'}</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-300">{stock.market_cap ? `$${(stock.market_cap / 1e9).toFixed(1)}B` : '—'}</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-300">{stock.dividend_yield ? `${stock.dividend_yield}%` : '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{stock.sector}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && results.length === 0 && (
        <div className="rounded-xl bg-dark-100 border border-dark-300/50 p-12 text-center">
          <Search className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Use filters above and click Search to find stocks</p>
        </div>
      )}
    </div>
  );
}
