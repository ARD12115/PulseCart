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
};

const API = '/api';
const formatPrice = (paise: number) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
}).format(paise / 100);

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
  }, [query, category, city, minPrice, maxPrice]);

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      <section className="editorial-hero" aria-labelledby="hero-title">
        <div className="hero-grain" aria-hidden="true" />
        <ScrollReveal className="hero-copy">
          <p className="eyebrow"><span>01</span> PulseCart / local signal</p>
          <h1 id="hero-title">Good things.<br /><em>Close to home.</em></h1>
          <p className="hero-description">A brighter way to find what your neighborhood has in stock. Explore the local feed and pick up something good.</p>
          <div className="hero-actions">
            <a className="button-dark" href="#shop">Explore the collection <span aria-hidden="true">↘</span></a>
            <span className="hero-note">NEARBY / AVAILABLE NOW</span>
          </div>
        </ScrollReveal>

        <ScrollReveal className="hero-visual" delay={120}>
          <div className="hero-art-halo" aria-hidden="true" />
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
      </section>

      <ScrollReveal className="manifesto-section">
        <div className="manifesto-heading">
          <p className="eyebrow"><span>02</span> Signal from your city</p>
          <h2>Good things are<br /><em>closer than you think.</em></h2>
        </div>
        <div className="manifesto-aside">
          <span className="signal-mark" aria-hidden="true">✳</span>
          <p>Meet a more connected neighborhood: useful finds, live local stock, and a smoother way to shop the stores around you.</p>
          <a className="text-link" href="#shop">Tune into the collection <span aria-hidden="true">↘</span></a>
        </div>
      </ScrollReveal>

      <section className="shop-section" id="shop" aria-labelledby="shop-heading">
        <div className="shop-heading-row">
          <ScrollReveal className="shop-title-block">
            <p className="eyebrow"><span>03</span> The local collection</p>
            <h2 id="shop-heading">Browse the <em>signal.</em></h2>
          </ScrollReveal>
          <p className="shop-intro">Search or narrow by category and delivery city.</p>
        </div>

        <div className="filter-panel">
          <form onSubmit={onSearch} className="filter-form" aria-label="Find products">
            <label className="search-field">
              <span aria-hidden="true" className="search-icon">⌕</span>
              <span className="sr-only">Search products</span>
              <input type="search" placeholder="Search products" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <label className="filter-select">
              <span className="sr-only">Category</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="">All categories</option>
                {categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="filter-select">
              <span className="sr-only">Delivery city</span>
              <select value={city} onChange={(event) => setCity(event.target.value)}>
                <option value="">All cities</option>
                {cities.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <details className="price-filter">
              <summary>Price <span aria-hidden="true">＋</span></summary>
              <div className="price-fields">
                <label><span className="sr-only">Minimum price in rupees</span><input type="number" min="0" step="0.01" placeholder="Min ₹" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} /></label>
                <span aria-hidden="true">—</span>
                <label><span className="sr-only">Maximum price in rupees</span><input type="number" min="0" step="0.01" placeholder="Max ₹" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} /></label>
              </div>
            </details>
            {hasFilters && <button className="clear-filter-button" type="button" onClick={clearFilters}>Clear</button>}
          </form>
          <div className="results-count" aria-live="polite">{loading ? 'Loading…' : `${products.length} ${products.length === 1 ? 'product' : 'products'}`}</div>
        </div>

        {error && <p role="alert" className="store-error">{error}</p>}
        {!loading && !error && products.length === 0 && (
          <div className="empty-results">
            <p>No products found. Try changing your search or filters.</p>
            {hasFilters && <button className="text-link" onClick={clearFilters}>Clear filters</button>}
          </div>
        )}

        <div className="product-grid">
          {products.map((product, index) => (
            <ScrollReveal key={`${product.id}-${product.city || ''}`} className="product-reveal" delay={(index % 4) * 55}>
              <Link href={`/product/${product.id}`} className="product-card">
                <div className="product-card-art">
                  <ProductArtwork category={product.category} imageUrl={product.image_url} name={product.name} />
                  <span className="card-arrow" aria-hidden="true">↗</span>
                </div>
                <div className="product-card-copy">
                  <div className="product-card-topline"><span>{product.category}</span>{product.city && <span>{product.city}</span>}</div>
                  <h3>{product.name}</h3>
                  <p>{product.description}</p>
                  <div className="product-card-bottom"><strong>{formatPrice(product.price_paise)}</strong><span>View details <span aria-hidden="true">↗</span></span></div>
                </div>
              </Link>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <ScrollReveal className="closing-story">
        <div className="closing-art" aria-hidden="true">
          <div className="closing-grid" />
          <div className="closing-orbit closing-orbit-one" />
          <div className="closing-orbit closing-orbit-two" />
          <span className="closing-core">PC<span>_</span></span>
          <span className="closing-art-label">LOCAL NETWORK / ONLINE</span>
        </div>
        <div className="closing-copy">
          <p className="eyebrow"><span>04</span> Your next good find</p>
          <h2>Stay close.<br /><em>Find more.</em></h2>
          <p>Your neighborhood is full of good things. Take another look around.</p>
          <a href="#shop" className="button-light">Back to the collection <span aria-hidden="true">↑</span></a>
        </div>
      </ScrollReveal>
    </div>
  );
}
