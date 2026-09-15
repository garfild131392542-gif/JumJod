const fs = require('fs');
let c = fs.readFileSync('src/lib/line/handlers/central-router.ts', 'utf8');
c = c.replace(/if \(cmd\.action === 'ADD' \|\| cmd\.action === 'UPDATE' \|\| cmd\.action === 'ADD_STOCK' \|\| cmd\.action === 'SUBTRACT_STOCK' \|\| cmd\.action === 'CHECK_STOCK'\)/g, "if (cmd.action === 'ADD' || cmd.action === 'UPDATE' || cmd.action === 'ADD_STOCK' || cmd.action === 'SUBTRACT_STOCK' || cmd.action === 'CHECK_STOCK' || cmd.action === 'DELETE')");
fs.writeFileSync('src/lib/line/handlers/central-router.ts', c);
