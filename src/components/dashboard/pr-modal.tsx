'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, FileText, Calendar, Hash, Tag } from 'lucide-react';
import { PrRequest, PrStatus } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface PrModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  prToEdit?: PrRequest | null;
}

export default function PrModal({ isOpen, onClose, userId, prToEdit }: PrModalProps) {
  const queryClient = useQueryClient();
  const supabase = createClient();

  const [title, setTitle] = useState('');
  const [prNo, setPrNo] = useState('');
  const [poNo, setPoNo] = useState('');
  const [qtNo, setQtNo] = useState('');
  const [status, setStatus] = useState<PrStatus>('Pending');
  const [createdAt, setCreatedAt] = useState('');
  const [notes, setNotes] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (prToEdit) {
        setTitle(prToEdit.title || '');
        setPrNo(prToEdit.pr_no || '');
        setPoNo(prToEdit.po_no || '');
        setQtNo(prToEdit.qt_no || '');
        setStatus(prToEdit.status || 'Pending');
        setNotes(prToEdit.notes || '');
        
        // Format ISO date string for datetime-local input
        if (prToEdit.created_at) {
          const d = new Date(prToEdit.created_at);
          const pad = (n: number) => String(n).padStart(2, '0');
          const localIso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
          setCreatedAt(localIso);
        } else {
          setCreatedAt('');
        }
      } else {
        setTitle('');
        setPrNo('');
        setPoNo('');
        setQtNo('');
        setStatus('Pending');
        setNotes('');
        
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const localIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
        setCreatedAt(localIso);
      }
      setError(null);
    }
  }, [isOpen, prToEdit]);

  const mutation = useMutation({
    mutationFn: async () => {
      setSubmitting(true);
      setError(null);

      if (!title.trim()) {
        throw new Error('กรุณาระบุชื่อหัวข้อรายการ');
      }

      const formattedCreatedAt = createdAt ? new Date(createdAt).toISOString() : new Date().toISOString();

      const payload = {
        title: title.trim(),
        pr_no: prNo.trim() || null,
        po_no: poNo.trim() || null,
        qt_no: qtNo.trim() || null,
        status,
        notes: notes.trim() || null,
        created_at: formattedCreatedAt,
        updated_at: new Date().toISOString(),
      };

      if (prToEdit) {
        const { error: updateError } = await supabase
          .from('pr_requests')
          .update(payload)
          .eq('id', prToEdit.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('pr_requests')
          .insert([
            {
              user_id: userId,
              ...payload,
            },
          ]);

        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pr-requests'] });
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
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-600 dark:text-violet-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                {prToEdit ? 'แก้ไขรายการติดตาม PR' : 'เพิ่มรายการติดตาม PR ใหม่'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {prToEdit ? 'ปรับปรุงเลข PR, PO, QT หรือวันที่บันทึก' : 'ใส่ชื่อหัวข้อก่อน แล้วค่อยเติมเลข PR/PO/QT ทีหลังได้'}
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

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              ชื่อหัวข้อรายการ <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="เช่น ซื้อคอมพิวเตอร์กราฟิก 2 เครื่อง, สั่งซื้อหมึกพิมพ์ประจำเดือน"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-violet-500 dark:focus:border-violet-400 font-medium"
            />
          </div>

          {/* Grid of PR No, PO No, QT No */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                เลข PR
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="เช่น PR-69001"
                  value={prNo}
                  onChange={(e) => setPrNo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-violet-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                เลข PO
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="เช่น PO-2026-042"
                  value={poNo}
                  onChange={(e) => setPoNo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-violet-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                เลข QT
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="เช่น QT-8891"
                  value={qtNo}
                  onChange={(e) => setQtNo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-violet-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Status & Created At */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                สถานะการติดตาม
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PrStatus)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-violet-500 font-medium"
              >
                <option value="Pending">⏳ รอเลข PR (Pending)</option>
                <option value="PR Issued">📄 ออก PR แล้ว (PR Issued)</option>
                <option value="PO Issued">📑 ออก PO แล้ว (PO Issued)</option>
                <option value="Completed">✅ เสร็จสมบูรณ์ (Completed)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                ทำในระบบวันไหน (Date Recorded)
              </label>
              <input
                type="datetime-local"
                value={createdAt}
                onChange={(e) => setCreatedAt(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-violet-500 font-medium"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              หมายเหตุ / บันทึกเพิ่มเติม
            </label>
            <textarea
              rows={2}
              placeholder="รายละเอียดเพิ่มเติม เช่น ร้านค้า, ราคากลาง, ผู้ติดต่อ..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-violet-500 font-medium"
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
              className="px-5 py-2 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/25 active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{prToEdit ? 'บันทึกการแก้ไข' : 'สร้างรายการ PR'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
