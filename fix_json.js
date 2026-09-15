const fs = require('fs');
let c = fs.readFileSync('src/lib/ai.ts', 'utf8');

c = c.replace(/JSON\.parse\(rawText\.trim\(\)\)/g, 'safeJsonParse(rawText)');

const helper = `
function safeJsonParse(text: string): any {
  try {
    const clean = text.replace(/^\`\`\`(?:json)?\\s*/i, '').replace(/\\s*\`\`\`$/i, '').trim();
    return JSON.parse(clean);
  } catch (e) {
    console.error('safeJsonParse error on:', text);
    throw e;
  }
}

`;

c = helper + c;
fs.writeFileSync('src/lib/ai.ts', c);
console.log('Fixed JSON parsing in ai.ts');
