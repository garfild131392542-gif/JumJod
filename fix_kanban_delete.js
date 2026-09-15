const fs = require('fs');
let code = fs.readFileSync('src/lib/line/handlers/central-router.ts', 'utf8');

// I will just use string manipulation to remove the first DELETE block in KANBAN.
// In KANBAN, there is:
// if (cmd.action === 'DELETE') {
//    const { data: items } = await supabaseAdmin.from('lab_calibrations')...
// ...
// } else if (cmd.action === 'ADD') {

code = code.replace(
  /if \(cmd\.action === 'DELETE'\) \{\s*const \{ data: items \} = await supabaseAdmin\.from\('lab_calibrations'\)[\s\S]*?\} else if \(cmd\.action === 'ADD'\) \{/g,
  "if (cmd.action === 'ADD') {"
);

// In KANBAN, there is also:
// } else if (cmd.action === 'DELETE') {
//    const { data: prs } = await supabaseAdmin.from('pr_requests')...
// ...
// } else if (cmd.action === 'UPDATE' || cmd.action === 'COMPLETE') {
code = code.replace(
  /\} else if \(cmd\.action === 'DELETE'\) \{\s*const \{ data: prs \} = await supabaseAdmin\.from\('pr_requests'\)[\s\S]*?\} else if \(cmd\.action === 'UPDATE' \|\| cmd\.action === 'COMPLETE'\) \{/g,
  "} else if (cmd.action === 'UPDATE' || cmd.action === 'COMPLETE') {"
);

fs.writeFileSync('src/lib/line/handlers/central-router.ts', code);
console.log('Fixed KANBAN DELETE blocks');
