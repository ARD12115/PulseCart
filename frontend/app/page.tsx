'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

type Product = {
  id: number;
  sku: string;
  name: string;
  description: string;
  category: string;
  price_paise: number;
  image_url: string | null;
  city?: string;
};

const formatPrice = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
    paise / 100
  );

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
  const [searchRequest, setSearchRequest] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch('/api/categories').then((response) => {
        if (!response.ok) throw new Error('Could not load categories');
        return response.json() as Promise<string[]>;
      }),
      fetch('/api/cities').then((response) => {
        if (!response.ok) throw new Error('Could not load cities');
        return response.json() as Promise<string[]>;
      }),
    ])
      .then(([allCategories, allCities]) => {
        setCategories(allCategories);
        setCities(allCities);
      })
      .catch(() => setError('We could not load store filters. Please refresh to try again.'));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (city) params.set('city', city);
    const minPricePaise = minPrice === '' ? null : Math.round(Number(minPrice) * 100);
    const maxPricePaise = maxPrice === '' ? null : Math.round(Number(maxPrice) * 100);

    if (
      (minPricePaise !== null && (!Number.isFinite(minPricePaise) || minPricePaise < 0)) ||
      (maxPricePaise !== null && (!Number.isFinite(maxPricePaise) || maxPricePaise < 0))
    ) {
      setLoading(false);
      setError('Enter a valid non-negative price.');
      return () => controller.abort();
    }
    if (minPricePaise !== null && maxPricePaise !== null && minPricePaise > maxPricePaise) {
      setLoading(false);
      setError('Minimum price must be lower than maximum price.');
      return () => controller.abort();
    }

    if (minPricePaise !== null) params.set('min_price', String(minPricePaise));
    if (maxPricePaise !== null) params.set('max_price', String(maxPricePaise));
    if (query.trim()) params.set('q', query.trim());
    const endpoint = query.trim() ? 'products/search' : 'products';
    setLoading(true);
    setError('');
    fetch(`/api/${endpoint}?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        return response.json() as Promise<Product[]>;
      })
      .then(setProducts)
      .catch((cause: unknown) => {
        if (cause instanceof Error && cause.name === 'AbortError') return;
        setError('We could not load products. Please try again.');
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [query, category, city, minPrice, maxPrice, searchRequest]);

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchRequest((request) => request + 1);
  }

  function clearFilters() {
    setQuery('');
    setCategory('');
    setCity('');
    setMinPrice('');
    setMaxPrice('');
  }

  const hasFilters = Boolean(query || category || city || minPrice || maxPrice);

  return (
    <div className="storefront bg-background text-on-background min-h-screen">
      <section className="w-full bg-surface-container-low text-on-surface-variant">
        <div className="max-w-[1440px] mx-auto px-margin-lg py-2 flex flex-wrap items-center justify-between gap-space-sm">
          <div className="flex flex-wrap items-center gap-space-md">
            <div className="flex items-center gap-space-xs">
              <span className="font-label-sm text-label-sm text-outline tracking-wider uppercase">
                INDEX
              </span>
              <span className="text-outline-variant font-label-sm">/</span>
              <span className="font-headline-sm text-headline-sm uppercase tracking-tight text-on-surface">
                CATALOG / ALL HARDWARE
              </span>
            </div>
            <div className="flex items-center gap-space-xs px-space-xs py-[2px] bg-surface-container-lowest rounded-md shadow-sm border border-outline/50">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
              <span className="font-tabular-data-md text-tabular-data-md text-secondary">
                {categories.length} SKUs Active
              </span>
            </div>
          </div>
          <div className="flex items-center gap-space-lg font-tabular-data-md text-tabular-data-md text-on-surface-variant">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-[16px] text-secondary">bolt</span>
              <span>
                Inventory sync: <strong className="text-on-surface">0.8ms</strong>
              </span>
            </div>
            <span className="text-outline-variant">•</span>
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-[16px] text-outline">verified_user</span>
              <span className="hidden sm:inline">Zero Phantom Reservations</span>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full bg-surface-container-lowest py-space-md border-b border-outline-variant/30">
        <div className="max-w-[1440px] mx-auto px-margin-lg flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
          <div className="flex items-center gap-space-xs overflow-x-auto pb-1 lg:pb-0" id="filter-container">
            <button
              className={`font-label-md text-label-md px-space-sm py-1 rounded-md transition-colors ${
                category === ''
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
              data-category="all"
              type="button"
              onClick={() => setCategory('')}
            >
              All ({products.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                className={`font-label-md text-label-md px-space-sm py-1 rounded-md transition-colors ${
                  category === cat
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
                data-category={cat}
                type="button"
                onClick={() => setCategory(cat)}
              >
                {cat} ({products.filter((p) => p.category === cat).length})
              </button>
            ))}
          </div>
          <div className="flex items-center gap-space-md">
            <div className="flex items-center gap-space-xs">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
                SORT:
              </span>
              <div className="flex items-center bg-surface-container-low rounded-md p-0.5 border border-outline/30">
                <button
                  className="sort-btn px-space-sm py-1 rounded-sm font-label-sm text-label-sm bg-surface-container-lowest text-on-surface shadow-sm border border-outline/30"
                  data-sort="price"
                  type="button"
                >
                  Price
                </button>
                <button
                  className="sort-btn px-space-sm py-1 rounded-sm font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface"
                  data-sort="velocity"
                  type="button"
                >
                  Stock Velocity
                </button>
                <button
                  className="sort-btn px-space-sm py-1 rounded-sm font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface"
                  data-sort="latency"
                  type="button"
                >
                  Latency
                </button>
              </div>
            </div>
            <div className="hidden xl:flex items-center gap-space-xs text-outline font-label-sm text-label-sm">
              <span>PIPELINE: ACID-2PC</span>
            </div>
          </div>
        </div>
      </section>

      <main className="w-full px-margin-lg py-space-lg">
        <div className="max-w-[1440px] mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter" id="catalog-grid">
            {products.map((product) => (
              <article
                key={product.id}
                className="group flex flex-col bg-surface-container-lowest rounded-lg shadow-sm border border-outline/50 hover:border-primary/50 transition-colors relative"
                data-category={product.category}
                data-price={product.price_paise}
              >
                <div className="p-space-sm flex items-center justify-between text-outline bg-surface-container-low border-b border-outline/50">
                  <span className="font-tabular-data-md text-tabular-data-md">{product.sku}</span>
                  <span className="font-label-sm text-label-sm text-secondary bg-secondary-container/40 px-1 rounded-md">
                    {product.category.slice(0, 3).toUpperCase()}
                  </span>
                </div>
                <div className="relative w-full aspect-[4/3] bg-surface-container-lowest overflow-hidden flex items-center justify-center p-space-md">
                  <img
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                    alt={product.name}
                    src={
                      product.image_url ||
                        'https://lh3.googleusercontent.com/aida-public/AB6AXuCzrwf6bZ7MKi437kJa-R4SmVsPWyg4a-8gS0FlPDnmCN45CRm47g3-dqiswJvlLCtQxx32a3QEnB7vzhUg5xmRiSP0bBb6xGGO-P0kMA-BUKcaV7jm5wLR-bAc_csV_BHHGJNQw7RGOeMzyusOQVmB9Bur1i6TSDX_JnUMHE7AE-jENe8zQDGH68mI9_R5VXQq0Q17ZmuhV776xrHxLhd2Cor6PcsIiQcGRWiecaQy'
                    }
                    loading="lazy"
                  />
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-surface-container-lowest/90 backdrop-blur-sm font-tabular-data-md text-label-sm text-on-surface shadow-sm border border-outline/30">
                    0.4ms Read
                  </div>
                </div>
                <div className="p-space-md flex flex-col flex-1 justify-between gap-space-md bg-surface-container-lowest">
                  <div>
                    <div className="flex items-baseline justify-between gap-space-xs">
                      <h3 className="font-headline-sm text-headline-sm text-on-surface">
                        {product.name}
                      </h3>
                      <span className="font-tabular-price-lg text-headline-sm text-primary">
                        {formatPrice(product.price_paise)}
                      </span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                      {product.description}
                    </p>
                    <div className="mt-space-sm p-1.5 rounded-md bg-surface-container-low flex items-center gap-1.5 border border-outline/50">
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                      <span className="font-tabular-data-md text-body-sm text-on-surface">
                        In-stock across cities
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-space-xs pt-space-xs">
                    <Link
                      href={`/product/${product.id}`}
                      className="quick-add flex-1 py-1.5 px-space-sm bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md rounded-md flex items-center justify-center gap-1 transition-colors border border-transparent hover:border-outline"
                    >
                      <span className="material-symbols-outlined text-[16px]">add_shopping_cart</span>
                      <span>View Details</span>
                    </Link>
                    <button
                      className="spec-btn py-1.5 px-space-sm bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container font-label-md text-label-md rounded-md flex items-center justify-center border border-outline/30"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[16px]">terminal</span>
                    </button>
                  </div>
                </div>
              </article>
            ))}
            {products.length === 0 && (
              <div className="col-span-full p-space-lg text-center bg-surface-container-lowest rounded-lg border border-outline/50">
                <p className="font-body-md text-body-md text-on-surface-variant">
                  No products found. Try changing your search or filters.
                </p>
                {hasFilters && (
                  <button
                    className="mt-space-md font-label-md text-label-md text-primary underline underline-offset-4 hover:text-primary-container"
                    onClick={clearFilters}
                    type="button"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      <section className="w-full bg-surface-container-low px-margin-lg py-space-xl border-t border-outline-variant/30">
        <div className="max-w-[1440px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-gutter">
          <div className="p-space-lg bg-surface-container-lowest rounded-lg shadow-sm border border-outline/50 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
                  TELEMETRY STATS
                </span>
                <span className="font-tabular-data-md text-tabular-data-md text-secondary">
                  LIVE FEED
                </span>
              </div>
              <h4 className="font-headline-sm text-headline-sm text-on-surface mt-space-xs">
                Atomic Read & Write
              </h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-space-xs">
                PulseCart guarantees 0 phantom cart locks. Every item placed into cart engages an
                isolated row mutex at the edge broker node.
              </p>
            </div>
            <div className="mt-space-lg flex items-center gap-space-md pt-space-sm bg-surface-container-low p-space-sm rounded-md border border-outline/50">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-outline">P99 LATENCY</span>
                <span className="font-tabular-price-lg text-headline-sm text-on-surface">1.2ms</span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-outline">CONSENSUS</span>
                <span className="font-tabular-price-lg text-headline-sm text-secondary">Raft Q4</span>
              </div>
            </div>
          </div>
          <div className="p-space-lg bg-surface-container-lowest rounded-lg shadow-sm border border-outline/50 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
                  DISTRIBUTION
                </span>
                <span className="font-tabular-data-md text-tabular-data-md text-on-surface">
                  BLR-01 HUB
                </span>
              </div>
              <h4 className="font-headline-sm text-headline-sm text-on-surface mt-space-xs">
                Throughput Activity
              </h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-space-xs">
                Hardware allocations dispatched via automated routing within 120 seconds of
                transaction block settlement.
              </p>
            </div>
            <div className="mt-space-lg">
              <svg
                className="w-full h-12 text-secondary"
                fill="none"
                viewBox="0 0 300 48"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M0 40 L30 35 L60 38 L90 20 L120 28 L150 15 L180 18 L210 5 L240 12 L270 4 L300 2"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                />
                <path
                  d="M0 40 L30 35 L60 38 L90 20 L120 28 L150 15 L180 18 L210 5 L240 12 L270 4 L300 2 V48 H0 Z"
                  fill="currentColor"
                  fill-opacity={0.08}
                />
              </svg>
            </div>
          </div>
          <div className="p-space-lg bg-surface-container-lowest rounded-lg shadow-sm border border-outline/50 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
                  API ENDPOINT
                </span>
                <span className="font-tabular-data-md text-tabular-data-md text-outline">
                  v2.14.0
                </span>
              </div>
              <h4 className="font-headline-sm text-headline-sm text-on-surface mt-space-xs">
                Algorithmic Procurement
              </h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-space-xs">
                Direct high-frequency endpoint hooks allow continuous programmatic acquisition for
                production run assembly.
              </p>
            </div>
            <div className="mt-space-lg flex items-center justify-between bg-surface-container-low p-space-sm rounded-md border border-outline/50">
              <code className="font-tabular-data-md text-body-sm text-on-surface">
                POST /v2/transact/lock
              </code>
              <span className="font-label-sm text-label-sm px-1.5 py-0.5 rounded-md bg-primary text-on-primary">
                200 OK
              </span>
            </div>
          </div>
        </div>
      </section>

      <div
        className="fixed bottom-6 right-6 bg-primary text-on-primary px-space-md py-space-sm rounded-full shadow-xl flex items-center gap-space-sm transform translate-y-24 opacity-0 transition-all duration-200 pointer-events-none z-50"
        id="quick-toast"
      >
        <span className="material-symbols-outlined text-secondary text-[20px]">
          check_circle
        </span>
        <span className="font-label-md text-label-md" id="toast-msg">
          Row-lock secured in 0.8ms
        </span>
      </div>
    </div>
  );
}
