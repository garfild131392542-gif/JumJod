-- Migration v5: Create Lab Calibration table
CREATE TABLE IF NOT EXISTS public.lab_calibrations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name text NOT NULL,                  -- 1. ชื่อเครื่องมือ/เครื่องชั่ง
  last_cal_date date,                  -- 2. ครั้งก่อนที่ส่ง Cal
  next_cal_date date NOT NULL,         -- 3. ครั้งถัดไปที่จะทำการ Cal
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.lab_calibrations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own lab_calibrations" ON public.lab_calibrations;
DROP POLICY IF EXISTS "Users can insert their own lab_calibrations" ON public.lab_calibrations;
DROP POLICY IF EXISTS "Users can update their own lab_calibrations" ON public.lab_calibrations;
DROP POLICY IF EXISTS "Users can delete their own lab_calibrations" ON public.lab_calibrations;

-- RLS Policies
CREATE POLICY "Users can view their own lab_calibrations" 
  ON public.lab_calibrations FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own lab_calibrations" 
  ON public.lab_calibrations FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lab_calibrations" 
  ON public.lab_calibrations FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own lab_calibrations" 
  ON public.lab_calibrations FOR DELETE 
  USING (auth.uid() = user_id);
