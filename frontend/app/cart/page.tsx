'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type CartItem = { id: number; name: string; sku: string; price_paise: number; qty: number };
type City = { city: string; stock: number };

export default function CartPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const total = useMemo(() => cart.reduce((sum, item) => sum + item.price_paise * item.qty, 0), [cart]);

  useEffect(() => {
    try {
      setCart(JSON.parse(localStorage.getItem('pulsecart_cart') || '[]') as CartItem[]);
    } catch {
      localStorage.removeItem('pulsecart_cart');
      setNotice('Your saved cart could not be read and was cleared.');
    }
    fetch('/api/cities').then((response) => response.json() as Promise<string[]>).then(setCities).catch(() => setNotice('Could not load delivery cities.'));
  }, []);

  function updateCart(next: CartItem[]) {
    setCart(next);
    localStorage.setItem('pulsecart_cart', JSON.stringify(next));
  }

  async function checkout() {
    setNotice('');
    if (!cart.length || !email || !name || !city) {
      setNotice('Add items and fill in your email, name, and city.');
      return;
    }
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
      if (!response.ok) throw new Error(result.detail || 'Checkout failed');
      updateCart([]);
      setNotice(`Order #${result.order_id} placed. The event is queued for Kafka.`);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Checkout failed. Please retry.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-black">Your cart</h1>
      {!cart.length ? (
        <div className="mt-6 rounded-2xl border border-ink/10 bg-white p-8 text-center">
          <p className="text-ink/60">Your cart is waiting for something good.</p>
          <Link href="/" className="mt-4 inline-block font-bold text-moss underline">Browse the store</Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 md:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            {cart.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4 rounded-2xl border border-ink/10 bg-white p-4">
                <div><p className="font-bold">{item.name}</p><p className="text-sm text-ink/50">{item.sku}</p></div>
                <div className="flex items-center gap-3">
                  <input aria-label={`Quantity for ${item.name}`} type="number" min="1" max="50" value={item.qty} className="w-16 rounded-lg border px-2 py-1" onChange={(event) => {
                    const qty = Number(event.target.value);
                    updateCart(cart.map((line) => line.id === item.id ? { ...line, qty: Math.max(1, Math.min(50, qty || 1)) } : line));
                  }} />
                  <button className="text-sm text-red-700 underline" onClick={() => updateCart(cart.filter((line) => line.id !== item.id))}>Remove</button>
                </div>
              </div>
            ))}
          </div>
          <aside className="h-fit space-y-4 rounded-2xl border border-ink/10 bg-white p-5">
            <h2 className="text-lg font-bold">Checkout</h2>
            <p className="flex justify-between"><span>Total</span><strong>₹{(total / 100).toFixed(2)}</strong></p>
            <input className="w-full rounded-xl border px-3 py-2" type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
            <input className="w-full rounded-xl border px-3 py-2" placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
            <select className="w-full rounded-xl border px-3 py-2" value={city} onChange={(event) => setCity(event.target.value)}>
              <option value="">Choose delivery city</option>
              {cities.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <button disabled={busy} onClick={checkout} className="w-full rounded-xl bg-moss px-4 py-3 font-bold text-white disabled:opacity-50">{busy ? 'Placing order…' : 'Place order'}</button>
          </aside>
        </div>
      )}
      {notice && <p role="status" className="mt-5 rounded-xl bg-white p-4">{notice}</p>}
    </div>
  );
}
