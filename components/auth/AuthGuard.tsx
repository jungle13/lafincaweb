'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import LoginForm from './LoginForm';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
        <div className="text-sm font-medium text-slate-400">Cargando...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return <>{children}</>;
}
