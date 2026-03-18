-- Migration: Add sharing support columns to vault_shares table.

ALTER TABLE vault_shares ADD COLUMN IF NOT EXISTS shared_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE vault_shares ADD COLUMN IF NOT EXISTS wrap_nonce BYTEA;
