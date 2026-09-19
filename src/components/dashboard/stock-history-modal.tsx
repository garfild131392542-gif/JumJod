'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, History, ArrowUpRight, ArrowDownLeft, Settings, Plus, Trash2, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

interface StockHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StockHistoryModal({ isOpen, onClose }: StockHistoryModalProps) {
  const supabase = createClient();
  const [searchQuery, setSearchQuery] = useState('');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Fetch transactions using react-query
  const { data: transactions = [], isLoading, error } = useQuery<any[]>({
    queryKey: ['stock-transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_transactions')
        .select(`
          id,
          type,
          quantity_changed,
          quantity_before,
          quantity_after,
          notes,
          created_at,
          stocks (
            name,
            unit
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    },
    enabled: isOpen,
  });

  if (!isOpen) return null;

  // Filter transactions by item name or notes
  const filteredTransactions = transactions.filter((tx) => {
    const itemName = tx.stocks?.name?.toLowerCase() || '';
    const notes = tx.notes?.toLowerCase() || '';
    const search = searchQuery.toLowerCase();
    return itemName.includes(search) || notes.includes(search);
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Soft Ambient Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Slide-Over Drawer Sheet (Solid-Glass) */}
      <div className="relative w-full max-w-full md:max-w-xl h-full solid-glass border-l border-slate-200/80 dark:border-slate-800/80 shadow-2xl flex flex-col animate-slide-left z-10 overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between shrink-0 bg-white/40 dark:bg-slate-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                ประวัติการเบิก-จ่าย & ปรับปรุงคลัง
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                รายการประวัติย้อนหลัง 100 รายการล่าสุด
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
            title="ปิดหน้าต่าง (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Filter Bar */}
        <div className="px-5 sm:px-6 py-3 bg-slate-100/60 dark:bg-slate-950/40 border-b border-slate-200/80 dark:border-slate-800/60 relative shrink-0">
          <Search className="absolute left-9 sm:left-10 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาตามชื่อวัสดุ หรือช่องทางทำรายการ..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-xs sm:text-sm text-slate-800 dark:text-slate-200 shadow-2xs"
          />
        </div>

        {/* Logs Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-3">
          {isLoading ? (
            <div className="h-48 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-7 h-7 text-indigo-500 animate-spin" />
              <span className="text-xs text-slate-400 font-semibold">กำลังดึงข้อมูลประวัติ...</span>
            </div>
          ) : error ? (
            <div className="flex items-start gap-2.5 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{(error as any)?.message || 'เกิดข้อผิดพลาดในการโหลดประวัติสต็อก'}</span>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center gap-2 text-slate-400">
              <History className="w-8 h-8 opacity-40" />
              <span className="text-xs font-semibold">ไม่พบข้อมูลประวัติทำรายการ</span>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredTransactions.map((tx) => {
                const date = new Date(tx.created_at).toLocaleString('th-TH', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                });
                
                // Styling based on Transaction Type
                let typeIcon = <Settings className="w-4 h-4" />;
                let typeColor = 'bg-slate-100 text-slate-650 dark:bg-slate-800 dark:text-slate-400';
                let qtyDisplay = `${tx.quantity_changed}`;

                if (tx.type === 'ADD') {
                  typeIcon = <ArrowUpRight className="w-4 h-4" />;
                  typeColor = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-450';
                  qtyDisplay = `+${tx.quantity_changed}`;
                } else if (tx.type === 'SUBTRACT') {
                  typeIcon = <ArrowDownLeft className="w-4 h-4" />;
                  typeColor = 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-450';
                  qtyDisplay = `-${tx.quantity_changed}`;
                } else if (tx.type === 'CREATE') {
                  typeIcon = <Plus className="w-4 h-4" />;
                  typeColor = 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400';
                  qtyDisplay = `+${tx.quantity_changed}`;
                } else if (tx.type === 'DELETE') {
                  typeIcon = <Trash2 className="w-4 h-4" />;
                  typeColor = 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400';
                  qtyDisplay = `-${tx.quantity_changed}`;
                }

                const itemName = tx.stocks?.name || '(วัสดุถูกลบแล้ว)';
                const itemUnit = tx.stocks?.unit || 'ชิ้น';

                return (
                  <div
                    key={tx.id}
                    className="p-3.5 rounded-xl solid-glass hover-glass-lift flex items-center justify-between gap-3 border border-slate-200/70 dark:border-slate-800/70"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Icon type */}
                      <div className={`p-2 rounded-xl shrink-0 ${typeColor}`}>
                        {typeIcon}
                      </div>

                      {/* Info text */}
                      <div className="min-w-0">
                        <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 block truncate">
                          {itemName}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 tabular-nums">
                            {date}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate max-w-[150px]">
                            {tx.notes || 'ไม่มีหมายเหตุ'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Change quantity */}
                    <div className="text-right shrink-0">
                      <span className={`text-xs sm:text-sm font-black tabular-nums ${
                        tx.type === 'ADD' || tx.type === 'CREATE'
                          ? 'text-emerald-600 dark:text-emerald-450'
                          : tx.type === 'SUBTRACT' || tx.type === 'DELETE'
                          ? 'text-rose-600 dark:text-rose-450'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}>
                        {qtyDisplay} {itemUnit}
                      </span>
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium block mt-0.5 tabular-nums">
                        คงเหลือ: {tx.quantity_after} {itemUnit}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
