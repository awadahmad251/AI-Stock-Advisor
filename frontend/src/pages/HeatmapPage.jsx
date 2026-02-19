import { useState, useEffect } from 'react';
import { Flame, RefreshCcw } from 'lucide-react';
import { getSectorHeatmap } from '../api';
import { useLanguage } from '../context/LanguageContext';

function getColor(value) {
  if (value >= 3) return 'bg-green-600';
  if (value >= 1.5) return 'bg-green-500/80';
  if (value >= 0.5) return 'bg-green-500/50';
  if (value >= 0) return 'bg-green-500/20';
  if (value >= -0.5) return 'bg-red-500/20';
  if (value >= -1.5) return 'bg-red-500/50';
  if (value >= -3) return 'bg-red-500/80';
  return 'bg-red-600';
}

function getTextColor(value) {
  if (Math.abs(value) >= 1.5) return 'text-white';
  return value >= 0 ? 'text-green-300' : 'text-red-300';
}

export default function HeatmapPage() {
  const { t } = useLanguage();
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = () => {
    setLoading(true);
    setError(null);
    getSectorHeatmap()
      .then((d) => setSectors(d?.sectors || []))
      .catch((e) => { console.error(e); setError('Failed to load heatmap data'); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <RefreshCcw className="w-6 h-6 animate-spin" />
          <span>Building sector heatmap...</span>
          <span className="text-xs text-gray-500">Fetching data for all S&P 500 sectors</span>
        </div>
      </div>
    );
  }

  // Find min/max for relative sizing
  const maxStocks = Math.max(...sectors.map((s) => s.num_stocks || 1), 1);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-red to-accent-gold flex items-center justify-center">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{t('heatmap')}</h1>
            <p className="text-xs text-gray-500">S&P 500 sector performance overview</p>
          </div>
        </div>
        <button onClick={loadData} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white bg-dark-200 border border-dark-400/50 hover:bg-dark-300 transition-colors">
          <RefreshCcw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-400">Performance:</span>
        {[
          { label: '>3%', bg: 'bg-green-600' },
          { label: '1.5-3%', bg: 'bg-green-500/80' },
          { label: '0-1.5%', bg: 'bg-green-500/50' },
          { label: '0 to -1.5%', bg: 'bg-red-500/50' },
          { label: '<-1.5%', bg: 'bg-red-500/80' },
        ].map((l) => (
          <span key={l.label} className="flex items-center gap-1 text-xs text-gray-400">
            <span className={`w-3 h-3 rounded ${l.bg}`}></span>
            {l.label}
          </span>
        ))}
      </div>

      {error && (
        <div className="rounded-xl bg-accent-red/10 border border-accent-red/30 p-4 text-center">
          <p className="text-accent-red text-sm">{error}</p>
          <button onClick={loadData} className="mt-2 text-xs text-accent-red underline">Retry</button>
        </div>
      )}

      {/* Heatmap Treemap-style Grid */}
      {sectors.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {sectors.map((s) => {
            const change = s.change_percent || 0;
            const sizeRatio = (s.num_stocks || 1) / maxStocks;
            const minH = 120;
            const maxH = 200;
            const height = Math.round(minH + sizeRatio * (maxH - minH));
            return (
              <div
                key={s.sector}
                style={{ minHeight: height }}
                className={`rounded-xl ${getColor(change)} p-4 flex flex-col justify-between transition-all hover:scale-[1.02] cursor-default relative overflow-hidden`}
              >
                {/* Large background percentage */}
                <div className="absolute -right-2 -bottom-3 text-[4rem] font-black opacity-10 leading-none select-none">
                  {change >= 0 ? '+' : ''}{change.toFixed(0)}%
                </div>

                <div>
                  <h3 className={`text-sm font-bold ${getTextColor(change)} leading-tight mb-1`}>{s.sector}</h3>
                  <p className="text-[11px] text-white/40">{s.num_stocks} stocks in index</p>
                </div>

                <div>
                  <p className={`text-2xl font-bold font-mono ${getTextColor(change)} mb-2`}>
                    {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(s.sample_stocks || []).map((ticker) => (
                      <span key={ticker} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/20 text-white/70">
                        {ticker}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary bar */}
      {sectors.length > 0 && (
        <div className="rounded-xl bg-dark-100 border border-dark-300/50 p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Sector Performance Summary</h3>
          <div className="space-y-2">
            {sectors.map((s) => {
              const change = s.change_percent || 0;
              const barWidth = Math.min(Math.abs(change) * 15, 100);
              return (
                <div key={s.sector} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-40 truncate">{s.sector}</span>
                  <div className="flex-1 h-5 bg-dark-200 rounded-full overflow-hidden relative">
                    {change >= 0 ? (
                      <div className="absolute left-1/2 h-full bg-green-500/60 rounded-r-full" style={{ width: `${barWidth / 2}%` }} />
                    ) : (
                      <div className="absolute h-full bg-red-500/60 rounded-l-full" style={{ width: `${barWidth / 2}%`, right: '50%' }} />
                    )}
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-dark-400" />
                  </div>
                  <span className={`text-xs font-mono font-semibold w-16 text-right ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!error && sectors.length === 0 && (
        <div className="rounded-xl bg-dark-100 border border-dark-300/50 p-12 text-center">
          <Flame className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No heatmap data available</p>
        </div>
      )}
    </div>
  );
}
