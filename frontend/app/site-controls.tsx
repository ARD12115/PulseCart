'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChangeEvent, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

const themeStorageKey = 'pulsecart_theme';
const navigationItems = [
  { href: '/', label: 'Shop' },
  { href: '/cart', label: 'Cart' },
  { href: '/demo', label: 'Race demo' },
  { href: '/admin', label: 'Ops' },
];

function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system';
}

export default function SiteControls() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<Theme>('system');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let initialTheme: Theme = 'system';
    try {
      const savedTheme = window.localStorage.getItem(themeStorageKey);
      if (isTheme(savedTheme)) initialTheme = savedTheme;
    } catch (cause) {
      console.warn('Could not read saved theme preference; using system mode.', cause);
    }
    document.documentElement.dataset.theme = initialTheme;
    setTheme(initialTheme);
  }, []);

  function changeTheme(event: ChangeEvent<HTMLSelectElement>) {
    const nextTheme = event.currentTarget.value;
    if (!isTheme(nextTheme)) return;

    document.documentElement.dataset.theme = nextTheme;
    setTheme(nextTheme);
    try {
      window.localStorage.setItem(themeStorageKey, nextTheme);
    } catch (cause) {
      console.warn('Could not save theme preference.', cause);
    }
  }

  return (
    <div className="relative flex items-center gap-2">
      <button
        type="button"
        className="rounded-lg border border-ink/15 px-3 py-2 text-sm font-medium md:hidden"
        aria-expanded={menuOpen}
        aria-controls="primary-navigation"
        onClick={() => setMenuOpen((open) => !open)}
      >
        {menuOpen ? 'Close' : 'Menu'}
      </button>
      <nav
        id="primary-navigation"
        aria-label="Main navigation"
        className={`${menuOpen ? 'flex' : 'hidden'} absolute right-0 top-full z-20 mt-2 min-w-44 flex-col gap-1 border border-ink/10 bg-surface p-2 shadow-lg md:static md:mt-0 md:flex md:min-w-0 md:flex-row md:items-center md:gap-1 md:border-0 md:bg-transparent md:p-0 md:shadow-none`}
      >
        {navigationItems.map(({ href, label }) => {
          const active = href === '/' ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                active
                  ? 'bg-moss-solid text-white hover:bg-moss-solid hover:text-white'
                  : 'text-ink/75 hover:bg-ink/5 hover:text-moss'
              }`}
              onClick={() => setMenuOpen(false)}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <label className="flex items-center gap-2 text-sm">
        <span className="sr-only">Color theme</span>
        <select
          aria-label="Color theme"
          value={theme}
          onChange={changeTheme}
          className="rounded-lg border border-ink/15 bg-surface px-2 py-2 text-sm text-ink"
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
    </div>
  );
}
