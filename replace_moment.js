const fs = require('fs');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace imports
  content = content.replace(/import moment from 'moment';/g, "import dayjs from 'dayjs';\nimport 'dayjs/locale/th';\nimport localizedFormat from 'dayjs/plugin/localizedFormat';\nimport isSameOrBefore from 'dayjs/plugin/isSameOrBefore';\ndayjs.extend(localizedFormat);\ndayjs.extend(isSameOrBefore);\ndayjs.locale('th');");
  
  // Clean up old moment localizer imports in calendar
  content = content.replace(/import \{ momentLocalizer(.*?)\} from 'react-big-calendar';/g, "import { dayjsLocalizer$1} from 'react-big-calendar';");
  
  // Remove moment locale import
  content = content.replace(/import 'moment\/locale\/th';/g, '');
  content = content.replace(/moment\.locale\('th'\);/g, '');
  content = content.replace(/const localizer = momentLocalizer\(moment\);/g, "const localizer = dayjsLocalizer(dayjs);");
  
  // Replace all moment() calls
  content = content.replace(/moment\(/g, "dayjs(");
  
  fs.writeFileSync(filePath, content);
}

replaceInFile('src/app/(dashboard)/calendar/page.tsx');
replaceInFile('src/app/(dashboard)/completed/page.tsx');
console.log('moment replaced with dayjs');
