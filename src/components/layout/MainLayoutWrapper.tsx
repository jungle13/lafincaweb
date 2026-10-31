'use client';

import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function MainLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isChatBot = pathname?.startsWith('/chat-bot') || pathname?.startsWith('/chat_bot');
  const isCajeroPortal =
    pathname?.startsWith('/libros-apoyo/acceso') ||
    pathname?.startsWith('/libros-apoyo/cajero');
  const isLibrosApoyoAdmin = pathname === '/libros-apoyo';

  // Bloquear completamente el scroll del body y html cuando estamos en el chat-bot o en el portal cajero
  // para que la interfaz quede 100% encajada en pantalla sin salirse del marco
  useEffect(() => {
    if (isChatBot || isCajeroPortal) {
      window.scrollTo(0, 0);
      const originalHtmlOverflow = document.documentElement.style.overflow;
      const originalHtmlHeight = document.documentElement.style.height;
      const originalBodyOverflow = document.body.style.overflow;
      const originalBodyHeight = document.body.style.height;

      document.documentElement.style.overflow = 'hidden';
      document.documentElement.style.height = '100%';
      document.body.style.overflow = 'hidden';
      document.body.style.height = '100%';

      const preventWindowScroll = () => {
        if (window.scrollY !== 0) {
          window.scrollTo(0, 0);
        }
      };
      window.addEventListener('scroll', preventWindowScroll, { passive: true });

      return () => {
        document.documentElement.style.overflow = originalHtmlOverflow;
        document.documentElement.style.height = originalHtmlHeight;
        document.body.style.overflow = originalBodyOverflow;
        document.body.style.height = originalBodyHeight;
        window.removeEventListener('scroll', preventWindowScroll);
      };
    }
  }, [isChatBot, isCajeroPortal]);

  // 1. Portal Cajero hermético (100% fullscreen encajado al marco de pantalla sin scroll exterior)
  if (isCajeroPortal) {
    return (
      <main className="fixed inset-0 z-30 w-full h-full max-h-screen overflow-hidden bg-slate-50 p-0 m-0 flex flex-col select-none overscroll-none">
        {children}
      </main>
    );
  }

  // 2. Chat-bot (pantalla completa bajo el TopHeader)
  if (isChatBot) {
    return (
      <main className="w-full flex-1 h-[calc(100vh-56px)] h-[calc(100dvh-56px)] max-h-[calc(100dvh-56px)] overflow-hidden bg-[#0c1317] p-0 m-0 flex flex-col select-none relative overscroll-none">
        {children}
      </main>
    );
  }

  // 3. Libro de Caja Menor (Admin): pantalla completa bajo TopHeader sin padding para encaje perfecto
  if (isLibrosApoyoAdmin) {
    return (
      <main className="w-full flex-1 h-[calc(100vh-56px)] h-[calc(100dvh-56px)] max-h-[calc(100dvh-56px)] overflow-hidden bg-slate-50 p-0 m-0 flex flex-col min-w-0">
        {children}
      </main>
    );
  }

  // 4. Vistas estándar del sistema (con padding cómodo)
  return (
    <main className="flex-1 p-2.5 sm:p-4 md:p-6 pb-24 md:pb-6 w-full max-w-full overflow-x-hidden bg-white min-w-0">
      {children}
    </main>
  );
}
