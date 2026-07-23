import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in on mount and verify token
    const initAuth = async () => {
      const storedUser = localStorage.getItem('user');
      const token = localStorage.getItem('access_token');
      
      if (storedUser && token) {
        // Set user immediately from cache for fast render
        setUser(JSON.parse(storedUser));
        
        // Verify token is still valid by refreshing it in background
        try {
          const { userAPI } = await import('../services/api');
          const response = await userAPI.refreshToken();
          const { access_token, user: userData } = response.data;
          // Update token and user data
          localStorage.setItem('access_token', access_token);
          localStorage.setItem('user', JSON.stringify(userData));
          setUser(userData);
        } catch (error) {
          // Token expired or invalid - but don't log out immediately
          // The 401 interceptor will handle it if needed
          console.warn('Token refresh failed, using cached data');
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (phone, password) => {
    const response = await authAPI.login(phone, password);
    // response.data contains { access_token, token_type, user: { ... } }
    const { access_token, user: userData } = response.data;
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const { userAPI } = await import('../services/api');
      const response = await userAPI.getProfile();
      localStorage.setItem('user', JSON.stringify(response.data));
      setUser(response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to refresh user', error);
    }
  };

  const value = {
    user,
    setUser,
    login,
    logout,
    refreshUser,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};