const fs = require('fs');
let content = fs.readFileSync('src/lib/line/flex-templates.ts', 'utf8');
content = content.replace(
  "type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: 'xl',",
  "type: 'box', layout: 'vertical', spacing: 'sm',"
);
content = content.replace(
  "size: 'md', wrap: true, color: '#64748b', align: 'center' } ]",
  "wrap: true } ]"
);
fs.writeFileSync('src/lib/line/flex-templates.ts', content);
