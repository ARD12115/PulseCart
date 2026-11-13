CREATE TABLE products (
  id          BIGSERIAL PRIMARY KEY,
  sku         TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL,
  price_paise INTEGER NOT NULL CHECK (price_paise >= 0),
  image_url   TEXT
);

-- Stock is per city, so "available in Mangaluru" is a real question.
CREATE TABLE store_inventory (
  product_id BIGINT NOT NULL REFERENCES products(id),
  city       TEXT   NOT NULL,
  stock      INTEGER NOT NULL CHECK (stock >= 0),
  PRIMARY KEY (product_id, city)
);

CREATE TABLE customers (
  id    BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name  TEXT NOT NULL,
  city  TEXT NOT NULL
);

CREATE TABLE orders (
  id           BIGSERIAL PRIMARY KEY,
  customer_id  BIGINT NOT NULL REFERENCES customers(id),
  city         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'placed',
  total_paise  INTEGER NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
  order_id    BIGINT NOT NULL REFERENCES orders(id),
  product_id  BIGINT NOT NULL REFERENCES products(id),
  qty         INTEGER NOT NULL CHECK (qty > 0),
  price_paise INTEGER NOT NULL,
  PRIMARY KEY (order_id, product_id)
);

-- Outbox: written in the SAME transaction as the order, published to Kafka later.
CREATE TABLE outbox_events (
  id           BIGSERIAL PRIMARY KEY,
  topic        TEXT NOT NULL,
  key          TEXT NOT NULL,
  payload      JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);
CREATE INDEX outbox_unpublished ON outbox_events (id) WHERE published_at IS NULL;

-- Idempotency: a consumer records each event id it has handled.
CREATE TABLE processed_events (
  consumer TEXT NOT NULL,
  event_id BIGINT NOT NULL,
  PRIMARY KEY (consumer, event_id)
);
