# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: accessibility.spec.ts >> Accessibility Tests >> Cart page - form fields have accessible names
- Location: tests\accessibility.spec.ts:93:3

# Error details

```
Error: expect(locator).toBeEnabled() failed

Locator: getByRole('button', { name: 'Add to cart' })
Expected: enabled
Timeout: 7000ms
Error: element(s) not found

Call log:
  - Expect "toBeEnabled" getByRole('button', { name: 'Add to cart' }) with timeout 7000ms
  - waiting for getByRole('button', { name: 'Add to cart' })

```

```yaml
- link "Skip to content":
  - /url: "#main-content"
- banner:
  - link "PulseCart home":
    - /url: /
    - strong: KINETIC //
    - text: PULSECART / ACID NEO-BRUTALIST
  - navigation "Main navigation":
    - link "3D dive":
      - /url: /#hero
    - link "Architecture":
      - /url: /#architecture
    - link "OpenSearch":
      - /url: /#search-console
    - link "Hardware":
      - /url: /#shop
    - link "Cart, 0 items":
      - /url: /cart
      - text: Cart
  - group: Display
- main:
  - paragraph: Loading product…
- contentinfo:
  - paragraph:
    - text: Good things,
    - emphasis: close by.
  - navigation "Footer navigation":
    - link "Shop":
      - /url: /#shop
    - link "Cart":
      - /url: /cart
    - link "Concurrency lab":
      - /url: /demo
    - link "Operations":
      - /url: /admin
    - link "Kinetic 3D storefront":
      - /url: /kinetic
  - text: PulseCart · Everyday finds from shops nearby.Stock is shown by delivery city.
```

# Test source

```ts
  1  | import { expect, type Page } from '@playwright/test';
  2  | 
  3  | type Product = { id: number; name: string };
  4  | 
  5  | export async function openAvailableProduct(page: Page, preferredId?: number): Promise<Product> {
  6  |   const base = page.url();
  7  |   const productsResponse = await page.request.get(new URL('/api/products?limit=100', base).toString());
  8  |   expect(productsResponse.ok(), 'product catalog API should be available').toBeTruthy();
  9  |   const products = await productsResponse.json() as Product[];
  10 |   const ordered = preferredId
  11 |     ? [...products.filter((product) => product.id === preferredId), ...products.filter((product) => product.id !== preferredId)]
  12 |     : products;
  13 | 
  14 |   for (const product of ordered) {
  15 |     const inventoryResponse = await page.request.get(
  16 |       new URL(`/api/products/${product.id}/inventory`, base).toString(),
  17 |     );
  18 |     if (!inventoryResponse.ok()) continue;
  19 |     const inventory = await inventoryResponse.json() as { stock: number }[];
  20 |     if (!inventory.some((item) => item.stock > 0)) continue;
  21 | 
  22 |     await page.goto(`/product/${product.id}`);
> 23 |     await expect(page.getByRole('button', { name: 'Add to cart' })).toBeEnabled();
     |                                                                     ^ Error: expect(locator).toBeEnabled() failed
  24 |     return product;
  25 |   }
  26 | 
  27 |   throw new Error('No seeded product has stock available for the test.');
  28 | }
  29 | 
  30 | export async function addAvailableProductToCart(page: Page, preferredId?: number): Promise<Product> {
  31 |   const product = await openAvailableProduct(page, preferredId);
  32 |   await page.getByRole('button', { name: 'Add to cart' }).click();
  33 |   await expect(page.locator('.cart-confirmation')).toContainText('Added to your cart.');
  34 |   return product;
  35 | }
  36 | 
```