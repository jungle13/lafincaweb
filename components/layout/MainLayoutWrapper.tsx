'use client';

import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function MainLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isChatBot = pathname?.startsWith('/chat-bot');

  // Bloquear completamente el scroll del body y html cuando estamos en el chat-bot
  // para que el scroll del chat sea 100% independiente y nunca mueva la pantalla ni el panel izquierdo
  useEffect(() => {
    if (isChatBot) {
      window.scrollTo(0, 0);
      const prevBodyOverflow = document.body.style.overflow;
      const prevHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = prevBodyOverflow;
        document.documentElement.style.overflow = prevHtmlOverflow;
      };
    }
  }, [isChatBot]);

  if (isChatBot) {
    return (
      <main className="w-full flex-1 h-[calc(100dvh-53px)] max-h-[calc(100dvh-53px)] overflow-hidden bg-[#0c1317] p-0 m-0 flex flex-col select-none relative">
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
