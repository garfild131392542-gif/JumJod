'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { PrRequest, PrStatus } from '@/lib/types';
import {
  FileText,
  Plus,
  Search,
  Edit2,
  Trash2,
  Copy,
  Check,
  Clock,
  CheckCircle2,
  FileCheck,
  AlertCircle,
  Calendar,
  Tag,
  Hash,
  ArrowUpDown,
  Filter
} from 'lucide-react';
import PrModal from '@/components/dashboard/pr-modal';

export default function PrTrackerPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const supabase = createClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | PrStatus>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'title-asc'>('date-desc');
  
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPr, setSelectedPr] = useState<PrRequest | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch PR requests using React Query
  const { data: prRequests = [], isLoading, error } = useQuery<PrRequest[]>({
    queryKey: ['pr-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pr_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pr_requests')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pr-requests'] });
    },
  });

  // Quick copy helper
  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(key);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter & Search Logic
  const filteredPrs = prRequests.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.pr_no && item.pr_no.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.po_no && item.po_no.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.qt_no && item.qt_no.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.notes && item.notes.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = filterStatus === 'all' || item.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  // Sorting
  const sortedPrs = [...filteredPrs].sort((a, b) => {
    if (sortBy === 'date-desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sortBy === 'date-asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (sortBy === 'title-asc') return a.title.localeCompare(b.title, 'th');
    return 0;
  });

  // Stats calculation
  const totalCount = prRequests.length;
  const pendingCount = prRequests.filter((p) => p.status === 'Pending').length;
  const prIssuedCount = prRequests.filter((p) => p.status === 'PR Issued').length;
  const poIssuedCount = prRequests.filter((p) => p.status === 'PO Issued').length;
  const completedCount = prRequests.filter((p) => p.status === 'Completed').length;

  const getStatusBadge = (status: PrStatus) => {
    switch (status) {
      case 'Pending':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1.5 shrink-0">
            <Clock className="w-3.5 h-3.5" />
            <span>รอเลข PR</span>
          </span>
        );
      case 'PR Issued':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1.5 shrink-0">
            <FileText className="w-3.5 h-3.5" />
            <span>ออก PR แล้ว</span>
          </span>
        );
      case 'PO Issued':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center gap-1.5 shrink-0">
            <FileCheck className="w-3.5 h-3.5" />
            <span>ออก PO แล้ว</span>
          </span>
        );
      case 'Completed':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>เสร็จสมบูรณ์</span>
          </span>
        );
    }
  };

  const formatDate = (isoStr: string) => {
    if (!isoStr) return '-';
    const date = new Date(isoStr);
    return date.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (isoStr: string) => {
    if (!isoStr) return '';
    const date = new Date(isoStr);
    return date.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-600 dark:text-violet-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                ระบบติดตามการออก PR
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                ติดตามหัวข้อสั่งซื้อ, เลข PR, เลข PO, เลข QT และวันที่ทำรายการในระบบ
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setSelectedPr(null);
            setModalOpen(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow-lg shadow-violet-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>เพิ่มรายการเปิด PR ใหม่</span>
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 backdrop-blur-sm shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            ทั้งหมด (Total)
          </p>
          <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{totalCount}</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 backdrop-blur-sm shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            รอเลข PR
          </p>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{pendingCount}</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 backdrop-blur-sm shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            ออก PR แล้ว
          </p>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{prIssuedCount}</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 backdrop-blur-sm shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
            ออก PO แล้ว
          </p>
          <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">{poIssuedCount}</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 backdrop-blur-sm shadow-sm col-span-2 md:col-span-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            เสร็จสมบูรณ์
          </p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{completedCount}</p>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 backdrop-blur-sm shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อหัวข้อ, เลข PR, เลข PO, เลข QT..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-violet-500 font-medium"
          />
        </div>

        {/* Filters & Sorting */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="all">ทุกสถานะ (All Status)</option>
              <option value="Pending">⏳ รอเลข PR</option>
              <option value="PR Issued">📄 ออก PR แล้ว</option>
              <option value="PO Issued">📑 ออก PO แล้ว</option>
              <option value="Completed">✅ เสร็จสมบูรณ์</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="date-desc">วันที่สร้าง (ใหม่ไปเก่า)</option>
              <option value="date-asc">วันที่สร้าง (เก่าไปใหม่)</option>
              <option value="title-asc">ชื่อหัวข้อ (ก-ฮ)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table / List View */}
      {isLoading ? (
        <div className="min-h-[300px] flex items-center justify-center p-8 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold">กำลังโหลดรายการติดตาม PR...</p>
          </div>
        </div>
      ) : sortedPrs.length === 0 ? (
        <div className="min-h-[300px] flex flex-col items-center justify-center p-8 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
            ไม่พบรายการติดตาม PR
          </h3>
          <p className="text-xs text-slate-500 max-w-xs mt-1">
            {searchQuery || filterStatus !== 'all'
              ? 'ลองเปลี่ยนคำค้นหาหรือตัวกรองสถานะ'
              : 'กดปุ่ม "เพิ่มรายการเปิด PR ใหม่" ด้านบน หรือพิมพ์สั่งผ่าน LINE ได้เลย'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {sortedPrs.map((item) => {
            const shortId = item.id.substring(item.id.length - 4);
            return (
              <div
                key={item.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 hover:border-violet-500/40 backdrop-blur-sm shadow-sm transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4 group"
              >
                {/* Left Info: Title & Meta */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getStatusBadge(item.status)}
                    <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                      #{shortId}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{formatDate(item.created_at)}</span>
                      <span className="text-[10px] text-slate-400">({formatTime(item.created_at)})</span>
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 leading-snug">
                    {item.title}
                  </h3>

                  {item.notes && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-200/50 dark:border-slate-800/60 leading-relaxed whitespace-pre-wrap">
                      {item.notes}
                    </p>
                  )}
                </div>

                {/* Middle Info: PR / PO / QT Numbers */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-950/80 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800/60 shrink-0 min-w-[280px]">
                  {/* PR No */}
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      เลข PR
                    </span>
                    {item.pr_no ? (
                      <button
                        onClick={() => handleCopy(item.pr_no!, `pr_${item.id}`)}
                        className="flex items-center gap-1 text-xs font-mono font-bold text-violet-600 dark:text-violet-400 hover:underline mt-0.5 cursor-pointer text-left truncate"
                        title="คลิกเพื่อคัดลอก"
                      >
                        <span className="truncate">{item.pr_no}</span>
                        {copiedId === `pr_${item.id}` ? (
                          <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                        ) : (
                          <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        )}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-slate-600 italic mt-0.5">
                        - (ยังไม่ระบุ)
                      </span>
                    )}
                  </div>

                  {/* PO No */}
                  <div className="flex flex-col border-l border-slate-200 dark:border-slate-800 pl-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      เลข PO
                    </span>
                    {item.po_no ? (
                      <button
                        onClick={() => handleCopy(item.po_no!, `po_${item.id}`)}
                        className="flex items-center gap-1 text-xs font-mono font-bold text-purple-600 dark:text-purple-400 hover:underline mt-0.5 cursor-pointer text-left truncate"
                        title="คลิกเพื่อคัดลอก"
                      >
                        <span className="truncate">{item.po_no}</span>
                        {copiedId === `po_${item.id}` ? (
                          <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                        ) : (
                          <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        )}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-slate-600 italic mt-0.5">
                        - (ยังไม่ระบุ)
                      </span>
                    )}
                  </div>

                  {/* QT No */}
                  <div className="flex flex-col border-l border-slate-200 dark:border-slate-800 pl-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      เลข QT
                    </span>
                    {item.qt_no ? (
                      <button
                        onClick={() => handleCopy(item.qt_no!, `qt_${item.id}`)}
                        className="flex items-center gap-1 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 hover:underline mt-0.5 cursor-pointer text-left truncate"
                        title="คลิกเพื่อคัดลอก"
                      >
                        <span className="truncate">{item.qt_no}</span>
                        {copiedId === `qt_${item.id}` ? (
                          <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                        ) : (
                          <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        )}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-slate-600 italic mt-0.5">
                        - (ยังไม่ระบุ)
                      </span>
                    )}
                  </div>
                </div>

                {/* Right Action Buttons */}
                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                  <button
                    onClick={() => {
                      setSelectedPr(item);
                      setModalOpen(true);
                    }}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-violet-600 hover:text-white dark:hover:bg-violet-600 dark:hover:text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">แก้ไข/เติมเลข</span>
                  </button>

                  <button
                    onClick={() => {
                      if (confirm(`คุณต้องการลบรายการ PR "${item.title}" ใช่หรือไม่?`)) {
                        deleteMutation.mutate(item.id);
                      }
                    }}
                    className="p-2 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white transition-all cursor-pointer"
                    title="ลบรายการ"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Component */}
      <PrModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedPr(null);
        }}
        userId={user?.id || ''}
        prToEdit={selectedPr}
      />
    </div>
  );
}
