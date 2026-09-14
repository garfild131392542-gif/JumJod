import { describe, it, expect, vi } from 'vitest';
import { PrService } from '../pr.service';
import { computeAutoPrStatus } from '@/lib/types';
import { SupabaseClient } from '@supabase/supabase-js';

describe('PrService', () => {
  const mockUserId = 'user-123';
  const mockPrId = 'pr-999';

  describe('computeAutoPrStatus', () => {
    it('should return "Pending" when all numbers are empty', () => {
      expect(computeAutoPrStatus(null, null, null)).toBe('Pending');
      expect(computeAutoPrStatus('', '', '')).toBe('Pending');
    });

    it('should return "PR Issued" when PR or QT is present without PO', () => {
      expect(computeAutoPrStatus('PR-001', null, null)).toBe('PR Issued');
      expect(computeAutoPrStatus(null, null, 'QT-001')).toBe('PR Issued');
    });

    it('should return "PO Issued" when PO is present but not all 3', () => {
      expect(computeAutoPrStatus(null, 'PO-100', null)).toBe('PO Issued');
      expect(computeAutoPrStatus('PR-001', 'PO-100', null)).toBe('PO Issued');
    });

    it('should return "Completed" when all 3 numbers (PR, PO, QT) exist', () => {
      expect(computeAutoPrStatus('PR-001', 'PO-100', 'QT-500')).toBe('Completed');
    });
  });

  describe('createPr', () => {
    it('should create new PR request with Pending status', async () => {
      const mockCreated = { id: mockPrId, title: 'ซื้อสารเคมี', status: 'Pending', user_id: mockUserId };

      const mockQuery: any = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockCreated, error: null }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue(mockQuery),
      } as unknown as SupabaseClient;

      const result = await PrService.createPr(mockSupabase, mockUserId, 'ซื้อสารเคมี');

      expect(mockSupabase.from).toHaveBeenCalledWith('pr_requests');
      expect(mockQuery.insert).toHaveBeenCalledWith([{ user_id: mockUserId, title: 'ซื้อสารเคมี', status: 'Pending' }]);
      expect(result).toEqual(mockCreated);
    });
  });

  describe('findPrByQuery', () => {
    const prList = [
      { id: '1111-2222-3333-4444', title: 'จัดซื้อเก้าอี้สำนักงาน', pr_no: 'PR-69-001', po_no: null, qt_no: null },
      { id: 'aaaa-bbbb-cccc-dddd', title: 'จัดซื้อคอมพิวเตอร์', pr_no: 'PR-69-002', po_no: 'PO-69-099', qt_no: 'QT-88' },
    ];

    it('should find PR by exact PR number', async () => {
      vi.spyOn(PrService, 'getPrsByUserId').mockResolvedValue(prList as any);
      const mockSupabase = {} as SupabaseClient;

      const result = await PrService.findPrByQuery(mockSupabase, mockUserId, 'PR-69-001');
      expect(result?.title).toBe('จัดซื้อเก้าอี้สำนักงาน');
    });

    it('should find PR by partial title', async () => {
      vi.spyOn(PrService, 'getPrsByUserId').mockResolvedValue(prList as any);
      const mockSupabase = {} as SupabaseClient;

      const result = await PrService.findPrByQuery(mockSupabase, mockUserId, 'คอมพิวเตอร์');
      expect(result?.pr_no).toBe('PR-69-002');
    });

    it('should find PR by short ID suffix', async () => {
      vi.spyOn(PrService, 'getPrsByUserId').mockResolvedValue(prList as any);
      const mockSupabase = {} as SupabaseClient;

      const result = await PrService.findPrByQuery(mockSupabase, mockUserId, 'dddd');
      expect(result?.title).toBe('จัดซื้อคอมพิวเตอร์');
    });

    it('should return null when not matched', async () => {
      vi.spyOn(PrService, 'getPrsByUserId').mockResolvedValue(prList as any);
      const mockSupabase = {} as SupabaseClient;

      const result = await PrService.findPrByQuery(mockSupabase, mockUserId, 'ของที่ไม่มี');
      expect(result).toBeNull();
    });
  });
});
