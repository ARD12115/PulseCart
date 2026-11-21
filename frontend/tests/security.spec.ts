import { test, expect } from '@playwright/test';
import { addAvailableProductToCart } from './helpers';

test.describe('Security / Vulnerability Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('XSS in search input - script tag should be escaped', async ({ page }) => {
    await page.fill('input[type="search"]', '<script>alert("xss")</script>');
    await page.waitForTimeout(500);
    const injectedScript = await page.locator('script').evaluateAll((scripts) =>
      scripts.some((script) => script.textContent?.includes('alert("xss")')),
    );
    expect(injectedScript).toBe(false);
    await expect(page.locator('input[type="search"]')).toHaveValue('<script>alert("xss")</script>');
  });

  test('XSS in search input - event handlers should be escaped', async ({ page }) => {
    await page.fill('input[type="search"]', '<img src=x onerror=alert(1)>');
    await page.waitForTimeout(500);
    await expect(page.locator('[onerror]')).toHaveCount(0);
    await expect(page.locator('input[type="search"]')).toHaveValue('<img src=x onerror=alert(1)>');
  });

  test('XSS in search input - javascript: protocol should be escaped', async ({ page }) => {
    await page.fill('input[type="search"]', 'javascript:alert(1)');
    await page.waitForTimeout(500);
    const content = await page.content();
    // React escapes input values; the string appears as data, not as an executable href
    expect(content).not.toContain('href="javascript:alert(1)"');
  });

  test('SQL injection in search - single quote should not break query', async ({ page }) => {
    await page.fill('input[type="search"]', "' OR '1'='1");
    await page.waitForTimeout(500);
    await expect(page.locator('text=No products found. Try changing your search or filters.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear', exact: true })).toBeVisible();
  });

  test('SQL injection in search - union select should not execute', async ({ page }) => {
    await page.fill('input[type="search"]', "' UNION SELECT * FROM users --");
    await page.waitForTimeout(500);
    await expect(page.locator('text=No products found. Try changing your search or filters.')).toBeVisible();
  });

  test('XSS in checkout form - email field', async ({ page }) => {
    await addAvailableProductToCart(page, 1);
    await page.goto('/cart');
    await page.fill('input[type="email"]', '<script>alert("xss")</script>@test.com');
    await page.fill('#checkout-name', 'Test');
    await page.selectOption('#checkout-city', 'Bengaluru');
    await page.click('button:has-text("Place order")');
    await page.waitForTimeout(300);
    const injectedScript = await page.locator('script').evaluateAll((scripts) =>
      scripts.some((script) => script.textContent?.includes('alert("xss")')),
    );
    expect(injectedScript).toBe(false);
    await expect(page.locator('input[type="email"]')).toHaveValue('<script>alert("xss")</script>@test.com');
  });

  test('XSS in checkout form - name field', async ({ page }) => {
    await addAvailableProductToCart(page, 1);
    await page.goto('/cart');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('#checkout-name', '<img src=x onerror=alert(1)>');
    await page.selectOption('#checkout-city', 'Bengaluru');
    await page.click('button:has-text("Place order")');
    await page.waitForTimeout(300);
    await expect(page.locator('[onerror]')).toHaveCount(0);
    await expect(page.locator('#checkout-name')).toHaveValue('<img src=x onerror=alert(1)>');
  });

  test('Checkout without email should fail', async ({ page }) => {
    await addAvailableProductToCart(page, 1);
    await page.goto('/cart');
    await page.fill('#checkout-name', 'Test');
    await page.selectOption('#checkout-city', 'Bengaluru');
    const form = page.locator('.checkout-card');
    expect(await form.evaluate((element) => (element as HTMLFormElement).checkValidity())).toBe(false);
  });

  test('Checkout without name should fail', async ({ page }) => {
    await addAvailableProductToCart(page, 1);
    await page.goto('/cart');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.selectOption('#checkout-city', 'Bengaluru');
    const form = page.locator('.checkout-card');
    expect(await form.evaluate((element) => (element as HTMLFormElement).checkValidity())).toBe(false);
  });

  test('Checkout without city should fail', async ({ page }) => {
    await addAvailableProductToCart(page, 1);
    await page.goto('/cart');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('#checkout-name', 'Test');
    const form = page.locator('.checkout-card');
    expect(await form.evaluate((element) => (element as HTMLFormElement).checkValidity())).toBe(false);
  });

  test('Admin page requires key', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.locator('input[id="admin-key"]')).toBeVisible();
    await expect(page.locator('button:has-text("Connect")')).toBeVisible();
  });

  test('Admin page rejects invalid key', async ({ page }) => {
    await page.goto('/admin');
    await page.fill('input[id="admin-key"]', 'wrong-key');
    await page.click('button:has-text("Connect")');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Admin access unavailable')).toBeVisible();
  });

  test('Concurrency demo reports outcomes for both buyers', async ({ page }) => {
    await page.goto('/demo');
    await page.fill('input[type="number"]', '1');
    await page.selectOption('#city-filter', 'Bengaluru');
    await page.fill('input[type="email"]', 'demo@example.com');
    await page.click('button:has-text("Run two simultaneous checkouts")');
    await expect(page.locator('text=Racing...')).toBeVisible();
    await expect(page.getByText(/Exactly one buyer won|Both succeeded|Neither succeeded/)).toBeVisible({ timeout: 15000 });
  });

  test('Rate limiting enforced on checkout', async ({ page }) => {
    const city = 'Bengaluru';
    // Use a non-existent product: the limiter runs before checkout inventory validation,
    // so this remains independent of shared database stock.

    // Make 5 requests (within limit)
    for (let i = 0; i < 5; i++) {
      const response = await page.request.post('http://localhost:8000/checkout', {
        data: {
          customer_email: `test${i}@example.com`,
          customer_name: 'Test',
          city,
          items: [{ product_id: 999999999, qty: 1 }],
        },
      });
      expect(response.status()).not.toBe(429);
    }

    // 6th request should be rate limited (429)
    const limitedResponse = await page.request.post('http://localhost:8000/checkout', {
      data: {
        customer_email: 'test5@example.com',
        customer_name: 'Test',
        city,
        items: [{ product_id: 999999999, qty: 1 }],
      },
    });
    expect(limitedResponse.status()).toBe(429);
  });
});
