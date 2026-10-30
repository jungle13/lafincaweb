'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

export default function MainLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isChatBot = pathname?.startsWith('/chat-bot');

  if (isChatBot) {
    return (
      <main className="flex-1 w-full max-w-full overflow-hidden bg-[#0c1317] min-w-0 h-[calc(100dvh-53px)] md:h-[calc(100dvh-57px)] p-0 m-0">
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
