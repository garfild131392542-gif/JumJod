const fs = require('fs');

// 1. Fix central-router.ts to talk back to user again
let routerCode = fs.readFileSync('src/lib/line/handlers/central-router.ts', 'utf8');
routerCode = routerCode.replace(
  /if \(aiResult\.is_conversation\) \{\s*return false;\s*\}/m,
  `if (aiResult.is_conversation) {
      if (aiResult.reply_message) {
        await sendLineReply(replyToken, aiResult.reply_message);
      } else {
        await sendLineReply(replyToken, 'สวัสดีครับ มีอะไรให้ผมช่วยจำหรือจัดการไหมครับ?');
      }
      return true;
    }`
);
fs.writeFileSync('src/lib/line/handlers/central-router.ts', routerCode);

// 2. Fix ai.ts prompt
let aiCode = fs.readFileSync('src/lib/ai.ts', 'utf8');
const oldRule2 = `2. If it is a conversation or unclear, set "is_conversation" to true, and provide a helpful, friendly, natural Thai response in "reply_message". (e.g., "รับทราบครับ มีอะไรให้ผมช่วยบันทึกหรือเช็คสต็อกบอกได้เลยนะครับ"). Do not ask them to select a mode, just ask what they want to record.`;
const newRule2 = `2. STRICT INTENT FILTER: If the user is just greeting, OR saying they WANT to do something (e.g., "อยากบันทึก PR", "บันทึก PR หน่อย", "เพิ่มข้อมูลให้หน่อย") but has NOT provided the actual item name or details yet, you MUST set "is_conversation" to true. Do NOT guess the title. Reply naturally asking for the item name or details (e.g. "ยินดีครับ คุณต้องการบันทึก PR ชื่อว่าอะไรครับ?").`;
const oldRule3 = `3. If it is a database command, set "is_conversation" to false.`;
const newRule3 = `3. Only set "is_conversation" to false if the user explicitly provided enough data (like a clear item name) to perform an action.`;

aiCode = aiCode.replace(oldRule2, newRule2).replace(oldRule3, newRule3);
fs.writeFileSync('src/lib/ai.ts', aiCode);

console.log('Fixed conversational AI');
