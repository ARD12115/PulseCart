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
    <div className="bg-surface-container-lowest text-on-surface min-h-screen p-space-lg">
      <section className="w-full bg-surface-container-low px-margin-lg py-space-md border-b border-outline-variant/30">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-label-sm text-label-sm tracking-wider uppercase text-outline">Experimental Lab</span>
            <span className="text-outline-variant font-label-sm text-label-sm">/</span>
            <span className="font-headline-sm text-headline-sm text-primary tracking-tight">Concurrency & Mutex Simulation</span>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container-high text-primary font-label-sm text-label-sm ml-2">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              <span>Deterministic 2PL Engine</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded bg-surface-container-low text-on-surface border border-outline/30">
              <span className="material-symbols-outlined text-secondary text-[16px]">schedule</span>
              <span className="font-tabular-data-md text-tabular-data-md" id="cluster-timestamp">
                {new Date().toISOString()}
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-[1440px] mx-auto px-margin-lg py-6 space-y-6">
        <div className="w-full bg-surface-container-lowest rounded-xl shadow-sm border border-outline/50 p-6">
          <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full xl:w-4/5">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="font-label-sm text-label-sm uppercase text-outline" htmlFor="shoppers-input">
                    Virtual Shoppers
                  </label>
                  <span className="font-tabular-price-lg text-tabular-price-lg text-primary" id="shoppers-val">
                    12,500
                  </span>
                </div>
                <input
                  className="w-full accent-primary cursor-pointer h-1.5 bg-surface-container-highest rounded-lg appearance-none border border-outline/30"
                  id="shoppers-input"
                  max="50000"
                  min="100"
                  step="100"
                  type="range"
                  value="12500"
                />
                <div className="flex justify-between font-label-sm text-label-sm text-outline">
                  <span>100</span>
                  <span>25,000</span>
                  <span>50,000</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-label-sm text-label-sm uppercase text-outline">Target Inventory Unit</label>
                <div className="relative bg-surface-container-low rounded p-2.5 flex items-center justify-between border border-outline/30">
                  <div className="flex flex-col min-w-0">
                    <span className="font-body-md text-body-md font-semibold text-primary truncate">boAt Rockerz 450 Pro</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-label-sm text-label-sm text-outline">SKU-AUDIO-9482</span>
                      <span className="w-1 h-1 rounded-full bg-outline"></span>
                      <span className="font-label-sm text-label-sm text-secondary font-semibold">Stock: 42 Units</span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-outline">expand_more</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-label-sm text-label-sm uppercase text-outline">Concurrency Strategy</label>
                <div className="grid grid-cols-3 gap-1 bg-surface-container-low p-1 rounded border border-outline/30">
                  <button
                    className="py-1.5 px-2 rounded bg-surface-container-lowest shadow-sm font-label-sm text-label-sm text-primary font-bold text-center border border-primary/30"
                    id="strat-2pl"
                  >
                    Row-Lock [2PL]
                  </button>
                  <button
                    className="py-1.5 px-2 rounded hover:bg-surface-container-lowest/50 font-label-sm text-label-sm text-on-surface-variant text-center"
                    id="strat-cas"
                  >
                    Optimistic CAS
                  </button>
                  <button
                    className="py-1.5 px-2 rounded hover:bg-surface-container-lowest/50 font-label-sm text-label-sm text-on-surface-variant text-center text-error"
                    id="strat-raw"
                  >
                    Unchecked Raw
                  </button>
                </div>
              </div>
            </div>
            <div className="w-full xl:w-1/5 flex flex-col justify-end">
              <button
                className="w-full py-3.5 px-6 rounded-xl bg-primary text-on-primary font-headline-sm text-headline-sm flex items-center justify-center gap-2.5 shadow-md hover:bg-primary-container transition-all border border-transparent"
                id="run-btn"
                disabled={busy}
              >
                <span className="material-symbols-outlined text-[20px]" id="run-icon">play_arrow</span>
                <span id="run-label">{busy ? 'Racing…' : 'Run Stress Test'}</span>
              </button>
            </div>
          </div>
        </div>

        <section className="w-full bg-surface-container-lowest rounded-xl shadow-sm border border-outline/50 p-6">
          <p className="font-label-sm text-label-sm tracking-wider uppercase text-outline mb-2">Concurrency lab</p>
          <h1 className="mt-2 text-4xl font-black text-on-surface">One last item. Two buyers.</h1>
          <p className="mt-3 max-w-2xl text-on-surface-variant">Both checkouts run at the same time. PostgreSQL's conditional stock update lets only one transaction claim the last unit.</p>

          <div className="mt-7 grid gap-4 rounded-lg border border-outline/50 bg-surface-container p-5 sm:grid-cols-3">
            <label className="text-sm font-semibold text-on-surface">
              Product ID
              <input className="mt-1 w-full rounded-sm border border-outline/30 p-2 bg-surface-container-lowest text-on-surface" type="number" min="1" value={productId} onChange={(event) => setProductId(event.target.value)} />
            </label>
            <label className="text-sm font-semibold text-on-surface">
              City
              <select id="city-filter" className="mt-1 w-full rounded-sm border border-outline/30 p-2 bg-surface-container-lowest text-on-surface" value={city} onChange={(event) => setCity(event.target.value)}>
                <option>Bengaluru</option>
                <option>Mangaluru</option>
                <option>Mysuru</option>
                <option>Hubballi</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-on-surface">
              Email domain
              <input className="mt-1 w-full rounded-sm border border-outline/30 p-2 bg-surface-container-lowest text-on-surface" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <button disabled={busy} onClick={runRace} className="rounded-sm bg-moss-solid px-5 py-3 font-bold text-white disabled:opacity-50 sm:col-span-3 border border-transparent">
              {busy ? 'Racing…' : 'Run two simultaneous checkouts'}
            </button>
          </div>

          {error && <p role="alert" className="mt-4 text-error">{error}</p>}

          <section aria-live="polite" className="mt-6 space-y-3">
            {logs.map((log) => (
              <div key={log.buyer} className={`rounded-sm p-4 border border-outline/30 ${log.ok ? 'bg-secondary/10 text-secondary' : 'bg-error/10 text-error'}`}>
                <strong className="font-tabular-data-md text-tabular-data-md">{log.buyer}:</strong> {log.result}
              </div>
            ))}
            {logs.length === 2 && (
              <p className="rounded-sm bg-primary p-4 font-bold text-white border border-transparent">
                {logs.filter((log) => log.ok).length === 1 ? 'Exactly one buyer won the last unit.' : logs.every((log) => log.ok) ? 'Both succeeded: the selected item had more than one unit.' : 'Neither succeeded: the item was already out of stock.'}
              </p>
            )}
          </section>

          <p className="mt-8 rounded-sm bg-surface-container p-4 font-mono text-sm text-on-surface-variant border border-outline/30">
            UPDATE store_inventory SET stock = stock - qty WHERE product_id = ? AND city = ? AND stock {'>='} qty
          </p>
          <p className="mt-3 text-sm text-on-surface-variant">The seeded first product (ID 1 on a fresh database) has one unit in Bengaluru.</p>
        </section>
      </div>
    </div>
  );
}
