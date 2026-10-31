'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import LoginForm from './LoginForm';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuth();

  // El Portal Cajero (/libros-apoyo/acceso y /libros-apoyo/cajero) es una interfaz hermética
  // con autenticación propia de PIN para cajeros, no debe requerir login administrativo.
  const isCajeroRoute =
    pathname?.startsWith('/libros-apoyo/acceso') ||
    pathname?.startsWith('/libros-apoyo/cajero');

  if (isCajeroRoute) {
    return <>{children}</>;
  }

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
