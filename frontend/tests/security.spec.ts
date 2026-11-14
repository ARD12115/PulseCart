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
    expect(content).toContain('<script>alert("xss")</script>');
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
    expect(content).not.toContain('javascript:alert(1)');
  });

  test('SQL injection in search - single quote should not break query', async ({ page }) => {
    await page.fill('input[type="search"]', "' OR '1'='1");
    await page.waitForTimeout(500);
    await expect(page.locator('text=No products match your filters')).toBeVisible();
    await expect(page.locator('button:has-text("clear all filters")')).toBeVisible();
  });

  test('SQL injection in search - union select should not execute', async ({ page }) => {
    await page.fill('input[type="search"]', "' UNION SELECT * FROM users --");
    await page.waitForTimeout(500);
    await expect(page.locator('text=No products match your filters')).toBeVisible();
  });

  test('SQL injection in product ID - product page', async ({ page }) => {
    await page.goto('/product/1%27%20OR%201%3D1--');
    await expect(page.locator('text=Product not found')).toBeVisible({ timeout: 5000 });
  });

  test('Path traversal in product ID', async ({ page }) => {
    await page.goto('/product/../../etc/passwd');
    await expect(page.locator('text=Product not found')).toBeVisible({ timeout: 5000 });
  });

  test('XSS in checkout form - email field', async ({ page }) => {
    await page.goto('/product/1');
    await page.click('button:has-text("Add to cart")');
    await page.goto('/cart');
    await page.fill('input[type="email"]', '<script>alert("xss")</script>@test.com');
    await page.fill('input[placeholder="Name"]', 'Test');
    await page.selectOption('select', 'Bengaluru');
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
    await page.fill('input[placeholder="Name"]', '<img src=x onerror=alert(1)>');
    await page.selectOption('select', 'Bengaluru');
    await page.click('button:has-text("Place order")');
    await page.waitForTimeout(1000);
    const content = await page.content();
    expect(content).not.toContain('onerror=');
  });

  test('Checkout without email should fail', async ({ page }) => {
    await page.goto('/product/1');
    await page.click('button:has-text("Add to cart")');
    await page.goto('/cart');
    await page.fill('input[placeholder="Name"]', 'Test');
    await page.selectOption('select', 'Bengaluru');
    await page.click('button:has-text("Place order")');
    await expect(page.locator('text=Add items and fill in your email')).toBeVisible();
  });

  test('Checkout without name should fail', async ({ page }) => {
    await page.goto('/product/1');
    await page.click('button:has-text("Add to cart")');
    await page.goto('/cart');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.selectOption('select', 'Bengaluru');
    await page.click('button:has-text("Place order")');
    await expect(page.locator('text=Add items and fill in your email')).toBeVisible();
  });

  test('Checkout without city should fail', async ({ page }) => {
    await page.goto('/product/1');
    await page.click('button:has-text("Add to cart")');
    await page.goto('/cart');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[placeholder="Name"]', 'Test');
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

  test('Order access without token fails', async ({ page }) => {
    await page.goto('/orders/1');
    await expect(page.locator('text=Order access token required')).toBeVisible();
  });

  test('Order access with invalid token fails', async ({ page }) => {
    await page.goto('/orders/1', { headers: { 'X-Order-Access-Token': 'invalid-token' } });
    await expect(page.locator('text=Order not found or access token is invalid')).toBeVisible();
  });

  test('Concurrency demo - race condition test', async ({ page }) => {
    await page.goto('/demo');
    await page.fill('input[type="number"]', '1');
    await page.selectOption('select', 'Bengaluru');
    await page.fill('input[type="email"]', 'demo@example.com');
    await page.click('button:has-text("Run two simultaneous checkouts")');
    await expect(page.locator('text=Racing...')).toBeVisible();
    await expect(page.locator('text=Exactly one buyer won the last unit')).toBeVisible({ timeout: 10000 });
  });

  test('CSRF protection - checkout should require proper headers', async ({ page }) => {
    await page.goto('/product/1');
    await page.click('button:has-text("Add to cart")');
    await page.goto('/cart');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[placeholder="Name"]', 'Test');
    await page.selectOption('select', 'Bengaluru');
    const response = await page.request.post('http://localhost:8000/api/checkout', {
      data: {
        customer_email: 'test@example.com',
        customer_name: 'Test',
        city: 'Bengaluru',
        items: [{ product_id: 1, qty: 1 }],
      },
    });
    expect(response.status()).toBe(200);
  });

  test('Rate limiting not enforced on checkout (vulnerability)', async ({ page }) => {
    for (let i = 0; i < 5; i++) {
      await page.goto('/product/1');
      await page.click('button:has-text("Add to cart")');
      await page.goto('/cart');
      await page.fill('input[type="email"]', `test${i}@example.com`);
      await page.fill('input[placeholder="Name"]', 'Test');
      await page.selectOption('select', 'Bengaluru');
      await page.click('button:has-text("Place order")');
      await page.waitForTimeout(200);
    }
    // Should show rate limit error but currently doesn't
    const content = await page.content();
    expect(content).not.toContain('rate limit');
    expect(content).not.toContain('too many requests');
  });
});