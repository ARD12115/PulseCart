# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: accessibility.spec.ts >> Accessibility Tests >> Product detail - images have meaningful alt or accessible placeholder
- Location: tests\accessibility.spec.ts:102:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.detail-art')
Expected: visible
Timeout: 7000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('.detail-art') with timeout 7000ms
  - waiting for locator('.detail-art')

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
  5   |   test.beforeEach(async ({ page }) => {
  6   |     await page.goto('/');
  7   |     await page.waitForLoadState('networkidle');
  8   |   });
  9   | 
  10  |   test('All images have alt text', async ({ page }) => {
  11  |     const images = page.locator('img');
  12  |     const count = await images.count();
  13  |     for (let i = 0; i < count; i++) {
  14  |       const alt = await images.nth(i).getAttribute('alt');
  15  |       expect(alt).not.toBeNull();
  16  |     }
  17  |   });
  18  | 
  19  |   test('Form inputs have associated labels', async ({ page }) => {
  20  |     const inputs = page.locator('input[type="search"], input[type="number"], input[type="email"]');
  21  |     const count = await inputs.count();
  22  |     for (let i = 0; i < count; i++) {
  23  |       const input = inputs.nth(i);
  24  |       const id = await input.getAttribute('id');
  25  |       const ariaLabel = await input.getAttribute('aria-label');
  26  |       const ariaLabelledby = await input.getAttribute('aria-labelledby');
  27  |       const hasLabel = id || ariaLabel || ariaLabelledby;
  28  |       expect(hasLabel).toBeTruthy();
  29  |     }
  30  |   });
  31  | 
  32  |   test('Select elements have labels', async ({ page }) => {
  33  |     const selects = page.locator('select');
  34  |     const count = await selects.count();
  35  |     for (let i = 0; i < count; i++) {
  36  |       const select = selects.nth(i);
  37  |       const id = await select.getAttribute('id');
  38  |       const ariaLabel = await select.getAttribute('aria-label');
  39  |       const ariaLabelledby = await select.getAttribute('aria-labelledby');
  40  |       const hasLabel = id || ariaLabel || ariaLabelledby;
  41  |       expect(hasLabel).toBeTruthy();
  42  |     }
  43  |   });
  44  | 
  45  |   test('Focus visible on interactive elements', async ({ page }) => {
  46  |     await page.keyboard.press('Tab');
  47  |     const focused = page.locator(':focus');
  48  |     await expect(focused).toBeVisible();
  49  |     const outline = await focused.evaluate(el => getComputedStyle(el).outline);
  50  |     expect(outline).not.toBe('none');
  51  |   });
  52  | 
  53  |   test('Skip link or proper heading structure', async ({ page }) => {
  54  |     const h1 = page.locator('h1');
  55  |     await expect(h1).toBeVisible();
  56  |     const h2 = page.locator('h2').first();
  57  |     await expect(h2).toBeVisible();
  58  |   });
  59  | 
  60  |   test('ARIA roles on interactive elements', async ({ page }) => {
  61  |     const buttons = page.locator('button');
  62  |     const count = await buttons.count();
  63  |     for (let i = 0; i < count; i++) {
  64  |       const button = buttons.nth(i);
  65  |       const role = await button.getAttribute('role');
  66  |       const type = await button.getAttribute('type');
  67  |       expect(role === 'button' || type === 'button' || type === 'submit').toBeTruthy();
  68  |     }
  69  |   });
  70  | 
  71  |   test('Color contrast - text on background', async ({ page }) => {
  72  |     const body = page.locator('body');
  73  |     const color = await body.evaluate(el => getComputedStyle(el).color);
  74  |     const bg = await body.evaluate(el => getComputedStyle(el).backgroundColor);
  75  |     expect(color).toBeTruthy();
  76  |     expect(bg).toBeTruthy();
  77  |   });
  78  | 
  79  |   test('Error messages have role=alert', async ({ page }) => {
  80  |     await page.route('**/api/products/**', route => route.abort());
  81  |     await page.fill('input[type="search"]', 'test');
  82  |     await page.waitForTimeout(1000);
  83  |     const error = page.locator('.store-error');
  84  |     await expect(error).toBeVisible();
  85  |   });
  86  | 
  87  |   test('Loading state announced to screen readers', async ({ page }) => {
  88  |     await page.fill('input[type="search"]', 'bluetooth');
  89  |     const loading = page.locator('text=Loading…');
  90  |     await expect(loading).toBeVisible({ timeout: 5000 });
  91  |   });
  92  | 
  93  |   test('Cart page - form fields have accessible names', async ({ page }) => {
  94  |     // Add an item first so checkout form is visible
  95  |     await addAvailableProductToCart(page, 2);
  96  |     await page.goto('/cart');
  97  |     await expect(page.getByLabel('Email for your receipt')).toBeVisible();
  98  |     await expect(page.getByLabel('Your name')).toBeVisible();
  99  |     await expect(page.getByLabel('Delivery city')).toBeVisible();
  100 |   });
  101 | 
  102 |   test('Product detail - images have meaningful alt or accessible placeholder', async ({ page }) => {
  103 |     await page.goto('/product/1');
  104 |     const artwork = page.locator('.detail-art');
> 105 |     await expect(artwork).toBeVisible();
      |                           ^ Error: expect(locator).toBeVisible() failed
  106 |     const image = artwork.locator('img');
  107 |     const placeholder = artwork.locator('svg[viewBox="0 0 520 420"]');
  108 |     if (await image.count()) {
  109 |       await expect(image).toHaveAttribute('alt', /.+/);
  110 |     } else {
  111 |       await expect(placeholder).toBeVisible();
  112 |       await expect(placeholder).toHaveAttribute('aria-hidden', 'true');
  113 |     }
  114 |   });
  115 | 
  116 |   test('Navigation is keyboard accessible', async ({ page }) => {
  117 |     await page.keyboard.press('Tab');
  118 |     await page.keyboard.press('Tab');
  119 |     const focused = page.locator(':focus');
  120 |     await expect(focused).toBeVisible();
  121 |   });
  122 | 
  123 |   test('Checkout form has proper autocomplete attributes', async ({ page }) => {
  124 |     await addAvailableProductToCart(page, 1);
  125 |     await page.goto('/cart');
  126 |     const emailInput = page.locator('input[type="email"]');
  127 |     const autocomplete = await emailInput.getAttribute('autocomplete');
  128 |     expect(autocomplete).toBe('email');
  129 |   });
  130 | 
  131 |   test('No duplicate IDs on page', async ({ page }) => {
  132 |     const ids = await page.evaluate(() => {
  133 |       const elements = document.querySelectorAll('[id]');
  134 |       const idList = Array.from(elements).map(el => el.id);
  135 |       return idList.filter((id, index, arr) => arr.indexOf(id) !== index);
  136 |     });
  137 |     expect(ids.length).toBe(0);
  138 |   });
  139 | });
  140 | 
```