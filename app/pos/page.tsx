'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import PosAppShell from '@/components/pos/PosAppShell';

export default function ElianaPosWebPage() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <PosAppShell
      user={user}
      onNavigateDashboard={() => router.push('/')}
      isStandaloneDesktop={false}
    />
  );
}
