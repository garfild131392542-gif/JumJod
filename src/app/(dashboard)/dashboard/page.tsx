'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { Item, ItemStatus, Profile } from '@/lib/types';
import ItemModal from '@/components/dashboard/item-modal';
import {
  Plus, Search, Edit2, Trash2, Calendar,
  Image as ImageIcon, FileText, Clock, AlertCircle, CheckCircle2
} from 'lucide-react';
import Image from 'next/image';

export default function DashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const supabase = createClient();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  // Toast and audited items states
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);
  const [auditedItems, setAuditedItems] = useState<Record<string, boolean>>({});

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

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
    const timer = setTimeout(() => {
      setToast(null);
    }, 4000);
    return () => clearTimeout(timer);
  };

  // Realtime subscription for items
  useEffect(() => {
    const channel = supabase
      .channel('realtime_items_dashboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items'
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['items'] });

          if (payload.eventType === 'INSERT') {
            const newItem = payload.new as Item;
            showToast(`➕ บันทึกรายการใหม่: "${newItem.title}" จาก LINE Bot!`, 'info');
          } else if (payload.eventType === 'UPDATE') {
            const updatedItem = payload.new as Item;
            const oldItem = payload.old as Item;
            if (oldItem && oldItem.status !== updatedItem.status) {
              const statusName = updatedItem.status === 'Pending' ? 'กำลังดำเนินการ' : 'สำเร็จ';
              showToast(`🔄 อัปเดตรายการ: "${updatedItem.title}" เป็น "${statusName}"`, 'info');
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, queryClient]);

  // Fetch user profile
  const { data: profile, refetch: refetchProfile } = useQuery<Profile>({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Link code generation mutation
  const generateLinkCodeMutation = useMutation({
    mutationFn: async () => {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from('profiles')
        .update({
          link_code: code,
          link_code_expires_at: expiresAt,
          updated_at: new Date().toISOString()
        })
        .eq('id', user?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      refetchProfile();
    },
  });

  // Fetch Items using React Query
  const { data: items = [], isLoading, error } = useQuery<Item[]>({
    queryKey: ['items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('created_at', { ascending: false });

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });

  // Move Status Mutation
  const moveStatusMutation = useMutation({
    mutationFn: async ({ itemId, nextStatus }: { itemId: string; nextStatus: ItemStatus }) => {
      const updates: Partial<Item> = {
        status: nextStatus,
        updated_at: new Date().toISOString()
      };

      const currentItem = items.find(i => i.id === itemId);

      const { error } = await supabase
        .from('items')
        .update(updates)
        .eq('id', itemId);

      if (error) throw error;

      return {
        title: currentItem?.title || '',
        nextStatus,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      showToast('ย้ายรายการไปยังห้องประวัติสำเร็จเรียบร้อยแล้ว');
    },
  });

  const handleDeleteItem = (itemId: string) => {
    if (confirm('คุณต้องการลบรายการจดบันทึกนี้ใช่หรือไม่?')) {
      deleteMutation.mutate(itemId);
    }
  };

  const handleCompleteItem = (item: Item) => {
    if (confirm(`คุณต้องการบันทึกความสำเร็จรายการ "${item.title}" ใช่หรือไม่?\n(รายการจะถูกย้ายไปยังหน้าประวัติสำเร็จ)`)) {
      moveStatusMutation.mutate(
        { itemId: item.id, nextStatus: 'Issuing Item' },
        {
          onSuccess: () => {
            const saved = localStorage.getItem('audited_items');
            let audited: Record<string, boolean> = {};
            if (saved) {
              try { audited = JSON.parse(saved); } catch (e) {}
            }
            audited[item.id] = true;
            localStorage.setItem('audited_items', JSON.stringify(audited));
            setAuditedItems(audited);
            showToast(`🎉 ยินดีด้วย! บันทึกความสำเร็จรายการ "${item.title}" เรียบร้อยแล้ว`);
          }
        }
      );
    }
  };

  const handleEditItem = (item: Item) => {
    setSelectedItem(item);
    setModalOpen(true);
  };

  const handleAddItem = () => {
    setSelectedItem(null);
    setModalOpen(true);
  };

  const isImageFile = (url: string | null) => {
    if (!url) return false;
    const ext = url.split('.').pop()?.toLowerCase();
    return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext || '');
  };

  // Filter items by search query and exclude completed (audited) items
  const filteredItems = items.filter(
    (item) =>
      !auditedItems[item.id] &&
      (item.status === 'Pending' || item.status === 'Purchasing') &&
      (item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  // Sort items: earliest reminder_date first
  filteredItems.sort((a, b) => {
    if (a.reminder_date && b.reminder_date) {
      return new Date(a.reminder_date).getTime() - new Date(b.reminder_date).getTime();
    }
    if (a.reminder_date) return -1;
    if (b.reminder_date) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:via-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
            บันทึกช่วยจำ
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            ระบบบันทึกช่วยจำและตั้งเวลาแจ้งเตือนส่วนตัว
          </p>
        </div>
        <button
          onClick={handleAddItem}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm shadow-lg shadow-indigo-600/10 active:scale-[0.98] transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>จดบันทึก</span>
        </button>
      </div>

      {/* LINE Connection Banner */}
      {profile && (
        <div className="backdrop-blur-sm bg-white dark:bg-slate-900/35 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 11.5c0-5.247-5.383-9.5-12-9.5C5.383 2 0 6.253 0 11.5c0 4.697 4.283 8.637 10.094 9.398-.393.818-1.547 3.398-1.77 4.398-.225 1.002.404.99 1.077.545C10.027 25.39 15.016 20.35 17.5 17.5c4.15-1.047 6.5-3.663 6.5-6m-13.62 3.125c-.562 0-1.018-.456-1.018-1.018v-4.8c0-.562.456-1.018 1.018-1.018s1.018.456 1.018 1.018v4.8c0 .562-.456 1.018-1.018 1.018m3.93 0c-.562 0-1.018-.456-1.018-1.018v-4.8c0-.562.456-1.018 1.018-1.018s1.018.456 1.018 1.018v2.215h1.764v-2.215c0-.562.456-1.018 1.018-1.018s1.018.456 1.018 1.018v4.8c0 .562-.456 1.018-1.018 1.018s-1.018-.456-1.018-1.018v-1.579h-1.764v1.579c0 .562-.456 1.018-1.018 1.018m5.603 0c-.562 0-1.018-.456-1.018-1.018v-4.8c0-.562.456-1.018 1.018-1.018.562 0 1.018.456 1.018 1.018v4.8c0 .562-.456 1.018-1.018 1.018" />
              </svg>
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                เชื่อมต่อผู้ช่วย LINE Bot (LINE Assistant Link)
              </h4>
              {profile.line_user_id ? (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                  🟢 บัญชี LINE เชื่อมต่อแล้ว! สั่งจำจดพิมพ์บอกบอททางแชตได้ทุกที่
                </p>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  เชื่อมต่อเพื่อสั่งบันทึกการช่วยจำหรือแจ้งเตือนเครดิตผ่านข้อความ LINE
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {!profile.line_user_id && (
              <>
                {profile.link_code && new Date(profile.link_code_expires_at!) > new Date() ? (
                  <div className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center gap-3">
                    <div>
                      <span className="text-[9px] text-slate-500 block uppercase font-extrabold leading-none mb-1">รหัสส่งหาไลน์บอท:</span>
                      <span className="text-sm font-extrabold text-violet-600 dark:text-violet-400 select-all tracking-widest">{profile.link_code}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 border-l border-slate-200 dark:border-slate-800 pl-3">
                      พิมพ์ส่งบอท:<br />
                      <code className="text-violet-600 dark:text-violet-400 font-bold select-all">#link {profile.link_code}</code>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => generateLinkCodeMutation.mutate()}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-violet-600/10 dark:bg-violet-600/20 border border-violet-200 dark:border-violet-500/30 text-violet-600 dark:text-violet-400 hover:bg-violet-600/20 dark:hover:bg-violet-600/30 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    รับรหัสเชื่อมต่อ LINE
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 p-3 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl backdrop-blur-sm shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อรายการ หรือคำอธิบาย..."
            className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-slate-100/50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 focus:border-violet-500 dark:focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-all text-sm text-slate-800 dark:text-slate-200"
          />
        </div>
      </div>

      {/* Main Kanban Board (Single Column List) */}
      {isLoading ? (
        <div className="h-[60vh] flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-400 font-semibold">กำลังดึงข้อมูล...</span>
        </div>
      ) : error ? (
        <div className="h-[40vh] flex flex-col items-center justify-center text-center p-6 border border-red-200/50 dark:border-red-900/30 bg-red-500/5 dark:bg-red-950/10 rounded-2xl gap-3">
          <AlertCircle className="w-8 h-8 text-red-500 dark:text-red-400" />
          <h3 className="text-sm font-bold text-red-700 dark:text-red-200">เกิดข้อผิดพลาดในการโหลดบอร์ดรายการ</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{(error as any)?.message || 'โปรดตรวจสอบสิทธิ์เชื่อมต่อหรือรีเฟรชหน้าเว็บ'}</p>
        </div>
      ) : (
        <div className="w-full flex flex-col rounded-2xl min-h-[60vh] p-4 bg-slate-100/40 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800/50">
          {/* Title */}
          <div className="mb-4 pb-3 border-b border-slate-200 dark:border-slate-800/50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider bg-violet-500/10 text-violet-600 dark:text-violet-400">
                  {filteredItems.length}
                </span>
                <span>รายการกำลังดำเนินการ (Active Memos)</span>
              </h3>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 content-start">
            {filteredItems.length === 0 ? (
              <div className="col-span-full h-32 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl flex items-center justify-center text-center p-4">
                <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">ไม่มีรายการจดบันทึกในขณะนี้</span>
              </div>
            ) : (
              filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="group relative backdrop-blur-sm bg-white dark:bg-slate-900/55 border border-slate-200 dark:border-slate-800/80 rounded-xl p-4 shadow-sm hover:shadow-md dark:shadow-none hover:border-slate-400 dark:hover:border-slate-700/80 transition-all duration-200 flex flex-col justify-between gap-3"
                >
                  {/* File Attachment Preview */}
                  {item.image_url && (
                    isImageFile(item.image_url) ? (
                      <div className="relative w-full h-36 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 mb-2 shrink-0">
                        <Image
                          src={item.image_url}
                          alt={item.title}
                          fill
                          sizes="(max-width: 768px) 100vw, 30vw"
                          className="object-cover transition-transform duration-300 group-hover:scale-102"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-55 dark:bg-slate-950/40 mb-2 shrink-0">
                        <FileText className="w-6 h-6 text-violet-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[9px] text-slate-500 uppercase font-extrabold leading-none">เอกสารแนบ</p>
                          <a
                            href={item.image_url}
                            target="_blank; noreferrer"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline truncate block mt-1"
                          >
                            เปิดดูไฟล์แนบ
                          </a>
                        </div>
                      </div>
                    )
                  )}

                  {/* Title and Description */}
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 group-hover:text-violet-600 dark:group-hover:text-violet-300 transition-colors line-clamp-1 flex-1">
                        {item.title}
                      </h4>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[9px] font-extrabold text-slate-500 select-all shrink-0">
                        #{item.id.substring(item.id.length - 3)}
                      </span>
                    </div>
                    {item.description && (
                      <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>

                  {/* Reminder Badge */}
                  {item.reminder_date && (
                    <div className="flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/5 px-2 py-0.5 rounded-md w-fit font-semibold border border-amber-500/10">
                      <Clock className="w-3.5 h-3.5" />
                      <span>แจ้งเตือน: {new Date(item.reminder_date).toLocaleDateString('en-GB')}</span>
                    </div>
                  )}

                  {/* Controls & Actions */}
                  <div className="flex items-center justify-end mt-1 pt-1.5 border-t border-slate-100 dark:border-slate-800/40">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCompleteItem(item)}
                        className="p-1 rounded-md bg-slate-100 dark:bg-slate-800/50 hover:bg-emerald-100 dark:hover:bg-emerald-655/30 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-450 transition-colors cursor-pointer"
                        title="ทำเครื่องหมายว่าสำเร็จ"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleEditItem(item)}
                        className="p-1 rounded-md bg-slate-100 dark:bg-slate-800/50 hover:bg-violet-100 dark:hover:bg-violet-650/30 text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-300 transition-colors cursor-pointer"
                        title="แก้ไขรายการ"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-1 rounded-md bg-slate-100 dark:bg-slate-800/50 hover:bg-red-100 dark:hover:bg-red-650/30 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-455 transition-colors cursor-pointer"
                        title="ลบรายการ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Form Modal */}
      {user && (
        <ItemModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          userId={user.id}
          itemToEdit={selectedItem}
        />
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4.5 py-3 rounded-2xl border text-sm font-bold shadow-xl animate-fade-in-up ${
          toast.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-650 dark:text-emerald-400'
            : 'bg-indigo-500/10 border-indigo-500/25 text-indigo-650 dark:text-indigo-400'
        }`}>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
