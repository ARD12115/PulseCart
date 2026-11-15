import { test, expect } from '@playwright/test';

test.describe('Core Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Home page loads with hero, filters, and product grid', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Good things, close to home');
    await expect(page.locator('input[type="search"]')).toBeVisible();
    await expect(page.locator('select').first()).toBeVisible(); // category filter
    await expect(page.locator('select').nth(1)).toBeVisible(); // city filter
    await expect(page.locator('input[placeholder="Min price (₹)"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Max price (₹)"]')).toBeVisible();
  });

  test('Search filters products', async ({ page }) => {
    await page.fill('input[type="search"]', 'bluetooth');
    await page.waitForTimeout(500); // debounce
    await expect(page.locator('text=Bluetooth Headphones')).toBeVisible();
  });

  test('Category filter works', async ({ page }) => {
    await page.selectOption('select', { index: 1 }); // first actual category
    await page.waitForTimeout(500);
    const products = page.locator('[href^="/product/"]');
    await expect(products.first()).toBeVisible();
  });

  test('City filter works', async ({ page }) => {
    await page.selectOption('select:nth-of-type(2)', 'Bengaluru');
    await page.waitForTimeout(500);
    const products = page.locator('[href^="/product/"]');
    await expect(products.first()).toBeVisible();
  });

  test('Price range filter works', async ({ page }) => {
    // Use a range that matches seeded products (~₹17-27)
    await page.fill('input[placeholder="Min price (₹)"]', '10');
    await page.fill('input[placeholder="Max price (₹)"]', '50');
    await page.waitForTimeout(500);
    const products = page.locator('[href^="/product/"]');
    await expect(products.first()).toBeVisible();
  });

  test('Clear filters button works', async ({ page }) => {
    // First create a no-results state
    await page.fill('input[type="search"]', 'nonexistentproduct12345');
    await page.waitForTimeout(500);
    await expect(page.locator('text=No products match your filters')).toBeVisible();
    await expect(page.locator('button:has-text("clear all filters")')).toBeVisible();

    // Now click clear and verify filters reset
    await page.click('button:has-text("clear all filters")');
    await expect(page.locator('input[type="search"]')).toHaveValue('');
    await expect(page.locator('select').first()).toHaveValue('');
  });

  test('Navigate to product detail page', async ({ page }) => {
    const firstProduct = page.locator('[href^="/product/"]').first();
    await firstProduct.click();
    await expect(page).toHaveURL(/\/product\/\d+/);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('text=Availability by city')).toBeVisible();
    await expect(page.locator('button:has-text("Add to cart")')).toBeVisible();
  });

  test('Product detail page shows placeholder image when no image_url', async ({ page }) => {
    await page.goto('/product/1');
    // Fresh seed has no image_url, should show SVG placeholder
    await expect(page.locator('svg[viewBox="0 0 24 24"]')).toBeVisible();
  });

  test('Add to cart from product page', async ({ page }) => {
    await page.goto('/product/1');
    await page.click('button:has-text("Add to cart")');
    await expect(page.locator('text=Added to your cart')).toBeVisible();
  });

  test('Cart page shows added items', async ({ page }) => {
    await page.goto('/product/1');
    await page.click('button:has-text("Add to cart")');
    await page.goto('/cart');
    await expect(page.locator('text=Bluetooth Headphones')).toBeVisible();
    await expect(page.locator('input[type="number"]')).toHaveValue('1');
  });

  test('Update quantity in cart', async ({ page }) => {
    await page.goto('/product/1');
    await page.click('button:has-text("Add to cart")');
    await page.goto('/cart');
    await page.fill('input[type="number"]', '3');
    await expect(page.locator('input[type="number"]')).toHaveValue('3');
  });

  test('Remove item from cart', async ({ page }) => {
    await page.goto('/product/1');
    await page.click('button:has-text("Add to cart")');
    await page.goto('/cart');
    await page.click('button:has-text("Remove")');
    await expect(page.locator('text=Your cart is empty')).toBeVisible();
  });

  test('Checkout flow with valid data', async ({ page }) => {
    await page.goto('/product/1');
    await page.click('button:has-text("Add to cart")');
    await page.goto('/cart');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[placeholder="Name"]', 'Test User');
    await page.selectOption('select', 'Bengaluru');
    await page.click('button:has-text("Place order")');
    await expect(page.locator('text=Order #')).toBeVisible();
    await expect(page.locator('text=Private order access code')).toBeVisible();
  });
});
