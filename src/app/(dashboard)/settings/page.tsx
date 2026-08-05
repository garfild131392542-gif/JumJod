'use client';

import React, { useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Link2, Unlink, CheckCircle2, Copy, Check, RefreshCw, ShieldCheck, AlertCircle } from 'lucide-react';
import { UserProfile } from '@/lib/types';

export default function SettingsPage() {
  const { user } = useAuth();
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
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
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
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการยกเลิกการเชื่อมต่อกับ LINE?')) return;
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

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          ตั้งค่าการเชื่อมต่อบัญชี
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          จัดการการเชื่อมต่อ LINE Official Account เพื่อสั่งงานบันทึกความจำและแจ้งเตือนผ่านไลน์
        </p>
      </div>

      {/* Main Connection Status Card */}
      <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm backdrop-blur-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${profile?.line_user_id ? 'bg-emerald-500/10 text-emerald-500' : 'bg-violet-500/10 text-violet-500'}`}>
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  LINE Official Account
                </h3>
                {profile?.line_user_id ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5" /> เชื่อมต่อแล้ว
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    <AlertCircle className="w-3.5 h-3.5" /> ยังไม่ได้เชื่อมต่อ
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {profile?.line_user_id
                  ? `เชื่อมต่อกับรหัส LINE ID: ${profile.line_user_id.slice(0, 10)}...`
                  : 'สร้างรหัสเชื่อมต่อด้านล่างและนำไปส่งให้บอทใน LINE เพื่อเริ่มใช้งาน'}
              </p>
            </div>
          </div>

          {profile?.line_user_id && (
            <button
              onClick={handleUnlink}
              disabled={unlinkLoading}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all cursor-pointer border border-rose-200 dark:border-rose-900/50"
            >
              <Unlink className="w-4 h-4" />
              {unlinkLoading ? 'กำลังยกเลิก...' : 'ยกเลิกการเชื่อมต่อ'}
            </button>
          )}
        </div>

        {/* Section when NOT linked */}
        {!profile?.line_user_id && (
          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800/80 space-y-4">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-violet-500" /> ขั้นตอนการเชื่อมต่อบัญชี LINE
            </h4>

            <ol className="list-decimal list-inside text-xs text-slate-600 dark:text-slate-400 space-y-2 pl-1">
              <li>แอด LINE Official Account ของ <strong>จำจด (JumJod)</strong></li>
              <li>กดปุ่มสร้างรหัสเชื่อมต่อด้านล่าง (รหัสมีอายุ 10 นาที)</li>
              <li>คัดลอกข้อความ <code className="text-violet-600 dark:text-violet-400 font-bold bg-violet-50 dark:bg-violet-950/50 px-1.5 py-0.5 rounded">#link [รหัสของคุณ]</code> พิมพ์ส่งให้บอทในแชต LINE</li>
            </ol>

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {isCodeValid ? (
                <div className="flex-1 p-4 bg-violet-50/50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800/50 rounded-xl flex items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      ข้อความสำหรับพิมพ์ส่งใน LINE:
                    </span>
                    <code className="text-base font-extrabold text-violet-600 dark:text-violet-400 tracking-wider">
                      #link {profile.link_code}
                    </code>
                  </div>
                  <button
                    onClick={() => copyToClipboard(`#link ${profile.link_code}`)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white rounded-lg text-xs font-semibold hover:bg-violet-700 transition-all cursor-pointer shrink-0 shadow-sm"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'คัดลอกแล้ว!' : 'คัดลอกข้อความ'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => generateLinkCodeMutation.mutate()}
                  disabled={generateLinkCodeMutation.isPending}
                  className="flex items-center justify-center gap-2 px-5 py-3 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${generateLinkCodeMutation.isPending ? 'animate-spin' : ''}`} />
                  {generateLinkCodeMutation.isPending ? 'กำลังสร้างรหัส...' : 'รับรหัสเชื่อมต่อ LINE ใหม่'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Safety & Isolation Guarantee Card */}
      <div className="bg-slate-50 dark:bg-slate-900/30 border border-slate-200/80 dark:border-slate-800/60 rounded-2xl p-5 flex items-start gap-4">
        <ShieldCheck className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            ระบบความปลอดภัยและการแยกข้อมูล (Data Isolation)
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            ข้อมูลการสั่งบันทึก รายรับ-รายจ่าย สต็อก และปฏิทินทั้งหมดจะถูกผูกกับโปรไฟล์เฉพาะของคุณผ่านระบบความปลอดภัย Row Level Security (RLS) ของ Supabase บัญชีผู้ใช้อื่นจะไม่สามารถมองเห็นหรือเข้าถึงข้อมูลของคุณได้แม้จะใช้ LINE OA เดียวกัน
          </p>
        </div>
      </div>
    </div>
  );
}
