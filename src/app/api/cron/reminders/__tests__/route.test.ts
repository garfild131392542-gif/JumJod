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

  it('should return 500 when items query fails with an error', async () => {
    mockItemsQuery.limit
      .mockResolvedValueOnce({ data: null, error: { message: 'Supabase gateway timeout' } })
      .mockResolvedValueOnce({ data: [], error: null });

    const req = new Request('http://localhost:3000/api/cron/reminders');
    const res = await GET(req);

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('Supabase gateway timeout');
  });
});
