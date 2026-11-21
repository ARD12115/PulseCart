'use client';

import { useEffect, useRef, useState } from 'react';

interface UseKineticInteractionReturn {
  scrollProgress: number;
  targetMouseX: number;
  targetMouseY: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function useKineticInteraction(): UseKineticInteractionReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [targetMouseX, setTargetMouseX] = useState(0);
  const [targetMouseY, setTargetMouseY] = useState(0);

  useEffect(() => {
    function updateScroll() {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
      const maxScroll = (document.documentElement.scrollHeight - window.innerHeight) || 1;
      setScrollProgress(Math.min(Math.max(scrollTop / maxScroll, 0), 1));
    }
    window.addEventListener('scroll', updateScroll, { passive: true });
    updateScroll();

    function onPointerMove(e: React.PointerEvent) {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setTargetMouseX(((x / rect.width) * 2 - 1) * 0.7);
      setTargetMouseY((-(y / rect.height) * 2 + 1) * 0.5);
    }

    window.addEventListener('pointermove', onPointerMove as any);

    function onResize() {
      updateScroll();
    }
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('scroll', updateScroll);
      window.removeEventListener('pointermove', onPointerMove as any);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return {
    scrollProgress,
    targetMouseX,
    targetMouseY,
    containerRef,
  };
}