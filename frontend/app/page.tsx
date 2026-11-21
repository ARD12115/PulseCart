'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import ProductArtwork from './product-artwork';
import ScrollReveal from './scroll-reveal';

type Product = {
  id: number;
  sku: string;
  name: string;
  description: string;
  category: string;
  price_paise: number;
  image_url: string | null;
  city?: string;
  details?: Record<string, unknown>;
};

const API = '/api';
const formatPrice = (paise: number) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
}).format(paise / 100);

const PRODUCT_TYPES = {
  electronics: 'rig',
  home: 'gantry',
  fitness: 'board',
  kitchen: 'ring',
} as const;

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
      fetch(`${API}/categories`).then((response) => {
        if (!response.ok) throw new Error('Could not load categories');
        return response.json() as Promise<string[]>;
      }),
      fetch(`${API}/cities`).then((response) => {
        if (!response.ok) throw new Error('Could not load cities');
        return response.json() as Promise<string[]>;
      }),
    ]).then(([allCategories, allCities]) => {
      setCategories(allCategories);
      setCities(allCities);
    }).catch(() => setError('We could not load store filters. Please refresh to try again.'));
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
    fetch(`${API}/${endpoint}?${params.toString()}`, { signal: controller.signal })
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

  const featured = products[0];
  const hasFilters = Boolean(query || category || city || minPrice || maxPrice);

  return (
    <div className="storefront">
      <div className="storefront-ticker" role="note" aria-label="PulseCart catalog features">
        <span>LOCAL CATALOG</span><b aria-hidden="true">//</b>
        <span>POSTGRESQL / INVENTORY</span><b aria-hidden="true">//</b>
        <span>APACHE KAFKA / EVENT FLOW</span><b aria-hidden="true">//</b>
        <span>OPENSEARCH / FUZZY CATALOG</span>
      </div>
      <section className="editorial-hero acid-hero" id="hero" aria-labelledby="hero-title">
        <div className="hero-grain" aria-hidden="true" />
        <div className="hero-coordinate hero-coordinate-left">// PULSECART / LOCAL COMMERCE</div>
        <div className="hero-coordinate hero-coordinate-right">INVENTORY / ORDERS / EVENTS</div>
        <ScrollReveal className="hero-copy">
          <p className="eyebrow acid-label">High-tensile event-driven retail</p>
          <h1 id="hero-title" className="text-balance">Kinetic 3D<br /><em>local hardware.</em></h1>
          <p className="hero-description">Browse products from nearby shops, search with typo tolerance, and place orders against current inventory.</p>
          <div className="hero-actions">
            <a className="acid-button-primary" href="#shop">Explore the collection</a>
            <a className="acid-button-secondary" href="#architecture">See how it works</a>
          </div>
        </ScrollReveal>

        <ScrollReveal className="hero-visual" delay={120}>
          <div className="hero-art-halo" aria-hidden="true" />
          <div className="kinetic-engine" aria-hidden="true">
            <div className="engine-ring engine-ring-one" />
            <div className="engine-ring engine-ring-two" />
            <div className="engine-ring engine-ring-three" />
            <div className="engine-cube">
              <span className="engine-face engine-face-front">PC</span>
              <span className="engine-face engine-face-back" />
              <span className="engine-face engine-face-right" />
              <span className="engine-face engine-face-left" />
              <span className="engine-face engine-face-top" />
              <span className="engine-face engine-face-bottom" />
            </div>
            <span className="engine-satellite engine-satellite-one" />
            <span className="engine-satellite engine-satellite-two" />
            <span className="engine-satellite engine-satellite-three" />
          </div>
          <div className="hero-product-card">
            <ProductArtwork category={featured?.category ?? 'home'} imageUrl={featured?.image_url} name={featured?.name ?? 'A neighborhood find'} hero />
            {featured && (
              <div className="hero-product-caption">
                <div><span>Featured find</span><strong>{featured.name}</strong></div>
                <span className="hero-product-price">{formatPrice(featured.price_paise)}</span>
              </div>
            )}
          </div>
          <div className="hero-stamp" aria-hidden="true"><span>FOUND</span><b>NEARBY</b></div>
        </ScrollReveal>
        <div className="hero-baseline"><span>01 / STOREFRONT</span><span>INVENTORY-AWARE CHECKOUT</span><a href="#architecture">SCROLL TO EXPLORE</a></div>
      </section>

      <div className="signal-ribbon" role="note" aria-label="Store architecture services">
        <span>POSTGRESQL / INVENTORY + ORDERS</span><b aria-hidden="true">◆</b><span>APACHE KAFKA / EVENT STREAM</span><b aria-hidden="true">◆</b><span>OPENSEARCH / FUZZY SEARCH</span>
      </div>

      <section className="architecture-section" id="architecture" aria-labelledby="architecture-heading">
        <div className="section-heading-row">
          <div><p className="eyebrow">System architecture / overview</p><h2 id="architecture-heading">One storefront.<br /><em>Three engines.</em></h2></div>
          <p>Each service has a focused role in the shopping flow. These are architecture notes, not live cluster metrics.</p>
        </div>
        <div className="architecture-grid">
          <article className="architecture-card"><span className="architecture-glyph" aria-hidden="true">▦</span><h3>PostgreSQL</h3><p>Products, inventory, carts, and checkout transactions live in the relational store.</p><span className="architecture-role">SOURCE OF TRUTH / INVENTORY</span></article>
          <article className="architecture-card"><span className="architecture-glyph" aria-hidden="true">⟿</span><h3>Apache Kafka</h3><p>Committed checkout events move through the outbox relay to asynchronous consumers.</p><span className="architecture-role">EVENT DELIVERY / ASYNC WORKERS</span></article>
          <article className="architecture-card"><span className="architecture-glyph" aria-hidden="true">⌕</span><h3>OpenSearch</h3><p>Catalog queries use fuzzy matching so shoppers can find products despite small typos.</p><span className="architecture-role">PRODUCT DISCOVERY / SEARCH</span></article>
        </div>
      </section>

      <section className="search-console" id="search-console" aria-labelledby="search-heading">
        <div className="console-heading"><div><p className="eyebrow">Product discovery</p><h2 id="search-heading">Search the <em>catalog.</em></h2></div><p>Try a product name or a close spelling. Results update as you type.</p></div>
        <div className="filter-panel">
          <form id="catalog-search" onSubmit={onSearch} className="filter-form" aria-label="Find products">
            <label className="search-field" htmlFor="search-products">
              <span aria-hidden="true" className="search-icon">⌕</span>
              <span className="sr-only">Search products</span>
              <input id="search-products" type="search" autoComplete="off" placeholder="Search products" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <label className="filter-select" htmlFor="category-filter">
              <span className="sr-only">Category</span>
              <select id="category-filter" value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="">All categories</option>
                {categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="filter-select" htmlFor="city-filter">
              <span className="sr-only">Delivery city</span>
              <select id="city-filter" value={city} onChange={(event) => setCity(event.target.value)}>
                <option value="">All cities</option>
                {cities.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <div className="price-filter">
              <div className="price-fields">
                <label htmlFor="min-price"><span className="sr-only">Minimum price in rupees</span><input id="min-price" type="number" autoComplete="off" min="0" step="0.01" placeholder="Min ₹" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} /></label>
                <span aria-hidden="true">—</span>
                <label htmlFor="max-price"><span className="sr-only">Maximum price in rupees</span><input id="max-price" type="number" autoComplete="off" min="0" step="0.01" placeholder="Max ₹" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} /></label>
              </div>
            </div>
            {hasFilters && <button className="clear-filter-button" type="button" onClick={clearFilters}>Clear</button>}
          </form>
          <button className="run-query-button" type="submit" form="catalog-search">Search</button>
          <div className="results-count" aria-live="polite">{loading ? 'Loading…' : `${products.length} ${products.length === 1 ? 'product' : 'products'}`}</div>
        </div>

      </section>

      <section className="shop-section" id="shop" aria-labelledby="shop-heading">
        <div className="shop-heading-row">
          <div>
            <p className="eyebrow">Browse the shop</p>
            <h2 id="shop-heading">Browse the shop</h2>
          </div>
          <p className="shop-intro">Filter above to narrow products by name, price, category, and delivery city.</p>
        </div>
        {error && <p role="alert" className="store-error">{error}</p>}
        {!loading && !error && products.length === 0 && (
          <div className="empty-results">
            <p>No products found. Try changing your search or filters.</p>
            {hasFilters && <button className="text-link" onClick={clearFilters}>Clear filters</button>}
          </div>
        )}

        <div className="product-grid" aria-busy={loading}>
          {products.map((product) => (
            <Link href={`/product/${product.id}`} key={product.id} className="product-card">
                <div className="product-card-art">
                  <ProductArtwork category={product.category} imageUrl={product.image_url} name={product.name} />
                </div>
                <div className="product-card-copy">
                  <div className="product-card-topline">
                    <span>{product.sku}</span>
                    <span>{product.city || product.category}</span>
                    <span className="px-2 py-0.5 bg-surface border border-lime/20 text-lime font-mono text-[10px] font-bold uppercase">IN STOCK</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="flex flex-col">
                      <h3>{product.name}</h3>
                      <p>{product.description}</p>
                      <div className="flex gap-1 font-mono text-[10px] text-ink/60 mb-2">
                        <span className="bg-paper px-2 py-0.5 border border-lime/20">{product.category.toUpperCase()}</span>
                        <span className="bg-paper px-2 py-0.5 border border-lime/20">{PRODUCT_TYPES[product.category as keyof typeof PRODUCT_TYPES]?.toUpperCase() || 'RIG'}</span>
                      </div>
                      {product.details && (
                        <div className="flex flex-wrap items-start gap-2 mt-1">
                          {(() => {
                            const d = product.details as {
                              mrp?: number;
                              discount_pct?: number;
                              rating?: number;
                            };
                            if (d.mrp && d.mrp > product.price_paise / 100) {
                              return (
                                <>
                                  <span className="text-[10px] text-ink/40 line-through font-mono">
                                    ₹{d.mrp}
                                  </span>
                                  {d.discount_pct && (
                                    <span className="px-1.5 py-0.5 bg-lime text-black font-mono text-[10px] font-bold uppercase">
                                      -{Math.round(d.discount_pct * 100)}%
                                    </span>
                                  )}
                                </>
                              );
                            }
                            return null;
                          })()}
                          {(() => {
                            const d = product.details as { rating?: number };
                            if (d.rating) {
                              const rating = Math.round(d.rating);
                              return (
                                <span className="flex items-center gap-1 text-[10px] font-mono text-ink/60">
                                  {[1, 2, 3, 4, 5].map((i) => (
                                    <span
                                      key={i}
                                      className={
                                        i <= rating
                                          ? 'text-lime font-bold'
                                          : 'text-ink/20'
                                      }
                                    >
                                      ★
                                    </span>
                                  ))}
                                  <span className="ml-0.5 text-[10px] text-ink/40">
                                    {`${d.rating}`}
                                  </span>
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      )}
                      <div className="bg-paper border border-lime/20 p-1.5 text-[10px] font-mono text-ink/60 mt-2">
                        <div className="text-lime font-bold uppercase mb-0.5">FABRICATION SPECIFICATIONS</div>
                        <div className="text-cyan truncate">CNC TOLERANCE PASS</div>
                      </div>
                    </div>
                    <div className="product-card-bottom"><strong>{formatPrice(product.price_paise)}</strong><span>View details</span></div>
                  </div>
                </div>
              </Link>
          ))}
        </div>
      </section>

      <section className="system-callout">
        <div className="system-callout-copy">
          <p className="eyebrow">Architecture / concurrency / operations</p>
          <h2>Built for the<br /><em>last item.</em></h2>
          <p>Explore the concurrency demo or review real outbox events and order confirmations in the operations console.</p>
        </div>
        <div className="system-callout-actions">
          <a className="button-dark" href="/demo">Run concurrency lab</a>
          <a className="button-outline" href="/admin">Open operations</a>
        </div>
      </section>
    </div>
  );
}
