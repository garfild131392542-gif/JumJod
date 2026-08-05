import { SupabaseClient } from '@supabase/supabase-js';
import { StockItem } from '@/lib/types';

export class StockService {
  /**
   * Fetch all stock items for a specific user
   */
  static async getStocksByUserId(supabase: SupabaseClient, userId: string): Promise<StockItem[]> {
    const { data, error } = await supabase
      .from('stocks')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (error || !data) return [];
    return data as StockItem[];
  }

  /**
   * Fetch a single stock item by ID
   */
  static async getStockById(supabase: SupabaseClient, stockId: string): Promise<StockItem | null> {
    const { data, error } = await supabase
      .from('stocks')
      .select('*')
      .eq('id', stockId)
      .single();

    if (error || !data) return null;
    return data as StockItem;
  }

  /**
   * Find stock item by exact or partial name match
   */
  static async searchStockByName(supabase: SupabaseClient, userId: string, name: string): Promise<StockItem | null> {
    const cleanName = name.trim().toLowerCase();
    const { data, error } = await supabase
      .from('stocks')
      .select('*')
      .eq('user_id', userId)
      .ilike('name', `%${cleanName}%`)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) return null;
    return data[0] as StockItem;
  }

  /**
   * Adjust quantity of a stock item (add or subtract)
   */
  static async adjustStockQuantity(
    supabase: SupabaseClient,
    stockId: string,
    delta: number
  ): Promise<{ success: boolean; updatedStock?: StockItem; oldQty?: number }> {
    const stock = await this.getStockById(supabase, stockId);
    if (!stock) return { success: false };

    const oldQty = stock.quantity;
    const newQty = Math.max(0, oldQty + delta);

    const { data, error } = await supabase
      .from('stocks')
      .update({
        quantity: newQty,
        updated_at: new Date().toISOString(),
      })
      .eq('id', stockId)
      .select()
      .single();

    if (error || !data) return { success: false };
    return { success: true, updatedStock: data as StockItem, oldQty };
  }

  /**
   * Create a new stock item
   */
  static async createStockItem(
    supabase: SupabaseClient,
    stockData: Partial<StockItem>
  ): Promise<StockItem | null> {
    const { data, error } = await supabase
      .from('stocks')
      .insert([
        {
          user_id: stockData.user_id,
          name: stockData.name,
          quantity: stockData.quantity ?? 0,
          unit: stockData.unit ?? 'รายการ',
          category: stockData.category ?? 'ทั่วไป',
          min_threshold: stockData.min_threshold ?? 5,
          priority: stockData.priority ?? 'Medium',
          description: stockData.description ?? null,
        },
      ])
      .select()
      .single();

    if (error || !data) return null;
    return data as StockItem;
  }

  /**
   * Delete a stock item
   */
  static async deleteStockItem(supabase: SupabaseClient, stockId: string): Promise<boolean> {
    const { error } = await supabase.from('stocks').delete().eq('id', stockId);
    return !error;
  }
}
