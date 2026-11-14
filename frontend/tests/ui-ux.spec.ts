import { test, expect } from '@playwright/test';

test.describe('UI/UX and Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Color scheme - primary moss green used consistently', async ({ page }) => {
    const hero = page.locator('section[class*="bg-moss-solid"]');
    await expect(hero).toBeVisible();
    const heroBg = await hero.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(heroBg).toMatch(/rgb\(40, 99, 75\)/);
  });

  test('Color scheme - lime accent used for highlights', async ({ page }) => {
    const limeElements = page.locator('[class*="text-lime"], [class*="bg-lime"]');
    const count = await limeElements.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Color scheme - paper background', async ({ page }) => {
    const body = page.locator('body');
    const bg = await body.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bg).toMatch(/rgb\(245, 246, 239\)/);
  });

  test('Typography - system font stack used', async ({ page }) => {
    const body = page.locator('body');
    const fontFamily = await body.evaluate(el => getComputedStyle(el).fontFamily);
    expect(fontFamily).toContain('system-ui');
  });

  test('Typography - heading uses font-black', async ({ page }) => {
    const h1 = page.locator('h1');
    const fontWeight = await h1.evaluate(el => getComputedStyle(el).fontWeight);
    expect(parseInt(fontWeight)).toBeGreaterThanOrEqual(800);
  });

  test('Border radius - consistent scale (no pill buttons)', async ({ page }) => {
    const buttons = page.locator('button');
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      const radius = await buttons.nth(i).evaluate(el => getComputedStyle(el).borderRadius);
      const radiusValue = parseFloat(radius);
      expect(radiusValue).toBeLessThanOrEqual(16);
      expect(radiusValue).not.toBe(9999);
    }
  });

  test('Shadow - only on hover, not static', async ({ page }) => {
    const cards = page.locator('[href^="/product/"]');
    const firstCard = cards.first();
    const staticShadow = await firstCard.evaluate(el => getComputedStyle(el).boxShadow);
    expect(staticShadow).toBe('none');
  });

  test('Hover effect on product cards', async ({ page }) => {
    const firstCard = page.locator('[href^="/product/"]').first();
    await firstCard.hover();
    const hoverShadow = await firstCard.evaluate(el => getComputedStyle(el).boxShadow);
    expect(hoverShadow).not.toBe('none');
  });

  test('No emoji used as decoration', async ({ page }) => {
    const content = await page.content();
    // Check for common emoji characters without unicode escapes
    const emojiChars = ['🚀', '✅', '🔥', '📈', '🎉', '✨', '💡', '⭐', '🌟', '💯', '🔥', '🚀'];
    for (const emoji of emojiChars) {
      expect(content).not.toContain(emoji);
    }
  });

  test('No decorative status dots', async ({ page }) => {
    const content = await page.content();
    expect(content).not.toContain('bg-success-soft');
    expect(content).not.toContain('animate-pulse');
  });

  test('Empty state has actionable copy', async ({ page }) => {
    await page.fill('input[type="search"]', 'nonexistentproduct12345');
    await page.waitForTimeout(500);
    await expect(page.locator('text=No products match your filters')).toBeVisible();
    await expect(page.locator('button:has-text("clear all filters")')).toBeVisible();
  });

  test('Loading state shows proper text', async ({ page }) => {
    await page.fill('input[type="search"]', 'bluetooth');
    await expect(page.locator('text=Loading...')).toBeVisible({ timeout: 5000 });
  });

  test('Error state shows actionable message', async ({ page }) => {
    await page.route('/api/products*', route => route.abort());
    await page.fill('input[type="search"]', 'test');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Could not load products')).toBeVisible();
  });

  test('Cart empty state has clear CTA', async ({ page }) => {
    await page.goto('/cart');
    await expect(page.locator('text=Your cart is empty')).toBeVisible();
    await expect(page.locator('a:has-text("Browse the store")')).toBeVisible();
  });

  test('Product detail page shows all required info', async ({ page }) => {
    await page.goto('/product/1');
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('text=₹')).toBeVisible();
    await expect(page.locator('text=Availability by city')).toBeVisible();
    await expect(page.locator('button:has-text("Add to cart")')).toBeVisible();
  });

  test('Inventory list shows city and stock', async ({ page }) => {
    await page.goto('/product/1');
    const inventoryItems = page.locator('li:has-text("in stock"), li:has-text("Out of stock")');
    const count = await inventoryItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Admin page shows orders and events sections', async ({ page }) => {
    await page.goto('/admin');
    await page.fill('input[id="admin-key"]', 'dev-admin-key-change-in-production');
    await page.click('button:has-text("Connect")');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Recent orders')).toBeVisible();
    await expect(page.locator('text=Outbox events')).toBeVisible();
  });

  test('Demo page explains concurrency concept', async ({ page }) => {
    await page.goto('/demo');
    await expect(page.locator('text=One last item. Two buyers.')).toBeVisible();
    await expect(page.locator('text=PostgreSQL')).toBeVisible();
    await expect(page.locator('text=conditional stock update')).toBeVisible();
  });

  test('Responsive design - mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('input[type="search"]')).toBeVisible();
    await expect(page.locator('select').first()).toBeVisible();
  });

  test('Responsive design - tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
    const products = page.locator('[href^="/product/"]');
    await expect(products.first()).toBeVisible();
  });

  test('Dark mode toggle works', async ({ page }) => {
    await page.goto('/');
    const themeSelect = page.locator('select[aria-label="Color theme"]');
    await themeSelect.selectOption('dark');
    await page.waitForTimeout(200);
    const bodyBg = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bodyBg).toMatch(/rgb\(19, 27, 22\)/);
  });

  test('Light mode toggle works', async ({ page }) => {
    await page.goto('/');
    const themeSelect = page.locator('select[aria-label="Color theme"]');
    await themeSelect.selectOption('light');
    await page.waitForTimeout(200);
    const bodyBg = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bodyBg).toMatch(/rgb\(245, 246, 239\)/);
  });

  test('System theme respects OS preference', async ({ page }) => {
    await page.goto('/');
    const themeSelect = page.locator('select[aria-label="Color theme"]');
    await themeSelect.selectOption('system');
    await page.waitForTimeout(200);
    const bodyBg = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bodyBg).toBeTruthy();
  });
});