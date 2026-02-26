package database

const schemaSQL = `
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  master_password_hint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_credentials (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  algo TEXT NOT NULL,
  params JSONB NOT NULL,
  salt BYTEA NOT NULL,
  password_hash BYTEA NOT NULL,
  mfa_totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_totp_secret_enc BYTEA,
  totp_failed_attempts INTEGER NOT NULL DEFAULT 0,
  totp_window_started_at TIMESTAMPTZ,
  totp_locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS auth_credentials ADD COLUMN IF NOT EXISTS totp_failed_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS auth_credentials ADD COLUMN IF NOT EXISTS totp_window_started_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS auth_credentials ADD COLUMN IF NOT EXISTS totp_locked_until TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS user_recovery (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  recovery_key_hash BYTEA NOT NULL,
  recovery_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_recovery_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_keys (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  public_key_x25519 BYTEA NOT NULL,
  public_key_ed25519 BYTEA,
  encrypted_private_keys BYTEA NOT NULL,
  nonce BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vault_folders (
  id UUID PRIMARY KEY,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name_ciphertext BYTEA NOT NULL,
  nonce BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vault_items (
  id UUID PRIMARY KEY,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES vault_folders(id) ON DELETE SET NULL,
  ciphertext BYTEA NOT NULL,
  nonce BYTEA NOT NULL,
  dek_wrapped BYTEA NOT NULL,
  algo_version TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vault_shares (
  item_id UUID NOT NULL REFERENCES vault_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dek_wrapped BYTEA NOT NULL,
  permissions TEXT NOT NULL DEFAULT 'read',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (item_id, user_id)
);

CREATE TABLE IF NOT EXISTS vault_attachments (
  id UUID PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES vault_items(id) ON DELETE CASCADE,
  file_name_ciphertext BYTEA NOT NULL,
  nonce BYTEA NOT NULL,
  size_bytes BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash BYTEA NOT NULL,
  device_name TEXT,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS backups_registry (
  id UUID PRIMARY KEY,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  storage_uri TEXT NOT NULL,
  checksum_sha256 BYTEA,
  encrypted BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS totp_recovery_codes (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash BYTEA NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, code_hash)
);

CREATE INDEX IF NOT EXISTS idx_vault_items_owner_user_id ON vault_items(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token_hash ON sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_audit_events_user_id ON audit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_vault_shares_user_id ON vault_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_vault_folders_owner_user_id ON vault_folders(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_vault_attachments_item_id ON vault_attachments(item_id);
CREATE INDEX IF NOT EXISTS idx_backups_registry_created_by_user_id ON backups_registry(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_totp_recovery_codes_user_id ON totp_recovery_codes(user_id);
`
