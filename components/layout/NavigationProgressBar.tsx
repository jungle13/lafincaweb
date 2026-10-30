'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function NavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  const timersRef = useRef<NodeJS.Timeout[]>([]);

  const clearAllTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  };

  const startProgress = () => {
    clearAllTimers();
    setVisible(true);
    setProgress(30);

    const t1 = setTimeout(() => setProgress(65), 150);
    const t2 = setTimeout(() => setProgress(85), 350);
    // Hard safety: si en 1200ms no ha cambiado de ruta o finalizado, auto-completar y desvanecer
    const t3 = setTimeout(() => finishProgress(), 1200);

    timersRef.current.push(t1, t2, t3);
  };

  const finishProgress = () => {
    clearAllTimers();
    setProgress(100);
    const tFinish = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 200);
    timersRef.current.push(tFinish);
  };

  // Cuando la ruta o los searchParams cambian efectivamente, completar de inmediato
  useEffect(() => {
    if (visible) {
      finishProgress();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  // Escuchar clicks en enlaces internos
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
        try {
          const url = new URL(target.href, window.location.href);
          if (url.pathname === window.location.pathname && url.search === window.location.search) {
            return;
          }
          startProgress();
        } catch (err) {}
      }
    };

    document.addEventListener('click', handleClick, { capture: true });
    return () => {
      document.removeEventListener('click', handleClick, { capture: true });
      clearAllTimers();
    };
  }, []);

  if (!visible && progress === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none h-[3px] bg-transparent">
      <div
        className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-orange-600 shadow-[0_0_10px_rgba(249,115,22,0.8)] transition-all ease-out"
        style={{
          width: `${progress}%`,
          opacity: visible ? 1 : 0,
          transitionDuration: progress === 100 ? '150ms' : '250ms',
        }}
      />
    </div>
  );
}
