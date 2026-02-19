import { NavLink } from 'react-router-dom';
import {
  MessageSquare, Briefcase, Search, Flame, BarChart3,
  GitCompare, Eye, Calendar, ChevronLeft, ChevronRight, Activity, LogOut, User
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { path: '/', icon: MessageSquare, labelKey: 'chat' },
  { path: '/portfolio', icon: Briefcase, labelKey: 'portfolio' },
  { path: '/screener', icon: Search, labelKey: 'screener' },
  { path: '/heatmap', icon: Flame, labelKey: 'heatmap' },
  { path: '/backtest', icon: BarChart3, labelKey: 'backtest' },
  { path: '/compare', icon: GitCompare, labelKey: 'compare' },
  { path: '/watchlist', icon: Eye, labelKey: 'watchlist' },
  { path: '/earnings', icon: Calendar, labelKey: 'earnings' },
];

export default function Sidebar({ isOpen, onToggle }) {
  const { t } = useLanguage();
  const { user, logout } = useAuth();

  return (
    <aside
      className={`flex-shrink-0 flex flex-col border-r border-dark-300/50 bg-dark-50 transition-all duration-300 ${
        isOpen ? 'w-52' : 'w-16'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-3 py-4 border-b border-dark-300/50">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-green to-accent-blue flex items-center justify-center flex-shrink-0">
          <Activity className="w-5 h-5 text-white" />
        </div>
        {isOpen && (
          <span className="text-sm font-bold gradient-text whitespace-nowrap overflow-hidden">
            {t('appName')}
          </span>
        )}
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-2 space-y-0.5 px-2 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? 'bg-accent-green/10 text-accent-green border border-accent-green/20'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-dark-200 border border-transparent'
              }`
            }
          >
            <item.icon className="w-4.5 h-4.5 flex-shrink-0" />
            {isOpen && <span className="whitespace-nowrap overflow-hidden">{t(item.labelKey)}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User info + Logout */}
      {user && (
        <div className="border-t border-dark-300/50 px-2 py-2">
          <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent-green to-accent-blue flex items-center justify-center flex-shrink-0">
              <User className="w-3.5 h-3.5 text-white" />
            </div>
            {isOpen && (
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-200 truncate">{user.username}</p>
                <p className="text-[10px] text-gray-500 truncate">{user.email}</p>
              </div>
            )}
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
            {isOpen && <span>Logout</span>}
          </button>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="flex items-center justify-center py-3 border-t border-dark-300/50 text-gray-500 hover:text-gray-300 transition-colors"
      >
        {isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
    </aside>
  );
}
