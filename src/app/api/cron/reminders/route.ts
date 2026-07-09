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
    
    // 1. Fetch items where reminder_date <= now AND reminder_sent = false
    const { data: items, error } = await supabaseAdmin
      .from('items')
      .select('*')
      .lte('reminder_date', now)
      .eq('reminder_sent', false);

    if (error) {
      console.error('Error fetching items for reminders:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ message: 'No pending reminders found.' });
    }

    console.log(`[CRON REMINDERS] Found ${items.length} items to remind.`);
    
    const requestUrl = new URL(request.url);
    const appUrl = requestUrl.origin;

    let sentCount = 0;

    for (const item of items) {
      // 2. Fetch the corresponding profile to get line_user_id
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('line_user_id')
        .eq('id', item.user_id)
        .single();

      if (profileError || !profile || !profile.line_user_id) {
        console.warn(`[CRON REMINDERS] No LINE connection found for user of item ${item.id}`);
        // Mark as sent to prevent infinite loops on unlinked items
        await supabaseAdmin
          .from('items')
          .update({ reminder_sent: true })
          .eq('id', item.id);
        continue;
      }

      // 3. Construct and send the LINE push reminder message
      const { createItemFlexBubble } = await import('../../line-webhook/route');
      const bubble = createItemFlexBubble(item, appUrl);
      
      const pushSuccess = await sendLinePush(profile.line_user_id, [
        `⏰ **แจ้งเตือนความจำจัดซื้อ!**\nถึงเวลาดำเนินการหรือแจ้งเตือนวันกำหนดของรายการ: "${item.title}" แล้วครับ`,
        {
          type: 'flex',
          altText: `⏰ แจ้งเตือน: ${item.title}`,
          contents: bubble
        }
      ]);

      if (pushSuccess) {
        // 4. Update database flag to avoid duplicate sends
        await supabaseAdmin
          .from('items')
          .update({ reminder_sent: true })
          .eq('id', item.id);
        sentCount++;
      }
    }

    return NextResponse.json({ message: `Successfully sent ${sentCount} reminders.` });
  } catch (err: any) {
    console.error('Unexpected error in cron reminders:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
