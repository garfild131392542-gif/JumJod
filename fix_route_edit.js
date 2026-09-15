const fs = require('fs');

let code = fs.readFileSync('src/app/api/line-webhook/route.ts', 'utf8');

const injectCode = `
      // Handle generic list edits
      if (userState && userState.action === 'editing_generic_item') {
        const val = messageText.trim();
        const tableName = userState.tableName;
        const itemId = userState.itemId;
        
        let updateField = 'title';
        if (tableName === 'stocks') updateField = 'name';
        if (tableName === 'lab_calibrations') updateField = 'equipment_name';
        
        const { error } = await supabaseAdmin.from(tableName).update({ [updateField]: val }).eq('id', itemId);
        
        await clearConversationState(lineUserId);
        
        if (error) {
          await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        } else {
          await sendLineReply(replyToken, \`✅ แก้ไขเป็น "\${val}" สำเร็จแล้วครับ\`);
        }
        return NextResponse.json({ success: true });
      }
`;

// Insert it right before "// Handle PR field edit"
code = code.replace(/\/\/ Handle PR field edit/, injectCode + '\n      // Handle PR field edit');

fs.writeFileSync('src/app/api/line-webhook/route.ts', code);
console.log('Added editing_generic_item to route.ts');
