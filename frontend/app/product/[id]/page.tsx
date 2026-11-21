'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { syncCart } from '../../cart-sync';

type Product = { id: number; sku: string; name: string; description: string; category: string; price_paise: number; image_url: string | null };
type CartItem = Product & { qty: number };
type Inventory = { product_id: number; city: string; stock: number }[];

const formatPrice = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paise / 100);

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
      <div className="bg-surface-container-lowest text-on-surface min-h-screen p-space-lg">
        <Link href="/" className="font-label-md text-label-md text-primary underline underline-offset-4 hover:text-primary-container">
          ← Back to catalog
        </Link>
        <p role="alert" className="mt-space-md font-body-md text-body-md text-error">{error}</p>
      </div>
    );
  }
  if (!product) return <p className="bg-surface-container-lowest text-on-surface p-space-lg">Loading product…</p>;

  const available = inventory.some((item) => item.stock > 0);

  return (
    <div className="bg-surface-container-lowest text-on-surface min-h-screen">
      <section className="w-full bg-surface-container-low text-on-surface-variant border-b border-outline-variant/30">
        <div className="max-w-[1440px] mx-auto px-margin-lg py-2 flex flex-wrap items-center justify-between gap-space-sm">
          <div className="flex items-center gap-space-md">
            <span className="font-label-sm text-label-sm text-outline tracking-wider uppercase">
              SKU // {product.sku}
            </span>
            <div className="h-3 w-px bg-outline-variant/60"></div>
            <div className="flex items-center gap-space-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              <span className="font-tabular-data-md text-tabular-data-md text-secondary">
                POSTGRES ENGINE: SERIALIZABLE ISOLATION
              </span>
            </div>
          </div>
          <div className="flex items-center gap-space-lg font-tabular-data-md text-tabular-data-md text-on-surface-variant">
            <span className="font-tabular-data-md text-tabular-data-md">NODE: BLR-CENTRAL-04</span>
            <span className="font-tabular-data-md text-tabular-data-md">RTT: 0.42ms</span>
          </div>
        </div>
      </section>

      <main className="w-full py-space-xl px-margin-lg">
        <div className="max-w-[1440px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-lg items-start">
            <div className="lg:col-span-7 flex flex-col gap-space-lg">
              <div className="relative w-full bg-surface-container-low rounded-lg p-space-lg flex flex-col justify-between overflow-hidden group shadow-sm border border-outline/50">
                <div className="absolute -top-24 -left-24 w-96 h-96 bg-surface-container rounded-full blur-3xl opacity-60 pointer-events-none"></div>
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-space-xs px-2.5 py-1 bg-surface-container-lowest rounded-md shadow-sm border border-outline/30">
                    <span className="material-symbols-outlined text-[16px] text-secondary">view_in_ar</span>
                    <span className="font-label-sm text-label-sm text-on-surface tracking-wider uppercase">
                      Product Visualizer
                    </span>
                  </div>
                  <div className="flex items-center gap-1 font-tabular-data-md text-tabular-data-md text-outline bg-surface-container-lowest px-2 py-1 rounded-sm border border-outline/30">
                    <span>ROTATION ANGLE:</span>
                    <span className="text-on-surface font-semibold" id="rotationDegrees">
                      000°
                    </span>
                  </div>
                </div>
                <div className="relative z-10 my-space-lg flex items-center justify-center min-h-[460px]">
                  <img
                    className="w-full max-w-[440px] h-auto object-contain transition-transform duration-500 ease-out select-none"
                    id="mainProductVisual"
                    src={
                      product.image_url ||
                        'https://lh3.googleusercontent.com/aida-public/AB6AXuB_byr6N5u0ZlVdIrBQxBdLlgsHW6LjHjOL2LLTBaWOQN16YGFOIexxN4KJ5LOX8nyTJlbl9jnrP3orCip6mxzQcfRM9YnIGl7W15IBxVDs6CYN4j3_j82B0YaJzQ66mNUCHM1mt4mJLrDDg2-tmP8segnIsomN16aWTFELJZBNvZ7LyRxwZND-_MTgnjN-VPKPFKin46OWozn9EXePFLbkYA49yvEvWwyL7S_MEBcA'
                    }
                    alt={product.name}
                  />
                </div>
                <div className="relative z-10 flex flex-col gap-1.5 bg-surface-container-lowest p-space-sm rounded-lg shadow-sm border border-outline/50">
                  <div className="flex items-center justify-between text-outline">
                    <span className="font-label-sm text-label-sm uppercase">Manual Perspective Yaw</span>
                    <span className="font-tabular-data-md text-label-sm text-on-surface-variant">DRAG TO INSPECT</span>
                  </div>
                  <input
                    className="w-full accent-primary h-1 bg-surface-container-highest rounded-lg cursor-pointer transition-all"
                    id="perspectiveSlider"
                    max="360"
                    min="0"
                    type="range"
                    value="0"
                  />
                </div>
                <div className="grid grid-cols-4 gap-space-sm">
                  <button className="view-thumb-btn flex flex-col gap-1 p-2 bg-surface-container-low hover:bg-surface-container rounded-lg text-left transition-colors border border-outline/30" data-view="primary" type="button">
                    <div className="aspect-square w-full rounded bg-surface-container-lowest overflow-hidden flex items-center justify-center p-1 border border-outline/30">
                      <img
                        className="w-full h-full object-contain"
                        alt={product.name}
                        src={
                          product.image_url ||
                            'https://lh3.googleusercontent.com/aida-public/AB6AXuCzrwf6bZ7MKi437kJa-R4SmVsPWyg4a-8gS0FlPDnmCN45CRm47g3-dqiswJvlLCtQxx32a3QEnB7vzhUg5xmRiSP0bBb6xGGO-P0kMA-BUKcaV7jm5wLR-bAc_csV_BHHGJNQw7RGOeMzyusOQVmB9Bur1i6TSDX_JnUMHE7AE-jENe8zQDGH68mI9_R5VXQq0Q17ZmuhV776xrHxLhd2Cor6PcsIiQcGRWiecaQy'
                        }
                      />
                    </div>
                    <span className="font-label-sm text-label-sm text-on-surface uppercase truncate">01. Profile</span>
                  </button>
                  <button className="view-thumb-btn flex flex-col gap-1 p-2 bg-surface-container-low hover:bg-surface-container rounded-lg text-left transition-colors border border-outline/30" data-view="folded" type="button">
                    <div className="aspect-square w-full rounded bg-surface-container-lowest overflow-hidden flex items-center justify-center p-1 border border-outline/30">
                      <img
                        className="w-full h-full object-contain"
                        alt={product.name}
                        src={
                          product.image_url ||
                            'https://lh3.googleusercontent.com/aida-public/AB6AXuCzrwf6bZ7MKi437kJa-R4SmVsPWyg4a-8gS0FlPDnmCN45CRm47g3-dqiswJvlLCtQxx32a3QEnB7vzhUg5xmRiSP0bBb6xGGO-P0kMA-BUKcaV7jm5wLR-bAc_csV_BHHGJNQw7RGOeMzyusOQVmB9Bur1i6TSDX_JnUMHE7AE-jENe8zQDGH68mI9_R5VXQq0Q17ZmuhV776xrHxLhd2Cor6PcsIiQcGRWiecaQy'
                        }
                      />
                    </div>
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase truncate">02. Folded</span>
                  </button>
                  <button className="view-thumb-btn flex flex-col gap-1 p-2 bg-surface-container-low hover:bg-surface-container rounded-lg text-left transition-colors border border-outline/30" data-view="earcups" type="button">
                    <div className="aspect-square w-full rounded bg-surface-container-lowest overflow-hidden flex items-center justify-center p-1 border border-outline/30">
                      <img
                        className="w-full h-full object-contain"
                        alt={product.name}
                        src={
                          product.image_url ||
                            'https://lh3.googleusercontent.com/aida-public/AB6AXuCzrwf6bZ7MKi437kJa-R4SmVsPWyg4a-8gS0FlPDnmCN45CRm47g3-dqiswJvlLCtQxx32a3QEnB7vzhUg5xmRiSP0bBb6xGGO-P0kMA-BUKcaV7jm5wLR-bAc_csV_BHHGJNQw7RGOeMzyusOQVmB9Bur1i6TSDX_JnUMHE7AE-jENe8zQDGH68mI9_R5VXQq0Q17ZmuhV776xrHxLhd2Cor6PcsIiQcGRWiecaQy'
                        }
                      />
                    </div>
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase truncate">03. Cushions</span>
                  </button>
                  <button className="view-thumb-btn flex flex-col gap-1 p-2 bg-surface-container-low hover:bg-surface-container rounded-lg text-left transition-colors border border-outline/30" data-view="ports" type="button">
                    <div className="aspect-square w-full rounded bg-surface-container-lowest overflow-hidden flex items-center justify-center p-1 border border-outline/30">
                      <img
                        className="w-full h-full object-contain"
                        alt={product.name}
                        src={
                          product.image_url ||
                            'https://lh3.googleusercontent.com/aida-public/AB6AXuCzrwf6bZ7MKi437kJa-R4SmVsPWyg4a-8gS0FlPDnmCN45CRm47g3-dqiswJvlLCtQxx32a3QEnB7vzhUg5xmRiSP0bBb6xGGO-P0kMA-BUKcaV7jm5wLR-bAc_csV_BHHGJNQw7RGOeMzyusOQVmB9Bur1i6TSDX_JnUMHE7AE-jENe8zQDGH68mI9_R5VXQq0Q17ZmuhV776xrHxLhd2Cor6PcsIiQcGRWiecaQy'
                        }
                      />
                    </div>
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase truncate">04. I/O Ports</span>
                  </button>
                </div>
                <div className="p-space-md bg-surface-container-low rounded-lg flex flex-wrap items-center justify-between gap-space-md border border-outline/50">
                  <div className="flex items-center gap-space-lg">
                    <div className="flex flex-col">
                      <span className="font-headline-sm text-headline-sm text-on-surface leading-none tracking-tight">ISO-9001</span>
                      <span className="font-label-sm text-label-sm text-outline uppercase mt-0.5">Acoustic QA Certified</span>
                    </div>
                    <div className="h-6 w-px bg-outline-variant/50"></div>
                    <div className="flex flex-col">
                      <span className="font-headline-sm text-headline-sm text-on-surface leading-none tracking-tight">CE // RoHS</span>
                      <span className="font-label-sm text-label-sm text-outline uppercase mt-0.5">Heavy Metal Free</span>
                    </div>
                    <div className="h-6 w-px bg-outline-variant/50"></div>
                    <div className="flex flex-col">
                      <span className="font-headline-sm text-headline-sm text-on-surface leading-none tracking-tight">EN-50332</span>
                      <span className="font-label-sm text-label-sm text-outline uppercase mt-0.5">Acoustic Pressure Safe</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:col-span-5 flex flex-col gap-space-lg">
              <section className="bg-surface-container-lowest rounded-lg shadow-sm border border-outline/50 p-space-lg" aria-labelledby="product-title">
                <p className="font-label-sm text-label-sm text-outline tracking-wider uppercase">{product.category}</p>
                <h1 id="product-title" className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
                  {product.name}
                </h1>
                <p className="font-body-md text-body-md text-on-surface-variant mt-space-sm">
                  {product.description}
                </p>
                <p className="font-tabular-price-lg text-tabular-price-lg text-primary mt-space-sm">
                  {formatPrice(product.price_paise)}
                </p>

                <div className="mt-space-lg">
                  <h2 className="font-label-sm text-label-sm uppercase tracking-wider text-outline mb-space-sm">Delivery availability</h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-sm">Choose a city in your cart to check out.</p>
                  <ul className="space-y-space-sm">
                    {inventory.map((item) => (
                      <li key={item.city} className="flex justify-between items-center p-1 rounded-sm bg-surface-container-low border border-outline/50">
                        <span className="font-tabular-data-md text-tabular-data-md text-on-surface">{item.city}</span>
                        <span
                          className={`font-tabular-data-md text-tabular-data-md ${
                            item.stock > 0 ? 'text-secondary' : 'text-error'
                          }`}
                        >
                          {item.stock > 0 ? 'In stock' : 'Out of stock'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  className={`w-full py-1.5 px-space-sm rounded-md font-label-md text-label-md flex items-center justify-center gap-1 transition-colors border ${
                    available
                      ? 'bg-primary text-on-primary hover:bg-primary-container border-transparent'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container border border-outline/30'
                  }`}
                  onClick={addToCart}
                  disabled={!available}
                >
                  {available ? 'Add to cart' : 'Currently unavailable'}
                </button>

                {message && (
                  <p role="status" className="mt-space-sm font-body-sm text-body-sm text-success">
                    {message} {message.startsWith('Added') && (
                      <Link href="/cart" className="text-primary underline underline-offset-4 hover:text-primary-container ml-space-sm">
                        Go to cart
                      </Link>
                    )}
                  </p>
                )}
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
