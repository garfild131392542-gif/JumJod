const fs = require('fs');

function patch(file, replacements) {
  let src = fs.readFileSync(file, 'utf8');
  let changed = 0;
  for (const [from, to] of replacements) {
    if (src.includes(from)) {
      src = src.replaceAll(from, to);
      changed++;
    } else {
      console.warn(`  ⚠ NOT FOUND in ${file.split('/').pop()}: "${from.substring(0, 80)}"`);
    }
  }
  fs.writeFileSync(file, src, 'utf8');
  console.log(`✅ ${file.split('/').pop()} — ${changed}/${replacements.length} replacements`);
}

patch('src/app/(dashboard)/layout.tsx', [
  // Nav items rounded-xl → rounded-lg, remove shadow-sm from active state, remove bg-slate-100 hover from inactive state to simplify. Wait, the audit says over-rounded 2xl/3xl.
  // Actually, line 155 is `className="flex items-center gap-3 px-4 py-3 rounded-xl...`. Let's just fix the active nav background + border.
  [
    `? 'bg-violet-600/10 dark:bg-violet-600/20 text-violet-600 dark:text-violet-400 border-l-4 border-violet-500 shadow-sm'`,
    `? 'bg-violet-600/10 dark:bg-violet-600/20 text-violet-600 dark:text-violet-400'`
  ],
  [
    `className={\`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-200 group relative \${`,
    `className={\`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-all duration-200 group relative \${`
  ],
  // Mobile drawer items rounded-2xl → rounded-lg
  [
    `className={\`flex items-center justify-between p-3 rounded-2xl transition-all duration-200 active:scale-[0.98] \${`,
    `className={\`flex items-center justify-between p-3 rounded-lg transition-all duration-200 active:scale-[0.98] \${`
  ],
  [
    `className="relative w-full max-h-[85vh] bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-t-[28px] shadow-2xl overflow-hidden flex flex-col animate-slide-up z-10"`,
    `className="relative w-full max-h-[85vh] bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-t-2xl shadow-2xl overflow-hidden flex flex-col animate-slide-up z-10"`
  ],
  [
    `className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none"`,
    `className="text-[11px] text-slate-400 font-bold uppercase tracking-wider leading-none"`
  ]
]);

patch('src/app/(dashboard)/dashboard/page.tsx', [
  [
    `<div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 p-3 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl backdrop-blur-sm shadow-sm">
        <div className="relative flex-1">`,
    `<div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1">`
  ],
  [
    `            className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-slate-100/50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 focus:border-violet-500 dark:focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-all text-sm text-slate-800 dark:text-slate-200"
          />
        </div>
      </div>`,
    `            className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 focus:border-violet-500 dark:focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-all text-sm text-slate-800 dark:text-slate-200 shadow-sm"
          />
        </div>
      </div>`
  ]
]);

patch('src/app/(dashboard)/stock/page.tsx', [
  [
    `<option value="name-asc">🔤 เรียงตามชื่อ (ก-ฮ)</option>
                <option value="priority-desc">🚨 เรียงตามลำดับความสำคัญ (ด่วนที่สุด)</option>
                <option value="alert-first">⚠️ จัดสินค้าใกล้หมดขึ้นก่อน</option>
                <option value="qty-asc">📦 เรียงตามยอดน้อยไปมาก</option>`,
    `<option value="name-asc">เรียงตามชื่อ (ก-ฮ)</option>
                <option value="priority-desc">เรียงตามความสำคัญ</option>
                <option value="alert-first">สินค้าใกล้หมดขึ้นก่อน</option>
                <option value="qty-asc">เรียงตามยอดน้อยไปมาก</option>`
  ]
]);
