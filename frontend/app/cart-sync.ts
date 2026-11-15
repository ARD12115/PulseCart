// Keeps the browser cart (localStorage, for instant UI) mirrored in PostgreSQL.
// Syncing is best-effort: if the API is unreachable the cart still works locally.

const CART_ID_KEY = 'pulsecart_cart_id';
const LOCAL_CART_KEY = 'pulsecart_cart';
export const LOCAL_CART_UPDATED_KEY = 'pulsecart_cart_updated_at';

export type CartItem = { id: number; name: string; sku: string; price_paise: number; qty: number };

type ServerCart = { cart_id: string; updated_at: string; items: CartItem[] };

export function currentCartId(): string | null {
  try {
    return localStorage.getItem(CART_ID_KEY);
  } catch {
    return null;
  }
}

async function createCartId(): Promise<string | null> {
  try {
    const response = await fetch('/api/carts', { method: 'POST' });
    if (!response.ok) return null;
    const cart = (await response.json()) as ServerCart;
    localStorage.setItem(CART_ID_KEY, cart.cart_id);
    return cart.cart_id;
  } catch {
    return null;
  }
}

export async function syncCart(items: Pick<CartItem, 'id' | 'qty'>[]): Promise<void> {
  try {
    localStorage.setItem(LOCAL_CART_UPDATED_KEY, String(Date.now()));
  } catch {
    // Keep syncing to the server when browser storage is unavailable.
  }
  const body = JSON.stringify({ items: items.map((item) => ({ product_id: item.id, qty: item.qty })) });
  const headers = { 'Content-Type': 'application/json' };
  try {
    let cartId = currentCartId() ?? (await createCartId());
    if (!cartId) return;
    const response = await fetch(`/api/carts/${cartId}`, { method: 'PUT', headers, body });
    if (response.status === 404) {
      // The server no longer knows this cart (for example a reset database): start a new one.
      localStorage.removeItem(CART_ID_KEY);
      cartId = await createCartId();
      if (!cartId) return;
      await fetch(`/api/carts/${cartId}`, { method: 'PUT', headers, body });
    }
  } catch {
    // Offline or API down: the local cart keeps working.
  }
}

// If localStorage was cleared but the cart ID survived, rebuild the cart from PostgreSQL.
export async function restoreCart(): Promise<CartItem[]> {
  const cartId = currentCartId();
  if (!cartId) return [];
  try {
    const response = await fetch(`/api/carts/${cartId}`);
    if (!response.ok) return [];
    const cart = (await response.json()) as ServerCart;
    const updatedAt = Date.parse(cart.updated_at);
    if (!Number.isFinite(updatedAt)) return [];
    localStorage.setItem(LOCAL_CART_UPDATED_KEY, String(updatedAt));
    localStorage.setItem(LOCAL_CART_KEY, JSON.stringify(cart.items));
    return cart.items;
  } catch {
    return [];
  }
}

// crypto.randomUUID only exists in secure contexts (https or localhost).
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
