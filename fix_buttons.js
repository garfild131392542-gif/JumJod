const fs = require('fs');

function fixFlexAndPostback() {
  // 1. Fix flex-templates.ts
  let flexCode = fs.readFileSync('src/lib/line/flex-templates.ts', 'utf8');
  flexCode = flexCode.replace(
    /action: \{ type: 'message', label: 'แก้ไข', text: `แก้ไข \$\{title\}` \}/g,
    "action: { type: 'postback', label: 'แก้ไข', data: `action=edit_item&boardType=${boardType}&itemId=${item.id}&title=${title}` }"
  );
  flexCode = flexCode.replace(
    /action: \{ type: 'message', label: 'ลบ', text: `ลบ \$\{title\}` \}/g,
    "action: { type: 'postback', label: 'ลบ', data: `action=delete_item&boardType=${boardType}&itemId=${item.id}&title=${title}` }"
  );
  fs.writeFileSync('src/lib/line/flex-templates.ts', flexCode);

  // 2. Fix postback.handler.ts
  let pbCode = fs.readFileSync('src/lib/line/handlers/postback.handler.ts', 'utf8');
  
  const injectCode = `
  } else if (action === 'delete_item') {
    const boardType = params.get('boardType');
    const title = params.get('title') || 'รายการ';
    if (!itemId || !boardType) return;
    
    let tableName = 'items';
    if (boardType === 'INVENTORY') tableName = 'stocks';
    if (boardType === 'KANBAN') tableName = 'pr_requests';
    if (boardType === 'DATE_TRACKER') tableName = 'lab_calibrations';
    
    const { error } = await supabaseAdmin.from(tableName).delete().eq('id', itemId);
    if (error) {
      await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการลบรายการ');
    } else {
      await sendLineReply(replyToken, \`🗑️ ลบ '\${title}' สำเร็จแล้วครับ\`);
    }
  } else if (action === 'edit_item') {
    const boardType = params.get('boardType');
    const title = params.get('title') || 'รายการ';
    if (!itemId || !boardType) return;
    
    let tableName = 'items';
    if (boardType === 'INVENTORY') tableName = 'stocks';
    if (boardType === 'KANBAN') tableName = 'pr_requests';
    if (boardType === 'DATE_TRACKER') tableName = 'lab_calibrations';

    await setConversationState(lineUserId, {
      action: 'editing_generic_item',
      itemId: itemId,
      tableName: tableName,
      itemTitle: title
    }, supabaseAdmin, profile?.id);

    await sendLineReply(replyToken, {
      type: 'text',
      text: \`✍️ **กำลังแก้ไข**\\n"\${title}"\\n\\nพิมพ์ชื่อ/ข้อมูลใหม่ส่งมาได้เลยครับ (พิมพ์ "ยกเลิก" เพื่อกลับ)\`,
      quickReply: {
        items: [
          { type: 'action', action: { type: 'postback', label: '❌ ยกเลิก', data: 'action=cancel_edit' } }
        ]
      }
    });
  `;

  // Inject before the final `else {` block
  pbCode = pbCode.replace(/\} else \{\s*console\.warn\(\`\[LINE Postback\] Unhandled action/, injectCode + '} else {\n    console.warn(`[LINE Postback] Unhandled action');
  
  fs.writeFileSync('src/lib/line/handlers/postback.handler.ts', pbCode);
}

fixFlexAndPostback();
console.log('Flex templates and postbacks updated!');
