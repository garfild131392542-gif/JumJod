import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '../route';

// Mock Supabase
const mockItemsQuery = {
  select: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  limit: vi.fn(),
  update: vi.fn().mockReturnThis(),
  in: vi.fn().mockResolvedValue({ error: null }),
};

const mockProfilesQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'items') return mockItemsQuery;
      if (table === 'profiles') return mockProfilesQuery;
      return mockItemsQuery;
    }),
  })),
}));

describe('Cron Reminders Route (/api/cron/reminders)', () => {
  const savedSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CRON_SECRET;
  });

  afterEach(() => {
    if (savedSecret) {
      process.env.CRON_SECRET = savedSecret;
    } else {
      delete process.env.CRON_SECRET;
    }
  });

  it('should return 401 Unauthorized if CRON_SECRET is set but authorization header does not match', async () => {
    process.env.CRON_SECRET = 'super-secret-key';

    const req = new Request('http://localhost:3000/api/cron/reminders', {
      headers: { authorization: 'Bearer wrong-key' },
    });

    const res = await GET(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('should process 0 reminders when no items are due', async () => {
    // Both queries return empty arrays
    mockItemsQuery.limit.mockResolvedValue({ data: [], error: null });

    const req = new Request('http://localhost:3000/api/cron/reminders');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message).toBe('Successfully processed 0 reminders.');
  });

  it('should filter out completed items and query with neq status Issuing Item', async () => {
    mockItemsQuery.limit.mockResolvedValue({ data: [], error: null });

    const req = new Request('http://localhost:3000/api/cron/reminders');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockItemsQuery.neq).toHaveBeenCalledWith('status', 'Issuing Item');
  });

  it('should not send reminder push notifications for items marked as completed', async () => {
    const completedItem = {
      id: 'item-completed-1',
      user_id: 'user-1',
      title: 'งานที่ทำเสร็จแล้ว',
      status: 'Issuing Item',
      reminder_date: '2026-09-18T08:00:00.000Z',
      reminder_sent: false,
    };

    // Return completed item for remindersQuery and empty array for dueItemsQuery
    mockItemsQuery.limit
      .mockResolvedValueOnce({ data: [completedItem], error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    const req = new Request('http://localhost:3000/api/cron/reminders');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    // 0 reminders should be sent since it's completed
    expect(json.message).toBe('Successfully processed 0 reminders.');

    // Completed item should have been marked as resolved in DB
    expect(mockItemsQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({ reminder_sent: true, due_reminder_sent: true })
    );
  });
});
