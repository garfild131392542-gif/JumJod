'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, Scale, Calendar, FileText } from 'lucide-react';
import { LabCalibration } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface CalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  calToEdit?: LabCalibration | null;
}

export default function CalibrationModal({
  isOpen,
  onClose,
  userId,
  calToEdit,
}: CalibrationModalProps) {
  const queryClient = useQueryClient();
  const supabase = createClient();

  const [name, setName] = useState('');
  const [lastCalDate, setLastCalDate] = useState('');
  const [nextCalDate, setNextCalDate] = useState('');
  const [notes, setNotes] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (calToEdit) {
        setName(calToEdit.name || '');
        setLastCalDate(calToEdit.last_cal_date || '');
        setNextCalDate(calToEdit.next_cal_date || '');
        setNotes(calToEdit.notes || '');
      } else {
        setName('');
        setLastCalDate('');
        
        // Default next_cal_date to 1 year from today
        const today = new Date();
        const nextYear = new Date(today.setFullYear(today.getFullYear() + 1));
        const pad = (n: number) => String(n).padStart(2, '0');
        const defaultNext = `${nextYear.getFullYear()}-${pad(nextYear.getMonth() + 1)}-${pad(nextYear.getDate())}`;
        setNextCalDate(defaultNext);
        setNotes('');
      }
      setError(null);
    }
  }, [isOpen, calToEdit]);

  const mutation = useMutation({
    mutationFn: async () => {
      setSubmitting(true);
      setError(null);

      if (!name.trim()) {
        throw new Error('กรุณาระบุชื่อเครื่องมือ/เครื่องชั่ง');
      }
      if (!nextCalDate) {
        throw new Error('กรุณาระบุวันที่ต้องส่ง Calibrate ครั้งถัดไป');
      }

      const payload = {
        name: name.trim(),
        last_cal_date: lastCalDate || null,
        next_cal_date: nextCalDate,
        notes: notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (calToEdit) {
        const { error: updateError } = await supabase
          .from('lab_calibrations')
          .update(payload)
          .eq('id', calToEdit.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('lab_calibrations')
          .insert([
            {
              user_id: userId,
              ...payload,
              created_at: new Date().toISOString(),
            },
          ]);

        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-calibrations'] });
      setSubmitting(false);
      onClose();
    },
    onError: (err: any) => {
      setSubmitting(false);
      setError(err?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh] animate-scale-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                {calToEdit ? 'แก้ไขรอบ Calibrate เครื่องมือ' : 'เพิ่มเครื่องมือวัด / เครื่องชั่งใหม่'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                บันทึกชื่อเครื่องมือ, วันที่ Cal ครั้งก่อน และกำหนดการส่ง Cal ครั้งถัดไป
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="p-6 overflow-y-auto space-y-4 flex-1 text-slate-800 dark:text-slate-200"
        >
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Equipment Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              1. ชื่อเครื่องมือ / เครื่องชั่ง <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="เช่น เครื่องชั่งดิจิทัล 4 ตำแหน่ง Lab 1, เครื่องวัดความหนืด Viscometer"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-teal-500 dark:focus:border-teal-400 font-medium"
            />
          </div>

          {/* 2 & 3. Last Cal Date & Next Cal Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                2. ครั้งก่อนที่ส่ง Cal (Last Cal)
              </label>
              <input
                type="date"
                value={lastCalDate}
                onChange={(e) => setLastCalDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-teal-500 font-medium"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                ใส่วันที่เคยส่ง Cal ย้อนหลัง (ถ้ามี)
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                3. ครั้งถัดไปที่จะทำการ Cal <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={nextCalDate}
                onChange={(e) => setNextCalDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-teal-500 font-medium"
              />
              <span className="text-[10px] text-teal-600 dark:text-teal-400 mt-1 block font-semibold">
                กำหนดการส่ง Calibrate รอบถัดไป
              </span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              หมายเหตุ / บริษัทที่รับ Cal
            </label>
            <textarea
              rows={2}
              placeholder="เช่น บริษัทผู้รับรองมาตรฐาน, รหัสประจำเครื่อง, ตำแหน่งที่ตั้งใน Lab..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-teal-500 font-medium"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-500/25 active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{calToEdit ? 'บันทึกการแก้ไข' : 'สร้างรายการเครื่องมือ'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
