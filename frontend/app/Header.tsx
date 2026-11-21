'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SiteControls from './site-controls';

export default function Header() {
  const pathname = usePathname();
  if (pathname === '/kinetic') return null;

  return (
    <header className="site-header">
      <div className="site-header-inner relative mx-auto flex items-center justify-between gap-3">
        <Link href="/" className="brand-mark" aria-label="PulseCart home">
          <span className="brand-mark-icon" aria-hidden="true">PC</span>
          <span className="brand-mark-name"><strong>KINETIC //</strong><small>PULSECART / ACID NEO-BRUTALIST</small></span>
        </Link>
        <SiteControls />
      </div>
    </header>
  );
}
