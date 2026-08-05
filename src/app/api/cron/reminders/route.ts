import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function sendLinePush(to: string, content: any) {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!channelAccessToken) {
    console.error('Missing LINE_CHANNEL_ACCESS_TOKEN');
    return false;
  }

  const messages = Array.isArray(content)
    ? content.map(c => typeof c === 'string' ? { type: 'text', text: c } : c)
    : [typeof content === 'string' ? { type: 'text', text: content } : content];

  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        to,
        messages,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error sending LINE push:', errorData);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Fetch error sending LINE push:', error);
    return false;
  }
}

export async function GET(request: Request) {
  try {
    const now = new Date().toISOString();
    const requestUrl = new URL(request.url);
    const appUrl = requestUrl.origin;
    let sentCount = 0;

    // ==========================================
    // 1. Group normal user reminders by user_id to save LINE Push quota
    // ==========================================
    const { data: items, error } = await supabaseAdmin
      .from('items')
      .select('*')
      .lte('reminder_date', now)
      .eq('reminder_sent', false);

    if (error) {
      console.error('Error fetching items for reminders:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (items && items.length > 0) {
      console.log(`[CRON REMINDERS] Found ${items.length} normal reminders to process.`);
      
      // Group items by user_id
      const userItemsMap = new Map<string, any[]>();
      for (const item of items) {
        if (!userItemsMap.has(item.user_id)) {
          userItemsMap.set(item.user_id, []);
        }
        userItemsMap.get(item.user_id)!.push(item);
      }

      const { createItemFlexBubble } = await import('../../../../lib/line/flex-templates');

      for (const [userId, userItems] of userItemsMap.entries()) {
        const { data: profile, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('line_user_id')
          .eq('id', userId)
          .single();

        if (profileError || !profile || !profile.line_user_id) {
          // Mark as processed if user has no line id
          const itemIds = userItems.map(i => i.id);
          await supabaseAdmin.from('items').update({ reminder_sent: true }).in('id', itemIds);
          continue;
        }

        const targetLineId = profile.line_user_id;

        if (userItems.length === 1) {
          // Single item -> Send 1 Flex Bubble
          const item = userItems[0];
          const bubble = createItemFlexBubble(item, appUrl, true);
          const pushSuccess = await sendLinePush(targetLineId, {
            type: 'flex',
            altText: `🔔 แจ้งเตือนความจำ: ${item.title}`,
            contents: bubble
          });
          if (pushSuccess) {
            await supabaseAdmin.from('items').update({ reminder_sent: true }).eq('id', item.id);
            sentCount++;
          }
        } else {
          // Multiple items -> Send 1 Flex Carousel to save push quota!
          const bubbles = userItems.slice(0, 10).map(item => createItemFlexBubble(item, appUrl, true));
          const pushSuccess = await sendLinePush(targetLineId, {
            type: 'flex',
            altText: `🔔 แจ้งเตือนความจำ (${userItems.length} รายการ)`,
            contents: {
              type: 'carousel',
              contents: bubbles
            }
          });
          if (pushSuccess) {
            const itemIds = userItems.map(i => i.id);
            await supabaseAdmin.from('items').update({ reminder_sent: true }).in('id', itemIds);
            sentCount += userItems.length;
          }
        }
      }
    }

    // ==========================================
    // 2. Group budget due date alerts by user_id
    // ==========================================
    const threeDaysLater = new Date();
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);
    const threeDaysStr = threeDaysLater.toISOString().substring(0, 10);

    const { data: dueItems, error: dueError } = await supabaseAdmin
      .from('items')
      .select('*')
      .neq('status', 'Issuing Item') // Not completed yet
      .lte('budget_due_date', threeDaysStr)
      .eq('due_reminder_sent', false);

    if (dueError) {
      console.error('Error fetching items for budget due reminders:', dueError);
    } else if (dueItems && dueItems.length > 0) {
      console.log(`[CRON REMINDERS] Found ${dueItems.length} budget due date alerts to process.`);
      
      const dueUserMap = new Map<string, any[]>();
      for (const item of dueItems) {
        if (!dueUserMap.has(item.user_id)) {
          dueUserMap.set(item.user_id, []);
        }
        dueUserMap.get(item.user_id)!.push(item);
      }

      for (const [userId, userDueItems] of dueUserMap.entries()) {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('line_user_id')
          .eq('id', userId)
          .single();

        if (!profile || !profile.line_user_id) {
          const itemIds = userDueItems.map(i => i.id);
          await supabaseAdmin.from('items').update({ due_reminder_sent: true }).in('id', itemIds);
          continue;
        }

        const lines = userDueItems.map(item => `• ${item.title} (กำหนด: ${item.budget_due_date})`);
        const messageText = `🚨 **แจ้งเตือนรายการใกล้ถึงกำหนด (${userDueItems.length} รายการ)**\n\n${lines.join('\n')}\n\nกรุณาตรวจสอบและดำเนินการด้วยครับ`;

        const pushSuccess = await sendLinePush(profile.line_user_id, messageText);
        if (pushSuccess) {
          const itemIds = userDueItems.map(i => i.id);
          await supabaseAdmin.from('items').update({ due_reminder_sent: true }).in('id', itemIds);
          sentCount += userDueItems.length;
        }
      }
    }

    return NextResponse.json({ message: `Successfully processed ${sentCount} reminders.` });
  } catch (err: any) {
    console.error('Unexpected error in cron reminders:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
