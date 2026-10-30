import { Suspense } from 'react';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/layout/Sidebar';
import TopHeader from '@/components/layout/TopHeader';
import MobileBottomBar from '@/components/layout/MobileBottomBar';
import NavigationProgressBar from '@/components/layout/NavigationProgressBar';
import { SidebarProvider } from '@/context/SidebarContext';
import { PeriodoProvider } from '@/context/PeriodoContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { AuthProvider } from '@/context/AuthContext';
import AuthGuard from '@/components/auth/AuthGuard';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'La Finca - Dashboard Administrativo & Control de Bodega',
  description: 'Sistema administrativo y operativo de carnes y movimientos en tiempo real',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="bg-white text-slate-800 font-sans antialiased min-h-screen">
        <Suspense fallback={null}>
          <NavigationProgressBar />
        </Suspense>
        <AuthProvider>
          <AuthGuard>
            <SidebarProvider>
              <PeriodoProvider>
                <NotificationProvider>
                  <div className="flex min-h-screen">
                    <Sidebar />
                    <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
                      <TopHeader />
                      <main className="flex-1 p-2.5 sm:p-4 md:p-6 pb-24 md:pb-6 w-full max-w-full overflow-x-hidden bg-white min-w-0">
                        {children}
                      </main>
                    </div>
                  </div>
                  <MobileBottomBar />
                </NotificationProvider>
              </PeriodoProvider>
            </SidebarProvider>
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
