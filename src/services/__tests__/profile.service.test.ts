import { describe, it, expect, vi } from 'vitest';
import { ProfileService } from '../profile.service';
import { SupabaseClient } from '@supabase/supabase-js';

describe('ProfileService', () => {
  const mockLineUserId = 'U1234567890abcdef';
  const mockProfileId = 'profile-001';

  describe('getProfileByLineId', () => {
    it('should find profile by LINE User ID', async () => {
      const mockProfile = { id: mockProfileId, line_user_id: mockLineUserId, email: 'test@example.com' };

      const mockQuery: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue(mockQuery),
      } as unknown as SupabaseClient;

      const result = await ProfileService.getProfileByLineId(mockSupabase, mockLineUserId);

      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(mockQuery.eq).toHaveBeenCalledWith('line_user_id', mockLineUserId);
      expect(result).toEqual(mockProfile);
    });

    it('should return null when LINE user is not found', async () => {
      const mockQuery: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue(mockQuery),
      } as unknown as SupabaseClient;

      const result = await ProfileService.getProfileByLineId(mockSupabase, 'unknown_line_id');
      expect(result).toBeNull();
    });
  });

  describe('linkLineUser', () => {
    it('should update profile with line_user_id and clear link_code', async () => {
      const mockQuery: any = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue(mockQuery),
      } as unknown as SupabaseClient;

      const success = await ProfileService.linkLineUser(mockSupabase, mockProfileId, mockLineUserId);

      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(mockQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          line_user_id: mockLineUserId,
          link_code: null,
        })
      );
      expect(mockQuery.eq).toHaveBeenCalledWith('id', mockProfileId);
      expect(success).toBe(true);
    });
  });

  describe('unlinkLineUser', () => {
    it('should set line_user_id and link_code to null', async () => {
      const mockQuery: any = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue(mockQuery),
      } as unknown as SupabaseClient;

      const success = await ProfileService.unlinkLineUser(mockSupabase, mockProfileId);

      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(mockQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          line_user_id: null,
          link_code: null,
        })
      );
      expect(success).toBe(true);
    });
  });
});
