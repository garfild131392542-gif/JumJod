const fs = require('fs');

// 1. Fix central-router.ts
let routerCode = fs.readFileSync('src/lib/line/handlers/central-router.ts', 'utf8');
routerCode = routerCode.replace(
  /if \(aiResult\.is_conversation\) \{[\s\S]*?return true;\s*\}/m,
  `if (aiResult.is_conversation) {\n      return false;\n    }`
);
fs.writeFileSync('src/lib/line/handlers/central-router.ts', routerCode);
console.log('Fixed central-router.ts');

// 2. Fix route.ts to not intercept if userState is active
let routeCode = fs.readFileSync('src/app/api/line-webhook/route.ts', 'utf8');

// Find the handleCentralRouting block
const centralBlock = `      if (event.message.type === 'text') {
        const { handleCentralRouting } = await import('@/lib/line/handlers/central-router');
        const handled = await handleCentralRouting(messageText, replyToken, lineUserId, profile, supabaseAdmin);
        if (handled) continue;
      }`;

// Move it down below userState check
routeCode = routeCode.replace(centralBlock, '');

const insertTarget = `const userState = await getConversationState(lineUserId, profile, supabaseAdmin);`;
const replacement = `${insertTarget}

      // Allow central routing only if user is NOT in a conversation state
      if (!userState && event.message.type === 'text') {
        const { handleCentralRouting } = await import('@/lib/line/handlers/central-router');
        const handled = await handleCentralRouting(messageText, replyToken, lineUserId, profile, supabaseAdmin);
        if (handled) continue;
      }
`;
routeCode = routeCode.replace(insertTarget, replacement);

fs.writeFileSync('src/app/api/line-webhook/route.ts', routeCode);
console.log('Fixed route.ts');
