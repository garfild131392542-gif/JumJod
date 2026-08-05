import { SupabaseClient } from '@supabase/supabase-js';
import { Item } from '@/lib/types';

export class ItemService {
  /**
   * Fetch active or completed items for a user
   */
  static async getItemsByUserId(
    supabase: SupabaseClient,
    userId: string,
    completed: boolean = false,
    limit: number = 10
  ): Promise<Item[]> {
    let query = supabase
      .from('items')
      .select('*')
      .eq('user_id', userId);

    if (completed) {
      query = query.eq('status', 'Issuing Item');
    } else {
      query = query.neq('status', 'Issuing Item');
    }

    const { data, error } = await query
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data as Item[];
  }

  /**
   * Fetch single item by ID
   */
  static async getItemById(supabase: SupabaseClient, itemId: string): Promise<Item | null> {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('id', itemId)
      .single();

    if (error || !data) return null;
    return data as Item;
  }

  /**
   * Mark item as completed ('Issuing Item')
   */
  static async markCompleted(supabase: SupabaseClient, itemId: string): Promise<Item | null> {
    const { data, error } = await supabase
      .from('items')
      .update({
        status: 'Issuing Item',
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .select()
      .single();

    if (error || !data) return null;
    return data as Item;
  }

  /**
   * Delete an item by ID
   */
  static async deleteItem(supabase: SupabaseClient, itemId: string): Promise<boolean> {
    const { error } = await supabase.from('items').delete().eq('id', itemId);
    return !error;
  }
}
