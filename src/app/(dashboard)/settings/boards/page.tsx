
'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { Plus, Edit2, Trash2, Tag, Layout } from 'lucide-react';
import Link from 'next/link';

export default function BoardsSettingsPage() {
  const [boards, setBoards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const supabase = createClient();

  useEffect(() => {
    if (user) {
      loadBoards();
    }
  }, [user]);

  const loadBoards = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('boards')
        .select('*, categories(*)')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: true });
        
      if (error) throw error;
      setBoards(data || []);
    } catch (error) {
      console.error('Error loading boards:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'INVENTORY': return 'ระบบสต็อก (Inventory)';
      case 'DATE_TRACKER': return 'เตือนตามรอบ (Date Tracker)';
      case 'KANBAN': return 'สถานะขั้นตอน (Kanban)';
      case 'GENERAL_LIST': return 'รายการทั่วไป (General List)';
      default: return type;
    }
  };

  const handleCreateBoard = async () => {
    const name = prompt('ตั้งชื่อบอร์ดใหม่:');
    if (!name) return;
    const type = prompt('เลือกประเภทบอร์ด (1=ทั่วไป, 2=สต็อก, 3=PR, 4=Calibrate):', '1');
    let boardType = 'GENERAL_LIST';
    if (type === '2') boardType = 'INVENTORY';
    if (type === '3') boardType = 'KANBAN';
    if (type === '4') boardType = 'DATE_TRACKER';
    
    const icon = prompt('ใส่อีโมจิสำหรับบอร์ด:', '📌') || '📌';
    
    setLoading(true);
    await supabase.from('boards').insert([{ name, type: boardType, icon, user_id: user?.id }]);
    loadBoards();
  };

  const handleEditBoard = async (board: any) => {
    const name = prompt('แก้ไขชื่อบอร์ด:', board.name);
    if (!name || name === board.name) return;
    
    setLoading(true);
    await supabase.from('boards').update({ name }).eq('id', board.id);
    loadBoards();
  };

  const handleDeleteBoard = async (id: string) => {
    if (!confirm('คุณต้องการลบบอร์ดนี้ใช่หรือไม่? (ข้อมูลทั้งหมดในบอร์ดนี้จะถูกลบไปด้วย)')) return;
    
    setLoading(true);
    await supabase.from('boards').delete().eq('id', id);
    loadBoards();
  };

  const handleAddCategory = async (boardId: string) => {
    const name = prompt('ชื่อหมวดหมู่ใหม่:');
    if (!name) return;
    
    setLoading(true);
    await supabase.from('categories').insert([{ name, board_id: boardId }]);
    loadBoards();
  };

  return (
    <div className='max-w-4xl mx-auto pb-12'>
      <div className='flex items-center justify-between mb-6'>
        <div>
          <Link href='/settings' className='text-sm text-indigo-500 hover:underline mb-1 block'>&larr; กลับไปตั้งค่า</Link>
          <h1 className='text-2xl font-bold text-slate-900 dark:text-white'>จัดการบอร์ด (Board Manager)</h1>
          <p className='text-sm text-slate-500'>ออกแบบและปรับแต่งหัวข้อบันทึกของคุณได้อย่างอิสระ</p>
        </div>
        <button 
          onClick={handleCreateBoard}
          className='px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-sm flex items-center gap-2 transition-all cursor-pointer'
        >
          <Plus className='w-4 h-4' /> สร้างบอร์ดใหม่
        </button>
      </div>

      {loading ? (
        <div className='flex justify-center p-12'>
          <div className='w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin'></div>
        </div>
      ) : boards.length === 0 ? (
        <div className='bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-12 text-center'>
          <Layout className='w-12 h-12 text-slate-300 mx-auto mb-4' />
          <h3 className='text-lg font-bold text-slate-700 dark:text-slate-200 mb-2'>ยังไม่มีบอร์ด</h3>
          <p className='text-slate-500'>สร้างบอร์ดแรกของคุณเพื่อเริ่มต้นบันทึกข้อมูล</p>
        </div>
      ) : (
        <div className='grid grid-cols-1 gap-4'>
          {boards.map(board => (
            <div key={board.id} className='bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-5'>
              <div className='flex items-start justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xl shrink-0'>
                    {board.icon || '📌'}
                  </div>
                  <div>
                    <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>{board.name}</h3>
                    <div className='flex items-center gap-2 mt-1'>
                      <span className='px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-semibold'>
                        {getTypeLabel(board.type)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className='flex items-center gap-2'>
                  <button 
                    onClick={() => handleEditBoard(board)}
                    className='p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer'
                  >
                    <Edit2 className='w-4 h-4' />
                  </button>
                  <button 
                    onClick={() => handleDeleteBoard(board.id)}
                    className='p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer'
                  >
                    <Trash2 className='w-4 h-4' />
                  </button>
                </div>
              </div>

              {/* Categories */}
              <div className='mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80'>
                <div className='flex items-center gap-2 mb-3'>
                  <Tag className='w-4 h-4 text-slate-400' />
                  <span className='text-sm font-semibold text-slate-600 dark:text-slate-300'>หมวดหมู่ย่อย (Categories)</span>
                </div>
                
                <div className='flex flex-wrap gap-2'>
                  {board.categories?.length > 0 ? (
                    board.categories.map((cat: any) => (
                      <span key={cat.id} className='px-3 py-1 rounded-full text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'>
                        {cat.name}
                      </span>
                    ))
                  ) : (
                    <span className='text-xs text-slate-400'>ยังไม่มีหมวดหมู่ย่อย</span>
                  )}
                  <button 
                    onClick={() => handleAddCategory(board.id)}
                    className='px-3 py-1 rounded-full text-xs font-bold border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer'
                  >
                    + เพิ่มหมวดหมู่
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

