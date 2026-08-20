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
      
      // Update DB in background while preserving conversationState
      const existingData = (profile.pending_item_data && typeof profile.pending_item_data === 'object') ? profile.pending_item_data : {};
      supabaseAdmin
        .from('profiles')
        .update({
          pending_item_data: {
            ...existingData,
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
      const existingData = (profile.pending_item_data && typeof profile.pending_item_data === 'object') ? profile.pending_item_data : {};
      const { activeMode, lastActivity, ...rest } = existingData;
      await supabaseAdmin
        .from('profiles')
        .update({ pending_item_data: Object.keys(rest).length > 0 ? rest : null })
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
  const existingData = (profile.pending_item_data && typeof profile.pending_item_data === 'object') ? profile.pending_item_data : {};

  if (mode) {
    const state = {
      ...existingData,
      activeMode: mode,
      lastActivity: now.toISOString()
    };
    memoryStateCache.set(`${lineUserId}_mode`, { activeMode: mode, lastActivity: now.toISOString() });
    await supabaseAdmin
      .from('profiles')
      .update({ pending_item_data: state })
      .eq('id', profile.id);
  } else {
    memoryStateCache.delete(`${lineUserId}_mode`);
    const { activeMode, lastActivity, ...rest } = existingData;
    await supabaseAdmin
      .from('profiles')
      .update({ pending_item_data: Object.keys(rest).length > 0 ? rest : null })
      .eq('id', profile.id);
  }
}

export async function getConversationState(
  lineUserId: string,
  profile: any,
  supabaseAdmin?: any
): Promise<any> {
  const now = new Date();

  // Helper to validate TTL (15 minutes)
  const isExpired = (activityTimestamp?: string | null) => {
    if (!activityTimestamp) return false;
    const lastActive = new Date(activityTimestamp);
    if (isNaN(lastActive.getTime())) return false;
    const diffMinutes = (now.getTime() - lastActive.getTime()) / (1000 * 60);
    return diffMinutes >= 15;
  };

  // 1. Check memory cache first
  const memoryState = memoryStateCache.get(lineUserId);
  if (memoryState) {
    if (isExpired(memoryState._lastActivity)) {
      memoryStateCache.delete(lineUserId);
      if (supabaseAdmin && profile?.id) {
        await clearConversationState(lineUserId, supabaseAdmin, profile.id);
      }
      return null;
    }
    return memoryState;
  }

  // 2. Check DB state from profile
  if (profile && profile.pending_item_data && typeof profile.pending_item_data === 'object') {
    const dbData = profile.pending_item_data as any;
    if (dbData.conversationState) {
      const lastActivity = dbData.conversationState._lastActivity || dbData.lastActivity;
      if (isExpired(lastActivity)) {
        if (supabaseAdmin && profile?.id) {
          await clearConversationState(lineUserId, supabaseAdmin, profile.id);
        }
        return null;
      }
      memoryStateCache.set(lineUserId, dbData.conversationState);
      return dbData.conversationState;
    }
  }

  // 3. If supabaseAdmin is passed, fetch fresh DB record
  if (supabaseAdmin && profile?.id) {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('pending_item_data')
      .eq('id', profile.id)
      .single();
    if (data?.pending_item_data?.conversationState) {
      const lastActivity = data.pending_item_data.conversationState._lastActivity || data.pending_item_data.lastActivity;
      if (isExpired(lastActivity)) {
        await clearConversationState(lineUserId, supabaseAdmin, profile.id);
        return null;
      }
      memoryStateCache.set(lineUserId, data.pending_item_data.conversationState);
      return data.pending_item_data.conversationState;
    }
  }

  return null;
}

export async function setConversationState(
  lineUserId: string,
  state: any,
  supabaseAdmin: any,
  profileId?: string
) {
  const now = new Date().toISOString();
  const stateWithTimestamp = {
    ...state,
    _lastActivity: now
  };

  memoryStateCache.set(lineUserId, stateWithTimestamp);

  if (profileId) {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('pending_item_data')
      .eq('id', profileId)
      .single();
    
    const existing = (data?.pending_item_data && typeof data.pending_item_data === 'object')
      ? data.pending_item_data
      : {};

    await supabaseAdmin
      .from('profiles')
      .update({
        pending_item_data: {
          ...existing,
          conversationState: stateWithTimestamp,
          lastActivity: now
        }
      })
      .eq('id', profileId);
  }
}

export async function clearConversationState(
  lineUserId: string,
  supabaseAdmin: any,
  profileId?: string
) {
  memoryStateCache.delete(lineUserId);

  if (profileId) {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('pending_item_data')
      .eq('id', profileId)
      .single();
    
    if (data?.pending_item_data && typeof data.pending_item_data === 'object') {
      const { conversationState, ...rest } = data.pending_item_data;
      await supabaseAdmin
        .from('profiles')
        .update({ pending_item_data: Object.keys(rest).length > 0 ? rest : null })
        .eq('id', profileId);
    }
  }
}

