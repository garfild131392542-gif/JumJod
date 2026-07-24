'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { LabCalibration, CalStatus } from '@/lib/types';
import {
  Scale,
  Plus,
  Search,
  Edit2,
  Trash2,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Filter,
  ArrowUpDown,
  AlertCircle,
  FileText
} from 'lucide-react';
import CalibrationModal from '@/components/dashboard/calibration-modal';

export default function CalibrationPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const supabase = createClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | CalStatus>('all');
  const [sortBy, setSortBy] = useState<'next-asc' | 'next-desc' | 'name-asc'>('next-asc');
  
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCal, setSelectedCal] = useState<LabCalibration | null>(null);

  // Fetch calibrations
  const { data: calibrations = [], isLoading, error } = useQuery<LabCalibration[]>({
    queryKey: ['lab-calibrations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lab_calibrations')
        .select('*')
        .order('next_cal_date', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('lab_calibrations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-calibrations'] });
    },
  });

  // Helper to determine status based on next_cal_date
  const getCalStatus = (nextCalDateStr: string): CalStatus => {
    if (!nextCalDateStr) return 'Normal';
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const nextDate = new Date(nextCalDateStr);
    nextDate.setHours(0, 0, 0, 0);

    const diffTime = nextDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Overdue';
    if (diffDays <= 14) return 'Due Soon';
    return 'Normal';
  };

  // Helper formatting for Thai dates
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'ไม่ระบุ';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Filter & Search Logic
  const filteredCals = calibrations.filter((item) => {
    const status = getCalStatus(item.next_cal_date);
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.notes && item.notes.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = filterStatus === 'all' || status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  // Sorting
  const sortedCals = [...filteredCals].sort((a, b) => {
    if (sortBy === 'next-asc') return new Date(a.next_cal_date).getTime() - new Date(b.next_cal_date).getTime();
    if (sortBy === 'next-desc') return new Date(b.next_cal_date).getTime() - new Date(a.next_cal_date).getTime();
    if (sortBy === 'name-asc') return a.name.localeCompare(b.name, 'th');
    return 0;
  });

  // Summary counts
  const totalCount = calibrations.length;
  const overdueCount = calibrations.filter((c) => getCalStatus(c.next_cal_date) === 'Overdue').length;
  const dueSoonCount = calibrations.filter((c) => getCalStatus(c.next_cal_date) === 'Due Soon').length;
  const normalCount = calibrations.filter((c) => getCalStatus(c.next_cal_date) === 'Normal').length;

  const getStatusBadge = (status: CalStatus) => {
    switch (status) {
      case 'Overdue':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center gap-1.5 shrink-0 animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>🔴 เกินกำหนด Cal</span>
          </span>
        );
      case 'Due Soon':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1.5 shrink-0">
            <Clock className="w-3.5 h-3.5" />
            <span>🟡 ใกล้ถึงวัน Cal (ใน 14 วัน)</span>
          </span>
        );
      case 'Normal':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>🟢 ปกติ</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-600/10 border border-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                ระบบติดตามรอบ Calibrate เครื่องมือ
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                ติดตามวันสอบเทียบเครื่องชั่งและเครื่องมือวัด แผนก Lab
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setSelectedCal(null);
            setModalOpen(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-lg shadow-teal-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>เพิ่มเครื่องมือ / เครื่องชั่งใหม่</span>
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 backdrop-blur-sm shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            เครื่องมือทั้งหมด
          </p>
          <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{totalCount}</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 backdrop-blur-sm shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            สถานะปกติ
          </p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{normalCount}</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 backdrop-blur-sm shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            ใกล้ถึงวัน Cal (ใน 14 วัน)
          </p>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{dueSoonCount}</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 backdrop-blur-sm shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
            เกินกำหนด Cal
          </p>
          <p className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">{overdueCount}</p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 backdrop-blur-sm shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อเครื่องมือ, เครื่องชั่ง, หมายเหตุ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-teal-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="all">ทุกสถานะ (All Status)</option>
              <option value="Normal">🟢 ปกติ</option>
              <option value="Due Soon">🟡 ใกล้ถึงวัน Cal</option>
              <option value="Overdue">🔴 เกินกำหนด Cal</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="next-asc">วัน Cal ถัดไป (เร็วไปช้า)</option>
              <option value="next-desc">วัน Cal ถัดไป (ช้าไปเร็ว)</option>
              <option value="name-asc">ชื่อเครื่องมือ (ก-ฮ)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid / List View (Displaying the 3 required fields prominently) */}
      {isLoading ? (
        <div className="min-h-[300px] flex items-center justify-center p-8 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold">กำลังโหลดข้อมูล Calibrate เครื่องมือ...</p>
          </div>
        </div>
      ) : sortedCals.length === 0 ? (
        <div className="min-h-[300px] flex flex-col items-center justify-center p-8 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
            <Scale className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
            ไม่พบรายการเครื่องมือวัด / เครื่องชั่ง
          </h3>
          <p className="text-xs text-slate-500 max-w-xs mt-1">
            {searchQuery || filterStatus !== 'all'
              ? 'ลองเปลี่ยนคำค้นหาหรือตัวกรองสถานะ'
              : 'กดปุ่ม "เพิ่มเครื่องมือ / เครื่องชั่งใหม่" ด้านบน หรือจดผ่าน LINE ได้เลย'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedCals.map((item) => {
            const status = getCalStatus(item.next_cal_date);

            return (
              <div
                key={item.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 hover:border-teal-500/40 backdrop-blur-sm shadow-sm transition-all duration-200 flex flex-col justify-between space-y-4 group"
              >
                {/* 1. NAME (ชื่อเครื่องมือ) & STATUS */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    {getStatusBadge(status)}
                    <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                      #LAB-{item.id.substring(item.id.length - 4)}
                    </span>
                  </div>

                  <div className="flex items-start gap-2 pt-1">
                    <Scale className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 leading-snug">
                      1. {item.name}
                    </h3>
                  </div>

                  {item.notes && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-200/50 dark:border-slate-800/60 leading-relaxed whitespace-pre-wrap">
                      {item.notes}
                    </p>
                  )}
                </div>

                {/* 2 & 3. CORE DISPLAY VALUES: Last Cal & Next Cal */}
                <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-950/80 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
                  {/* 2. Last Cal */}
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      2. ครั้งก่อนส่ง Cal
                    </span>
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{formatDate(item.last_cal_date)}</span>
                    </span>
                  </div>

                  {/* 3. Next Cal */}
                  <div className="flex flex-col border-l border-slate-200 dark:border-slate-800 pl-3">
                    <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider">
                      3. ครั้งถัดไปที่จะ Cal
                    </span>
                    <span className="text-xs font-bold text-teal-600 dark:text-teal-400 mt-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                      <span>{formatDate(item.next_cal_date)}</span>
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                  <button
                    onClick={() => {
                      setSelectedCal(item);
                      setModalOpen(true);
                    }}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-teal-600 hover:text-white dark:hover:bg-teal-600 dark:hover:text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>แก้ไขวันที่</span>
                  </button>

                  <button
                    onClick={() => {
                      if (confirm(`คุณต้องการลบเครื่องมือ "${item.name}" ใช่หรือไม่?`)) {
                        deleteMutation.mutate(item.id);
                      }
                    }}
                    className="p-2 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white transition-all cursor-pointer"
                    title="ลบเครื่องมือ"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <CalibrationModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedCal(null);
        }}
        userId={user?.id || ''}
        calToEdit={selectedCal}
      />
    </div>
  );
}
