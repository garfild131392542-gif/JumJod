'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ShieldCheck, ArrowLeft, Lock, Cookie, Database, 
  Smartphone, UserCheck, Mail, CheckCircle2, FileText,
  Clock, RefreshCw
} from 'lucide-react';
import { COOKIE_CONSENT_KEY } from '@/components/common/cookie-consent';

export default function PrivacyPolicyPage() {
  const router = useRouter();

  const handleResetCookies = () => {
    localStorage.removeItem(COOKIE_CONSENT_KEY);
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200">
      {/* Top App Header */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 px-4 py-3 sm:py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>ย้อนกลับ</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-extrabold bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-violet-400 dark:to-indigo-300 bg-clip-text text-transparent">
              JumJod Legal & PDPA
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 sm:py-10 space-y-6 sm:space-y-8">
        {/* Title Hero */}
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-700 text-white shadow-xl space-y-3 relative overflow-hidden">
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white mb-2">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            นโยบายความเป็นส่วนตัวและคุกกี้
          </h1>
          <p className="text-xs sm:text-sm text-violet-100 max-w-2xl leading-relaxed">
            Privacy Policy & Cookie Policy สำหรับแอปพลิเคชันและบริการ <strong>จำจด (JumJod)</strong> ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)
          </p>
          <div className="flex items-center gap-4 pt-2 text-[11px] text-violet-200">
            <span>📅 อัปเดตล่าสุด: สิงหาคม 2569</span>
            <span>🔒 สถานะ: มีผลบังคับใช้</span>
          </div>

          <div className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full bg-white/10 pointer-events-none" />
        </div>

        {/* Section 1: Introduction */}
        <section className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-xs space-y-3">
          <div className="flex items-center gap-2.5 text-violet-600 dark:text-violet-400">
            <FileText className="w-5 h-5" />
            <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
              1. บทนำและขอบเขตการใช้งาน
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            แอปพลิเคชัน <strong>จำจด (JumJod)</strong> ให้ความสำคัญอย่างยิ่งต่อการคุ้มครองข้อมูลส่วนบุคคลของผู้ใช้งานทุกท่าน นโยบายนี้จัดทำขึ้นเพื่อชี้แจงให้ท่านทราบถึงรายละเอียดการเก็บรวบรวม การใช้ การประมวลผล การจัดเก็บรักษา และการคุ้มครองข้อมูลส่วนบุคคลของท่าน รวมถึงสิทธิต่างๆ ของท่านตามกฎหมาย PDPA
          </p>
        </section>

        {/* Section 2: Data Collected */}
        <section className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 text-violet-600 dark:text-violet-400">
            <Database className="w-5 h-5" />
            <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
              2. ข้อมูลส่วนบุคคลที่เราเก็บรวบรวม
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
            เราจะเก็บรวบรวมข้อมูลส่วนบุคคลเท่าที่จำเป็นต่อการให้บริการ โดยครอบคลุมรายการข้อมูลดังต่อไปนี้:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800/80 space-y-1">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-violet-500" /> ข้อมูลบัญชีผู้ใช้ (Account Data)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                ชื่อ, ที่อยู่อีเมล (Google Account), รูปภาพโปรไฟล์ เพื่อใช้ระบุตัวตนและยืนยันสิทธิ์ในการเข้าถึง
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800/80 space-y-1">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-emerald-500" /> ข้อมูลการเชื่อมต่อ LINE
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                LINE User ID เฉพาะบัญชีของคุณ เพื่อให้ระบบสามารถรับคำสั่งบันทึกและส่งการแจ้งเตือนเตือนความจำไปยังแชต LINE
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800/80 space-y-1">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-500" /> ข้อมูลการบันทึกช่วยจำ & สต็อก
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                ข้อความบันทึกช่วยจำ, วันที่และเวลาแจ้งเตือน, รายการวัสดุสต็อก, เอกสาร PR/PO, รูปภาพแนบประกอบ
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800/80 space-y-1">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-indigo-500" /> ข้อมูลทางเทคนิค
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Session Token, IP Address สำหรับการรักษาความปลอดภัยของระบบ และข้อมูลการใช้งานเบื้องต้น
              </p>
            </div>
          </div>
        </section>

        {/* Section 3: Purpose of Processing */}
        <section className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-xs space-y-3">
          <div className="flex items-center gap-2.5 text-violet-600 dark:text-violet-400">
            <CheckCircle2 className="w-5 h-5" />
            <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
              3. วัตถุประสงค์ในการนำข้อมูลไปใช้
            </h2>
          </div>
          <ul className="space-y-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 list-disc list-inside leading-relaxed pl-1">
            <li>เพื่อให้บริการฟังก์ชันการบันทึกช่วยจำ การแจ้งเตือนตามวันและเวลาที่กำหนดผ่าน LINE Bot</li>
            <li>เพื่อจัดการระบบสต็อกพัสดุ/อุปกรณ์ และระบบติดตามสถานะการจัดซื้อ (PR/PO Tracker)</li>
            <li>เพื่อแสดงผลปฏิทินงานและการนัดหมายเฉพาะบุคคลอย่างถูกต้องแม่นยำ</li>
            <li>เพื่อรักษาความปลอดภัยของบัญชีและป้องกันการเข้าถึงข้อมูลโดยไม่ได้รับอนุญาต</li>
          </ul>
        </section>

        {/* Section 4: Security & Data Isolation */}
        <section className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-xs space-y-3">
          <div className="flex items-center gap-2.5 text-violet-600 dark:text-violet-400">
            <Lock className="w-5 h-5" />
            <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
              4. มาตรการรักษาความปลอดภัยและการแยกข้อมูล (Data Isolation)
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            ข้อมูลทั้งหมดของท่านถูกจัดเก็บบนโครงสร้างคลาวด์มาตรฐานความปลอดภัยสูงของ <strong>Supabase</strong> และได้รับการปกป้องด้วยระบบ <strong>Row Level Security (RLS)</strong> ซึ่งรับประกันว่าผู้ใช้งานท่านอื่นจะไม่สามารถมองเห็น แก้ไข หรือเข้าถึงข้อมูลของท่านได้ แม้จะใช้งานผ่านระบบ LINE Official Account เดียวกันก็ตาม
          </p>
        </section>

        {/* Section 5: Cookie Policy */}
        <section className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400">
            <Cookie className="w-5 h-5" />
            <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
              5. นโยบายการใช้คุกกี้ (Cookie Policy)
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            คุกกี้ (Cookies) และ Local Storage คือไฟล์ข้อมูลขนาดเล็กที่บันทึกไว้ในเบราว์เซอร์ของท่าน เพื่อช่วยให้ระบบทำงานได้อย่างมีประสิทธิภาพ:
          </p>

          <div className="space-y-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800/80">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-1">
                🍪 คุกกี้ที่จำเป็นต่อระบบ (Strictly Necessary Cookies)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                ใช้สำหรับจัดเก็บ Session การยืนยันตัวตน (Authentication Token) ผ่าน Supabase Auth หากปิดใช้งานส่วนนี้ ท่านจะไม่สามารถเข้าสู่ระบบหรือใช้งานฟังก์ชันต่างๆ ของแอปพลิเคชันได้
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800/80">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-1">
                ⚙️ คุกกี้เพื่อการจดจำการตั้งค่า (Preference Cookies)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                ใช้สำหรับจดจำธีมที่ท่านเลือก (Light/Dark Mode) และสถานะความยินยอมคุกกี้ เพื่อให้ท่านได้รับประสบการณ์ที่ดีที่สุดในการเข้าชมเว็บไซต์ครั้งถัดไป
              </p>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              ต้องการรีเซ็ตและตั้งค่าความยินยอมคุกกี้ใหม่?
            </span>
            <button
              type="button"
              onClick={handleResetCookies}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>รีเซ็ตการยินยอมคุกกี้</span>
            </button>
          </div>
        </section>

        {/* Section 6: User Rights */}
        <section className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-xs space-y-3">
          <div className="flex items-center gap-2.5 text-violet-600 dark:text-violet-400">
            <UserCheck className="w-5 h-5" />
            <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
              6. สิทธิของเจ้าของข้อมูลส่วนบุคคล (Your Rights)
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            ท่านมีสิทธิ์ตามกฎหมาย PDPA ดังต่อไปนี้:
          </p>
          <ul className="space-y-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 list-disc list-inside leading-relaxed pl-1">
            <li><strong>สิทธิในการเข้าถึงและขอรับสำเนา:</strong> ท่านสามารถดูข้อมูลทั้งหมดที่ถูกบันทึกไว้ในระบบได้ตลอดเวลา</li>
            <li><strong>สิทธิในการแก้ไขข้อมูล:</strong> ท่านสามารถแก้ไขหรืออัปเดตข้อมูลรายการสต็อก บันทึกช่วยจำได้ทันที</li>
            <li><strong>สิทธิในการขอลบข้อมูล:</strong> ท่านสามารถกดลบรายการบันทึกช่วยจำ สต็อก หรือยกเลิกการเชื่อมต่อ LINE Account ได้ตลอดเวลา</li>
            <li><strong>สิทธิในการเพิกถอนความยินยอม:</strong> ท่านสามารถยกเลิกการเชื่อมต่อ LINE ผ่านหน้าตั้งค่า และออกจากระบบได้ทุกเมื่อ</li>
          </ul>
        </section>

        {/* Section 7: Contact Info */}
        <section className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-xs space-y-3">
          <div className="flex items-center gap-2.5 text-violet-600 dark:text-violet-400">
            <Mail className="w-5 h-5" />
            <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
              7. ช่องทางการติดต่อ
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            หากท่านมีข้อสงสัยหรือประสงค์จะใช้สิทธิเกี่ยวกับข้อมูลส่วนบุคคล สามารถติดต่อผู้พัฒนาระบบ <strong>จำจด (JumJod)</strong> ได้ผ่านช่องทาง LINE Official Account หรือส่งคำขอผ่านระบบ
          </p>
        </section>

        {/* Footer */}
        <div className="pt-4 text-center pb-8">
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} จำจด • JumJod Smart Assistant. สงวนลิขสิทธิ์ตามกฎหมาย
          </p>
        </div>
      </main>
    </div>
  );
}
