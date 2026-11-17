-- NOTE: The role is created without a password here because shell variable
-- interpolation (e.g. ${PULSECART_APP_PASSWORD}) is not performed by psql when
-- this file runs from docker-entrypoint-initdb.d. Set the password separately,
-- for example with: ALTER ROLE pulsecart_app WITH PASSWORD '<your-password>';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pulsecart_app') THEN
    CREATE ROLE pulsecart_app LOGIN;
  END IF;
END $$;

-- Revoke everything first, then grant only what the app needs.
REVOKE ALL ON SCHEMA public FROM pulsecart_app;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM pulsecart_app;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM pulsecart_app;
GRANT USAGE ON SCHEMA public TO pulsecart_app;

-- Read access to catalog tables.
GRANT SELECT ON products, store_inventory TO pulsecart_app;

-- Full access to order/cart/checkout tables the app manages.
GRANT SELECT, INSERT, UPDATE, DELETE ON carts, cart_items TO pulsecart_app;
GRANT SELECT, INSERT, UPDATE ON orders, order_items, customers, outbox_events, notifications TO pulsecart_app;

-- Sequence usage for serial/identity columns.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pulsecart_app;

-- Future tables: keep new tables from defaulting to superuser-only access.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE ON TABLES TO pulsecart_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO pulsecart_app;

-- Phase 2: Cart ownership capability
-- Every cart gets an unguessable secret returned at creation time.
-- Modifying or checking out a cart requires presenting this secret.
ALTER TABLE carts ADD COLUMN IF NOT EXISTS cart_secret TEXT NOT NULL DEFAULT gen_random_uuid()::text;

-- Index for fast lookup by secret during checkout verification.
CREATE INDEX IF NOT EXISTS carts_cart_secret ON carts (cart_secret);
