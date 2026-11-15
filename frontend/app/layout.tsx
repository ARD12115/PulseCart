import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import SiteControls from './site-controls';

export const metadata: Metadata = {
  title: 'PulseCart — Good things, close to home',
  description: 'Thoughtful everyday finds from the neighborhood shops around you.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="system">
      <body className="min-h-screen bg-paper">
        <header className="site-header">
          <div className="site-header-inner relative mx-auto flex items-center justify-between gap-3">
            <Link href="/" className="brand-mark" aria-label="PulseCart home">
              <span>pulse</span>cart
            </Link>
            <SiteControls />
          </div>
        </header>
        <main className="min-h-[75vh]">{children}</main>
        <footer className="site-footer">
          <div className="site-footer-inner">
            <div className="site-footer-top">
              <p>Keep good things<br /><em>close by.</em></p>
              <Link href="/#shop" className="footer-shop-link">Shop the neighborhood <span aria-hidden="true">↗</span></Link>
            </div>
            <div className="site-footer-bottom">
              <span>PulseCart · Thoughtful finds, closer to home.</span>
              <span>Made for everyday living.</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
