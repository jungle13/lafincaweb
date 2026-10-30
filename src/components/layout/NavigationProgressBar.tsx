'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function NavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);

  // Cuando la ruta cambia efectivamente, completar la barra al 100% y desvanecerla
  useEffect(() => {
    if (isNavigating) {
      setProgress(100);
      const timer = setTimeout(() => {
        setIsNavigating(false);
        setProgress(0);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [pathname, searchParams]);

  // Safety fallback: si por alguna razón Next.js no disparó cambio de URL, completar y resetear en máx 700ms
  useEffect(() => {
    if (isNavigating) {
      const safety = setTimeout(() => {
        setProgress(100);
        setTimeout(() => {
          setIsNavigating(false);
          setProgress(0);
        }, 150);
      }, 700);
      return () => clearTimeout(safety);
    }
  }, [isNavigating]);

  // Interceptar clicks en enlaces locales para iniciar la barra en 0 ms
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a');
      if (!target) return;

      const href = target.getAttribute('href');
      if (
        href &&
        href.startsWith('/') &&
        !href.startsWith('//') &&
        target.target !== '_blank' &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        !e.altKey
      ) {
        // Si es la misma ruta no activar
        const url = new URL(target.href, window.location.href);
        if (url.pathname === window.location.pathname && url.search === window.location.search) {
          return;
        }

        setIsNavigating(true);
        setProgress(35);

        setTimeout(() => setProgress(75), 100);
        setTimeout(() => setProgress(90), 250);
      }
    };

    document.addEventListener('click', handleClick, { capture: true });
    return () => document.removeEventListener('click', handleClick, { capture: true });
  }, []);

  if (!isNavigating && progress === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none h-[3px] bg-transparent">
      <div
        className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-orange-600 shadow-[0_0_10px_rgba(249,115,22,0.8)] transition-all ease-out"
        style={{
          width: `${progress}%`,
          transitionDuration: progress === 100 ? '150ms' : '200ms',
        }}
      />
    </div>
  );
}
