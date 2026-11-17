import { test, expect } from '@playwright/test';

test.describe('Security / Vulnerability Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('XSS in search input - script tag should be escaped', async ({ page }) => {
    await page.fill('input[type="search"]', '<script>alert("xss")</script>');
    await page.waitForTimeout(500);
    const content = await page.content();
    expect(content).not.toContain('<script>alert("xss")</script>');
  });

  test('XSS in search input - event handlers should be escaped', async ({ page }) => {
    await page.fill('input[type="search"]', '<img src=x onerror=alert(1)>');
    await page.waitForTimeout(500);
    const content = await page.content();
    expect(content).not.toContain('onerror=');
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
    await expect(page.locator('button:has-text("Clear")')).toBeVisible();
  });

  test('SQL injection in search - union select should not execute', async ({ page }) => {
    await page.fill('input[type="search"]', "' UNION SELECT * FROM users --");
    await page.waitForTimeout(500);
    await expect(page.locator('text=No products found. Try changing your search or filters.')).toBeVisible();
  });

  test('XSS in checkout form - email field', async ({ page }) => {
    await page.goto('/product/1');
    await page.click('button:has-text("Add to cart")');
    await page.goto('/cart');
    await page.fill('input[type="email"]', '<script>alert("xss")</script>@test.com');
    await page.fill('#checkout-name', 'Test');
    await page.selectOption('#city-filter', 'Bengaluru');
    await page.click('button:has-text("Place order")');
    await page.waitForTimeout(1000);
    const content = await page.content();
    expect(content).not.toContain('<script>');
  });

  test('XSS in checkout form - name field', async ({ page }) => {
    await page.goto('/product/1');
    await page.click('button:has-text("Add to cart")');
    await page.goto('/cart');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('#checkout-name', '<img src=x onerror=alert(1)>');
    await page.selectOption('#city-filter', 'Bengaluru');
    await page.click('button:has-text("Place order")');
    await page.waitForTimeout(1000);
    const content = await page.content();
    expect(content).not.toContain('onerror=');
  });

  test('Checkout without email should fail', async ({ page }) => {
    await page.goto('/product/1');
    await page.click('button:has-text("Add to cart")');
    await page.goto('/cart');
    await page.fill('#checkout-name', 'Test');
    await page.selectOption('#city-filter', 'Bengaluru');
    await page.click('button:has-text("Place order")');
    await expect(page.locator('text=Add items and fill in your email')).toBeVisible();
  });

  test('Checkout without name should fail', async ({ page }) => {
    await page.goto('/product/1');
    await page.click('button:has-text("Add to cart")');
    await page.goto('/cart');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.selectOption('#city-filter', 'Bengaluru');
    await page.click('button:has-text("Place order")');
    await expect(page.locator('text=Add items and fill in your email')).toBeVisible();
  });

  test('Checkout without city should fail', async ({ page }) => {
    await page.goto('/product/1');
    await page.click('button:has-text("Add to cart")');
    await page.goto('/cart');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('#checkout-name', 'Test');
    await page.click('button:has-text("Place order")');
    await expect(page.locator('text=Add items and fill in your email')).toBeVisible();
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

  test('Concurrency demo - race condition test', async ({ page }) => {
    await page.goto('/demo');
    await page.fill('input[type="number"]', '1');
    await page.selectOption('#city-filter', 'Bengaluru');
    await page.fill('input[type="email"]', 'demo@example.com');
    await page.click('button:has-text("Run two simultaneous checkouts")');
    await expect(page.locator('text=Racing...')).toBeVisible();
    await expect(page.locator('text=Exactly one buyer won the last unit')).toBeVisible({ timeout: 10000 });
  });

  test('Rate limiting enforced on checkout', async ({ page }) => {
    // Use a product with sufficient stock for all attempts
    // Product 2+ should have 10 units in each city
    const productId = 2;
    const city = 'Bengaluru';

    // Make 5 requests (within limit)
    for (let i = 0; i < 5; i++) {
      const response = await page.request.post('http://localhost:8000/checkout', {
        data: {
          customer_email: `test${i}@example.com`,
          customer_name: 'Test',
          city,
          items: [{ product_id: productId, qty: 1 }],
        },
      });
      expect(response.status()).toBe(200);
    }

    // 6th request should be rate limited (429)
    const limitedResponse = await page.request.post('http://localhost:8000/checkout', {
      data: {
        customer_email: 'test5@example.com',
        customer_name: 'Test',
        city,
        items: [{ product_id: productId, qty: 1 }],
      },
    });
    expect(limitedResponse.status()).toBe(429);
  });
});
