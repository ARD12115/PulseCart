'use client';

import { useEffect, useState } from 'react';

type Order = { id: number; city: string; status: string; total_paise: number; created_at: string };
type Event = { id: number; topic: string; key: string; published_at: string | null; created_at: string };
type Notification = { id: number; order_id: number; recipient_email: string; subject: string; status: string; attempts: number; last_error: string | null };
type DeadLetter = { id: number; consumer: string; topic: string; kafka_offset: number | null; error: string };

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [deadLetters, setDeadLetters] = useState<DeadLetter[]>([]);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState('');
  const [keyDraft, setKeyDraft] = useState('');
  const [adminKey, setAdminKey] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const headers: Record<string, string> = adminKey ? { 'X-Admin-Key': adminKey } : {};
        const [orderResponse, eventResponse, notificationResponse, deadLetterResponse] = await Promise.all([
          fetch('/api/admin/orders', { headers }),
          fetch('/api/admin/outbox', { headers }),
          fetch('/api/admin/notifications', { headers }),
          fetch('/api/admin/dead-letters', { headers }),
        ]);
        if (!orderResponse.ok || !eventResponse.ok) throw new Error('Admin access unavailable. Enter a valid admin key if required.');
        const [orderData, eventData] = await Promise.all([
          orderResponse.json() as Promise<Order[]>,
          eventResponse.json() as Promise<Event[]>,
        ]);
        const notificationData = notificationResponse.ok ? await notificationResponse.json() as Notification[] : [];
        const deadLetterData = deadLetterResponse.ok ? await deadLetterResponse.json() as DeadLetter[] : [];
        if (active) {
          setOrders(orderData);
          setEvents(eventData);
          setNotifications(notificationData);
          setDeadLetters(deadLetterData);
          setUpdated(new Date().toLocaleTimeString());
          setError('');
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load admin data.');
      }
    };
    void load();
    const timer = window.setInterval(load, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [adminKey]);

  return (
    <div className="operations-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.25em] text-moss">System pulse</p><h1 className="mt-2 text-4xl font-black">Order & event room</h1></div>
        <p className="text-sm text-ink/50">Refreshes every 5 seconds{updated ? ` · Updated ${updated}` : ''}</p>
      </div>
      <div className="operations-overview" aria-label="Operational record counts">
        <div><span>ORDERS</span><strong>{orders.length}</strong></div>
        <div><span>OUTBOX EVENTS</span><strong>{events.length}</strong></div>
        <div><span>CONFIRMATIONS</span><strong>{notifications.length}</strong></div>
        <div><span>DEAD LETTERS</span><strong>{deadLetters.length}</strong></div>
      </div>
      <form className="mt-5 flex flex-wrap gap-2" onSubmit={(event) => {
        event.preventDefault();
        setAdminKey(keyDraft);
      }}>
        <label className="sr-only" htmlFor="admin-key">Admin key</label>
        <input
          id="admin-key"
          type="password"
          autoComplete="current-password"
          className="min-w-60 rounded-md border border-ink/15 px-3 py-2"
          placeholder="Admin key (if configured)"
          value={keyDraft}
          onChange={(event) => setKeyDraft(event.target.value)}
        />
        <button type="submit" className="rounded-md bg-moss-solid px-4 py-2 font-semibold text-white">Connect</button>
      </form>
      {error && <p role="alert" className="mt-5 rounded-lg bg-danger-soft p-4 text-danger">{error}</p>}
      <div className="mt-7 grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-ink/10 bg-surface p-5">
          <h2 className="text-xl font-bold">Recent orders</h2>
          <div className="mt-4 space-y-3">
            {orders.map((order) => <article key={order.id} className="flex justify-between gap-3 border-b border-ink/10 pb-3 text-sm"><div><p className="font-bold">Order #{order.id} · {order.city}</p><p className="text-ink/50">{new Date(order.created_at).toLocaleString()}</p></div><span className="font-semibold">₹{(order.total_paise / 100).toFixed(2)}</span></article>)}
            {!orders.length && <p className="text-sm text-ink/50">No orders yet. Place an order from the store to see it here.</p>}
          </div>
        </section>
        <section className="rounded-lg border border-ink/10 bg-surface p-5">
          <h2 className="text-xl font-bold">Outbox events</h2>
          <div className="mt-4 space-y-3">
            {events.map((event) => <article key={event.id} className="flex items-center justify-between gap-3 border-b border-ink/10 pb-3 text-sm"><div><p className="font-bold">{event.topic}</p><p className="text-ink/50">#{event.id} · {event.key}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${event.published_at ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'}`}>{event.published_at ? 'Published' : 'Pending'}</span></article>)}
            {!events.length && <p className="text-sm text-ink/50">No events yet. Events appear after checkouts are placed.</p>}
          </div>
        </section>
        <section className="rounded-lg border border-ink/10 bg-surface p-5">
          <h2 className="text-xl font-bold">Order confirmations</h2>
          <div className="mt-4 space-y-3">
            {notifications.map((item) => <article key={item.id} className="flex items-center justify-between gap-3 border-b border-ink/10 pb-3 text-sm"><div><p className="font-bold">Order #{item.order_id} · {item.recipient_email}</p><p className="text-ink/50">{item.subject}{item.last_error ? ` · ${item.last_error}` : ''}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${item.status === 'sent' || item.status === 'logged' ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'}`}>{item.status}</span></article>)}
            {!notifications.length && <p className="text-sm text-ink/50">No confirmations yet. The notification worker creates one per order.</p>}
          </div>
        </section>
        <section className="rounded-lg border border-ink/10 bg-surface p-5">
          <h2 className="text-xl font-bold">Dead letters</h2>
          <div className="mt-4 space-y-3">
            {deadLetters.map((item) => <article key={item.id} className="border-b border-ink/10 pb-3 text-sm"><p className="font-bold">{item.consumer} · {item.topic}@{item.kafka_offset ?? '?'}</p><p className="text-ink/50">{item.error}</p></article>)}
            {!deadLetters.length && <p className="text-sm text-ink/50">None. Messages a consumer cannot process after retrying appear here.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
