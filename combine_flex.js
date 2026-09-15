const fs = require('fs');

// 1. Update flex-templates.ts
let flexCode = fs.readFileSync('src/lib/line/flex-templates.ts', 'utf8');

const oldFlexSig = `export function createModeSelectionFlex() {`;
const newFlexSig = `export function createModeSelectionFlex(titleText?: string, subtitleText?: string) {`;
flexCode = flexCode.replace(oldFlexSig, newFlexSig);

const oldFlexTitle = `text: '🤖 ยินดีต้อนรับสู่ระบบ จำจด (JodJum)',
            weight: 'bold',
            size: 'md',
            color: '#0f172a'`;
const newFlexTitle = `text: titleText || '🤖 ยินดีต้อนรับสู่ระบบ จำจด (JodJum)',
            weight: 'bold',
            size: 'md',
            color: '#0f172a',
            wrap: true`;
flexCode = flexCode.replace(oldFlexTitle, newFlexTitle);

const oldFlexSub = `text: 'กรุณาเลือกโหมดการทำงานเพื่อเริ่มป้อนข้อมูล:',
            size: 'xs',
            color: '#64748b',
            margin: 'xs'`;
const newFlexSub = `text: subtitleText || 'กรุณาเลือกโหมดการทำงานเพื่อเริ่มป้อนข้อมูล:',
            size: 'xs',
            color: '#64748b',
            margin: 'xs',
            wrap: true`;
flexCode = flexCode.replace(oldFlexSub, newFlexSub);
fs.writeFileSync('src/lib/line/flex-templates.ts', flexCode);


// 2. Update central-router.ts
let routerCode = fs.readFileSync('src/lib/line/handlers/central-router.ts', 'utf8');
const oldRouterBlock = `    if (aiResult.is_conversation) {
      const { createModeSelectionFlex } = await import('@/lib/line/flex-templates');
      const messages = [];
      if (aiResult.reply_message) {
        messages.push(aiResult.reply_message);
      } else {
        messages.push('สวัสดีครับ มีอะไรให้ผมช่วยจำหรือจัดการไหมครับ?');
      }
      
      messages.push({
        type: 'flex',
        altText: '🤖 กรุณาเลือกโหมดการทำงาน',
        contents: createModeSelectionFlex()
      });
      
      await sendLineReply(replyToken, messages);
      return true;
    }`;

const newRouterBlock = `    if (aiResult.is_conversation) {
      const { createModeSelectionFlex } = await import('@/lib/line/flex-templates');
      const reply = aiResult.reply_message || 'สวัสดีครับ มีอะไรให้ผมช่วยจำหรือจัดการไหมครับ?';
      
      const flexMessage = {
        type: 'flex',
        altText: reply,
        contents: createModeSelectionFlex('🤖 ' + reply, 'หรือเลือกโหมดการทำงานด่วนด้านล่างนี้ได้เลยครับ:')
      };
      
      await sendLineReply(replyToken, [flexMessage]);
      return true;
    }`;

routerCode = routerCode.replace(oldRouterBlock, newRouterBlock);
fs.writeFileSync('src/lib/line/handlers/central-router.ts', routerCode);

console.log('Flex message combination applied!');
