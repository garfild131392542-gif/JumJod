import { SupabaseClient } from '@supabase/supabase-js';
import { PrRequest } from '@/lib/types';

export class PrService {
  /**
   * Fetch PR requests for a user
   */
  static async getPrsByUserId(supabase: SupabaseClient, userId: string, limit: number = 10): Promise<PrRequest[]> {
    const { data, error } = await supabase
      .from('pr_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data as PrRequest[];
  }

  /**
   * Fetch single PR request by ID
   */
  static async getPrById(supabase: SupabaseClient, prId: string): Promise<PrRequest | null> {
    const { data, error } = await supabase
      .from('pr_requests')
      .select('*')
      .eq('id', prId)
      .single();

    if (error || !data) return null;
    return data as PrRequest;
  }

  /**
   * Create a new PR request
   */
  static async createPr(supabase: SupabaseClient, userId: string, title: string): Promise<PrRequest | null> {
    const { data, error } = await supabase
      .from('pr_requests')
      .insert([{ user_id: userId, title, status: 'Pending' }])
      .select()
      .single();

    if (error || !data) return null;
    return data as PrRequest;
  }

  /**
   * Delete PR request
   */
  static async deletePr(supabase: SupabaseClient, prId: string): Promise<boolean> {
    const { error } = await supabase.from('pr_requests').delete().eq('id', prId);
    return !error;
  }

  /**
   * Update PR request fields with automatic status computation
   */
  static async updatePr(
    supabase: SupabaseClient,
    prId: string,
    updates: Partial<PrRequest>
  ): Promise<PrRequest | null> {
    // If status is not explicitly passed, compute status automatically based on numbers
    let statusToSet = updates.status;

    if (!statusToSet) {
      const existing = await this.getPrById(supabase, prId);
      if (existing) {
        const prNo = updates.pr_no !== undefined ? updates.pr_no : existing.pr_no;
        const poNo = updates.po_no !== undefined ? updates.po_no : existing.po_no;
        const qtNo = updates.qt_no !== undefined ? updates.qt_no : existing.qt_no;

        const { computeAutoPrStatus } = await import('@/lib/types');
        statusToSet = computeAutoPrStatus(prNo, poNo, qtNo);
      }
    }

    const payload = {
      ...updates,
      ...(statusToSet ? { status: statusToSet } : {}),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('pr_requests')
      .update(payload)
      .eq('id', prId)
      .select('*')
      .single();

    if (error || !data) return null;
    return data as PrRequest;
  }

  /**
   * Find PR request by search query (title, pr_no, po_no, qt_no, or short ID)
   */
  static async findPrByQuery(
    supabase: SupabaseClient,
    userId: string,
    query: string
  ): Promise<PrRequest | null> {
    const cleanQuery = query.trim().replace(/^#/, '');
    if (!cleanQuery) return null;

    // Fetch user's PR requests
    const prs = await this.getPrsByUserId(supabase, userId, 50);
    if (!prs || prs.length === 0) return null;

    // 1. Try exact short ID match
    const matchId = prs.find(p => p.id.endsWith(cleanQuery) || p.id.toLowerCase() === cleanQuery.toLowerCase());
    if (matchId) return matchId;

    // 2. Try exact PR / PO / QT number match
    const matchNumber = prs.find(p =>
      (p.pr_no && p.pr_no.toLowerCase() === cleanQuery.toLowerCase()) ||
      (p.po_no && p.po_no.toLowerCase() === cleanQuery.toLowerCase()) ||
      (p.qt_no && p.qt_no.toLowerCase() === cleanQuery.toLowerCase())
    );
    if (matchNumber) return matchNumber;

    // 3. Try exact Title match (case-insensitive)
    const matchExactTitle = prs.find(p => p.title.toLowerCase() === cleanQuery.toLowerCase());
    if (matchExactTitle) return matchExactTitle;

    // 4. Try title includes cleanQuery
    const matchTitlePartial = prs.find(p => p.title.toLowerCase().includes(cleanQuery.toLowerCase()));
    if (matchTitlePartial) return matchTitlePartial;

    // 5. Try any field partial match
    const matchAnyPartial = prs.find(p =>
      (p.pr_no && p.pr_no.toLowerCase().includes(cleanQuery.toLowerCase())) ||
      (p.po_no && p.po_no.toLowerCase().includes(cleanQuery.toLowerCase())) ||
      (p.qt_no && p.qt_no.toLowerCase().includes(cleanQuery.toLowerCase())) ||
      (p.notes && p.notes.toLowerCase().includes(cleanQuery.toLowerCase()))
    );
    return matchAnyPartial || null;
  }
}

