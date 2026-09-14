-- Migration v7: Performance Optimization Indexes
-- Resolves 504 Gateway Timeout on items queries from background cron jobs and dashboard lookups

-- 1. Partial index for pending reminder items (used every 15 mins by reminder cron)
CREATE INDEX IF NOT EXISTS idx_items_reminder_pending 
  ON public.items (reminder_date) 
  WHERE reminder_sent = false;

-- 2. Partial index for budget due date notifications (used every 15 mins by reminder cron)
CREATE INDEX IF NOT EXISTS idx_items_budget_due 
  ON public.items (budget_due_date, status) 
  WHERE due_reminder_sent = false;

-- 3. Composite index for active/completed items by user (used by web dashboard & LINE bot)
CREATE INDEX IF NOT EXISTS idx_items_user_status 
  ON public.items (user_id, status, updated_at DESC);
