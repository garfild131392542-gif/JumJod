-- Migration to add group chat support to items
ALTER TABLE items ADD COLUMN IF NOT EXISTS line_group_id TEXT;

-- Migration to link LINE Group ID to user profiles for group shared stock access
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS line_group_id TEXT;
