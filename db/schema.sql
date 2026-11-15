CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  price_paise INTEGER NOT NULL CHECK (price_paise >= 0),
  image_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS store_inventory (
  product_id BIGINT NOT NULL REFERENCES products(id),
  city TEXT NOT NULL,
  stock INTEGER NOT NULL CHECK (stock >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, city)
);

CREATE TABLE IF NOT EXISTS customers (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  city TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id),
  city TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'placed',
  total_paise INTEGER NOT NULL CHECK (total_paise >= 0),
  access_token_hash TEXT,
  access_token_expires_at TIMESTAMPTZ,
  access_token_revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  order_id BIGINT NOT NULL REFERENCES orders(id),
  product_id BIGINT NOT NULL REFERENCES products(id),
  qty INTEGER NOT NULL CHECK (qty > 0),
  price_paise INTEGER NOT NULL CHECK (price_paise >= 0),
  PRIMARY KEY (order_id, product_id)
);

CREATE TABLE IF NOT EXISTS outbox_events (
  id BIGSERIAL PRIMARY KEY,
  topic TEXT NOT NULL,
  key TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS outbox_unpublished
  ON outbox_events (id) WHERE published_at IS NULL;

CREATE TABLE IF NOT EXISTS processed_events (
  consumer TEXT NOT NULL,
  event_id BIGINT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer, event_id)
);

CREATE INDEX IF NOT EXISTS store_inventory_in_stock_city_product
  ON store_inventory (city, product_id) WHERE stock > 0;

-- Checkout idempotency: a retried request with the same key returns the same order.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS orders_customer_idempotency_key
  ON orders (customer_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Server-side carts. The cart ID is an unguessable UUID kept by the browser.
CREATE TABLE IF NOT EXISTS carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS carts_updated_at ON carts (updated_at);

CREATE TABLE IF NOT EXISTS cart_items (
  cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id),
  qty INTEGER NOT NULL CHECK (qty > 0 AND qty <= 50),
  PRIMARY KEY (cart_id, product_id)
);

-- Order confirmations. The notification consumer inserts one row per order
-- (UNIQUE order_id makes redelivery harmless); a sender loop delivers pending rows.
CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL UNIQUE REFERENCES orders(id),
  customer_id BIGINT NOT NULL REFERENCES customers(id),
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'logged', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS notifications_pending
  ON notifications (id) WHERE status = 'pending';

-- Messages a consumer could not process after retrying; inspect via /admin/dead-letters.
CREATE TABLE IF NOT EXISTS dead_letter_events (
  id BIGSERIAL PRIMARY KEY,
  consumer TEXT NOT NULL,
  topic TEXT NOT NULL,
  kafka_partition INTEGER,
  kafka_offset BIGINT,
  key TEXT,
  value TEXT,
  error TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
