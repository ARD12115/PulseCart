'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import ProductArtwork from '../product-artwork';
import { syncCart, type CartItem } from '../cart-sync';
import * as THREE from 'three';

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
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paise / 100);

const PRODUCT_TYPES = {
  electronics: 'rig',
  home: 'gantry',
  fitness: 'board',
  kitchen: 'ring',
} as const;

export default function KineticStorefrontPage() {
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

  const [modalOpen, setModalOpen] = useState(false);
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const [modalWireframe, setModalWireframe] = useState(false);
  const [modalExploded, setModalExploded] = useState(false);
  const [toasts, setToasts] = useState<string[]>([]);
  const [upiModal, setUpiModal] = useState<{ sku: string; amount: number } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/categories').then((r) => r.json() as Promise<string[]>),
      fetch('/api/cities').then((r) => r.json() as Promise<string[]>),
    ])
      .then(([allCategories, allCities]) => {
        setCategories(allCategories);
        setCities(allCities);
      })
      .catch(() => setError('Could not load store filters.'));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (city) params.set('city', city);
    if (query.trim()) params.set('q', query.trim());
    const endpoint = query.trim() ? 'products/search' : 'products';
    setLoading(true);
    setError('');
    fetch(`/api/${endpoint}?${params.toString()}`, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Request failed (${r.status})`);
        return r.json() as Promise<Product[]>;
      })
      .then(setProducts)
      .catch((e) => {
        if (e.name !== 'AbortError') setError('Could not load products.');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [query, category, city, searchRequest]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchRequest((n) => n + 1);
  };

  const clearFilters = () => {
    setQuery('');
    setCategory('');
    setCity('');
  };

  const showToast = useCallback((msg: string) => {
    setToasts((t) => [...t, msg]);
    setTimeout(() => setToasts((t) => t.slice(1)), 3200);
  }, []);

  const openInspector = (product: Product) => {
    setModalProduct(product);
    setModalOpen(true);
    setModalWireframe(false);
    setModalExploded(false);
  };

  const closeInspector = () => {
    setModalOpen(false);
    setModalProduct(null);
  };

  const handleUpiClick = (sku: string, amount: number) => {
    setUpiModal({ sku, amount });
    closeInspector();
  };

  const simulateUpiSuccess = () => {
    showToast('UPI TRANSACTION VERIFIED // KAFKA ORDER STREAMED');
    setUpiModal(null);
  };

  const addToCart = (product: Product) => {
    try {
      const saved = JSON.parse(localStorage.getItem('pulsecart_cart') || '[]') as CartItem[];
      const existing = saved.find((item) => item.id === product.id);
      if (existing) existing.qty += 1;
      else saved.push({ ...product, qty: 1 });
      localStorage.setItem('pulsecart_cart', JSON.stringify(saved));
      window.dispatchEvent(new Event('pulsecart:cart-updated'));
      syncCart(saved).catch((err) => {
        showToast(`CART SYNC FAILED: ${err.message}`);
      });
      showToast(`ADDED TO CART: ${product.sku}`);
    } catch {
      showToast('Could not add to cart.');
    }
  };

  const commitLock = () => {
    if (modalProduct) {
      showToast(`ROW LEASE ACQUIRED: ${modalProduct.sku} LOCKED IN POSTGRES FOR 15m!`);
      closeInspector();
    }
  };

  // Initialize Three.js background on mount
  const [scrollProgress, setScrollProgress] = useState(0);
  const animationFrameRef = useRef<number>(0);

  useEffect(() => {
    const container = document.getElementById('threejs-bg-canvas');
    if (!container) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0a0c, 0.02);

    const width = window.innerWidth;
    const height = window.innerHeight;

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
    camera.position.set(0, 0, 6.2);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xd4ff00, 2.8);
    dirLight1.position.set(6, 8, 5);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x00f0ff, 2.2);
    dirLight2.position.set(-6, -5, -4);
    scene.add(dirLight2);

    const masterGroup = new THREE.Group();
    scene.add(masterGroup);

    const coreGeo = new THREE.IcosahedronGeometry(1.25, 1);
    const coreMat = new THREE.MeshPhongMaterial({ color: 0x111114, emissive: 0x1c2800, specular: 0xd4ff00, shininess: 100, flatShading: true });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    masterGroup.add(coreMesh);

    const wireMat = new THREE.MeshBasicMaterial({ color: 0xd4ff00, wireframe: true, transparent: true, opacity: 0.88 });
    const wireMesh = new THREE.Mesh(coreGeo, wireMat);
    wireMesh.scale.set(1.03, 1.03, 1.03);
    masterGroup.add(wireMesh);

    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.035, 16, 80), new THREE.MeshBasicMaterial({ color: 0xd4ff00 }));
    ring1.rotation.x = Math.PI / 3;
    masterGroup.add(ring1);

    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.025, 16, 80), new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.8 }));
    ring2.rotation.y = Math.PI / 4;
    masterGroup.add(ring2);

    const satellites: { mesh: THREE.Mesh; angle: number; speed: number }[] = [];
    for (let i = 0; i < 8; i++) {
      const satGeo = new THREE.BoxGeometry(0.26, 0.26, 0.26);
      const col = i % 2 === 0 ? 0xd4ff00 : 0x00f0ff;
      const sat = new THREE.Mesh(satGeo, new THREE.MeshPhongMaterial({ color: 0x0e0e11, emissive: col, emissiveIntensity: 0.55 }));
      sat.add(new THREE.LineSegments(new THREE.EdgesGeometry(satGeo), new THREE.LineBasicMaterial({ color: col })));
      const angle = (i / 8) * Math.PI * 2;
      const radius = 3.2;
      sat.position.set(Math.cos(angle) * radius, (i - 4) * 0.4, Math.sin(angle) * radius);
      masterGroup.add(sat);
      satellites.push({ mesh: sat, angle, speed: 0.008 });
    }

    const grid = new THREE.GridHelper(40, 50, 0xd4ff00, 0x1f2410);
    grid.position.y = -2.6;
    scene.add(grid);

    let scrollProgress = 0;
    function updateScroll() {
      const top = window.pageYOffset || document.documentElement.scrollTop;
      const max = document.documentElement.scrollHeight - window.innerHeight || 1;
      scrollProgress = Math.min(Math.max(top / max, 0), 1);
      const pct = Math.round(scrollProgress * 100);
      const barElem = document.getElementById('live-scroll');
      if (barElem) barElem.innerText = `SCROLL DEPTH // [${'█'.repeat(Math.floor(pct / 10))}${'░'.repeat(10 - Math.floor(pct / 10))}] ${pct}%`;
      const coordsElem = document.getElementById('live-coords');
      if (coordsElem) coordsElem.innerText = `[X:${(scrollProgress * 100).toFixed(2)} // Y:${(-scrollProgress * 50).toFixed(2)} // Z:${(6.2 - scrollProgress * 3.5).toFixed(2)}]`;
    }
    window.addEventListener('scroll', updateScroll, { passive: true });

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    const clock = new THREE.Clock();
    function animate() {
      animationFrameRef.current = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      masterGroup.rotation.y = t * 0.15 + scrollProgress * Math.PI * 2;
      masterGroup.rotation.x = scrollProgress * 1.5;
      coreMesh.rotation.x = t * 0.3;
      coreMesh.rotation.y = t * 0.4;
      wireMesh.rotation.x = coreMesh.rotation.x;
      wireMesh.rotation.y = coreMesh.rotation.y;

      ring1.rotation.z = t * 0.4 + scrollProgress * 3;
      ring2.rotation.x = -t * 0.5;

      for (let i = 0; i < satellites.length; i++) {
        const s = satellites[i];
        s.angle += s.speed;
        s.mesh.position.x = Math.cos(s.angle) * (3.2 + scrollProgress * 1.5);
        s.mesh.position.z = Math.sin(s.angle) * (3.2 + scrollProgress * 1.5);
      }

      camera.position.z = 6.2 - scrollProgress * 3.5;
      renderer.render(scene, camera);
    }
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      window.removeEventListener('scroll', updateScroll);
      window.removeEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      });
    };
  }, []);

  return (
    <div className="kinetic-storefront min-h-screen bg-paper">
      {/* Scroll-driven Three.js Background */}
      <div className="fixed inset-0 w-full h-full pointer-events-none z-0" aria-hidden="true">
        <div id="threejs-bg-canvas" className="w-full h-full" />
      </div>

      {/* Sticky Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-paper/95 backdrop-blur border-b-2 border-lime px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-lime text-black font-black flex items-center justify-center text-xl border-2 border-black shadow-[3px_3px_0px_rgb(var(--color-ink))]">
              PC
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-bold tracking-tighter text-lg">
                <span className="text-lime">KINETIC //</span>
                <span className="text-ink">ACID BRUTALIST</span>
              </div>
              <div className="text-[10px] font-mono text-lime/80 flex items-center gap-1 uppercase tracking-widest">
                <span className="w-1.5 h-1.5 bg-lime rounded-full animate-ping" />
                AIVEN CQRS ENGINE // ZERO-OVERSELL 3D STOREFRONT
              </div>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-1 bg-surface border-2 border-lime/20 p-1 font-mono text-[11px]">
            <a className="px-3 py-1 text-ink/60 hover:text-lime" href="#hero">3D DIVE</a>
            <a className="px-3 py-1 text-ink/60 hover:text-lime" href="#architecture">ARCHITECTURE</a>
            <a className="px-3 py-1 text-ink/60 hover:text-lime" href="#search-engine">OPENSEARCH</a>
            <a className="px-3 py-1 text-ink/60 hover:text-lime" href="#catalog">HARDWARE DROPS</a>
            <a className="px-3 py-1 text-ink/60 hover:text-lime" href="#telemetry">KAFKA LOGS</a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setUpiModal({ sku: 'CART', amount: 0 })}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-lime text-black font-mono text-[12px] font-black border-2 border-black shadow-[3px_3px_0px_rgb(var(--color-ink))] hover:translate-x-0.5 hover:translate-y-0.5 transition-transform"
            >
              <span className="material-symbols-outlined text-[18px]">shopping_cart</span>
              <span>CART</span>
            </button>
          </div>
        </div>
      </header>

      {/* HUD Status Bar */}
      <div className="fixed top-[62px] left-0 right-0 z-30 bg-paper/90 backdrop-blur border-b border-lime/20 px-4 lg:px-8 py-1.5 font-mono text-[11px] text-ink/60 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 bg-surface border border-lime text-lime font-bold">[WEBGL 2.0 // THREE.JS KINETIC ENGINE]</span>
          <span className="hidden md:inline">COORDS: <strong className="text-ink" id="live-coords">[X:0.00 // Y:0.00 // Z:6.20]</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 bg-surface border border-lime/20 text-lime" id="live-scroll">SCROLL DEPTH // [░░░░░░░░░░] 0%</span>
          <span className="px-2 py-0.5 bg-surface border border-lime/20 text-ink">60 FPS</span>
          <span className="hidden sm:inline px-2 py-0.5 bg-lime text-black font-bold">[SCROLL TO ENGAGE // CLICK CARDS TO INSPECT 3D]</span>
        </div>
      </div>

      {/* Main Content */}
      <main className="relative z-10 w-full pt-28">

        {/* HERO SECTION */}
        <section id="hero" className="min-h-[85vh] flex flex-col justify-between px-4 lg:px-8 py-8 max-w-7xl mx-auto">
          <div className="flex flex-wrap justify-between items-start gap-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-lime text-black font-mono text-[11px] font-black uppercase border border-black shadow-[3px_3px_0px_rgb(var(--color-ink))]">
              HIGH-TENSILE EVENT-DRIVEN HARDWARE CATALOG // AIVEN CLOUD
            </div>
            <div className="bg-surface/90 border border-lime/20 p-2.5 font-mono text-[11px] text-ink/60">
              <span className="text-ink font-bold">ENGINE: GLTF-DRACO</span> // <span className="text-cyan">15-MIN PESSIMISTIC LEASES</span>
            </div>
          </div>

          <div className="my-auto py-10 max-w-4xl">
            <div className="text-[12px] font-mono text-lime uppercase mb-2 font-bold flex items-center gap-2">
              <span>// ULTRA-LOW LATENCY E-COMMERCE CORE</span>
              <span className="h-0.5 w-12 bg-lime" />
            </div>
            <h1 className="text-[44px] sm:text-[64px] lg:text-[84px] font-black leading-[0.92] uppercase tracking-tighter drop-shadow-[4px_4px_0px_rgb(var(--color-ink))]">
              KINETIC 3D<br />
              <span className="text-lime underline decoration-cyan decoration-4">ZERO-OVERSELL</span><br />
              HARDWARE
            </h1>
            <p className="mt-5 max-w-2xl bg-surface/90 border-2 border-lime/20 p-4 text-ink text-[14px] leading-relaxed shadow-[4px_4px_0px_rgb(var(--color-ink))]">
              Continuous synchronous inventory leases via PostgreSQL row-locks (<code className="text-lime font-mono">FOR UPDATE NOWAIT</code>) streamed directly over Apache Kafka to an immutable 3D OpenSearch catalog interface. Guaranteed zero overselling during hyper-contention drops.
            </p>

            <div className="mt-6 flex flex-wrap gap-4 font-mono text-[12px]">
              <a href="#catalog" className="px-6 py-3.5 bg-lime text-black font-black uppercase hover:bg-white transition-all border-2 border-black shadow-[4px_4px_0px_rgb(var(--color-ink))] flex items-center gap-2">
                <span>ENTER STORE CATALOG</span>
                <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
              </a>
              <a href="#architecture" className="px-5 py-3.5 bg-surface border-2 border-lime/20 text-ink hover:border-lime hover:text-lime shadow-[4px_4px_0px_rgb(var(--color-ink))] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-lime">terminal</span>
                <span>INSPECT AIVEN CQRS ENGINE</span>
              </a>
            </div>
          </div>

          <div className="bg-surface/95 border-2 border-black p-3.5 shadow-[4px_4px_0px_rgb(var(--color-ink))] flex flex-wrap justify-between items-center gap-2 font-mono text-[11px]">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-lime text-black font-bold">3D CONTROLS</span>
              <span className="text-ink">[SCROLL TO ENGAGE ENGINE CAMERA // CLICK HARDWARE CARDS TO OPEN 3D INSPECTOR]</span>
            </div>
            <div className="text-lime">
              PRODUCTS LOADED: <strong>{products.length} SKUS</strong>
            </div>
          </div>
        </section>

        {/* TICKER RIBBON */}
        <div className="w-full bg-lime text-black py-2.5 border-y-2 border-black font-mono text-[12px] font-black uppercase tracking-widest overflow-hidden whitespace-nowrap">
          <div className="flex gap-6 animate-pulse">
            <span>3D MESH ARCHITECTURE</span> • <span>NO-OVERSELL RECOVERY ENGINE</span> • <span>LEVENSHTEIN FUZZY OPENSEARCH</span> • <span>15-MIN PESSIMISTIC LOCKS</span> • <span>DISPATCHING TO BLR (15m), MUM (45m), DEL (1h), HYD (35m)</span> • <span>KAFKA REPLICATION FACTOR 3</span> • <span>ATOMIC POSTGRES ROW-LOCKING</span>
          </div>
        </div>

        {/* HARDWARE DROPS STORE SECTION */}
        <section id="catalog" className="py-16 px-4 lg:px-8 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <div className="text-lime font-mono text-[11px] uppercase font-bold tracking-widest mb-1">
                // PHYSICAL SPECIMENS & DROPS ● AVAILABLE FOR PESSIMISTIC ALLOCATION
              </div>
              <h2 className="text-[32px] lg:text-[42px] font-black uppercase tracking-tight text-ink">
                HIGH-TENSILE HARDWARE DROPS
              </h2>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="text-ink/60">CLICK ANY CARD TO:</span>
              <span className="px-2.5 py-1 bg-lime text-black font-black uppercase border border-black shadow-[2px_2px_0px_rgb(var(--color-ink))]">
                INSPECT 3D OBJECT
              </span>
            </div>
          </div>

          <div className="filter-panel" style={{ position: 'relative', top: 'auto' }}>
            <form id="catalog-search" onSubmit={onSearch} className="filter-form" aria-label="Find products">
              <label className="search-field">
                <span aria-hidden="true" className="search-icon">⌕</span>
                <span className="sr-only">Search products</span>
                <input type="search" placeholder="Search products" value={query} onChange={(e) => setQuery(e.target.value)} />
              </label>
              <label className="filter-select">
                <span className="sr-only">Category</span>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">All categories</option>
                  {categories.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="filter-select">
                <span className="sr-only">Delivery city</span>
                <select value={city} onChange={(e) => setCity(e.target.value)}>
                  <option value="">All cities</option>
                  {cities.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <details className="price-filter">
                <summary>Price <span aria-hidden="true">＋</span></summary>
                <div className="price-fields">
                  <label><span className="sr-only">Minimum price in rupees</span><input type="number" min="0" step="0.01" placeholder="Min ₹" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} /></label>
                  <span aria-hidden="true">—</span>
                  <label><span className="sr-only">Maximum price in rupees</span><input type="number" min="0" step="0.01" placeholder="Max ₹" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} /></label>
                </div>
              </details>
              {(query || category || city || minPrice || maxPrice) && (
                <button className="clear-filter-button" type="button" onClick={clearFilters}>Clear</button>
              )}
            </form>
            <button className="run-query-button" type="submit" form="catalog-search">Run fuzzy query</button>
            <div className="results-count" aria-live="polite">{loading ? 'Loading…' : `${products.length} ${products.length === 1 ? 'product' : 'products'}`}</div>
          </div>

          {error && <p role="alert" className="store-error">{error}</p>}
          {!loading && !error && products.length === 0 && (
            <div className="empty-results">
              <p>No products found. Try changing your search or filters.</p>
              {(query || category || city || minPrice || maxPrice) && (
                <button className="text-link" onClick={clearFilters}>Clear filters</button>
              )}
            </div>
          )}

          <div className="product-grid" aria-busy={loading}>
            {products.map((product, index) => {
              const type = PRODUCT_TYPES[product.category as keyof typeof PRODUCT_TYPES] || 'rig';
              return (
                <div
                  key={`${product.id}-${product.city || ''}`}
                  onClick={() => openInspector(product)}
                  className="bg-surface border-2 border-black shadow-[4px_4px_0px_rgb(var(--color-ink))] hover:border-lime transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    <div className="p-2.5 bg-paper border-b border-lime/20 flex justify-between font-mono text-[11px]">
                      <span className="text-lime font-bold">SKU: {product.sku}</span>
                      <span className="text-cyan font-bold">IN STOCK</span>
                    </div>
                    <div className="relative h-56 bg-paper overflow-hidden">
                      <ProductArtwork category={product.category} imageUrl={product.image_url} name={product.name} />
                      <button className="absolute top-2 right-2 px-2 py-0.5 bg-paper/90 border border-lime text-lime font-mono text-[10px] font-bold uppercase group-hover:bg-lime group-hover:text-black transition-colors">
                        [ 3D ROTATABLE ]
                      </button>
                      <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-paper/90 text-ink font-mono text-[10px]">CATEGORY: {product.category.toUpperCase()}</div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-[17px] text-ink uppercase">{product.name}</h3>
                      <div className="text-lime text-[20px] font-black font-mono my-1">{formatPrice(product.price_paise)}</div>
                      <p className="text-[12px] text-ink/60 mb-3">{product.description}</p>
                      <div className="flex gap-1 font-mono text-[10px] text-ink/60">
                        <span className="bg-paper px-2 py-0.5 border border-lime/20">{product.category.toUpperCase()}</span>
                        <span className="bg-paper px-2 py-0.5 border border-lime/20">{product.sku}</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 pt-0 flex gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); addToCart(product); }}
                      className="flex-1 py-2.5 bg-lime text-black font-mono text-[11px] font-black uppercase hover:bg-white border-2 border-black shadow-[2px_2px_0px_rgb(var(--color-ink))]"
                    >
                      ADD TO CART
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleUpiClick(product.sku, product.price_paise); }}
                      className="px-3 py-2.5 bg-surface border-2 border-black text-ink hover:text-lime"
                    >
                      <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ARCHITECTURE BENCHMARKS SECTION */}
        <section id="architecture" className="py-16 px-4 lg:px-8 bg-paper/90 border-t-2 border-b-2 border-black">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <div className="text-lime font-mono text-[11px] uppercase font-bold tracking-widest mb-1">// ARCHITECTURAL BENCHMARKS</div>
              <h2 className="text-[30px] font-black uppercase text-ink">HIGH-CONCURRENCY MESH ENGINE</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono">
              <div className="bg-surface border-2 border-black p-6 shadow-[4px_4px_0px_rgb(var(--color-ink))]">
                <div className="text-lime text-xs font-bold mb-2">SPEC // 01 [DRACO_COMPRESS]</div>
                <h3 className="text-ink text-lg font-bold mb-2">PROCEDURAL 3D HARDWARE</h3>
                <p className="text-ink/60 text-xs mb-4">Full client-side GLTF parametric generation rendered at 60 FPS matching CNC tolerances.</p>
                <div className="text-[11px] text-cyan">MESH BUFFER: 100% PBR SHADERS</div>
              </div>
              <div className="bg-surface border-2 border-black p-6 shadow-[4px_4px_0px_rgb(var(--color-ink))]">
                <div className="text-lime text-xs font-bold mb-2">SPEC // 02 [ROW_EXCLUSIVE]</div>
                <h3 className="text-ink text-lg font-bold mb-2">ATOMIC POSTGRES ROW-LOCK</h3>
                <p className="text-ink/60 text-xs mb-4">Strict pessimistic checkout queue (FOR UPDATE NOWAIT) guarantees 0% oversell under load.</p>
                <div className="text-[11px] text-lime">ACTIVE LEASES: SYNCHRONOUS</div>
              </div>
              <div className="bg-surface border-2 border-black p-6 shadow-[4px_4px_0px_rgb(var(--color-ink))]">
                <div className="text-lime text-xs font-bold mb-2">SPEC // 03 [KAFKA_CDC]</div>
                <h3 className="text-ink text-lg font-bold mb-2">INSTANT OPENSEARCH SYNC</h3>
                <p className="text-ink/60 text-xs mb-4">Typo-tolerant fuzzy searching via Levenshtein distance metrics updating in {"<"}3.2ms.</p>
                <div className="text-[11px] text-cyan">QUERY LATENCY: 3.2ms TYPICAL</div>
              </div>
            </div>
          </div>
        </section>

        {/* OPENSEARCH CONSOLE SECTION */}
        <section id="search-engine" className="py-16 px-4 lg:px-8 max-w-7xl mx-auto">
          <div className="bg-paper border-2 border-black shadow-[6px_6px_0px_rgb(var(--color-ink))] p-6 font-mono">
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-lime/20 text-xs">
              <span className="text-lime font-bold">OPENSEARCH CLUSTER QUERY CONSOLE // LEVENSHTEIN 2</span>
              <span className="text-cyan">STATUS: GREEN (12 SHARDS)</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                id="search-input"
                defaultValue="bluetoth anc hedphones"
                className="flex-1 bg-surface border-2 border-lime/20 px-4 py-2 text-ink font-mono focus:outline-none focus:border-lime"
              />
              <button
                onClick={() => showToast('OPENSEARCH 2.12: LEVENSHTEIN DISTANCE RESOLVED IN 3.2ms')}
                className="px-6 py-2 bg-lime text-black font-black uppercase border-2 border-black"
              >
                RUN FUZZY QUERY
              </button>
            </div>
            <div className="mt-3 text-xs text-ink/60 flex justify-between">
              <span>SUGGESTION: <strong className="text-lime cursor-pointer" onClick={() => { const input = document.getElementById('search-input') as HTMLInputElement; if (input) { input.value = 'Bluetooth ANC Headphones'; showToast('OPENSEARCH 2.12: LEVENSHTEIN DISTANCE RESOLVED IN 3.2ms'); } }}>Did you mean "Bluetooth ANC Headphones"?</strong></span>
              <span className="text-cyan">LATENCY: 3.2ms</span>
            </div>
          </div>
        </section>

        {/* KAFKA CDC & METRO DISPATCH */}
        <section id="telemetry" className="py-16 px-4 lg:px-8 bg-surface/95 border-t-2 border-black">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 font-mono">
            <div className="bg-paper border-2 border-black p-4 shadow-[4px_4px_0px_rgb(var(--color-ink))]">
              <div className="flex justify-between pb-2 mb-3 border-b border-lime/20 text-xs">
                <span className="text-ink font-bold">KAFKA CDC REPLICATION SINK</span>
                <span className="text-lime">TOPIC: inventory_leases</span>
              </div>
              <div id="kafka-log" className="text-[11px] text-ink/60 flex flex-col gap-1.5 h-44 overflow-y-auto">
                <div>[0.0012s] LEASE_ACQUIRED: SKU: ELECTRONICS-BLUETOOTH-HEADPHONES | LOCK_TOKEN: 0x8F9A41 | DC: BLR</div>
                <div className="text-lime">[0.0034s] KAFKA_PRODUCED: TOPIC: inventory-events-v1 | OFFSET: 48920194</div>
                <div className="text-cyan">[0.0051s] OPENSEARCH_SINK: SYNCED DOC IN 2.1ms</div>
                <div>[0.0089s] LEASE_HEARTBEAT: CLIENT: 0x33C12A | LEASE_TTL: 899s / 900s</div>
                <div className="text-ink">[0.0145s] POSTGRES_TXN: COMMIT (ROW_LOCK_GRANTED // FOR UPDATE NOWAIT)</div>
              </div>
            </div>
            <div className="bg-paper border-2 border-black p-4 shadow-[4px_4px_0px_rgb(var(--color-ink))]">
              <div className="text-xs text-lime font-bold mb-3">INDIAN METRO DISPATCH MATRIX</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-surface border border-lime/20">
                  <div className="text-ink font-bold">BLR CENTRAL HUB</div>
                  <div className="text-lime font-bold mt-1">15 MINS [PRIORITY]</div>
                </div>
                <div className="p-2.5 bg-surface border border-lime/20">
                  <div className="text-ink font-bold">MUMBAI BKC</div>
                  <div className="text-ink font-bold mt-1">45 MINS</div>
                </div>
                <div className="p-2.5 bg-surface border border-lime/20">
                  <div className="text-ink font-bold">DELHI CYBERCITY</div>
                  <div className="text-ink font-bold mt-1">1 HOUR AIR</div>
                </div>
                <div className="p-2.5 bg-surface border border-lime/20">
                  <div className="text-ink font-bold">HYD HITEC CITY</div>
                  <div className="text-ink font-bold mt-1">35 MINS</div>
                </div>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* 3D OBJECT INSPECTOR MODAL */}
      {modalOpen && modalProduct && (
        <div id="product-3d-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6" onClick={closeInspector} onKeyDown={(e) => { if (e.key === 'Escape') closeInspector(); }}>
          <div
            className="bg-paper border-2 border-lime shadow-[8px_8px_0px_rgb(var(--color-ink))] w-full max-w-7xl h-[92vh] max-h-[900px] flex flex-col overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div id="modal-title" className="h-12 bg-surface border-b-2 border-black px-4 flex items-center justify-between flex-shrink-0 select-none font-mono">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 bg-lime animate-ping" />
                <span className="text-[11px] sm:text-[12px] font-black tracking-wider text-ink uppercase">
                  // SPECIMEN INSPECTOR [3D WEBGL ENGINE] // COORDS & MESH TELEMETRY
                </span>
                <span className="hidden md:inline px-2 py-0.5 bg-surface text-cyan text-[10px] font-bold border border-lime/20">
                  ACTIVE SESSION: <span id="modal-token-disp">0x{Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0')}</span>
                </span>
              </div>
              <button onClick={closeInspector} className="px-3 py-1 bg-paper hover:bg-lime text-ink hover:text-black border border-lime/20 hover:border-black text-[11px] font-bold uppercase transition-colors">
                [ESC / CLOSE ✕]
              </button>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
              <div className="w-full lg:w-[60%] h-1/2 lg:h-full relative bg-paper border-b-2 lg:border-b-0 lg:border-r-2 border-black flex flex-col">
                <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none select-none font-mono">
                  <div className="px-2.5 py-1 bg-paper/90 border border-lime/20 text-[10px] flex items-center gap-2 pointer-events-auto">
                    <span className="text-lime font-bold">FPS: 60</span>
                    <span className="text-ink/40">//</span>
                    <span className="text-ink" id="modal-mesh-verts">VERTICES: LOADING...</span>
                    <span className="text-ink/40">//</span>
                    <span className="text-cyan">SHADER: PBR_DRACO</span>
                  </div>
                  <div className="flex items-center gap-1 pointer-events-auto">
                    <button
                      id="btn-wireframe-mode"
                      onClick={() => setModalWireframe(!modalWireframe)}
                      className={`px-2 py-1 bg-surface border border-lime/20 text-ink hover:bg-lime hover:text-black text-[10px] uppercase font-bold transition-colors ${modalWireframe ? 'bg-lime text-black' : ''}`}
                    >
                      [WIREFRAME]
                    </button>
                    <button
                      id="btn-explode-mode"
                      onClick={() => setModalExploded(!modalExploded)}
                      className={`px-2 py-1 bg-surface border border-lime/20 text-ink hover:bg-lime hover:text-black text-[10px] uppercase font-bold transition-colors ${modalExploded ? 'bg-lime text-black' : ''}`}
                    >
                      [X-RAY EXPLODE]
                    </button>
                    <button onClick={() => showToast('CAMERA ORIENTATION RESET')} className="px-2 py-1 bg-surface border border-lime/20 text-ink hover:bg-lime hover:text-black text-[10px] uppercase font-bold transition-colors">
                      [RESET VIEW]
                    </button>
                  </div>
                </div>

                <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 pointer-events-auto select-none font-mono">
                  <span className="px-2 py-0.5 bg-paper border border-lime/20 text-ink/60 text-[9px] uppercase">CAM PRESETS:</span>
                  <button onClick={() => showToast('CAMERA: FRONT VIEW')} className="px-2 py-0.5 bg-surface hover:bg-lime hover:text-black text-ink border border-lime/20 text-[10px] font-bold uppercase">FRONT</button>
                  <button onClick={() => showToast('CAMERA: ISOMETRIC VIEW')} className="px-2 py-0.5 bg-lime text-black border border-black text-[10px] font-bold uppercase">ISOMETRIC</button>
                  <button onClick={() => showToast('CAMERA: TOP-DOWN VIEW')} className="px-2 py-0.5 bg-surface hover:bg-lime hover:text-black text-ink border border-lime/20 text-[10px] font-bold uppercase">TOP-DOWN</button>
                </div>

                <div className="absolute bottom-3 right-3 z-10 hidden sm:block px-2 py-1 bg-paper/80 border border-lime/20 text-[9px] font-mono text-ink/60 pointer-events-none select-none">
                  DRAG MOUSE: 360° ORBIT // SCROLL: ZOOM
                </div>

                <div id="modal-threejs-canvas" className="w-full h-full cursor-grab active:cursor-grabbing" />
              </div>

              <div className="w-full lg:w-[40%] h-1/2 lg:h-full bg-surface flex flex-col justify-between p-4 sm:p-6 overflow-y-auto">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-lime/20 font-mono">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-lime text-black text-[11px] font-black uppercase">SKU: {modalProduct.sku}</span>
                      <span className="px-2 py-0.5 bg-surface text-cyan text-[10px] font-bold border border-lime/20">IN STOCK</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-red-500 font-mono font-bold bg-surface px-2 py-0.5 border border-lime/20">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                      <span>TTL: <span id="modal-countdown">14:58</span> MIN</span>
                    </div>
                  </div>

                  <div>
                    <h2 className="text-[24px] sm:text-[28px] font-black text-ink uppercase tracking-tight leading-tight">{modalProduct.name}</h2>
                    <div className="flex items-baseline gap-3 mt-1">
                      <div className="text-[26px] sm:text-[30px] font-black text-lime font-mono">{formatPrice(modalProduct.price_paise)}</div>
                      <div className="text-ink/60 font-mono text-[11px]">INCL. 18% GST + RAPID DISPATCH</div>
                    </div>
                    <p className="mt-2 text-ink/60 text-[13px] leading-relaxed">{modalProduct.description}</p>
                  </div>

                  <div className="bg-paper border border-lime/20 p-3 text-[11px] font-mono">
                    <div className="text-lime font-bold uppercase pb-1.5 mb-2 border-b border-surface flex justify-between">
                      <span>FABRICATION SPECIFICATIONS</span>
                      <span className="text-cyan text-[10px]">CNC TOLERANCE PASS</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-ink/60">
                      <div>CATEGORY: <span className="text-ink font-bold">{modalProduct.category.toUpperCase()}</span></div>
                      <div>PRICE: <span className="text-ink font-bold">{formatPrice(modalProduct.price_paise)}</span></div>
                      <div>SKU: <span className="text-ink font-bold">{modalProduct.sku}</span></div>
                      <div>TYPE: <span className="text-ink font-bold">{PRODUCT_TYPES[modalProduct.category as keyof typeof PRODUCT_TYPES]?.toUpperCase() || 'RIG'}</span></div>
                    </div>
                  </div>

                  <div className="bg-paper border border-lime/20 p-3 text-[10px] font-mono flex flex-col gap-1">
                    <div className="flex justify-between text-ink/60 border-b border-surface pb-1">
                      <span className="text-lime font-bold">ROW-LOCK TELEMETRY STREAM</span>
                      <span>AIVEN POSTGRES 16</span>
                    </div>
                    <div className="text-cyan truncate">[TXN_BEGIN] 0xAE1992 SELECT ... FOR UPDATE NOWAIT</div>
                    <div className="text-ink truncate" id="modal-stream-notice">[LOCK_GRANTED] PESSIMISTIC HOLD // 900s REVERSIBLE</div>
                    <div className="text-ink/60 truncate">[CDC_DEBEZIUM] kafka.topic.leases partition=2 offset=91823901</div>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-2.5 pt-4 border-t border-lime/20 font-mono">
                  <button onClick={commitLock} className="w-full py-3.5 bg-lime hover:bg-white text-black text-[13px] font-black uppercase tracking-wider transition-all border-2 border-black shadow-[4px_4px_0px_rgb(var(--color-ink))] flex items-center justify-center gap-2">
                    <span>PESSIMISTIC LOCK & RESERVE SKU</span>
                    <span className="material-symbols-outlined text-[18px]">lock</span>
                  </button>
                  <div className="flex gap-2 text-[11px]">
                    <button onClick={() => showToast('CAD PACKAGE (.STEP / .GLTF) EXPORTED SUCCESSFULLY')} className="flex-1 py-2 bg-surface hover:bg-paper text-ink border border-lime/20 hover:border-lime font-bold uppercase transition-colors flex items-center justify-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px] text-lime">download</span>
                      <span>DOWNLOAD CAD .STEP</span>
                    </button>
                    <button onClick={() => handleUpiClick(modalProduct.sku, modalProduct.price_paise)} className="px-4 py-2 bg-surface hover:bg-paper text-cyan border border-lime/20 font-bold uppercase transition-colors flex items-center justify-center">
                      <span>UPI PAY</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATIONS */}
      <div id="toast-container" className="fixed bottom-6 right-6 z-50 pointer-events-none flex flex-col gap-2">
        {toasts.map((msg, i) => (
          <div key={i} className="bg-surface border-2 border-lime text-ink px-4 py-2 font-mono text-xs shadow-[4px_4px_0px_rgb(var(--color-ink))] animate-slide-in">
            {msg}
          </div>
        ))}
      </div>

      {/* UPI MODAL */}
      {upiModal && (
        <div id="upi-modal" role="dialog" aria-modal="true" aria-labelledby="upi-modal-title" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setUpiModal(null)} onKeyDown={(e) => { if (e.key === 'Escape') setUpiModal(null); }}>
          <div className="bg-surface border-4 border-lime shadow-[8px_8px_0px_rgb(var(--color-ink))] w-full max-w-md p-6 relative font-mono" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setUpiModal(null)} className="absolute top-4 right-4 text-ink hover:text-lime text-sm uppercase">[CLOSE ✕]</button>
            <div className="text-lime text-xs font-bold mb-1">ATOMIC UPI SETTLEMENT ENGINE</div>
            <h3 id="upi-modal-title" className="text-xl font-black text-ink uppercase font-sans mb-2">INSTANT QR PAYMENT</h3>
            <p className="text-xs text-ink/60 mb-4">Locked under Row Lease Token: <code className="text-lime">0x{Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0')}</code></p>

            <div className="bg-white p-4 border-2 border-black w-48 h-48 mx-auto flex items-center justify-center relative mb-4">
              <div className="w-full h-full bg-paper grid grid-cols-5 grid-rows-5 gap-1 p-2">
                <div className="bg-white col-span-2 row-span-2" />
                <div className="bg-transparent" />
                <div className="bg-white col-span-2 row-span-2" />
                <div className="bg-lime" />
                <div className="bg-white" />
                <div className="bg-lime" />
                <div className="bg-white col-span-2 row-span-2" />
                <div className="bg-transparent" />
                <div className="bg-white col-span-2 row-span-2" />
              </div>
            </div>
            <div className="text-center mb-4">
              <div className="text-2xl font-black text-lime">{upiModal.amount > 0 ? formatPrice(upiModal.amount) : 'SELECT PRODUCT'}</div>
              <div className="text-[10px] text-ink/60">VPA: kinetic.drops@icici</div>
            </div>
            <button onClick={simulateUpiSuccess} className="w-full py-3 bg-lime text-black font-black uppercase border-2 border-black shadow-[3px_3px_0px_rgb(var(--color-ink))]">
              CONFIRM UPI PAYMENT
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in { animation: slide-in 0.3s ease-out; }
      `}</style>
    </div>
  );
}

