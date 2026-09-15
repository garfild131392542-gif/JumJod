const fs = require('fs');
let content = fs.readFileSync('src/lib/line/flex-templates.ts', 'utf8');
content = content.replace(
  "const bubbles = items.slice(0, 11).map(item => {",
  "const bubbles: any[] = items.slice(0, 11).map(item => {"
);
fs.writeFileSync('src/lib/line/flex-templates.ts', content);
