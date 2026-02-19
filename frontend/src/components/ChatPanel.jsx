import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, TrendingUp, AlertCircle, RotateCcw, FileDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { streamMessage, generateReport } from '../api';
import { useLanguage } from '../context/LanguageContext';
import SentimentBadge from './SentimentBadge';

const SUGGESTED_QUESTIONS = [
  "What are the best S&P 500 stocks for long-term investment?",
  "Analyze AAPL stock — should I invest now?",
  "How is the tech sector performing in 2025?",
  "Compare NVDA vs MSFT for growth potential",
  "What's a good diversified portfolio strategy?",
  "Which S&P 500 dividend stocks are best?",
];

export default function ChatPanel({ onStockMentioned, backendReady }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const controllerRef = useRef(null);
  const { t } = useLanguage();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (messageText = null) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    const userMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setStreamingContent('');

    let accumulated = '';
    let stocksMeta = [];
    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    controllerRef.current = streamMessage(
      text,
      history,
      // onToken
      (token) => {
        accumulated += token;
        setStreamingContent(accumulated);
      },
      // onMeta — arrives before tokens, just store stock data
      (meta) => {
        stocksMeta = meta.stocks_mentioned || [];
        if (stocksMeta.length > 0) {
          onStockMentioned?.(stocksMeta[0].symbol);
        }
      },
      // onDone — streaming finished, finalize message
      () => {
        if (accumulated) {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: accumulated, stocks: stocksMeta },
          ]);
        }
        setStreamingContent('');
        setIsLoading(false);
      },
      // onError
      (err) => {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: '⚠️ Sorry, I couldn\'t process your request. Please make sure the backend server is running and try again.',
            isError: true,
          },
        ]);
        setStreamingContent('');
        setIsLoading(false);
      }
    );
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-dark-300/50 bg-dark-50/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-green/20 to-accent-blue/20 border border-accent-green/30 flex items-center justify-center">
            <Bot className="w-4 h-4 text-accent-green" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-200">Investment Advisor</h2>
            <p className="text-[10px] text-gray-500">RAG-Powered • Real-Time Data</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 px-3 py-1.5 rounded-lg hover:bg-dark-200 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      {/* Messages Area */}
      <div className={`flex-1 overflow-y-auto px-5 py-4 space-y-4 ${messages.length === 0 ? 'flex flex-col' : ''}`}>
        {/* Welcome Screen */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center text-center animate-fade-in py-12 my-auto">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent-green/20 to-accent-blue/20 border border-accent-green/20 flex items-center justify-center mb-6 flex-shrink-0">
              <Sparkles className="w-10 h-10 text-accent-green" />
            </div>
            <h2 className="text-2xl font-bold gradient-text mb-2">
              AI Stock Advisor
            </h2>
            <p className="text-gray-400 text-sm max-w-md mb-8">
              Ask me anything about S&P 500 stocks, market trends, investment strategies,
              and portfolio management. I use real-time data and AI to provide informed analysis.
            </p>

            {/* Suggested Questions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-lg w-full">
              {SUGGESTED_QUESTIONS.map((question, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(question)}
                  disabled={!backendReady}
                  className="text-left text-xs px-4 py-3 rounded-xl bg-dark-100 border border-dark-300/50 
                    hover:border-accent-green/40 hover:bg-dark-200 transition-all duration-200
                    text-gray-400 hover:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed
                    group"
                >
                  <span className="text-accent-green/70 group-hover:text-accent-green mr-1">→</span>
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message Bubbles */}
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 animate-slide-up ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-accent-green/20 to-accent-blue/20 border border-accent-green/30 flex items-center justify-center mt-1">
                <Bot className="w-4 h-4 text-accent-green" />
              </div>
            )}

            <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-first' : ''}`}>
              <div
                className={`rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-accent-blue/20 border border-accent-blue/30 text-gray-100'
                    : msg.isError
                    ? 'bg-accent-red/10 border border-accent-red/30'
                    : 'bg-dark-100 border border-dark-300/50'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <div className="markdown-content text-sm">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm">{msg.content}</p>
                )}
              </div>

              {/* Stock Cards below AI response */}
              {msg.stocks && msg.stocks.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {msg.stocks.map((stock, j) => (
                    <button
                      key={j}
                      onClick={() => onStockMentioned?.(stock.symbol)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-200 border border-dark-400/50 
                        hover:border-accent-green/40 transition-all text-xs group"
                    >
                      <span className="font-bold text-white">{stock.symbol}</span>
                      <span className="text-gray-400 hidden sm:inline">{stock.name?.split(' ')[0]}</span>
                      <span className={`font-mono font-medium flex items-center gap-0.5 ${
                        stock.change_percent >= 0 ? 'text-accent-green' : 'text-accent-red'
                      }`}>
                        {stock.change_percent >= 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <AlertCircle className="w-3 h-3" />
                        )}
                        {stock.change_percent >= 0 ? '+' : ''}{stock.change_percent?.toFixed(2)}%
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {msg.role === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-accent-blue/20 border border-accent-blue/30 flex items-center justify-center mt-1">
                <User className="w-4 h-4 text-accent-blue" />
              </div>
            )}
          </div>
        ))}

        {/* Streaming Message */}
        {streamingContent && (
          <div className="flex gap-3 animate-slide-up">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-accent-green/20 to-accent-blue/20 border border-accent-green/30 flex items-center justify-center mt-1">
              <Bot className="w-4 h-4 text-accent-green" />
            </div>
            <div className="max-w-[80%]">
              <div className="bg-dark-100 border border-dark-300/50 rounded-2xl px-4 py-3">
                <div className="markdown-content text-sm">
                  <ReactMarkdown>{streamingContent}</ReactMarkdown>
                  <span className="inline-block w-2 h-4 ml-0.5 bg-accent-green/70 animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {isLoading && !streamingContent && (
          <div className="flex gap-3 animate-slide-up">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-accent-green/20 to-accent-blue/20 border border-accent-green/30 flex items-center justify-center">
              <Bot className="w-4 h-4 text-accent-green" />
            </div>
            <div className="bg-dark-100 border border-dark-300/50 rounded-2xl px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-accent-green typing-dot"></div>
                  <div className="w-2 h-2 rounded-full bg-accent-green typing-dot"></div>
                  <div className="w-2 h-2 rounded-full bg-accent-green typing-dot"></div>
                </div>
                <span className="text-xs text-gray-500 ml-2">Analyzing market data...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 px-5 py-4 border-t border-dark-300/50 bg-dark-50/80">
        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('askPlaceholder')}
              rows={1}
              className="w-full resize-none bg-dark-200 border border-dark-400/50 rounded-xl px-4 py-3 pr-12 
                text-sm text-gray-200 placeholder-gray-500
                focus:outline-none focus:border-accent-green/50 focus:ring-1 focus:ring-accent-green/20
                transition-all"
              style={{ minHeight: '44px', maxHeight: '120px' }}
              onInput={(e) => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
            />
          </div>
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-r from-accent-green to-accent-blue 
              flex items-center justify-center
              hover:shadow-lg hover:shadow-accent-green/20 
              disabled:opacity-30 disabled:cursor-not-allowed
              transition-all duration-200 active:scale-95"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
        <p className="text-[10px] text-gray-600 mt-2 text-center">
          {t('disclaimer')}
        </p>
      </div>
    </div>
  );
}
