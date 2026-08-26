'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { momentLocalizer, Event as CalendarEvent } from 'react-big-calendar';
import dynamic from 'next/dynamic';

const BigCalendar = dynamic(
  () => import('react-big-calendar').then((mod) => mod.Calendar),
  { ssr: false }
);
import moment from 'moment';
import 'moment/locale/th';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { useTheme } from '@/components/providers/theme-provider';
import { Item } from '@/lib/types';
import ItemModal from '@/components/dashboard/item-modal';
import { 
  X, Calendar as CalendarIcon, Clock, 
  FileText, Image as ImageIcon, AlertCircle, Trash2,
  Maximize2, Minimize2, RotateCw, Plus
} from 'lucide-react';
import Image from 'next/image';

// Configure moment to use Thai locale
moment.locale('th');

// Configure localizer for React Big Calendar
const localizer = momentLocalizer(moment);

const calendarFormats = {
  dateFormat: 'D',
  dayFormat: (date: Date) => moment(date).format('ddd'),
  weekdayFormat: (date: Date) => moment(date).format('ddd'),
  monthHeaderFormat: (date: Date) => moment(date).format('MMMM YYYY'),
  dayHeaderFormat: (date: Date) => moment(date).format('dddd D MMMM YYYY'),
  dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
    `${moment(start).format('D MMMM')} - ${moment(end).format('D MMMM YYYY')}`,
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
    queryKey: ['items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select('*');

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
      moment(e.start).isSame(dayDate, 'day')
    );
    setSelectedDay({
      date: dayDate,
      events: dayEvts,
    });
  };

  return (
    <div className="space-y-4 flex flex-col min-h-0 relative">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-transparent dark:bg-gradient-to-r dark:from-white dark:via-slate-100 dark:to-slate-400 dark:bg-clip-text">
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
              : 'p-2 sm:p-4 md:p-6 bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-sm dark:shadow-none backdrop-blur-sm overflow-hidden flex flex-col h-[calc(100dvh-230px)] min-h-[480px]'
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
              onSelectEvent={(event) => {
                const customEvt = event as CustomEvent;
                const dayDate = (customEvt.start as Date) || new Date();
                const dayEvts = events.filter((e) =>
                  moment(e.start).isSame(dayDate, 'day')
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
                    {moment(selectedDay.date).format('ddddที่ D MMMM YYYY')}
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
                    วันที่ {moment(selectedDay.date).format('D MMMM YYYY')} ยังไม่มีการแจ้งเตือน
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
                              {moment(evt.start).format('HH:mm น.')}
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
              <h2 className="text-base md:text-lg font-bold bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-violet-400 dark:to-indigo-200 bg-clip-text text-transparent">
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
                        {moment(selectedEvent.start).format('DD MMMM YYYY, HH:mm น.')}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                    <Clock className="w-5 h-5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider">วันแจ้งเตือน (ดำเนินการสำเร็จแล้ว)</h4>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 font-semibold">
                        {moment(selectedEvent.start).format('DD MMMM YYYY, HH:mm น.')}
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
    </div>
  );
}
