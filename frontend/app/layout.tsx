import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import SiteControls from './site-controls';

export const metadata: Metadata = {
  title: 'PulseCart — Local finds, in stock',
  description: 'A real-time demo store powered by PostgreSQL, Kafka, and OpenSearch.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="system">
      <body className="min-h-screen bg-paper">
        <header className="border-b border-ink/10 bg-paper">
          <div className="relative mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4">
            <Link href="/" className="text-xl font-black tracking-tight text-moss">
              PulseCart<span className="text-ink">.</span>
            </Link>
            <SiteControls />
          </div>
        </header>
        <main className="mx-auto min-h-[75vh] max-w-7xl px-5 py-10">{children}</main>
        <footer className="border-t border-ink/10 px-5 py-8 text-center text-sm text-ink/60">
          Stock is decided in Postgres. Kafka spreads the news.
        </footer>
      </body>
    </html>
  );
}
