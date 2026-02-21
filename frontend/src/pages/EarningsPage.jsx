import { useState, useEffect } from 'react';
import { Calendar, RefreshCcw, TrendingUp } from 'lucide-react';
import { getEarningsCalendar } from '../api';
import { useLanguage } from '../context/LanguageContext';

const SECTOR_COLORS = {
  'Technology': 'bg-blue-500/20 text-blue-300',
  'Information Technology': 'bg-blue-500/20 text-blue-300',
  'Health Care': 'bg-emerald-500/20 text-emerald-300',
  'Financials': 'bg-amber-500/20 text-amber-300',
  'Consumer Discretionary': 'bg-purple-500/20 text-purple-300',
  'Consumer Staples': 'bg-green-500/20 text-green-300',
  'Energy': 'bg-orange-500/20 text-orange-300',
  'Industrials': 'bg-slate-400/20 text-slate-300',
  'Communication Services': 'bg-pink-500/20 text-pink-300',
  'Utilities': 'bg-cyan-500/20 text-cyan-300',
  'Real Estate': 'bg-rose-500/20 text-rose-300',
  'Materials': 'bg-teal-500/20 text-teal-300',
};

function formatDate(dateStr) {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return dateStr; }
}

function getRelativeLabel(dateStr) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(dateStr + 'T00:00:00');
    const diff = Math.round((d - today) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    if (diff < 0) return `${Math.abs(diff)} days ago`;
    if (diff <= 7) return `In ${diff} days`;
    return null;
  } catch { return null; }
}

export default function EarningsPage() {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getEarningsCalendar()
      .then((d) => setData(d))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-3 text-gray-400">
          <RefreshCcw className="w-5 h-5 animate-spin" />
          <span>Loading earnings calendar...</span>
        </div>
      </div>
    );
  }

  const earnings = data?.earnings || [];

  // Group by earnings_date
  const grouped = {};
  earnings.forEach((e) => {
    const date = e.earnings_date || 'Unknown';
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(e);
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-blue to-accent-gold flex items-center justify-center">
          <Calendar className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">{t('earnings')}</h1>
          <p className="text-xs text-gray-500">Upcoming S&P 500 earnings releases</p>
        </div>
        <div className="ml-auto">
          <button
            onClick={async () => {
              setLoading(true);
              try {
                const d = await getEarningsCalendar(true);
                setData(d);
              } catch (e) {
                console.error(e);
              } finally {
                setLoading(false);
              }
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-dark-200 border border-dark-400/50 text-gray-300 hover:text-white hover:bg-dark-300 transition-colors"
          >
            <RefreshCcw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      {earnings.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl bg-dark-100 border border-dark-300/50 p-4">
            <p className="text-xs text-gray-500 mb-1">Total Reports</p>
            <p className="text-xl font-bold text-white">{earnings.length}</p>
          </div>
          <div className="rounded-xl bg-dark-100 border border-dark-300/50 p-4">
            <p className="text-xs text-gray-500 mb-1">Reporting Dates</p>
            <p className="text-xl font-bold text-white">{Object.keys(grouped).length}</p>
          </div>
          <div className="rounded-xl bg-dark-100 border border-dark-300/50 p-4">
            <p className="text-xs text-gray-500 mb-1">First Date</p>
            <p className="text-sm font-semibold text-accent-blue">{formatDate(earnings[0]?.earnings_date)}</p>
          </div>
          <div className="rounded-xl bg-dark-100 border border-dark-300/50 p-4">
            <p className="text-xs text-gray-500 mb-1">Last Date</p>
            <p className="text-sm font-semibold text-accent-blue">{formatDate(earnings[earnings.length - 1]?.earnings_date)}</p>
          </div>
        </div>
      )}

      {/* Earnings Timeline */}
      <div className="space-y-4">
        {Object.entries(grouped).map(([date, items]) => {
          const relLabel = getRelativeLabel(date);
          return (
            <div key={date} className="rounded-xl bg-dark-100 border border-dark-300/50 overflow-hidden">
              <div className="px-4 py-3 bg-dark-200/50 border-b border-dark-300/50 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-accent-blue" />
                <h3 className="text-sm font-semibold text-gray-200">{formatDate(date)}</h3>
                {relLabel && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-blue/20 text-accent-blue font-medium">{relLabel}</span>
                )}
                <span className="text-xs text-gray-500 ml-auto">{items.length} {items.length === 1 ? 'company' : 'companies'}</span>
              </div>
              <div className="divide-y divide-dark-300/30">
                {items.map((item, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3 hover:bg-dark-200/30 transition-colors">
                    <div className="w-12 h-12 rounded-lg bg-dark-200 border border-dark-400/50 flex items-center justify-center">
                      <span className="text-xs font-bold text-white">{item.symbol}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${SECTOR_COLORS[item.sector] || 'bg-gray-500/20 text-gray-300'}`}>
                          {item.sector}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center gap-1 text-xs text-accent-blue">
                        <TrendingUp className="w-3 h-3" />
                        <span className="font-mono">{item.symbol}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {earnings.length === 0 && (
        <div className="rounded-xl bg-dark-100 border border-dark-300/50 p-12 text-center">
          <Calendar className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No upcoming earnings data available</p>
          <p className="text-gray-500 text-xs mt-1">Earnings data may not be available outside of earnings season</p>
        </div>
      )}
    </div>
  );
}
