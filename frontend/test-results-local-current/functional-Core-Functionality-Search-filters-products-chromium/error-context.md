# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: functional.spec.ts >> Core Functionality >> Search filters products
- Location: tests\functional.spec.ts:19:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('h3:has-text("Bluetooth Headphones")').or(locator('.empty-results'))
Expected: visible
Timeout: 20000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('h3:has-text("Bluetooth Headphones")').or(locator('.empty-results')) with timeout 20000ms
  - waiting for locator('h3:has-text("Bluetooth Headphones")').or(locator('.empty-results'))

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
  - note "PulseCart catalog features": LOCAL CATALOGPOSTGRESQL / INVENTORYAPACHE KAFKA / EVENT FLOWOPENSEARCH / FUZZY CATALOG
  - region "Kinetic 3D local hardware.":
    - text: // PULSECART / LOCAL COMMERCE INVENTORY / ORDERS / EVENTS
    - paragraph: High-tensile event-driven retail
    - heading "Kinetic 3D local hardware." [level=1]:
      - text: Kinetic 3D
      - emphasis: local hardware.
    - paragraph: Browse products from nearby shops, search with typo tolerance, and place orders against current inventory.
    - link "Explore the collection":
      - /url: "#shop"
    - link "See how it works":
      - /url: "#architecture"
    - text: 01 / STOREFRONTINVENTORY-AWARE CHECKOUT
    - link "SCROLL TO EXPLORE":
      - /url: "#architecture"
  - note "Store architecture services": POSTGRESQL / INVENTORY + ORDERSAPACHE KAFKA / EVENT STREAMOPENSEARCH / FUZZY SEARCH
  - region "One storefront. Three engines.":
    - paragraph: System architecture / overview
    - heading "One storefront. Three engines." [level=2]:
      - text: One storefront.
      - emphasis: Three engines.
    - paragraph: Each service has a focused role in the shopping flow. These are architecture notes, not live cluster metrics.
    - article:
      - heading "PostgreSQL" [level=3]
      - paragraph: Products, inventory, carts, and checkout transactions live in the relational store.
      - text: SOURCE OF TRUTH / INVENTORY
    - article:
      - heading "Apache Kafka" [level=3]
      - paragraph: Committed checkout events move through the outbox relay to asynchronous consumers.
      - text: EVENT DELIVERY / ASYNC WORKERS
    - article:
      - heading "OpenSearch" [level=3]
      - paragraph: Catalog queries use fuzzy matching so shoppers can find products despite small typos.
      - text: PRODUCT DISCOVERY / SEARCH
  - region "Search the catalog.":
    - paragraph: Product discovery
    - heading "Search the catalog." [level=2]:
      - text: Search the
      - emphasis: catalog.
    - paragraph: Try a product name or a close spelling. Results update as you type.
    - form "Find products":
      - text: Search products
      - searchbox "Search products": bluetooth
      - text: Category
      - combobox "Category":
        - option "All categories" [selected]
      - text: Delivery city
      - combobox "Delivery city":
        - option "All cities" [selected]
      - text: Minimum price in rupees
      - spinbutton "Minimum price in rupees"
      - text: Maximum price in rupees
      - spinbutton "Maximum price in rupees"
    - button "Search"
    - text: Loading…
  - region "Browse the shop":
    - paragraph: Browse the shop
    - heading "Browse the shop" [level=2]
    - paragraph: Filter above to narrow products by name, price, category, and delivery city.
  - paragraph: Architecture / concurrency / operations
  - heading "Built for the last item." [level=2]:
    - text: Built for the
    - emphasis: last item.
  - paragraph: Explore the concurrency demo or review real outbox events and order confirmations in the operations console.
  - link "Run concurrency lab":
    - /url: /demo
  - link "Open operations":
    - /url: /admin
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
  1   | import { test, expect } from '@playwright/test';
  2   | import { addAvailableProductToCart, openAvailableProduct } from './helpers';
  3   | 
  4   | test.describe('Core Functionality', () => {
  5   |   test.beforeEach(async ({ page }) => {
  6   |     await page.goto('/');
  7   |     await page.waitForLoadState('networkidle');
  8   |   });
  9   | 
  10  |   test('Home page loads with hero, filters, and product grid', async ({ page }) => {
  11  |     await expect(page.locator('h1')).toContainText('Kinetic 3D');
  12  |     await expect(page.locator('input[type="search"]')).toBeVisible();
  13  |     await expect(page.locator('#category-filter')).toBeVisible();
  14  |     await expect(page.locator('#city-filter')).toBeVisible();
  15  |     await expect(page.locator('#min-price')).toHaveCount(1);
  16  |     await expect(page.locator('#max-price')).toHaveCount(1);
  17  |   });
  18  | 
  19  |   test('Search filters products', async ({ page }) => {
  20  |     await page.fill('input[type="search"]', 'bluetooth');
  21  |     const result = page.locator('h3:has-text("Bluetooth Headphones")');
  22  |     const emptyState = page.locator('.empty-results');
> 23  |     await expect(result.or(emptyState)).toBeVisible({ timeout: 20_000 });
      |                                         ^ Error: expect(locator).toBeVisible() failed
  24  |     if (await emptyState.isVisible()) throw new Error('Search returned no products after indexing worker startup.');
  25  |     await expect(result).toBeVisible();
  26  |   });
  27  | 
  28  |   test('Category filter works', async ({ page }) => {
  29  |     await page.selectOption('#category-filter', { index: 1 }); // first actual category
  30  |     await page.waitForTimeout(500);
  31  |     await expect(page.locator('[href^="/product/"]').first()).toBeVisible();
  32  |   });
  33  | 
  34  |   test('City filter works', async ({ page }) => {
  35  |     await page.selectOption('#city-filter', 'Bengaluru');
  36  |     await page.waitForTimeout(500);
  37  |     const products = page.locator('[href^="/product/"]');
  38  |     await expect(products.first()).toBeVisible();
  39  |   });
  40  | 
  41  |   test('Price range filter works', async ({ page }) => {
  42  |     // Use a range that matches seeded products (~₹17-27)
  43  |     const minPrice = page.locator('#min-price');
  44  |     await minPrice.scrollIntoViewIfNeeded();
  45  |     await minPrice.fill('10', { force: true });
  46  |     await page.locator('#max-price').fill('50', { force: true });
  47  |     await page.waitForTimeout(500);
  48  |     const products = page.locator('[href^="/product/"]');
  49  |     await expect(products.first()).toBeVisible();
  50  |   });
  51  | 
  52  |   test('Clear filters button works', async ({ page }) => {
  53  |     // First create a no-results state
  54  |     await page.fill('input[type="search"]', 'nonexistentproduct12345');
  55  |     await page.waitForTimeout(500);
  56  |     await expect(page.locator('text=No products found. Try changing your search or filters.')).toBeVisible();
  57  |     await expect(page.locator('button.clear-filter-button')).toBeVisible();
  58  | 
  59  |     // Now click clear and verify filters reset
  60  |     await page.click('button.clear-filter-button');
  61  |     await expect(page.locator('input[type="search"]')).toHaveValue('');
  62  |     await expect(page.locator('#category-filter')).toHaveValue('');
  63  |   });
  64  | 
  65  |   test('Navigate to product detail page', async ({ page }) => {
  66  |     const firstProduct = page.locator('[href^="/product/"]').first();
  67  |     await firstProduct.click();
  68  |     await expect(page).toHaveURL(/\/product\/\d+/);
  69  |     await expect(page.locator('h1')).toBeVisible();
  70  |     await expect(page.locator('h2:has-text("Delivery availability")')).toBeVisible();
  71  |     await expect(page.locator('button:has-text("Add to cart")')).toBeVisible();
  72  |   });
  73  | 
  74  |   test('Product detail artwork has an accessible image or placeholder', async ({ page }) => {
  75  |     await openAvailableProduct(page, 1);
  76  |     const artwork = page.locator('.detail-art');
  77  |     const image = artwork.locator('img');
  78  |     const placeholder = artwork.locator('svg[viewBox="0 0 520 420"]');
  79  |     await expect(artwork).toBeVisible();
  80  |     if (await image.count()) await expect(image).toHaveAttribute('alt', /.+/);
  81  |     else await expect(placeholder).toBeVisible();
  82  |   });
  83  | 
  84  |   test('Add to cart from product page', async ({ page }) => {
  85  |     await addAvailableProductToCart(page, 1);
  86  |   });
  87  | 
  88  |   test('Cart page shows added items', async ({ page }) => {
  89  |     const product = await addAvailableProductToCart(page, 1);
  90  |     await page.goto('/cart');
  91  |     await expect(page.locator('h2').filter({ hasText: product.name })).toBeVisible();
  92  |     await expect(page.locator('input[type="number"]')).toHaveValue('1');
  93  |   });
  94  | 
  95  |   test('Update quantity in cart', async ({ page }) => {
  96  |     await addAvailableProductToCart(page, 1);
  97  |     await page.goto('/cart');
  98  |     await page.fill('input[type="number"]', '3');
  99  |     await expect(page.locator('input[type="number"]')).toHaveValue('3');
  100 |   });
  101 | 
  102 |   test('Remove item from cart', async ({ page }) => {
  103 |     page.on('dialog', (dialog) => dialog.accept());
  104 |     await addAvailableProductToCart(page, 1);
  105 |     await page.goto('/cart');
  106 |     await page.click('button:has-text("Remove")');
  107 |     await expect(page.locator('text=Nothing here yet.')).toBeVisible();
  108 |   });
  109 | 
  110 |   test('Checkout flow with valid data', async ({ page }) => {
  111 |     await addAvailableProductToCart(page, 1);
  112 |     await page.goto('/cart');
  113 |     await page.fill('input[type="email"]', 'test@example.com');
  114 |     await page.fill('#checkout-name', 'Test User');
  115 |     await page.selectOption('#checkout-city', 'Bengaluru');
  116 |     await page.click('button:has-text("Place order")');
  117 |     // Order may succeed or fail due to stock exhaustion (409) - accept either outcome
  118 |     await expect(page.locator('text=Order #').or(page.locator('.cart-notice'))).toBeVisible({ timeout: 15_000 });
  119 |   });
  120 | });
  121 | 
```