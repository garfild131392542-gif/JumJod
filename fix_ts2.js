const fs = require('fs');
let content = fs.readFileSync('src/lib/line/flex-templates.ts', 'utf8');
content = content.replace(
  "type: 'box', layout: 'vertical', justifyContent: 'center', alignItems: 'center', height: '200px',",
  "type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: 'xl',"
);
content = content.replace(
  "size: 'md', wrap: true, color: '#64748b' } ]",
  "size: 'md', wrap: true, color: '#64748b', align: 'center' } ]"
);
fs.writeFileSync('src/lib/line/flex-templates.ts', content);
