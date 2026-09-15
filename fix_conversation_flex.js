const fs = require('fs');

let routerCode = fs.readFileSync('src/lib/line/handlers/central-router.ts', 'utf8');
const searchBlock = `    if (aiResult.is_conversation) {
      if (aiResult.reply_message) {
        await sendLineReply(replyToken, aiResult.reply_message);
      } else {
        await sendLineReply(replyToken, 'สวัสดีครับ มีอะไรให้ผมช่วยจำหรือจัดการไหมครับ?');
      }
      return true;
    }`;

const replaceBlock = `    if (aiResult.is_conversation) {
      const { createModeSelectionFlex } = await import('@/lib/line/flex-templates');
      const messages = [];
      if (aiResult.reply_message) {
        messages.push(aiResult.reply_message);
      } else {
        messages.push('สวัสดีครับ มีอะไรให้ผมช่วยจำหรือจัดการไหมครับ?');
      }
      
      messages.push({
        type: 'flex',
        altText: 'กรุณาเลือกโหมดการทำงาน',
        contents: createModeSelectionFlex()
      });
      
      await sendLineReply(replyToken, messages);
      return true;
    }`;

routerCode = routerCode.replace(searchBlock, replaceBlock);
fs.writeFileSync('src/lib/line/handlers/central-router.ts', routerCode);
console.log('Fixed central-router.ts to send flex menu along with conversation');
