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
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

// 3 usuarios autorizados con contraseña y nombre visible en el header
export const VALID_USERS: Record<string, { password: string; name: string }> = {
  admin: { password: '123', name: 'Admin' },
  eliana: { password: '123', name: 'Eliana' },
  arturo: { password: '123', name: 'Arturo' },
};

const STORAGE_KEY = 'la_finca_auth_session';

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: () => false,
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const userKey = parsed?.username?.toLowerCase()?.trim();
        if (userKey && VALID_USERS[userKey]) {
          setUser({
            username: userKey,
            name: VALID_USERS[userKey].name,
          });
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = (username: string, password: string): boolean => {
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    const record = VALID_USERS[cleanUser];
    if (record && record.password === cleanPass) {
      const authUser: AuthUser = {
        username: cleanUser,
        name: record.name,
      };
      setUser(authUser);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
      } catch (e) {
        console.error('Error al guardar sesión:', e);
      }
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
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
