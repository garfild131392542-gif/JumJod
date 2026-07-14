-- Migration to add group chat support to items
ALTER TABLE items ADD COLUMN IF NOT EXISTS line_group_id TEXT;
