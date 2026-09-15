import { SupabaseClient } from '@supabase/supabase-js';
import { sendLineReply } from '@/lib/line/client';
import { BoardService, ItemService, StockService, PrService, CalibrationService } from '@/services';
import { processMessageWithCentralAI, getGeminiApiKey } from '@/lib/ai';

export async function handleCentralRouting(
  messageText: string,
  replyToken: string,
  lineUserId: string,
  profile: any,
  supabaseAdmin: SupabaseClient
): Promise<boolean> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    await sendLineReply(replyToken, '❌ ระบบ AI ยังไม่พร้อมใช้งาน (Missing API Key)');
    return true;
  }

  try {
    const boardService = new BoardService(supabaseAdmin);
    const boards = await boardService.getUserBoards(profile.id);

    // Fetch categories for each board to give AI more context
    for (const b of boards) {
      (b as any).categories = await boardService.getBoardCategories(b.id);
    }

    const aiResult = await processMessageWithCentralAI(messageText, boards, apiKey);

    // If AI decided it's just a conversation — reply with plain text only
    if (aiResult.is_conversation) {
      const reply = aiResult.reply_message || 'สวัสดีครับ มีอะไรให้ผมช่วยจำหรือจัดการไหมครับ?';
      const { createModeSelectionFlex } = await import('@/lib/line/flex-templates');
      await sendLineReply(replyToken, [
        reply,
        {
          type: 'flex',
          altText: '🤖 กรุณาเลือกโหมดการทำงาน',
          contents: createModeSelectionFlex()
        }
      ]);
      return true;
    }

    // If it's a database command
    const cmd = aiResult.command;
    if (!cmd || !cmd.board_id) {
      const { createModeSelectionFlex } = await import('@/lib/line/flex-templates');
      await sendLineReply(replyToken, [
        '🤔 ขอโทษครับ ผมไม่แน่ใจว่าคุณต้องการจัดการข้อมูลในบอร์ดไหน ลองระบุชื่อบอร์ดหรือรายการให้ชัดเจนขึ้นอีกนิดนะครับ',
        {
          type: 'flex',
          altText: '🤖 กรุณาเลือกโหมดการทำงาน',
          contents: createModeSelectionFlex()
        }
      ]);
      return true;
    }

    const targetBoard = boards.find((b: any) => b.id === cmd.board_id);
    if (!targetBoard) {
      await sendLineReply(replyToken, '❌ ไม่พบบอร์ดที่คุณต้องการ กรุณาลองใหม่อีกครั้ง');
      return true;
    }

    // Handle INVENTORY
    if (targetBoard.type === 'INVENTORY') {
      if (cmd.action === 'LIST_ALL') {
        const { data: allStocks } = await supabaseAdmin.from('stocks').select('*').eq('board_id', targetBoard.id).order('name');
        if (!allStocks || allStocks.length === 0) {
             await sendLineReply(replyToken, '📦 บอร์ด ' + targetBoard.name + ' ยังไม่มีรายการสินค้าครับ');
          } else {
             const { createStockFlexBubble, createNextPageBubble } = await import('@/lib/line/flex-templates');
             const bubbles: any[] = allStocks.slice(0, 10).map(item => createStockFlexBubble(item, 'view', null));
             if (allStocks.length > 10) {
                 bubbles.push(createNextPageBubble(`action=view_board_page&boardId=${targetBoard.id}&page=2`));
             }
             await sendLineReply(replyToken, [{
               type: 'flex',
               altText: '📦 รายการสต็อกทั้งหมด',
               contents: { type: 'carousel', contents: bubbles }
             }]);
          }
          return true;
        }
      if (['ADD', 'UPDATE', 'ADD_STOCK', 'SUBTRACT_STOCK', 'CHECK_STOCK', 'DELETE'].includes(cmd.action)) {
        const title = cmd.target_item_name || cmd.fields.title;
        if (!title) {
           await sendLineReply(replyToken, 'ระบุชื่อรายการวัสดุให้หน่อยครับ');
           return true;
        }

        const { data: existingStocks } = await supabaseAdmin.from('stocks').select('*').eq('board_id', targetBoard.id).ilike('name', `%${title}%`);
        const stock = existingStocks && existingStocks.length > 0 ? existingStocks[0] : null;

        if (cmd.action === 'CHECK_STOCK') {
          if (stock) {
            await sendLineReply(replyToken, `📦 **${stock.name}**\nคงเหลือ: ${stock.quantity} ${stock.unit || 'ชิ้น'}`);
          } else {
            await sendLineReply(replyToken, `❌ ไม่พบรายการ '${title}' ในบอร์ด ${targetBoard.name}`);
          }
          return true;
        }

        let qtyChange = cmd.fields.quantity || 0;
        
        if (stock) {
          let newQty = stock.quantity;
          if (cmd.action === 'SUBTRACT_STOCK') newQty -= qtyChange;
          else if (cmd.action === 'ADD_STOCK') newQty += qtyChange;
          else if (cmd.action === 'UPDATE') newQty = qtyChange;
          
          if (cmd.action === 'DELETE') {
             await supabaseAdmin.from('stocks').delete().eq('id', stock.id);
             await sendLineReply(replyToken, `🗑️ ลบรายการ '${stock.name}' ออกจากบอร์ดสต็อกเรียบร้อยแล้วครับ`);
             return true;
          }
          await supabaseAdmin.from('stocks').update({ quantity: newQty }).eq('id', stock.id);
          await supabaseAdmin.from('stock_transactions').insert([{ 
            stock_id: stock.id, 
            user_id: profile.id, 
            type: cmd.action === 'SUBTRACT_STOCK' ? 'OUT' : 'IN', 
            quantity: qtyChange,
            note: 'ทำรายการผ่าน AI'
          }]);
          await sendLineReply(replyToken, `✅ อัปเดต ${stock.name} เรียบร้อยแล้ว!\nยอดปัจจุบัน: ${newQty} ${stock.unit || 'ชิ้น'}`);
        } else {
           if (cmd.action === 'SUBTRACT_STOCK') {
              await sendLineReply(replyToken, `❌ ไม่พบรายการ '${title}' ในบอร์ดสต็อก ไม่สามารถเบิกได้ครับ`);
              return true;
           }
           await supabaseAdmin.from('stocks').insert([{
             board_id: targetBoard.id,
             user_id: profile.id,
             name: title,
             quantity: qtyChange,
             unit: 'ชิ้น',
             min_threshold: 0
           }]);
           await sendLineReply(replyToken, `✅ สร้างรายการสต็อกใหม่: ${title}\nจำนวนเริ่มต้น: ${qtyChange}`);
        }
      }
      return true;
    }

    // Handle KANBAN
    if (targetBoard.type === 'KANBAN') {
      if (cmd.action === 'LIST_ALL') {
         const { data: allPrs } = await supabaseAdmin.from('pr_requests').select('*').eq('board_id', targetBoard.id).order('created_at', { ascending: false });
         if (!allPrs || allPrs.length === 0) {
              await sendLineReply(replyToken, `📋 บอร์ด ${targetBoard.name} ยังไม่มีรายการครับ`);
           } else {
              const { createPrFlexBubble, createNextPageBubble } = await import('@/lib/line/flex-templates');
              const bubbles: any[] = allPrs.slice(0, 10).map(item => createPrFlexBubble(item, ''));
              if (allPrs.length > 10) {
                 bubbles.push(createNextPageBubble(`action=view_board_page&boardId=${targetBoard.id}&page=2`));
              }
              await sendLineReply(replyToken, [{
                type: 'flex',
                altText: '📋 รายการ PR ทั้งหมด',
                contents: { type: 'carousel', contents: bubbles }
              }]);
           }
           return true;
        }
      const title = cmd.fields.title || cmd.target_item_name;
      if (cmd.action === 'ADD') {
        await supabaseAdmin.from('pr_requests').insert([{
          board_id: targetBoard.id,
          user_id: profile.id,
          title: title || 'รายการใหม่',
          status: 'Pending'
        }]);
        await sendLineReply(replyToken, `✅ เพิ่มรายการ '${title}' ลงในบอร์ด ${targetBoard.name} เรียบร้อยครับ`);
      } else if (cmd.action === 'UPDATE' || cmd.action === 'COMPLETE') {
         const { data: prs } = await supabaseAdmin.from('pr_requests').select('*').eq('board_id', targetBoard.id).ilike('title', `%${title}%`).limit(1);
         if (prs && prs.length > 0) {
            await supabaseAdmin.from('pr_requests').update({ status: cmd.action === 'COMPLETE' ? 'Completed' : 'Processing' }).eq('id', prs[0].id);
            await sendLineReply(replyToken, `✅ อัปเดตสถานะ '${prs[0].title}' เป็น ${cmd.action === 'COMPLETE' ? 'สำเร็จ' : 'กำลังดำเนินการ'} แล้วครับ`);
         }
      }
      return true;
    }

    // Handle DATE_TRACKER
    if (targetBoard.type === 'DATE_TRACKER') {
      if (cmd.action === 'LIST_ALL') {
         const { data: allDates } = await supabaseAdmin.from('lab_calibrations').select('*').eq('board_id', targetBoard.id).order('next_due_date', { ascending: true });
         if (!allDates || allDates.length === 0) {
              await sendLineReply(replyToken, `📅 บอร์ด ${targetBoard.name} ยังไม่มีรายการครับ`);
           } else {
              const { createCalibrationFlexBubble, createNextPageBubble } = await import('@/lib/line/flex-templates');
              const bubbles: any[] = allDates.slice(0, 10).map(item => createCalibrationFlexBubble(item, ''));
              if (allDates.length > 10) {
                 bubbles.push(createNextPageBubble(`action=view_board_page&boardId=${targetBoard.id}&page=2`));
              }
              await sendLineReply(replyToken, [{
                type: 'flex',
                altText: '📅 รายการแจ้งเตือนทั้งหมด',
                contents: { type: 'carousel', contents: bubbles }
              }]);
           }
           return true;
        }
      const title = cmd.fields.title || cmd.target_item_name;
      if (cmd.action === 'ADD') {
        await supabaseAdmin.from('lab_calibrations').insert([{
          board_id: targetBoard.id,
          user_id: profile.id,
          equipment_name: title || 'รายการใหม่',
          next_due_date: cmd.fields.date || null,
          status: 'Active'
        }]);
        await sendLineReply(replyToken, `✅ ตั้งเตือน '${title}' ในบอร์ด ${targetBoard.name} เรียบร้อยครับ ${cmd.fields.date ? '(วันที่ '+cmd.fields.date+')' : ''}`);
      }
      return true;
    }

    // Handle GENERAL_LIST
    if (targetBoard.type === 'GENERAL_LIST') {
      if (cmd.action === 'LIST_ALL') {
         const { data: allItems } = await supabaseAdmin.from('items').select('*').eq('board_id', targetBoard.id).order('created_at', { ascending: false });
         if (!allItems || allItems.length === 0) {
              await sendLineReply(replyToken, `📝 บอร์ด ${targetBoard.name} ยังไม่มีรายการครับ`);
           } else {
              const { createItemFlexBubble, createNextPageBubble } = await import('@/lib/line/flex-templates');
              const bubbles: any[] = allItems.slice(0, 10).map(item => createItemFlexBubble(item, ''));
              if (allItems.length > 10) {
                 bubbles.push(createNextPageBubble(`action=view_board_page&boardId=${targetBoard.id}&page=2`));
              }
              await sendLineReply(replyToken, [{
                type: 'flex',
                altText: '📝 รายการบันทึกทั้งหมด',
                contents: { type: 'carousel', contents: bubbles }
              }]);
           }
           return true;
        }
      const title = cmd.fields.title || cmd.target_item_name;
      if (cmd.action === 'DELETE') {
         const { data: items } = await supabaseAdmin.from('items').select('*').eq('board_id', targetBoard.id).ilike('title', `%${title}%`).limit(1);
         if (items && items.length > 0) {
            await supabaseAdmin.from('items').delete().eq('id', items[0].id);
            await sendLineReply(replyToken, `🗑️ ลบรายการ '${items[0].title}' เรียบร้อยแล้วครับ`);
         } else {
            await sendLineReply(replyToken, `❌ ไม่พบรายการ '${title}' ครับ`);
         }
      } else if (cmd.action === 'ADD') {
        const firstDayOfMonth = new Date();
        firstDayOfMonth.setDate(1);
        firstDayOfMonth.setHours(0,0,0,0);
        
        const { count } = await supabaseAdmin
          .from('items')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .gte('created_at', firstDayOfMonth.toISOString());
          
        if (count !== null && count >= 10) {
          await sendLineReply(replyToken, `❌ คุณใช้งานถึงขีดจำกัดการตั้งแจ้งเตือน 10 ครั้งต่อเดือนแล้ว สำหรับบัญชีผู้ใช้ทั่วไปครับ (ระบบสมัครสมาชิกกำลังจะมาเร็วๆ นี้)`);
          return true;
        }

        await supabaseAdmin.from('items').insert([{
          board_id: targetBoard.id,
          user_id: profile.id,
          title: title || 'บันทึกใหม่',
          description: cmd.fields.description || null,
          status: 'Pending',
          reminder_date: cmd.fields.reminder_date || null
        }]);

        if (cmd.fields.reminder_date) {
          const d = new Date(cmd.fields.reminder_date);
          const formattedDate = d.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
          await sendLineReply(replyToken, `✅ บันทึก '${title}' ลงบอร์ด ${targetBoard.name} สำเร็จ!\n(ตั้งแจ้งเตือนเวลา: ${formattedDate})`);
        } else {
          await sendLineReply(replyToken, `✅ บันทึก '${title}' ลงบอร์ด ${targetBoard.name} สำเร็จ!`);
        }
      }
      return true;
    }

    await sendLineReply(replyToken, `✅ รับทราบคำสั่งในบอร์ด ${targetBoard.name} แล้วครับ (ระบบกำลังพัฒนาส่วนนี้เพิ่มเติม)`);
    return true;

  } catch (error: any) {
    console.error('Central AI Error:', error);
    await sendLineReply(replyToken, '❌ ขออภัยครับ AI ไม่สามารถประมวลผลคำสั่งนี้ได้ ลองพิมพ์ใหม่อีกครั้งนะครับ');
    return true;
  }
}
