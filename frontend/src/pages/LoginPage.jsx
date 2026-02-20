import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Activity, Mail, Lock, User, ArrowRight, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        if (!username.trim()) { setError('Username is required'); setLoading(false); return; }
        if (password.length < 6) { setError('Password must be at least 6 characters'); setLoading(false); return; }
        await register(email, username, password, fullName);
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Something went wrong';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-green to-accent-blue flex items-center justify-center mb-4 shadow-lg shadow-accent-green/20">
            <Activity className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold gradient-text">InvestIQ</h1>
          <p className="text-gray-400 mt-1 text-sm">AI-Powered Stock Advisor</p>
        </div>

        {/* Card */}
        <div className="bg-dark-50 border border-dark-300/50 rounded-2xl p-8 shadow-xl">
          {/* Tab Switch */}
          <div className="flex bg-dark-200 rounded-xl p-1 mb-6">
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-accent-green/20 text-accent-green shadow-sm'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                mode === 'register'
                  ? 'bg-accent-blue/20 text-accent-blue shadow-sm'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Register
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-accent-red/10 border border-accent-red/30 flex items-center gap-2 text-accent-red text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="off"
                className="w-full pl-10 pr-4 py-3 bg-dark-200 border border-dark-300/50 rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-accent-green/50 focus:ring-1 focus:ring-accent-green/30 transition-all"
              />
            </div>

            {mode === 'register' && (
              <>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoComplete="off"
                    className="w-full pl-10 pr-4 py-3 bg-dark-200 border border-dark-300/50 rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/30 transition-all"
                  />
                </div>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Full Name (optional)"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoComplete="off"
                    className="w-full pl-10 pr-4 py-3 bg-dark-200 border border-dark-300/50 rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/30 transition-all"
                  />
                </div>
              </>
            )}

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="off"
                className="w-full pl-10 pr-4 py-3 bg-dark-200 border border-dark-300/50 rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-accent-green/50 focus:ring-1 focus:ring-accent-green/30 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                mode === 'login'
                  ? 'bg-gradient-to-r from-accent-green to-emerald-600 hover:from-accent-green/90 hover:to-emerald-600/90 text-white shadow-lg shadow-accent-green/20'
                  : 'bg-gradient-to-r from-accent-blue to-blue-600 hover:from-accent-blue/90 hover:to-blue-600/90 text-white shadow-lg shadow-accent-blue/20'
              } ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer text */}
          <p className="text-center text-xs text-gray-500 mt-6">
            {mode === 'login' ? (
              <>Don't have an account? <button onClick={() => setMode('register')} className="text-accent-blue hover:underline">Register</button></>
            ) : (
              <>Already have an account? <button onClick={() => setMode('login')} className="text-accent-green hover:underline">Sign In</button></>
            )}
          </p>
        </div>

        {/* Disclaimer */}
        <p className="text-center text-xs text-gray-600 mt-4">
          Educational tool only. Not financial advice.
        </p>
      </div>
    </div>
  );
}
