import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const AuthContext = createContext({
  user: null,
  checkingAuth: true,
  refreshAuth: () => Promise.resolve(),
  setUser: () => {},
  logout: () => Promise.resolve()
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const refreshAuth = async () => {
    setCheckingAuth(true);
    try {
      const res = await fetch('/api/profile', { credentials: 'include' });
      if (res.ok) {
        const profile = await res.json();
        setUser(profile);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('auth refresh failed', error);
      setUser(null);
    } finally {
      setCheckingAuth(false);
    }
  };

  useEffect(() => {
    refreshAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'GET',
        credentials: 'include'
      });
    } catch (error) {
      console.error('logout failed', error);
    } finally {
      setUser(null);
    }
  };

  const value = useMemo(
    () => ({
      user,
      checkingAuth,
      refreshAuth,
      setUser,
      logout
    }),
    [user, checkingAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
