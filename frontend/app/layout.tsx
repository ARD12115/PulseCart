import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import SiteControls from './site-controls';
import ScrollProgress from './scroll-progress';

export const metadata: Metadata = {
  title: 'PulseCart — Local commerce, in real time',
  description: 'Discover products from nearby shops and browse a local catalog.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" data-motion="system">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-paper">
        <a className="skip-link" href="#main-content">Skip to content</a>
        <header className="site-header">
          <div className="site-header-inner relative mx-auto flex items-center justify-between gap-3">
            <Link href="/" className="brand-mark" aria-label="PulseCart home">
              <span className="brand-mark-icon" aria-hidden="true">PC</span>
              <span className="brand-mark-name"><strong>KINETIC //</strong><small>PULSECART / ACID NEO-BRUTALIST</small></span>
            </Link>
            <SiteControls />
          </div>
        </header>
        <ScrollProgress />
        <main id="main-content" className="min-h-[75vh]">{children}</main>
        <footer className="site-footer">
          <div className="site-footer-inner">
            <div className="site-footer-top">
              <p>Good things,<br /><em>close by.</em></p>
              <nav aria-label="Footer navigation">
                <Link href="/#shop">Shop</Link>
                <Link href="/cart">Cart</Link>
                <Link href="/demo">Concurrency lab</Link>
                <Link href="/admin">Operations</Link>
              </nav>
            </div>
            <div className="site-footer-bottom">
              <span>PulseCart · Everyday finds from shops nearby.</span>
              <span>Stock is shown by delivery city.</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
