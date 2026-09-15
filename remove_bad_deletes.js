const fs = require('fs');
let code = fs.readFileSync('src/lib/line/handlers/central-router.ts', 'utf8');

// Remove DELETE from INVENTORY
code = code.replace(
/          if \(cmd\.action === 'DELETE'\) \{\s*await supabaseAdmin\.from\('stocks'\)\.delete\(\)\.eq\('id', stock\.id\);\s*await sendLineReply\(replyToken, `🗑️ ลบรายการ '\$\{stock\.name\}' ออกจากบอร์ดสต็อกเรียบร้อยแล้วครับ`\);\s*return true;\s*\}/g,
''
);

// Remove DELETE from KANBAN (pr_requests)
code = code.replace(
/      \} else if \(cmd\.action === 'DELETE'\) \{\s*const \{ data: prs \} = await supabaseAdmin\.from\('pr_requests'\)\.select\('\*'\)\.eq\('board_id', targetBoard\.id\)\.ilike\('title', `%\$\{title\}%`\)\.limit\(1\);\s*if \(prs && prs\.length > 0\) \{\s*await supabaseAdmin\.from\('pr_requests'\)\.delete\(\)\.eq\('id', prs\[0\]\.id\);\s*await sendLineReply\(replyToken, `🗑️ ลบรายการ '\$\{prs\[0\]\.title\}' เรียบร้อยแล้วครับ`\);\s*\} else \{\s*await sendLineReply\(replyToken, `❌ ไม่พบรายการ '\$\{title\}' ครับ`\);\s*\}\s*/g,
      '} '
);

// Remove DELETE from DATE_TRACKER (lab_calibrations)
code = code.replace(
/      if \(cmd\.action === 'DELETE'\) \{\s*const \{ data: items \} = await supabaseAdmin\.from\('lab_calibrations'\)\.select\('\*'\)\.eq\('board_id', targetBoard\.id\)\.ilike\('equipment_name', `%\$\{title\}%`\)\.limit\(1\);\s*if \(items && items\.length > 0\) \{\s*await supabaseAdmin\.from\('lab_calibrations'\)\.delete\(\)\.eq\('id', items\[0\]\.id\);\s*await sendLineReply\(replyToken, `🗑️ ลบรายการ '\$\{items\[0\]\.equipment_name\}' เรียบร้อยแล้วครับ`\);\s*\} else \{\s*await sendLineReply\(replyToken, `❌ ไม่พบรายการ '\$\{title\}' ครับ`\);\s*\}\s*\} else /g,
      ''
);

// Remove DELETE from GENERAL_LIST (items)
code = code.replace(
/      if \(cmd\.action === 'DELETE'\) \{\s*const \{ data: items \} = await supabaseAdmin\.from\('items'\)\.select\('\*'\)\.eq\('board_id', targetBoard\.id\)\.ilike\('title', `%\$\{title\}%`\)\.limit\(1\);\s*if \(items && items\.length > 0\) \{\s*await supabaseAdmin\.from\('items'\)\.delete\(\)\.eq\('id', items\[0\]\.id\);\s*await sendLineReply\(replyToken, `🗑️ ลบรายการ '\$\{items\[0\]\.title\}' เรียบร้อยแล้วครับ`\);\s*\} else \{\s*await sendLineReply\(replyToken, `❌ ไม่พบรายการ '\$\{title\}' ครับ`\);\s*\}\s*\} else /g,
      ''
);

fs.writeFileSync('src/lib/line/handlers/central-router.ts', code);
console.log('Removed buggy DELETE blocks');
