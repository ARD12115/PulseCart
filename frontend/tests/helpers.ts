import { expect, type Page } from '@playwright/test';

type Product = { id: number; name: string };

export async function openAvailableProduct(page: Page, preferredId?: number): Promise<Product> {
  const base = page.url();
  const productsResponse = await page.request.get(new URL('/api/products?limit=100', base).toString());
  expect(productsResponse.ok(), 'product catalog API should be available').toBeTruthy();
  const products = await productsResponse.json() as Product[];
  const ordered = preferredId
    ? [...products.filter((product) => product.id === preferredId), ...products.filter((product) => product.id !== preferredId)]
    : products;

  for (const product of ordered) {
    const inventoryResponse = await page.request.get(
      new URL(`/api/products/${product.id}/inventory`, base).toString(),
    );
    if (!inventoryResponse.ok()) continue;
    const inventory = await inventoryResponse.json() as { stock: number }[];
    if (!inventory.some((item) => item.stock > 0)) continue;

    await page.goto(`/product/${product.id}`);
    await expect(page.getByRole('button', { name: 'Add to cart' })).toBeEnabled();
    return product;
  }

  throw new Error('No seeded product has stock available for the test.');
}

export async function addAvailableProductToCart(page: Page, preferredId?: number): Promise<Product> {
  const product = await openAvailableProduct(page, preferredId);
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.locator('.cart-confirmation')).toContainText('Added to your cart.');
  return product;
}
