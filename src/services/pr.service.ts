import { SupabaseClient } from '@supabase/supabase-js';
import { PrRequest } from '@/lib/types';

export class PrService {
  /**
   * Fetch PR requests for a user
   */
  static async getPrsByUserId(supabase: SupabaseClient, userId: string, limit: number = 10): Promise<PrRequest[]> {
    const { data, error } = await supabase
      .from('pr_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data as PrRequest[];
  }

  /**
   * Fetch single PR request by ID
   */
  static async getPrById(supabase: SupabaseClient, prId: string): Promise<PrRequest | null> {
    const { data, error } = await supabase
      .from('pr_requests')
      .select('*')
      .eq('id', prId)
      .single();

    if (error || !data) return null;
    return data as PrRequest;
  }

  /**
   * Create a new PR request
   */
  static async createPr(supabase: SupabaseClient, userId: string, title: string): Promise<PrRequest | null> {
    const { data, error } = await supabase
      .from('pr_requests')
      .insert([{ user_id: userId, title, status: 'Pending' }])
      .select()
      .single();

    if (error || !data) return null;
    return data as PrRequest;
  }

  /**
   * Delete PR request
   */
  static async deletePr(supabase: SupabaseClient, prId: string): Promise<boolean> {
    const { error } = await supabase.from('pr_requests').delete().eq('id', prId);
    return !error;
  }
}
