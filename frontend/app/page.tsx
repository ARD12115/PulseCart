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
    if (minPrice) params.set('min_price', minPrice);
    if (maxPrice) params.set('max_price', maxPrice);
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
      <section className="mb-10 rounded-3xl bg-moss px-7 py-10 text-white sm:px-12 sm:py-14">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-lime">The neighborhood store, reimagined</p>
        <h1 className="max-w-3xl text-4xl font-black leading-tight sm:text-6xl">Good things, close to home.</h1>
        <p className="mt-4 max-w-xl text-white/75">Search the live catalog and find what’s actually in stock near you.</p>
      </section>

      <section aria-label="Product filters" className="mb-8 rounded-2xl border border-ink/10 bg-white p-4">
        <form onSubmit={onSearch} className="grid gap-3 md:grid-cols-6">
          <input
            className="rounded-xl border border-ink/15 px-4 py-3 md:col-span-2"
            type="search"
            placeholder="Search products (try “bluetoth”)"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select className="rounded-xl border border-ink/15 px-3 py-3" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All categories</option>
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select className="rounded-xl border border-ink/15 px-3 py-3" value={city} onChange={(event) => setCity(event.target.value)}>
            <option value="">All cities</option>
            {cities.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <input className="rounded-xl border border-ink/15 px-3 py-3" type="number" min="0" placeholder="Min paise" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} />
          <input className="rounded-xl border border-ink/15 px-3 py-3" type="number" min="0" placeholder="Max paise" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} />
        </form>
      </section>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Shop the edit</h2>
        <span className="text-sm text-ink/60">{loading ? 'Loading…' : `${products.length} items`}</span>
      </div>
      {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
      {!loading && !error && products.length === 0 && <p className="rounded-xl border border-ink/10 bg-white p-8 text-center text-ink/60">No matching products found.</p>}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((product) => (
          <Link key={`${product.id}-${product.city || ''}`} href={`/product/${product.id}`} className="group overflow-hidden rounded-2xl border border-ink/10 bg-white transition hover:-translate-y-1 hover:shadow-lg">
            <div className="flex aspect-[4/3] items-center justify-center bg-lime/35 text-5xl" aria-hidden="true">✳</div>
            <div className="p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-moss">{product.category}</p>
              <h3 className="mt-2 text-lg font-bold group-hover:text-moss">{product.name}</h3>
              <p className="mt-1 line-clamp-2 min-h-10 text-sm text-ink/60">{product.description}</p>
              <p className="mt-4 font-bold">{formatPrice(product.price_paise)}</p>
              {product.city && <p className="mt-1 text-xs text-ink/50">Available in {product.city}</p>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
