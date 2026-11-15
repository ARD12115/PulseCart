'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type CartLine = { qty?: number };

function readCartCount() {
  try {
    const cart = JSON.parse(window.localStorage.getItem('pulsecart_cart') || '[]') as CartLine[];
    return cart.reduce((total, item) => total + (Number(item.qty) || 0), 0);
  } catch {
    return 0;
  }
}

export default function SiteControls() {
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const updateCount = () => setCartCount(readCartCount());
    updateCount();
    window.addEventListener('storage', updateCount);
    window.addEventListener('pulsecart:cart-updated', updateCount);
    return () => {
      window.removeEventListener('storage', updateCount);
      window.removeEventListener('pulsecart:cart-updated', updateCount);
    };
  }, []);

  return (
    <nav className="consumer-nav" aria-label="Main navigation">
      <Link href="/#shop">Shop</Link>
      <Link href="/cart" className="cart-nav-link" aria-label={`Cart, ${cartCount} items`}>
        Cart <span aria-hidden="true">{cartCount}</span>
      </Link>
    </nav>
  );
}
