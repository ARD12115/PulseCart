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
  const [counts, setCounts] = useState<(number | null)[]>([null, null, null, null]);
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
        if ([orderResponse, eventResponse, notificationResponse, deadLetterResponse].some((response) => response.status === 401 || response.status === 403)) {
          throw new Error('Admin access unavailable. Enter a valid admin key if required.');
        }
        const [orderData, eventData, notificationData, deadLetterData] = await Promise.all([
          orderResponse.ok ? orderResponse.json() as Promise<Order[]> : Promise.resolve(null),
          eventResponse.ok ? eventResponse.json() as Promise<Event[]> : Promise.resolve(null),
          notificationResponse.ok ? notificationResponse.json() as Promise<Notification[]> : Promise.resolve(null),
          deadLetterResponse.ok ? deadLetterResponse.json() as Promise<DeadLetter[]> : Promise.resolve(null),
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
          setDeadLetters(deadLetterData ?? []);
          setCounts([orderResponse, eventResponse, notificationResponse, deadLetterResponse].map(total));
          setUpdated(new Date().toLocaleTimeString());
          setError('');
        }
      } catch (cause) {
        if (active && adminKey) {
          setCounts([null, null, null, null]);
          setError(cause instanceof Error ? cause.message : 'Could not load admin data.');
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

  return (
    <div className="bg-surface-container-lowest text-on-surface min-h-screen">
      <section className="w-full bg-surface-container-low px-margin-lg py-space-md border-b border-outline-variant/30">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-space-sm">
          <div>
            <p className="font-label-sm text-label-sm text-outline tracking-wider uppercase">System pulse</p>
            <h1 className="mt-space-xs font-headline-lg text-headline-lg text-on-surface tracking-tight">Order & event room</h1>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Refreshes every 5 seconds{updated ? ` · Updated ${updated}` : ''}</p>
        </div>
      </section>

      <div className="max-w-[1440px] mx-auto px-margin-lg py-space-lg">
        <div className="operations-overview grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter" aria-label="Operational record counts">
          <div className="bg-surface-container-lowest p-space-md rounded-lg shadow-sm border border-outline/50 flex items-center justify-between">
            <div>
              <span className="font-label-sm text-label-sm text-outline block">ORDERS</span>
              <strong className="font-tabular-price-lg text-tabular-price-lg text-on-surface">{counts[0] ?? '—'}</strong>
            </div>
            <span className="material-symbols-outlined text-secondary text-[24px]">receipt_long</span>
          </div>
          <div className="bg-surface-container-lowest p-space-md rounded-lg shadow-sm border border-outline/50 flex items-center justify-between">
            <div>
              <span className="font-label-sm text-label-sm text-outline block">OUTBOX EVENTS</span>
              <strong className="font-tabular-price-lg text-tabular-price-lg text-on-surface">{counts[1] ?? '—'}</strong>
            </div>
            <span className="material-symbols-outlined text-secondary text-[24px]">send</span>
          </div>
          <div className="bg-surface-container-lowest p-space-md rounded-lg shadow-sm border border-outline/50 flex items-center justify-between">
            <div>
              <span className="font-label-sm text-label-sm text-outline block">CONFIRMATIONS</span>
              <strong className="font-tabular-price-lg text-tabular-price-lg text-on-surface">{counts[2] ?? '—'}</strong>
            </div>
            <span className="material-symbols-outlined text-secondary text-[24px]">email</span>
          </div>
          <div className="bg-surface-container-lowest p-space-md rounded-lg shadow-sm border border-outline/50 flex items-center justify-between">
            <div>
              <span className="font-label-sm text-label-sm text-outline block">DEAD LETTERS</span>
              <strong className="font-tabular-price-lg text-tabular-price-lg text-on-surface">{counts[3] ?? '—'}</strong>
            </div>
            <span className="material-symbols-outlined text-error text-[24px]">error</span>
          </div>
        </div>

        <form className="mt-space-lg flex flex-wrap gap-space-md" onSubmit={(event) => {
          event.preventDefault();
          setAdminKey(keyDraft);
        }}>
          <label className="sr-only" htmlFor="admin-key">Admin key</label>
          <input
            id="admin-key"
            type="password"
            autoComplete="current-password"
            className="min-w-60 rounded-sm border border-outline/30 px-space-sm py-space-sm bg-surface-container-lowest text-on-surface focus:border-primary focus:outline-none"
            placeholder="Admin key (if configured)"
            value={keyDraft}
            onChange={(event) => setKeyDraft(event.target.value)}
          />
          <button type="submit" className="rounded-sm bg-primary text-on-primary px-space-md py-space-sm font-label-sm text-label-sm transition-colors hover:bg-primary-container border border-transparent">
            Connect
          </button>
        </form>

        {error && <p role="alert" className="mt-space-lg rounded-lg bg-error/10 p-space-md text-error border border-error/30">{error}</p>}

        <div className="mt-space-xl grid gap-gutter-lg lg:grid-cols-2">
          <section className="bg-surface-container-lowest p-space-lg rounded-lg shadow-sm border border-outline/50">
            <h2 className="font-label-sm text-label-sm text-outline tracking-wider uppercase mb-space-sm">Recent orders</h2>
            <div className="mt-space-sm space-y-space-sm">
              {orders.map((order) => (
                <article key={order.id} className="flex justify-between gap-space-md border-b border-outline/50 pb-space-sm text-sm">
                  <div>
                    <p className="font-tabular-data-md text-tabular-data-md text-on-surface">Order #{order.id} · {order.city}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">{new Date(order.created_at).toLocaleString()}</p>
                  </div>
                  <span className="font-tabular-data-md text-tabular-data-md text-primary">₹{(order.total_paise / 100).toFixed(2)}</span>
                </article>
              ))}
              {!orders.length && <p className="font-body-sm text-body-sm text-on-surface-variant">No orders yet. Place an order from the store to see it here.</p>}
            </div>
          </section>

          <section className="bg-surface-container-lowest p-space-lg rounded-lg shadow-sm border border-outline/50">
            <h2 className="font-label-sm text-label-sm text-outline tracking-wider uppercase mb-space-sm">Outbox events</h2>
            <div className="mt-space-sm space-y-space-sm">
              {events.map((event) => (
                <article key={event.id} className="flex items-center justify-between gap-space-md border-b border-outline/50 pb-space-sm text-sm">
                  <div>
                    <p className="font-tabular-data-md text-tabular-data-md text-on-surface">{event.topic}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">#{event.id} · {event.key}</p>
                  </div>
                  <span className={`rounded-full px-space-xs py-0.5 text-[10px] font-label-sm ${
                    event.published_at ? 'bg-secondary/10 text-secondary border border-secondary/30' : 'bg-error/10 text-error border border-error/30'
                  }`}>{event.published_at ? 'Published' : 'Pending'}</span>
                </article>
              ))}
              {!events.length && <p className="font-body-sm text-body-sm text-on-surface-variant">No events yet. Events appear after checkouts are placed.</p>}
            </div>
          </section>

          <section className="bg-surface-container-lowest p-space-lg rounded-lg shadow-sm border border-outline/50">
            <h2 className="font-label-sm text-label-sm text-outline tracking-wider uppercase mb-space-sm">Order confirmations</h2>
            <div className="mt-space-sm space-y-space-sm">
              {notifications.map((item) => (
                <article key={item.id} className="flex items-center justify-between gap-space-md border-b border-outline/50 pb-space-sm text-sm">
                  <div>
                    <p className="font-tabular-data-md text-tabular-data-md text-on-surface">Order #{item.order_id} · {item.recipient_email}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">{item.subject}{item.last_error ? ` · ${item.last_error}` : ''}</p>
                  </div>
                  <span className={`rounded-full px-space-xs py-0.5 text-[10px] font-label-sm ${
                    item.status === 'sent' || item.status === 'logged' ? 'bg-secondary/10 text-secondary border border-secondary/30' : 'bg-error/10 text-error border border-error/30'
                  }`}>{item.status}</span>
                </article>
              ))}
              {!notifications.length && <p className="font-body-sm text-body-sm text-on-surface-variant">{counts[2] === null ? 'Confirmations unavailable.' : 'No confirmations yet. The notification worker creates one per order.'}</p>}
            </div>
          </section>

          <section className="bg-surface-container-lowest p-space-lg rounded-lg shadow-sm border border-outline/50">
            <h2 className="font-label-sm text-label-sm text-outline tracking-wider uppercase mb-space-sm">Dead letters</h2>
            <div className="mt-space-sm space-y-space-sm">
              {deadLetters.map((item) => (
                <article key={item.id} className="border-b border-outline/50 pb-space-sm text-sm">
                  <p className="font-tabular-data-md text-tabular-data-md text-on-surface">{item.consumer} · {item.topic}@{item.kafka_offset ?? '?'}</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">{item.error}</p>
                </article>
              ))}
              {!deadLetters.length && <p className="font-body-sm text-body-sm text-on-surface-variant">{counts[3] === null ? 'Dead letters unavailable.' : 'None. Messages a consumer cannot process after retrying appear here.'}</p>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
