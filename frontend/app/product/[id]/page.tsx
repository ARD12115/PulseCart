'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ProductArtwork from '../../product-artwork';
import { syncCart } from '../../cart-sync';

type Product = { id: number; sku: string; name: string; description: string; category: string; price_paise: number; image_url: string | null };
type CartItem = Product & { qty: number };
type Inventory = { product_id: number; city: string; stock: number }[];

const formatPrice = (paise: number) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
}).format(paise / 100);

export default function ProductPage() {
  const params = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [inventory, setInventory] = useState<Inventory>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch(`/api/products/${params.id}`).then((response) => {
        if (!response.ok) throw new Error('This product could not be found.');
        return response.json() as Promise<Product>;
      }),
      fetch(`/api/products/${params.id}/inventory`).then((response) => {
        if (!response.ok) throw new Error('Stock information is temporarily unavailable.');
        return response.json() as Promise<Inventory>;
      }),
    ]).then(([item, stock]) => {
      setProduct(item);
      setInventory(stock);
    }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Please try again.'));
  }, [params.id]);

  function addToCart() {
    if (!product) return;
    try {
      const saved = JSON.parse(localStorage.getItem('pulsecart_cart') || '[]') as CartItem[];
      const existing = saved.find((item) => item.id === product.id);
      if (existing) existing.qty += 1;
      else saved.push({ ...product, qty: 1 });
      localStorage.setItem('pulsecart_cart', JSON.stringify(saved));
      window.dispatchEvent(new Event('pulsecart:cart-updated'));
      void syncCart(saved);
      setMessage('Added to your cart.');
    } catch {
      setMessage('We could not save this item. Please try again.');
    }
  }

  if (error) {
    return (
      <div className="detail-page">
        <Link href="/#shop" className="back-to-shop">← Back to products</Link>
        <p role="alert" className="store-error">{error}</p>
      </div>
    );
  }
  if (!product) return <p className="detail-loading">Loading product…</p>;

  const available = inventory.some((item) => item.stock > 0);

  return (
    <div className="detail-page">
      <Link href="/#shop" className="back-to-shop">← All products</Link>
      <div className="detail-layout">
        <div className="detail-art">
          <ProductArtwork category={product.category} imageUrl={product.image_url} name={product.name} hero />
        </div>
        <section className="detail-copy" aria-labelledby="product-title">
          <p className="eyebrow">{product.category}</p>
          <h1 id="product-title">{product.name}</h1>
          <p className="detail-description">{product.description}</p>
          <p className="detail-price">{formatPrice(product.price_paise)}</p>

          <div className="availability-card">
            <h2>Delivery availability</h2>
            <p>Choose a city in your cart to check out.</p>
            <ul>
              {inventory.map((item) => (
                <li key={item.city}>
                  <span>{item.city}</span>
                  <span className={item.stock > 0 ? 'stock-available' : 'stock-unavailable'}>
                    {item.stock > 0 ? 'in stock' : 'Out of stock'}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <button className="add-to-cart-button" onClick={addToCart} disabled={!available}>
            {available ? 'Add to cart' : 'Currently unavailable'}
          </button>
          {message && (
            <p role="status" className="cart-confirmation">
              {message} {message.startsWith('Added') && <Link href="/cart">Go to cart</Link>}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
