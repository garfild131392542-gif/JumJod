import { describe, it, expect, vi } from 'vitest';
import { ItemService } from '../item.service';
import { SupabaseClient } from '@supabase/supabase-js';

describe('ItemService', () => {
  const mockUserId = 'user-123';
  const mockItemId = 'item-456';

  describe('getItemsByUserId', () => {
    it('should fetch active (non-completed) items by default', async () => {
      const mockItems = [
        { id: '1', title: 'Task 1', status: 'Pending', user_id: mockUserId },
        { id: '2', title: 'Task 2', status: 'Purchasing', user_id: mockUserId },
      ];

      const mockQuery: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockItems, error: null }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue(mockQuery),
      } as unknown as SupabaseClient;

      const result = await ItemService.getItemsByUserId(mockSupabase, mockUserId);

      expect(mockSupabase.from).toHaveBeenCalledWith('items');
      expect(mockQuery.select).toHaveBeenCalledWith('*');
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', mockUserId);
      expect(mockQuery.neq).toHaveBeenCalledWith('status', 'Issuing Item');
      expect(mockQuery.order).toHaveBeenCalledWith('updated_at', { ascending: false });
      expect(result).toEqual(mockItems);
    });

    it('should fetch completed items when completed is true', async () => {
      const mockItems = [
        { id: '3', title: 'Finished Task', status: 'Issuing Item', user_id: mockUserId },
      ];

      const mockQuery: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockItems, error: null }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue(mockQuery),
      } as unknown as SupabaseClient;

      const result = await ItemService.getItemsByUserId(mockSupabase, mockUserId, true, 5);

      expect(mockQuery.eq).toHaveBeenCalledWith('status', 'Issuing Item');
      expect(mockQuery.limit).toHaveBeenCalledWith(5);
      expect(result).toEqual(mockItems);
    });

    it('should return empty array on database error', async () => {
      const mockQuery: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'Database error' } }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue(mockQuery),
      } as unknown as SupabaseClient;

      const result = await ItemService.getItemsByUserId(mockSupabase, mockUserId);
      expect(result).toEqual([]);
    });
  });

  describe('getItemById', () => {
    it('should return item when found', async () => {
      const mockItem = { id: mockItemId, title: 'Item 1' };
      const mockQuery: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockItem, error: null }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue(mockQuery),
      } as unknown as SupabaseClient;

      const result = await ItemService.getItemById(mockSupabase, mockItemId);

      expect(mockSupabase.from).toHaveBeenCalledWith('items');
      expect(mockQuery.eq).toHaveBeenCalledWith('id', mockItemId);
      expect(result).toEqual(mockItem);
    });

    it('should return null when item not found or error', async () => {
      const mockQuery: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue(mockQuery),
      } as unknown as SupabaseClient;

      const result = await ItemService.getItemById(mockSupabase, mockItemId);
      expect(result).toBeNull();
    });
  });

  describe('markCompleted', () => {
    it('should update status to "Issuing Item"', async () => {
      const updatedItem = { id: mockItemId, status: 'Issuing Item' };
      const mockQuery: any = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: updatedItem, error: null }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue(mockQuery),
      } as unknown as SupabaseClient;

      const result = await ItemService.markCompleted(mockSupabase, mockItemId);

      expect(mockSupabase.from).toHaveBeenCalledWith('items');
      expect(mockQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'Issuing Item',
        })
      );
      expect(mockQuery.eq).toHaveBeenCalledWith('id', mockItemId);
      expect(result).toEqual(updatedItem);
    });
  });

  describe('deleteItem', () => {
    it('should return true on successful deletion', async () => {
      const mockQuery: any = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue(mockQuery),
      } as unknown as SupabaseClient;

      const result = await ItemService.deleteItem(mockSupabase, mockItemId);

      expect(mockSupabase.from).toHaveBeenCalledWith('items');
      expect(mockQuery.eq).toHaveBeenCalledWith('id', mockItemId);
      expect(result).toBe(true);
    });

    it('should return false if deletion fails', async () => {
      const mockQuery: any = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: { message: 'Delete failed' } }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue(mockQuery),
      } as unknown as SupabaseClient;

      const result = await ItemService.deleteItem(mockSupabase, mockItemId);
      expect(result).toBe(false);
    });
  });
});
