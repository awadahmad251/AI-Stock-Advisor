import { TrendingUp, TrendingDown, Activity, Moon, Sun, Globe, Menu } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useState, useRef, useEffect } from 'react';

export default function Header({ marketData = [], onMenuToggle }) {
  const { theme, toggleTheme } = useTheme();
  const { lang, setLang, t, languages } = useLanguage();
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef(null);

  useEffect(() => {
    const close = (e) => { if (langRef.current && !langRef.current.contains(e.target)) setLangOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <header className="flex-shrink-0">
      <div className="flex items-center justify-between px-4 py-2.5 bg-dark-50 border-b border-dark-300/50">
        {/* Left — Menu + Status */}
        <div className="flex items-center gap-3">
          <button onClick={onMenuToggle} className="lg:hidden text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-dark-200 transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse-slow"></div>
            <span>{t('liveData')}</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-dark-200 border border-dark-400/50">
            <span className="text-gray-400">{t('model')}:</span>
            <span className="text-accent-blue font-medium">LLaMA 3.3 70B</span>
          </div>
        </div>

        {/* Right — Theme + Language */}
        <div className="flex items-center gap-2">
          {/* Language Dropdown */}
          <div className="relative" ref={langRef}>
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-dark-200 border border-dark-400/50 transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{languages[lang]}</span>
            </button>
            {langOpen && (
              <div className="absolute right-0 top-full mt-1 bg-dark-100 border border-dark-300 rounded-lg shadow-xl z-50 overflow-hidden min-w-[120px]">
                {Object.entries(languages).map(([code, name]) => (
                  <button
                    key={code}
                    onClick={() => { setLang(code); setLangOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-dark-200 transition-colors ${
                      lang === code ? 'text-accent-green bg-dark-200' : 'text-gray-300'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-dark-200 border border-dark-400/50 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Ticker Bar */}
      {marketData.length > 0 && (
        <div className="bg-dark-100 border-b border-dark-300/30 py-1.5 ticker-wrap">
          <div className="ticker-content">
            {[...marketData, ...marketData].map((item, i) => (
              <span key={i} className="inline-flex items-center gap-2 mx-6 text-xs">
                <span className="text-gray-400 font-medium">{item.name}</span>
                <span className="text-white font-mono font-medium">
                  {typeof item.price === 'number' ? item.price.toLocaleString('en-US', { minimumFractionDigits: 2 }) : item.price}
                </span>
                <span className={`flex items-center gap-0.5 font-mono font-medium ${item.change >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                  {item.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {item.change >= 0 ? '+' : ''}{item.change_percent?.toFixed(2)}%
                </span>
                <span className="text-dark-500 mx-2">•</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
