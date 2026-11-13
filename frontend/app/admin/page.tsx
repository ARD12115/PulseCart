'use client';

import { useEffect, useState } from 'react';

type Order = { id: number; city: string; status: string; total_paise: number; created_at: string };
type Event = { id: number; topic: string; key: string; published_at: string | null; created_at: string };

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [orderResponse, eventResponse] = await Promise.all([
          fetch('/api/admin/orders'),
          fetch('/api/admin/outbox'),
        ]);
        if (!orderResponse.ok || !eventResponse.ok) throw new Error('Admin API unavailable');
        const [orderData, eventData] = await Promise.all([
          orderResponse.json() as Promise<Order[]>,
          eventResponse.json() as Promise<Event[]>,
        ]);
        if (active) {
          setOrders(orderData);
          setEvents(eventData);
          setUpdated(new Date().toLocaleTimeString());
          setError('');
        }
      } catch {
        if (active) setError('Could not load events. Ensure the API and database are running.');
      }
    };
    void load();
    const timer = window.setInterval(load, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.25em] text-moss">System pulse</p><h1 className="mt-2 text-4xl font-black">Order & event room</h1></div>
        <p className="text-sm text-ink/50">Refreshes every 5 seconds{updated ? ` · Updated ${updated}` : ''}</p>
      </div>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
      <div className="mt-7 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-ink/10 bg-white p-5">
          <h2 className="text-xl font-bold">Recent orders</h2>
          <div className="mt-4 space-y-3">
            {orders.map((order) => <article key={order.id} className="flex justify-between gap-3 border-b border-ink/10 pb-3 text-sm"><div><p className="font-bold">Order #{order.id} · {order.city}</p><p className="text-ink/50">{new Date(order.created_at).toLocaleString()}</p></div><span className="font-semibold">₹{(order.total_paise / 100).toFixed(2)}</span></article>)}
            {!orders.length && <p className="text-sm text-ink/50">No orders yet.</p>}
          </div>
        </section>
        <section className="rounded-2xl border border-ink/10 bg-white p-5">
          <h2 className="text-xl font-bold">Outbox events</h2>
          <div className="mt-4 space-y-3">
            {events.map((event) => <article key={event.id} className="flex items-center justify-between gap-3 border-b border-ink/10 pb-3 text-sm"><div><p className="font-bold">{event.topic}</p><p className="text-ink/50">#{event.id} · {event.key}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${event.published_at ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900'}`}>{event.published_at ? 'Published' : 'Pending'}</span></article>)}
            {!events.length && <p className="text-sm text-ink/50">No events yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
