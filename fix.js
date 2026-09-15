const fs = require('fs');
let c = fs.readFileSync('src/lib/ai.ts', 'utf8');

c = c.replace(/\(e\.g\., [^)]+\)\. Do not ask/g, '(e.g., "รับทราบครับ มีอะไรให้ผมช่วยบันทึกหรือเช็คสต็อกบอกได้เลยนะครับ"). Do not ask');

fs.writeFileSync('src/lib/ai.ts', c);
console.log('Fixed ai.ts');
