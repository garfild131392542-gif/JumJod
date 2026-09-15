const fs = require('fs');

function limitQuery(filePath, isDashboard) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (isDashboard) {
    content = content.replace(
      /\.select\('\*'\)\s*\.order\('created_at', \{ ascending: false \}\);/,
      ".select('*').in('status', ['Pending', 'Purchasing']).order('created_at', { ascending: false }).limit(50);"
    );
  } else {
    content = content.replace(
      /\.select\('\*'\)\s*\.eq\('status', 'Issuing Item'\)\s*\.order\('updated_at', \{ ascending: false \}\);/,
      ".select('*').eq('status', 'Issuing Item').order('updated_at', { ascending: false }).limit(50);"
    );
  }
  
  fs.writeFileSync(filePath, content);
}

limitQuery('src/app/(dashboard)/dashboard/page.tsx', true);
limitQuery('src/app/(dashboard)/completed/page.tsx', false);
console.log('Queries limited to 50 items');
