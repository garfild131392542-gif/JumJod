import { describe, it, expect, vi } from 'vitest';
import { StockService } from '../stock.service';
import { SupabaseClient } from '@supabase/supabase-js';

describe('StockService', () => {
  const mockUserId = 'user-123';
  const mockStockId = 'stock-456';

  describe('getStocksByUserId', () => {
    it('should return stock items ordered by name', async () => {
      const mockStocks = [
        { id: '1', name: 'กระดาษ A4', quantity: 10, user_id: mockUserId },
        { id: '2', name: 'ปากกาเจล', quantity: 50, user_id: mockUserId },
      ];

      const mockQuery: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockStocks, error: null }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue(mockQuery),
      } as unknown as SupabaseClient;

      const result = await StockService.getStocksByUserId(mockSupabase, mockUserId);

      expect(mockSupabase.from).toHaveBeenCalledWith('stocks');
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', mockUserId);
      expect(mockQuery.order).toHaveBeenCalledWith('name', { ascending: true });
      expect(result).toEqual(mockStocks);
    });
  });

  describe('searchStockByName', () => {
    it('should search using ilike and return the first matching stock', async () => {
      const mockFound = { id: '1', name: 'กระดาษ A4' };
      const mockQuery: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [mockFound], error: null }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue(mockQuery),
      } as unknown as SupabaseClient;

      const result = await StockService.searchStockByName(mockSupabase, mockUserId, 'กระดาษ');

      expect(mockQuery.ilike).toHaveBeenCalledWith('name', '%กระดาษ%');
      expect(result).toEqual(mockFound);
    });

    it('should return null if not found', async () => {
      const mockQuery: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue(mockQuery),
      } as unknown as SupabaseClient;

      const result = await StockService.searchStockByName(mockSupabase, mockUserId, 'ไม่มีในคลัง');
      expect(result).toBeNull();
    });
  });

  describe('adjustStockQuantity', () => {
    it('should increase quantity correctly when adding (+10)', async () => {
      const existingStock = { id: mockStockId, name: 'แอลกอฮอล์', quantity: 20 };
      const updatedStock = { id: mockStockId, name: 'แอลกอฮอล์', quantity: 30 };

      vi.spyOn(StockService, 'getStockById').mockResolvedValue(existingStock as any);

      const mockQuery: any = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: updatedStock, error: null }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue(mockQuery),
      } as unknown as SupabaseClient;

      const result = await StockService.adjustStockQuantity(mockSupabase, mockStockId, 10);

      expect(result.success).toBe(true);
      expect(result.updatedStock?.quantity).toBe(30);
      expect(result.oldQty).toBe(20);
    });

    it('should not allow quantity to drop below 0 when subtracting', async () => {
      const existingStock = { id: mockStockId, name: 'แอลกอฮอล์', quantity: 5 };
      const updatedStock = { id: mockStockId, name: 'แอลกอฮอล์', quantity: 0 };

      vi.spyOn(StockService, 'getStockById').mockResolvedValue(existingStock as any);

      const mockQuery: any = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: updatedStock, error: null }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue(mockQuery),
      } as unknown as SupabaseClient;

      const result = await StockService.adjustStockQuantity(mockSupabase, mockStockId, -15);

      expect(mockQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 0 })
      );
      expect(result.success).toBe(true);
      expect(result.updatedStock?.quantity).toBe(0);
    });
  });

  describe('createStockItem', () => {
    it('should insert stock item with sensible defaults', async () => {
      const newItemData = {
        user_id: mockUserId,
        name: 'บีกเกอร์ 250ml',
      };
      const createdItem = { id: 'new-id', ...newItemData, quantity: 0, unit: 'รายการ', min_threshold: 5 };

      const mockQuery: any = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: createdItem, error: null }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue(mockQuery),
      } as unknown as SupabaseClient;

      const result = await StockService.createStockItem(mockSupabase, newItemData);

      expect(mockSupabase.from).toHaveBeenCalledWith('stocks');
      expect(mockQuery.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          name: 'บีกเกอร์ 250ml',
          quantity: 0,
          min_threshold: 5,
        })
      ]);
      expect(result).toEqual(createdItem);
    });
  });
});
