import { Newspaper, ExternalLink, Clock } from 'lucide-react';

export default function NewsFeed({ articles = [] }) {
  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      const diff = Date.now() - new Date(dateStr).getTime();
      const hours = Math.floor(diff / 3600000);
      if (hours < 1) return 'Just now';
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    } catch {
      return '';
    }
  };

  if (articles.length === 0) {
    return (
      <div className="rounded-xl bg-dark-100 border border-dark-300/50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Newspaper className="w-4 h-4 text-accent-gold" />
          <h3 className="text-sm font-semibold text-gray-300">Latest News</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-dark-200 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-dark-100 border border-dark-300/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Newspaper className="w-4 h-4 text-accent-gold" />
        <h3 className="text-sm font-semibold text-gray-300">Latest Market News</h3>
      </div>

      <div className="space-y-2.5">
        {articles.slice(0, 6).map((article, i) => (
          <a
            key={i}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block group"
          >
            <div className="flex gap-3 px-3 py-2.5 rounded-lg bg-dark-200/40 border border-dark-400/20 
              hover:border-accent-gold/30 hover:bg-dark-200 transition-all duration-200">
              {/* Thumbnail */}
              {article.image && (
                <div className="flex-shrink-0 w-16 h-12 rounded-md overflow-hidden bg-dark-300">
                  <img
                    src={article.image}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-medium text-gray-300 group-hover:text-white line-clamp-2 leading-snug transition-colors">
                  {article.title}
                </h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-accent-blue font-medium">{article.source}</span>
                  <span className="text-dark-500">•</span>
                  <span className="flex items-center gap-0.5 text-[10px] text-gray-500">
                    <Clock className="w-2.5 h-2.5" />
                    {formatTime(article.published_at)}
                  </span>
                  <ExternalLink className="w-2.5 h-2.5 text-gray-600 group-hover:text-accent-gold ml-auto transition-colors" />
                </div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
