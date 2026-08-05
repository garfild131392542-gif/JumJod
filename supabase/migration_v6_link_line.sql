-- Migration V6: Ensure fast lookup for LINE User ID and support unlinking

-- Add index on line_user_id for lightning-fast webhook lookups
CREATE INDEX IF NOT EXISTS idx_profiles_line_user_id ON public.profiles(line_user_id);

-- Add index on link_code for fast verification
CREATE INDEX IF NOT EXISTS idx_profiles_link_code ON public.profiles(link_code);

-- Function to safely unlink LINE account for a user
CREATE OR REPLACE FUNCTION public.unlink_line_account(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET 
    line_user_id = NULL,
    link_code = NULL,
    link_code_expires_at = NULL,
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
