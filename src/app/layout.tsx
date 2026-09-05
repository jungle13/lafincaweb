import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/layout/Sidebar';
import TopHeader from '@/components/layout/TopHeader';
import MobileBottomBar from '@/components/layout/MobileBottomBar';
import { SidebarProvider } from '@/context/SidebarContext';
import { PeriodoProvider } from '@/context/PeriodoContext';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'La Finca - Dashboard Administrativo & Control de Bodega',
  description: 'Sistema administrativo y operativo de carnes y movimientos en tiempo real',
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
        <SidebarProvider>
          <PeriodoProvider>
            <div className="flex min-h-screen">
              <Sidebar />
              <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
                <TopHeader />
                <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6 overflow-x-hidden bg-white">
                  {children}
                </main>
              </div>
            </div>
            <MobileBottomBar />
          </PeriodoProvider>
        </SidebarProvider>
      </body>
    </html>
  );
}
