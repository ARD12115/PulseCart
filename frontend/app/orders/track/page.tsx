'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';

const formatPrice = (paise: number) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
}).format(paise / 100);

type OrderOut = {
  order_id: number;
  total_paise: number;
  status: string;
  city: string;
  created_at: string;
  items: Array<{ product_id: number; qty: number; price_paise: number; name: string; sku: string }>;
};

export default function OrderTrackPage() {
  const [orderNumber, setOrderNumber] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [order, setOrder] = useState<OrderOut | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function fetchOrder(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const response = await fetch(`/api/orders/${orderNumber}`, {
        headers: {
          'X-Order-Access-Token': accessCode,
        },
      });
      if (response.status === 401 || response.status === 403) {
        throw new Error('Invalid order number or access code.');
      }
      if (!response.ok) {
        throw new Error('Order not found.');
      }
      const data: OrderOut = await response.json();
      setOrder(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load order.');
    } finally {
      setBusy(false);
    }
  }

  if (order) {
    return (
      <section className="order-tracking" style={{ maxWidth: '680px', margin: '3rem auto', padding: '0 1rem' }}>
        <div className="order-success" style={{ textAlign: 'center' }}>
          <span className="success-mark" aria-hidden="true">✓</span>
          <p className="eyebrow">Order confirmed</p>
          <h1 id="order-title">Order #{order.order_id}</h1>
          <p>Status: <strong>{order.status.charAt(0).toUpperCase() + order.status.slice(1)}</strong></p>
          <p>Delivery city: <strong>{order.city}</strong></p>
          <p>Order total: <strong>{formatPrice(order.total_paise)}</strong></p>
          <p>Placed: <strong>{new Date(order.created_at).toLocaleString()}</strong></p>
          <div className="order-items" style={{ marginTop: '1.5rem' }}>
            <h3>Items</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.5rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid rgb(var(--color-ink) / .2)' }}>
                  <th style={{ padding: '.5rem 0', fontSize: '.72rem', color: 'rgb(var(--color-ink) / .6)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Item</th>
                  <th style={{ padding: '.5rem 0', fontSize: '.72rem', color: 'rgb(var(--color-ink) / .6)', textTransform: 'uppercase', letterSpacing: '.1em', textAlign: 'right' }}>Qty</th>
                  <th style={{ padding: '.5rem 0', fontSize: '.72rem', color: 'rgb(var(--color-ink) / .6)', textTransform: 'uppercase', letterSpacing: '.1em', textAlign: 'right' }}>Price</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={`${item.product_id}-${order.order_id}`} style={{ borderBottom: '1px solid rgb(var(--color-ink) / .1)' }}>
                    <td style={{ padding: '.5rem 0', color: 'rgb(var(--color-ink))' }}>{item.name}</td>
                    <td style={{ padding: '.5rem 0', color: 'rgb(var(--color-ink))', textAlign: 'right' }}>{item.qty}</td>
                    <td style={{ padding: '.5rem 0', color: 'rgb(var(--color-ink))', textAlign: 'right' }}>{formatPrice(item.price_paise * item.qty)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid rgb(var(--color-ink))', paddingTop: '.5rem' }}>
                  <td style={{ padding: '.5rem 0', color: 'rgb(var(--color-ink) / .6)' }}>Total</td>
                  <td style={{ padding: '.5rem 0', textAlign: 'right' }}></td>
                  <td style={{ padding: '.5rem 0', color: 'rgb(var(--color-ink))', fontWeight: '700', textAlign: 'right' }}>{formatPrice(order.total_paise)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="order-actions" style={{ marginTop: '2rem', display: 'flex', gap: '.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link href="/#shop" className="button-dark">Continue shopping</Link>
            <Link href="/cart" className="button-outline">Track another order</Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="order-tracking" style={{ maxWidth: '480px', margin: '3rem auto', padding: '0 1rem' }}>
      <div className="order-form" style={{ padding: '2rem', border: '1px solid rgb(var(--color-ink) / .12)', borderRadius: 'var(--radius-md)', background: 'rgb(var(--color-surface))' }}>
        <p className="eyebrow">Track your order</p>
        <h1 id="track-title">Track order</h1>
        <p className="text-ink/60 text-sm mb-4">Enter your order number and private access code.</p>
        <form onSubmit={fetchOrder}>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="track-order-number" className="text-sm font-bold text-ink/80 block mb-1">Order number</label>
            <input
              id="track-order-number"
              type="number"
              autoComplete="off"
              value={orderNumber}
              onChange={(event) => setOrderNumber(String(Number(event.target.value)))}
              className="w-full min-h-42px px-3 py-2 border border-ink/15 rounded-md"
              placeholder="e.g. 42"
              required
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="track-access-code" className="text-sm font-bold text-ink/80 block mb-1">Private access code</label>
            <input
              id="track-access-code"
              type="text"
              autoComplete="off"
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value)}
              className="w-full min-h-42px px-3 py-2 border border-ink/15 rounded-md"
              placeholder="Paste your code here"
              required
            />
          </div>
          {error && <p role="alert" className="mt-3 rounded-lg bg-danger-soft p-3 text-danger text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full min-h-44px rounded-md bg-moss-solid px-4 py-2 font-semibold text-white disabled:opacity-50"
            disabled={busy || !orderNumber || !accessCode}
          >
            {busy ? 'Looking up…' : 'Track order'}
          </button>
        </form>
        <div className="mt-3">
          <Link href="/" className="text-ink/60 text-sm">← Continue shopping</Link>
        </div>
      </div>
    </section>
  );
}
