'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface AuthUser {
  username: string;
  name: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const STORAGE_KEY = 'la_finca_auth_session';

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => false,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (active && data?.authenticated && data?.user) {
            const authUser: AuthUser = {
              username: data.user.username,
              name: data.user.name,
            };
            setUser(authUser);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
            return;
          }
        }
        if (active) {
          setUser(null);
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        // Fallback temporal en caso de error de red transitorio
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (active && stored) {
            const parsed = JSON.parse(stored);
            if (parsed?.username && parsed?.name) {
              setUser({ username: parsed.username, name: parsed.name });
            }
          }
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };

    checkSession();
    return () => {
      active = false;
    };
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) return false;
      const data = await res.json();
      if (data?.success && data?.user) {
        const authUser: AuthUser = {
          username: data.user.username,
          name: data.user.name,
        };
        setUser(authUser);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error al iniciar sesión:', e);
      return false;
    }
  };

  const logout = async () => {
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
      document.cookie = 'la_finca_session=; path=/; max-age=0; SameSite=Lax';
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Error al remover sesión:', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
}
