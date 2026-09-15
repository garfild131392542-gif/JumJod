const fs = require('fs');

// 1. Add createCarouselFlex to flex-templates.ts
let flexCode = fs.readFileSync('src/lib/line/flex-templates.ts', 'utf8');

const carouselCode = `
export function createCarouselFlex(items: any[], boardType: string, boardName: string) {
  const bubbles = items.slice(0, 11).map(item => {
    let title = item.title || item.name || item.equipment_name || 'ไม่ระบุชื่อ';
    let subtitle = '';
    if (boardType === 'INVENTORY') {
      subtitle = \`จำนวน: \${item.quantity} \${item.unit || 'ชิ้น'}\`;
    } else if (boardType === 'DATE_TRACKER') {
      subtitle = \`กำหนด: \${item.next_due_date || 'ไม่ระบุ'}\`;
    } else {
      subtitle = \`สถานะ: \${item.status || 'Pending'}\`;
    }
    
    return {
      type: 'bubble',
      size: 'kilo',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          { type: 'text', text: title, weight: 'bold', size: 'md', wrap: true, color: '#1e293b' },
          { type: 'text', text: subtitle, size: 'sm', color: '#64748b' }
        ]
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: { type: 'message', label: 'แก้ไข', text: \`แก้ไข \${title}\` }
          },
          {
            type: 'button',
            style: 'primary',
            color: '#ef4444',
            height: 'sm',
            action: { type: 'message', label: 'ลบ', text: \`ลบ \${title}\` }
          }
        ]
      }
    };
  });
  
  if (items.length > 11) {
     bubbles.push({
        type: 'bubble',
        size: 'kilo',
        body: {
           type: 'box', layout: 'vertical', justifyContent: 'center', alignItems: 'center', height: '200px',
           contents: [ { type: 'text', text: \`และอีก \${items.length - 11} รายการ...\`, weight: 'bold', wrap: true, color: '#64748b' } ]
        }
     });
  }

  return {
    type: 'carousel',
    contents: bubbles
  };
}
`;

flexCode = flexCode + carouselCode;
fs.writeFileSync('src/lib/line/flex-templates.ts', flexCode);

// 2. Update central-router.ts
let routerCode = fs.readFileSync('src/lib/line/handlers/central-router.ts', 'utf8');

// Replace INVENTORY list
routerCode = routerCode.replace(
  /if \(!allStocks \|\| allStocks\.length === 0\) \{[\s\S]*?return true;\s*\}/,
  `if (!allStocks || allStocks.length === 0) {
             await sendLineReply(replyToken, '📦 บอร์ด ' + targetBoard.name + ' ยังไม่มีรายการสินค้าครับ');
          } else {
             const { createCarouselFlex } = await import('@/lib/line/flex-templates');
             await sendLineReply(replyToken, [{
               type: 'flex',
               altText: '📦 รายการสต็อกทั้งหมด',
               contents: createCarouselFlex(allStocks, targetBoard.type, targetBoard.name)
             }]);
          }
          return true;
        }`
);

// Replace KANBAN list
routerCode = routerCode.replace(
  /if \(!allPrs \|\| allPrs\.length === 0\) \{[\s\S]*?return true;\s*\}/,
  `if (!allPrs || allPrs.length === 0) {
              await sendLineReply(replyToken, \`📋 บอร์ด \${targetBoard.name} ยังไม่มีรายการครับ\`);
           } else {
              const { createCarouselFlex } = await import('@/lib/line/flex-templates');
              await sendLineReply(replyToken, [{
                type: 'flex',
                altText: '📋 รายการ PR ทั้งหมด',
                contents: createCarouselFlex(allPrs, targetBoard.type, targetBoard.name)
              }]);
           }
           return true;
        }`
);

// Replace DATE_TRACKER list
routerCode = routerCode.replace(
  /if \(!allDates \|\| allDates\.length === 0\) \{[\s\S]*?return true;\s*\}/,
  `if (!allDates || allDates.length === 0) {
              await sendLineReply(replyToken, \`📅 บอร์ด \${targetBoard.name} ยังไม่มีรายการครับ\`);
           } else {
              const { createCarouselFlex } = await import('@/lib/line/flex-templates');
              await sendLineReply(replyToken, [{
                type: 'flex',
                altText: '📅 รายการแจ้งเตือนทั้งหมด',
                contents: createCarouselFlex(allDates, targetBoard.type, targetBoard.name)
              }]);
           }
           return true;
        }`
);

// Replace default items list
routerCode = routerCode.replace(
  /if \(!allItems \|\| allItems\.length === 0\) \{[\s\S]*?return true;\s*\}/,
  `if (!allItems || allItems.length === 0) {
              await sendLineReply(replyToken, \`📝 บอร์ด \${targetBoard.name} ยังไม่มีรายการครับ\`);
           } else {
              const { createCarouselFlex } = await import('@/lib/line/flex-templates');
              await sendLineReply(replyToken, [{
                type: 'flex',
                altText: '📝 รายการบันทึกทั้งหมด',
                contents: createCarouselFlex(allItems, targetBoard.type, targetBoard.name)
              }]);
           }
           return true;
        }`
);

fs.writeFileSync('src/lib/line/handlers/central-router.ts', routerCode);
console.log('Flex Carousel List applied!');
