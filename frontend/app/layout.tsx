import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'PulseCart — Local finds, in stock',
  description: 'A real-time demo store powered by PostgreSQL, Kafka, and OpenSearch.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-paper">
        <header className="border-b border-ink/10 bg-paper">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
            <Link href="/" className="text-xl font-black tracking-tight text-moss">
              PulseCart<span className="text-ink">.</span>
            </Link>
            <nav className="flex items-center gap-5 text-sm font-medium">
              <Link href="/" className="hover:text-moss">Shop</Link>
              <Link href="/cart" className="hover:text-moss">Cart</Link>
              <Link href="/demo" className="hover:text-moss">Race demo</Link>
              <Link href="/admin" className="hover:text-moss">Ops</Link>
            </nav>
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
