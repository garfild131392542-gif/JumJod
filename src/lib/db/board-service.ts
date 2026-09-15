import { SupabaseClient } from '@supabase/supabase-js';

export interface Board {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  type: 'INVENTORY' | 'DATE_TRACKER' | 'KANBAN' | 'GENERAL_LIST';
  created_at: string;
}

export interface Category {
  id: string;
  board_id: string;
  name: string;
  color: string;
  created_at: string;
}

export class BoardService {
  constructor(private supabase: SupabaseClient) {}

  async getUserBoards(userId: string): Promise<Board[]> {
    const { data, error } = await this.supabase
      .from('boards')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    // Lazy initialization: if new user has 0 boards, create defaults for them
    if (!data || data.length === 0) {
      await this.initializeDefaultBoards(userId);
      // fetch again
      const { data: newData } = await this.supabase
        .from('boards')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      return newData || [];
    }
    
    return data || [];
  }

  private async initializeDefaultBoards(userId: string): Promise<void> {
    const defaults = [
      { user_id: userId, name: 'ช่วยจำ', icon: '📌', type: 'GENERAL_LIST' },
      { user_id: userId, name: 'สต็อกวัสดุ', icon: '📦', type: 'INVENTORY' },
      { user_id: userId, name: 'ติดตาม PR', icon: '📄', type: 'KANBAN' },
      { user_id: userId, name: 'Calibrate', icon: '🔬', type: 'DATE_TRACKER' }
    ];
    await this.supabase.from('boards').insert(defaults);
  }

  async getBoardCategories(boardId: string): Promise<Category[]> {
    const { data, error } = await this.supabase
      .from('categories')
      .select('*')
      .eq('board_id', boardId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async createBoard(userId: string, name: string, icon: string | null, type: Board['type']): Promise<Board> {
    const { data, error } = await this.supabase
      .from('boards')
      .insert([{ user_id: userId, name, icon, type }])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async createCategory(boardId: string, name: string, color: string = '#64748b'): Promise<Category> {
    const { data, error } = await this.supabase
      .from('categories')
      .insert([{ board_id: boardId, name, color }])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deleteBoard(boardId: string): Promise<void> {
    const { error } = await this.supabase.from('boards').delete().eq('id', boardId);
    if (error) throw error;
  }

  async deleteCategory(categoryId: string): Promise<void> {
    const { error } = await this.supabase.from('categories').delete().eq('id', categoryId);
    if (error) throw error;
  }
}

