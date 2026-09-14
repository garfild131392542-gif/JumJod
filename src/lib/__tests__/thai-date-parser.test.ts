import { describe, it, expect } from 'vitest';
import { parseThaiDate, parseThaiTime, parseThaiDateTime } from '../thai-date-parser';

describe('thai-date-parser', () => {
  describe('parseThaiDate', () => {
    it('should parse relative date "วันนี้"', () => {
      const res = parseThaiDate('วันนี้');
      expect(res).not.toBeNull();
      expect(res?.displayStr).toContain('วันนี้');
      expect(res?.dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should parse relative date "พรุ่งนี้"', () => {
      const res = parseThaiDate('พรุ่งนี้');
      expect(res).not.toBeNull();
      expect(res?.displayStr).toContain('พรุ่งนี้');
      expect(res?.dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should parse relative date "มะรืนนี้"', () => {
      const res = parseThaiDate('มะรืนนี้');
      expect(res).not.toBeNull();
      expect(res?.displayStr).toContain('มะรืนนี้');
    });

    it('should parse relative date "สัปดาห์หน้า"', () => {
      const res = parseThaiDate('สัปดาห์หน้า');
      expect(res).not.toBeNull();
      expect(res?.displayStr).toContain('สัปดาห์หน้า');
    });

    it('should parse numeric dates with 2-digit Buddhist/Christian year (e.g. 17/8/26)', () => {
      const res = parseThaiDate('17/8/26');
      expect(res).not.toBeNull();
      expect(res?.dateStr).toBe('2026-08-17');
    });

    it('should parse Buddhist era 4-digit year (e.g. 2569 -> 2026)', () => {
      const res = parseThaiDate('20/12/2569');
      expect(res).not.toBeNull();
      expect(res?.dateStr).toBe('2026-12-20');
    });

    it('should parse Thai text month (e.g. 15 สิงหาคม 2569)', () => {
      const res = parseThaiDate('15 สิงหาคม 2569');
      expect(res).not.toBeNull();
      expect(res?.dateStr).toBe('2026-08-15');
      expect(res?.displayStr).toContain('ส.ค.');
    });

    it('should parse abbreviated Thai month (e.g. 1 ต.ค. 26)', () => {
      const res = parseThaiDate('1 ต.ค. 26');
      expect(res).not.toBeNull();
      expect(res?.dateStr).toBe('2026-10-01');
    });

    it('should return null for invalid text', () => {
      const res = parseThaiDate('ข้อความสุ่มๆ ที่ไม่มีวันที่');
      expect(res).toBeNull();
    });
  });

  describe('parseThaiTime', () => {
    it('should parse spoken words "เที่ยง" and "เที่ยงตรง"', () => {
      expect(parseThaiTime('เที่ยง')?.timeStr).toBe('12:00:00');
      expect(parseThaiTime('เที่ยงตรง')?.timeStr).toBe('12:00:00');
    });

    it('should parse spoken words "เที่ยงคืน"', () => {
      expect(parseThaiTime('เที่ยงคืน')?.timeStr).toBe('00:00:00');
    });

    it('should parse standard format "07:00" and "14.30 น."', () => {
      expect(parseThaiTime('07:00')?.timeStr).toBe('07:00:00');
      expect(parseThaiTime('14.30 น.')?.timeStr).toBe('14:30:00');
    });

    it('should parse morning hours "9 โมง" and "7 โมงเช้า"', () => {
      expect(parseThaiTime('9 โมง')?.timeStr).toBe('09:00:00');
      expect(parseThaiTime('7 โมงเช้า')?.timeStr).toBe('07:00:00');
      expect(parseThaiTime('9 โมงครึ่ง')?.timeStr).toBe('09:30:00');
    });

    it('should parse afternoon hours "บ่าย 2" -> 14:00', () => {
      expect(parseThaiTime('บ่าย 2')?.timeStr).toBe('14:00:00');
      expect(parseThaiTime('บ่าย 3 โมงครึ่ง')?.timeStr).toBe('15:30:00');
    });

    it('should parse evening hours "5 โมงเย็น" -> 17:00', () => {
      expect(parseThaiTime('5 โมงเย็น')?.timeStr).toBe('17:00:00');
    });

    it('should parse night hours "2 ทุ่ม" -> 20:00 and "3 ทุ่มครึ่ง" -> 21:30', () => {
      expect(parseThaiTime('2 ทุ่ม')?.timeStr).toBe('20:00:00');
      expect(parseThaiTime('3 ทุ่มครึ่ง')?.timeStr).toBe('21:30:00');
    });

    it('should parse explicit hour "8 น."', () => {
      expect(parseThaiTime('8 น.')?.timeStr).toBe('08:00:00');
    });

    it('should parse standalone hour input "16"', () => {
      expect(parseThaiTime('16')?.timeStr).toBe('16:00:00');
    });

    it('should return null for invalid time string', () => {
      expect(parseThaiTime('สวัสดีครับ')).toBeNull();
    });
  });

  describe('parseThaiDateTime', () => {
    it('should combine date and time into ISO string', () => {
      const res = parseThaiDateTime('พรุ่งนี้ 10:30 น.');
      expect(res).not.toBeNull();
      expect(res?.isoString).toContain('T10:30:00+07:00');
    });

    it('should default to 09:00 if time is not specified', () => {
      const res = parseThaiDateTime('พรุ่งนี้');
      expect(res).not.toBeNull();
      expect(res?.isoString).toContain('T09:00:00+07:00');
    });
  });
});
