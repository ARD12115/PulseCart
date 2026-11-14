ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS access_token_hash TEXT;
