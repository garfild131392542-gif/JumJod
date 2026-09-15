-- 1. Create ENUM for board types if it doesn't exist
DO $ $
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'board_type') THEN
        CREATE TYPE board_type AS ENUM ('INVENTORY', 'DATE_TRACKER', 'KANBAN', 'GENERAL_LIST');
    END IF;
END$ $;

-- 2. Create boards table
CREATE TABLE IF NOT EXISTS boards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  type board_type NOT NULL DEFAULT 'GENERAL_LIST',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID REFERENCES boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#64748b',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Add board_id to existing tables
ALTER TABLE items ADD COLUMN IF NOT EXISTS board_id UUID REFERENCES boards(id) ON DELETE CASCADE;
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS board_id UUID REFERENCES boards(id) ON DELETE CASCADE;
ALTER TABLE pr_requests ADD COLUMN IF NOT EXISTS board_id UUID REFERENCES boards(id) ON DELETE CASCADE;
ALTER TABLE lab_calibrations ADD COLUMN IF NOT EXISTS board_id UUID REFERENCES boards(id) ON DELETE CASCADE;

-- 5. Enable RLS on new tables
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for boards
DO $ $
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own boards') THEN
        CREATE POLICY "Users can view their own boards" ON boards FOR SELECT USING (auth.uid() = user_id);
        CREATE POLICY "Users can insert their own boards" ON boards FOR INSERT WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "Users can update their own boards" ON boards FOR UPDATE USING (auth.uid() = user_id);
        CREATE POLICY "Users can delete their own boards" ON boards FOR DELETE USING (auth.uid() = user_id);
    END IF;
END$ $;

-- 7. RLS Policies for categories
DO $ $
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view categories of their boards') THEN
        CREATE POLICY "Users can view categories of their boards" ON categories FOR SELECT USING (EXISTS (SELECT 1 FROM boards WHERE id = categories.board_id AND user_id = auth.uid()));
        CREATE POLICY "Users can insert categories to their boards" ON categories FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM boards WHERE id = categories.board_id AND user_id = auth.uid()));
        CREATE POLICY "Users can update categories of their boards" ON categories FOR UPDATE USING (EXISTS (SELECT 1 FROM boards WHERE id = categories.board_id AND user_id = auth.uid()));
        CREATE POLICY "Users can delete categories of their boards" ON categories FOR DELETE USING (EXISTS (SELECT 1 FROM boards WHERE id = categories.board_id AND user_id = auth.uid()));
    END IF;
END$ $;

-- 8. Insert default boards for existing users (Migration strategy for backward compatibility)
DO $ $ 
DECLARE 
  u_record RECORD;
  board_memo UUID;
  board_stock UUID;
  board_pr UUID;
  board_cal UUID;
BEGIN
  FOR u_record IN SELECT id FROM profiles LOOP
    IF NOT EXISTS (SELECT 1 FROM boards WHERE user_id = u_record.id) THEN
      INSERT INTO boards (user_id, name, icon, type) VALUES (u_record.id, 'ช่วยจำ', '📌', 'GENERAL_LIST') RETURNING id INTO board_memo;
      UPDATE items SET board_id = board_memo WHERE user_id = u_record.id;
      
      INSERT INTO boards (user_id, name, icon, type) VALUES (u_record.id, 'สต็อกวัสดุ', '📦', 'INVENTORY') RETURNING id INTO board_stock;
      UPDATE stocks SET board_id = board_stock WHERE user_id = u_record.id;
      
      INSERT INTO boards (user_id, name, icon, type) VALUES (u_record.id, 'ติดตาม PR', '📄', 'KANBAN') RETURNING id INTO board_pr;
      UPDATE pr_requests SET board_id = board_pr WHERE user_id = u_record.id;
      
      INSERT INTO boards (user_id, name, icon, type) VALUES (u_record.id, 'Calibrate', '🔬', 'DATE_TRACKER') RETURNING id INTO board_cal;
      UPDATE lab_calibrations SET board_id = board_cal WHERE user_id = u_record.id;
    END IF;
  END LOOP;
END $ $;
