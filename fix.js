const fs = require('fs');

// Fix ai.ts
let ai = fs.readFileSync('src/lib/ai.ts', 'utf8');

ai = ai.replace(
  /action: 'ADD' \| 'UPDATE' \| 'DELETE' \| 'SEARCH' \| 'COMPLETE' \| 'CHECK_STOCK' \| 'SUBTRACT_STOCK' \| 'ADD_STOCK';/,
  "action: 'ADD' | 'UPDATE' | 'DELETE' | 'SEARCH' | 'COMPLETE' | 'CHECK_STOCK' | 'SUBTRACT_STOCK' | 'ADD_STOCK' | 'LIST_ALL';"
);

ai = ai.replace(
  /'ADD', 'UPDATE', 'DELETE', 'SEARCH', 'COMPLETE', 'CHECK_STOCK', 'SUBTRACT_STOCK', 'ADD_STOCK'/,
  "'ADD', 'UPDATE', 'DELETE', 'SEARCH', 'COMPLETE', 'CHECK_STOCK', 'SUBTRACT_STOCK', 'ADD_STOCK', 'LIST_ALL'"
);

ai = ai.replace(
  /"ADD\|UPDATE\|DELETE\|SEARCH\|COMPLETE\|CHECK_STOCK\|SUBTRACT_STOCK\|ADD_STOCK"/,
  '"ADD|UPDATE|DELETE|SEARCH|COMPLETE|CHECK_STOCK|SUBTRACT_STOCK|ADD_STOCK|LIST_ALL"'
);

fs.writeFileSync('src/lib/ai.ts', ai, 'utf8');

// Fix central-router.ts
let router = fs.readFileSync('src/lib/line/handlers/central-router.ts', 'utf8');
if (!router.includes('LIST_ALL')) {
  router = router.replace(
    /if \(cmd\.action === 'ADD' \|\| cmd\.action === 'UPDATE'/,
    "if (cmd.action === 'LIST_ALL') {\n        const { data: allStocks } = await supabaseAdmin.from('stocks').select('*').eq('board_id', targetBoard.id).order('name');\n        if (!allStocks || allStocks.length === 0) {\n           await sendLineReply(replyToken, '📦 บอร์ด ' + targetBoard.name + ' ยังไม่มีรายการสินค้าครับ');\n        } else {\n           const listStr = allStocks.map(s => '- ' + s.name + ': ' + s.quantity + ' ' + (s.unit || 'ชิ้น')).join('\\n');\n           await sendLineReply(replyToken, '📦 สต็อกทั้งหมดใน ' + targetBoard.name + ':\\n' + listStr);\n        }\n        return true;\n      }\n      if (cmd.action === 'ADD' || cmd.action === 'UPDATE'"
  );
  fs.writeFileSync('src/lib/line/handlers/central-router.ts', router, 'utf8');
}
console.log('done!');
