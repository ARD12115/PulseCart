-- Add Excel product detail fields to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}';
