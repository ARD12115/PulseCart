
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
    <div className="bg-surface-container-lowest text-on-surface min-h-screen">
      <section className="w-full bg-surface-container-low px-margin-lg py-space-md border-b border-outline-variant/30">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-space-sm">
          <div>
            <p className="font-label-sm text-label-sm text-outline tracking-wider uppercase">Analytics dashboard</p>
            <h1 className="mt-space-xs font-headline-lg text-headline-lg text-on-surface tracking-tight">Store analytics</h1>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Admin only · Live data from PostgreSQL</p>
        </div>
      </section>

      <div className="max-w-[1440px] mx-auto px-margin-lg py-space-lg">
        <div className="bg-surface-container-lowest rounded-lg shadow-sm border border-outline/50 p-space-lg">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Admin access required. Enter your admin key on the{' '}
            <Link href="/admin" className="text-primary font-label-sm text-label-sm underline underline-offset-4 hover:text-primary-container">
              operations page
            </Link>
            to view analytics.
          </p>
        </div>

        {/* Key metrics */}
        <div className="mt-space-lg grid gap-space-md lg:grid-cols-4 mb-space-lg">
          <div className="bg-surface-container-lowest rounded-lg shadow-sm border border-outline/50 p-space-md">
            <p className="font-label-sm text-label-sm text-outline tracking-wider uppercase">Total orders</p>
            <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight">{orders.length}</h2>
          </div>
          <div className="bg-surface-container-lowest rounded-lg shadow-sm border border-outline/50 p-space-md">
            <p className="font-label-sm text-label-sm text-outline tracking-wider uppercase">Total revenue</p>
            <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight">₹{(totalRevenue / 100).toFixed(2)}</h2>
          </div>
          <div className="bg-surface-container-lowest rounded-lg shadow-sm border border-outline/50 p-space-md">
            <p className="font-label-sm text-label-sm text-outline tracking-wider uppercase">Avg order value</p>
            <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight">₹{(avgOrderValue / 100).toFixed(2)}</h2>
          </div>
          <div className="bg-surface-container-lowest rounded-lg shadow-sm border border-outline/50 p-space-md">
            <p className="font-label-sm text-label-sm text-outline tracking-wider uppercase">Top city</p>
            <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight">{topCity ? topCity[0] : '—'}</h2>
          </div>
        </div>

        {/* Engine metrics */}
        <div className="grid gap-space-md lg:grid-cols-4 mb-space-xl">
          <div className="bg-surface-container-lowest rounded-lg shadow-sm border border-outline/50 p-space-md">
            <p className="font-label-sm text-label-sm text-outline tracking-wider uppercase">Search latency p95</p>
            <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight">{searchMetrics.p95_ms || 0} ms</h2>
          </div>
          <div className="bg-surface-container-lowest rounded-lg shadow-sm border border-outline/50 p-space-md">
            <p className="font-label-sm text-label-sm text-outline tracking-wider uppercase">Kafka events/sec</p>
            <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight">{eventsPerSec}</h2>
          </div>
          <div className="bg-surface-container-lowest rounded-lg shadow-sm border border-outline/50 p-space-md">
            <p className="font-label-sm text-label-sm text-outline tracking-wider uppercase">OpenSearch sync lag</p>
            <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight">{syncLag}</h2>
          </div>
          <div className="bg-surface-container-lowest rounded-lg shadow-sm border border-outline/50 p-space-md">
            <p className="font-label-sm text-label-sm text-outline tracking-wider uppercase">Orders/sec</p>
            <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight">{ordersPerSec}</h2>
          </div>
        </div>

        <div className="grid gap-gutter-lg lg:grid-cols-3">
          {/* Orders by city bar chart */}
          <section className="bg-surface-container-lowest rounded-lg shadow-sm border border-outline/50 p-space-lg lg:col-span-2">
            <h2 className="font-label-sm text-label-sm text-outline tracking-wider uppercase mb-space-md">Orders by city</h2>
            <div className="mt-space-md">
              {Object.entries(ordersByCity).map(([city, count]) => (
                <div key={city} className="mb-space-sm">
                  <div className="flex justify-between font-tabular-data-md text-tabular-data-md text-on-surface mb-space-xs">
                    <span>{city}</span>
                    <span>{count}</span>
                  </div>
                  <div className="h-2 bg-surface-container-low rounded-full overflow-hidden border border-outline/30">
                    <div
                      className="h-full bg-secondary rounded-full"
                      style={{ width: cityBarWidth(count) }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Recent orders */}
          <section className="bg-surface-container-lowest rounded-lg shadow-sm border border-outline/50 p-space-lg">
            <h2 className="font-label-sm text-label-sm text-outline tracking-wider uppercase mb-space-md">Recent orders</h2>
            <div className="mt-space-sm space-y-space-sm">
              {orders.slice(0, 5).map((order) => (
                <article key={order.id} className="flex justify-between gap-space-md border-b border-outline/50 pb-space-sm text-sm">
                  <div>
                    <p className="font-tabular-data-md text-tabular-data-md text-on-surface">Order #{order.id}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">{order.city}</p>
                  </div>
                  <span className="font-tabular-data-md text-tabular-data-md text-primary">₹{(order.total_paise / 100).toFixed(2)}</span>
                </article>
              ))}
              {orders.length === 0 && <p className="font-body-sm text-body-sm text-on-surface-variant">No orders yet.</p>}
            </div>
          </section>

          {/* Outbox events */}
          <section className="bg-surface-container-lowest rounded-lg shadow-sm border border-outline/50 p-space-lg">
            <h2 className="font-label-sm text-label-sm text-outline tracking-wider uppercase mb-space-md">Outbox events</h2>
            <div className="mt-space-sm space-y-space-sm">
              {events.slice(0, 5).map((event) => (
                <article key={event.id} className="flex justify-between gap-space-md border-b border-outline/50 pb-space-sm text-sm">
                  <div>
                    <p className="font-tabular-data-md text-tabular-data-md text-on-surface">{event.topic}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">#{event.id}</p>
                  </div>
                  <span className={`text-[10px] font-label-sm ${
                    event.published_at ? 'text-secondary' : 'text-error'
                  }`}>
                    {event.published_at ? 'Published' : 'Pending'}
                  </span>
                </article>
              ))}
              {events.length === 0 && <p className="font-body-sm text-body-sm text-on-surface-variant">No events yet.</p>}
            </div>
          </section>
        </div>

        {/* Notifications */}
        <section className="mt-space-lg bg-surface-container-lowest rounded-lg shadow-sm border border-outline/50 p-space-lg">
          <h2 className="font-label-sm text-label-sm text-outline tracking-wider uppercase mb-space-md">Order confirmations</h2>
          <div className="mt-space-sm space-y-space-sm">
            {notifications.slice(0, 5).map((item) => (
              <article key={item.id} className="flex justify-between gap-space-md border-b border-outline/50 pb-space-sm text-sm">
                <div>
                  <p className="font-tabular-data-md text-tabular-data-md text-on-surface">Order #{item.order_id}</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">{item.recipient_email}</p>
                </div>
                <span className={`text-[10px] font-label-sm ${
                  item.status === 'sent' || item.status === 'logged' ? 'text-secondary' : 'text-error'
                }`}>
                  {item.status}
                </span>
              </article>
            ))}
            {notifications.length === 0 && <p className="font-body-sm text-body-sm text-on-surface-variant">No confirmations yet.</p>}
          </div>
        </section>

        {/* Kinetic 3D preview section */}
        <section className="mt-space-lg bg-surface-container-lowest rounded-lg shadow-sm border border-outline/50 p-space-lg">
          <h2 className="font-label-sm text-label-sm text-outline tracking-wider uppercase mb-space-md">Kinetic 3D storefront preview</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">Interactive 3D hardware catalog with WebGL background.</p>
          <div className="rounded-lg border border-outline/30 overflow-hidden h-48 bg-surface-container-low">
            <a href="/kinetic" className="block w-full h-full flex items-center justify-center p-space-md bg-surface-container-lowest">
              <span className="font-tabular-data-md text-tabular-data-md text-on-surface-variant">View kinetic 3D storefront</span>
            </a>
          </div>
        </section>

        {/* Concurrency lab */}
        <section className="mt-space-lg bg-surface-container-lowest rounded-lg shadow-sm border border-outline/50 p-space-lg">
          <h2 className="font-label-sm text-label-sm text-outline tracking-wider uppercase mb-space-md">Concurrency lab</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">Test atomic stock reservation under concurrent checkout load.</p>
          <Link href="/demo" className="inline-block py-space-sm px-space-md rounded-sm bg-primary text-on-primary font-label-sm text-label-sm transition-colors hover:bg-primary-container border border-transparent">
            Run concurrency lab
          </Link>
        </section>
      </div>
    </div>
  );
}
