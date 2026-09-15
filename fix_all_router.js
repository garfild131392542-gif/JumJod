const fs = require('fs');
let code = fs.readFileSync('src/lib/line/handlers/central-router.ts', 'utf8');

// Replace KANBAN entirely to fix it
const kanbanStr = `    // Handle KANBAN
    if (targetBoard.type === 'KANBAN') {
      if (cmd.action === 'LIST_ALL') {
         const { data: allPrs } = await supabaseAdmin.from('pr_requests').select('*').eq('board_id', targetBoard.id).order('created_at', { ascending: false });
         if (!allPrs || allPrs.length === 0) {
              await sendLineReply(replyToken, \`📋 บอร์ด \$\{targetBoard.name\} ยังไม่มีรายการครับ\`);
           } else {
              const { createCarouselFlex } = await import('@/lib/line/flex-templates');
              await sendLineReply(replyToken, [{
                type: 'flex',
                altText: '📋 รายการ PR ทั้งหมด',
                contents: createCarouselFlex(allPrs, targetBoard.type, targetBoard.name)
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
        await sendLineReply(replyToken, \`✅ เพิ่มรายการ '\$\{title\}' ลงในบอร์ด \$\{targetBoard.name\} เรียบร้อยครับ\`);
      } else if (cmd.action === 'UPDATE' || cmd.action === 'COMPLETE') {
         const { data: prs } = await supabaseAdmin.from('pr_requests').select('*').eq('board_id', targetBoard.id).ilike('title', \`%\$\{title\}%\`).limit(1);
         if (prs && prs.length > 0) {
            await supabaseAdmin.from('pr_requests').update({ status: cmd.action === 'COMPLETE' ? 'Completed' : 'Processing' }).eq('id', prs[0].id);
            await sendLineReply(replyToken, \`✅ อัปเดตสถานะ '\$\{prs[0].title\}' เป็น \$\{cmd.action === 'COMPLETE' ? 'สำเร็จ' : 'กำลังดำเนินการ'\} แล้วครับ\`);
         }
      }
      return true;
    }`;
code = code.replace(/    \/\/ Handle KANBAN[\s\S]*?return true;\n    \}/, kanbanStr);

// Replace DATE_TRACKER entirely
const dateTrackerStr = `    // Handle DATE_TRACKER
    if (targetBoard.type === 'DATE_TRACKER') {
      if (cmd.action === 'LIST_ALL') {
         const { data: allDates } = await supabaseAdmin.from('lab_calibrations').select('*').eq('board_id', targetBoard.id).order('next_due_date', { ascending: true });
         if (!allDates || allDates.length === 0) {
              await sendLineReply(replyToken, \`📅 บอร์ด \$\{targetBoard.name\} ยังไม่มีรายการครับ\`);
           } else {
              const { createCarouselFlex } = await import('@/lib/line/flex-templates');
              await sendLineReply(replyToken, [{
                type: 'flex',
                altText: '📅 รายการแจ้งเตือนทั้งหมด',
                contents: createCarouselFlex(allDates, targetBoard.type, targetBoard.name)
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
        await sendLineReply(replyToken, \`✅ ตั้งเตือน '\$\{title\}' ในบอร์ด \$\{targetBoard.name\} เรียบร้อยครับ \$\{cmd.fields.date ? '(วันที่ '+cmd.fields.date+')' : ''\}\`);
      }
      return true;
    }`;
code = code.replace(/    \/\/ Handle DATE_TRACKER[\s\S]*?return true;\n    \}/, dateTrackerStr);

// Replace GENERAL_LIST entirely
const generalListStr = `    // Handle GENERAL_LIST
    if (targetBoard.type === 'GENERAL_LIST') {
      if (cmd.action === 'LIST_ALL') {
         const { data: allItems } = await supabaseAdmin.from('items').select('*').eq('board_id', targetBoard.id).order('created_at', { ascending: false });
         if (!allItems || allItems.length === 0) {
              await sendLineReply(replyToken, \`📝 บอร์ด \$\{targetBoard.name\} ยังไม่มีรายการครับ\`);
           } else {
              const { createCarouselFlex } = await import('@/lib/line/flex-templates');
              await sendLineReply(replyToken, [{
                type: 'flex',
                altText: '📝 รายการบันทึกทั้งหมด',
                contents: createCarouselFlex(allItems, targetBoard.type, targetBoard.name)
              }]);
           }
           return true;
        }
      const title = cmd.fields.title || cmd.target_item_name;
      if (cmd.action === 'ADD') {
        const firstDayOfMonth = new Date();
        firstDayOfMonth.setDate(1);
        firstDayOfMonth.setHours(0,0,0,0);
        
        const { count } = await supabaseAdmin
          .from('items')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .gte('created_at', firstDayOfMonth.toISOString());
          
        if (count !== null && count >= 10) {
          await sendLineReply(replyToken, \`❌ คุณใช้งานถึงขีดจำกัดการตั้งแจ้งเตือน 10 ครั้งต่อเดือนแล้ว สำหรับบัญชีผู้ใช้ทั่วไปครับ (ระบบสมัครสมาชิกกำลังจะมาเร็วๆ นี้)\`);
          return true;
        }

        await supabaseAdmin.from('items').insert([{
          board_id: targetBoard.id,
          user_id: profile.id,
          title: title || 'บันทึกใหม่',
          description: cmd.fields.description || null,
          status: 'Pending'
        }]);
        await sendLineReply(replyToken, \`✅ บันทึก '\$\{title\}' ลงบอร์ด \$\{targetBoard.name\} สำเร็จ!\`);
      }
      return true;
    }`;
code = code.replace(/    \/\/ Handle GENERAL_LIST[\s\S]*?return true;\n    \}/, generalListStr);

fs.writeFileSync('src/lib/line/handlers/central-router.ts', code);
console.log('Fixed everything');
