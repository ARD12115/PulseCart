import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import SiteControls from './site-controls';

export const metadata: Metadata = {
  title: 'PulseCart — Good things, close to home',
  description: 'Discover useful finds from nearby shops, in a neon-lit local marketplace.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" data-motion="system">
      <body className="min-h-screen bg-paper">
        <a className="skip-link" href="#main-content">Skip to content</a>
        <header className="site-header">
          <div className="site-header-inner relative mx-auto flex items-center justify-between gap-3">
            <Link href="/" className="brand-mark" aria-label="PulseCart home">
              <span>pulse</span>cart
            </Link>
            <SiteControls />
          </div>
        </header>
        <main id="main-content" className="min-h-[75vh]">{children}</main>
        <footer className="site-footer">
          <div className="site-footer-inner">
            <div className="site-footer-top">
              <p>Good things,<br /><em>close by.</em></p>
              <nav aria-label="Footer navigation">
                <Link href="/#shop">Shop</Link>
                <Link href="/cart">Cart</Link>
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
