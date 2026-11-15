'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import ProductArtwork from './product-artwork';
import ScrollReveal from './scroll-reveal';

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
const formatPrice = (paise: number) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
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
      fetch(`${API}/categories`).then((response) => response.json() as Promise<string[]>),
      fetch(`${API}/cities`).then((response) => response.json() as Promise<string[]>),
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
      (minPricePaise !== null && (!Number.isFinite(minPricePaise) || minPricePaise < 0)) ||
      (maxPricePaise !== null && (!Number.isFinite(maxPricePaise) || maxPricePaise < 0))
    ) {
      setLoading(false);
      setError('Enter a valid non-negative price in rupees.');
      return () => controller.abort();
    }
    if (minPricePaise !== null && maxPricePaise !== null && minPricePaise > maxPricePaise) {
      setLoading(false);
      setError('Minimum price cannot exceed maximum price.');
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
        setError('Could not load products. Check that the API and services are running.');
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

  return (
    <div className="storefront">
      <div className="announcement-bar">
        <span className="announcement-dot" />
        <p>Good things, found close to home</p>
        <a href="#our-way">A little more about us <span aria-hidden="true">↗</span></a>
      </div>

      <section className="editorial-hero" aria-labelledby="hero-title">
        <div className="hero-grain" aria-hidden="true" />
        <ScrollReveal className="hero-copy">
          <p className="eyebrow"><span>01</span> The neighborhood edit</p>
          <h1 id="hero-title">Small things.<br /><em>Good things.</em><br />Close to home.</h1>
          <p className="hero-description">A thoughtful mix of everyday finds from the shops and makers around your corner.</p>
          <div className="hero-actions">
            <a className="button-dark" href="#shop">Explore the edit <span aria-hidden="true">↘</span></a>
            <span className="hero-note">Picked nearby. Ready when you are.</span>
          </div>
        </ScrollReveal>

        <ScrollReveal className="hero-visual" delay={120}>
          <div className="hero-art-halo" aria-hidden="true" />
          <div className="hero-stamp" aria-hidden="true"><span>LOCAL</span><span>LOOKS</span><b>GOOD</b></div>
          <div className="hero-product-card">
            <ProductArtwork category={featured?.category ?? 'home'} imageUrl={featured?.image_url} name={featured?.name ?? 'A neighborhood find'} hero />
            <div className="hero-product-caption">
              <div><span>In the spotlight</span><strong>{featured?.name ?? 'Something good nearby'}</strong></div>
              {featured && <span className="hero-product-price">{formatPrice(featured.price_paise)}</span>}
            </div>
          </div>
          <span className="hero-orbit orbit-one" aria-hidden="true" />
          <span className="hero-orbit orbit-two" aria-hidden="true" />
        </ScrollReveal>

        <a className="hero-scroll" href="#shop"><span className="scroll-line" />Scroll to find your thing</a>
        <span className="hero-index" aria-hidden="true">P / C — 001</span>
      </section>

      <div className="ticker" aria-label="Local finds for everyday living">
        <div className="ticker-track" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => (
            <span key={index}>Made for everyday <b>✳</b> Found just around the corner <b>✳</b></span>
          ))}
        </div>
      </div>

      <section className="manifesto-section" id="our-way">
        <ScrollReveal className="manifesto-heading">
          <p className="eyebrow"><span>02</span> A better kind of everyday</p>
          <h2>Your next favorite thing might be <em>just around the corner.</em></h2>
        </ScrollReveal>
        <ScrollReveal className="manifesto-aside" delay={140}>
          <span className="asterisk-mark" aria-hidden="true">✳</span>
          <p>We bring the good stuff from your local shops into one easy place. Browse what’s in stock, find a new favorite, and keep a little more of your day close by.</p>
          <a className="text-link" href="#shop">Get to know the collection <span aria-hidden="true">↘</span></a>
        </ScrollReveal>
      </section>

      <section className="shop-section" id="shop" aria-labelledby="shop-heading">
        <div className="shop-heading-row">
          <ScrollReveal className="shop-title-block">
            <p className="eyebrow"><span>03</span> Shop the neighborhood</p>
            <h2 id="shop-heading">The good <em>stuff.</em></h2>
          </ScrollReveal>
          <p className="shop-intro">Useful little upgrades, thoughtful gifts, and everyday things you’ll be glad you found.</p>
        </div>

        <div className="filter-panel">
          <form onSubmit={onSearch} className="filter-form" aria-label="Filter products">
            <label className="search-field">
              <span aria-hidden="true" className="search-icon">⌕</span>
              <span className="sr-only">Search products</span>
              <input
                type="search"
                placeholder="Find something good..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label className="filter-select">
              <span className="sr-only">Category</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="">Every category</option>
                {categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="filter-select">
              <span className="sr-only">City</span>
              <select value={city} onChange={(event) => setCity(event.target.value)}>
                <option value="">Everywhere</option>
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
          </form>
          <div className="results-count" aria-live="polite">{loading ? 'Finding good things…' : `${products.length} ${products.length === 1 ? 'find' : 'finds'}`}</div>
        </div>

        {error && <p role="alert" className="store-error">{error}</p>}
        {!loading && !error && products.length === 0 && (
          <div className="empty-results">
            <span aria-hidden="true">✳</span>
            <p>No finds match those filters just yet.</p>
            <button className="text-link" onClick={clearFilters}>Clear filters <span aria-hidden="true">↗</span></button>
          </div>
        )}

        <div className="product-grid">
          {products.map((product, index) => (
            <ScrollReveal key={`${product.id}-${product.city || ''}`} className="product-reveal" delay={(index % 4) * 70}>
              <Link href={`/product/${product.id}`} className="product-card">
                <div className="product-card-art">
                  <ProductArtwork category={product.category} imageUrl={product.image_url} name={product.name} />
                  <span className="card-index">PC / {String(index + 1).padStart(2, '0')}</span>
                  <span className="card-arrow" aria-hidden="true">↗</span>
                </div>
                <div className="product-card-copy">
                  <div className="product-card-topline"><span>{product.category}</span>{product.city && <span>Near {product.city}</span>}</div>
                  <h3>{product.name}</h3>
                  <p>{product.description}</p>
                  <div className="product-card-bottom"><strong>{formatPrice(product.price_paise)}</strong><span>Meet your new favorite</span></div>
                </div>
              </Link>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="closing-story">
        <div className="closing-art" aria-hidden="true">
          <div className="closing-sun" />
          <div className="closing-arch"><div className="closing-arch-inner" /></div>
          <span className="closing-spark spark-one">✳</span><span className="closing-spark spark-two">✳</span>
          <span className="closing-art-label">A LITTLE CLOSER TO HOME</span>
        </div>
        <ScrollReveal className="closing-copy">
          <p className="eyebrow"><span>04</span> The good-neighbor effect</p>
          <h2>Good finds.<br /><em>Good neighbors.</em></h2>
          <p>Shopping close to home should feel easy, personal, and full of little surprises. That’s the whole idea.</p>
          <a className="button-light" href="#shop">Find your next favorite <span aria-hidden="true">↗</span></a>
        </ScrollReveal>
      </section>
    </div>
  );
}
