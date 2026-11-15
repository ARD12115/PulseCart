'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';

type CartItem = { id: number; name: string; sku: string; price_paise: number; qty: number };

const formatPrice = (paise: number) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
}).format(paise / 100);

export default function CartPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [notice, setNotice] = useState('');
  const [orderId, setOrderId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const total = useMemo(() => cart.reduce((sum, item) => sum + item.price_paise * item.qty, 0), [cart]);

  useEffect(() => {
    try {
      setCart(JSON.parse(localStorage.getItem('pulsecart_cart') || '[]') as CartItem[]);
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
    localStorage.setItem('pulsecart_cart', JSON.stringify(next));
    window.dispatchEvent(new Event('pulsecart:cart-updated'));
  }

  async function checkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cart.length || busy) return;
    setNotice('');
    setBusy(true);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_email: email,
          customer_name: name,
          city,
          items: cart.map((item) => ({ product_id: item.id, qty: item.qty })),
        }),
      });
      const result = await response.json() as { order_id?: number; detail?: string };
      if (!response.ok) throw new Error(result.detail || 'Checkout failed. Please try again.');
      if (!result.order_id) throw new Error('We could not confirm your order. Please contact the store.');
      setOrderId(result.order_id);
      updateCart([]);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Checkout failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (orderId !== null) {
    return (
      <section className="order-success" aria-labelledby="order-success-title">
        <span className="success-mark" aria-hidden="true">✓</span>
        <p className="eyebrow">Order confirmed</p>
        <h1 id="order-success-title">Thanks for shopping nearby.</h1>
        <p>Your order number is <strong>#{orderId}</strong>.</p>
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
      <div className="cart-heading">
        <div><p className="eyebrow">Your bag</p><h1>Review and check out.</h1></div>
        <span>{cart.reduce((count, item) => count + item.qty, 0)} items</span>
      </div>

      <div className="cart-layout">
        <section className="cart-items" aria-label="Items in your cart">
          {cart.map((item) => (
            <article key={item.id} className="cart-item">
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
          {notice && <p role="alert" className="cart-notice">{notice}</p>}
        </form>
      </div>
    </div>
  );
}
