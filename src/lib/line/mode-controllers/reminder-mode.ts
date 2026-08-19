import { SupabaseClient } from '@supabase/supabase-js';
import { sendLineReply } from '@/lib/line/client';
import { createItemFlexBubble } from '@/lib/line/flex-templates';
import { parseThaiDate, parseThaiTime } from '@/lib/thai-date-parser';
import { setConversationState, clearConversationState } from '@/lib/db/user-state';
import { Profile } from '@/lib/types';

export class ReminderModeController {
  static async handleMessage(
    messageText: string,
    profile: Profile,
    replyToken: string,
    lineUserId: string,
    supabaseAdmin: SupabaseClient,
    appUrl: string,
    userState: any = null
  ): Promise<boolean> {
    const text = messageText.trim();
    if (!text) return false;

    // Global cancel keywords
    if (/^(ยกเลิก|cancel|ออก|ไม่เอา|ปิด)$/i.test(text)) {
      if (userState && (userState.action === 'reminder_pending_date' || userState.action === 'reminder_pending_time')) {
        await clearConversationState(lineUserId, supabaseAdmin, profile.id);
        await sendLineReply(replyToken, '✅ ยกเลิกการบันทึกช่วยจำเรียบร้อยแล้วครับ');
        return true;
      }
    }

    // 1. Handle State: reminder_pending_date
    if (userState && userState.action === 'reminder_pending_date') {
      const title = userState.title;

      // Check if user doesn't want reminder
      if (/^(ไม่เตือน|ไม่แจ้งเตือน|ไม่ต้องเตือน|ไม่|no|none|🚫 ไม่แจ้งเตือน)$/i.test(text)) {
        await clearConversationState(lineUserId, supabaseAdmin, profile.id);
        const { data: insertedItem } = await supabaseAdmin
          .from('items')
          .insert([{
            user_id: profile.id,
            title: title,
            description: `บันทึกผ่าน LINE Bot: ${title}`,
            status: 'Pending',
            reminder_date: null,
            is_pr: false
          }])
          .select('*')
          .single();

        if (insertedItem) {
          const bubble = createItemFlexBubble(insertedItem, appUrl);
          await sendLineReply(replyToken, [
            `🎉 บันทึกช่วยจำเรียบร้อยแล้วครับ!\n\n📝 **เรื่อง:** "${title}"\n(ไม่ได้ตั้งเวลาแจ้งเตือน)`,
            {
              type: 'flex',
              altText: `📝 บันทึกช่วยจำ "${title}"`,
              contents: bubble
            }
          ]);
        } else {
          await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง');
        }
        return true;
      }

      // Parse date
      const dateRes = parseThaiDate(text);
      if (!dateRes) {
        await sendLineReply(replyToken, {
          type: 'text',
          text: `❌ ไม่เข้าใจรูปแบบวันที่ครับ กรุณาระบุใหม่ เช่น "17/8/26" หรือ "พรุ่งนี้" (หรือกดปุ่มด้านล่าง)`,
          quickReply: {
            items: [
              { type: 'action', action: { type: 'message', label: '📅 วันนี้', text: 'วันนี้' } },
              { type: 'action', action: { type: 'message', label: '📅 พรุ่งนี้', text: 'พรุ่งนี้' } },
              { type: 'action', action: { type: 'message', label: '📅 สัปดาห์หน้า', text: 'สัปดาห์หน้า' } },
              { type: 'action', action: { type: 'message', label: '🚫 ไม่แจ้งเตือน', text: 'ไม่แจ้งเตือน' } },
              { type: 'action', action: { type: 'message', label: '❌ ยกเลิก', text: 'ยกเลิก' } }
            ]
          }
        });
        return true;
      }

      // Check if time is also included in the same text
      const timeRes = parseThaiTime(text);
      if (timeRes) {
        // Both date and time were provided in one go!
        const isoString = `${dateRes.dateStr}T${timeRes.timeStr}+07:00`;
        await clearConversationState(lineUserId, supabaseAdmin, profile.id);

        const { data: insertedItem } = await supabaseAdmin
          .from('items')
          .insert([{
            user_id: profile.id,
            title: title,
            description: `บันทึกผ่าน LINE Bot: ${title}`,
            status: 'Pending',
            reminder_date: isoString,
            is_pr: false
          }])
          .select('*')
          .single();

        if (insertedItem) {
          const bubble = createItemFlexBubble(insertedItem, appUrl);
          await sendLineReply(replyToken, [
            `🎉 บันทึกช่วยจำเรียบร้อยแล้วครับ!\n\n📝 **เรื่อง:** "${title}"\n🔔 **แจ้งเตือน:** ${dateRes.displayStr} (เวลา ${timeRes.displayStr})`,
            {
              type: 'flex',
              altText: `📝 บันทึกช่วยจำ "${title}"`,
              contents: bubble
            }
          ]);
        } else {
          await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง');
        }
        return true;
      }

      // Only date was provided -> Ask for time in next step
      await setConversationState(lineUserId, {
        action: 'reminder_pending_time',
        title: title,
        targetDate: dateRes.dateStr,
        targetDateDisplay: dateRes.displayStr
      }, supabaseAdmin, profile.id);

      await sendLineReply(replyToken, {
        type: 'text',
        text: `⏰ **ต้องการให้แจ้งเตือนเวลาไหนดีครับ?**\n📅 วันที่: ${dateRes.displayStr}\n📝 เรื่อง: "${title}"\n\n(พิมพ์เวลา เช่น 07:00, 8 โมงเช้า หรือแตะเลือกปุ่มด้านล่าง)`,
        quickReply: {
          items: [
            { type: 'action', action: { type: 'message', label: '⏰ 08:00 น.', text: '08:00' } },
            { type: 'action', action: { type: 'message', label: '⏰ 09:00 น.', text: '09:00' } },
            { type: 'action', action: { type: 'message', label: '⏰ 12:00 น.', text: '12:00' } },
            { type: 'action', action: { type: 'message', label: '⏰ 17:00 น.', text: '17:00' } },
            { type: 'action', action: { type: 'message', label: '❌ ยกเลิก', text: 'ยกเลิก' } }
          ]
        }
      });
      return true;
    }

    // 2. Handle State: reminder_pending_time
    if (userState && userState.action === 'reminder_pending_time') {
      const title = userState.title;
      const targetDate = userState.targetDate;
      const targetDateDisplay = userState.targetDateDisplay;

      const timeRes = parseThaiTime(text);
      if (!timeRes) {
        await sendLineReply(replyToken, {
          type: 'text',
          text: `❌ ไม่เข้าใจรูปแบบเวลาครับ กรุณาระบุใหม่ เช่น "07:00", "8 โมงเช้า" หรือ "14:30" (หรือกดปุ่มด้านล่าง)`,
          quickReply: {
            items: [
              { type: 'action', action: { type: 'message', label: '⏰ 08:00 น.', text: '08:00' } },
              { type: 'action', action: { type: 'message', label: '⏰ 09:00 น.', text: '09:00' } },
              { type: 'action', action: { type: 'message', label: '⏰ 12:00 น.', text: '12:00' } },
              { type: 'action', action: { type: 'message', label: '⏰ 17:00 น.', text: '17:00' } },
              { type: 'action', action: { type: 'message', label: '❌ ยกเลิก', text: 'ยกเลิก' } }
            ]
          }
        });
        return true;
      }

      const isoString = `${targetDate}T${timeRes.timeStr}+07:00`;
      await clearConversationState(lineUserId, supabaseAdmin, profile.id);

      const { data: insertedItem } = await supabaseAdmin
        .from('items')
        .insert([{
          user_id: profile.id,
          title: title,
          description: `บันทึกผ่าน LINE Bot: ${title}`,
          status: 'Pending',
          reminder_date: isoString,
          is_pr: false
        }])
        .select('*')
        .single();

      if (insertedItem) {
        const bubble = createItemFlexBubble(insertedItem, appUrl);
        await sendLineReply(replyToken, [
          `🎉 บันทึกช่วยจำเรียบร้อยแล้วครับ!\n\n📝 **เรื่อง:** "${title}"\n🔔 **แจ้งเตือน:** ${targetDateDisplay} (เวลา ${timeRes.displayStr})`,
          {
            type: 'flex',
            altText: `📝 บันทึกช่วยจำ "${title}"`,
            contents: bubble
          }
        ]);
      } else {
        await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง');
      }
      return true;
    }

    // 3. User is in Reminder Mode and sent a new message (Start of Wizard or One-shot command)
    // Check if user message already contains embedded date and time info (e.g. "เปิด PR ... แจ้งเตือนวันที่ 17/08/26 ตอน 07:00 น.")
    const dateMatch = parseThaiDate(text);
    const timeMatch = parseThaiTime(text);

    // If message contains explicit reminder date pattern e.g. "แจ้งเตือนวันที่ 17/08/26..." or "วันที่ 17/8/26 เวลา 07:00"
    if (dateMatch && /แจ้งเตือน|วันที่|ตอน|เวลา/i.test(text)) {
      const timeStr = timeMatch ? timeMatch.timeStr : '09:00:00';
      const displayTimeStr = timeMatch ? timeMatch.displayStr : '09:00 น.';
      const isoString = `${dateMatch.dateStr}T${timeStr}+07:00`;

      // Extract clean title by stripping reminder date and time phrases
      let cleanTitle = text
        .replace(/(?:แจ้งเตือน)?วันที่\s*\d+[\/\.\-]\d+(?:[\/\.\-]\d+)?/gi, '')
        .replace(/(?:ตอน|เวลา)?\s*\d+[\.:]\d+\s*(?:น\.?)?/gi, '')
        .replace(/(?:แจ้งเตือน|ช่วยเตือน|เตือน)\s*(?:วันนี้|พรุ่งนี้|มะรืนนี้|สัปดาห์หน้า)?/gi, '')
        .replace(/(?:วันนี้|พรุ่งนี้|มะรืนนี้|สัปดาห์หน้า)/gi, '')
        .replace(/^(?:บันทึก|จด|ช่วยจำ|เพิ่ม)\s*/i, '')
        .replace(/[:\-ー\s\.]+$/, '')
        .trim();

      if (!cleanTitle) cleanTitle = text;

      const { data: insertedItem } = await supabaseAdmin
        .from('items')
        .insert([{
          user_id: profile.id,
          title: cleanTitle,
          description: `บันทึกผ่าน LINE Bot: ${text}`,
          status: 'Pending',
          reminder_date: isoString,
          is_pr: false
        }])
        .select('*')
        .single();

      if (insertedItem) {
        const bubble = createItemFlexBubble(insertedItem, appUrl);
        await sendLineReply(replyToken, [
          `🎉 บันทึกช่วยจำเรียบร้อยแล้วครับ!\n\n📝 **เรื่อง:** "${cleanTitle}"\n🔔 **แจ้งเตือน:** ${dateMatch.displayStr} (เวลา ${displayTimeStr})`,
          {
            type: 'flex',
            altText: `📝 บันทึกช่วยจำ "${cleanTitle}"`,
            contents: bubble
          }
        ]);
        return true;
      }
    }

    // Step 1 of Wizard: Message is the title -> Ask for reminder date
    const title = text.replace(/^(?:บันทึก|จด|ช่วยจำ|เพิ่ม)\s*/i, '').trim() || text;

    await setConversationState(lineUserId, {
      action: 'reminder_pending_date',
      title: title
    }, supabaseAdmin, profile.id);

    await sendLineReply(replyToken, {
      type: 'text',
      text: `📅 **ต้องการให้แจ้งเตือนวันไหนดีครับ?**\nสำหรับรายการ: "${title}"\n\n(พิมพ์วันที่ เช่น 17/8/26, พรุ่งนี้ หรือแตะเลือกปุ่มด้านล่าง)`,
      quickReply: {
        items: [
          { type: 'action', action: { type: 'message', label: '📅 วันนี้', text: 'วันนี้' } },
          { type: 'action', action: { type: 'message', label: '📅 พรุ่งนี้', text: 'พรุ่งนี้' } },
          { type: 'action', action: { type: 'message', label: '📅 สัปดาห์หน้า', text: 'สัปดาห์หน้า' } },
          { type: 'action', action: { type: 'message', label: '🚫 ไม่แจ้งเตือน', text: 'ไม่แจ้งเตือน' } },
          { type: 'action', action: { type: 'message', label: '❌ ยกเลิก', text: 'ยกเลิก' } }
        ]
      }
    });
    return true;
  }
}
