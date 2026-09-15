const fs = require('fs');
let c = fs.readFileSync('src/lib/line/handlers/central-router.ts', 'utf8');

// If it's a conversation, return false instead of true so legacy router can handle it
c = c.replace(/if \\(aiResult\\.is_conversation\\) \\{[\\s\\S]*?return true;\\n    \\}/m, \if (aiResult.is_conversation) {\\n      return false;\\n    }\);

fs.writeFileSync('src/lib/line/handlers/central-router.ts', c);
console.log('Fixed central-router.ts');

