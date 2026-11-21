
import Link from 'next/link';

async function fetchAdmin<T>(path: string): Promise<T[]> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/admin/${path}`, {
    cache: 'no-store',
  });
  if (!response.ok) return [];
  return response.json();
}

async function fetchAdminSingle<T>(path: string): Promise<T> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/admin/${path}`, {
    cache: 'no-store',
  });
  if (!response.ok) return {} as T;
  return response.json();
}

type Order = { id: number; city: string; status: string; total_paise: number; created_at: string };
type Event = { id: number; topic: string; key: string; published_at: string | null; created_at: string; consumer_status: string };
type Notification = { id: number; order_id: number; recipient_email: string; subject: string; status: string; attempts: number; last_error: string | null };
type SearchMetrics = { query_count: number; p50_ms: number; p95_ms: number; p99_ms: number };

export default async function AnalyticsPage() {
  const [orders, events, notifications, searchMetrics] = await Promise.all([
    fetchAdmin<Order>('orders'),
    fetchAdmin<Event>('outbox'),
    fetchAdmin<Notification>('notifications'),
    fetchAdminSingle<SearchMetrics>('search-metrics'),
  ]);

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

  // Engine metrics derivations
  const publishedEvents = events.filter((e: { published_at: string | null }) => e.published_at !== null).length;
  const syncedEvents = events.filter((e: { consumer_status: string }) => e.consumer_status === 'synced').length;
  const pendingEvents = events.filter((e: { consumer_status: string }) => e.consumer_status === 'pending').length;
  const firstOrder = orders.length > 0 ? new Date(orders[orders.length - 1].created_at) : null;
  const now = new Date();
  const hoursSinceFirst = firstOrder ? Math.max((now.getTime() - firstOrder.getTime()) / (1000 * 60 * 60), 0.01) : 1;
  const ordersPerSec = (orders.length / hoursSinceFirst / 3600).toFixed(2);
  const eventsPerSec = (events.length / hoursSinceFirst / 3600).toFixed(2);
  const syncLag = publishedEvents - syncedEvents;

  return (
    <div className="analytics-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-moss">Analytics dashboard</p>
          <h1 className="mt-2 text-4xl font-black">Store analytics</h1>
        </div>
        <p className="text-sm text-ink/50">Admin only · Live data from PostgreSQL</p>
      </div>

      <div className="mt-7 rounded-lg border border-ink/10 bg-surface p-6">
        <p className="text-ink/50">
          Admin access required. Enter your admin key on the{' '}
          <Link href="/admin" className="text-moss font-bold hover:underline">
            operations page
          </Link>
          to view analytics.
        </p>
      </div>

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

          {/* Engine metrics */}
          <div className="grid gap-4 lg:grid-cols-4 mb-8">
            <div className="rounded-lg border border-ink/10 bg-surface p-5">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-moss">Search latency p95</p>
              <h2 className="text-3xl font-black">{searchMetrics.p95_ms || 0} ms</h2>
            </div>
            <div className="rounded-lg border border-ink/10 bg-surface p-5">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-moss">Kafka events/sec</p>
              <h2 className="text-3xl font-black">{eventsPerSec}</h2>
            </div>
            <div className="rounded-lg border border-ink/10 bg-surface p-5">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-moss">OpenSearch sync lag</p>
              <h2 className="text-3xl font-black">{syncLag}</h2>
            </div>
            <div className="rounded-lg border border-ink/10 bg-surface p-5">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-moss">Orders/sec</p>
              <h2 className="text-3xl font-black">{ordersPerSec}</h2>
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
            <a href="/kinetic" className="block w-full h-full bg-surface rounded-lg flex items-center justify-center p-4">
              <span>View kinetic 3D storefront</span>
            </a>
          </div>
          </section>

          {/* Concurrency lab */}
          <section className="mt-6 rounded-lg border border-ink/10 bg-surface p-5">
            <h2 className="text-xl font-bold">Concurrency lab</h2>
            <p className="text-ink/50 text-sm mb-4">Test atomic stock reservation under concurrent checkout load.</p>
            <Link href="/demo" className="rounded-md bg-moss-solid px-4 py-2 font-semibold text-white">
              Run concurrency lab
            </Link>
          </section>
      </div>
    </div>
  );
}
