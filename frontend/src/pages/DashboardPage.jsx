import { useState, useEffect } from 'react';
import ChatPanel from '../components/ChatPanel';
import MarketOverview from '../components/MarketOverview';
import StockChart from '../components/StockChart';
import NewsFeed from '../components/NewsFeed';
import { getMarketNews } from '../api';

export default function DashboardPage({ marketData, backendReady }) {
  const [selectedStock, setSelectedStock] = useState(null);
  const [news, setNews] = useState([]);

  useEffect(() => {
    getMarketNews(8)
      .then((n) => setNews(n.articles || []))
      .catch((e) => console.error('News error:', e));
  }, []);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Chat Panel */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-dark-300/50">
        <ChatPanel
          onStockMentioned={(symbol) => setSelectedStock(symbol)}
          backendReady={backendReady}
        />
      </div>

      {/* Right Sidebar */}
      <div className="w-[400px] flex-shrink-0 flex flex-col overflow-y-auto bg-dark-50/50 hidden xl:flex">
        <div className="p-4 space-y-4">
          <MarketOverview data={marketData} />
          {selectedStock && (
            <StockChart ticker={selectedStock} onClose={() => setSelectedStock(null)} />
          )}
          <NewsFeed articles={news} />
        </div>
      </div>
    </div>
  );
}
