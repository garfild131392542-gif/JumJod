import { memoryStateCache } from '../state-cache';

export async function getUserModeState(
  profile: any,
  lineUserId: string,
  supabaseAdmin: any
): Promise<'reminder' | 'stock' | 'pr' | 'calibration' | null> {
  const now = new Date();
  
  // Check memory cache first
  let cached = memoryStateCache.get(`${lineUserId}_mode`);
  if (!cached && profile.pending_item_data && typeof profile.pending_item_data === 'object') {
    const dbData = profile.pending_item_data as any;
    if (dbData.activeMode && dbData.lastActivity) {
      cached = {
        activeMode: dbData.activeMode,
        lastActivity: dbData.lastActivity
      };
    }
  }

  if (cached) {
    const lastActive = new Date(cached.lastActivity);
    const diffMinutes = (now.getTime() - lastActive.getTime()) / (1000 * 60);
    
    if (diffMinutes < 15) {
      // Still active, update last activity time
      cached.lastActivity = now.toISOString();
      memoryStateCache.set(`${lineUserId}_mode`, cached);
      
      // Update DB in background
      supabaseAdmin
        .from('profiles')
        .update({
          pending_item_data: {
            activeMode: cached.activeMode,
            lastActivity: cached.lastActivity
          }
        })
        .eq('id', profile.id)
        .then(() => {});
        
      return cached.activeMode;
    } else {
      // Inactive for more than 15 minutes, reset to null
      memoryStateCache.delete(`${lineUserId}_mode`);
      await supabaseAdmin
        .from('profiles')
        .update({ pending_item_data: null })
        .eq('id', profile.id);
      return null;
    }
  }
  
  return null;
}

export async function setUserModeState(
  profile: any,
  lineUserId: string,
  mode: 'reminder' | 'stock' | 'pr' | 'calibration' | null,
  supabaseAdmin: any
) {
  const now = new Date();
  if (mode) {
    const state = { activeMode: mode, lastActivity: now.toISOString() };
    memoryStateCache.set(`${lineUserId}_mode`, state);
    await supabaseAdmin
      .from('profiles')
      .update({ pending_item_data: state })
      .eq('id', profile.id);
  } else {
    memoryStateCache.delete(`${lineUserId}_mode`);
    await supabaseAdmin
      .from('profiles')
      .update({ pending_item_data: null })
      .eq('id', profile.id);
  }
}
