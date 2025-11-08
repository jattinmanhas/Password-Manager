-- Migration: Add searchable metadata fields to vault_items
-- Date: 2024-01-01
-- Description: Adds encrypted metadata fields for advanced search functionality

-- Add new columns for searchable encryption
ALTER TABLE vault_items
ADD COLUMN IF NOT EXISTS title_encrypted TEXT,
ADD COLUMN IF NOT EXISTS tags_encrypted TEXT,
ADD COLUMN IF NOT EXISTS url_encrypted TEXT,
ADD COLUMN IF NOT EXISTS username_encrypted TEXT;

-- Create indexes for better search performance
CREATE INDEX IF NOT EXISTS idx_vault_items_title_encrypted ON vault_items(title_encrypted);
CREATE INDEX IF NOT EXISTS idx_vault_items_tags_encrypted ON vault_items(tags_encrypted);
CREATE INDEX IF NOT EXISTS idx_vault_items_url_encrypted ON vault_items(url_encrypted);
CREATE INDEX IF NOT EXISTS idx_vault_items_username_encrypted ON vault_items(username_encrypted);

-- Note: These fields use deterministic encryption to enable searching
-- The client should encrypt metadata using the same key for consistent results

