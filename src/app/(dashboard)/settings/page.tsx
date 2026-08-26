'use client';

import React, { useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Link2, Unlink, CheckCircle2, Copy, Check, 
  RefreshCw, ShieldCheck, AlertCircle, User as UserIcon,
  Bell, Lock, Smartphone, ExternalLink, Sparkles
} from 'lucide-react';
import { UserProfile } from '@/lib/types';
import Image from 'next/image';

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [unlinkLoading, setUnlinkLoading] = useState(false);

  // Fetch profile data
  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ['user-profile', user?.id],
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

  // Generate Link Code mutation
  const generateLinkCodeMutation = useMutation({
    mutationFn: async () => {
      const array = new Uint8Array(4);
      crypto.getRandomValues(array);
      const code = Array.from(array, byte => (byte % 36).toString(36)).join('').toUpperCase().padStart(6, 'X');
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from('profiles')
        .update({
          link_code: code,
          link_code_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile', user?.id] });
    },
  });

  // Unlink LINE account mutation
  const handleUnlink = async () => {
    if (!confirm('คุณต้องการยกเลิกการเชื่อมต่อ LINE กับบัญชีนี้ใช่หรือไม่?')) return;
    setUnlinkLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          line_user_id: null,
          link_code: null,
          link_code_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user?.id);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['user-profile', user?.id] });
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการยกเลิกการเชื่อมต่อ');
      console.error(err);
    } finally {
      setUnlinkLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isCodeValid = profile?.link_code && profile?.link_code_expires_at && new Date(profile.link_code_expires_at) > new Date();

  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || 'ผู้ใช้งาน จำจด';
  const userEmail = user?.email || '';
  const userAvatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-transparent dark:bg-gradient-to-r dark:from-white dark:via-slate-100 dark:to-slate-400 dark:bg-clip-text">
          การตั้งค่า & บัญชีผู้ใช้
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          จัดการโปรไฟล์ การเชื่อมต่อ LINE Bot และระบบความปลอดภัย
        </p>
      </div>

      {/* 1. User Profile Overview Card */}
      <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs backdrop-blur-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          {userAvatar ? (
            <Image
              src={userAvatar}
              alt={userName}
              width={52}
              height={52}
              className="rounded-2xl border-2 border-violet-500/20 shadow-sm shrink-0"
            />
          ) : (
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
              <UserIcon className="w-6 h-6" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 truncate">
                {userName}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-violet-500/10 text-violet-600 dark:text-violet-400 shrink-0">
                PRO
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {userEmail}
            </p>
          </div>
        </div>

        <button
          onClick={signOut}
          className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all cursor-pointer shrink-0 border border-slate-200/80 dark:border-slate-800"
        >
          ออกจากระบบ
        </button>
      </div>

      {/* 2. LINE Integration Card */}
      <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xs backdrop-blur-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#06C755]/10 border border-[#06C755]/20 flex items-center justify-center text-[#06C755] shrink-0 shadow-xs">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 11.5c0-5.247-5.383-9.5-12-9.5C5.383 2 0 6.253 0 11.5c0 4.697 4.283 8.637 10.094 9.398-.393.818-1.547 3.398-1.77 4.398-.225 1.002.404.99 1.077.545C10.027 25.39 15.016 20.35 17.5 17.5c4.15-1.047 6.5-3.663 6.5-6m-13.62 3.125c-.562 0-1.018-.456-1.018-1.018v-4.8c0-.562.456-1.018 1.018-1.018s1.018.456 1.018 1.018v4.8c0 .562-.456 1.018-1.018 1.018m3.93 0c-.562 0-1.018-.456-1.018-1.018v-4.8c0-.562.456-1.018 1.018-1.018s1.018.456 1.018 1.018v2.215h1.764v-2.215c0-.562.456-1.018 1.018-1.018s1.018.456 1.018 1.018v4.8c0 .562-.456 1.018-1.018 1.018s-1.018-.456-1.018-1.018v-1.579h-1.764v1.579c0 .562-.456 1.018-1.018 1.018m5.603 0c-.562 0-1.018-.456-1.018-1.018v-4.8c0-.562.456-1.018 1.018-1.018.562 0 1.018.456 1.018 1.018v4.8c0 .562-.456 1.018-1.018 1.018" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  LINE Official Account
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ผู้ช่วยสั่งงานบันทึกช่วยจำและแจ้งเตือนผ่านแชต LINE
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <div>
            {profile?.line_user_id ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>เชื่อมต่อแล้ว</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-xs">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>ยังไม่ได้เชื่อมต่อ</span>
              </span>
            )}
          </div>
        </div>

        {/* When Connected */}
        {profile?.line_user_id ? (
          <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200/70 dark:border-slate-800/70 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <div className="text-xs">
                <span className="text-slate-500 dark:text-slate-400 block sm:inline">LINE User ID: </span>
                <code className="font-mono text-slate-800 dark:text-slate-200 font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                  {profile.line_user_id.slice(0, 14)}...
                </code>
              </div>
            </div>

            <button
              onClick={handleUnlink}
              disabled={unlinkLoading}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Unlink className="w-3.5 h-3.5" />
              <span>{unlinkLoading ? 'กำลังยกเลิก...' : 'ยกเลิกการเชื่อมต่อ'}</span>
            </button>
          </div>
        ) : (
          /* When NOT Linked - Step-by-Step Connection */
          <div className="space-y-3.5 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60 rounded-xl flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-violet-600/10 text-violet-600 dark:text-violet-400 flex items-center justify-center text-xs font-black shrink-0">
                  1
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  แอด LINE OA ของ <strong>จำจด (JumJod)</strong>
                </p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60 rounded-xl flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-violet-600/10 text-violet-600 dark:text-violet-400 flex items-center justify-center text-xs font-black shrink-0">
                  2
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  กดปุ่มรับรหัสเชื่อมต่อด้านล่าง
                </p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60 rounded-xl flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-violet-600/10 text-violet-600 dark:text-violet-400 flex items-center justify-center text-xs font-black shrink-0">
                  3
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  พิมพ์ส่งรหัส <code className="text-violet-600 dark:text-violet-400 font-bold">#link [รหัส]</code> หาบอท
                </p>
              </div>
            </div>

            {/* Code Box / Generate Button */}
            {isCodeValid ? (
              <div className="p-3.5 bg-gradient-to-r from-violet-500/10 to-indigo-500/10 border border-violet-500/20 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <span className="text-[10px] uppercase font-extrabold text-violet-600 dark:text-violet-400 tracking-wider block">
                    รหัสเชื่อมต่อ (พิมพ์ส่งให้บอทใน LINE):
                  </span>
                  <code className="text-lg font-black text-violet-700 dark:text-violet-300 tracking-widest select-all">
                    #link {profile.link_code}
                  </code>
                </div>
                <button
                  onClick={() => copyToClipboard(`#link ${profile.link_code}`)}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-md shadow-indigo-600/20"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'คัดลอกเรียบร้อย!' : 'คัดลอกข้อความ'}</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => generateLinkCodeMutation.mutate()}
                disabled={generateLinkCodeMutation.isPending}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${generateLinkCodeMutation.isPending ? 'animate-spin' : ''}`} />
                <span>{generateLinkCodeMutation.isPending ? 'กำลังสร้างรหัส...' : 'รับรหัสเชื่อมต่อ LINE'}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 4. Privacy & Cookie Policy Card */}
      <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs backdrop-blur-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-xs">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              นโยบายความเป็นส่วนตัว & คุกกี้ (Privacy & Cookies)
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              ความโปร่งใสในการจัดเก็บข้อมูลตามมาตรฐาน PDPA พ.ศ. 2562
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/privacy-policy"
            className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100 dark:hover:bg-violet-900/50 border border-violet-200 dark:border-violet-800/60 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
          >
            <span>อ่านนโยบายและสิทธิ์</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
