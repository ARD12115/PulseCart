'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type Product = { id: number; sku: string; name: string; description: string; category: string; price_paise: number };
type CartItem = Product & { qty: number };
type Inventory = { product_id: number; city: string; stock: number }[];

export default function ProductPage() {
  const params = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [inventory, setInventory] = useState<Inventory>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    Promise.all([
      fetch(`/api/products/${params.id}`).then((res) => {
        if (!res.ok) throw new Error('Product not found');
        return res.json() as Promise<Product>;
      }),
      fetch(`/api/products/${params.id}/inventory`).then((res) => {
        if (!res.ok) throw new Error('Could not load inventory');
        return res.json() as Promise<Inventory>;
      }),
    ]).then(([item, stock]) => {
      setProduct(item);
      setInventory(stock);
    }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Request failed'));
  }, [params.id]);

  function addToCart() {
    if (!product) return;
    const saved: CartItem[] = JSON.parse(localStorage.getItem('pulsecart_cart') || '[]');
    const existing = saved.find((item) => item.id === product.id);
    if (existing) existing.qty += 1;
    else saved.push({ ...product, qty: 1 });
    localStorage.setItem('pulsecart_cart', JSON.stringify(saved));
    setMessage('Added to your cart.');
  }

  if (error) return <div role="alert" className="rounded-xl bg-danger-soft p-5 text-danger">{error}</div>;
  if (!product) return <p>Loading product…</p>;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/" className="text-sm font-semibold text-moss hover:underline">← Back to shop</Link>
      <div className="mt-5 grid gap-8 rounded-3xl border border-ink/10 bg-surface p-6 sm:grid-cols-2 sm:p-9">
        <div className="flex min-h-72 items-center justify-center rounded-2xl bg-lime/35 text-8xl" aria-hidden="true">✳</div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-moss">{product.category}</p>
          <h1 className="mt-3 text-3xl font-black">{product.name}</h1>
          <p className="mt-3 text-ink/65">{product.description}</p>
          <p className="mt-6 text-2xl font-bold">₹{(product.price_paise / 100).toFixed(2)}</p>
          <h2 className="mt-7 font-bold">Availability by city</h2>
          <ul className="mt-2 space-y-2">
            {inventory.map((item) => (
              <li key={item.city} className="flex justify-between rounded-lg bg-paper px-3 py-2 text-sm">
                <span>{item.city}</span>
                <span className={item.stock > 0 ? 'font-semibold text-moss' : 'text-danger'}>
                  {item.stock > 0 ? `${item.stock} in stock` : 'Out of stock'}
                </span>
              </li>
            ))}
          </ul>
          <button onClick={addToCart} className="mt-6 w-full rounded-xl bg-moss-solid px-5 py-3 font-bold text-white hover:brightness-90">Add to cart</button>
          {message && <p role="status" className="mt-3 text-sm text-moss">{message} <Link href="/cart" className="underline">View cart</Link></p>}
        </div>
      </div>
    </div>
  );
}
