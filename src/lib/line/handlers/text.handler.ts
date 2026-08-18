import { SupabaseClient } from '@supabase/supabase-js';
import { sendLineReply } from '@/lib/line/client';
import { setUserModeState, getUserModeState, clearConversationState } from '@/lib/db/user-state';
import { memoryStateCache } from '@/lib/state-cache';
import { ProfileService, StockService, ItemService, PrService, CalibrationService } from '@/services';
import { StockModeController } from '../mode-controllers/stock-mode';
import { createPrListMenuFlex, createCalibrationListMenuFlex, createModeSelectionFlex } from '../flex-templates';

export async function handleTextEvent(
  event: any,
  supabaseAdmin: SupabaseClient,
  requestUrlOrigin: string
): Promise<boolean> {
  const replyToken = event.replyToken;
  const lineUserId = event.source.userId;
  const messageText = event.message.text.trim();
  const cleanMessageText = messageText.toLowerCase();

  // 1. Link LINE accounts via link code (#link CODE)
  const linkMatch = messageText.match(/^#link\s+(\w+)/i);
  if (linkMatch) {
    const linkCode = linkMatch[1].toUpperCase();
    const profile = await ProfileService.getProfileByLinkCode(supabaseAdmin, linkCode);

    if (!profile) {
      await sendLineReply(
        replyToken,
        '❌ รหัสเชื่อมต่อไม่ถูกต้อง หรือหมดอายุแล้ว กรุณาสร้างรหัสใหม่จากหน้าเว็บจำจดแล้วพิมพ์ใหม่อีกครั้ง'
      );
      return true;
    }

    const success = await ProfileService.linkLineUser(supabaseAdmin, profile.id, lineUserId);
    if (!success) {
      await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในระบบฐานข้อมูล กรุณาลองใหม่อีกครั้งภายหลัง');
    } else {
      await sendLineReply(
        replyToken,
        `✅ เชื่อมต่อบัญชีเรียบร้อยแล้ว!\nอีเมลที่เชื่อมต่อ: ${profile.email}\n\nคุณสามารถพิมพ์บันทึกข้อความหรือแจ้งเตือนผ่านแชตนี้ได้ทันที`
      );
    }
    return true;
  }

  // 2. Fetch profile associated with this lineUserId
  const profile = await ProfileService.getProfileByLineId(supabaseAdmin, lineUserId);

  if (!profile) {
    await sendLineReply(
      replyToken,
      '🔔 ยินดีต้อนรับสู่ จำจด (JumJod)!\n\nบัญชี LINE นี้ยังไม่ได้เชื่อมต่อกับระบบ เพื่อเริ่มช่วยจำกรุณาดำเนินการดังนี้:\n\n1. เข้าสู่ระบบทางหน้าเว็บจำจด\n2. ไปที่หน้าตั้งค่าและรับ "รหัสเชื่อมต่อไลน์"\n3. พิมพ์รหัสกลับมาในแชตนี้ ในรูปแบบ: #link รหัสของคุณ\n(เช่น #link ABC123D)'
    );
    return true;
  }

  // 3. General mode menu command
  if (cleanMessageText === 'โหมด' || cleanMessageText === 'เมนูโหมด' || cleanMessageText === 'เลือกโหมด') {
    memoryStateCache.delete(lineUserId);
    await clearConversationState(lineUserId, supabaseAdmin, profile.id);
    const flexMenu = createModeSelectionFlex();
    await sendLineReply(replyToken, {
      type: 'flex',
      altText: '🤖 กรุณาเลือกโหมดการทำงาน',
      contents: flexMenu
    });
    return true;
  }

  // 4. Mode switching commands
  if (cleanMessageText === 'โหมดบันทึก' || cleanMessageText === 'โหมดช่วยจำ' || cleanMessageText === 'บันทึกช่วยจำ' || cleanMessageText === 'ช่วยจำ' || cleanMessageText === 'บันทึก') {
    memoryStateCache.delete(lineUserId);
    await clearConversationState(lineUserId, supabaseAdmin, profile.id);
    await setUserModeState(profile, lineUserId, 'reminder', supabaseAdmin);
    await sendLineReply(replyToken, '📝 เข้าสู่โหมด **"ช่วยจำ"** เรียบร้อยครับ!\n\n⚡ **คำสั่งคีย์ลัด:**\n• พิมพ์ข้อความเพื่อบันทึก (เช่น "ประชุม 10 โมง")\n• `รายการ` : ดูรายการบันทึกทั้งหมด\n• `ออกโหมด` : รีเซ็ตกลับโหมดเริ่มต้น');
    return true;
  }

  if (cleanMessageText === 'โหมดสต็อก' || cleanMessageText === 'โหมดสต๊อก' || cleanMessageText === 'สต็อก' || cleanMessageText === 'สต๊อก') {
    memoryStateCache.delete(lineUserId);
    await clearConversationState(lineUserId, supabaseAdmin, profile.id);
    await setUserModeState(profile, lineUserId, 'stock', supabaseAdmin);
    await sendLineReply(replyToken, '📦 เข้าสู่โหมด **"สต็อกวัสดุ"** เรียบร้อยครับ!\n\n⚡ **คำสั่งคีย์ลัด:**\n• พิมพ์ทำรายการ (เช่น "เบิก แอลกอฮอล์ 5")\n• `รายการ` : ดูรายการสต็อกทั้งหมด\n• `ออกโหมด` : รีเซ็ตกลับโหมดเริ่มต้น');
    return true;
  }

  if (cleanMessageText === 'โหมดpr' || cleanMessageText === 'โหมด pr' || cleanMessageText === 'ติดตามpr' || cleanMessageText === 'ติดตาม pr') {
    memoryStateCache.delete(lineUserId);
    await clearConversationState(lineUserId, supabaseAdmin, profile.id);
    await setUserModeState(profile, lineUserId, 'pr', supabaseAdmin);
    await sendLineReply(replyToken, '📄 เข้าสู่โหมด **"ติดตาม PR"** เรียบร้อยครับ!\n\n⚡ **คำสั่งคีย์ลัด:**\n• พิมพ์หัวข้อเพื่อเปิด PR (เช่น "ซื้อคอมพิวเตอร์")\n• `รายการ` : ดูรายการติดตาม PR ทั้งหมด\n• `ออกโหมด` : รีเซ็ตกลับโหมดเริ่มต้น');
    return true;
  }

  if (cleanMessageText === 'โหมดcal' || cleanMessageText === 'โหมด cal' || cleanMessageText === 'โหมด calibrate' || cleanMessageText === 'calibrate' || cleanMessageText === 'แคล' || cleanMessageText === 'เครื่องมือ') {
    memoryStateCache.delete(lineUserId);
    await clearConversationState(lineUserId, supabaseAdmin, profile.id);
    await setUserModeState(profile, lineUserId, 'calibration', supabaseAdmin);
    await sendLineReply(replyToken, '🔬 เข้าสู่โหมด **"ติดตาม Calibrate"** เรียบร้อยครับ!\n\n⚡ **คำสั่งคีย์ลัด:**\n• พิมพ์ชื่อเครื่องมือ + วันที่ (เช่น "เครื่องชั่ง 15/08/2026")\n• `รายการ` : ดูรายการเครื่องมือทั้งหมด\n• `ออกโหมด` : รีเซ็ตกลับโหมดเริ่มต้น');
    return true;
  }

  if (cleanMessageText === 'ออกโหมด' || cleanMessageText === 'ยกเลิกโหมด' || cleanMessageText === 'รีเซ็ตโหมด') {
    memoryStateCache.delete(lineUserId);
    await clearConversationState(lineUserId, supabaseAdmin, profile.id);
    await setUserModeState(profile, lineUserId, null, supabaseAdmin);
    await sendLineReply(replyToken, '🔄 ออกจากโหมดพิเศษ เรียบร้อยแล้วครับ! กลับสู่โหมดเริ่มต้นอัตโนมัติ');
    return true;
  }

  // Fetch active mode
  const activeMode = await getUserModeState(profile, lineUserId, supabaseAdmin);

  // Delegate to StockModeController if in stock mode
  if (activeMode === 'stock') {
    const handled = await StockModeController.handleMessage(messageText, profile, replyToken, lineUserId, supabaseAdmin);
    if (handled) return true;
  }

  // Handle "รายการ" or "ดูรายการ" command based on active mode
  if (messageText.trim() === 'รายการ' || messageText.trim() === 'ดูรายการ') {
    if (activeMode === 'pr') {
      const prListFlex = createPrListMenuFlex();
      await sendLineReply(replyToken, prListFlex);
      return true;
    }

    if (activeMode === 'calibration') {
      const calListFlex = createCalibrationListMenuFlex();
      await sendLineReply(replyToken, calListFlex);
      return true;
    }

    const listMenuFlex = {
      type: 'flex',
      altText: '📋 เมนูเลือกดูรายการ',
      contents: {
        type: 'bubble',
        size: 'mega',
        header: {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#8b5cf6',
          contents: [
            {
              type: 'text',
              text: '📋 เมนูเลือกดูรายการ',
              weight: 'bold',
              color: '#ffffff',
              size: 'sm'
            }
          ]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          contents: [
            {
              type: 'text',
              text: 'กรุณาเลือกรายการที่คุณต้องการตรวจสอบ:',
              size: 'xs',
              color: '#64748b',
              wrap: true
            },
            {
              type: 'button',
              style: 'primary',
              color: '#8b5cf6',
              height: 'sm',
              action: {
                type: 'postback',
                label: '⏳ รายการที่ยังไม่สำเร็จ',
                data: 'action=view_items&status=active'
              }
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              action: {
                type: 'postback',
                label: '✅ รายการที่สำเร็จแล้ว',
                data: 'action=view_items&status=completed'
              }
            }
          ]
        }
      }
    };

    await sendLineReply(replyToken, listMenuFlex);
    return true;
  }

  return false;
}
