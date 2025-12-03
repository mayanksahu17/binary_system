'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/lib/api';

interface User {
  id: string;
  userId?: string;
  name: string;
  email?: string;
  phone?: string;
  status: string;
}

interface Admin {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: number;
  isVerified: boolean;
}

interface AuthContextType {
  user: User | null;
  admin: Admin | null;
  loading: boolean;
  login: (emailOrPhone: string, password: string, isAdmin?: boolean) => Promise<void>;
  signup: (data: any, isAdmin?: boolean) => Promise<void>;
  logout: (isAdmin?: boolean) => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshAuth = async () => {
    try {
      setLoading(true);
      
      // Check if we're in an impersonation context
      const isImpersonating = typeof window !== 'undefined' && sessionStorage.getItem('isImpersonating') === 'true';
      
      // If impersonating, prioritize user auth
      if (isImpersonating) {
        try {
          const userResponse = await api.getUserProfile();
          if (userResponse.data?.user) {
            setUser(userResponse.data.user);
            setAdmin(null);
            return;
          }
        } catch (error) {
          // User not authenticated in impersonation context
        }
      } else {
        // Normal flow: try user first, then admin
        try {
          const userResponse = await api.getUserProfile();
          if (userResponse.data?.user) {
            setUser(userResponse.data.user);
            setAdmin(null);
            return;
          }
        } catch (error) {
          // User not authenticated, try admin
        }

        // Try to get admin profile
        try {
          const adminResponse = await api.getAdminProfile();
          if (adminResponse.data?.admin) {
            setAdmin(adminResponse.data.admin);
            setUser(null);
            return;
          }
        } catch (error) {
          // Admin not authenticated
        }
      }

      // No authentication found
      setUser(null);
      setAdmin(null);
    } catch (error) {
      setUser(null);
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAuth();
  }, []);

  const login = async (emailOrPhoneOrUserId: string, password: string, isAdmin = false) => {
    try {
      if (isAdmin) {
        const response = await api.adminLogin({
          email: emailOrPhoneOrUserId,
          password,
        });
        if (response.data?.admin) {
          setAdmin(response.data.admin);
          setUser(null);
        }
      } else {
        // Check if it's a userId (CROWN-XXXXXX format)
        const isUserId = /^CROWN-\d{6}$/.test(emailOrPhoneOrUserId);
        const isEmail = emailOrPhoneOrUserId.includes('@');
        
        const loginData: any = { password };
        if (isUserId) {
          loginData.userId = emailOrPhoneOrUserId;
        } else if (isEmail) {
          loginData.email = emailOrPhoneOrUserId;
        } else {
          loginData.phone = emailOrPhoneOrUserId;
        }
        
        const response = await api.userLogin(loginData);
        if (response.data?.user) {
          setUser(response.data.user);
          setAdmin(null);
        }
      }
    } catch (error: any) {
      throw new Error(error.message || 'Login failed');
    }
  };

  const signup = async (data: any, isAdmin = false) => {
    try {
      if (isAdmin) {
        const response = await api.adminSignup(data);
        if (response.data?.admin) {
          setAdmin(response.data.admin);
          setUser(null);
        }
      } else {
        const response = await api.userSignup(data);
        if (response.data?.user) {
          setUser(response.data.user);
          setAdmin(null);
        }
      }
    } catch (error: any) {
      throw new Error(error.message || 'Signup failed');
    }
  };

  const logout = async (isAdmin = false) => {
    try {
      if (isAdmin) {
        await api.adminLogout();
      } else {
        await api.userLogout();
      }
    } catch (error) {
      // Continue with cleanup even if API call fails
      console.error('Logout API call failed:', error);
    } finally {
      // Clear all application data from browser storage
      if (typeof window !== 'undefined') {
        // Clear all auth-related items from localStorage
        localStorage.removeItem('token');
        localStorage.removeItem('adminToken');
        localStorage.removeItem('impersonatedToken');
        
        // Clear all auth-related items from sessionStorage
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('isImpersonating');
        sessionStorage.removeItem('adminToken');
        sessionStorage.removeItem('impersonatedToken');
        
        // Clear any other potential auth-related items
        // Remove any keys that might be related to auth
        const localStorageKeys = Object.keys(localStorage);
        const sessionStorageKeys = Object.keys(sessionStorage);
        
        localStorageKeys.forEach(key => {
          if (key.toLowerCase().includes('token') || key.toLowerCase().includes('auth') || key.toLowerCase().includes('user') || key.toLowerCase().includes('admin')) {
            localStorage.removeItem(key);
          }
        });
        
        sessionStorageKeys.forEach(key => {
          if (key.toLowerCase().includes('token') || key.toLowerCase().includes('auth') || key.toLowerCase().includes('user') || key.toLowerCase().includes('admin')) {
            sessionStorage.removeItem(key);
          }
        });
      }
      
      // Clear state
      setUser(null);
      setAdmin(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        admin,
        loading,
        login,
        signup,
        logout,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

