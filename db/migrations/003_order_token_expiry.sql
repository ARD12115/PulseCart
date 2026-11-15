-- Limit lifetime and support revoking order access tokens.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS access_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS access_token_revoked_at TIMESTAMPTZ;

-- Give previously issued tokens a bounded migration grace period.
UPDATE orders
SET access_token_expires_at = now() + interval '90 days'
WHERE access_token_hash IS NOT NULL
  AND access_token_expires_at IS NULL;

CREATE INDEX IF NOT EXISTS carts_updated_at ON carts (updated_at);
