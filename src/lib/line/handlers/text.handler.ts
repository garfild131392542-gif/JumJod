import { SupabaseClient } from '@supabase/supabase-js';
import { sendLineReply } from '@/lib/line/client';
import { setUserModeState, getUserModeState, clearConversationState, getConversationState } from '@/lib/db/user-state';
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
      '🔔 ยินดีต้อนรับสู่ จำจด (JumJod)!\n\nบัญชี LINE นี้ยังไม่ได้เชื่อมต่อกับระบบ เพื่อเริ่มใช้งานกรุณาดำเนินการดังนี้:\n\n1. เข้าสู่ระบบทางหน้าเว็บ: https://jum-jod.vercel.app/\n2. รับ "รหัสเชื่อมต่อ LINE" บนหน้าเว็บ\n3. พิมพ์รหัสส่งกลับมาในแชตนี้ ในรูปแบบ: #link รหัสของคุณ\n(เช่น #link ABC123D)'
    );
    return true;
  }

  // 3. General mode menu command
  const modeMenuKeywords = [
    'โหมด', 'เมนูโหมด', 'เลือกโหมด', 'เมนู', 'หน้าหลัก', 'หน้าแรก', 'menu', 'home',
    'เริ่มต้น', 'เริ่มใหม่', 'เลือกระบบ', 'ระบบ'
  ];
  if (modeMenuKeywords.includes(cleanMessageText)) {
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

  // --- ช่วยจำ / Reminder mode ---
  const reminderModeKeywords = [
    'โหมดบันทึก', 'โหมดช่วยจำ', 'บันทึกช่วยจำ', 'ช่วยจำ', 'บันทึก',
    'reminder', 'โหมด reminder', 'โหมดreminder',
    'แจ้งเตือน', 'โหมดแจ้งเตือน', 'ตั้งเตือน', 'โหมดตั้งเตือน',
    'note', 'โหมด note', 'โหมดnote', 'บันทึกย่อ', 'จด', 'จดบันทึก'
  ];
  if (reminderModeKeywords.includes(cleanMessageText)) {
    memoryStateCache.delete(lineUserId);
    await clearConversationState(lineUserId, supabaseAdmin, profile.id);
    await setUserModeState(profile, lineUserId, 'reminder', supabaseAdmin);
    await sendLineReply(replyToken, '📝 เข้าสู่โหมด **"ช่วยจำ"** เรียบร้อยครับ!\n\nอยากให้จำจดช่วยจำเรื่องอะไรดีครับ?\n(พิมพ์หัวข้อหรือเรื่องที่ต้องการบันทึกเข้ามาได้เลยครับ)');
    return true;
  }

  // --- สต็อก / Stock mode ---
  const stockModeKeywords = [
    'โหมดสต็อก', 'โหมดสต๊อก', 'สต็อก', 'สต๊อก',
    'stock', 'โหมด stock', 'โหมดstock',
    'สต็อกวัสดุ', 'โหมดสต็อกวัสดุ', 'วัสดุ', 'โหมดวัสดุ',
    'คลัง', 'คลังสินค้า', 'โหมดคลัง', 'inventory', 'โหมด inventory', 'โหมดinventory'
  ];
  if (stockModeKeywords.includes(cleanMessageText)) {
    memoryStateCache.delete(lineUserId);
    await clearConversationState(lineUserId, supabaseAdmin, profile.id);
    await setUserModeState(profile, lineUserId, 'stock', supabaseAdmin);
    await sendLineReply(replyToken, '📦 เข้าสู่โหมด **"สต็อกวัสดุ"** เรียบร้อยครับ!\n\n⚡ **คำสั่งคีย์ลัด:**\n• พิมพ์ทำรายการ (เช่น "เบิก แอลกอฮอล์ 5")\n• `รายการ` : ดูรายการสต็อกทั้งหมด\n• `ออกโหมด` : รีเซ็ตกลับโหมดเริ่มต้น');
    return true;
  }

  // --- PR / Purchase Request mode ---
  const prModeKeywords = [
    'โหมดpr', 'โหมด pr', 'ติดตามpr', 'ติดตาม pr',
    'pr', 'purchase request', 'ติดตาม', 'โหมดติดตาม',
    'kanban', 'โหมด kanban', 'โหมดkanban',
    'คำขอซื้อ', 'โหมดคำขอซื้อ', 'ใบขอซื้อ'
  ];
  if (prModeKeywords.includes(cleanMessageText)) {
    memoryStateCache.delete(lineUserId);
    await clearConversationState(lineUserId, supabaseAdmin, profile.id);
    await setUserModeState(profile, lineUserId, 'pr', supabaseAdmin);
    await sendLineReply(replyToken, '📄 เข้าสู่โหมด **"ติดตาม PR"** เรียบร้อยครับ!\n\n⚡ **คำสั่งคีย์ลัด:**\n• พิมพ์หัวข้อเพื่อเปิด PR (เช่น "ซื้อคอมพิวเตอร์")\n• `รายการ` : ดูรายการติดตาม PR ทั้งหมด\n• `ออกโหมด` : รีเซ็ตกลับโหมดเริ่มต้น');
    return true;
  }

  // --- Calibration mode ---
  const calibrationModeKeywords = [
    'โหมดcal', 'โหมด cal', 'โหมด calibrate', 'calibrate', 'แคล', 'เครื่องมือ',
    'cal', 'calibration', 'โหมด calibration', 'โหมดcalibration',
    'สอบเทียบ', 'โหมดสอบเทียบ', 'ตรวจสอบเครื่องมือ',
    'lab', 'โหมด lab', 'โหมดlab'
  ];
  if (calibrationModeKeywords.includes(cleanMessageText)) {
    memoryStateCache.delete(lineUserId);
    await clearConversationState(lineUserId, supabaseAdmin, profile.id);
    await setUserModeState(profile, lineUserId, 'calibration', supabaseAdmin);
    await sendLineReply(replyToken, '🔬 เข้าสู่โหมด **"ติดตาม Calibrate"** เรียบร้อยครับ!\n\n⚡ **คำสั่งคีย์ลัด:**\n• พิมพ์ชื่อเครื่องมือ + วันที่ (เช่น "เครื่องชั่ง 15/08/2026")\n• `รายการ` : ดูรายการเครื่องมือทั้งหมด\n• `ออกโหมด` : รีเซ็ตกลับโหมดเริ่มต้น');
    return true;
  }

  // --- Exit / Reset mode (explicit — always fire regardless of state) ---
  // These keywords are unambiguous: user clearly wants to exit the current mode entirely.
  const exitModeExplicitKeywords = [
    'ออกโหมด', 'ยกเลิกโหมด', 'รีเซ็ตโหมด', 'กลับหน้าหลัก', 'exit mode', 'reset mode'
  ];
  if (exitModeExplicitKeywords.includes(cleanMessageText)) {
    memoryStateCache.delete(lineUserId);
    await clearConversationState(lineUserId, supabaseAdmin, profile.id);
    await setUserModeState(profile, lineUserId, null, supabaseAdmin);
    await sendLineReply(replyToken, '🔄 ออกจากโหมดพิเศษ เรียบร้อยแล้วครับ! กลับสู่โหมดเริ่มต้นอัตโนมัติ');
    return true;
  }

  // 5. If user is in an active pending conversation state (e.g. editing stock/memo/pr, pending qty input),
  // bypass mode AI controllers and let route.ts handle the state directly to prevent unnecessary AI latency.
  const userState = await getConversationState(lineUserId, profile, supabaseAdmin);
  if (userState) {
    return false;
  }

  // --- Exit / Reset mode (ambiguous — only fire when no active conversation state) ---
  // These keywords overlap with mode-level cancel commands (e.g. reminder uses ยกเลิก/cancel/ออก to cancel
  // the current step). Only intercept here when the user has no pending sub-state, so mode controllers get
  // first dibs during a multi-step flow.
  const exitModeAmbiguousKeywords = [
    'ออก', 'exit', 'back', 'กลับ',
    'ยกเลิก', 'cancel',
    'clear', 'เคลียร์', 'รีเซ็ต', 'reset'
  ];
  if (exitModeAmbiguousKeywords.includes(cleanMessageText)) {
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
    if (!activeMode) {
      const flexMenu = createModeSelectionFlex();
      await sendLineReply(replyToken, {
        type: 'flex',
        altText: '🤖 กรุณาเลือกโหมดการทำงานก่อนดูรายการครับ',
        contents: flexMenu
      });
      return true;
    }

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

    if (activeMode === 'reminder') {
      const listMenuFlex = {
        type: 'flex',
        altText: '📋 เมนูเลือกดูรายการ',
        contents: {
          type: 'bubble',
          size: 'mega',
          styles: {
            body: { backgroundColor: '#F3E8D5' }
          },
          body: {
            type: 'box',
            layout: 'vertical',
            paddingAll: '24px',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: 'รายการ',
                    size: 'xxs',
                    color: '#766752',
                    weight: 'bold',
                    align: 'center'
                  }
                ],
                backgroundColor: '#AEC5D6',
                paddingAll: '4px',
                paddingStart: '12px',
                paddingEnd: '12px',
                position: 'absolute',
                offsetTop: '12px',
                offsetStart: '120px',
                cornerRadius: 'sm',
                style: 'border'
              },
              {
                type: 'box',
                layout: 'horizontal',
                margin: 'xl',
                contents: [
                  {
                    type: 'text',
                    text: '📋',
                    size: 'xl',
                    flex: 0
                  },
                  {
                    type: 'text',
                    text: 'เมนูเลือกดูรายการ',
                    weight: 'bold',
                    size: 'md',
                    color: '#B68B40',
                    align: 'center',
                    wrap: true
                  }
                ]
              },
              {
                type: 'text',
                text: 'กรุณาเลือกรายการที่คุณต้องการตรวจสอบ:',
                size: 'xs',
                color: '#8A7A61',
                align: 'center',
                margin: 'md',
                wrap: true
              },
              {
                type: 'box',
                layout: 'vertical',
                margin: 'xl',
                spacing: 'sm',
                contents: [
                  {
                    type: 'button',
                    style: 'primary',
                    color: '#E5D6A7',
                    height: 'sm',
                    action: {
                      type: 'postback',
                      label: '⏳ ยังไม่สำเร็จ',
                      data: 'action=view_items&status=active'
                    }
                  },
                  {
                    type: 'button',
                    style: 'primary',
                    color: '#D4C3A3',
                    height: 'sm',
                    action: {
                      type: 'postback',
                      label: '✅ สำเร็จแล้ว',
                      data: 'action=view_items&status=completed'
                    }
                  }
                ]
              }
            ]
          }
        }
      };

      await sendLineReply(replyToken, listMenuFlex);
      return true;
    }
  }

  return false;
}
