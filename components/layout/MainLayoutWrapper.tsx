'use client';

import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function MainLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isChatBot = pathname?.startsWith('/chat-bot') || pathname?.startsWith('/chat_bot');
  const isCajeroPortal =
    pathname?.startsWith('/libros-apoyo/acceso') ||
    pathname?.startsWith('/libros-apoyo/cajero');

  // Bloquear completamente el scroll del body y html cuando estamos en el chat-bot
  // para que el scroll del chat sea 100% independiente y nunca mueva la pantalla ni el panel izquierdo
  useEffect(() => {
    if (isChatBot) {
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
  }, [isChatBot]);

  if (isCajeroPortal) {
    return (
      <main className="w-full min-h-screen bg-slate-900 p-0 m-0 overflow-x-hidden min-w-0">
        {children}
      </main>
    );
  }

  if (isChatBot) {
    return (
      <main className="w-full flex-1 h-[calc(100vh-56px)] h-[calc(100dvh-56px)] max-h-[calc(100dvh-56px)] overflow-hidden bg-[#0c1317] p-0 m-0 flex flex-col select-none relative overscroll-none">
        {children}
      </main>
    );
  }

  return (
    <main className="flex-1 p-2.5 sm:p-4 md:p-6 pb-24 md:pb-6 w-full max-w-full overflow-x-hidden bg-white min-w-0">
      {children}
    </main>
  );
}
