import { SupabaseClient } from '@supabase/supabase-js';
import { Profile } from '@/lib/types';

export class ProfileService {
  /**
   * Fetch profile by LINE User ID
   */
  static async getProfileByLineId(supabase: SupabaseClient, lineUserId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('line_user_id', lineUserId)
      .single();

    if (error || !data) return null;
    return data as Profile;
  }

  /**
   * Fetch profile by Link Code (must not be expired)
   */
  static async getProfileByLinkCode(supabase: SupabaseClient, linkCode: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('link_code', linkCode.toUpperCase())
      .gt('link_code_expires_at', new Date().toISOString())
      .single();

    if (error || !data) return null;
    return data as Profile;
  }

  /**
   * Link LINE user ID to user profile and clear link code
   */
  static async linkLineUser(supabase: SupabaseClient, profileId: string, lineUserId: string): Promise<boolean> {
    const { error } = await supabase
      .from('profiles')
      .update({
        line_user_id: lineUserId,
        link_code: null,
        link_code_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profileId);

    return !error;
  }

  /**
   * Unlink LINE user ID from profile
   */
  static async unlinkLineUser(supabase: SupabaseClient, profileId: string): Promise<boolean> {
    const { error } = await supabase
      .from('profiles')
      .update({
        line_user_id: null,
        link_code: null,
        link_code_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profileId);

    return !error;
  }
}
