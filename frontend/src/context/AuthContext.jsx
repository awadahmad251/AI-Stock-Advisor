import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loginUser, registerUser, getMe } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('investiq_token'));
  const [loading, setLoading] = useState(true);

  // On mount: if we have a stored token, validate it (with retry for cold starts)
  useEffect(() => {
    if (token) {
      const validateToken = async (retries = 3) => {
        for (let i = 0; i < retries; i++) {
          try {
            const u = await getMe(token);
            setUser(u);
            return;
          } catch (err) {
            const status = err.response?.status;
            // 401/403 = token truly invalid → clear it
            if (status === 401 || status === 403) {
              localStorage.removeItem('investiq_token');
              setToken(null);
              return;
            }
            // Network error / backend cold start → retry
            if (i < retries - 1) {
              await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
            }
          }
        }
        // All retries failed but token might still be valid → keep it
        // User will see data once backend wakes up
      };
      validateToken().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await loginUser(email, password);
    localStorage.setItem('investiq_token', data.access_token);
    setToken(data.access_token);
    setUser(data.user);
    return data;
  }, []);

  const register = useCallback(async (email, username, password, fullName) => {
    const data = await registerUser(email, username, password, fullName);
    localStorage.setItem('investiq_token', data.access_token);
    setToken(data.access_token);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('investiq_token');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
