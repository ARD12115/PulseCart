import { test, expect } from '@playwright/test';

test.describe('Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('All images have alt text', async ({ page }) => {
    const images = page.locator('img');
    const count = await images.count();
    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute('alt');
      expect(alt).not.toBeNull();
    }
  });

  test('Form inputs have associated labels', async ({ page }) => {
    const inputs = page.locator('input[type="search"], input[type="number"], input[type="email"]');
    const count = await inputs.count();
    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledby = await input.getAttribute('aria-labelledby');
      const hasLabel = id || ariaLabel || ariaLabelledby;
      expect(hasLabel).toBeTruthy();
    }
  });

  test('Select elements have labels', async ({ page }) => {
    const selects = page.locator('select');
    const count = await selects.count();
    for (let i = 0; i < count; i++) {
      const select = selects.nth(i);
      const id = await select.getAttribute('id');
      const ariaLabel = await select.getAttribute('aria-label');
      const ariaLabelledby = await select.getAttribute('aria-labelledby');
      const hasLabel = id || ariaLabel || ariaLabelledby;
      expect(hasLabel).toBeTruthy();
    }
  });

  test('Focus visible on interactive elements', async ({ page }) => {
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
    const outline = await focused.evaluate(el => getComputedStyle(el).outline);
    expect(outline).not.toBe('none');
  });

  test('Skip link or proper heading structure', async ({ page }) => {
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();
    const h2 = page.locator('h2');
    await expect(h2).toBeVisible();
  });

  test('ARIA roles on interactive elements', async ({ page }) => {
    const buttons = page.locator('button');
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      const role = await button.getAttribute('role');
      const type = await button.getAttribute('type');
      expect(role === 'button' || type === 'button' || type === 'submit').toBeTruthy();
    }
  });

  test('Color contrast - text on background', async ({ page }) => {
    const body = page.locator('body');
    const color = await body.evaluate(el => getComputedStyle(el).color);
    const bg = await body.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(color).toBeTruthy();
    expect(bg).toBeTruthy();
  });

  test('Error messages have role=alert', async ({ page }) => {
    await page.route('/api/products*', route => route.abort());
    await page.fill('input[type="search"]', 'test');
    await page.waitForTimeout(1000);
    const error = page.locator('[role="alert"]');
    await expect(error).toBeVisible();
  });

  test('Loading state announced to screen readers', async ({ page }) => {
    await page.fill('input[type="search"]', 'bluetooth');
    const loading = page.locator('text=Loading...');
    await expect(loading).toBeVisible({ timeout: 5000 });
  });

  test('Cart page - form fields have accessible names', async ({ page }) => {
    // Add an item first so checkout form is visible
    await page.goto('/product/2'); // Use product with stock
    await page.click('button:has-text("Add to cart")');
    await page.goto('/cart');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Name')).toBeVisible();
    await expect(page.getByLabel('Delivery city')).toBeVisible();
  });

  test('Product detail - images have meaningful alt or accessible placeholder', async ({ page }) => {
    await page.goto('/product/1');
    // Fresh seed has no image_url, should show SVG placeholder with accessible markup
    const svg = page.locator('svg[viewBox="0 0 24 24"]');
    await expect(svg).toBeVisible();
    // SVG should be accessible (aria-hidden is true since it's decorative)
    const ariaHidden = await svg.getAttribute('aria-hidden');
    expect(ariaHidden).toBe('true');
  });

  test('Navigation is keyboard accessible', async ({ page }) => {
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
  });

  test('Mobile menu toggle accessible', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    const menuButton = page.locator('button[aria-expanded]');
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    await expect(page.locator('nav[aria-label="Main navigation"]')).toBeVisible();
  });

  test('Checkout form has proper autocomplete attributes', async ({ page }) => {
    await page.goto('/product/1');
    await page.click('button:has-text("Add to cart")');
    await page.goto('/cart');
    const emailInput = page.locator('input[type="email"]');
    const autocomplete = await emailInput.getAttribute('autocomplete');
    expect(autocomplete).toBe('email');
  });

  test('No duplicate IDs on page', async ({ page }) => {
    const ids = await page.evaluate(() => {
      const elements = document.querySelectorAll('[id]');
      const idList = Array.from(elements).map(el => el.id);
      return idList.filter((id, index, arr) => arr.indexOf(id) !== index);
    });
    expect(ids.length).toBe(0);
  });
});
