-- Migration v4: Create PR Tracking table
CREATE TABLE IF NOT EXISTS public.pr_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  pr_no text,
  po_no text,
  qt_no text,
  status text DEFAULT 'Pending' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  notes text
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.pr_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own pr_requests" ON public.pr_requests;
DROP POLICY IF EXISTS "Users can insert their own pr_requests" ON public.pr_requests;
DROP POLICY IF EXISTS "Users can update their own pr_requests" ON public.pr_requests;
DROP POLICY IF EXISTS "Users can delete their own pr_requests" ON public.pr_requests;

-- RLS Policies
CREATE POLICY "Users can view their own pr_requests" 
  ON public.pr_requests FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pr_requests" 
  ON public.pr_requests FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pr_requests" 
  ON public.pr_requests FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pr_requests" 
  ON public.pr_requests FOR DELETE 
  USING (auth.uid() = user_id);
