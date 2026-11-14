'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

type Product = {
  id: number;
  product_id?: number;
  sku: string;
  name: string;
  description: string;
  category: string;
  price_paise: number;
  image_url: string | null;
  city?: string;
  score?: number;
};

const API = '/api';
const formatPrice = (paise: number) => `₹${(paise / 100).toFixed(2)}`;

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json();
}

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      getJson<string[]>(`${API}/categories`),
      getJson<string[]>(`${API}/cities`),
    ]).then(([allCategories, allCities]) => {
      setCategories(allCategories);
      setCities(allCities);
    }).catch(() => setError('Could not load store filters.'));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (city) params.set('city', city);
    const minPricePaise = minPrice === '' ? null : Math.round(Number(minPrice) * 100);
    const maxPricePaise = maxPrice === '' ? null : Math.round(Number(maxPrice) * 100);
    if (
      (minPricePaise !== null && !Number.isFinite(minPricePaise)) ||
      (maxPricePaise !== null && !Number.isFinite(maxPricePaise)) ||
      (minPricePaise !== null && minPricePaise < 0) ||
      (maxPricePaise !== null && maxPricePaise < 0)
    ) {
      setLoading(false);
      setError('Enter a valid non-negative price in rupees.');
      return;
    }
    if (minPricePaise !== null && maxPricePaise !== null && minPricePaise > maxPricePaise) {
      setLoading(false);
      setError('Minimum price cannot exceed maximum price.');
      return;
    }
    if (minPricePaise !== null) params.set('min_price', String(minPricePaise));
    if (maxPricePaise !== null) params.set('max_price', String(maxPricePaise));
    if (query.trim()) {
      params.set('q', query.trim());
    }
    const endpoint = query.trim() ? 'products/search' : 'products';
    setLoading(true);
    setError('');
    fetch(`${API}/${endpoint}?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        return response.json() as Promise<Product[]>;
      })
      .then((items) => setProducts(items))
      .catch((cause: unknown) => {
        if (cause instanceof Error && cause.name === 'AbortError') return;
        setError('Could not load products. Check that the API and services are running.');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [query, category, city, minPrice, maxPrice]);

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
      <div>
        <section className="mb-10 rounded-2xl bg-moss-solid px-7 py-10 text-white sm:px-12 sm:py-14">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-lime">The neighborhood store, reimagined</p>
          <h1 className="max-w-3xl text-4xl font-black leading-tight sm:text-6xl">Good things, close to home.</h1>
          <p className="mt-4 max-w-xl text-white/75">Search the live catalog and find what's actually in stock near you.</p>
        </section>

        <section aria-label="Product filters" className="mb-8 rounded-xl border border-ink/10 bg-surface p-4">
          <form onSubmit={onSearch} className="grid gap-3 md:grid-cols-6">
            <input
              className="rounded-lg border border-ink/15 px-4 py-3 md:col-span-2"
              type="search"
              placeholder={'Search products (try "bluetoth")'}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select className="rounded-lg border border-ink/15 px-3 py-3" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">All categories</option>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select className="rounded-lg border border-ink/15 px-3 py-3" value={city} onChange={(event) => setCity(event.target.value)}>
              <option value="">All cities</option>
              {cities.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <input aria-label="Minimum price in rupees" className="rounded-lg border border-ink/15 px-3 py-3" type="number" min="0" step="0.01" placeholder="Min price (₹)" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} />
            <input aria-label="Maximum price in rupees" className="rounded-lg border border-ink/15 px-3 py-3" type="number" min="0" step="0.01" placeholder="Max price (₹)" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} />
          </form>
        </section>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Shop the edit</h2>
          <span className="text-sm text-ink/60">{loading ? 'Loading...' : `${products.length} items`}</span>
        </div>
        {error && <p role="alert" className="mb-5 rounded-lg bg-danger-soft p-4 text-danger">{error}</p>}
        {!loading && !error && products.length === 0 && (
          <p className="mb-5 rounded-lg border border-ink/10 bg-surface p-8 text-center text-ink/60">
            No products match your filters. Try a broader search or <button onClick={() => { setQuery(''); setCategory(''); setCity(''); setMinPrice(''); setMaxPrice(''); }} className="underline text-moss hover:text-moss-solid">clear all filters</button>.
          </p>
        )}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <Link key={`${product.id}-${product.city || ''}`} href={`/product/${product.id}`} className="group overflow-hidden rounded-xl border border-ink/10 bg-surface">
              <div className="relative aspect-[4/3] bg-lime/35">
                {product.image_url ? (
                  <img src={product.image_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" loading="lazy" />
                ) : (
                  <svg className="absolute inset-0 w-full h-full text-lime/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 17" />
                  </svg>
                )}
              </div>
              <div className="p-4">
                <p className="text-xs font-medium text-moss">{product.category}</p>
                <h3 className="mt-1.5 text-base font-bold group-hover:text-moss transition-colors">{product.name}</h3>
                <p className="mt-1 line-clamp-2 min-h-10 text-sm text-ink/60">{product.description}</p>
                <p className="mt-3 font-bold">{formatPrice(product.price_paise)}</p>
                {product.city && <p className="mt-1 text-xs text-ink/50">Available in {product.city}</p>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
}
