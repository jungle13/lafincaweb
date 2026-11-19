'use client';

import React, { useEffect, useState } from 'react';
import { isTauriDesktop } from '@/lib/empresaConfig';

interface ElianaBrandLogoProps {
  /** 'auto' muestra ELIANA POS en escritorio y ELIANA en web. */
  variant?: 'auto' | 'pos' | 'web';
  theme?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function ElianaBrandLogo({
  variant = 'auto',
  theme = 'dark',
  size = 'md',
  className = '',
}: ElianaBrandLogoProps) {
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    setDesktop(isTauriDesktop());
  }, []);

  const showPos = variant === 'pos' || (variant === 'auto' && desktop);

  const dims =
    size === 'sm'
      ? { height: 28, wordSize: 20, pillW: 44, pillH: 18, pillText: 11 }
      : size === 'lg'
        ? { height: 48, wordSize: 36, pillW: 68, pillH: 28, pillText: 15 }
        : { height: 34, wordSize: 25, pillW: 52, pillH: 22, pillText: 12 };

  const textColor = theme === 'dark' ? '#FFFFFF' : '#0F172A';
  const accentColor = '#2563EB';
  const viewWidth = showPos ? (size === 'lg' ? 250 : size === 'sm' ? 145 : 182) : (size === 'lg' ? 170 : size === 'sm' ? 98 : 122);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${viewWidth} ${dims.height}`}
      height={dims.height}
      role="img"
      aria-label={showPos ? 'ELIANA POS' : 'ELIANA'}
      className={`select-none ${className}`}
    >
      <text
        x="0"
        y={dims.height * 0.76}
        fill={textColor}
        fontFamily="var(--font-inter), 'Segoe UI', system-ui, -apple-system, sans-serif"
        fontWeight="900"
        fontSize={dims.wordSize}
        letterSpacing="2.2"
      >
        ELIANA
      </text>
      {showPos && (
        <g>
          <rect
            x={viewWidth - dims.pillW}
            y={(dims.height - dims.pillH) / 2}
            width={dims.pillW}
            height={dims.pillH}
            rx="6"
            fill={accentColor}
          />
          <text
            x={viewWidth - dims.pillW / 2}
            y={dims.height / 2 + dims.pillText * 0.36}
            textAnchor="middle"
            fill="#FFFFFF"
            fontFamily="var(--font-inter), 'Segoe UI', system-ui, -apple-system, sans-serif"
            fontWeight="800"
            fontSize={dims.pillText}
            letterSpacing="1.8"
          >
            POS
          </text>
        </g>
      )}
    </svg>
  );
}
