'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Cookie, ShieldCheck, X, Check, Settings, ChevronRight } from 'lucide-react';

export const COOKIE_CONSENT_KEY = 'jumjod_cookie_consent';

export default function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      // Delay slightly for smooth entrance animation
      const timer = setTimeout(() => setShowBanner(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({
      essential: true,
      preferences: true,
      timestamp: new Date().toISOString(),
    }));
    setShowBanner(false);
    setShowDetailModal(false);
  };

  const handleAcceptEssentialOnly = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({
      essential: true,
      preferences: false,
      timestamp: new Date().toISOString(),
    }));
    setShowBanner(false);
    setShowDetailModal(false);
  };

  if (!showBanner && !showDetailModal) return null;

  return (
    <>
      {/* 1. Bottom Slide-up Cookie Banner */}
      {showBanner && !showDetailModal && (
        <div className="fixed bottom-0 inset-x-0 z-50 p-3 sm:p-5 pointer-events-none animate-slide-up">
          <div className="max-w-3xl mx-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-800/90 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-2xl pointer-events-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Cookie info */}
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-xs">
                <Cookie className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    นโยบายการใช้คุกกี้และความเป็นส่วนตัว (Cookies & Privacy)
                  </h4>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  จำจด (JumJod) ใช้คุกกี้ที่จำเป็นสำหรับการยืนยันตัวตน (Authentication) และการบันทึกการตั้งค่า เพื่อมอบประสบการณ์การใช้งานที่ปลอดภัยและราบรื่นตามมาตรฐาน PDPA{' '}
                  <Link 
                    href="/privacy-policy" 
                    className="text-violet-600 dark:text-violet-400 font-semibold underline hover:text-violet-700 dark:hover:text-violet-300 inline-flex items-center gap-0.5"
                  >
                    อ่านนโยบายฉบับเต็ม
                  </Link>
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
              <button
                type="button"
                onClick={() => setShowDetailModal(true)}
                className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
              >
                ตั้งค่า
              </button>
              <button
                type="button"
                onClick={handleAcceptAll}
                className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-md shadow-indigo-600/20 transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>ยอมรับทั้งหมด</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Detailed Cookie Preference Modal */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={() => setShowDetailModal(false)}
          />

          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl z-10 animate-scale-up space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                    ตั้งค่าความยินยอมคุกกี้
                  </h3>
                  <p className="text-xs text-slate-400">Cookie Preferences & PDPA</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cookie Categories */}
            <div className="space-y-3">
              {/* Essential */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800/80 flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      คุกกี้ที่จำเป็นอย่างยิ่ง (Strictly Necessary Cookies)
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      เปิดใช้งานเสมอ
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    จำเป็นสำหรับการทำงานพื้นฐานของระบบ เช่น การคงสถานะการเข้าสู่ระบบ (Supabase Session) และการรักษาความปลอดภัยของบัญชี
                  </p>
                </div>
              </div>

              {/* Preferences */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800/80 flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      คุกกี้เพื่อการจดจำการตั้งค่า (Preference Cookies)
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-violet-500/10 text-violet-600 dark:text-violet-400">
                      แนะนำ
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    ใช้จดจำธีมการแสดงผล (Light/Dark Mode) และการตั้งค่าหน้าจอ เพื่อความสะดวกในการใช้งาน
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-violet-50/50 dark:bg-violet-950/20 border border-violet-200/60 dark:border-violet-800/50 flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-300 text-[11px]">
                ต้องการอ่านรายละเอียดนโยบายฉบับเต็ม?
              </span>
              <Link
                href="/privacy-policy"
                onClick={() => setShowDetailModal(false)}
                className="text-violet-600 dark:text-violet-400 font-bold hover:underline flex items-center gap-0.5"
              >
                <span>นโยบายความเป็นส่วนตัว</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={handleAcceptEssentialOnly}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
              >
                ยอมรับเฉพาะที่จำเป็น
              </button>
              <button
                type="button"
                onClick={handleAcceptAll}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-md shadow-indigo-600/20 transition-all cursor-pointer active:scale-95"
              >
                ยอมรับทั้งหมด
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
