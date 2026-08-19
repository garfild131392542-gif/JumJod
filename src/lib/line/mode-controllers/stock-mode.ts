import { SupabaseClient } from '@supabase/supabase-js';
import { sendLineReply } from '@/lib/line/client';
import { createStockFlexBubble, createStockActionMenuFlex } from '@/lib/line/flex-templates';
import { parseStockMessageWithAI, getGeminiApiKey } from '@/lib/ai';
import { StockService } from '@/services';
import { Profile } from '@/lib/types';

export class StockModeController {
  static async handleMessage(
    messageText: string,
    profile: Profile,
    replyToken: string,
    lineUserId: string,
    supabaseAdmin: SupabaseClient
  ): Promise<boolean> {
    const cleanText = messageText.trim().toLowerCase();

    // Check if user is asking to view all stocks
    const isCheckAllStocks = /^(ดู|เช็ก|เช็ค|รายการ|แสดง)?\s*(สต็อก|สต๊อก|วัสดุ|ของ|สินค้า|ยอด|สต็อกของ|สต๊อกของ|ยอดของ|สินค้าของ)(ทั้งหมด|ของ)?$/i.test(cleanText) ||
      ['รายการ', 'ดูรายการ', 'ดูสต็อก', 'ดูสต๊อก', 'เช็กสต็อก', 'เช็คสต็อก', 'วัสดุ', 'ดูวัสดุ', 'เช็กวัสดุ'].includes(cleanText);

    if (isCheckAllStocks) {
      const stocks = await StockService.getStocksByUserId(supabaseAdmin, profile.id);
      if (!stocks || stocks.length === 0) {
        await sendLineReply(replyToken, '📦 คลังวัสดุของคุณยังไม่มีรายการใดๆ สามารถเปิดหน้าเว็บเพื่อเพิ่มวัสดุใหม่ หรือพิมพ์สั่งแอดวัสดุได้เลยครับ เช่น "เพิ่ม แอลกอฮอล์ 10 ขวด"');
        return true;
      }

      const bubbles = stocks.slice(0, 10).map(stock => createStockFlexBubble(stock, 'CHECK', null));
      await sendLineReply(replyToken, {
        type: 'flex',
        altText: '📦 รายการสต็อกวัสดุทั้งหมดของคุณ',
        contents: {
          type: 'carousel',
          contents: bubbles
        }
      });
      return true;
    }

    // Try parsing stock operation via AI
    try {
      const apiKey = getGeminiApiKey();
      if (!apiKey) return false;

      const parsed = await parseStockMessageWithAI(messageText, apiKey);
      if (parsed && parsed.name) {
        const stockItem = await StockService.searchStockByName(supabaseAdmin, profile.id, parsed.name);
        if (stockItem) {
          if (parsed.action === 'CHECK') {
            await sendLineReply(replyToken, {
              type: 'flex',
              altText: `📦 ข้อมูลสต็อก "${stockItem.name}"`,
              contents: createStockActionMenuFlex(stockItem)
            });
            return true;
          }

          if (parsed.quantity !== null) {
            let delta = parsed.quantity;
            if (parsed.action === 'SUBTRACT') delta = -parsed.quantity;
            if (parsed.action === 'SET') delta = parsed.quantity - stockItem.quantity;

            const res = await StockService.adjustStockQuantity(supabaseAdmin, stockItem.id, delta);
            if (res.success && res.updatedStock) {
              const opText = parsed.action === 'SUBTRACT' ? 'เบิกออก' : parsed.action === 'ADD' ? 'เติมสต็อก' : 'ปรับยอด';
              await sendLineReply(replyToken, `✅ ทำการ${opText}วัสดุ "${stockItem.name}" เรียบร้อยแล้วครับ!\n\nยอดเดิม: ${stockItem.quantity} ${stockItem.unit}\nทำรายการ: ${parsed.quantity} ${stockItem.unit}\nยอดคงเหลือใหม่: ${res.updatedStock.quantity} ${res.updatedStock.unit} 📦`);
              return true;
            }
          }
        } else {
          // Item not found in stock -> Offer to create it!
          const createNewPostback = `action=stock_create_prompt&name=${encodeURIComponent(parsed.name)}&qty=${parsed.quantity || ''}`;
          const notFoundFlex = {
            type: 'bubble',
            body: {
              type: 'box',
              layout: 'vertical',
              spacing: 'md',
              contents: [
                {
                  type: 'text',
                  text: `🔎 ไม่พบวัสดุชื่อ "${parsed.name}" ในคลัง`,
                  weight: 'bold',
                  size: 'md',
                  color: '#1e293b',
                  wrap: true
                },
                {
                  type: 'text',
                  text: 'คุณต้องการบันทึกเพิ่มวัสดุชิ้นนี้เข้าไปในระบบสต็อกใหม่เลยไหมครับ?',
                  size: 'xs',
                  color: '#64748b',
                  wrap: true
                },
                {
                  type: 'button',
                  style: 'primary',
                  color: '#8b5cf6',
                  height: 'sm',
                  action: {
                    type: 'postback',
                    label: '➕ สร้างวัสดุใหม่ในคลัง',
                    data: createNewPostback
                  }
                }
              ]
            }
          };

          await sendLineReply(replyToken, {
            type: 'flex',
            altText: `⚠️ ไม่พบวัสดุ "${parsed.name}" ในคลัง`,
            contents: notFoundFlex
          });
          return true;
        }
      }
    } catch (err) {
      console.error('Stock Mode AI parsing error:', err);
    }

    return false;
  }
}
