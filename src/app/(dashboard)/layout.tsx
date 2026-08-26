'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { useTheme } from '@/components/providers/theme-provider';
import { 
  ClipboardList, Calendar, LogOut, User as UserIcon, 
  Menu, Sun, Moon, CheckSquare, Package, FileText, 
  Scale, Settings, X, ChevronRight 
} from 'lucide-react';
import Image from 'next/image';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, signOut, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-200">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Primary Navigation Items for Desktop & Drawer
  const allNavItems = [
    {
      name: 'บอร์ดช่วยจำ',
      shortName: 'ช่วยจำ',
      href: '/dashboard',
      icon: ClipboardList,
      description: 'บันทึกช่วยจำและแจ้งเตือน'
    },
    {
      name: 'ติดตาม PR',
      shortName: 'PR/PO',
      href: '/pr-tracker',
      icon: FileText,
      description: 'ใบขอซื้อ PR, PO และงบประมาณ'
    },
    {
      name: 'สต็อกวัสดุ',
      shortName: 'สต็อก',
      href: '/stock',
      icon: Package,
      description: 'ตรวจเช็ค เบิก-เติม สต็อก'
    },
    {
      name: 'ปฏิทินเตือนความจำ',
      shortName: 'ปฏิทิน',
      href: '/calendar',
      icon: Calendar,
      description: 'ตารางวันแจ้งเตือนกิจกรรม'
    },
    {
      name: 'Calibrate เครื่องมือ',
      shortName: 'Calibrate',
      href: '/calibration',
      icon: Scale,
      description: 'รอบสอบเทียบเครื่องมือวัด'
    },
    {
      name: 'รายการสำเร็จ',
      shortName: 'สำเร็จแล้ว',
      href: '/completed',
      icon: CheckSquare,
      description: 'ประวัติบันทึกที่เสร็จสิ้น'
    },
    {
      name: 'ตั้งค่า & เชื่อมต่อ LINE',
      shortName: 'ตั้งค่า',
      href: '/settings',
      icon: Settings,
      description: 'จัดการบัญชีและไลน์บอท'
    },
  ];

  // Mobile Bottom Tab Bar Items (4 Quick Tabs + 1 Drawer Trigger)
  const mobileTabItems = [
    {
      name: 'ช่วยจำ',
      href: '/dashboard',
      icon: ClipboardList,
    },
    {
      name: 'PR/PO',
      href: '/pr-tracker',
      icon: FileText,
    },
    {
      name: 'สต็อก',
      href: '/stock',
      icon: Package,
    },
    {
      name: 'ปฏิทิน',
      href: '/calendar',
      icon: Calendar,
    },
  ];

  const userAvatar = user?.user_metadata?.avatar_url;
  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';
  const userEmail = user?.email || '';

  // Check if current page is in drawer items
  const isMoreActive = pathname === '/calibration' || pathname === '/completed' || pathname === '/settings';

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-200 font-sans antialiased selection:bg-violet-500 selection:text-white">
      
      {/* ======================================================== */}
      {/* 1. DESKTOP SIDEBAR (Visible on md: and above)             */}
      {/* ======================================================== */}
      <aside
        className={`hidden md:flex ${sidebarOpen ? 'w-72' : 'w-20'} shrink-0 bg-white dark:bg-slate-900/40 border-r border-slate-200 dark:border-slate-800/80 backdrop-blur-md transition-all duration-300 flex-col justify-between z-20 sticky top-0 h-screen`}
      >
        <div>
          {/* Header Branding */}
          <div className="p-6 flex items-center justify-between border-b border-slate-200 dark:border-slate-800/60">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shadow-md shrink-0 bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60">
                <Image src="/Logo.png" alt="Logo" width={40} height={40} className="object-cover" />
              </div>
              {sidebarOpen && (
                <span className="font-extrabold text-lg bg-gradient-to-r from-violet-600 to-indigo-500 dark:from-violet-400 dark:to-indigo-200 bg-clip-text text-transparent truncate">
                  จำจด • JumJod
                </span>
              )}
            </div>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-750 dark:hover:text-slate-200 transition-colors cursor-pointer"
              title="ย่อ/ขยายเมนู"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            {allNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-200 group relative ${
                    isActive
                      ? 'bg-violet-600/10 dark:bg-violet-600/20 text-violet-600 dark:text-violet-400 border-l-4 border-violet-500 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/40 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'}`} />
                  {sidebarOpen && <span className="truncate">{item.name}</span>}

                  {/* Tooltip when collapsed */}
                  {!sidebarOpen && (
                    <div className="absolute left-full ml-4 px-2.5 py-1.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100 opacity-0 scale-95 origin-left pointer-events-none group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 shadow-xl whitespace-nowrap z-30">
                      {item.name}
                    </div>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User profile & Logout footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-900/10">
          {/* Theme Toggle Switcher */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-center gap-2 mb-3 px-3 py-2.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800/40 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-all duration-200 cursor-pointer border border-slate-200/50 dark:border-slate-800"
          >
            {theme === 'light' ? (
              <>
                <Moon className="w-3.5 h-3.5" />
                {sidebarOpen && <span>โหมดมืด (Dark Mode)</span>}
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                {sidebarOpen && <span>โหมดสว่าง (Light Mode)</span>}
              </>
            )}
          </button>

          <div className="flex items-center justify-between gap-3 overflow-hidden mb-3">
            <div className="flex items-center gap-3 min-w-0">
              {userAvatar ? (
                <Image
                  src={userAvatar}
                  alt={userName}
                  width={36}
                  height={36}
                  className="rounded-full border border-violet-500/30 shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                  <UserIcon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                </div>
              )}
              {sidebarOpen && (
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{userName}</h4>
                  <p className="text-[10px] text-slate-500 truncate">{userEmail}</p>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold bg-red-500/10 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-650 dark:text-red-400 hover:bg-red-500/20 dark:hover:bg-red-950/40 hover:border-red-300 dark:hover:border-red-900/50 transition-all duration-200 cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {sidebarOpen && <span>ออกจากระบบ (Logout)</span>}
          </button>
        </div>
      </aside>

      {/* ======================================================== */}
      {/* 2. MOBILE TOP APP BAR (Sticky header on mobile)          */}
      {/* ======================================================== */}
      <header className="md:hidden sticky top-0 z-30 pt-safe backdrop-blur-xl bg-white/85 dark:bg-slate-950/85 border-b border-slate-200/80 dark:border-slate-800/80 shadow-xs">
        <div className="px-4 py-2.5 flex items-center justify-between">
          {/* Logo & App Name */}
          <Link href="/dashboard" className="flex items-center gap-2.5 active:scale-95 transition-transform">
            <div className="w-8 h-8 rounded-xl overflow-hidden shadow-sm bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center">
              <Image src="/Logo.png" alt="Logo" width={32} height={32} className="object-cover" />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-sm tracking-tight bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-500 dark:from-violet-400 dark:via-indigo-300 dark:to-violet-200 bg-clip-text text-transparent leading-tight">
                จำจด • JumJod
              </span>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none">
                Smart Assistant
              </span>
            </div>
          </Link>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-1.5">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="w-8 h-8 rounded-xl bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-90 transition-transform cursor-pointer"
              title="สลับโหมดสี"
            >
              {theme === 'light' ? (
                <Moon className="w-4 h-4" />
              ) : (
                <Sun className="w-4 h-4 text-amber-400" />
              )}
            </button>

            {/* User Avatar Button (Opens Drawer) */}
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="flex items-center p-0.5 rounded-full border border-violet-500/40 active:scale-90 transition-transform cursor-pointer"
              title="เมนูโปรไฟล์"
            >
              {userAvatar ? (
                <Image
                  src={userAvatar}
                  alt={userName}
                  width={28}
                  height={28}
                  className="rounded-full"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-violet-600/10 text-violet-600 dark:text-violet-400 flex items-center justify-center text-xs font-bold">
                  {userName.charAt(0).toUpperCase()}
                </div>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ======================================================== */}
      {/* 3. MAIN CONTENT AREA (Responsive scroll container)       */}
      {/* ======================================================== */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* Background decorative ambient glows */}
        <div className="absolute top-0 right-1/4 w-[350px] md:w-[500px] h-[350px] md:h-[500px] bg-violet-600/[0.04] dark:bg-violet-600/5 blur-[100px] md:blur-[120px] rounded-full pointer-events-none -z-10" />
        <div className="absolute bottom-0 left-1/4 w-[350px] md:w-[500px] h-[350px] md:h-[500px] bg-emerald-600/[0.04] dark:bg-emerald-600/5 blur-[100px] md:blur-[120px] rounded-full pointer-events-none -z-10" />

        {/* Dynamic Padding: Extra bottom padding on mobile for Dock */}
        <div className="flex-1 overflow-auto px-4 py-4 pb-28 md:p-8 md:pb-8 relative">
          {children}
        </div>
      </main>

      {/* ======================================================== */}
      {/* 4. MOBILE BOTTOM NAVIGATION DOCK (App-Like Tab Bar)       */}
      {/* ======================================================== */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 pb-safe backdrop-blur-2xl bg-white/90 dark:bg-slate-950/90 border-t border-slate-200/90 dark:border-slate-800/90 shadow-[0_-4px_25px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_25px_rgba(0,0,0,0.4)]">
        <div className="grid grid-cols-5 items-center justify-around px-2 py-1.5">
          {mobileTabItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all duration-200 relative group active:scale-95 ${
                  isActive
                    ? 'text-violet-600 dark:text-violet-400 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {/* Active Indicator Glow / Pill */}
                {isActive && (
                  <span className="absolute top-0.5 w-6 h-1 rounded-full bg-violet-600 dark:bg-violet-400 shadow-sm" />
                )}
                
                <div className={`p-1 rounded-xl transition-all ${
                  isActive ? 'bg-violet-500/10 dark:bg-violet-500/20' : ''
                }`}>
                  <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight font-semibold truncate max-w-full">
                  {item.name}
                </span>
              </Link>
            );
          })}

          {/* 5th Tab: "เมนูอื่นๆ" (More / Drawer Trigger) */}
          <button
            onClick={() => setMobileDrawerOpen(true)}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all duration-200 relative active:scale-95 cursor-pointer ${
              isMoreActive || mobileDrawerOpen
                ? 'text-violet-600 dark:text-violet-400 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {(isMoreActive || mobileDrawerOpen) && (
              <span className="absolute top-0.5 w-6 h-1 rounded-full bg-violet-600 dark:bg-violet-400 shadow-sm" />
            )}
            
            <div className={`p-1 rounded-xl transition-all ${
              isMoreActive || mobileDrawerOpen ? 'bg-violet-500/10 dark:bg-violet-500/20' : ''
            }`}>
              <Menu className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight font-semibold truncate max-w-full">
              เมนูอื่นๆ
            </span>
          </button>
        </div>
      </nav>

      {/* ======================================================== */}
      {/* 5. MOBILE APP DRAWER SHEET (Slide-up Bottom Sheet)       */}
      {/* ======================================================== */}
      {mobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop overlay */}
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />

          {/* Bottom Sheet Drawer Box */}
          <div className="relative w-full max-h-[85vh] bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-t-[28px] shadow-2xl overflow-hidden flex flex-col animate-slide-up z-10">
            {/* Sheet Handle */}
            <div className="pt-3 pb-2 flex items-center justify-center cursor-pointer" onClick={() => setMobileDrawerOpen(false)}>
              <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
            </div>

            {/* Header with User Info */}
            <div className="px-5 py-3 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                {userAvatar ? (
                  <Image
                    src={userAvatar}
                    alt={userName}
                    width={40}
                    height={40}
                    className="rounded-full border border-violet-500/30 shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-violet-600/10 dark:bg-violet-600/20 text-violet-600 dark:text-violet-400 flex items-center justify-center text-sm font-black border border-violet-500/20 shrink-0">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{userName}</h4>
                  <p className="text-[11px] text-slate-500 truncate">{userEmail}</p>
                </div>
              </div>
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 active:scale-90 transition-transform cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Menu List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
              <span className="text-[10px] font-extrabold uppercase text-slate-400 dark:text-slate-500 px-3 tracking-wider block mb-1">
                ฟังก์ชั่นทั้งหมด (All Features)
              </span>

              {allNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileDrawerOpen(false)}
                    className={`flex items-center justify-between p-3 rounded-2xl transition-all duration-200 active:scale-[0.98] ${
                      isActive
                        ? 'bg-violet-600/10 dark:bg-violet-600/20 border border-violet-500/30 text-violet-600 dark:text-violet-400 font-bold'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isActive 
                          ? 'bg-violet-600 text-white shadow-sm' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold block truncate">{item.name}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal truncate block">{item.description}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </Link>
                );
              })}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 pb-safe space-y-2">
              <button
                onClick={() => {
                  setMobileDrawerOpen(false);
                  signOut();
                }}
                className="w-full py-3 rounded-xl text-xs font-bold bg-red-500/10 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-650 dark:text-red-400 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>ออกจากระบบ (Logout)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

