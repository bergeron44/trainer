import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '@/api/axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    checkUserAuth();
  }, []);

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      const token = localStorage.getItem('token');

      if (!token) {
        setIsLoadingAuth(false);
        setIsAuthenticated(false);
        return;
      }

      const { data } = await api.get('/users/me');
      setUser(data);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('User auth check failed:', error);
      localStorage.removeItem('token');
      setIsAuthenticated(false);
      setAuthError({ type: 'auth_required', message: error.response?.data?.message || 'Authentication failed' });
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const login = async (email, password) => {
    try {
      const { data } = await api.post('/users/login', { email, password });
      localStorage.setItem('token', data.token);
      setUser(data);
      setIsAuthenticated(true);
      setAuthError(null);
      return data;
    } catch (error) {
      setAuthError(error.response?.data?.message || 'Login failed');
      throw error;
    }
  };

  const register = async (userData) => {
    try {
      const { data } = await api.post('/users', userData);
      localStorage.setItem('token', data.token);
      setUser(data);
      setIsAuthenticated(true);
      setAuthError(null);
      return data;
    } catch (error) {
      // If error is 400 and user exists, we might want to tell the user
      setAuthError(error.response?.data?.message || 'Registration failed');
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setIsAuthenticated(false);
    setAuthError(null);
    window.location.href = '/onboarding';
  };

  const updateProfile = async (profileData) => {
    try {
      const { data } = await api.put('/users/profile', profileData);
      setUser(prev => ({ ...prev, profile: data.profile }));
      return data;
    } catch (error) {
      console.error('Update profile failed', error);
      throw error;
    }
  }

  const navigateToLogin = () => {
    window.location.href = '/Login';
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError,
      login,
      register,
      logout,
      updateProfile,
      checkUserAuth,
      navigateToLogin
    }}>
      {children}
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
