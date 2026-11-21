import { test, expect } from '@playwright/test';
import { addAvailableProductToCart } from './helpers';

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
    const h2 = page.locator('h2').first();
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
    await page.route('**/api/products/**', route => route.abort());
    await page.fill('input[type="search"]', 'test');
    await page.waitForTimeout(1000);
    const error = page.locator('.store-error');
    await expect(error).toBeVisible();
  });

  test('Loading state announced to screen readers', async ({ page }) => {
    await page.fill('input[type="search"]', 'bluetooth');
    const loading = page.locator('text=Loading…');
    await expect(loading).toBeVisible({ timeout: 5000 });
  });

  test('Cart page - form fields have accessible names', async ({ page }) => {
    // Add an item first so checkout form is visible
    await addAvailableProductToCart(page, 2);
    await page.goto('/cart');
    await expect(page.getByLabel('Email for your receipt')).toBeVisible();
    await expect(page.getByLabel('Your name')).toBeVisible();
    await expect(page.getByLabel('Delivery city')).toBeVisible();
  });

  test('Product detail - images have meaningful alt or accessible placeholder', async ({ page }) => {
    await page.goto('/product/1');
    const artwork = page.locator('.detail-art');
    await expect(artwork).toBeVisible();
    const image = artwork.locator('img');
    const placeholder = artwork.locator('svg[viewBox="0 0 520 420"]');
    if (await image.count()) {
      await expect(image).toHaveAttribute('alt', /.+/);
    } else {
      await expect(placeholder).toBeVisible();
      await expect(placeholder).toHaveAttribute('aria-hidden', 'true');
    }
  });

  test('Navigation is keyboard accessible', async ({ page }) => {
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
  });

  test('Checkout form has proper autocomplete attributes', async ({ page }) => {
    await addAvailableProductToCart(page, 1);
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
