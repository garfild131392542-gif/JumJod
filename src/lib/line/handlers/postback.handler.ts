import { SupabaseClient } from '@supabase/supabase-js';
import { sendLineReply } from '@/lib/line/client';
import { memoryStateCache } from '@/lib/state-cache';
import { getUserModeState, getConversationState, setConversationState, clearConversationState } from '@/lib/db/user-state';
import {
  createItemFlexBubble,
  createStockActionMenuFlex,
  createStockEditMenuFlex,
  createPrFlexBubble,
  createPrEditMenuFlex,
  createPrStatusMenuFlex,
  createCalibrationFlexBubble
} from '@/lib/line/flex-templates';
import { ItemService, StockService, ProfileService, PrService, CalibrationService } from '@/services';

export async function handlePostbackEvent(
  event: any,
  supabaseAdmin: SupabaseClient,
  requestUrlOrigin: string
): Promise<void> {
  const replyToken = event.replyToken;
  const lineUserId = event.source.userId;
  const lineGroupId = event.source.type === 'group' || event.source.type === 'room' ? event.source.groupId || event.source.roomId : null;
  const profile = await ProfileService.getProfileByLineId(supabaseAdmin, lineUserId);

  const params = new URLSearchParams(event.postback.data);
  const action = params.get('action');
  const itemId = params.get('itemId');

  if (action === 'complete') {
    if (!itemId) return;
    const item = await ItemService.getItemById(supabaseAdmin, itemId);
    if (!item) {
      await sendLineReply(replyToken, '❌ ไม่พบรายการนี้ หรืออาจถูกลบไปแล้ว');
      return;
    }

    const updated = await ItemService.markCompleted(supabaseAdmin, itemId);
    if (!updated) {
      await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการบันทึกข้อมูลสำเร็จ');
    } else {
      await sendLineReply(
        replyToken,
        `🎉 บันทึกสำเร็จแล้ว!\nอัปเดตรายการ "${item.title}" เป็น "สำเร็จ" เรียบร้อยแล้ว\n*รายการนี้จะย้ายจากบอร์ดไปแสดงที่หน้า 'รายการสำเร็จ' ทันที*`
      );
    }
  } else if (action === 'set_requested') {
    if (!itemId) return;
    const item = await ItemService.getItemById(supabaseAdmin, itemId);
    if (!item) {
      await sendLineReply(replyToken, '❌ ไม่พบรายการนี้ หรืออาจถูกลบไปแล้ว');
      return;
    }

    const { error: updateError } = await supabaseAdmin
      .from('items')
      .update({
        item_request_status: 'Pending',
        status: 'Pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', itemId);

    if (updateError) {
      await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการบันทึกข้อมูลรายการ');
    } else {
      await sendLineReply(
        replyToken,
        `⏳ บันทึกข้อมูลเรียบร้อย!\nอัปเดตรายการ "${item.title}" เรียบร้อยแล้วครับ`
      );
    }
  } else if (action === 'delete') {
    if (!itemId) return;
    const item = await ItemService.getItemById(supabaseAdmin, itemId);
    if (!item) {
      await sendLineReply(replyToken, '❌ ไม่พบรายการนี้ หรืออาจถูกลบไปแล้ว');
      return;
    }

    const success = await ItemService.deleteItem(supabaseAdmin, itemId);
    if (!success) {
      await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการลบรายการ');
    } else {
      await sendLineReply(replyToken, `🗑️ ลบรายการ "${item.title}" เรียบร้อยแล้วครับ!`);
    }
  } else if (action === 'request_edit') {
    if (!itemId) return;
    const item = await ItemService.getItemById(supabaseAdmin, itemId);
    if (!item) {
      await sendLineReply(replyToken, '❌ ไม่พบรายการนี้ หรืออาจถูกลบไปแล้ว');
      return;
    }

    await setConversationState(lineUserId, { action: 'editing', itemId: itemId, itemTitle: item.title }, supabaseAdmin, profile?.id);

    const promptMsg = `✍️ เตรียมแก้ไขรายการ: "${item.title}"\n\nกรุณาพิมพ์รายละเอียดใหม่ที่คุณต้องการแก้ไขเข้ามาได้เลยครับ เช่น:\n- "แก้ชื่อเป็น [ชื่อใหม่]"\n- "แก้เวลาแจ้งเตือนเป็น วันที่ 15/07/26 เวลา 12:00 น."\n- "แก้เวลาเป็น พรุ่งนี้ 9 โมงเช้า"\n- "ยกเลิกแจ้งเตือน" (เพื่อปิดการแจ้งเตือน)\n(บอทจะอัปเดตข้อมูลรายการนี้โดยตรง)`;

    await sendLineReply(replyToken, {
      type: 'text',
      text: promptMsg,
      quickReply: {
        items: [
          {
            type: 'action',
            action: {
              type: 'datetimepicker',
              label: '📅 ตั้งเวลาแจ้งเตือน',
              data: `action=set_reminder_date_picker&itemId=${itemId}`,
              mode: 'datetime'
            }
          },
          {
            type: 'action',
            action: {
              type: 'postback',
              label: '❌ ยกเลิกการแก้ไข',
              data: `action=cancel_edit`
            }
          }
        ]
      }
    });
  } else if (action === 'snooze') {
    if (!itemId) return;
    const item = await ItemService.getItemById(supabaseAdmin, itemId);
    if (!item) {
      await sendLineReply(replyToken, '❌ ไม่พบรายการนี้ หรืออาจถูกลบไปแล้ว');
      return;
    }

    let newReminderDate = new Date();
    const minutesStr = params.get('minutes');
    const timeStr = params.get('time');

    if (minutesStr) {
      const minutes = parseInt(minutesStr);
      newReminderDate.setMinutes(newReminderDate.getMinutes() + minutes);
    } else if (timeStr === 'tomorrow_morning') {
      newReminderDate.setDate(newReminderDate.getDate() + 1);
      const pad = (n: number) => String(n).padStart(2, '0');
      const localISO = `${newReminderDate.getFullYear()}-${pad(newReminderDate.getMonth() + 1)}-${pad(newReminderDate.getDate())}T09:00:00+07:00`;
      newReminderDate = new Date(localISO);
    } else {
      await sendLineReply(replyToken, '❌ รูปแบบการเลื่อนเวลาไม่ถูกต้อง');
      return;
    }

    const { data: updatedItem, error: updateError } = await supabaseAdmin
      .from('items')
      .update({
        reminder_date: newReminderDate.toISOString(),
        reminder_sent: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', itemId)
      .select('*')
      .single();

    if (updateError || !updatedItem) {
      await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการเลื่อนเวลาแจ้งเตือน');
    } else {
      const formattedDate = newReminderDate.toLocaleDateString('en-GB', { timeZone: 'Asia/Bangkok' });
      const formattedTime = newReminderDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
      await sendLineReply(
        replyToken,
        `⏳ เลื่อนเวลาแจ้งเตือนเรียบร้อยแล้ว!\n\nรายการ: "${updatedItem.title}"\nเวลาแจ้งเตือนใหม่: ${formattedDate} (เวลา ${formattedTime} น.)`
      );
    }
  } else if (action === 'set_reminder_date_picker') {
    const datetimeStr = event.postback.params?.datetime;
    if (!datetimeStr || !itemId) return;

    const localISO = `${datetimeStr}:00+07:00`;
    const dateObj = new Date(localISO);
    if (isNaN(dateObj.getTime())) return;

    const { data: updatedItem, error } = await supabaseAdmin
      .from('items')
      .update({
        reminder_date: dateObj.toISOString(),
        reminder_sent: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', itemId)
      .select('*')
      .single();

    await clearConversationState(lineUserId, supabaseAdmin, profile?.id);

    if (error || !updatedItem) {
      await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการตั้งเวลาแจ้งเตือน');
    } else {
      const formattedDate = dateObj.toLocaleDateString('en-GB', { timeZone: 'Asia/Bangkok' });
      const formattedTime = dateObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
      await sendLineReply(replyToken, `🔔 ตั้งเวลาแจ้งเตือนสำเร็จ!\n\nรายการ: "${updatedItem.title}"\nเวลาแจ้งเตือนใหม่: ${formattedDate} (เวลา ${formattedTime} น.)`);
    }
  } else if (action === 'cancel_edit') {
    await clearConversationState(lineUserId, supabaseAdmin, profile?.id);
    await sendLineReply(replyToken, '✅ ยกเลิกการแก้ไขรายการเรียบร้อยแล้วครับ');
  } else if (action === 'confirm_ocr_reminder') {
    const userState = await getConversationState(lineUserId, profile, supabaseAdmin);
    if (userState && userState.action === 'pending_ocr_reminder') {
      const ocrData = userState.data;
      const userProfile = profile || await ProfileService.getProfileByLineId(supabaseAdmin, lineUserId);

      if (!userProfile) {
        await sendLineReply(replyToken, '❌ ไม่พบบัญชีผู้ใช้งานที่เชื่อมต่อ');
        return;
      }

      const { data: insertedItem, error: insertError } = await supabaseAdmin
        .from('items')
        .insert([
          {
            user_id: userProfile.id,
            title: ocrData.title,
            description: ocrData.description,
            status: 'Pending',
            reminder_date: ocrData.reminder_date,
            image_url: ocrData.imageUrl || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_pr: false,
            line_group_id: lineGroupId
          }
        ])
        .select('*')
        .single();

      await clearConversationState(lineUserId, supabaseAdmin, profile?.id);

      if (insertError || !insertedItem) {
        await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง');
      } else {
        const bubble = createItemFlexBubble(insertedItem, requestUrlOrigin);
        await sendLineReply(replyToken, [
          '✅ บันทึกช่วยจำจากภาพถ่ายเรียบร้อยแล้วครับ!',
          {
            type: 'flex',
            altText: `📌 บันทึกช่วยจำ "${insertedItem.title}"`,
            contents: bubble
          }
        ]);
      }
    } else {
      await sendLineReply(replyToken, '❌ ไม่พบข้อมูลการสแกนหรือข้อมูลหมดอายุแล้วครับ');
    }
  } else if (action === 'cancel_ocr_reminder') {
    await clearConversationState(lineUserId, supabaseAdmin, profile?.id);
    await sendLineReply(replyToken, '✅ ยกเลิกการบันทึกรายการแล้วครับ');
  } else if (action === 'stock_select_action') {
    const stockId = params.get('id');
    if (!stockId) return;
    const stock = await StockService.getStockById(supabaseAdmin, stockId);
    if (!stock) {
      await sendLineReply(replyToken, '❌ ไม่พบวัสดุชิ้นนี้ในสต็อกแล้ว');
      return;
    }
    await sendLineReply(replyToken, {
      type: 'flex',
      altText: `📦 เลือกการดำเนินการสำหรับ "${stock.name}"`,
      contents: createStockActionMenuFlex(stock)
    });
  } else if (action === 'stock_edit_menu') {
    if (lineGroupId) {
      await sendLineReply(replyToken, '❌ ไม่ได้รับสิทธิ์ในการแก้ไขข้อมูลรายละเอียดวัสดุผ่านกลุ่มไลน์ครับ');
      return;
    }
    const stockId = params.get('id');
    if (!stockId) return;
    const stock = await StockService.getStockById(supabaseAdmin, stockId);
    if (!stock) {
      await sendLineReply(replyToken, '❌ ไม่พบวัสดุชิ้นนี้ในสต็อกแล้ว');
      return;
    }
    await sendLineReply(replyToken, {
      type: 'flex',
      altText: `✏️ แก้ไขข้อมูล "${stock.name}"`,
      contents: createStockEditMenuFlex(stock)
    });
  } else if (action === 'stock_request_edit') {
    if (lineGroupId) {
      await sendLineReply(replyToken, '❌ ไม่ได้รับสิทธิ์ในการแก้ไขข้อมูลรายละเอียดวัสดุผ่านกลุ่มไลน์ครับ');
      return;
    }
    const stockId = params.get('id');
    const field = params.get('field') || 'name';
    if (!stockId) return;

    const stock = await StockService.getStockById(supabaseAdmin, stockId);
    if (!stock) {
      await sendLineReply(replyToken, '❌ ไม่พบวัสดุชิ้นนี้ในสต็อกแล้ว');
      return;
    }

    const fieldLabels: Record<string, string> = {
      name: 'ชื่อวัสดุใหม่',
      desc: 'รายละเอียดวัสดุใหม่',
      min: 'เกณฑ์ขั้นต่ำใหม่ (พิมพ์เป็นตัวเลข เช่น 5 หรือ 10)',
      priority: 'ระดับความสำคัญใหม่'
    };

    const label = fieldLabels[field] || 'ข้อมูลใหม่';

    await setConversationState(lineUserId, {
      action: 'stock_editing',
      stockId: stock.id,
      stockName: stock.name,
      field: field
    }, supabaseAdmin, profile?.id);

    if (field === 'priority') {
      await sendLineReply(replyToken, {
        type: 'text',
        text: `⚡ **กำลังแก้ไขความสำคัญ**\nสำหรับวัสดุ: "${stock.name}"\n(ระดับปัจจุบัน: ${stock.priority || 'Medium'})\n\nกรุณาเลือกหรือพิมพ์ระดับความสำคัญ:`,
        quickReply: {
          items: [
            { type: 'action', action: { type: 'message', label: '🔴 High (ด่วนมาก)', text: 'High' } },
            { type: 'action', action: { type: 'message', label: '🟡 Medium (ปานกลาง)', text: 'Medium' } },
            { type: 'action', action: { type: 'message', label: '🟢 Low (ทั่วไป)', text: 'Low' } },
            { type: 'action', action: { type: 'postback', label: '❌ ยกเลิก', data: 'action=stock_cancel' } }
          ]
        }
      });
    } else {
      await sendLineReply(replyToken, {
        type: 'text',
        text: `✍️ **กำลังแก้ไข ${label}**\nสำหรับวัสดุ: "${stock.name}"\n\nกรุณาพิมพ์ข้อความที่ต้องการแก้ไขเข้ามาในแชตนี้ได้เลยครับ`,
        quickReply: {
          items: [
            {
              type: 'action',
              action: {
                type: 'postback',
                label: '❌ ยกเลิกการแก้ไข',
                data: 'action=stock_cancel'
              }
            }
          ]
        }
      });
    }
  } else if (action === 'stock_manage') {
    const stockId = params.get('id');
    if (!stockId) return;
    const stock = await StockService.getStockById(supabaseAdmin, stockId);
    if (!stock) {
      await sendLineReply(replyToken, '❌ ไม่พบวัสดุชิ้นนี้ในสต็อกแล้ว');
      return;
    }
    await sendLineReply(replyToken, {
      type: 'flex',
      altText: `📦 เลือกการดำเนินการสำหรับ "${stock.name}"`,
      contents: createStockActionMenuFlex(stock)
    });
  } else if (action === 'stock_delete_confirm') {
    if (lineGroupId) {
      await sendLineReply(replyToken, '❌ ไม่ได้รับสิทธิ์ในการลบวัสดุออกจากคลังผ่านกลุ่มไลน์ครับ');
      return;
    }
    const stockId = params.get('id');
    if (!stockId) return;
    const stock = await StockService.getStockById(supabaseAdmin, stockId);
    if (!stock) {
      await sendLineReply(replyToken, '❌ ไม่พบวัสดุชิ้นนี้ในสต็อกแล้ว');
      return;
    }
    await sendLineReply(replyToken, {
      type: 'flex',
      altText: `🗑️ ยืนยันลบ "${stock.name}"?`,
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          contents: [
            { type: 'text', text: '⚠️ ยืนยันการลบ', weight: 'bold', size: 'md', color: '#ef4444' },
            { type: 'text', text: `คุณต้องการลบวัสดุ "${stock.name}" ออกจากคลังสต็อกหรือไม่?`, size: 'sm', wrap: true, color: '#334155' },
            { type: 'text', text: 'การดำเนินการนี้ไม่สามารถย้อนกลับได้', size: 'xs', color: '#94a3b8', wrap: true }
          ]
        },
        footer: {
          type: 'box',
          layout: 'horizontal',
          spacing: 'sm',
          contents: [
            {
              type: 'button', style: 'primary', color: '#ef4444', height: 'sm', flex: 1,
              action: { type: 'postback', label: '🗑️ ลบเลย', data: `action=stock_delete_execute&id=${stockId}` }
            },
            {
              type: 'button', style: 'secondary', height: 'sm', flex: 1,
              action: { type: 'postback', label: '❌ ยกเลิก', data: `action=stock_cancel` }
            }
          ]
        }
      }
    });
  } else if (action === 'stock_delete_execute') {
    if (lineGroupId) {
      await sendLineReply(replyToken, '❌ ไม่ได้รับสิทธิ์ในการลบวัสดุออกจากคลังผ่านกลุ่มไลน์ครับ');
      return;
    }
    const stockId = params.get('id');
    if (!stockId) return;
    const stock = await StockService.getStockById(supabaseAdmin, stockId);
    const success = await StockService.deleteStockItem(supabaseAdmin, stockId);
    if (!success) {
      await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการลบวัสดุ');
    } else {
      await sendLineReply(replyToken, `🗑️ ลบวัสดุ "${stock?.name || ''}" ออกจากคลังเรียบร้อยแล้วครับ!`);
    }
  } else if (action === 'stock_cancel') {
    await clearConversationState(lineUserId, supabaseAdmin, profile?.id);
    await sendLineReply(replyToken, '✅ ยกเลิกการดำเนินการแล้วครับ');
  } else if (action === 'stock_execute') {
    const id = params.get('id')!;
    const op = params.get('op')!;
    const qtyStr = params.get('qty');
    const qty = qtyStr ? parseInt(qtyStr) : null;

    const stockItem = await StockService.getStockById(supabaseAdmin, id);
    if (!stockItem) {
      await sendLineReply(replyToken, '❌ ไม่พบวัสดุชิ้นนี้ในสต็อกแล้ว');
      return;
    }

    if (op === 'CHECK') {
      const isAlert = stockItem.quantity <= (stockItem.min_threshold ?? 0);
      const alertMsg = isAlert ? `\n⚠️ ระดับวัสดุต่ำกว่าเกณฑ์ขั้นต่ำแล้ว! (เกณฑ์ขั้นต่ำ: ${stockItem.min_threshold} ${stockItem.unit})` : '';
      await sendLineReply(replyToken, `📦 วัสดุ "${stockItem.name}"\nยอดคงเหลือปัจจุบัน: ${stockItem.quantity} ${stockItem.unit}${alertMsg}`);
      return;
    }

    if (qty !== null && !isNaN(qty)) {
      let delta = qty;
      if (op === 'SUBTRACT') delta = -qty;
      if (op === 'SET') delta = qty - stockItem.quantity;

      const res = await StockService.adjustStockQuantity(supabaseAdmin, id, delta);
      if (!res.success || !res.updatedStock) {
        await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการปรับยอดสต็อก');
      } else {
        const opText = op === 'SUBTRACT' ? 'เบิกออก' : op === 'ADD' ? 'เติมสต็อก' : 'ปรับยอด';
        const isAlertTriggered = res.updatedStock.quantity <= res.updatedStock.min_threshold && stockItem.quantity > res.updatedStock.min_threshold;
        const alertMsg = isAlertTriggered ? `\n\n⚠️ **คำเตือน:** ระดับวัสดุลดลงต่ำกว่าเกณฑ์ขั้นต่ำแล้ว! (เกณฑ์: ${res.updatedStock.min_threshold} ${res.updatedStock.unit})` : '';
        await sendLineReply(replyToken, `✅ ทำการ${opText}วัสดุ "${stockItem.name}" เรียบร้อยแล้วครับ!\n\nยอดเดิม: ${stockItem.quantity} ${stockItem.unit}\nทำรายการ: ${qty} ${stockItem.unit}\nยอดคงเหลือใหม่: ${res.updatedStock.quantity} ${res.updatedStock.unit} 📦${alertMsg}`);
      }
    } else {
      await setConversationState(lineUserId, {
        action: 'stock_pending_qty',
        stockId: id,
        operation: op,
        stockName: stockItem.name,
        stockUnit: stockItem.unit
      }, supabaseAdmin, profile?.id);
      const opText = op === 'SUBTRACT' ? 'เบิก' : op === 'ADD' ? 'เติม' : 'ปรับยอด';
      await sendLineReply(replyToken, {
        type: 'text',
        text: `📦 ต้องการ${opText}วัสดุ "${stockItem.name}" จำนวนเท่าไหร่ดีครับ?\n\n(กรุณาพิมพ์จำนวนเป็นตัวเลข เช่น "5" หรือ "10")`,
        quickReply: {
          items: [
            {
              type: 'action',
              action: {
                type: 'postback',
                label: '❌ ยกเลิก',
                data: 'action=stock_cancel'
              }
            }
          ]
        }
      });
    }
  } else if (action === 'stock_create_prompt') {
    const rawName = params.get('name');
    const name = rawName ? decodeURIComponent(rawName) : '';
    const qtyStr = params.get('qty');
    const qty = qtyStr ? parseInt(qtyStr) : null;

    if (!name) {
      await sendLineReply(replyToken, '❌ ไม่พบชื่อวัสดุที่ต้องการสร้าง');
      return;
    }

    if (qty !== null && !isNaN(qty) && qty > 0) {
      const userProfile = profile || await ProfileService.getProfileByLineId(supabaseAdmin, lineUserId);
      if (!userProfile) {
        await sendLineReply(replyToken, '❌ บัญชีของคุณยังไม่ได้เชื่อมต่อกับระบบ กรุณาพิมพ์รหัสเชื่อมต่อก่อนครับ');
        return;
      }
      const category = name.includes('lab') || name.includes('แล็บ') || name.includes('สารเคมี') ? 'Laboratory' : 'อุปกรณ์สำนักงาน';
      const { data: newStock, error: createError } = await supabaseAdmin
        .from('stocks')
        .insert([{
          user_id: userProfile.id,
          name: name,
          quantity: qty,
          unit: 'ชิ้น',
          category: category
        }])
        .select('*')
        .single();

      if (createError || !newStock) {
        await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการสร้างรายการสต็อกใหม่');
      } else {
        await sendLineReply(replyToken, `🎉 สร้างวัสดุใหม่ **"${name}"** ในคลังเรียบร้อยแล้วครับ!\n\nหมวดหมู่: ${category}\nจำนวนเริ่มต้น: ${qty} ชิ้น 📦`);
      }
    } else {
      await setConversationState(lineUserId, {
        action: 'stock_pending_create_qty',
        stockName: name
      }, supabaseAdmin, profile?.id);
      await sendLineReply(replyToken, {
        type: 'text',
        text: `📦 ต้องการสร้างวัสดุใหม่ **"${name}"**\nกรุณาระบุจำนวนตั้งต้นเป็นตัวเลข (เช่น "10" หรือ "50"):`,
        quickReply: {
          items: [
            {
              type: 'action',
              action: {
                type: 'postback',
                label: '❌ ยกเลิก',
                data: 'action=stock_cancel'
              }
            }
          ]
        }
      });
    }
  } else if (action === 'view_items') {
    const statusParam = params.get('status');
    const userProfile = profile || await ProfileService.getProfileByLineId(supabaseAdmin, lineUserId);
    if (!userProfile) {
      await sendLineReply(replyToken, '❌ ไม่พบบัญชีผู้ใช้งานที่เชื่อมต่อกับไลน์นี้');
      return;
    }

    const itemsList = await ItemService.getItemsByUserId(supabaseAdmin, userProfile.id, statusParam === 'completed', 10);
    if (!itemsList || itemsList.length === 0) {
      const statusName = statusParam === 'completed' ? 'ที่สำเร็จแล้ว' : 'ที่ยังไม่สำเร็จ';
      await sendLineReply(replyToken, `📋 ไม่พบรายการ${statusName}ในขณะนี้`);
      return;
    }

    const bubbles = itemsList.map((item: any) => createItemFlexBubble(item, requestUrlOrigin));
    await sendLineReply(replyToken, {
      type: 'flex',
      altText: `📋 รายการบันทึกช่วยจำ (${statusParam === 'completed' ? 'สำเร็จแล้ว' : 'ที่ยังไม่สำเร็จ'})`,
      contents: {
        type: 'carousel',
        contents: bubbles
      }
    });
  } else if (action === 'view_prs') {
    const statusParam = params.get('status');
    const userProfile = profile || await ProfileService.getProfileByLineId(supabaseAdmin, lineUserId);
    if (!userProfile) {
      await sendLineReply(replyToken, '❌ ไม่พบบัญชีผู้ใช้งานที่เชื่อมต่อกับไลน์นี้');
      return;
    }

    let prQuery = supabaseAdmin
      .from('pr_requests')
      .select('*')
      .eq('user_id', userProfile.id)
      .order('created_at', { ascending: false });

    if (statusParam === 'pending') {
      prQuery = prQuery.neq('status', 'Completed');
    } else if (statusParam === 'completed') {
      prQuery = prQuery.eq('status', 'Completed');
    }

    const { data: prList, error } = await prQuery.limit(10);
    if (error || !prList || prList.length === 0) {
      const statusName = statusParam === 'pending' ? 'ที่กำลังติดตาม' : statusParam === 'completed' ? 'ที่เสร็จสมบูรณ์แล้ว' : 'ทั้งหมด';
      await sendLineReply(replyToken, `📄 ไม่พบรายการ PR ${statusName} ในขณะนี้`);
      return;
    }

    const bubbles = prList.map(pr => createPrFlexBubble(pr, requestUrlOrigin));
    await sendLineReply(replyToken, {
      type: 'flex',
      altText: `📄 รายการติดตาม PR ของคุณ (${prList.length} รายการ)`,
      contents: {
        type: 'carousel',
        contents: bubbles
      }
    });
  } else if (action === 'view_calibrations') {
    const statusParam = params.get('status');
    const userProfile = profile || await ProfileService.getProfileByLineId(supabaseAdmin, lineUserId);
    if (!userProfile) {
      await sendLineReply(replyToken, '❌ ไม่พบบัญชีผู้ใช้งานที่เชื่อมต่อกับไลน์นี้');
      return;
    }

    let calQuery = supabaseAdmin
      .from('lab_calibrations')
      .select('*')
      .eq('user_id', userProfile.id)
      .order('next_cal_date', { ascending: true });

    if (statusParam === 'due') {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      calQuery = calQuery.lte('next_cal_date', futureDate.toISOString());
    }

    const { data: calList, error } = await calQuery.limit(10);
    if (error || !calList || calList.length === 0) {
      const statusName = statusParam === 'due' ? 'ที่ใกล้ถึงกำหนดใน 30 วัน' : 'ทั้งหมด';
      await sendLineReply(replyToken, `🔬 ไม่พบรายการเครื่องมือวัด Lab ${statusName} ในขณะนี้`);
      return;
    }

    const bubbles = calList.map(cal => createCalibrationFlexBubble(cal, requestUrlOrigin));
    await sendLineReply(replyToken, {
      type: 'flex',
      altText: '🔬 รายการ Calibrate เครื่องมือวัด Lab ของคุณ',
      contents: {
        type: 'carousel',
        contents: bubbles
      }
    });
  } else if (action === 'pr_complete') {
    if (!itemId) return;
    const item = await PrService.getPrById(supabaseAdmin, itemId);
    if (!item) {
      await sendLineReply(replyToken, '❌ ไม่พบรายการ PR นี้ หรืออาจถูกลบไปแล้ว');
      return;
    }

    const { error: updateError } = await supabaseAdmin
      .from('pr_requests')
      .update({
        status: 'Completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', itemId);

    if (updateError) {
      await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการอัปเดตสถานะ PR');
    } else {
      await sendLineReply(replyToken, `🎉 บันทึกสำเร็จแล้ว!\nอัปเดตรายการ PR "${item.title}" เป็น "เสร็จสมบูรณ์" เรียบร้อยแล้วครับ`);
    }
  } else if (action === 'pr_delete') {
    if (!itemId) return;
    const item = await PrService.getPrById(supabaseAdmin, itemId);
    if (!item) {
      await sendLineReply(replyToken, '❌ ไม่พบรายการ PR นี้ หรืออาจถูกลบไปแล้ว');
      return;
    }

    const success = await PrService.deletePr(supabaseAdmin, itemId);
    if (!success) {
      await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการลบรายการ PR');
    } else {
      await sendLineReply(replyToken, `🗑️ ลบรายการ PR "${item.title}" เรียบร้อยแล้วครับ!`);
    }
  } else if (action === 'request_pr_edit') {
    if (!itemId) return;
    const item = await PrService.getPrById(supabaseAdmin, itemId);
    if (!item) {
      await sendLineReply(replyToken, '❌ ไม่พบรายการ PR นี้ หรืออาจถูกลบไปแล้ว');
      return;
    }

    await sendLineReply(replyToken, {
      type: 'flex',
      altText: `✏️ แก้ไขรายการ PR "${item.title}"`,
      contents: createPrEditMenuFlex(item)
    });
  } else if (action === 'request_pr_field') {
    if (!itemId) return;
    const field = params.get('field');
    if (!field) return;
    const item = await PrService.getPrById(supabaseAdmin, itemId);
    if (!item) {
      await sendLineReply(replyToken, '❌ ไม่พบรายการ PR นี้ หรืออาจถูกลบไปแล้ว');
      return;
    }

    const fieldNames: Record<string, string> = {
      pr_no: 'เลข PR (เช่น PR-69001)',
      po_no: 'เลข PO (เช่น PO-2026-042)',
      qt_no: 'เลข QT (เช่น QT-8891)',
      title: 'ชื่อหัวข้อ PR ใหม่',
      notes: 'หมายเหตุ/บันทึกเพิ่มเติม'
    };

    const label = fieldNames[field] || field;

    await setConversationState(lineUserId, {
      action: 'editing_pr_field',
      itemId: item.id,
      field: field,
      itemTitle: item.title,
      fieldName: label
    }, supabaseAdmin, profile?.id);

    await sendLineReply(replyToken, {
      type: 'text',
      text: `✍️ **กำลังแก้ไข ${label}**\nสำหรับรายการ PR: "${item.title}"\n\nกรุณาพิมพ์ค่าใหม่ที่คุณต้องการตั้งเข้ามาในแชตนี้ได้เลยครับ`,
      quickReply: {
        items: [
          {
            type: 'action',
            action: {
              type: 'postback',
              label: '❌ ยกเลิกการแก้ไข',
              data: 'action=cancel_edit'
            }
          }
        ]
      }
    });
  } else if (action === 'request_pr_status_menu') {
    if (!itemId) return;
    const item = await PrService.getPrById(supabaseAdmin, itemId);
    if (!item) {
      await sendLineReply(replyToken, '❌ ไม่พบรายการ PR นี้ หรืออาจถูกลบไปแล้ว');
      return;
    }

    await sendLineReply(replyToken, {
      type: 'flex',
      altText: `🔄 เลือกสถานะสำหรับ PR "${item.title}"`,
      contents: createPrStatusMenuFlex(item)
    });
  } else if (action === 'set_pr_status') {
    if (!itemId) return;
    const newStatus = params.get('status');
    if (!newStatus) return;

    const item = await PrService.getPrById(supabaseAdmin, itemId);
    if (!item) {
      await sendLineReply(replyToken, '❌ ไม่พบรายการ PR นี้ หรืออาจถูกลบไปแล้ว');
      return;
    }

    const updated = await PrService.updatePr(supabaseAdmin, itemId, { status: newStatus as any });
    if (!updated) {
      await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการอัปเดตสถานะ PR');
    } else {
      const bubble = createPrFlexBubble(updated, requestUrlOrigin);
      await sendLineReply(replyToken, [
        `🔄 อัปเดตสถานะ PR "${updated.title}" เป็น "${newStatus}" เรียบร้อยแล้วครับ!`,
        {
          type: 'flex',
          altText: `📑 อัปเดตสถานะ PR "${updated.title}"`,
          contents: bubble
        }
      ]);
    }
  } else if (action === 'cal_complete') {
    if (!itemId) return;
    const item = await CalibrationService.getCalById(supabaseAdmin, itemId);
    if (!item) {
      await sendLineReply(replyToken, '❌ ไม่พบรายการ Calibration นี้ หรืออาจถูกลบไปแล้ว');
      return;
    }

    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    const nextYear = new Date();
    nextYear.setFullYear(today.getFullYear() + 1);
    const nextYearStr = `${nextYear.getFullYear()}-${pad(nextYear.getMonth() + 1)}-${pad(nextYear.getDate())}`;

    const { error: updateError } = await supabaseAdmin
      .from('lab_calibrations')
      .update({
        last_cal_date: todayStr,
        next_cal_date: nextYearStr,
        updated_at: new Date().toISOString()
      })
      .eq('id', itemId);

    if (updateError) {
      await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการบันทึกการ Calibrate');
    } else {
      const formattedNext = nextYear.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric' });
      await sendLineReply(replyToken, `🎉 บันทึกการ Calibrate เรียบร้อย!\nเครื่องมือ: "${item.name}"\nวัน Cal ล่าสุด: วันนี้ (${todayStr})\nรอบถัดไปส่ง Calibrate: ${formattedNext}`);
    }
  } else if (action === 'cal_delete') {
    if (!itemId) return;
    const item = await CalibrationService.getCalById(supabaseAdmin, itemId);
    if (!item) {
      await sendLineReply(replyToken, '❌ ไม่พบรายการ Calibration นี้ หรืออาจถูกลบไปแล้ว');
      return;
    }

    const success = await CalibrationService.deleteCal(supabaseAdmin, itemId);
    if (!success) {
      await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการลบรายการ Calibration');
    } else {
      await sendLineReply(replyToken, `🗑️ ลบรายการเครื่องมือ "${item.name}" เรียบร้อยแล้วครับ!`);
    }
  } else if (action === 'request_cal_edit') {
    if (!itemId) return;
    const item = await CalibrationService.getCalById(supabaseAdmin, itemId);
    if (!item) {
      await sendLineReply(replyToken, '❌ ไม่พบรายการ Calibration นี้ หรืออาจถูกลบไปแล้ว');
      return;
    }

    await setConversationState(lineUserId, {
      action: 'editing_cal_field',
      itemId: item.id,
      itemName: item.name
    }, supabaseAdmin, profile?.id);

    await sendLineReply(replyToken, {
      type: 'text',
      text: `✍️ **กำลังแก้ไขชื่อเครื่องมือวัด**\nสำหรับรายการ: "${item.name}"\n\nกรุณาพิมพ์ชื่อเครื่องมือใหม่เข้ามาในแชตนี้ได้เลยครับ`,
      quickReply: {
        items: [
          {
            type: 'action',
            action: {
              type: 'postback',
              label: '❌ ยกเลิกการแก้ไข',
              data: 'action=cancel_edit'
            }
          }
        ]
      }
    });
  } else {
    console.warn(`[LINE Postback] Unhandled action received: "${action}" with data:`, event.postback?.data);
    await sendLineReply(replyToken, '⚠️ ขออภัยครับ ระบบไม่พบการดำเนินการนี้ กรุณาลองใหม่อีกครั้งหรือพิมพ์ "โหมด" เพื่อเลือกเมนูใหม่ครับ');
  }
}
