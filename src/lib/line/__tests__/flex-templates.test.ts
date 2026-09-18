import { describe, it, expect } from 'vitest';
import {
  createItemFlexBubble,
  createStockFlexBubble,
  createPrFlexBubble,
  createCalibrationFlexBubble,
  createModeSelectionFlex,
} from '../flex-templates';

describe('Flex Templates', () => {
  const mockAppUrl = 'https://jum-jod.vercel.app';

  describe('createItemFlexBubble', () => {
    it('should generate valid flex bubble for an item', () => {
      const mockItem = {
        id: '12345678-abcd-ef01-2345-6789abcdef01',
        title: 'ส่งรายงานงบดุล',
        status: 'Pending',
        reminder_date: '2026-10-15T09:00:00+07:00',
        description: 'เตรียมเอกสารแนบ',
      };

      const bubble = createItemFlexBubble(mockItem, mockAppUrl);

      expect(bubble.type).toBe('bubble');
      expect(bubble.body).toBeDefined();
      const stringified = JSON.stringify(bubble);
      expect(stringified).toContain('ส่งรายงานงบดุล');
      expect(stringified).toContain('เตรียมเอกสารแนบ');
      expect(stringified).toContain('#f01'); // shortId
      expect(stringified).toContain('📝 บันทึกช่วยจำ');
    });
  });

  describe('createStockFlexBubble', () => {
    it('should generate valid stock flex bubble with quantity and threshold warning', () => {
      const mockStock = {
        id: 'stock-12345',
        name: 'สารเคมี NaCl',
        quantity: 2,
        min_threshold: 5,
        unit: 'ขวด',
        priority: 'High',
        category: 'Laboratory',
      };

      const bubble = createStockFlexBubble(mockStock);
      expect(bubble.type).toBe('bubble');
      const stringified = JSON.stringify(bubble);
      expect(stringified).toContain('สารเคมี NaCl');
      expect(stringified).toContain('ต่ำกว่าเกณฑ์'); // warning because 2 <= 5
    });
  });

  describe('createPrFlexBubble', () => {
    it('should format PR bubble with title and auto status', () => {
      const mockPr = {
        id: 'pr-1234567',
        title: 'จัดซื้อเครื่องคอมพิวเตอร์',
        pr_no: 'PR-26-001',
        po_no: 'PO-26-005',
        qt_no: null,
        status: 'PO Issued',
      };

      const bubble = createPrFlexBubble(mockPr, mockAppUrl);
      expect(bubble.type).toBe('bubble');
      const stringified = JSON.stringify(bubble);
      expect(stringified).toContain('จัดซื้อเครื่องคอมพิวเตอร์');
      expect(stringified).toContain('PR-26-001');
      expect(stringified).toContain('PO-26-005');
    });
  });

  describe('createCalibrationFlexBubble', () => {
    it('should format calibration bubble with tool name and next cal date', () => {
      const mockCal = {
        id: 'cal-123456',
        name: 'เครื่องชั่งดิจิทัล 2 ตำแหน่ง',
        last_cal_date: '2025-10-01',
        next_cal_date: '2026-10-01',
      };

      const bubble = createCalibrationFlexBubble(mockCal, mockAppUrl);
      expect(bubble.type).toBe('bubble');
      const stringified = JSON.stringify(bubble);
      expect(stringified).toContain('เครื่องชั่งดิจิทัล 2 ตำแหน่ง');
      expect(stringified).toContain('ต.ค.'); // Formatted Thai month
    });
  });

  describe('createModeSelectionFlex', () => {
    it('should return mode picker flex card with Reminder, Stock, PR, and Calibration options', () => {
      const flex = createModeSelectionFlex();
      expect(flex.type).toBe('bubble');
      const stringified = JSON.stringify(flex);
      expect(stringified).toContain('ช่วยจำ');
      expect(stringified).toContain('สต็อก');
      expect(stringified).toContain('ติดตาม PR');
      expect(stringified).toContain('Calibrate');
    });
  });
});
