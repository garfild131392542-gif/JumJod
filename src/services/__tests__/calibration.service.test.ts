import { describe, it, expect, vi } from 'vitest';
import { CalibrationService } from '../calibration.service';
import { SupabaseClient } from '@supabase/supabase-js';

describe('CalibrationService', () => {
  const mockUserId = 'user-123';
  const mockCalId = 'cal-777';

  describe('getCalibrationsByUserId', () => {
    it('should fetch calibrations ordered by next_cal_date ascending', async () => {
      const mockCals = [
        { id: '1', name: 'เครื่องชั่งละเอียด 4 ตำแหน่ง', next_cal_date: '2026-10-01', user_id: mockUserId },
        { id: '2', name: 'pH Meter', next_cal_date: '2026-11-15', user_id: mockUserId },
      ];

      const mockQuery: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockCals, error: null }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue(mockQuery),
      } as unknown as SupabaseClient;

      const result = await CalibrationService.getCalibrationsByUserId(mockSupabase, mockUserId);

      expect(mockSupabase.from).toHaveBeenCalledWith('lab_calibrations');
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', mockUserId);
      expect(mockQuery.order).toHaveBeenCalledWith('next_cal_date', { ascending: true });
      expect(result).toEqual(mockCals);
    });
  });

  describe('getCalById', () => {
    it('should return calibration item by id', async () => {
      const mockCal = { id: mockCalId, name: 'ไมโครปิเปต' };
      const mockQuery: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockCal, error: null }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue(mockQuery),
      } as unknown as SupabaseClient;

      const result = await CalibrationService.getCalById(mockSupabase, mockCalId);
      expect(result).toEqual(mockCal);
    });
  });

  describe('deleteCal', () => {
    it('should return true on successful delete', async () => {
      const mockQuery: any = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue(mockQuery),
      } as unknown as SupabaseClient;

      const result = await CalibrationService.deleteCal(mockSupabase, mockCalId);
      expect(result).toBe(true);
    });
  });
});
