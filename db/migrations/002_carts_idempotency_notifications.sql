-- Run once on an existing database (db/schema.sql already contains this for fresh ones).

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
