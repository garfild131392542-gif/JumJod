'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dayjsLocalizer, Event as CalendarEvent } from 'react-big-calendar';
import dynamic from 'next/dynamic';

const BigCalendar = dynamic(
  () => import('react-big-calendar').then((mod) => mod.Calendar),
  { ssr: false }
);
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
dayjs.extend(localizedFormat);
dayjs.extend(isSameOrBefore);
dayjs.locale('th');

import 'react-big-calendar/lib/css/react-big-calendar.css';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { useTheme } from '@/components/providers/theme-provider';
import { Item, ItemStatus } from '@/lib/types';
import ItemModal from '@/components/dashboard/item-modal';
import { 
  X, Calendar as CalendarIcon, Clock, 
  FileText, Image as ImageIcon, AlertCircle, Trash2,
  Maximize2, Minimize2, RotateCw, Plus,
  Check, CheckCircle2, Circle, Edit2, ListFilter, CalendarCheck, CheckSquare
} from 'lucide-react';
import Image from 'next/image';

// Configure moment to use Thai locale


// Configure localizer for React Big Calendar
const localizer = dayjsLocalizer(dayjs);

const calendarFormats = {
  dateFormat: 'D',
  dayFormat: (date: Date) => dayjs(date).format('ddd'),
  weekdayFormat: (date: Date) => dayjs(date).format('ddd'),
  monthHeaderFormat: (date: Date) => dayjs(date).format('MMMM YYYY'),
  dayHeaderFormat: (date: Date) => dayjs(date).format('dddd D MMMM YYYY'),
  dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
    `${dayjs(start).format('D MMMM')} - ${dayjs(end).format('D MMMM YYYY')}`,
};

interface CustomEvent extends CalendarEvent {
  id: string;
  type: 'reminder' | 'completed';
  item: Item;
}

interface ToolbarProps {
  label: string;
  onNavigate: (navigate: 'PREV' | 'NEXT' | 'TODAY') => void;
  onView: (view: 'month' | 'week' | 'day') => void;
  view: string;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
}

const CustomToolbar = ({ label, onNavigate, onView, view, onToggleFullscreen, isFullscreen }: ToolbarProps) => {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 mb-3 p-2.5 sm:p-3.5 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-xs backdrop-blur-sm">
      {/* Navigation Controls */}
      <div className="flex items-center justify-between sm:justify-start gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onNavigate('TODAY')}
            className="px-3 py-1.5 text-xs font-extrabold rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer shadow-xs"
          >
            วันนี้
          </button>
          <button
            type="button"
            onClick={() => onNavigate('PREV')}
            className="w-8 h-8 flex items-center justify-center text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer shadow-xs"
            title="เดือนก่อนหน้า"
          >
            ◀
          </button>
          <button
            type="button"
            onClick={() => onNavigate('NEXT')}
            className="w-8 h-8 flex items-center justify-center text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer shadow-xs"
            title="เดือนถัดไป"
          >
            ▶
          </button>
        </div>

        <span className="sm:hidden text-sm font-extrabold text-slate-800 dark:text-slate-100 tracking-tight capitalize">
          {label}
        </span>

        {/* Mobile Fullscreen Toggle Button */}
        {onToggleFullscreen && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            className={`sm:hidden p-1.5 rounded-xl border transition-transform active:scale-90 cursor-pointer ${
              isFullscreen
                ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/60'
                : 'bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800/60'
            }`}
            title={isFullscreen ? 'ย่อหน้าต่างกลับ' : 'ขยายเต็มจอ'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Center Month Label (Desktop) */}
      <span className="hidden sm:block text-base font-extrabold text-slate-800 dark:text-slate-100 tracking-tight text-center capitalize">
        {label}
      </span>

      {/* View Selectors & Desktop Expand Button */}
      <div className="flex items-center justify-center sm:justify-end gap-1.5">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0">
          {(['month', 'week', 'day'] as const).map((v) => {
            const isActive = view === v;
            let labelText = '';
            if (v === 'month') labelText = 'เดือน';
            if (v === 'week') labelText = 'สัปดาห์';
            if (v === 'day') labelText = 'วัน';

            return (
              <button
                key={v}
                type="button"
                onClick={() => onView(v)}
                className={`px-3.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white dark:bg-slate-900 text-violet-600 dark:text-violet-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                }`}
              >
                {labelText}
              </button>
            );
          })}
        </div>

        {/* Desktop Expand Button */}
        {onToggleFullscreen && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-xs ${
              isFullscreen
                ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/60 hover:bg-red-100'
                : 'bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800/60 hover:bg-violet-100 dark:hover:bg-violet-900/50'
            }`}
            title={isFullscreen ? 'ย่อหน้าต่างกลับ' : 'ขยายเต็มจอ'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{isFullscreen ? 'ย่อกลับ' : 'ขยายเต็มจอ'}</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default function CalendarPage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const supabase = createClient();
  const queryClient = useQueryClient();
  
  // Selected event state for detail drawer
  const [selectedEvent, setSelectedEvent] = useState<CustomEvent | null>(null);

  // Selected day state for daily tasks modal
  const [selectedDay, setSelectedDay] = useState<{ date: Date; events: CustomEvent[] } | null>(null);

  // Controlled calendar states
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [currentView, setCurrentView] = useState<'month' | 'week' | 'day'>('month');

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Fetch items using TanStack Query
  const { data: items = [], isLoading, error } = useQuery<Item[]>({
    queryKey: ['items', 'calendar'],
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

  // Item Modal state for create/edit
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<Item | null>(null);

  // Notes & Checklist filter & scope state
  const [notesFilter, setNotesFilter] = useState<'all' | 'pending' | 'today' | 'completed'>('all');
  const [monthScope, setMonthScope] = useState<'month' | 'all'>('month');

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from('items').delete().eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      setSelectedEvent(null);
      if (selectedDay) {
        setSelectedDay({
          ...selectedDay,
          events: selectedDay.events.filter(e => e.item.id !== deletedId),
        });
      }
    },
    onError: (err: any) => {
      alert('เกิดข้อผิดพลาดในการลบรายการ: ' + (err?.message || ''));
    }
  });

  // Toggle Status Mutation (Pending <-> Issuing Item)
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ itemId, currentStatus }: { itemId: string; currentStatus: ItemStatus }) => {
      const nextStatus: ItemStatus = currentStatus === 'Issuing Item' ? 'Pending' : 'Issuing Item';
      const { error } = await supabase
        .from('items')
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
    onError: (err: any) => {
      alert('เกิดข้อผิดพลาดในการเปลี่ยนสถานะ: ' + (err?.message || ''));
    }
  });

  // Map database items to calendar events (using clean item.title without redundant prefix)
  const events: CustomEvent[] = [];

  items.forEach((item) => {
    const isCompleted = item.status === 'Issuing Item';

    // 1. Map Reminder Date
    if (item.reminder_date) {
      const remDate = new Date(item.reminder_date);
      // End date 1 hour after start
      const remEndDate = new Date(remDate.getTime() + 60 * 60 * 1000);
      
      events.push({
        id: `${item.id}-reminder`,
        title: item.title,
        start: remDate,
        end: remEndDate,
        allDay: false,
        type: isCompleted ? 'completed' : 'reminder',
        item,
      });
    } else if (isCompleted && (item.updated_at || item.created_at)) {
      // 2. Map Completed Date for notes without reminder_date
      const compDate = new Date(item.updated_at || item.created_at);
      const compEndDate = new Date(compDate.getTime() + 60 * 60 * 1000);

      events.push({
        id: `${item.id}-completed`,
        title: item.title,
        start: compDate,
        end: compEndDate,
        allDay: false,
        type: 'completed',
        item,
      });
    }
  });

  // Event Styling Customization
  const eventStyleGetter = (event: CustomEvent) => {
    if (!event || !event.type) return {};
    const isDark = theme === 'dark';

    let backgroundColor = '';
    let textColor = '';
    let border = '';
    let textDecoration = '';
    let opacity = 1;

    if (event.type === 'completed') {
      backgroundColor = isDark ? 'rgba(16, 185, 129, 0.18)' : 'rgba(16, 185, 129, 0.12)';
      textColor = isDark ? '#34d399' : '#047857';
      border = isDark ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(16, 185, 129, 0.25)';
    } else { // 'reminder'
      backgroundColor = isDark ? 'rgba(217, 119, 6, 0.18)' : 'rgba(217, 119, 6, 0.12)';
      textColor = isDark ? '#fbbf24' : '#b45309';
      border = isDark ? '1px solid rgba(217, 119, 6, 0.35)' : '1px solid rgba(217, 119, 6, 0.25)';
    }

    return {
      style: {
        backgroundColor,
        color: textColor,
        border,
        textDecoration,
        opacity,
      }
    };
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleSelectSlot = (slotInfo: { start: Date; end: Date; action?: string }) => {
    const dayDate = slotInfo.start;
    const dayEvts = events.filter((e) =>
      dayjs(e.start).isSame(dayDate, 'day')
    );
    setSelectedDay({
      date: dayDate,
      events: dayEvts,
    });
  };

  // Day Cell Highlight Getter for Today
  const dayPropGetter = (date: Date) => {
    const isToday = dayjs(date).isSame(dayjs(), 'day');
    if (isToday) {
      return {
        className: 'rbc-today-cell-highlight',
        style: {
          backgroundColor: theme === 'dark' ? 'rgba(99, 102, 241, 0.12)' : 'rgba(99, 102, 241, 0.07)',
        }
      };
    }
    return {};
  };

  // Helper to check if an item belongs to the selected calendar month
  const isItemInSelectedMonth = (item: Item, selectedDate: Date) => {
    const isCurrentRealMonth = dayjs(selectedDate).isSame(dayjs(), 'month') && dayjs(selectedDate).isSame(dayjs(), 'year');

    // 1. If item has reminder_date, strictly match month & year
    if (item.reminder_date) {
      return dayjs(item.reminder_date).isSame(selectedDate, 'month') &&
             dayjs(item.reminder_date).isSame(selectedDate, 'year');
    }

    // 2. If item has NO reminder_date:
    const isCompleted = item.status === 'Issuing Item';
    if (isCompleted) {
      // Completed items show in the month they were completed (updated_at)
      const compDate = item.updated_at || item.created_at;
      return dayjs(compDate).isSame(selectedDate, 'month') &&
             dayjs(compDate).isSame(selectedDate, 'year');
    } else {
      // Pending notes without reminder:
      // Show if created in this month, OR if viewing current real-time month (so uncompleted tasks don't vanish)
      if (dayjs(item.created_at).isSame(selectedDate, 'month') && dayjs(item.created_at).isSame(selectedDate, 'year')) {
        return true;
      }
      if (isCurrentRealMonth) {
        return true;
      }
      return false;
    }
  };

  // Scoped items: either filtered by current calendar month or all items
  const scopedItems = monthScope === 'month'
    ? items.filter((item) => isItemInSelectedMonth(item, currentDate))
    : items;

  // Filtered and sorted items for Notes Checklist
  const pendingCount = scopedItems.filter(i => i.status !== 'Issuing Item').length;
  const completedCount = scopedItems.filter(i => i.status === 'Issuing Item').length;
  const todayCount = scopedItems.filter(i => i.reminder_date && dayjs(i.reminder_date).isSame(dayjs(), 'day')).length;

  const filteredNotes = scopedItems
    .filter((item) => {
      const isCompleted = item.status === 'Issuing Item';
      if (notesFilter === 'pending') return !isCompleted;
      if (notesFilter === 'completed') return isCompleted;
      if (notesFilter === 'today') {
        if (!item.reminder_date) return false;
        return dayjs(item.reminder_date).isSame(dayjs(), 'day');
      }
      return true; // 'all'
    })
    .sort((a, b) => {
      // Pending first
      const isDoneA = a.status === 'Issuing Item';
      const isDoneB = b.status === 'Issuing Item';
      if (isDoneA !== isDoneB) {
        return isDoneA ? 1 : -1;
      }
      // If both pending: earlier reminder/created first (urgent first)
      if (!isDoneA) {
        const dateA = a.reminder_date || a.created_at || '';
        const dateB = b.reminder_date || b.created_at || '';
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      }
      // If both completed: most recently completed first
      const compA = a.updated_at || a.reminder_date || a.created_at || '';
      const compB = b.updated_at || b.reminder_date || b.created_at || '';
      return new Date(compB).getTime() - new Date(compA).getTime();
    });

  return (
    <div className="space-y-4 flex flex-col min-h-0 relative">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            ปฏิทินบันทึกช่วยจำ
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            แตะที่วันที่หรือรายการเพื่อดูและจัดการรายการบันทึกของวันนั้นๆ
          </p>
        </div>

        {/* Legend / Key indicator */}
        <div className="flex items-center gap-2 p-2 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-xl shadow-xs backdrop-blur-sm text-[11px] font-semibold shrink-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 dark:bg-amber-400 animate-ping" />
            <span>🔔 กำลังเตือน</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-ping" />
            <span>✅ สำเร็จแล้ว</span>
          </div>
        </div>
      </div>

      {/* Main Calendar View Container */}
      <div className="flex-1 min-h-[480px] relative">
        {isLoading ? (
          <div className="h-[480px] flex flex-col items-center justify-center gap-3 bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/80 rounded-2xl">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-400 font-semibold">กำลังโหลดข้อมูลปฏิทิน...</span>
          </div>
        ) : error ? (
          <div className="h-[300px] flex flex-col items-center justify-center text-center p-6 border border-red-900/30 bg-red-950/10 rounded-2xl gap-3">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <h3 className="text-sm font-bold text-red-200">เกิดข้อผิดพลาดในการโหลดปฏิทิน</h3>
            <p className="text-xs text-slate-400">{(error as any)?.message}</p>
          </div>
        ) : (
          <div className={`transition-all ${
            isFullscreen 
              ? 'fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 p-2 sm:p-4 overflow-hidden flex flex-col h-full' 
              : 'p-2 sm:p-4 md:p-6 bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-sm dark:shadow-none backdrop-blur-sm overflow-hidden flex flex-col h-[540px] sm:h-[600px] lg:h-[640px]'
          }`}>
            <BigCalendar
              localizer={localizer}
              events={events}
              date={currentDate}
              view={currentView}
              views={['month', 'week', 'day']}
              selectable={true}
              onSelectSlot={handleSelectSlot}
              formats={calendarFormats}
              onNavigate={(date) => setCurrentDate(date)}
              onView={(view) => setCurrentView(view as any)}
              startAccessor={(event: any) => event.start as Date}
              endAccessor={(event: any) => event.end as Date}
              style={{ height: '100%', width: '100%' }}
              eventPropGetter={eventStyleGetter as any}
              dayPropGetter={dayPropGetter as any}
              onSelectEvent={(event) => {
                const customEvt = event as CustomEvent;
                const dayDate = (customEvt.start as Date) || new Date();
                const dayEvts = events.filter((e) =>
                  dayjs(e.start).isSame(dayDate, 'day')
                );
                setSelectedDay({
                  date: dayDate,
                  events: dayEvts,
                });
              }}
              components={{
                toolbar: (props: any) => (
                  <CustomToolbar 
                    {...props} 
                    onToggleFullscreen={toggleFullscreen} 
                    isFullscreen={isFullscreen} 
                  />
                ),
              }}
              messages={{
                next: 'ถัดไป',
                previous: 'ก่อนหน้า',
                today: 'วันนี้',
                month: 'เดือน',
                week: 'สัปดาห์',
                day: 'วัน',
              }}
            />
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* NOTES & REMINDERS CHECKLIST SECTION                      */}
      {/* ======================================================== */}
      {!isFullscreen && (
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-xs p-4 sm:p-6 backdrop-blur-sm space-y-4">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                <CheckSquare className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                    รายการบันทึกและกำหนดเตือน
                  </h3>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60">
                    {monthScope === 'month' ? dayjs(currentDate).format('MMMM YYYY') : 'ทุกเดือน'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {monthScope === 'month'
                    ? `แสดงเฉพาะรายการประจำเดือน ${dayjs(currentDate).format('MMMM YYYY')} (เปลี่ยนตามปฏิทิน)`
                    : 'แสดงรายการทั้งหมดทุกเดือน'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
              {/* Scope Selector: Month vs All */}
              <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setMonthScope('month')}
                  className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                    monthScope === 'month'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="แสดงเฉพาะเดือนที่เปิดอยู่บนปฏิทิน"
                >
                  เดือนนี้
                </button>
                <button
                  type="button"
                  onClick={() => setMonthScope('all')}
                  className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                    monthScope === 'all'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="แสดงรายการทั้งหมดทุกเดือน"
                >
                  ทุกเดือน
                </button>
              </div>

              {/* Quick Add Button */}
              <button
                type="button"
                onClick={() => {
                  setItemToEdit(null);
                  setIsItemModalOpen(true);
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 shadow-xs hover:shadow-indigo-500/25 transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">เพิ่มบันทึกช่วยจำ</span>
                <span className="sm:hidden">เพิ่ม</span>
              </button>
            </div>
          </div>

          {/* Filter Pills & Summary */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {(
                [
                  { id: 'all', label: 'ทั้งหมด', count: scopedItems.length },
                  { id: 'pending', label: '🔔 รอจัดการ', count: pendingCount },
                  { id: 'today', label: '📅 เตือนวันนี้', count: todayCount },
                  { id: 'completed', label: '✅ สำเร็จแล้ว', count: completedCount },
                ] as const
              ).map((tab) => {
                const active = notesFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setNotesFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                      active
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-750'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                      active ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              แสดง {filteredNotes.length} จาก {scopedItems.length} รายการ
            </div>
          </div>

          {/* Checklist Items List */}
          <div className="space-y-2.5 pt-1">
            {filteredNotes.length === 0 ? (
              <div className="py-10 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 gap-2">
                <CalendarCheck className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  {notesFilter === 'pending'
                    ? (monthScope === 'month' ? 'ยอดเยี่ยม! ไม่มีรายการที่ค้างอยู่ในเดือนนี้' : 'ยอดเยี่ยม! ไม่มีรายการที่ค้างอยู่')
                    : notesFilter === 'today'
                    ? 'ไม่มีรายการแจ้งเตือนสำหรับวันนี้'
                    : notesFilter === 'completed'
                    ? (monthScope === 'month' ? 'ยังไม่มีรายการที่ทำสำเร็จในเดือนนี้' : 'ยังไม่มีรายการที่ทำสำเร็จ')
                    : (monthScope === 'month' ? `ไม่มีรายการบันทึกในเดือน ${dayjs(currentDate).format('MMMM YYYY')}` : 'ยังไม่มีรายการบันทึกช่วยจำ')}
                </p>
                <p className="text-xs text-slate-400">
                  สามารถกดปุ่ม "เพิ่มบันทึกช่วยจำ" เพื่อสร้างรายการแรกได้เลย
                </p>
              </div>
            ) : (
              filteredNotes.map((item) => {
                const isDone = item.status === 'Issuing Item';
                const hasReminder = !!item.reminder_date;
                const isDueToday = hasReminder && dayjs(item.reminder_date).isSame(dayjs(), 'day');
                const isOverdue = hasReminder && !isDone && dayjs(item.reminder_date).isBefore(dayjs(), 'minute');

                return (
                  <div
                    key={item.id}
                    className={`group p-3 sm:p-4 rounded-xl border transition-all flex items-start gap-3 ${
                      isDone
                        ? 'bg-slate-50/70 dark:bg-slate-900/30 border-slate-200/80 dark:border-slate-800/50 opacity-80'
                        : isDueToday
                        ? 'bg-indigo-50/30 dark:bg-indigo-950/15 border-indigo-200 dark:border-indigo-800/40 shadow-xs'
                        : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
                    }`}
                  >
                    {/* Interactive Checkbox */}
                    <button
                      type="button"
                      onClick={() =>
                        toggleStatusMutation.mutate({
                          itemId: item.id,
                          currentStatus: item.status,
                        })
                      }
                      disabled={toggleStatusMutation.isPending}
                      className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                        isDone
                          ? 'bg-emerald-500 border-2 border-emerald-500 text-white shadow-xs'
                          : 'border-2 border-slate-300 dark:border-slate-600 hover:border-indigo-500 dark:hover:border-indigo-400 bg-white dark:bg-slate-950'
                      }`}
                      title={isDone ? 'คลิกเพื่อเปลี่ยนเป็นยังไม่เสร็จ' : 'คลิกเพื่อติ๊กเสร็จสิ้น'}
                    >
                      {isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        {/* Status Badge */}
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            isDone
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {isDone ? '✅ สำเร็จแล้ว' : '🔔 รอจัดการ'}
                        </span>

                        {/* Reminder / Completion Badge */}
                        {hasReminder ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tabular-nums ${
                              isOverdue
                                ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
                                : isDueToday
                                ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 font-extrabold'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            <Clock className="w-2.5 h-2.5" />
                            <span>
                              {isDueToday
                                ? `วันนี้ ${dayjs(item.reminder_date).format('HH:mm น.')}`
                                : dayjs(item.reminder_date).format('D MMM YYYY, HH:mm น.')}
                            </span>
                            {isOverdue && <span className="font-extrabold">(เลยกำหนด)</span>}
                          </span>
                        ) : isDone && item.updated_at ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tabular-nums bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>สำเร็จเมื่อ {dayjs(item.updated_at).format('D MMM YYYY, HH:mm น.')}</span>
                          </span>
                        ) : null}
                      </div>

                      {/* Title */}
                      <p
                        className={`text-sm leading-snug transition-all ${
                          isDone
                            ? 'line-through text-slate-400 dark:text-slate-500 font-normal'
                            : 'text-slate-800 dark:text-slate-100 font-bold'
                        }`}
                      >
                        {item.title}
                      </p>

                      {/* Description */}
                      {item.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1 whitespace-pre-wrap">
                          {item.description}
                        </p>
                      )}
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setItemToEdit(item);
                          setIsItemModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer"
                        title="แก้ไขรายการ"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`คุณต้องการลบรายการ "${item.title}" ใช่หรือไม่?`)) {
                            deleteMutation.mutate(item.id);
                          }
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                        title="ลบรายการ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DAY EVENTS LIST MODAL / BOTTOM SHEET                      */}
      {/* ======================================================== */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center items-center p-0 md:p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedDay(null)}
          />
          
          {/* Modal Container */}
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border-t md:border border-slate-200 dark:border-slate-800 rounded-t-[28px] md:rounded-2xl shadow-2xl p-5 md:p-6 flex flex-col z-10 animate-slide-up md:animate-scale-up max-h-[85vh] overflow-hidden">
            {/* Drag handle on mobile */}
            <div className="md:hidden pt-1 pb-3 flex items-center justify-center cursor-pointer" onClick={() => setSelectedDay(null)}>
              <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 dark:border-slate-800/80 mb-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-600 dark:text-violet-400">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                    รายการประจำวัน
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                    {dayjs(selectedDay.date).format('ddddที่ D MMMM YYYY')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {selectedDay.events.length} รายการ
                </span>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Events List */}
            <div className="space-y-3 flex-1 overflow-y-auto pr-1">
              {selectedDay.events.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center gap-2 text-slate-400">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center text-slate-400">
                    <Clock className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    ไม่มีรายการบันทึกในวันนี้
                  </p>
                  <p className="text-xs text-slate-400">
                    วันที่ {dayjs(selectedDay.date).format('D MMMM YYYY')} ยังไม่มีการแจ้งเตือน
                  </p>
                </div>
              ) : (
                selectedDay.events.map((evt) => {
                  const isCompleted = evt.type === 'completed';
                  return (
                    <div
                      key={evt.id}
                      className={`p-4 rounded-2xl border transition-all flex flex-col gap-3 shadow-xs ${
                        isCompleted
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-800/40'
                          : 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-800/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                              isCompleted 
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' 
                                : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                            }`}>
                              {isCompleted ? '✅ สำเร็จแล้ว' : '🔔 กำลังเตือน'}
                            </span>
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {dayjs(evt.start).format('HH:mm น.')}
                            </span>
                          </div>

                          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug">
                            {evt.item.title}
                          </h4>

                          {evt.item.description && (
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-wrap">
                              {evt.item.description}
                            </p>
                          )}
                        </div>

                        {evt.item.image_url && (
                          <div 
                            onClick={() => setSelectedEvent(evt)}
                            className="relative w-14 h-14 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shrink-0 cursor-pointer shadow-xs"
                          >
                            <Image
                              src={evt.item.image_url}
                              alt={evt.item.title}
                              fill
                              className="object-cover"
                            />
                          </div>
                        )}
                      </div>

                      {/* Card Action Buttons */}
                      <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/60">
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`คุณต้องการลบรายการ "${evt.item.title}" ใช่หรือไม่?`)) {
                              deleteMutation.mutate(evt.item.id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>ลบ</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedEvent(evt)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-violet-600 dark:text-violet-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-all shadow-xs cursor-pointer"
                        >
                          ดูรายละเอียดเต็ม
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3.5 border-t border-slate-200 dark:border-slate-800/80 mt-3 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="w-full py-2.5 rounded-xl font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs transition-all duration-200 cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* Detail Overlay Modal / Bottom Sheet                      */}
      {/* ======================================================== */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center items-center p-0 md:p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedEvent(null)}
          />
          
          {/* Modal Container */}
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border-t md:border border-slate-200 dark:border-slate-800 rounded-t-[28px] md:rounded-2xl shadow-2xl p-5 md:p-6 flex flex-col z-10 animate-slide-up md:animate-scale-up max-h-[90vh] md:max-h-[85vh] overflow-y-auto">
            {/* Drag handle on mobile */}
            <div className="md:hidden pt-1 pb-3 flex items-center justify-center cursor-pointer" onClick={() => setSelectedEvent(null)}>
              <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
            </div>

            {/* Close and Title */}
            <div className="flex items-center justify-between pb-3 md:pb-4 border-b border-slate-200 dark:border-slate-800/80 mb-4 md:mb-6 shrink-0">
              <h2 className="text-base md:text-lg font-bold text-indigo-600 dark:text-indigo-400">
                รายละเอียดบันทึกช่วยจำ
              </h2>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="space-y-6 flex-1 pr-1 overflow-y-auto">
              {/* Event specific type indicator */}
              <div>
                {selectedEvent.type === 'reminder' ? (
                  <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
                    <Clock className="w-5 h-5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider">วันแจ้งเตือนการจัดการ</h4>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5 font-semibold">
                        {dayjs(selectedEvent.start).format('DD MMMM YYYY, HH:mm น.')}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                    <Clock className="w-5 h-5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider">
                        {selectedEvent.item.reminder_date ? 'วันแจ้งเตือน (ดำเนินการสำเร็จแล้ว)' : 'วันที่ทำรายการสำเร็จ'}
                      </h4>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 font-semibold">
                        {dayjs(selectedEvent.start).format('DD MMMM YYYY, HH:mm น.')}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Core Item Parameters */}
              <div className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider mb-1">
                    หัวข้อรายการ
                  </label>
                  <p className="text-base font-bold text-slate-800 dark:text-slate-100">{selectedEvent.item.title}</p>
                </div>

                {selectedEvent.item.description && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider mb-1">
                      รายละเอียด
                    </label>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-950/40 p-3 rounded-xl border border-slate-200/50 dark:border-slate-800/40 whitespace-pre-wrap">
                      {selectedEvent.item.description}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-450 dark:text-slate-500 tracking-wider mb-1">
                      สถานะปัจจุบัน
                    </label>
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide uppercase ${
                      selectedEvent.item.status === 'Pending' ? 'text-amber-700 bg-amber-500/10' :
                      'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10'
                    }`}>
                      {selectedEvent.item.status === 'Pending' ? 'กำลังดำเนินการ' : 'สำเร็จ'}
                    </span>
                  </div>
                </div>

                {/* Uploaded image details */}
                {selectedEvent.item.image_url && (
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800/60">
                    <label className="block text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                      เอกสารแนบประกอบ
                    </label>
                    <div className="relative w-full h-44 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner">
                      <Image
                        src={selectedEvent.item.image_url}
                        alt={selectedEvent.item.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 400px"
                        className="object-cover hover:scale-102 transition-transform duration-300"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800/80 mt-6 shrink-0 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  if (confirm(`คุณต้องการลบรายการ "${selectedEvent.item.title}" ใช่หรือไม่?`)) {
                    deleteMutation.mutate(selectedEvent.item.id);
                  }
                }}
                disabled={deleteMutation.isPending}
                className="px-4 py-2.5 rounded-xl font-bold bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs border border-red-500/20 transition-all duration-200 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ลบรายการ</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="flex-1 py-2.5 rounded-xl font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs transition-all duration-200 cursor-pointer"
              >
                ปิดหน้าต่างรายละเอียด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Modal for Create/Edit */}
      {user && (
        <ItemModal
          isOpen={isItemModalOpen}
          onClose={() => {
            setIsItemModalOpen(false);
            setItemToEdit(null);
          }}
          userId={user.id}
          itemToEdit={itemToEdit}
        />
      )}
    </div>
  );
}
