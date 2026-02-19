import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';

export default function MarketOverview({ data = [] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl bg-dark-100 border border-dark-300/50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-accent-blue" />
          <h3 className="text-sm font-semibold text-gray-300">Market Overview</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-dark-200 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-dark-100 border border-dark-300/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4 text-accent-blue" />
        <h3 className="text-sm font-semibold text-gray-300">Market Overview</h3>
      </div>

      <div className="space-y-2">
        {data.map((index, i) => {
          const isPositive = index.change >= 0;
          return (
            <div
              key={i}
              className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-dark-200/50 
                border border-dark-400/30 hover:border-dark-400/60 transition-colors"
            >
              <div>
                <p className="text-xs font-semibold text-gray-200">{index.name}</p>
                <p className="text-[10px] text-gray-500 font-mono">{index.symbol}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono font-semibold text-white">
                  {typeof index.price === 'number'
                    ? index.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : index.price}
                </p>
                <div className={`flex items-center justify-end gap-1 text-xs font-mono font-medium ${
                  isPositive ? 'text-accent-green' : 'text-accent-red'
                }`}>
                  {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  <span>{isPositive ? '+' : ''}{index.change?.toFixed(2)}</span>
                  <span className="text-gray-500">|</span>
                  <span>{isPositive ? '+' : ''}{index.change_percent?.toFixed(2)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
