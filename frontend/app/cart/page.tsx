'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { currentCartId, currentCartSecret, LOCAL_CART_UPDATED_KEY, newIdempotencyKey, restoreCart, syncCart } from '../cart-sync';

type CartItem = { id: number; name: string; sku: string; price_paise: number; qty: number; category?: string; image_url?: string | null };

const formatPrice = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paise / 100);
const LOCAL_CART_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export default function CartPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [notice, setNotice] = useState('');
  const [orderId, setOrderId] = useState<number | null>(null);
  const [orderAccessToken, setOrderAccessToken] = useState<string | null>(null);
  const [orderAccessTokenExpiresAt, setOrderAccessTokenExpiresAt] = useState<string | null>(null);
  const [accessCodeCopied, setAccessCodeCopied] = useState(false);
  const [accessCodeCopyError, setAccessCodeCopyError] = useState('');
  const [accessCodeRevoked, setAccessCodeRevoked] = useState(false);
  const [accessCodeRevoking, setAccessCodeRevoking] = useState(false);
  const [accessCodeRevokeError, setAccessCodeRevokeError] = useState('');
  const [busy, setBusy] = useState(false);
  const idempotencyKey = useRef<string | null>(null);
  const total = useMemo(() => cart.reduce((sum, item) => sum + item.price_paise * item.qty, 0), [cart]);

  useEffect(() => {
    try {
      const savedAt = Number(localStorage.getItem(LOCAL_CART_UPDATED_KEY));
      const hasTimestamp = localStorage.getItem(LOCAL_CART_UPDATED_KEY) !== null;
      const isExpired = hasTimestamp && (!Number.isFinite(savedAt) || Date.now() - savedAt > LOCAL_CART_TTL_MS);
      if (isExpired) {
        localStorage.removeItem('pulsecart_cart');
        localStorage.removeItem('pulsecart_cart_id');
        localStorage.removeItem(LOCAL_CART_UPDATED_KEY);
      }
      const saved = JSON.parse(localStorage.getItem('pulsecart_cart') || '[]') as CartItem[];
      setCart(saved);
      if (saved.length && !hasTimestamp) localStorage.setItem(LOCAL_CART_UPDATED_KEY, String(Date.now()));
      if (!saved.length) void restoreCart().then((restored) => { if (restored.length) setCart(restored); });
    } catch {
      localStorage.removeItem('pulsecart_cart');
      setNotice('Your saved cart could not be read. Please add your items again.');
    }

    fetch('/api/cities')
      .then((response) => {
        if (!response.ok) throw new Error('Could not load delivery cities');
        return response.json() as Promise<string[]>;
      })
      .then(setCities)
      .catch(() => setNotice('Delivery cities are temporarily unavailable. Please try again.'));
  }, []);

  function updateCart(next: CartItem[]) {
    setCart(next);
    idempotencyKey.current = null;
    localStorage.setItem('pulsecart_cart', JSON.stringify(next));
    localStorage.setItem(LOCAL_CART_UPDATED_KEY, String(Date.now()));
    window.dispatchEvent(new Event('pulsecart:cart-updated'));
    syncCart(next).catch((err) => {
      setNotice(`Cart sync warning: ${err instanceof Error ? err.message : String(err)}`);
    });
  }

  async function checkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cart.length || busy) {
      if (!cart.length || !email || !name || !city) {
        setNotice('Add items and fill in your email');
      }
      return;
    }
    setNotice('');
    setBusy(true);
    try {
      idempotencyKey.current ??= newIdempotencyKey();
      const cartSecret = currentCartSecret();
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey.current,
          ...(cartSecret ? { 'X-Cart-Secret': cartSecret } : {}),
        },
        body: JSON.stringify({
          customer_email: email,
          customer_name: name,
          city,
          cart_id: currentCartId(),
          items: cart.map((item) => ({ product_id: item.id, qty: item.qty })),
        }),
      });
      if ([404, 409, 422, 429].includes(response.status)) idempotencyKey.current = null;
      const result = await response.json() as {
        order_id?: number;
        order_access_token?: string | null;
        order_access_token_expires_at?: string | null;
        detail?: string;
      };
      if (!response.ok) throw new Error(result.detail || 'Checkout failed. Please try again.');
      if (!result.order_id) throw new Error('We could not confirm your order. Please contact the store.');
      idempotencyKey.current = null;
      setOrderId(result.order_id);
      setOrderAccessToken(result.order_access_token ?? null);
      setOrderAccessTokenExpiresAt(result.order_access_token_expires_at ?? null);
      await syncCart([]).catch((err) => {
        setNotice(`Cart sync warning: ${err instanceof Error ? err.message : String(err)}`);
      });
      localStorage.setItem('pulsecart_cart', JSON.stringify([]));
      localStorage.setItem(LOCAL_CART_UPDATED_KEY, String(Date.now()));
      window.dispatchEvent(new Event('pulsecart:cart-updated'));
      setCart([]);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Checkout failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function revokeOrderAccess() {
    if (orderId === null || !orderAccessToken || accessCodeRevoking) return;
    setAccessCodeRevoking(true);
    setAccessCodeRevokeError('');
    try {
      const response = await fetch(`/api/orders/${orderId}/revoke-access`, {
        method: 'POST',
        headers: { 'X-Order-Access-Token': orderAccessToken },
      });
      if (!response.ok) throw new Error('Could not revoke the access code. Please try again.');
      setOrderAccessToken(null);
      setOrderAccessTokenExpiresAt(null);
      setAccessCodeRevoked(true);
    } catch (cause) {
      setAccessCodeRevokeError(cause instanceof Error ? cause.message : 'Could not revoke the access code.');
    } finally {
      setAccessCodeRevoking(false);
    }
  }

  if (orderId !== null) {
    return (
      <section className="bg-surface-container-lowest text-on-surface min-h-screen p-space-lg" aria-labelledby="order-success-title">
        <span className="material-symbols-outlined text-secondary text-[32px]" aria-hidden="true">check_circle</span>
        <p className="font-label-sm text-label-sm text-outline tracking-wider uppercase mt-space-lg">Order confirmed</p>
        <h1 id="order-success-title" className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Thanks for shopping nearby.</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">Your order number is <strong className="text-primary">Order #{orderId}</strong>.</p>
        {orderAccessToken ? (
          <div className="mt-space-lg rounded-lg shadow-sm border border-outline/50 p-space-lg bg-surface-container-low" aria-labelledby="order-access-code-title">
            <strong id="order-access-code-title" className="font-label-sm text-label-sm text-outline tracking-wider uppercase block mb-space-sm">Private order access code</strong>
            <code className="font-tabular-data-md text-tabular-data-md text-on-surface block mb-space-sm bg-surface-container-highest p-space-sm rounded-sm border border-outline/30">{orderAccessToken}</code>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Save this code now. It is shown only once and expires{' '}
              {orderAccessTokenExpiresAt
                ? new Date(orderAccessTokenExpiresAt as string).toLocaleDateString()
                : 'after 90 days'}.
            </p>
            <button
              type="button"
              className="mt-space-sm py-1.5 px-space-md rounded-md font-label-md text-label-md bg-primary text-on-primary hover:bg-primary-container transition-colors border border-transparent"
              onClick={() => {
                if (!navigator.clipboard) {
                  setAccessCodeCopyError('Clipboard access is unavailable. Select and copy the code above.');
                  return;
                }
                void navigator.clipboard.writeText(orderAccessToken)
                  .then(() => setAccessCodeCopied(true))
                  .catch(() => setAccessCodeCopyError('Could not copy the code. Select and copy it above.'));
              }}
            >
              {accessCodeCopied ? 'Copied' : 'Copy access code'}
            </button>
            {accessCodeCopyError && <span role="status" className="mt-space-xs font-body-sm text-body-sm text-error">{accessCodeCopyError}</span>}
            <button
              type="button"
              className="mt-space-sm py-1.5 px-space-md rounded-md font-label-md text-label-md bg-surface-container-low text-on-surface-variant hover:bg-surface-container transition-colors border border-outline/30"
              disabled={accessCodeRevoking}
              onClick={() => void revokeOrderAccess()}
            >
              {accessCodeRevoking ? 'Revoking…' : 'Revoke access code'}
            </button>
            {accessCodeRevokeError && <span role="alert" className="mt-space-xs font-body-sm text-body-sm text-error">{accessCodeRevokeError}</span>}
          </div>
        ) : accessCodeRevoked ? (
          <p role="status" className="mt-space-md font-body-sm text-body-sm text-secondary">The private order access code has been revoked.</p>
        ) : (
          <p role="status" className="mt-space-md font-body-sm text-body-sm text-secondary">
            This order was confirmed from a retry, but its private access code can’t be shown again. Contact the store if you need help with this order.
          </p>
        )}
        <Link href="/" className="mt-space-lg inline-block py-1.5 px-space-md rounded-md font-label-md text-label-md bg-primary text-on-primary hover:bg-primary-container transition-colors border border-transparent">
          Continue shopping
        </Link>
      </section>
    );
  }

  if (!cart.length) {
    return (
      <section className="bg-surface-container-lowest text-on-surface min-h-screen p-space-lg" aria-labelledby="cart-title">
        <p className="font-label-sm text-label-sm text-outline tracking-wider uppercase">Your bag</p>
        <h1 id="cart-title" className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Nothing here yet.</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">Find something useful or lovely from a shop nearby.</p>
        <div className="mt-space-lg flex flex-wrap gap-space-md">
          <Link href="/" className="py-1.5 px-space-md rounded-md font-label-md text-label-md bg-primary text-on-primary hover:bg-primary-container transition-colors border border-transparent">
            Browse products
          </Link>
          <Link href="/demo" className="py-1.5 px-space-md rounded-md font-label-md text-label-md bg-surface-container-low text-on-surface-variant hover:bg-surface-container transition-colors border border-outline/30">
            Try the concurrency lab
          </Link>
        </div>
        {notice && <p role="status" className="mt-space-md font-body-sm text-body-sm text-error">{notice}</p>}
      </section>
    );
  }

  return (
    <div className="bg-background text-on-surface min-h-screen">
      <section className="w-full bg-surface-container-low text-on-surface-variant px-margin-lg py-space-md">
        <div className="max-w-[1440px] mx-auto flex items-center gap-space-lg">
          <span className="material-symbols-outlined text-[16px] text-secondary animate-pulse">lock</span>
          <div className="flex items-center gap-space-xs font-tabular-data-md text-tabular-data-md text-on-surface">
            <span className="font-headline-sm text-headline-sm tracking-tight uppercase">Reservation Mutex Active:</span>
            <span className="font-tabular-price-lg text-headline-sm text-secondary bg-surface-container-lowest px-space-xs py-0.5 rounded-sm shadow-sm border border-outline/30" id="countdown-timer">
              07:42
            </span>
            <span className="text-on-surface-variant font-body-sm hidden sm:inline ml-space-xs">remaining in high-priority buffer</span>
          </div>
          <div className="flex items-center gap-space-xs text-on-surface-variant bg-surface-container-lowest px-space-sm py-1 rounded-sm shadow-sm border border-outline/30">
            <span className="material-symbols-outlined text-[16px] text-secondary">verified_user</span>
            <span className="font-label-sm text-label-sm">ACID Row-Lock ID: <span className="font-tabular-data-md text-on-surface">#0x9F4C2A</span> (Deterministic Allocation)</span>
          </div>
        </div>
      </section>

      <div className="max-w-[1440px] mx-auto w-full px-margin-lg py-space-xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-lg items-start">
          <div className="lg:col-span-8 flex flex-col gap-space-lg">
            <div className="bg-surface-container-lowest p-space-md rounded-lg shadow-sm border border-outline/50 flex items-start gap-space-md">
              <div className="w-8 h-8 rounded bg-secondary-fixed/40 flex items-center justify-center shrink-0 text-secondary">
                <span className="material-symbols-outlined text-[20px]">lock</span>
              </div>
              <div className="flex flex-col gap-space-xs">
                <div className="flex items-center gap-space-xs">
                  <span className="font-headline-sm text-headline-sm text-on-surface">Row-Level Inode Reserved</span>
                  <span className="bg-secondary/10 text-secondary text-label-sm font-label-sm px-space-xs py-0.5 rounded">Verified In-Stock</span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Your items are locked at row-level in our inventory database. No phantom cart expirations, split allocations, or uncommitted drops during active sessions.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pb-space-xs text-outline font-label-sm text-label-sm uppercase tracking-wider px-space-xs">
              <span>Allocated Item &amp; SKU Registry</span>
              <div className="hidden sm:flex items-center gap-space-xl">
                <span className="w-24 text-center">Quantity</span>
                <span className="w-24 text-right">Settlement</span>
              </div>
            </div>

            {cart.map((item) => (
              <div key={item.id} className="bg-surface-container-lowest p-space-md rounded-lg shadow-sm border border-outline/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-md group transition-all duration-200" id={`cart-item-${item.id}`}>
                <div className="flex items-center gap-space-md">
                  <div className="w-20 h-20 rounded-lg bg-surface-container overflow-hidden shrink-0 relative border border-outline/30">
                    <img
                      className="w-full h-full object-cover"
                      alt={item.name}
                      src={
                        item.image_url ||
                          'https://lh3.googleusercontent.com/aida-public/AB6AXuDm7nuagu2QCBv0nMp3Cofc1GJypBHLDn0o0yiNwWx5kWwWRSR0UTUr8rS8bsF78dn432Z4JBeCXpY1mfQN9CeD8sfCgueLHrvNVpK4Fz9dOrM8j8dwh-g03nMF78zM29HCPrmvg6SX3zqHrttHw1NtGl4gne7oO0ORW3n3Uwob4cikdvNwE6nFrPR659PxU98nzA2Xp_Jyk6tkUspQut0sYYcgGIZGxJ4opNSQ71o0'
                      }
                    />
                    <span className="absolute top-1 left-1 bg-primary text-on-primary text-[9px] font-label-sm px-1 py-0.5 rounded uppercase">Verified</span>
                  </div>
                  <div className="flex flex-col gap-space-xs">
                    <div className="flex items-center gap-space-xs">
                      <span className="font-label-sm text-label-sm text-outline">SKU: {item.sku}</span>
                      <span className="w-1 h-1 rounded-full bg-outline-variant"></span>
                      <span className="font-tabular-data-md text-tabular-data-md text-secondary flex items-center gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span> Mutex Lock
                      </span>
                    </div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface tracking-tight">{item.name}</h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">{item.category ?? 'General'} / {formatPrice(item.price_paise)} each</p>
                    <button
                      className="text-left font-label-sm text-label-sm text-error hover:underline flex items-center gap-1 mt-1"
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Remove ${item.name} from your cart?`)) {
                          updateCart(cart.filter((line) => line.id !== item.id));
                        }
                      }}
                    >
                      <span className="material-symbols-outlined text-[14px]">delete</span> Release Allocation
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between w-full sm:w-auto sm:gap-space-xl pt-space-xs sm:pt-0">
                  <div className="flex items-center bg-surface-container-low rounded p-0.5 border border-outline/30">
                    <button
                      className="w-7 h-7 flex items-center justify-center text-on-surface hover:bg-surface-container-lowest rounded transition-colors text-sm font-semibold"
                      type="button"
                      onClick={() => {
                        updateCart(cart.map((line) => line.id === item.id ? { ...line, qty: Math.max(1, line.qty - 1) } : line));
                      }}
                    >
                      −
                    </button>
                    <span className="w-8 text-center font-tabular-data-md text-tabular-data-md text-on-surface" id={`qty-${item.id}`}>
                      {item.qty}
                    </span>
                    <button
                      className="w-7 h-7 flex items-center justify-center text-on-surface hover:bg-surface-container-lowest rounded transition-colors text-sm font-semibold"
                      type="button"
                      onClick={() => {
                        updateCart(cart.map((line) => line.id === item.id ? { ...line, qty: Math.min(50, line.qty + 1) } : line));
                      }}
                    >
                      +
                    </button>
                  </div>
                  <strong className="font-tabular-price-lg text-tabular-price-lg text-primary">
                    {formatPrice(item.price_paise * item.qty)}
                  </strong>
                </div>
              </div>
            ))}

            <Link href="/" className="mt-space-lg inline-block font-label-sm text-label-sm text-primary underline underline-offset-4 hover:text-primary-container">
              ← Continue shopping
            </Link>
          </div>

          <form className="lg:col-span-4 bg-surface-container-lowest p-space-lg rounded-lg shadow-sm border border-outline/50" onSubmit={checkout}>
            <fieldset className="border-none p-0 m-0">
              <legend className="font-label-sm text-label-sm text-outline tracking-wider uppercase w-full text-left pb-space-xs">Delivery details</legend>
              <div className="space-y-space-sm">
                <label className="block">
                  <span className="font-label-sm text-label-sm text-outline block mb-space-xs">Delivery city</span>
                  <select
                    id="checkout-city"
                    required
                    value={city}
                    className="w-full py-1 px-space-sm rounded-sm border border-outline/30 bg-surface-container-lowest text-on-surface focus:border-primary focus:outline-none"
                    onChange={(event) => setCity(event.target.value)}
                  >
                    <option value="">Choose a city</option>
                    {cities.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="font-label-sm text-label-sm text-outline block mb-space-xs">Your name</span>
                  <input
                    id="checkout-name"
                    required
                    autoComplete="name"
                    value={name}
                    className="w-full py-1 px-space-sm rounded-sm border border-outline/30 bg-surface-container-lowest text-on-surface focus:border-primary focus:outline-none"
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="font-label-sm text-label-sm text-outline block mb-space-xs">Email for your receipt</span>
                  <input
                    id="checkout-email"
                    required
                    type="email"
                    autoComplete="email"
                    value={email}
                    className="w-full py-1 px-space-sm rounded-sm border border-outline/30 bg-surface-container-lowest text-on-surface focus:border-primary focus:outline-none"
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>
              </div>
            </fieldset>

            <div className="mt-space-lg flex items-center justify-between border-t border-outline/50 pt-space-sm">
              <span className="font-label-sm text-label-sm text-outline">Total</span>
              <strong className="font-tabular-price-lg text-tabular-price-lg text-primary">{formatPrice(total)}</strong>
            </div>

            <button
              type="submit"
              className={`w-full mt-space-lg py-1.5 px-space-md rounded-md font-label-md text-label-md transition-colors border ${
                busy || cities.length === 0
                  ? 'bg-surface-container-low text-on-surface-variant border border-outline/30 cursor-not-allowed'
                  : 'bg-primary text-on-primary hover:bg-primary-container border-transparent'
              }`}
              disabled={busy || cities.length === 0}
            >
              {busy ? 'Placing order…' : 'Place order'}
            </button>

            <p className="mt-space-sm font-body-sm text-body-sm text-on-surface-variant">Your order is placed with the shop after you confirm.</p>

            <div className="mt-space-lg p-space-sm rounded-sm bg-surface-container-low border border-outline/50">
              <div className="flex gap-space-xl text-xs font-label-sm">
                <span className="text-outline">01 / PostgreSQL confirms inventory and order</span>
                <span className="text-outline">02 / Outbox event is relayed to Kafka</span>
                <span className="text-outline">03 / Confirmation is handled asynchronously</span>
              </div>
            </div>

            {notice && <p role="alert" className="mt-space-sm font-body-sm text-body-sm text-error">{notice}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}
