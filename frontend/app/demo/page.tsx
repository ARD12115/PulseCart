'use client';

import { useState } from 'react';

type Log = { buyer: string; result: string; ok: boolean };

export default function ConcurrencyDemoPage() {
  const [productId, setProductId] = useState('1');
  const [city, setCity] = useState('Bengaluru');
  const [email, setEmail] = useState('demo@example.com');
  const [logs, setLogs] = useState<Log[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function runRace() {
    if (!Number.isInteger(Number(productId)) || Number(productId) <= 0) {
      setError('Enter a valid product ID.');
      return;
    }
    setError('');
    setBusy(true);
    setLogs([]);
    try {
      const buyers = ['Alice', 'Bob'];
      const results = await Promise.all(buyers.map(async (buyer) => {
        try {
          const response = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customer_email: `${buyer.toLowerCase()}+${Date.now()}@${email.split('@')[1] || 'example.com'}`,
              customer_name: buyer,
              city,
              items: [{ product_id: Number(productId), qty: 1 }],
            }),
          });
          const data = await response.json() as { order_id?: number; detail?: string };
          return { buyer, ok: response.ok, result: response.ok ? `Order #${data.order_id} placed` : (data.detail || `HTTP ${response.status}`) };
        } catch {
          return { buyer, ok: false, result: 'Request failed; check the API and network.' };
        }
      }));
      setLogs(results);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs font-bold uppercase tracking-[0.25em] text-moss">Concurrency lab</p>
      <h1 className="mt-2 text-4xl font-black">One last item. Two buyers.</h1>
      <p className="mt-3 max-w-2xl text-ink/65">Both checkouts run at the same time. PostgreSQL’s conditional stock update lets only one transaction claim the last unit.</p>
      <div className="mt-7 grid gap-4 rounded-2xl border border-ink/10 bg-surface p-5 sm:grid-cols-3">
        <label className="text-sm font-semibold">Product ID<input className="mt-1 w-full rounded-lg border p-2" type="number" min="1" value={productId} onChange={(event) => setProductId(event.target.value)} /></label>
        <label className="text-sm font-semibold">City<select className="mt-1 w-full rounded-lg border p-2" value={city} onChange={(event) => setCity(event.target.value)}><option>Bengaluru</option><option>Mangaluru</option><option>Mysuru</option><option>Hubballi</option></select></label>
        <label className="text-sm font-semibold">Email domain<input className="mt-1 w-full rounded-lg border p-2" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <button disabled={busy} onClick={runRace} className="rounded-xl bg-moss-solid px-5 py-3 font-bold text-white disabled:opacity-50 sm:col-span-3">{busy ? 'Racing…' : 'Run two simultaneous checkouts'}</button>
      </div>
      {error && <p role="alert" className="mt-4 text-danger">{error}</p>}
      <section aria-live="polite" className="mt-6 space-y-3">
        {logs.map((log) => <div key={log.buyer} className={`rounded-xl p-4 ${log.ok ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}><strong>{log.buyer}:</strong> {log.result}</div>)}
        {logs.length === 2 && <p className="rounded-xl bg-moss-solid p-4 font-bold text-white">{logs.filter((log) => log.ok).length === 1 ? 'Exactly one buyer won the last unit.' : logs.every((log) => log.ok) ? 'Both succeeded: the selected item had more than one unit.' : 'Neither succeeded: the item was already out of stock.'}</p>}
      </section>
      <p className="mt-8 rounded-xl bg-lime/40 p-4 font-mono text-sm">UPDATE store_inventory SET stock = stock - qty WHERE product_id = ? AND city = ? AND stock &gt;= qty</p>
      <p className="mt-3 text-sm text-ink/60">The seeded first product (ID 1 on a fresh database) has one unit in Bengaluru.</p>
    </div>
  );
}
