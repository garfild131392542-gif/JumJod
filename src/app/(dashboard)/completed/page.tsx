'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { Item } from '@/lib/types';
import ConfirmDialog from '@/components/common/confirm-dialog';
import { 
  Search, FileText, CheckCircle2, Image as ImageIcon, 
  ExternalLink, Calendar, CheckSquare,
  Clock, AlertCircle, X, Trash2, Undo2
} from 'lucide-react';
import Image from 'next/image';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
dayjs.extend(localizedFormat);
dayjs.extend(isSameOrBefore);
dayjs.locale('th');

export default function CompletedItemsPage() {
  const { user } = useAuth();
  const supabase = createClient();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [auditedItems, setAuditedItems] = useState<Record<string, boolean>>({});
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedDetailItem, setSelectedDetailItem] = useState<Item | null>(null);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description?: string;
    confirmText?: string;
    variant?: 'danger' | 'warning' | 'primary' | 'success';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    onConfirm: () => {},
  });

  // Load audited state from localStorage (only runs on client)
  useEffect(() => {
    const saved = localStorage.getItem('audited_items');
    if (saved) {
      try {
        setAuditedItems(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const queryClient = useQueryClient();

  // Fetch Completed Items (status === 'Issuing Item') using TanStack Query
  const { data: items = [], isLoading, error, refetch } = useQuery<Item[]>({
    queryKey: ['items', 'completed'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('status', 'Issuing Item')
        .order('updated_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from('items').delete().eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: (_, itemId) => {
      const saved = localStorage.getItem('audited_items');
      if (saved) {
        try {
          const audited = JSON.parse(saved);
          delete audited[itemId];
          localStorage.setItem('audited_items', JSON.stringify(audited));
          setAuditedItems(audited);
        } catch (e) {
          console.error(e);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['items'] });
      refetch();
    },
    onError: (err: any) => {
      alert('เกิดข้อผิดพลาดในการลบรายการ: ' + (err?.message || ''));
    }
  });

  const handleDelete = (item: Item) => {
    setConfirmDialog({
      isOpen: true,
      title: 'ต้องการลบรายการนี้ใช่หรือไม่?',
      description: `คุณต้องการลบรายการ "${item.title}" ออกจากระบบใช่หรือไม่?`,
      confirmText: 'ลบรายการ',
      variant: 'danger',
      onConfirm: () => {
        deleteMutation.mutate(item.id);
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const toggleAudit = async (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    setConfirmDialog({
      isOpen: true,
      title: 'นำรายการกลับไปยังบอร์ด',
      description: `คุณต้องการนำรายการ "${item?.title || ''}" กลับไปยังบอร์ดรายการช่วยจำใช่หรือไม่?`,
      confirmText: 'นำกลับบอร์ด',
      variant: 'primary',
      onConfirm: async () => {
        const updates: any = { 
          status: 'Pending', 
          updated_at: new Date().toISOString() 
        };

        if (item?.reminder_date && new Date(item.reminder_date) > new Date()) {
          updates.reminder_sent = false;
        }

        const { error } = await supabase
          .from('items')
          .update(updates)
          .eq('id', itemId);

        if (error) {
          alert('เกิดข้อผิดพลาดในการนำรายการกลับไปยังบอร์ด: ' + error.message);
          return;
        }

        // Remove from auditedItems in localStorage
        const saved = localStorage.getItem('audited_items');
        if (saved) {
          try {
            const audited = JSON.parse(saved);
            delete audited[itemId];
            localStorage.setItem('audited_items', JSON.stringify(audited));
            setAuditedItems(audited);
          } catch (e) {
            console.error(e);
          }
        }

        queryClient.invalidateQueries({ queryKey: ['items'] });
        refetch();
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Filter items by search query
  const filteredItems = items.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-5 min-h-[85vh]">
      {/* Header Panel */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          ตรวจสอบรายการสำเร็จ (Completed Memos)
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          ประวัติการทวนสอบและตรวจสอบรายการบันทึกช่วยจำที่ดำเนินการเสร็จเรียบร้อยแล้ว (คลิกที่แถวเพื่อดูรายละเอียด)
        </p>
      </div>

      {/* Filter and Search Bar (Liquid-Glass) */}
      <div className="flex items-center gap-3 p-3 liquid-glass rounded-2xl shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อรายการสำเร็จ หรือคำอธิบาย..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/70 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-xs sm:text-sm text-slate-800 dark:text-slate-200"
          />
        </div>
      </div>

      {/* Completed Items Table */}
      {isLoading ? (
        <div className="h-[50vh] flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-400 font-semibold">กำลังโหลดประวัติการสำเร็จ...</span>
        </div>
      ) : error ? (
        <div className="h-[40vh] flex flex-col items-center justify-center text-center p-6 border border-red-200/50 dark:border-red-900/30 bg-red-500/5 dark:bg-red-950/10 rounded-2xl gap-3">
          <AlertCircle className="w-8 h-8 text-red-500 dark:text-red-400" />
          <h3 className="text-sm font-bold text-red-700 dark:text-red-200">เกิดข้อผิดพลาดในการโหลดรายการ</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{(error as any)?.message}</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="h-[40vh] border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center p-8 bg-white/5">
          <CheckCircle2 className="w-10 h-10 text-slate-400 dark:text-slate-600 mb-3" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-350">ยังไม่มีรายการสำเร็จ</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mt-1 leading-relaxed">
            รายการที่ถูกเปลี่ยนสถานะเป็น "สำเร็จ" จะแสดงรายการประวัติที่นี่เพื่อการตรวจสอบ
          </p>
        </div>
      ) : (
        <div className="liquid-glass rounded-2xl overflow-hidden shadow-xs border border-slate-200/80 dark:border-slate-800/80">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-slate-100/60 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800/80 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-3 w-16 text-center">คืนสถานะ</th>
                <th className="py-3.5 px-4">หัวข้อรายการ</th>
                <th className="py-3.5 px-4 w-36 hidden sm:table-cell">วันแจ้งเตือน</th>
                <th className="py-3.5 px-4 w-32 text-center">เอกสารแนบ</th>
                <th className="py-3.5 px-4 w-32 text-center">วันที่ทำสำเร็จ</th>
                <th className="py-3.5 px-3 w-16 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/50 text-slate-700 dark:text-slate-300">
              {filteredItems.map((item) => (
                <tr 
                  key={item.id}
                  onClick={() => setSelectedDetailItem(item)}
                  className="hover:bg-indigo-50/40 dark:hover:bg-slate-800/40 transition-colors duration-150 cursor-pointer group"
                  title="คลิกเพื่อดูรายละเอียดฉบับเต็ม"
                >
                  {/* Checkbox Audit column */}
                  <td className="py-3.5 px-3 text-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAudit(item.id);
                      }}
                      className="p-1.5 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                      title="นำรายการกลับไปยังบอร์ด"
                    >
                      <CheckSquare className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
                    </button>
                  </td>

                  {/* Title column */}
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span className="group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate max-w-[220px] sm:max-w-md">
                        {item.title}
                      </span>
                    </div>
                  </td>

                  {/* Reminder column */}
                  <td className="py-3.5 px-4 hidden sm:table-cell">
                    {item.reminder_date ? (
                      <span className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>{dayjs(item.reminder_date).format('DD/MM/YYYY')}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">ไม่ระบุ</span>
                    )}
                  </td>

                  {/* Attachment column */}
                  <td className="py-3.5 px-4 text-center">
                    {item.image_url ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedImage(item.image_url);
                        }}
                        className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold hover:underline cursor-pointer"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>เปิดดู</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-600">ไม่มีแนบ</span>
                    )}
                  </td>

                  {/* Date completed column */}
                  <td className="py-3.5 px-4 text-center text-slate-500 dark:text-slate-400 tabular-nums">
                    {dayjs(item.updated_at).format('DD/MM/YYYY')}
                  </td>

                  {/* Delete action column */}
                  <td className="py-3.5 px-3 text-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item);
                      }}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
                      title="ลบรายการ"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Liquid-Glass Detail Modal */}
      {selectedDetailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-md transition-opacity"
            onClick={() => setSelectedDetailItem(null)}
          />
          <div className="relative w-full max-w-lg liquid-glass-modal rounded-3xl p-5 sm:p-6 shadow-2xl z-10 animate-modal-pop space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800/80 pb-3 sm:pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                    รายการสำเร็จ (Completed)
                  </span>
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-snug">
                    {selectedDetailItem.title}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedDetailItem(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Details Content */}
            <div className="space-y-4 max-h-[58vh] overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                  รายละเอียดเนื้อหา
                </label>
                <div className="p-3.5 rounded-xl bg-white/70 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800/80 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap shadow-2xs">
                  {selectedDetailItem.description || <span className="italic text-slate-400">ไม่มีรายละเอียดเพิ่มเติม</span>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800/70">
                  <span className="text-[10px] font-semibold text-slate-400 block mb-0.5">วันแจ้งเตือน</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                    {selectedDetailItem.reminder_date ? dayjs(selectedDetailItem.reminder_date).format('DD/MM/YYYY HH:mm น.') : 'ไม่ระบุ'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800/70">
                  <span className="text-[10px] font-semibold text-slate-400 block mb-0.5">วันที่ทำสำเร็จ</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {dayjs(selectedDetailItem.updated_at).format('DD/MM/YYYY HH:mm น.')}
                  </span>
                </div>
              </div>

              {selectedDetailItem.image_url && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                    เอกสารแนบประกอบ
                  </label>
                  <div 
                    onClick={() => setSelectedImage(selectedDetailItem.image_url)}
                    className="relative w-full h-44 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 cursor-pointer group"
                  >
                    <Image
                      src={selectedDetailItem.image_url}
                      alt={selectedDetailItem.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 400px"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-slate-950/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold gap-1.5">
                      <ExternalLink className="w-4 h-4" />
                      <span>คลิกเพื่อขยายดูภาพเต็ม</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200/80 dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => {
                  const item = selectedDetailItem;
                  setSelectedDetailItem(null);
                  handleDelete(item);
                }}
                className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-500/10 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ลบ</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const id = selectedDetailItem.id;
                    setSelectedDetailItem(null);
                    toggleAudit(id);
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>นำกลับบอร์ด</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDetailItem(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                >
                  ปิด
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal for Attachment viewing */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm transition-opacity" 
            onClick={() => setSelectedImage(null)}
          />
          <div className="relative max-w-4xl max-h-[85vh] overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl z-10 flex flex-col p-2">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-950/70 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-900 transition-colors z-20 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="relative w-[80vw] h-[75vh] max-w-3xl rounded-lg overflow-hidden">
              <Image
                src={selectedImage}
                alt="Document attachment"
                fill
                sizes="80vw"
                className="object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Solid-Glass Confirm Dialog */}
      <ConfirmDialog
        {...confirmDialog}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
