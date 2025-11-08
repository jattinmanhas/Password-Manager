-- Migration: Add sync service tables
-- Date: 2024-01-01
-- Description: Creates tables for sync service (change logs and devices)

-- Devices table
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- web, mobile, desktop
    last_sync_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_user_id_type ON devices(user_id, type);

-- Change logs table
CREATE TABLE IF NOT EXISTS change_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    item_type VARCHAR(50) NOT NULL, -- vault_item, folder
    item_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL, -- create, update, delete
    version INTEGER NOT NULL,
    data TEXT, -- Encrypted change data
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_change_logs_user_id ON change_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_change_logs_user_id_created_at ON change_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_change_logs_item ON change_logs(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_change_logs_device_id ON change_logs(device_id);

