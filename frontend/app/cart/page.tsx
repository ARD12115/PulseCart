'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { currentCartId, LOCAL_CART_UPDATED_KEY, newIdempotencyKey, restoreCart, syncCart } from '../cart-sync';
import ProductArtwork from '../product-artwork';

type CartItem = { id: number; name: string; sku: string; price_paise: number; qty: number; category?: string; image_url?: string | null };

const formatPrice = (paise: number) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
}).format(paise / 100);
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
  // One key per order attempt: a retry after a lost response returns the same order instead of a duplicate.
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
    idempotencyKey.current = null; // the order changed, so the next attempt is a new order
    localStorage.setItem('pulsecart_cart', JSON.stringify(next));
    localStorage.setItem(LOCAL_CART_UPDATED_KEY, String(Date.now()));
    window.dispatchEvent(new Event('pulsecart:cart-updated'));
    void syncCart(next);
  }

  async function checkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cart.length || busy) return;
    setNotice('');
    setBusy(true);
    try {
      idempotencyKey.current ??= newIdempotencyKey();
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey.current },
        body: JSON.stringify({
          customer_email: email,
          customer_name: name,
          city,
          cart_id: currentCartId(),
          items: cart.map((item) => ({ product_id: item.id, qty: item.qty })),
        }),
      });
      // Keep the key after a network error or a 5xx (the order may exist); drop it
      // after a definite client error or once a successful response is validated.
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
      updateCart([]);
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
      <section className="order-success" aria-labelledby="order-success-title">
        <span className="success-mark" aria-hidden="true">✓</span>
        <p className="eyebrow">Order confirmed</p>
        <h1 id="order-success-title">Thanks for shopping nearby.</h1>
        <p>Your order number is <strong>Order #{orderId}</strong>.</p>
        {orderAccessToken ? (
          <div className="order-access-code" aria-labelledby="order-access-code-title">
            <strong id="order-access-code-title">Private order access code</strong>
            <code>{orderAccessToken}</code>
            <p>
              Save this code now. It is shown only once and expires{' '}
              {orderAccessTokenExpiresAt
                ? new Date(orderAccessTokenExpiresAt).toLocaleDateString()
                : 'after 90 days'}.
            </p>
            <button
              type="button"
              className="button-dark"
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
            {accessCodeCopyError && <span role="status">{accessCodeCopyError}</span>}
            <button
              type="button"
              className="order-revoke-button"
              disabled={accessCodeRevoking}
              onClick={() => void revokeOrderAccess()}
            >
              {accessCodeRevoking ? 'Revoking…' : 'Revoke access code'}
            </button>
            {accessCodeRevokeError && <span role="alert">{accessCodeRevokeError}</span>}
          </div>
        ) : accessCodeRevoked ? (
          <p role="status">The private order access code has been revoked.</p>
        ) : (
          <p role="status">
            This order was confirmed from a retry, but its private access code can’t be shown again.
            Contact the store if you need help with this order.
          </p>
        )}
        <Link href="/#shop" className="button-dark">Continue shopping <span aria-hidden="true">↗</span></Link>
      </section>
    );
  }

  if (!cart.length) {
    return (
      <section className="empty-cart" aria-labelledby="cart-title">
        <p className="eyebrow">Your bag</p>
        <h1 id="cart-title">Nothing here yet.</h1>
        <p>Find something useful or lovely from a shop nearby.</p>
        <Link href="/#shop" className="button-dark">Browse products <span aria-hidden="true">↗</span></Link>
        {notice && <p role="status" className="cart-notice">{notice}</p>}
      </section>
    );
  }

  return (
    <div className="cart-page">
      <div className="cart-hud"><span>LIVE CART / CHECKOUT</span><span>INVENTORY IS VERIFIED WHEN YOU PLACE THE ORDER</span></div>
      <div className="cart-heading">
        <div><p className="eyebrow">Your bag</p><h1>Review and check out.</h1></div>
        <span>{cart.reduce((count, item) => count + item.qty, 0)} items</span>
      </div>

      <div className="cart-layout">
        <section className="cart-items" aria-label="Items in your cart">
          {cart.map((item) => (
            <article key={item.id} className="cart-item">
              <span className="cart-item-sku">SKU / {item.sku}</span>
              <div className="cart-thumb"><ProductArtwork category={item.category ?? 'home'} imageUrl={item.image_url} name={item.name} /></div>
              <div className="cart-item-copy">
                <h2>{item.name}</h2>
                <p>{formatPrice(item.price_paise)} each</p>
              </div>
              <label className="quantity-control">
                <span>Qty</span>
                <input
                  aria-label={`Quantity for ${item.name}`}
                  type="number"
                  min="1"
                  max="50"
                  value={item.qty}
                  onChange={(event) => {
                    const quantity = Number(event.target.value);
                    updateCart(cart.map((line) => line.id === item.id
                      ? { ...line, qty: Math.max(1, Math.min(50, quantity || 1)) }
                      : line));
                  }}
                />
              </label>
              <strong className="cart-line-total">{formatPrice(item.price_paise * item.qty)}</strong>
              <button type="button" className="remove-item" onClick={() => updateCart(cart.filter((line) => line.id !== item.id))}>
                Remove <span className="sr-only">{item.name}</span>
              </button>
            </article>
          ))}
          <Link href="/#shop" className="continue-shopping">← Continue shopping</Link>
        </section>

        <form className="checkout-card" onSubmit={checkout}>
          <h2>Delivery details</h2>
          <label>
            <span>Delivery city</span>
            <select required value={city} onChange={(event) => setCity(event.target.value)}>
              <option value="">Choose a city</option>
              {cities.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span>Your name</span>
            <input required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            <span>Email for your receipt</span>
            <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <div className="checkout-total"><span>Total</span><strong>{formatPrice(total)}</strong></div>
          <button type="submit" className="place-order-button" disabled={busy || cities.length === 0}>
            {busy ? 'Placing order…' : 'Place order'} <span aria-hidden="true">↗</span>
          </button>
          <p className="checkout-note">Your order is placed with the shop after you confirm.</p>
          <div className="checkout-flow" aria-label="Order processing information">
            <span>01 / PostgreSQL confirms inventory and order</span>
            <span>02 / Outbox event is relayed to Kafka</span>
            <span>03 / Confirmation is handled asynchronously</span>
          </div>
          {notice && <p role="alert" className="cart-notice">{notice}</p>}
        </form>
      </div>
    </div>
  );
}
