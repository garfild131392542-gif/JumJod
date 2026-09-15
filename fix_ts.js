const fs = require('fs');
let content = fs.readFileSync('src/lib/line/flex-templates.ts', 'utf8');
content = content.replace(
  "contents: [ { type: 'text', text: `และอีก ${items.length - 11} รายการ...`, weight: 'bold', wrap: true, color: '#64748b' } ]",
  "contents: [ { type: 'text', text: `และอีก ${items.length - 11} รายการ...`, weight: 'bold', size: 'md', wrap: true, color: '#64748b' } ]"
);
fs.writeFileSync('src/lib/line/flex-templates.ts', content);
console.log("Fixed flex-templates");
