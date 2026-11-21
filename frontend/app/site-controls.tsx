'use client';

import Link from 'next/link';
import { ChangeEvent, useEffect, useState } from 'react';

type CartLine = { qty?: number };
type Theme = 'system' | 'dark' | 'light';
type MotionPreference = 'system' | 'reduce' | 'full';

const themeKey = 'pulsecart_theme';
const motionKey = 'pulsecart_motion';

function readCartCount() {
  try {
    const cart = JSON.parse(window.localStorage.getItem('pulsecart_cart') || '[]') as CartLine[];
    return cart.reduce((total, item) => total + (Number(item.qty) || 0), 0);
  } catch {
    return 0;
  }
}

export default function SiteControls() {
  const [cartCount, setCartCount] = useState(0);
  const [theme, setTheme] = useState<Theme>('dark');
  const [motion, setMotion] = useState<MotionPreference>('system');

  useEffect(() => {
    const updateCount = () => setCartCount(readCartCount());
    updateCount();
    window.addEventListener('storage', updateCount);
    window.addEventListener('pulsecart:cart-updated', updateCount);

    try {
      const savedTheme = window.localStorage.getItem(themeKey);
      const savedMotion = window.localStorage.getItem(motionKey);
      if (savedTheme === 'system' || savedTheme === 'dark' || savedTheme === 'light') {
        setTheme(savedTheme);
        document.documentElement.dataset.theme = savedTheme;
      }
      if (savedMotion === 'system' || savedMotion === 'reduce' || savedMotion === 'full') {
        setMotion(savedMotion);
        document.documentElement.dataset.motion = savedMotion;
      }
    } catch {
      // Keep system preferences when browser storage is unavailable.
    }

    return () => {
      window.removeEventListener('storage', updateCount);
      window.removeEventListener('pulsecart:cart-updated', updateCount);
    };
  }, []);

  function changeTheme(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.currentTarget.value as Theme;
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try { window.localStorage.setItem(themeKey, next); } catch { /* Applies until this tab closes. */ }
  }

  function changeMotion(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.currentTarget.value as MotionPreference;
    setMotion(next);
    document.documentElement.dataset.motion = next;
    try { window.localStorage.setItem(motionKey, next); } catch { /* Applies until this tab closes. */ }
  }

  return (
    <div className="header-controls">
      <nav className="consumer-nav" aria-label="Main navigation">
        <Link href="/#hero">3D dive</Link>
        <Link href="/#architecture">Architecture</Link>
        <Link href="/#search-console">OpenSearch</Link>
        <Link href="/#shop">Hardware</Link>
        <Link href="/cart" className="cart-nav-link" aria-label={`Cart, ${cartCount} items`}>
          Cart <span aria-hidden="true">{cartCount}</span>
        </Link>
      </nav>
      <details className="display-settings">
        <summary><span className="settings-label">Display</span></summary>
        <div className="settings-panel">
          <label htmlFor="color-theme">Color theme</label>
          <select id="color-theme" value={theme} onChange={changeTheme}>
            <option value="system">System</option>
            <option value="dark">Acid dark</option>
            <option value="light">Light</option>
          </select>
          <label htmlFor="motion-preference">Animation</label>
          <select id="motion-preference" value={motion} onChange={changeMotion}>
            <option value="system">System preference</option>
            <option value="reduce">Reduced motion</option>
            <option value="full">Full motion</option>
          </select>
        </div>
      </details>
    </div>
  );
}
