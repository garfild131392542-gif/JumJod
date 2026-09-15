const fs = require('fs');
let c = fs.readFileSync('src/lib/ai.ts', 'utf8');

const regex = /^[\s\S]*?(?=import \{)/;
const replacement = `
function safeJsonParse(text: string): any {
  try {
    const clean = text.replace(/^\\\`\\\`\\\`(?:json)?\\s*/i, '').replace(/\\s*\\\`\\\`\\\`$/i, '').trim();
    return JSON.parse(clean);
  } catch (e) {
    console.error('safeJsonParse error on:', text);
    throw e;
  }
}
`;

c = c.replace(regex, replacement);
fs.writeFileSync('src/lib/ai.ts', c);
console.log('Fixed duplicate safeJsonParse');
