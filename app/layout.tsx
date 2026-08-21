import type { Metadata, Viewport } from 'next';
import './globals.css';
import Sidebar from '@/components/layout/Sidebar';
import TopHeader from '@/components/layout/TopHeader';
import MobileBottomBar from '@/components/layout/MobileBottomBar';

export const metadata: Metadata = {
  title: 'La Finca - Dashboard & Control de Bodega',
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
    <html lang="es">
      <body className="bg-slate-950 md:bg-slate-50 text-slate-900 antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-6">
            <TopHeader />
            <main className="flex-1 p-3 md:p-6 overflow-x-hidden">
              {children}
            </main>
          </div>
        </div>
        <MobileBottomBar />
      </body>
    </html>
  );
}
