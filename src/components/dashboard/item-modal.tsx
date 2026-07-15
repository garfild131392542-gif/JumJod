import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Item, ItemStatus } from '@/lib/types';
import { uploadItemImage } from '@/lib/supabase/storage';
import { X, Calendar, Image as ImageIcon, FileText, AlertCircle, Loader2 } from 'lucide-react';
import Image from 'next/image';

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  itemToEdit?: Item | null;
}

function toLocalISOString(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

export default function ItemModal({ isOpen, onClose, userId, itemToEdit }: ItemModalProps) {
  const queryClient = useQueryClient();
  const supabase = createClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ItemStatus>('Pending');
  const [reminderDate, setReminderDate] = useState('');

  // Image Upload States
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  // UI Status States
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Initialize form fields when opening or changing itemToEdit
  useEffect(() => {
    if (isOpen) {
      if (itemToEdit) {
        setTitle(itemToEdit.title);
        setDescription(itemToEdit.description || '');
        setStatus(itemToEdit.status);
        setReminderDate(itemToEdit.reminder_date ? toLocalISOString(itemToEdit.reminder_date) : '');
        setExistingImageUrl(itemToEdit.image_url);
        setImagePreview(itemToEdit.image_url);
        setFileName(itemToEdit.image_url ? itemToEdit.image_url.split('/').pop()?.split('-').slice(1).join('-') || 'เอกสารแนบ' : null);
      } else {
        // Reset form for new item
        setTitle('');
        setDescription('');
        setStatus('Pending');
        setReminderDate('');
        setExistingImageUrl(null);
        setImagePreview(null);
        setFileName(null);
      }
      setImageFile(null);
      setError(null);
    }
  }, [isOpen, itemToEdit]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setFileName(file.name);

      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setImagePreview(null);
      }
    }
  };

  const isImageFile = (url: string | null) => {
    if (!url) return false;
    const ext = url.split('.').pop()?.toLowerCase();
    return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext || '');
  };

  // TanStack Query Mutation for Create / Update
  const mutation = useMutation({
    mutationFn: async () => {
      setSubmitting(true);
      setError(null);

      let imageUrl = existingImageUrl;

      if (imageFile) {
        imageUrl = await uploadItemImage(imageFile, userId);
      }

      const itemData = {
        user_id: userId,
        title,
        description: description || null,
        status,
        image_url: imageUrl,
        reminder_date: reminderDate ? new Date(reminderDate).toISOString() : null,
        updated_at: new Date().toISOString(),
        // Clear all PR/PO/Credit Term legacy fields
        is_pr: false,
        has_item_number: false,
        item_number: null,
        item_request_status: 'None',
        pr_number: null,
        pr_status: 'Pending',
        po_date: null,
        credit_term: null,
        budget_due_date: null,
      };

      if (itemToEdit) {
        // Update Item
        const { error: updateError } = await supabase
          .from('items')
          .update(itemData)
          .eq('id', itemToEdit.id);

        if (updateError) throw updateError;
      } else {
        // Create Item
        const { error: createError } = await supabase
          .from('items')
          .insert([itemData]);

        if (createError) throw createError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      setSubmitting(false);
      onClose();
    },
    onError: (err: any) => {
      console.error('Error saving item:', err);
      setError(err?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      setSubmitting(false);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('กรุณากรอกหัวข้อรายการ');
      return;
    }
    mutation.mutate();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Glass backdrop overlay */}
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Box */}
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh] text-slate-800 dark:text-slate-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
          <h2 className="text-xl font-bold bg-gradient-to-r from-violet-650 to-indigo-650 dark:from-violet-400 dark:to-indigo-200 bg-clip-text text-transparent">
            {itemToEdit ? 'แก้ไขรายการ' : 'เพิ่มรายการใหม่'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-950/40 border border-red-900/50 text-red-200 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              หัวข้อรายการ <span className="text-violet-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="กรอกหัวข้อบันทึกช่วยจำ..."
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-all text-slate-805 dark:text-slate-200"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-505 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              รายละเอียดเพิ่มเติม (Description)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="กรอกรายละเอียดบันทึกช่วยจำ..."
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-all text-slate-808 dark:text-slate-200 resize-none"
            />
          </div>

          {/* Status Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-505 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              สถานะ (Status)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['Pending', 'Issuing Item'] as ItemStatus[]).map((s) => {
                const isSelected = status === s;
                let thaiName = 'กำลังดำเนินการ';
                let style = 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900/50';

                if (s === 'Issuing Item') thaiName = 'สำเร็จ';

                if (isSelected) {
                  if (s === 'Pending') style = 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400';
                  if (s === 'Issuing Item') style = 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
                }

                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`py-2 px-3 border rounded-xl text-xs font-bold transition-all duration-200 ${style}`}
                  >
                    {thaiName}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reminder Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-55 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              วันแจ้งเตือนการดำเนินการ (Reminder Date)
            </label>
            <div className="relative">
              <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="datetime-local"
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-all text-slate-808 dark:text-slate-200"
              />
            </div>
          </div>

          {/* Image/File Attachment */}
          <div>
            <label className="block text-xs font-semibold text-slate-505 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              แนบเอกสาร/รูปภาพประกอบ (Attachment)
            </label>
            <div className="flex items-center gap-4">
              {imagePreview && (imageFile ? imageFile.type.startsWith('image/') : (!existingImageUrl || isImageFile(existingImageUrl))) ? (
                <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shrink-0">
                  <Image
                    src={imagePreview}
                    alt="Preview"
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                      setExistingImageUrl(null);
                      setFileName(null);
                    }}
                    className="absolute top-1 right-1 p-0.5 rounded-full bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-300 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (imageFile || existingImageUrl) ? (
                <div className="relative w-20 h-20 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex flex-col items-center justify-center p-2 text-center shrink-0">
                  <FileText className="w-6 h-6 text-violet-500 mb-1" />
                  <span className="text-[8px] text-slate-500 dark:text-slate-400 truncate w-full px-1">{fileName || 'เอกสารแนบ'}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                      setExistingImageUrl(null);
                      setFileName(null);
                    }}
                    className="absolute top-1 right-1 p-0.5 rounded-full bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-300 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <label className="w-20 h-20 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 hover:border-violet-500/50 flex flex-col items-center justify-center cursor-pointer bg-slate-50 dark:bg-slate-950/50 text-slate-450 dark:text-slate-55 hover:text-slate-650 dark:hover:text-slate-450 transition-colors shrink-0">
                  <ImageIcon className="w-5 h-5 mb-1" />
                  <span className="text-[10px]">เลือกไฟล์</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              )}
              <div className="text-xs text-slate-500 space-y-1">
                <p>รองรับไฟล์รูปภาพ และเอกสารทั่วไป (PDF, Word, Excel)</p>
                <p>จะถูกอัปโหลดไปยังระบบจัดเก็บไฟล์ Supabase Storage</p>
              </div>
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-450 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-violet-650 to-indigo-650 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-indigo-600/10 active:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>กำลังบันทึก...</span>
              </>
            ) : (
              <span>{itemToEdit ? 'บันทึกการแก้ไข' : 'สร้างรายการ'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
