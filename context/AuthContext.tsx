'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { SystemRole } from '@/lib/authServer';

export interface AuthUser {
  username: string;
  name: string;
  role: SystemRole;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const STORAGE_KEY = 'eliana_auth_session';

function resolveClientRole(rawRole: unknown, username?: string): SystemRole {
  const cleanUser = String(username || '').trim().toLowerCase();
  const cleanRole = String(rawRole || '').trim().toUpperCase();
  if (cleanUser === 'admin' || cleanRole === 'ADMIN') return 'ADMIN';
  if (cleanRole === 'GESTOR' || cleanRole === 'SUPERVISOR') return 'GESTOR';
  if (cleanRole === 'OPERATIVO_POS' || cleanRole === 'CAJERO' || cleanRole === 'MESERO') return 'OPERATIVO_POS';
  if (cleanUser === 'eliana' || cleanUser === 'arturo') return 'GESTOR';
  return 'OPERATIVO_POS';
}

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
              role: resolveClientRole(data.user.role, data.user.username),
            };
            setUser(authUser);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
            return;
          }
        }
        if (active) {
          setUser(null);
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem('la_finca_auth_session');
        }
      } catch {
        try {
          const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('la_finca_auth_session');
          if (active && stored) {
            const parsed = JSON.parse(stored);
            if (parsed?.username && parsed?.name) {
              setUser({
                username: parsed.username,
                name: parsed.name,
                role: resolveClientRole(parsed.role, parsed.username),
              });
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
          role: resolveClientRole(data.user.role, data.user.username),
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
      localStorage.removeItem('la_finca_auth_session');
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
  return useContext(AuthContext);
}
