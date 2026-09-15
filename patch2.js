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

// ─── 1. layout.tsx ───────────────────────────────────────────────────────────
patch('src/app/(dashboard)/layout.tsx', [
  // Issue 6: Nav items rounded-2xl → rounded-lg
  [
    `className={\`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 cursor-pointer \${`,
    `className={\`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 cursor-pointer \${`
  ],
  // Issue 7: Active Nav border-l-4 + bg + shadow = ซ้ำซ้อน
  [
    `isActive 
                  ? 'bg-violet-600/10 dark:bg-violet-600/20 text-violet-600 dark:text-violet-400 border-l-4 border-violet-500 shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'`,
    `isActive 
                  ? 'bg-violet-600/10 dark:bg-violet-600/20 text-violet-600 dark:text-violet-400' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'`
  ],
  // Issue 11: text-[9px] in mobile header subtitle
  [
    `className="text-[9px] text-slate-400 font-bold uppercase tracking-wider"`,
    `className="text-[11px] text-slate-400 font-bold uppercase tracking-wider"`
  ],
  // Issue 6: Mobile drawer rounded-t-[28px] → rounded-t-2xl
  [
    `className="bg-white dark:bg-slate-900 rounded-t-[28px] w-full max-h-[85vh] flex flex-col relative"`,
    `className="bg-white dark:bg-slate-900 rounded-t-2xl w-full max-h-[85vh] flex flex-col relative"`
  ],
  [
    `className={\`flex items-center gap-4 px-5 py-4 rounded-2xl transition-colors cursor-pointer \${`,
    `className={\`flex items-center gap-4 px-5 py-4 rounded-lg transition-colors cursor-pointer \${`
  ]
]);

// ─── 2. dashboard/page.tsx ───────────────────────────────────────────────────
patch('src/app/(dashboard)/dashboard/page.tsx', [
  // Issue 14: Search bar unnecessary wrapper
  [
    `<div className="flex flex-col sm:flex-row gap-3 p-3 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหารายการจดบันทึก..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-950 border-none rounded-xl text-sm focus:ring-2 focus:ring-violet-500/50 outline-none transition-shadow text-slate-700 dark:text-slate-200"
              />
            </div>
            
            {/* Add New Button */}
            <button
              onClick={handleAddItem}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 active:scale-95 text-white rounded-xl text-sm font-bold transition-all shadow-sm shadow-violet-500/25 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มบันทึก</span>
            </button>
          </div>`,
    `<div className="flex flex-col sm:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหารายการจดบันทึก..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-violet-500/50 outline-none transition-shadow text-slate-700 dark:text-slate-200 shadow-sm"
              />
            </div>
            
            {/* Add New Button */}
            <button
              onClick={handleAddItem}
              className="flex items-center justify-center gap-2 px-5 py-2.5 h-11 bg-violet-600 hover:bg-violet-700 active:scale-95 text-white rounded-xl text-sm font-bold transition-all shadow-sm shadow-violet-500/25 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มบันทึก</span>
            </button>
          </div>`
  ]
]);

// ─── 3. stock/page.tsx ───────────────────────────────────────────────────────
patch('src/app/(dashboard)/stock/page.tsx', [
  // Issue 9: Sort dropdown emojis
  [
    `<select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="appearance-none pl-9 pr-10 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500/50 cursor-pointer shadow-sm w-full"
              >
                <option value="name-asc">🔤 เรียงตามชื่อ (ก-ฮ)</option>
                <option value="priority-desc">🚨 เรียงตามลำดับความสำคัญ (ด่วนที่สุด)</option>
                <option value="alert-first">⚠️ จัดสินค้าใกล้หมดขึ้นก่อน</option>
                <option value="qty-asc">📦 เรียงตามยอดน้อยไปมาก</option>
              </select>`,
    `<select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="appearance-none pl-9 pr-10 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500/50 cursor-pointer shadow-sm w-full"
              >
                <option value="name-asc">เรียงตามชื่อ (ก-ฮ)</option>
                <option value="priority-desc">เรียงตามความสำคัญ</option>
                <option value="alert-first">จัดสินค้าใกล้หมดขึ้นก่อน</option>
                <option value="qty-asc">เรียงตามยอดน้อยไปมาก</option>
              </select>`
  ]
]);
