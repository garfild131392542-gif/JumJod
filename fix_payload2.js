const fs = require('fs');

function limitQueryGeneric(filePath, tableName) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Find standard select all order by
  const regex = new RegExp(`\\.from\\('${tableName}'\\)\\s*\\.select\\('\\*'\\)\\s*\\.order\\('([^']+)',\\s*\\{\\s*ascending:\\s*(true|false)\\s*\\}\\);`, 'g');
  
  content = content.replace(regex, `.from('${tableName}').select('*').order('$1', { ascending: $2 }).limit(50);`);
  
  fs.writeFileSync(filePath, content);
}

limitQueryGeneric('src/app/(dashboard)/pr-tracker/page.tsx', 'pr_requests');
limitQueryGeneric('src/app/(dashboard)/stock/page.tsx', 'stocks');
limitQueryGeneric('src/app/(dashboard)/calibration/page.tsx', 'lab_calibrations');
console.log('Other queries limited');
