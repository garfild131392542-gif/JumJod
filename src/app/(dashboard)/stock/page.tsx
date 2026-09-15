'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { StockItem } from '@/lib/types';
import { Plus, Search, Edit2, Trash2, AlertCircle, Package, Minus, ArrowUpDown, AlertTriangle, History, X, ChevronDown, CheckCircle2, XCircle } from 'lucide-react';
import StockModal from '@/components/dashboard/stock-modal';
import StockHistoryModal from '@/components/dashboard/stock-history-modal';

export default function StockPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const supabase = createClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name-asc' | 'priority-desc' | 'alert-first' | 'qty-asc'>('name-asc');
  const [modalOpen, setModalOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<StockItem | null>(null);
  const [openCategoryDropdown, setOpenCategoryDropdown] = useState<string | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!openCategoryDropdown) return;
    const handler = () => setOpenCategoryDropdown(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [openCategoryDropdown]);

  const { data: inventoryBoard } = useQuery({
    queryKey: ['inventory-board', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('boards').select('id').eq('user_id', user!.id).eq('type', 'INVENTORY').single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: categories = [], refetch: refetchCategories } = useQuery({
    queryKey: ['categories', inventoryBoard?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').eq('board_id', inventoryBoard!.id).order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!inventoryBoard?.id,
  });

  const handleAddCategory = async () => {
    if (!inventoryBoard?.id) return;
    const name = prompt('ชื่อหมวดหมู่ใหม่ (เช่น เครื่องเขียน, วัสดุทำความสะอาด):');
    if (!name) return;
    await supabase.from('categories').insert([{ name, board_id: inventoryBoard.id, color: 'indigo' }]);
    refetchCategories();
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('คุณต้องการลบหมวดหมู่นี้ใช่หรือไม่? (วัสดุที่อยู่ในหมวดหมู่นี้จะไม่ถูกลบไปด้วย แต่คุณสามารถเปลี่ยนหมวดหมู่ได้)')) return;
    await supabase.from('categories').delete().eq('id', id);
    if (filterCategory !== 'all') setFilterCategory('all');
    refetchCategories();
  };

  // Fetch stocks using TanStack Query
  const { data: stocks = [], isLoading, error } = useQuery<StockItem[]>({
    queryKey: ['stocks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stocks')
        .select('*');

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Adjust quantity mutation via API (enables push alerts on threshold)
  const adjustQuantityMutation = useMutation({
    mutationFn: async ({ id, newQuantity }: { id: string; newQuantity: number }) => {
      const response = await fetch('/api/stock/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, newQuantity })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData?.error || 'Failed to adjust quantity');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
      queryClient.invalidateQueries({ queryKey: ['stock-transactions'] });
    },
  });

  // Delete stock item mutation
  const deleteStockMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('stocks')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
    },
  });

  const handleAddStock = () => {
    setSelectedStock(null);
    setModalOpen(true);
  };

  const handleEditStock = (stock: StockItem) => {
    setSelectedStock(stock);
    setModalOpen(true);
  };

  const handleDeleteStock = (id: string) => {
    if (confirm('คุณแน่ใจหรือไม่ว่าต้องการลบวัสดุชิ้นนี้ออกจากคลัง?')) {
      deleteStockMutation.mutate(id);
    }
  };

  const handleAdjustQuantity = (stock: StockItem, amount: number) => {
    const newQty = Math.max(0, stock.quantity + amount);
    adjustQuantityMutation.mutate({ id: stock.id, newQuantity: newQty });
  };

  const handleMoveCategory = async (stock: StockItem, newCategory: string) => {
    if (newCategory === stock.category) return;
    await supabase
      .from('stocks')
      .update({ category: newCategory, updated_at: new Date().toISOString() })
      .eq('id', stock.id);
    queryClient.invalidateQueries({ queryKey: ['stocks'] });
  };

  // Filter items
  const filteredStocks = stocks.filter((stock) => {
    const matchesSearch = stock.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (stock.description && stock.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = filterCategory === 'all' || stock.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  // Sort items
  const sortedStocks = [...filteredStocks].sort((a, b) => {
    if (sortBy === 'name-asc') {
      return a.name.localeCompare(b.name, 'th');
    }
    if (sortBy === 'qty-asc') {
      return a.quantity - b.quantity;
    }
    if (sortBy === 'priority-desc') {
      const priorityWeight = { High: 3, Medium: 2, Low: 1 };
      return (priorityWeight[b.priority] || 2) - (priorityWeight[a.priority] || 2);
    }
    if (sortBy === 'alert-first') {
      const aAlert = a.quantity <= (a.min_threshold ?? 0) ? 1 : 0;
      const bAlert = b.quantity <= (b.min_threshold ?? 0) ? 1 : 0;
      if (aAlert !== bAlert) return bAlert - aAlert; // Alerts first
      return a.quantity - b.quantity; // Then ascending quantity
    }
    return 0;
  });

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            ระบบคลังวัสดุ & สต็อก (Inventory & Stock)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            ตรวจเช็กและจัดการยอดสต็อกวัสดุสำนักงาน และงาน Laboratory ของคุณ
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setHistoryOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-750 dark:text-slate-200 text-sm border border-slate-200 dark:border-slate-700 active:scale-[0.98] transition-all cursor-pointer"
          >
            <History className="w-4 h-4 text-slate-500" />
            <span>ประวัติทำรายการ</span>
          </button>
          <button
            onClick={handleAddStock}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white text-sm shadow-sm active:scale-[0.98] transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มวัสดุ</span>
          </button>
        </div>
      </div>

      {/* Dashboard Summary Section */}
      {!isLoading && stocks.length > 0 && (() => {
        const totalCount = stocks.length;
        const alertItems = stocks.filter(s => s.quantity <= (s.min_threshold ?? 0) && s.quantity > 0);
        const emptyItems = stocks.filter(s => s.quantity === 0);
        const normalItems = stocks.filter(s => s.quantity > (s.min_threshold ?? 0));

        const topAlert = [...stocks].filter(s => s.quantity <= (s.min_threshold ?? 0)).sort((a, b) => a.quantity - b.quantity).slice(0, 4);

        return (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 sm:gap-4">
            {/* Stat Cards - 1 Row 4 Columns */}
            <div className="xl:col-span-2 grid grid-cols-4 gap-2 sm:gap-3">
              {[
                { label: 'วัสดุทั้งหมด', value: totalCount, IconEl: Package, cardBg: 'bg-white dark:bg-slate-900/60 border border-indigo-200/60 dark:border-indigo-800/40', iconColor: 'text-indigo-500', valueColor: 'text-indigo-700 dark:text-indigo-300', subColor: 'text-indigo-500/80 dark:text-indigo-400' },
                { label: 'ปกติ', value: normalItems.length, IconEl: CheckCircle2, cardBg: 'bg-white dark:bg-slate-900/60 border border-emerald-200/60 dark:border-emerald-800/40', iconColor: 'text-emerald-500', valueColor: 'text-emerald-700 dark:text-emerald-300', subColor: 'text-emerald-500/80 dark:text-emerald-400' },
                { label: 'ใกล้หมด', value: alertItems.length, IconEl: AlertTriangle, cardBg: 'bg-white dark:bg-slate-900/60 border border-amber-200/60 dark:border-amber-800/40', iconColor: 'text-amber-500', valueColor: 'text-amber-700 dark:text-amber-300', subColor: 'text-amber-500/80 dark:text-amber-400' },
                { label: 'หมดแล้ว', value: emptyItems.length, IconEl: XCircle, cardBg: 'bg-white dark:bg-slate-900/60 border border-rose-200/60 dark:border-rose-800/40', iconColor: 'text-rose-500', valueColor: 'text-rose-700 dark:text-rose-300', subColor: 'text-rose-500/80 dark:text-rose-400' },
              ].map((stat, i) => (
                <div
                  key={i}
                  className={`relative overflow-hidden rounded-xl sm:rounded-2xl ${stat.cardBg} p-2 sm:p-3.5 shadow-sm flex flex-col items-start gap-1`}
                >
                  <stat.IconEl className={`w-4 h-4 sm:w-5 sm:h-5 ${stat.iconColor}`} />
                  <span className={`text-base sm:text-2xl font-black ${stat.valueColor} tracking-tight leading-tight tabular-nums`}>
                    {stat.value}
                  </span>
                  <span className={`text-[10px] sm:text-xs font-semibold ${stat.subColor} truncate w-full`}>
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Category Breakdown + Alert List */}
            <div className="flex flex-col gap-3">
              {/* Category breakdown (Dynamic) */}
              <div className="bg-white dark:bg-slate-900/55 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 flex flex-col gap-2 shadow-sm">
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">หมวดหมู่</p>
                {categories.length > 0 ? categories.map((cat: any) => {
                  const count = stocks.filter(s => s.category === cat.name).length;
                  return (
                    <div key={cat.id} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs text-slate-700 dark:text-slate-300 font-bold">{cat.name}</span>
                          <span className="text-xs font-black text-slate-700 dark:text-slate-200">{count}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                            style={{ width: `${totalCount ? (count / totalCount) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                }) : (
                  <p className="text-xs text-slate-400">ยังไม่มีหมวดหมู่</p>
                )}
              </div>


              {/* Alert items */}
              {topAlert.length > 0 && (
                <div className="bg-red-50/50 dark:bg-red-950/10 border border-red-200/80 dark:border-red-900/30 rounded-2xl p-4 shadow-sm flex-1">
                  <p className="text-[11px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wide mb-2">⚠️ ต้องเติมด่วน</p>
                  <div className="flex flex-col gap-1.5">
                    {topAlert.map(s => (
                      <div key={s.id} className="flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-700 dark:text-slate-200 truncate flex-1">{s.name}</span>
                        <span className={`text-xs font-black px-1.5 py-0.5 rounded-md shrink-0 ${s.quantity === 0 ? 'bg-red-500/15 text-red-600 dark:text-red-400' : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'}`}>
                          {s.quantity === 0 ? 'หมด' : `${s.quantity} ${s.unit}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Filter, Search and Sorting Bar */}

      <div className="flex flex-col xl:flex-row xl:items-center gap-4 p-4 bg-white dark:bg-slate-900/45 border border-slate-200 dark:border-slate-800/80 rounded-2xl backdrop-blur-sm shadow-sm">
        
        {/* Category switcher */}
        <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0 self-start xl:self-auto overflow-x-auto max-w-full">
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              filterCategory === 'all'
                ? 'bg-white dark:bg-slate-900 text-violet-650 dark:text-violet-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            ทั้งหมด
          </button>
          
          {categories.map((cat: any) => (
            <div key={cat.id} className="relative group/tab flex items-center">
              <button
                onClick={() => setFilterCategory(cat.name)}
                className={`pl-3 pr-7 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  filterCategory === cat.name
                    ? 'bg-white dark:bg-slate-900 text-violet-650 dark:text-violet-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                }`}
              >
                {cat.name}
              </button>
              <button 
                onClick={() => handleDeleteCategory(cat.id)}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 rounded transition-colors cursor-pointer opacity-0 group-hover/tab:opacity-100"
                title="ลบหมวดหมู่"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}

          <button
            onClick={handleAddCategory}
            className="px-3 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-indigo-500 border border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ml-2"
          >
            <Plus className="w-3 h-3" /> เพิ่ม
          </button>
        </div>

        {/* Sorting Dropdown */}
        <div className="flex items-center gap-2 shrink-0">
          <ArrowUpDown className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 focus:border-violet-500 outline-none transition-all cursor-pointer"
          >
            <option value="name-asc">เรียงตามชื่อ (ก-ฮ)</option>
            <option value="priority-desc">เรียงตามลำดับความสำคัญ (ด่วนที่สุด)</option>
            <option value="alert-first">จัดสินค้าใกล้หมดขึ้นก่อน</option>
            <option value="qty-asc">เรียงตามยอดน้อยไปมาก</option>
          </select>
        </div>

        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อวัสดุ หรือรายละเอียด..."
            className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-slate-100/50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 focus:border-violet-500 dark:focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-all text-sm text-slate-800 dark:text-slate-200"
          />
        </div>
      </div>

      {/* Grid of Stock Items */}
      {isLoading ? (
        <div className="h-[50vh] flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-400 font-semibold">กำลังโหลดข้อมูลสต็อกวัสดุ...</span>
        </div>
      ) : error ? (
        <div className="h-[40vh] flex flex-col items-center justify-center text-center p-6 border border-red-200/50 dark:border-red-900/30 bg-red-500/5 dark:bg-red-950/10 rounded-2xl gap-3">
          <AlertCircle className="w-8 h-8 text-red-500 dark:text-red-400" />
          <h3 className="text-sm font-bold text-red-700 dark:text-red-200">เกิดข้อผิดพลาดในการโหลดคลังวัสดุ</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{(error as any)?.message}</p>
        </div>
      ) : sortedStocks.length === 0 ? (
        <div className="h-[40vh] border border-dashed border-slate-350 dark:border-slate-800/80 rounded-2xl flex flex-col items-center justify-center text-center p-8 bg-white dark:bg-slate-900/10 gap-3">
          <Package className="w-10 h-10 text-slate-400 dark:text-slate-650" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">ไม่มีรายการวัสดุในคลัง</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm">
            {searchQuery ? 'ไม่พบวัสดุที่ตรงกับคำค้นหาของคุณ ลองใช้คำค้นอื่น' : 'เริ่มต้นสร้างรายการวัสดุรายการแรกของคุณได้เลย'}
          </p>
          {!searchQuery && (
            <button onClick={handleAddStock} className="flex items-center gap-1.5 h-11 px-5 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm active:scale-95 transition-all cursor-pointer">
              <Plus className="w-4 h-4" /> เพิ่มวัสดุรายการแรก
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pr-1">
          {sortedStocks.map((stock) => {
            const isAlert = stock.quantity <= (stock.min_threshold ?? 0);
            
            // Priority Tag Style
            let priorityBadgeColor = 'text-slate-600 bg-slate-100 border-slate-200 dark:text-slate-300 dark:bg-slate-800 dark:border-slate-700';
            let priorityLabel = 'ทั่วไป (Low)';
            if (stock.priority === 'High') {
              priorityBadgeColor = 'text-red-700 bg-red-500/10 border-red-500/20 dark:text-red-400 dark:bg-red-500/10 dark:border-red-500/20';
              priorityLabel = 'ด่วนมาก (High)';
            } else if (stock.priority === 'Medium') {
              priorityBadgeColor = 'text-amber-700 bg-amber-500/10 border-amber-500/20 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/20';
              priorityLabel = 'ปานกลาง (Medium)';
            }

            return (
              <div
                key={stock.id}
                className={`group relative bg-white dark:bg-slate-900/60 border rounded-2xl p-5 shadow-sm hover:shadow-md dark:shadow-none hover:border-slate-300 dark:hover:border-slate-700/80 transition-all duration-200 flex flex-col justify-between gap-4 ${
                  isAlert 
                    ? 'border-red-300 bg-red-50/20 dark:border-red-950/40 dark:bg-red-950/5' 
                    : 'border-slate-200 dark:border-slate-800/80'
                }`}
              >
                {/* Top Header */}
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {/* Custom category dropdown */}
                      <div className="relative">
                        <button
                          onClick={(e) => { e.stopPropagation(); setOpenCategoryDropdown(openCategoryDropdown === stock.id ? null : stock.id); }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 transition-colors cursor-pointer"
                        >
                          📂 {stock.category || 'ไม่มีหมวดหมู่'}
                          {categories.length > 1 && <ChevronDown className="w-2.5 h-2.5 ml-0.5 opacity-60" />}
                        </button>
                        {/* Dropdown panel */}
                        {openCategoryDropdown === stock.id && categories.length > 1 && (
                          <div className="absolute left-0 top-full mt-1 z-30 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1 min-w-[130px]">
                            {categories.map((cat: any) => (
                              <button
                                key={cat.id}
                                onClick={() => { handleMoveCategory(stock, cat.name); setOpenCategoryDropdown(null); }}
                                className={`w-full text-left px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                                  stock.category === cat.name
                                    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30'
                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                }`}
                              >
                                {stock.category === cat.name && '✓ '}{cat.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                  </div>

                  <div className="flex items-center justify-between gap-2 mt-3">
                    <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 group-hover:text-violet-650 dark:group-hover:text-violet-400 transition-colors line-clamp-1 flex-1">
                      {stock.name}
                    </h3>
                    <span className={`px-2 py-0.5 border rounded-lg text-[9px] font-extrabold select-none shrink-0 ${priorityBadgeColor}`}>
                      {priorityLabel}
                    </span>
                  </div>
                  
                  {stock.description ? (
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-1.5 line-clamp-2 leading-relaxed">
                      {stock.description}
                    </p>
                  ) : (
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-1.5 italic">ไม่มีรายละเอียดวัสดุ</p>
                  )}

                  {/* Threshold & Alarm indicator */}
                  <div className="mt-3.5 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                      เกณฑ์ควรสั่งซื้อเพิ่ม: {stock.min_threshold ?? 0} {stock.unit}
                    </span>
                    {isAlert && (
                      <span className="flex items-center gap-1 text-[10px] font-black text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-md select-none">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span>ควรสั่งซื้อเพิ่ม!</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Quantity Adjuster & Actions */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/40 flex items-center justify-between gap-3 shrink-0">
                  {/* Quantity Control Panel */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAdjustQuantity(stock, -1)}
                      disabled={stock.quantity <= 0 || adjustQuantityMutation.isPending}
                      className="w-11 h-11 rounded-lg flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    
                    <div className="text-center min-w-16">
                      <span className={`text-lg font-black transition-colors tabular-nums ${
                        isAlert ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-100'
                      }`}>{stock.quantity}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block leading-none">{stock.unit}</span>
                    </div>

                    <button
                      onClick={() => handleAdjustQuantity(stock, 1)}
                      disabled={adjustQuantityMutation.isPending}
                      className="w-11 h-11 rounded-lg flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Edit & Delete Actions */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleEditStock(stock)}
                      className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-violet-100 dark:hover:bg-violet-900/30 text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-all cursor-pointer"
                      title="แก้ไขข้อมูลวัสดุ"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteStock(stock.id)}
                      className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-all cursor-pointer"
                      title="ลบวัสดุออกจากคลัง"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stock Modal */}
      {user && (
        <StockModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          userId={user.id}
          stockToEdit={selectedStock}
          categories={categories}
        />
      )}

      {/* Stock History Modal */}
      <StockHistoryModal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  );
}
