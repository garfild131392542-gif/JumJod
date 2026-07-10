-- 1. Make stock_id nullable in stock_transactions to allow preserving history after stock items are deleted
ALTER TABLE public.stock_transactions ALTER COLUMN stock_id DROP NOT NULL;

-- 2. Clean up any orphaned stock_ids by setting them to NULL (prevents constraint violation when adding FK)
UPDATE public.stock_transactions t
SET stock_id = NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.stocks s WHERE s.id = t.stock_id
);

-- 3. Drop the constraint if it exists, then re-add it with ON DELETE SET NULL
ALTER TABLE public.stock_transactions DROP CONSTRAINT IF EXISTS stock_transactions_stock_id_fkey;

ALTER TABLE public.stock_transactions
  ADD CONSTRAINT stock_transactions_stock_id_fkey
  FOREIGN KEY (stock_id)
  REFERENCES public.stocks(id)
  ON DELETE SET NULL;

-- 3. Update the trigger function to insert NULL for stock_id during DELETE operations
CREATE OR REPLACE FUNCTION public.log_stock_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_qty_before INTEGER;
  v_qty_after INTEGER;
  v_qty_changed INTEGER;
  v_action TEXT;
  v_notes TEXT;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    v_qty_before := 0;
    v_qty_after := NEW.quantity;
    v_qty_changed := NEW.quantity;
    v_action := 'CREATE';
    v_notes := 'สร้างรายการวัสดุใหม่';
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (OLD.quantity IS DISTINCT FROM NEW.quantity) THEN
      v_qty_before := OLD.quantity;
      v_qty_after := NEW.quantity;
      IF (NEW.quantity > OLD.quantity) THEN
        v_qty_changed := NEW.quantity - OLD.quantity;
        v_action := 'ADD';
        v_notes := 'เติมสต็อก';
      ELSE
        v_qty_changed := OLD.quantity - NEW.quantity;
        v_action := 'SUBTRACT';
        v_notes := 'เบิกออก';
      END IF;
    ELSE
      -- No quantity change, do not log anything
      RETURN NEW;
    END IF;
  ELSIF (TG_OP = 'DELETE') THEN
    v_qty_before := OLD.quantity;
    v_qty_after := 0;
    v_qty_changed := OLD.quantity;
    v_action := 'DELETE';
    v_notes := 'ลบออกจากคลัง';
  END IF;

  -- Detect source channel based on auth.uid()
  -- If auth.uid() is null, it means it's executed via service role (like webhook / admin cron)
  IF (auth.uid() IS NULL) THEN
    v_notes := v_notes || ' (ผ่าน LINE Chatbot)';
  ELSE
    v_notes := v_notes || ' (ผ่านหน้าเว็บ)';
  END IF;

  IF (TG_OP = 'DELETE') THEN
    INSERT INTO public.stock_transactions (
      user_id, stock_id, type, quantity_changed, quantity_before, quantity_after, notes
    ) VALUES (
      OLD.user_id,
      NULL, -- Set stock_id to NULL on delete to prevent foreign key constraint violations
      v_action,
      v_qty_changed,
      v_qty_before,
      v_qty_after,
      v_notes
    );
    RETURN OLD;
  ELSE
    INSERT INTO public.stock_transactions (
      user_id, stock_id, type, quantity_changed, quantity_before, quantity_after, notes
    ) VALUES (
      NEW.user_id,
      NEW.id,
      v_action,
      v_qty_changed,
      v_qty_before,
      v_qty_after,
      v_notes
    );
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
