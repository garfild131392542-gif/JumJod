import { SupabaseClient } from '@supabase/supabase-js';
import { LabCalibration } from '@/lib/types';

export class CalibrationService {
  /**
   * Fetch lab calibrations for a user
   */
  static async getCalibrationsByUserId(
    supabase: SupabaseClient,
    userId: string,
    limit: number = 10
  ): Promise<LabCalibration[]> {
    const { data, error } = await supabase
      .from('lab_calibrations')
      .select('*')
      .eq('user_id', userId)
      .order('next_cal_date', { ascending: true })
      .limit(limit);

    if (error || !data) return [];
    return data as LabCalibration[];
  }

  /**
   * Fetch single calibration item by ID
   */
  static async getCalById(supabase: SupabaseClient, calId: string): Promise<LabCalibration | null> {
    const { data, error } = await supabase
      .from('lab_calibrations')
      .select('*')
      .eq('id', calId)
      .single();

    if (error || !data) return null;
    return data as LabCalibration;
  }

  /**
   * Delete calibration item
   */
  static async deleteCal(supabase: SupabaseClient, calId: string): Promise<boolean> {
    const { error } = await supabase.from('lab_calibrations').delete().eq('id', calId);
    return !error;
  }
}
