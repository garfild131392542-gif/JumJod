const fs = require('fs');
const targetStr = "if (cmd.action === 'ADD' || cmd.action === 'UPDATE' || cmd.action === 'ADD_STOCK' || cmd.action === 'SUBTRACT_STOCK' || cmd.action === 'CHECK_STOCK') {";
const replacementStr = "if (['ADD', 'UPDATE', 'ADD_STOCK', 'SUBTRACT_STOCK', 'CHECK_STOCK', 'DELETE'].includes(cmd.action)) {";
let code = fs.readFileSync('src/lib/line/handlers/central-router.ts', 'utf8');
code = code.replace(targetStr, replacementStr);
fs.writeFileSync('src/lib/line/handlers/central-router.ts', code);
console.log('Fixed INVENTORY block');
