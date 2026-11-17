'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Order = { id: number; city: string; status: string; total_paise: number; created_at: string };
type Event = { id: number; topic: string; key: string; published_at: string | null; created_at: string };
type Notification = { id: number; order_id: number; recipient_email: string; subject: string; status: string; attempts: number; last_error: string | null };

export default function AnalyticsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [counts, setCounts] = useState<(number | null)[]>([null, null, null]);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState('');
  const [keyDraft, setKeyDraft] = useState('');
  const [adminKey, setAdminKey] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const headers: Record<string, string> = adminKey ? { 'X-Admin-Key': adminKey } : {};
        const [orderResponse, eventResponse, notificationResponse] = await Promise.all([
          fetch('/api/admin/orders', { headers }),
          fetch('/api/admin/outbox', { headers }),
          fetch('/api/admin/notifications', { headers }),
        ]);
        if ([orderResponse, eventResponse, notificationResponse].some((response) => response.status === 401 || response.status === 403)) {
          throw new Error('Admin access unavailable. Enter a valid admin key if required.');
        }
        const [orderData, eventData, notificationData] = await Promise.all([
          orderResponse.ok ? orderResponse.json() as Promise<Order[]> : Promise.resolve(null),
          eventResponse.ok ? eventResponse.json() as Promise<Event[]> : Promise.resolve(null),
          notificationResponse.ok ? notificationResponse.json() as Promise<Notification[]> : Promise.resolve(null),
        ]);
        const total = (response: Response) => {
          const header = response.headers.get('X-Total-Count');
          if (!response.ok || header === null || !/^\d+$/.test(header)) return null;
          const value = Number(header);
          return Number.isSafeInteger(value) ? value : null;
        };
        if (active) {
          setOrders(orderData ?? []);
          setEvents(eventData ?? []);
          setNotifications(notificationData ?? []);
          setCounts([orderResponse, eventResponse, notificationResponse].map(total));
          setUpdated(new Date().toLocaleTimeString());
          setError('');
        }
      } catch (cause) {
        if (active && adminKey) {
          setCounts([null, null, null]);
          setError(cause instanceof Error ? cause.message : 'Could not load analytics data.');
        }
      }
    };
    if (adminKey) {
      void load();
      const timer = window.setInterval(load, 5000);
      return () => { active = false; window.clearInterval(timer); };
    }
    return () => { active = false; };
  }, [adminKey]);

  // Analytics derivations
  const totalRevenue = orders.reduce((sum, o) => sum + o.total_paise, 0);
  const ordersByCity = orders.reduce((acc, o) => {
    acc[o.city] = (acc[o.city] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topCity = Object.entries(ordersByCity).sort((a, b) => b[1] - a[1])[0];
  const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;

  const cityBarWidth = (count: number) => {
    const max = Math.max(...Object.values(ordersByCity), 1);
    return Math.max(20, (count / max) * 100);
  };

  return (
    <div className="analytics-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-moss">Analytics dashboard</p>
          <h1 className="mt-2 text-4xl font-black">Store analytics</h1>
        </div>
        <p className="text-sm text-ink/50">Admin only · Refreshes every 5 seconds{updated ? ` · Updated ${updated}` : ''}</p>
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

      {!adminKey && (
        <div className="mt-7 rounded-lg border border-ink/10 bg-surface p-6">
          <p className="text-ink/50">Enter your admin key above to view analytics.</p>
        </div>
      )}

      {adminKey && (
        <div className="mt-7">
          {/* Key metrics */}
          <div className="grid gap-4 lg:grid-cols-4 mb-6">
            <div className="rounded-lg border border-ink/10 bg-surface p-5">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-moss">Total orders</p>
              <h2 className="text-3xl font-black">{orders.length}</h2>
            </div>
            <div className="rounded-lg border border-ink/10 bg-surface p-5">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-moss">Total revenue</p>
              <h2 className="text-3xl font-black">₹{(totalRevenue / 100).toFixed(2)}</h2>
            </div>
            <div className="rounded-lg border border-ink/10 bg-surface p-5">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-moss">Avg order value</p>
              <h2 className="text-3xl font-black">₹{(avgOrderValue / 100).toFixed(2)}</h2>
            </div>
            <div className="rounded-lg border border-ink/10 bg-surface p-5">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-moss">Top city</p>
              <h2 className="text-3xl font-black">{topCity ? topCity[0] : '—'}</h2>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Orders by city bar chart */}
            <section className="rounded-lg border border-ink/10 bg-surface p-5 lg:col-span-2">
              <h2 className="text-xl font-bold">Orders by city</h2>
              <div className="mt-4">
                {Object.entries(ordersByCity).map(([city, count]) => (
                  <div key={city} className="mb-3">
                    <div className="flex justify-between text-sm text-ink/50 mb-1">
                      <span>{city}</span>
                      <span>{count}</span>
                    </div>
                    <div className="h-3 bg-surface rounded-full overflow-hidden">
                      <div
                        className="h-full bg-d4ff00"
                        style={{ width: cityBarWidth(count) }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Recent orders */}
            <section className="rounded-lg border border-ink/10 bg-surface p-5">
              <h2 className="text-xl font-bold">Recent orders</h2>
              <div className="mt-4 space-y-2">
                {orders.slice(0, 5).map((order) => (
                  <article key={order.id} className="flex justify-between gap-3 border-b border-ink/10 pb-2 text-sm">
                    <div>
                      <p className="font-bold">Order #{order.id}</p>
                      <p className="text-ink/50 text-xs">{order.city}</p>
                    </div>
                    <span className="font-semibold">₹{(order.total_paise / 100).toFixed(2)}</span>
                  </article>
                ))}
                {orders.length === 0 && <p className="text-sm text-ink/50">No orders yet.</p>}
              </div>
            </section>

            {/* Outbox events */}
            <section className="rounded-lg border border-ink/10 bg-surface p-5">
              <h2 className="text-xl font-bold">Outbox events</h2>
              <div className="mt-4 space-y-2">
                {events.slice(0, 5).map((event) => (
                  <article key={event.id} className="flex justify-between gap-3 border-b border-ink/10 pb-2 text-sm">
                    <div>
                      <p className="font-bold">{event.topic}</p>
                      <p className="text-ink/50 text-xs">#{event.id}</p>
                    </div>
                    <span className={`text-xs font-bold ${event.published_at ? 'text-success' : 'text-warning'}`}>
                      {event.published_at ? 'Published' : 'Pending'}
                    </span>
                  </article>
                ))}
                {events.length === 0 && <p className="text-sm text-ink/50">No events yet.</p>}
              </div>
            </section>
          </div>

          {/* Notifications */}
          <section className="mt-6 rounded-lg border border-ink/10 bg-surface p-5">
            <h2 className="text-xl font-bold">Order confirmations</h2>
            <div className="mt-4 space-y-2">
              {notifications.slice(0, 5).map((item) => (
                <article key={item.id} className="flex justify-between gap-3 border-b border-ink/10 pb-2 text-sm">
                  <div>
                    <p className="font-bold">Order #{item.order_id}</p>
                    <p className="text-ink/50 text-xs">{item.recipient_email}</p>
                  </div>
                  <span className={`text-xs font-bold ${item.status === 'sent' || item.status === 'logged' ? 'text-success' : 'text-warning'}`}>
                    {item.status}
                  </span>
                </article>
              ))}
              {notifications.length === 0 && <p className="text-sm text-ink/50">No confirmations yet.</p>}
            </div>
          </section>

          {/* Kinetic 3D preview section */}
          <section className="mt-6 rounded-lg border border-ink/10 bg-surface p-5">
            <h2 className="text-xl font-bold">Kinetic 3D storefront preview</h2>
            <p className="text-ink/50 text-sm mb-4">Interactive 3D hardware catalog with WebGL background.</p>
            <div className="rounded-lg border border-ink/10 overflow-hidden h-64">
              <iframe
                src="/kinetic"
                className="w-full h-full"
                title="Kinetic 3D storefront"
              />
            </div>
          </section>

          {/* Concurrency lab */}
          <section className="mt-6 rounded-lg border border-ink/10 bg-surface p-5">
            <h2 className="text-xl font-bold">Concurrency lab</h2>
            <p className="text-ink/50 text-sm mb-4">Test atomic stock reservation under concurrent checkout load.</p>
            <Link href="/demo" className="rounded-md bg-moss-solid px-4 py-2 font-semibold text-white">
              Run concurrency lab <span aria-hidden="true">↗</span>
            </Link>
          </section>
        </div>
      )}
    </div>
  );
}

export default AnalyticsPage;
