const fs = require('fs');

let code = fs.readFileSync('src/lib/line/handlers/central-router.ts', 'utf8');

// For INVENTORY
code = code.replace(
  /else if \(cmd\.action === 'UPDATE'\) newQty = qtyChange;\s*await supabaseAdmin\.from\('stocks'\)/,
  `else if (cmd.action === 'UPDATE') newQty = qtyChange;
          
          if (cmd.action === 'DELETE') {
             await supabaseAdmin.from('stocks').delete().eq('id', stock.id);
             await sendLineReply(replyToken, \`🗑️ ลบรายการ '\${stock.name}' ออกจากบอร์ดสต็อกเรียบร้อยแล้วครับ\`);
             return true;
          }
          await supabaseAdmin.from('stocks')`
);

// For KANBAN
code = code.replace(
  /else if \(cmd\.action === 'UPDATE' \|\| cmd\.action === 'COMPLETE'\) \{/,
  `else if (cmd.action === 'DELETE') {
         const { data: prs } = await supabaseAdmin.from('pr_requests').select('*').eq('board_id', targetBoard.id).ilike('title', \`%\${title}%\`).limit(1);
         if (prs && prs.length > 0) {
            await supabaseAdmin.from('pr_requests').delete().eq('id', prs[0].id);
            await sendLineReply(replyToken, \`🗑️ ลบรายการ '\${prs[0].title}' เรียบร้อยแล้วครับ\`);
         } else {
            await sendLineReply(replyToken, \`❌ ไม่พบรายการ '\${title}' ครับ\`);
         }
      } else if (cmd.action === 'UPDATE' || cmd.action === 'COMPLETE') {`
);

// For DATE_TRACKER
code = code.replace(
  /if \(cmd\.action === 'ADD'\) \{/,
  `if (cmd.action === 'DELETE') {
         const { data: items } = await supabaseAdmin.from('lab_calibrations').select('*').eq('board_id', targetBoard.id).ilike('equipment_name', \`%\${title}%\`).limit(1);
         if (items && items.length > 0) {
            await supabaseAdmin.from('lab_calibrations').delete().eq('id', items[0].id);
            await sendLineReply(replyToken, \`🗑️ ลบรายการ '\${items[0].equipment_name}' เรียบร้อยแล้วครับ\`);
         } else {
            await sendLineReply(replyToken, \`❌ ไม่พบรายการ '\${title}' ครับ\`);
         }
      } else if (cmd.action === 'ADD') {`
);

// For GENERAL_LIST
code = code.replace(
  /if \(cmd\.action === 'ADD'\) \{\s*const firstDayOfMonth = new Date\(\);/,
  `if (cmd.action === 'DELETE') {
         const { data: items } = await supabaseAdmin.from('items').select('*').eq('board_id', targetBoard.id).ilike('title', \`%\${title}%\`).limit(1);
         if (items && items.length > 0) {
            await supabaseAdmin.from('items').delete().eq('id', items[0].id);
            await sendLineReply(replyToken, \`🗑️ ลบรายการ '\${items[0].title}' เรียบร้อยแล้วครับ\`);
         } else {
            await sendLineReply(replyToken, \`❌ ไม่พบรายการ '\${title}' ครับ\`);
         }
      } else if (cmd.action === 'ADD') {
        const firstDayOfMonth = new Date();`
);

fs.writeFileSync('src/lib/line/handlers/central-router.ts', code);
console.log('Added DELETE support to central-router.ts');
