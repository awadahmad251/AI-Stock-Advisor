import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const STYLES = {
  bullish: { bg: 'bg-accent-green/10', border: 'border-accent-green/30', text: 'text-accent-green', icon: TrendingUp },
  bearish: { bg: 'bg-accent-red/10', border: 'border-accent-red/30', text: 'text-accent-red', icon: TrendingDown },
  neutral: { bg: 'bg-gray-500/10', border: 'border-gray-500/30', text: 'text-gray-400', icon: Minus },
};

export default function SentimentBadge({ sentiment = 'neutral', score, size = 'sm' }) {
  const s = STYLES[sentiment?.toLowerCase()] || STYLES.neutral;
  const Icon = s.icon;
  const isLg = size === 'lg';

  return (
    <span
      className={`inline-flex items-center gap-1 ${isLg ? 'px-3 py-1.5 text-sm' : 'px-2 py-0.5 text-xs'}
        rounded-full font-medium border ${s.bg} ${s.border} ${s.text}`}
    >
      <Icon className={isLg ? 'w-4 h-4' : 'w-3 h-3'} />
      <span className="capitalize">{sentiment}</span>
      {score !== undefined && score !== null && (
        <span className="opacity-70 ml-0.5">{typeof score === 'number' ? `${Math.round(score * 100)}%` : score}</span>
      )}
    </span>
  );
}
