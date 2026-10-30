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
      <main className="fixed inset-0 top-[53px] bottom-0 left-0 right-0 z-20 w-full overflow-hidden bg-[#0c1317] p-0 m-0 flex flex-col select-none">
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
