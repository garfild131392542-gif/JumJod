import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ItemStatus } from '@/lib/types';
import { classifyAndParseMessageWithAI, calculateDueDate, getGeminiApiKey, parseStockMessageWithAI, regexFallbackParser, parseItemEditWithAI, analyzeImageWithAI } from '@/lib/ai';
import {
  createItemFlexBubble,
  createStockFlexBubble,
  createStockActionMenuFlex,
  createStockEditMenuFlex,
  createStockDashboardFlex,
  createStockCreateFlexBubble,
  createModeSelectionFlex,
  createOcrStockConfirmationFlex,
  createOcrReminderConfirmationFlex,
  createPrFlexBubble,
  createCalibrationFlexBubble,
  createPrListMenuFlex,
  createCalibrationListMenuFlex
} from '@/lib/line/flex-templates';
import {
  verifySignature,
  sendLineReply,
  showLineLoadingAnimation,
  markLineMessagesAsRead
} from '@/lib/line/client';
import {
  getUserModeState,
  setUserModeState
} from '@/lib/db/user-state';
import {
  memoryStateCache,
  lastStockContextCache
} from '@/lib/state-cache';

import { handlePostbackEvent } from '@/lib/line/handlers/postback.handler';
import { handleTextEvent } from '@/lib/line/handlers/text.handler';
import { ProfileService, ItemService, PrService, CalibrationService } from '@/services';
import { PrModeController } from '@/lib/line/mode-controllers/pr-mode';

// Initialize Supabase admin client using the service role key to bypass RLS policies
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);



// Helper to detect stock operation from text when parsing has no clear intent or is ambiguous
function detectStockOperation(text: string): 'ADD' | 'SUBTRACT' | 'SET' | 'CHECK' | 'EDIT_NAME' | 'EDIT_DESC' | 'EDIT_MIN' | 'EDIT_PRIORITY' {
  const clean = text.toLowerCase().trim();
  if (clean.includes('แก้ชื่อ') || clean.includes('เปลี่ยนชื่อ')) {
    return 'EDIT_NAME';
  }
  if (clean.includes('แก้ไขรายละเอียด') || clean.includes('แก้รายละเอียด') || clean.includes('แก้ไขคำอธิบาย') || clean.includes('แก้คำอธิบาย') || clean.includes('รายละเอียด') || clean.includes('คำอธิบาย')) {
    return 'EDIT_DESC';
  }
  if (clean.includes('เกณฑ์ขั้นต่ำ') || clean.includes('ขั้นต่ำ') || clean.includes('ตั้งเกณฑ์') || clean.includes('เกณฑ์')) {
    return 'EDIT_MIN';
  }
  if (clean.includes('ความสำคัญ') || clean.includes('ด่วน') || clean.includes('ระดับความสำคัญ')) {
    return 'EDIT_PRIORITY';
  }
  if (clean.includes('ปรับยอด') || clean.includes('ตั้งค่า') || clean.includes('เท่ากับ') || clean.includes('แก้สต็อกเป็น') || clean.includes('เซ็ต') || clean.includes('เซต') || clean.includes('ปรับ')) {
    return 'SET';
  }
  if (clean.includes('เบิก') || clean.includes('หัก') || clean.includes('ลด') || clean.includes('ตัดยอด') || clean.includes('เอาออก')) {
    return 'SUBTRACT';
  }
  if (clean.includes('เพิ่ม') || clean.includes('แอด') || clean.includes('เติม') || clean.includes('บวก')) {
    return 'ADD';
  }
  return 'CHECK';
}


export async function POST(request: Request) {
  try {
    // 0. Protect against Payload Size DoS (Max 5MB)
    const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
    if (contentLength > 5 * 1024 * 1024) {
      return new Response('Payload Too Large', { status: 413 });
    }

    const rawBody = await request.text();
    if (rawBody.length > 5 * 1024 * 1024) {
      return new Response('Payload Too Large', { status: 413 });
    }

    const signature = request.headers.get('x-line-signature');
    const channelSecret = process.env.LINE_CHANNEL_SECRET;

    // Verify signature
    if (channelSecret && signature) {
      const isValid = verifySignature(rawBody, signature, channelSecret);
      if (!isValid) {
        return new Response('Invalid signature', { status: 401 });
      }
    } else if (process.env.NODE_ENV === 'production') {
      return new Response('Missing LINE Channel Secret configuration', { status: 500 });
    } else {
      console.warn('Skipping LINE webhook signature verification because LINE_CHANNEL_SECRET is not configured in development.');
    }

    const payload = JSON.parse(rawBody);
    const events = payload.events || [];

    for (const event of events) {
      const replyToken = event.replyToken;
      const lineUserId = event.source.userId;
      
      if (event.source.type === 'group' || event.source.type === 'room') {
        continue;
      }
      
      const lineGroupId = null;
      const messageText = event.type === 'message' && event.message.type === 'text' ? event.message.text.trim() : '';
      const markAsReadToken = event.markAsReadToken;

      if (!replyToken || !lineUserId) continue;

      // Trigger LINE typing/loading animation immediately in the background
      showLineLoadingAnimation(lineUserId).catch(console.error);

      // Mark messages as read in the background
      if (markAsReadToken) {
        markLineMessagesAsRead(markAsReadToken).catch(console.error);
      }

      // A. Postback Event handling
      if (event.type === 'postback') {
        try {
          const requestUrl = new URL(request.url);
          await handlePostbackEvent(event, supabaseAdmin, requestUrl.origin);
        } catch (error) {
          console.error('Error handling postback:', error);
          await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการประมวลผลคำสั่ง');
        }
        continue;
      }

      if (event.type !== 'message') {
        continue;
      }

      if (event.message.type === 'image') {
        try {
          const messageId = event.message.id;
          
          const { data: profile, error: profileErr } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('line_user_id', lineUserId)
            .single();

          if (profileErr || !profile) {
            await sendLineReply(
              replyToken,
              '🔔 ยินดีต้อนรับสู่ จำจด (JumJod)!\n\nบัญชี LINE นี้ยังไม่ได้เชื่อมต่อกับระบบ กรุณาเข้าสู่ระบบทางหน้าเว็บเพื่อเชื่อมโยงบัญชีก่อนใช้งานนะครับ'
            );
            continue;
          }

          const imageBuffer = await downloadLineMessageContent(messageId);
          const imageBase64 = imageBuffer.toString('base64');
          const mimeType = 'image/jpeg';

          // Upload original image to Supabase Storage bucket 'item-attachments'
          const uniqueId = Math.random().toString(36).substring(2, 10);
          const filePath = `${profile.id}/line-${uniqueId}-${Date.now()}.jpg`;
          
          let imageUrl: string | null = null;
          try {
            const { error: storageError } = await supabaseAdmin.storage
              .from('item-attachments')
              .upload(filePath, imageBuffer, {
                contentType: 'image/jpeg',
                cacheControl: '3600',
                upsert: false
              });

            if (!storageError) {
              const { data } = supabaseAdmin.storage
                .from('item-attachments')
                .getPublicUrl(filePath);
              imageUrl = data.publicUrl;
              console.log('[LINE BOT] Successfully uploaded line image to storage:', imageUrl);
            } else {
              console.error('[LINE BOT] Failed to upload image to storage:', storageError);
            }
          } catch (storageErr) {
            console.error('[LINE BOT] Exception during image upload to storage:', storageErr);
          }

          const apiKey = getGeminiApiKey();
          if (!apiKey) {
            await sendLineReply(replyToken, '❌ ไม่พบ API Key สำหรับวิเคราะห์รูปภาพครับ');
            continue;
          }

          const activeMode = await getUserModeState(profile, lineUserId, supabaseAdmin);
          const ocrResult = await analyzeImageWithAI(imageBase64, mimeType, activeMode, apiKey);
          console.log('[LINE BOT] Image OCR scanning result:', ocrResult);

          if (ocrResult.type === 'STOCK') {
            const items = ocrResult.items || [];
            if (items.length === 0) {
              await sendLineReply(replyToken, '🔍 ไม่พบข้อมูลสิ่งของหรือวัสดุในรูปภาพนี้ครับ');
            } else {
              memoryStateCache.set(lineUserId, {
                action: 'pending_ocr_stock',
                items: items
              });
              const flexCard = createOcrStockConfirmationFlex(items);
              await sendLineReply(replyToken, {
                type: 'flex',
                altText: '📸 ยืนยันข้อมูลสแกนวัสดุสต็อก',
                contents: flexCard
              });
            }
          } else {
            if (!ocrResult.title) {
              await sendLineReply(replyToken, '🔍 ไม่สามารถสแกนข้อความหรือความจำในรูปภาพนี้ได้ครับ');
            } else {
              memoryStateCache.set(lineUserId, {
                action: 'pending_ocr_reminder',
                data: {
                  ...ocrResult,
                  imageUrl: imageUrl
                }
              });
              const flexCard = createOcrReminderConfirmationFlex(ocrResult);
              await sendLineReply(replyToken, {
                type: 'flex',
                altText: '📸 ยืนยันการบันทึกช่วยจำจากภาพ',
                contents: flexCard
              });
            }
          }
        } catch (error: any) {
          console.error('[LINE BOT] Error scanning image:', error);
          await sendLineReply(replyToken, `❌ เกิดข้อผิดพลาดในการสแกนรูปภาพ: ${error.message || error}`);
        }
        continue;
      } else if (event.message.type !== 'text') {
        continue;
      }

      if (event.message.type === 'text') {
        const requestUrl = new URL(request.url);
        const handled = await handleTextEvent(event, supabaseAdmin, requestUrl.origin);
        if (handled) continue;
      }

      const profile = await ProfileService.getProfileByLineId(supabaseAdmin, lineUserId);
      if (!profile) continue;
      const activeMode = lineGroupId ? 'stock' : await getUserModeState(profile, lineUserId, supabaseAdmin);
      const cleanMessageText = messageText.toLowerCase();

      const requestUrl = new URL(request.url);
      const appUrl = requestUrl.origin;

      // Check if message is a PR edit/update command
      const prHandled = await PrModeController.handleMessage(messageText, profile, replyToken, lineUserId, supabaseAdmin, appUrl);
      if (prHandled) continue;

      // Handle PR creation if in PR mode or explicit PR creation command
      if (activeMode === 'pr' || /^pr[:\s]/i.test(messageText.trim()) || /^เปิด\s*pr[:\s]?/i.test(messageText.trim())) {
        let titleText = messageText.trim();
        titleText = titleText.replace(/^(?:เปิด|ติดตาม)?\s*pr[:\s]*/i, '').trim();
        if (!titleText) {
          titleText = messageText.trim();
        }

        const { data: insertedPr, error: insertPrError } = await supabaseAdmin
          .from('pr_requests')
          .insert([
            {
              user_id: profile.id,
              title: titleText,
              status: 'Pending',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          ])
          .select('*')
          .single();

        if (insertPrError || !insertedPr) {
          await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการบันทึกรายการติดตาม PR กรุณาลองใหม่อีกครั้ง');
        } else {
          const bubble = createPrFlexBubble(insertedPr, appUrl);
          await sendLineReply(replyToken, {
            type: 'flex',
            altText: `📑 ตั้งเรื่องติดตาม PR "${insertedPr.title}" เรียบร้อยแล้ว`,
            contents: bubble
          });
        }
        continue;
      }

      // Check if message is a request to view Calibration list
      const isCheckAllCals = /^(ดู|เช็ก|เช็ค|รายการ|แสดง)?\s*(cal|calibrate|การแคล|แคล|เครื่องมือ|เครื่องชั่ง)$/i.test(cleanMessageText) ||
        ['ดูcal', 'เช็กcal', 'เช็คcal', 'รายการcal', 'ดู cal', 'เช็ก cal', 'เช็ค cal', 'ดูเครื่องมือ', 'เช็กเครื่องมือ'].includes(cleanMessageText);

      if (isCheckAllCals) {
        const requestUrl = new URL(request.url);
        const appUrl = requestUrl.origin;
        const { data: matchedCals, error: searchCalErr } = await supabaseAdmin
          .from('lab_calibrations')
          .select('*')
          .eq('user_id', profile.id)
          .order('next_cal_date', { ascending: true })
          .limit(10);

        if (searchCalErr || !matchedCals || matchedCals.length === 0) {
          await sendLineReply(replyToken, '🔬 ไม่พบรายการ Calibrate เครื่องมือของคุณในระบบครับ สามารถพิมพ์เพิ่มเครื่องมือใหม่ได้เลยครับ');
          continue;
        }

        const bubbles = matchedCals.map(cal => createCalibrationFlexBubble(cal, appUrl));
        await sendLineReply(replyToken, {
          type: 'flex',
          altText: '🔬 รายการ Calibrate เครื่องมือวัด Lab ของคุณ',
          contents: {
            type: 'carousel',
            contents: bubbles
          }
        });
        continue;
      }

      // Handle Calibration creation if in Calibration mode or explicit Cal command
      if (activeMode === 'calibration' || /^cal[:\s]/i.test(messageText.trim()) || /^calibrate[:\s]/i.test(messageText.trim())) {
        let textToParse = messageText.trim().replace(/^(?:calibrate|cal)[:\s]*/i, '').trim();
        if (!textToParse) textToParse = messageText.trim();

        const today = new Date();
        const nextYear = new Date(today.setFullYear(today.getFullYear() + 1));
        const pad = (n: number) => String(n).padStart(2, '0');
        let defaultNextDate = `${nextYear.getFullYear()}-${pad(nextYear.getMonth() + 1)}-${pad(nextYear.getDate())}`;

        const dateMatch = textToParse.match(/(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})/);
        if (dateMatch) {
          let day = pad(parseInt(dateMatch[1]));
          let month = pad(parseInt(dateMatch[2]));
          let yearNum = parseInt(dateMatch[3]);
          if (yearNum < 100) yearNum += 2000;
          if (yearNum > 2500) yearNum -= 543;
          defaultNextDate = `${yearNum}-${month}-${day}`;
        }

        let calName = textToParse.replace(/(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})/, '').replace(/(?:ครั้งถัดไป|ครั้งก่อน|วันที่|cal|calibrate)/gi, '').trim();
        if (!calName) calName = textToParse;

        const requestUrl = new URL(request.url);
        const appUrl = requestUrl.origin;

        const { data: insertedCal, error: insertCalError } = await supabaseAdmin
          .from('lab_calibrations')
          .insert([
            {
              user_id: profile.id,
              name: calName,
              next_cal_date: defaultNextDate,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          ])
          .select('*')
          .single();

        if (insertCalError || !insertedCal) {
          await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการบันทึกรายการ Calibrate เครื่องมือ กรุณาลองใหม่อีกครั้ง');
        } else {
          const bubble = createCalibrationFlexBubble(insertedCal, appUrl);
          await sendLineReply(replyToken, {
            type: 'flex',
            altText: `🔬 บันทึกเครื่องมือ "${insertedCal.name}" สำหรับ Calibrate เรียบร้อยแล้ว`,
            contents: bubble
          });
        }
        continue;
      }
      
      // If no mode is active, block and prompt to choose mode
      if (!activeMode) {
        const modeFlex = createModeSelectionFlex();
        await sendLineReply(replyToken, {
          type: 'flex',
          altText: '🤖 กรุณาเลือกโหมดการทำงานก่อนพิมพ์สั่งงานครับ',
          contents: modeFlex
        });
        continue;
      }



      let parsedResult: any = null;
      const userState = memoryStateCache.get(lineUserId);

      // Handle stock pending confirmation state
      if (userState && userState.action === 'stock_pending_confirm') {
        const isYes = /^(ใช่|ใช่ครับ|ใช่ค่ะ|ครับ|ค่ะ|ถูกต้อง|ถูกต้องแล้ว|ok|okay|yes|y|confirm|ยืนยัน)$/i.test(messageText.trim().toLowerCase());
        const isNo = /^(ไม่|ไม่ใช่|ไม่ใช่ครับ|ไม่ใช่ค่ะ|ยกเลิก|no|n|cancel)$/i.test(messageText.trim().toLowerCase());
        
        if (isYes) {
          const pendingStockData = userState.pendingStockData;
          memoryStateCache.delete(lineUserId);
          
          parsedResult = {
            intent: 'STOCK',
            stock_data: pendingStockData
          };
        } else if (isNo) {
          memoryStateCache.delete(lineUserId);
          await sendLineReply(replyToken, '✅ ยกเลิกการยืนยันการดำเนินการแล้วครับ');
          continue;
        } else {
          // If they typed something else, clear confirmation state and let it fall through to normal parsing
          memoryStateCache.delete(lineUserId);
        }
      }

      // Handle stock pending name input
      if (userState && userState.action === 'stock_pending_name') {
        const rawName = messageText.trim();
        let targetStock: any = null;
        let matchedStocks: any[] = [];
        let targetName = rawName;

        // Try exact match on raw name first
        const { data: exactStocks } = await supabaseAdmin
          .from('stocks')
          .select('*')
          .eq('user_id', profile.id)
          .ilike('name', rawName);

        if (exactStocks && exactStocks.length === 1) {
          targetStock = exactStocks[0];
          matchedStocks = [targetStock];
        } else {
          // Fallback to cleaned name matching
          targetName = messageText
            .replace(/^(?:เบิก|หัก|ลด|ตัดยอด|เบิกออก|เพิ่ม|แอด|เติม|ลบ|ตั้ง|เช็ก|ดู|สต็อก|สต๊อก|เช็ค|ปรับยอด|ปรับยอดใหม่|ปรับ)\s*/i, '')
            .replace(/\b\d+\b/g, '')
            .replace(/(?:จำนวน|เท่ากับ|เป็น|ยอด|ชิ้น|กล่อง|ขวด|หลอด|แกลลอน|รีม|อัน|ม้วน|ถุง|ใบ|แท่ง|แพ็ค|แพค|แผ่น|เครื่อง|ตัว|คู่|ชุด|กิโล|ลิตร|มิลลิลิตร|วัน|เครดิต|ด่วน|ทั่วไป|ไม่ด่วน|สำคัญมาก)/g, '')
            .replace(/(?:ครับ|ค่ะ|จ้า|นะ|นะครับ|นะคะ|ด้วย|ด้วยครับ|ด้วยค่ะ|หน่อย|หน่อยครับ|หน่อยค่ะ)\s*$/i, '')
            .replace(/\s+/g, ' ')
            .trim();

          if (targetName) {
            const { data: searchStocks } = await supabaseAdmin
              .from('stocks')
              .select('*')
              .eq('user_id', profile.id)
              .ilike('name', `%${targetName}%`);

            if (searchStocks) {
              matchedStocks = searchStocks;
              const exactMatch = matchedStocks.find(s => (s.name || '').toLowerCase() === targetName.toLowerCase());
              targetStock = exactMatch || (matchedStocks.length === 1 ? matchedStocks[0] : null);
            }
          }
        }

        if (!targetName && !targetStock) {
          await sendLineReply(replyToken, '❌ กรุณาระบุชื่อวัสดุด้วยครับ');
          continue;
        }

        let quantity = userState.quantity;
        let unit = userState.unit;
        if (quantity === null || isNaN(quantity)) {
          const qtyMatch = messageText.match(/\b(\d+)\b/);
          if (qtyMatch) {
            quantity = parseInt(qtyMatch[1]);
            const unitMatch = messageText.match(/(ชิ้น|กล่อง|ขวด|หลอด|แกลลอน|รีม|อัน|ม้วน|ถุง|ใบ|แท่ง|แพ็ค|แพค|แผ่น|เครื่อง|ตัว|คู่|ชุด|กิโล|ลิตร|มิลลิลิตร)/);
            unit = unitMatch ? unitMatch[1] : null;
          }
        }

        if (!targetStock) {
          if (matchedStocks && matchedStocks.length > 1) {
            // Multiple matches found - show carousel and clear pending state
            const bubbles = matchedStocks.slice(0, 9).map(stock => 
              createStockFlexBubble(stock, userState.operation, quantity)
            );
            bubbles.push(createStockCreateFlexBubble(targetName, quantity));
            
            memoryStateCache.delete(lineUserId);

            await sendLineReply(replyToken, {
              type: 'flex',
              altText: `📦 พบวัสดุหลายรายการที่ตรงกับ "${targetName}"`,
              contents: {
                type: 'carousel',
                contents: bubbles
              }
            });
          } else {
            // No match found - show creation prompt card and clear pending state
            memoryStateCache.delete(lineUserId);

            const createNewPostback = `action=stock_create_prompt&name=${targetName}&qty=${quantity || ''}`;
            const notFoundFlex = {
              type: 'bubble',
              body: {
                type: 'box',
                layout: 'vertical',
                spacing: 'md',
                contents: [
                  {
                    type: 'text',
                    text: `🔎 ไม่พบวัสดุชื่อ "${targetName}" ในคลัง`,
                    weight: 'bold',
                    size: 'md',
                    color: '#1e293b',
                    wrap: true
                  },
                  {
                    type: 'text',
                    text: 'คุณต้องการบันทึกแอดวัสดุชิ้นนี้เข้าไปในระบบสต็อกใหม่เลยไหมครับ?',
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
              altText: `⚠️ ไม่พบวัสดุ "${targetName}" ในคลัง`,
              contents: notFoundFlex
            });
          }
          continue;
        }

        // Found exact/single matching item! Check if it's an edit action first
        if (['EDIT_NAME', 'EDIT_DESC', 'EDIT_MIN', 'EDIT_PRIORITY'].includes(userState.operation)) {
          const fieldMap: Record<string, string> = {
            'EDIT_NAME': 'name',
            'EDIT_DESC': 'desc',
            'EDIT_MIN': 'min',
            'EDIT_PRIORITY': 'priority'
          };
          const field = fieldMap[userState.operation] || 'name';
          
          memoryStateCache.set(lineUserId, {
            action: 'stock_editing',
            stockId: targetStock.id,
            stockName: targetStock.name,
            field
          });

          const fieldPrompts: Record<string, string> = {
            name: `🏷️ กรุณาพิมพ์ชื่อใหม่สำหรับวัสดุ "${targetStock.name}":`,
            desc: `📝 กรุณาพิมพ์รายละเอียดใหม่สำหรับวัสดุ "${targetStock.name}":\n(ค่าปัจจุบัน: ${targetStock.description || 'ไม่มี'})`,
            min: `🔔 กรุณาพิมพ์เกณฑ์ขั้นต่ำใหม่สำหรับวัสดุ "${targetStock.name}":\n(ค่าปัจจุบัน: ${targetStock.min_threshold ?? 0})\nพิมพ์เป็นตัวเลข เช่น "5"`,
            priority: `⚡ กรุณาเลือกความสำคัญใหม่สำหรับวัสดุ "${targetStock.name}":\nพิมพ์ "High" (ด่วนมาก), "Medium" (ปานกลาง), หรือ "Low" (ทั่วไป)`
          };

          await sendLineReply(replyToken, fieldPrompts[field]);
          continue;
        }

        // Found exact/single matching item!
        if (quantity !== null && !isNaN(quantity)) {
          // Perform operation immediately
          let newQty = targetStock.quantity;
          if (userState.operation === 'SUBTRACT') {
            newQty = Math.max(0, targetStock.quantity - quantity);
          } else if (userState.operation === 'ADD') {
            newQty = targetStock.quantity + quantity;
          } else if (userState.operation === 'SET') {
            newQty = quantity;
          }

          const { error: updateError } = await supabaseAdmin
            .from('stocks')
            .update({ quantity: newQty, updated_at: new Date().toISOString() })
            .eq('id', targetStock.id);

          memoryStateCache.delete(lineUserId);

          if (updateError) {
            await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการปรับยอดสต็อก');
          } else {
            const opText = userState.operation === 'SUBTRACT' ? 'เบิกออก' : userState.operation === 'ADD' ? 'เติมสต็อก' : 'ปรับยอด';
            const isAlertTriggered = newQty <= targetStock.min_threshold && targetStock.quantity > targetStock.min_threshold;
            const alertMsg = isAlertTriggered ? `\n\n⚠️ **คำเตือน:** ระดับวัสดุลดลงต่ำกว่าเกณฑ์ขั้นต่ำแล้ว! (เกณฑ์: ${targetStock.min_threshold} ${targetStock.unit})` : '';
            await sendLineReply(replyToken, `✅ ทำการ${opText}วัสดุ "${targetStock.name}" เรียบร้อยแล้วครับ!\n\nยอดเดิม: ${targetStock.quantity} ${targetStock.unit}\nทำรายการ: ${quantity} ${targetStock.unit}\nยอดคงเหลือใหม่: ${newQty} ${targetStock.unit} 📦${alertMsg}`);
          }
        } else {
          // Quantity is null! transition state to ask for quantity
          memoryStateCache.set(lineUserId, {
            action: 'stock_pending_qty',
            stockId: targetStock.id,
            operation: userState.operation,
            stockName: targetStock.name,
            stockUnit: targetStock.unit
          });
          const opText = userState.operation === 'SUBTRACT' ? 'เบิก' : userState.operation === 'ADD' ? 'เติม' : 'ปรับยอด';
          await sendLineReply(replyToken, `📦 ต้องการ${opText}วัสดุ "${targetStock.name}" จำนวนเท่าไหร่ดีครับ?\n\n(กรุณาพิมพ์จำนวนเป็นตัวเลข เช่น "5" หรือ "10")`);
        }
        continue;
      }

      // Handle stock pending edit input
      if (userState && userState.action === 'stock_editing') {
        const field = userState.field || 'name';
        const inputText = messageText.trim();

        if (!inputText) {
          await sendLineReply(replyToken, '❌ ข้อมูลห้ามว่างเปล่า กรุณาพิมพ์ใหม่อีกครั้งครับ');
          continue;
        }

        let updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
        let successMessage = '';

        if (field === 'name') {
          let newName = inputText.replace(/^(?:แก้ไขชื่อเป็น|แก้ชื่อเป็น|เปลี่ยนชื่อเป็น|แก้ชื่อรายการเป็น|แก้ไขชื่อ|แก้ชื่อ|เปลี่ยนชื่อ|แก้ไข|แก้|เปลี่ยน|edit|update|ชื่อ|เป็น)\s*/i, '').trim();
          newName = newName.replace(/^(?:เป็น|คือ)\s*/i, '').trim();
          if (!newName) {
            await sendLineReply(replyToken, '❌ ชื่อวัสดุห้ามว่างเปล่า กรุณาพิมพ์ใหม่อีกครั้งครับ');
            continue;
          }
          updatePayload.name = newName;
          successMessage = `✅ แก้ไขชื่อวัสดุจาก "${userState.stockName}" เป็น "${newName}" เรียบร้อยแล้วครับ! 📦`;
        } else if (field === 'desc') {
          updatePayload.description = inputText;
          successMessage = `✅ แก้ไขรายละเอียดของวัสดุ "${userState.stockName}" เรียบร้อยแล้วครับ!`;
        } else if (field === 'min') {
          const numMatch = inputText.match(/\d+/);
          if (!numMatch) {
            await sendLineReply(replyToken, '❌ กรุณาพิมพ์เป็นตัวเลข เช่น "5" หรือ "10" ครับ');
            continue;
          }
          const newMin = parseInt(numMatch[0]);
          updatePayload.min_threshold = newMin;
          successMessage = `✅ ตั้งเกณฑ์ขั้นต่ำของวัสดุ "${userState.stockName}" เป็น ${newMin} เรียบร้อยแล้วครับ! 🔔`;
        } else if (field === 'priority') {
          const priorityMap: Record<string, string> = {
            'high': 'High', 'สูง': 'High', 'ด่วนมาก': 'High',
            'medium': 'Medium', 'กลาง': 'Medium', 'ปานกลาง': 'Medium',
            'low': 'Low', 'ต่ำ': 'Low', 'ทั่วไป': 'Low'
          };
          const priorityKey = inputText.toLowerCase();
          const newPriority = priorityMap[priorityKey] || (
            inputText === 'High' || inputText === 'Medium' || inputText === 'Low' ? inputText : null
          );
          if (!newPriority) {
            await sendLineReply(replyToken, '❌ กรุณาพิมพ์ "High", "Medium", หรือ "Low" เท่านั้นครับ');
            continue;
          }
          updatePayload.priority = newPriority;
          const priorityLabel = newPriority === 'High' ? '🔴 ด่วนมาก' : newPriority === 'Medium' ? '🟡 ปานกลาง' : '🟢 ทั่วไป';
          successMessage = `✅ ตั้งความสำคัญของวัสดุ "${userState.stockName}" เป็น ${priorityLabel} เรียบร้อยแล้วครับ!`;
        } else if (field === 'category') {
          let newCategory = inputText.replace(/^(แก้ไข|แก้|เปลี่ยน|edit|update|หมวดหมู่|หมวด|เป็น)\s*/i, '').trim();
          if (newCategory.toLowerCase().includes('lab') || newCategory.toLowerCase().includes('แล็บ') || newCategory.toLowerCase().includes('ห้องปฏิบัติการ') || newCategory.toLowerCase().includes('laboratory')) {
            updatePayload.category = 'Laboratory';
          } else {
            updatePayload.category = 'อุปกรณ์สำนักงาน';
          }
          successMessage = `✅ แก้ไขหมวดหมู่ของวัสดุ "${userState.stockName}" เป็น "${updatePayload.category}" เรียบร้อยแล้วครับ!`;
        }

        const { error: updateError } = await supabaseAdmin
          .from('stocks')
          .update(updatePayload)
          .eq('id', userState.stockId);

        memoryStateCache.delete(lineUserId);

        if (updateError) {
          await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการแก้ไขข้อมูลวัสดุ');
        } else {
          await sendLineReply(replyToken, successMessage);
        }
        continue;
      }

      
      // Handle stock pending quantity input
      if (userState && userState.action === 'stock_pending_qty') {
        const qtyMatch = messageText.match(/\b(\d+)\b/);
        if (qtyMatch) {
          const qty = parseInt(qtyMatch[1]);
          const { data: stockItem } = await supabaseAdmin
            .from('stocks')
            .select('*')
            .eq('id', userState.stockId)
            .single();

          if (!stockItem) {
            await sendLineReply(replyToken, '❌ ไม่พบวัสดุชิ้นนี้ในสต็อกแล้ว');
            memoryStateCache.delete(lineUserId);
            continue;
          }

          let newQty = stockItem.quantity;
           if (userState.operation === 'SUBTRACT') {
             newQty = Math.max(0, stockItem.quantity - qty);
           } else if (userState.operation === 'ADD') {
             newQty = stockItem.quantity + qty;
           } else if (userState.operation === 'SET' || userState.operation === 'CHECK') {
             newQty = qty;
           }

          const { error: updateError } = await supabaseAdmin
            .from('stocks')
            .update({ quantity: newQty, updated_at: new Date().toISOString() })
            .eq('id', userState.stockId);

          memoryStateCache.delete(lineUserId);

          if (updateError) {
            await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการปรับยอดสต็อก');
          } else {
            const opText = userState.operation === 'SUBTRACT' ? 'เบิกออก' : userState.operation === 'ADD' ? 'เติมสต็อก' : 'ปรับยอด';
            const isAlertTriggered = newQty <= stockItem.min_threshold && stockItem.quantity > stockItem.min_threshold;
            const alertMsg = isAlertTriggered ? `\n\n⚠️ **คำเตือน:** ระดับวัสดุลดลงต่ำกว่าเกณฑ์ขั้นต่ำแล้ว! (เกณฑ์: ${stockItem.min_threshold} ${stockItem.unit})` : '';
            await sendLineReply(replyToken, `✅ ทำการ${opText}วัสดุ "${stockItem.name}" เรียบร้อยแล้วครับ!\n\nยอดเดิม: ${stockItem.quantity} ${stockItem.unit}\nทำรายการ: ${qty} ${stockItem.unit}\nยอดคงเหลือใหม่: ${newQty} ${stockItem.unit} 📦${alertMsg}`);
          }
        } else {
          await sendLineReply(replyToken, '❌ กรุณาระบุจำนวนเป็นตัวเลขอีกครั้งครับ เช่น "5" หรือ "10"');
        }
        continue;
      }

      // Handle stock pending create quantity input
      if (userState && userState.action === 'stock_pending_create_qty') {
        const qtyMatch = messageText.match(/\b(\d+)\b/);
        if (qtyMatch) {
          const qty = parseInt(qtyMatch[1]);
          const category = userState.stockName.includes('lab') || userState.stockName.includes('แล็บ') || userState.stockName.includes('สารเคมี') ? 'Laboratory' : 'อุปกรณ์สำนักงาน';
          
          const { data: newItem, error: createError } = await supabaseAdmin
            .from('stocks')
            .insert([{
              user_id: profile.id,
              name: userState.stockName,
              quantity: qty,
              unit: 'ชิ้น',
              category: category
            }])
            .select('*')
            .single();

          memoryStateCache.delete(lineUserId);

          if (createError || !newItem) {
            await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการสร้างวัสดุใหม่');
          } else {
            await sendLineReply(replyToken, `✅ เพิ่มวัสดุใหม่ "${newItem.name}" จำนวน ${newItem.quantity} ${newItem.unit} เข้าคลังสำเร็จแล้วครับ! 📦`);
          }
        } else {
          await sendLineReply(replyToken, '❌ กรุณาระบุจำนวนเริ่มต้นเป็นตัวเลขอีกครั้งครับ เช่น "10"');
        }
        continue;
      }

      if (userState && userState.action === 'editing') {
        const { data: currentItem } = await supabaseAdmin
          .from('items')
          .select('*')
          .eq('id', userState.itemId)
          .single();

        const apiKey = getGeminiApiKey();
        const updates: any = { updated_at: new Date().toISOString() };
        let parsedByAI = false;

        if (apiKey && currentItem) {
          try {
            const aiUpdates = await parseItemEditWithAI(messageText, currentItem, apiKey);
            console.log('[LINE BOT] AI edit parsing result:', aiUpdates);
            
            if (aiUpdates.title !== undefined) {
              if (aiUpdates.title) {
                updates.title = aiUpdates.title;
              }
            }
            if (aiUpdates.description !== undefined) {
              updates.description = aiUpdates.description;
            }
            if (aiUpdates.reminder_date !== undefined) {
              updates.reminder_date = aiUpdates.reminder_date;
              if (aiUpdates.reminder_date) {
                updates.reminder_sent = false;
              }
            }
            
            parsedByAI = true;
          } catch (err) {
            console.error('[LINE BOT] Error parsing edit with AI, falling back to local:', err);
          }
        }

        if (!parsedByAI) {
          // Fallback local parsing logic
          let updateTitle = messageText.trim();
          const containsNameChangeKeyword = /^(?:แก้ชื่อเป็น|เปลี่ยนชื่อเป็น|แก้ชื่อรายการเป็น|แก้ชื่อ|เปลี่ยนชื่อ|แก้|เปลี่ยน)\s*/i.test(updateTitle);

          const isCancelReminder = /^(ยกเลิกแจ้งเตือน|ไม่แจ้งเตือนแล้ว|ลบวันแจ้งเตือน|ไม่เตือนแล้ว|ลบแจ้งเตือน|ไม่เตือน)/i.test(updateTitle);
          if (isCancelReminder) {
            updates.reminder_date = null;
            const cleanText = updateTitle.replace(/^(ยกเลิกแจ้งเตือน|ไม่แจ้งเตือนแล้ว|ลบวันแจ้งเตือน|ไม่เตือนแล้ว|ลบแจ้งเตือน|ไม่เตือน)\s*/i, '').trim();
            updateTitle = cleanText;
          } else {
            let baseDate = new Date();
            let matchedDate = false;

            const dateMatch = updateTitle.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
            if (dateMatch) {
              const day = parseInt(dateMatch[1]);
              const month = parseInt(dateMatch[2]) - 1;
              let year = parseInt(dateMatch[3]);
              if (year < 100) year += 2000;
              else if (year > 2500) year -= 543;
              
              baseDate = new Date(year, month, day);
              matchedDate = true;
            } else if (updateTitle.includes('พรุ่งนี้')) {
              baseDate.setDate(baseDate.getDate() + 1);
              matchedDate = true;
            } else if (updateTitle.includes('วันนี้')) {
              matchedDate = true;
            }

            let hours = 9;
            let minutes = 0;
            let matchedTime = false;

            const timeMatch = updateTitle.match(/(?:เวลา|at|ตอน)\s*(\d{1,2})[:.](\d{2})/i) || updateTitle.match(/\b(\d{1,2})[:.](\d{2})\b/);
            if (timeMatch) {
              hours = parseInt(timeMatch[1]);
              minutes = parseInt(timeMatch[2]);
              matchedTime = true;
            } else {
              const mongMatch = updateTitle.match(/(\d{1,2})\s*โมง/i);
              if (mongMatch) {
                let h = parseInt(mongMatch[1]);
                if (updateTitle.includes('บ่าย') && h < 12) {
                  h += 12;
                } else if (updateTitle.includes('เย็น') && h < 12) {
                  h += 12;
                } else if (updateTitle.includes('ค่ำ') && h < 12) {
                  h += 12;
                }
                hours = h;
                matchedTime = true;
              }
            }

            if (matchedDate || matchedTime) {
              const pad = (n: number) => String(n).padStart(2, '0');
              const localISO = `${baseDate.getFullYear()}-${pad(baseDate.getMonth() + 1)}-${pad(baseDate.getDate())}T${pad(hours)}:${pad(minutes)}:00+07:00`;
              const remDate = new Date(localISO);
              if (!isNaN(remDate.getTime())) {
                updates.reminder_date = remDate.toISOString();
                updates.reminder_sent = false;
              }

              let titleClean = updateTitle;
              titleClean = titleClean.replace(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g, '').trim();
              titleClean = titleClean.replace(/(?:เวลา|at|ตอน)\s*\d{1,2}[:.]\d{2}/gi, '').trim();
              titleClean = titleClean.replace(/\b\d{1,2}[:.]\d{2}\b/g, '').trim();
              titleClean = titleClean.replace(/\d{1,2}\s*โมง/g, '').trim();
              titleClean = titleClean.replace(/(?:วันนี้|พรุ่งนี้|แจ้งเตือน|เตือน|น\.)/g, '').trim();
              titleClean = titleClean.replace(/^[:\-ー\s\.]+/, '').trim();

              if (!containsNameChangeKeyword) {
                updateTitle = ''; 
              } else {
                updateTitle = titleClean;
              }
            }

            if (containsNameChangeKeyword && updateTitle) {
              updateTitle = updateTitle.replace(/^(?:แก้ชื่อเป็น|เปลี่ยนชื่อเป็น|แก้ชื่อรายการเป็น|แก้ชื่อ|เปลี่ยนชื่อ|แก้|เปลี่ยน)\s*/i, '').trim();
              updateTitle = updateTitle.replace(/^[:\-ー\s\.]+/, '').trim();
            }
          }

          if (updateTitle) {
            updates.title = updateTitle;
          }
        }

        const { data: updatedItem, error: updateError } = await supabaseAdmin
          .from('items')
          .update(updates)
          .eq('id', userState.itemId)
          .select('*')
          .single();

        memoryStateCache.delete(lineUserId);

        if (updateError || !updatedItem) {
          await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการแก้ไขข้อมูลรายการ');
        } else {
          const requestUrl = new URL(request.url);
          const appUrl = requestUrl.origin;
          const bubble = createItemFlexBubble(updatedItem, appUrl);
          await sendLineReply(replyToken, [
            `✅ แก้ไขข้อมูลรายการ "${userState.itemTitle}" เรียบร้อยแล้วครับ!`,
            {
              type: 'flex',
              altText: `📄 รายการที่แก้ไขแล้ว`,
              contents: bubble
            }
          ]);
        }
        continue;
      }

      if (userState && userState.action === 'editing_pr_field') {
        const field = userState.field;
        const val = messageText.trim();
        const targetPr = await PrService.getPrById(supabaseAdmin, userState.itemId);

        memoryStateCache.delete(lineUserId);

        if (!targetPr) {
          await sendLineReply(replyToken, '❌ ไม่พบรายการ PR นี้ หรืออาจถูกลบไปแล้ว');
          continue;
        }

        const updates: any = {};

        if (field === 'subtotal') {
          const subMatch = val.match(/([0-9\.,]+)(?:\s*(?:vat|ภาษี)\s*([0-9\.,]+))?/i);
          if (subMatch) {
            const subNum = parseFloat(subMatch[1].replace(/,/g, '')) || 0;
            const vatNum = subMatch[2] ? parseFloat(subMatch[2].replace(/,/g, '')) : Math.round(subNum * 0.07 * 100) / 100;
            updates.subtotal = subNum;
            updates.vat_amount = vatNum;
            updates.total_amount = Math.round((subNum + vatNum) * 100) / 100;
          }
        } else {
          updates[field] = val;
        }

        const updatedPr = await PrService.updatePr(supabaseAdmin, targetPr.id, updates);
        if (!updatedPr) {
          await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการแก้ไขข้อมูล PR');
        } else {
          const requestUrl = new URL(request.url);
          const appUrl = requestUrl.origin;
          const bubble = createPrFlexBubble(updatedPr, appUrl);
          await sendLineReply(replyToken, [
            `✅ อัปเดต${userState.fieldName || field} เป็น "${val}" เรียบร้อยแล้วครับ!`,
            {
              type: 'flex',
              altText: `📄 รายการ PR ที่แก้ไขแล้ว`,
              contents: bubble
            }
          ]);
        }
        continue;
      }

      if (userState && userState.action === 'editing_cal_field') {
        const val = messageText.trim();
        const targetCal = await CalibrationService.getCalById(supabaseAdmin, userState.itemId);

        memoryStateCache.delete(lineUserId);

        if (!targetCal) {
          await sendLineReply(replyToken, '❌ ไม่พบรายการ Calibration นี้ หรืออาจถูกลบไปแล้ว');
          continue;
        }

        const { error: updateError } = await supabaseAdmin
          .from('lab_calibrations')
          .update({ name: val, updated_at: new Date().toISOString() })
          .eq('id', targetCal.id);

        if (updateError) {
          await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการแก้ไขชื่อเครื่องมือ');
        } else {
          const requestUrl = new URL(request.url);
          const appUrl = requestUrl.origin;
          const bubble = createCalibrationFlexBubble({ ...targetCal, name: val }, appUrl);
          await sendLineReply(replyToken, [
            `✅ อัปเดตชื่อเครื่องมือวัดจาก "${targetCal.name}" เป็น "${val}" เรียบร้อยแล้วครับ!`,
            {
              type: 'flex',
              altText: `🔬 รายการเครื่องมือที่แก้ไขแล้ว`,
              contents: bubble
            }
          ]);
        }
        continue;
      }

      if (userState && userState.action === 'editing_pr') {
        const text = messageText.trim();
        const targetPr = await PrService.getPrById(supabaseAdmin, userState.itemId);

        memoryStateCache.delete(lineUserId);

        if (!targetPr) {
          await sendLineReply(replyToken, '❌ ไม่พบรายการ PR นี้ หรืออาจถูกลบไปแล้ว');
          continue;
        }

        const updates: any = {};
        const prNoMatch = text.match(/(?:pr_no|เลข\s*pr|pr)[:\s]*([a-z0-9\-_/]+)/i);
        const poNoMatch = text.match(/(?:po_no|เลข\s*po|po)[:\s]*([a-z0-9\-_/]+)/i);
        const qtNoMatch = text.match(/(?:qt_no|เลข\s*qt|qt)[:\s]*([a-z0-9\-_/]+)/i);
        const notesMatch = text.match(/(?:หมายเหตุ|notes)[:\s]*([^\n]+)/i);

        if (prNoMatch) updates.pr_no = prNoMatch[1].trim();
        if (poNoMatch) updates.po_no = poNoMatch[1].trim();
        if (qtNoMatch) updates.qt_no = qtNoMatch[1].trim();
        if (notesMatch) updates.notes = notesMatch[1].trim();

        if (Object.keys(updates).length === 0) {
          if (/^pr[-_\s]?\d+/i.test(text)) {
            updates.pr_no = text;
            if (targetPr.status === 'Pending') updates.status = 'PR Issued';
          } else if (/^po[-_\s]?\d+/i.test(text)) {
            updates.po_no = text;
            if (targetPr.status === 'Pending' || targetPr.status === 'PR Issued') updates.status = 'PO Issued';
          } else if (/^qt[-_\s]?\d+/i.test(text)) {
            updates.qt_no = text;
          } else {
            updates.title = text;
          }
        }

        const updatedPr = await PrService.updatePr(supabaseAdmin, targetPr.id, updates);

        if (!updatedPr) {
          await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการแก้ไขรายการ PR');
        } else {
          const requestUrl = new URL(request.url);
          const appUrl = requestUrl.origin;
          const bubble = createPrFlexBubble(updatedPr, appUrl);
          await sendLineReply(replyToken, [
            `✅ แก้ไขข้อมูลรายการ PR "${updatedPr.title}" เรียบร้อยแล้วครับ!`,
            {
              type: 'flex',
              altText: `📄 รายการ PR ที่แก้ไขแล้ว`,
              contents: bubble
            }
          ]);
        }
        continue;
      }

      if (userState && userState.action === 'editing_cal') {
        const updates: any = { updated_at: new Date().toISOString() };
        
        const dateMatch = messageText.match(/(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})/);
        if (dateMatch) {
          const pad = (n: number) => String(n).padStart(2, '0');
          let day = pad(parseInt(dateMatch[1]));
          let month = pad(parseInt(dateMatch[2]));
          let yearNum = parseInt(dateMatch[3]);
          if (yearNum < 100) yearNum += 2000;
          if (yearNum > 2500) yearNum -= 543;
          updates.next_cal_date = `${yearNum}-${month}-${day}`;

          const cleanName = messageText.replace(/(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})/, '').trim();
          if (cleanName) {
            updates.name = cleanName;
          }
        } else {
          updates.name = messageText.trim();
        }

        const { data: updatedCal, error: updateError } = await supabaseAdmin
          .from('lab_calibrations')
          .update(updates)
          .eq('id', userState.itemId)
          .select('*')
          .single();

        memoryStateCache.delete(lineUserId);

        if (updateError || !updatedCal) {
          await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการแก้ไขรายการ Calibrate');
        } else {
          const requestUrl = new URL(request.url);
          const appUrl = requestUrl.origin;
          const bubble = createCalibrationFlexBubble(updatedCal, appUrl);
          await sendLineReply(replyToken, [
            `✅ แก้ไขเครื่องมือ Calibrate "${updatedCal.name}" เรียบร้อยแล้วครับ!`,
            {
              type: 'flex',
              altText: `📄 รายการ Calibrate ที่แก้ไขแล้ว`,
              contents: bubble
            }
          ]);
        }
        continue;
      }

      // 4. Initial Request intent classification using AI
      if (!parsedResult) {
        if (activeMode === 'stock') {
          console.log(`[LINE BOT] In stock mode, parsing stock message directly: "${messageText}"`);
          const apiKey = getGeminiApiKey();
          try {
            const stockData = await parseStockMessageWithAI(messageText, apiKey || '');
            parsedResult = {
              intent: 'STOCK',
              stock_data: stockData
            };
          } catch (err) {
            console.error('[LINE BOT] Error parsing stock message directly, falling back to local:', err);
            const fallback = regexFallbackParser(messageText, []);
            if (fallback.intent === 'STOCK') {
              parsedResult = fallback;
            } else {
              parsedResult = {
                intent: 'STOCK',
                stock_data: {
                  action: 'CHECK',
                  name: messageText.trim(),
                  quantity: null,
                  unit: null
                }
              };
            }
          }
        } else {
          console.log(`[LINE BOT] Classifying user query: "${messageText}"`);
          const existingItems = await ItemService.getItemsByUserId(supabaseAdmin, profile.id, false, 30);
          parsedResult = await classifyAndParseMessageWithAI(messageText, existingItems, activeMode);
        }
      } else if (activeMode === 'reminder') {
        if (parsedResult.intent === 'STOCK') {
          // If they typed stock action in reminder mode, tell them to switch mode
          await sendLineReply(replyToken, "⚠️ ตอนนี้คุณอยู่ในโหมด **'บันทึกช่วยจำพร้อมแจ้งเตือน'** ครับ หากต้องการจัดการสต็อกวัสดุ กรุณาพิมพ์ 'สต็อก' เพื่อสลับโหมดก่อนนะครับ");
          continue;
        }
      }

      // In group chats, only permit STOCK intent. If they try anything else (e.g. reminders), ignore it.
      if (lineGroupId && parsedResult.intent !== 'STOCK') {
        continue;
      }

      switch (parsedResult.intent) {
        case 'STOCK': {
          const stockData = parsedResult.stock_data;
          if (!stockData) {
            await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการตีความข้อมูลสต็อก');
            continue;
          }

          const parsedSearchName = stockData.name || '';
          let targetStock: any = null;
          let matchedStocks: any[] = [];

          // 1. Try finding stock item by exact/inclusion matching first (helps with units/digits names)
          const { data: allStocks } = await supabaseAdmin
            .from('stocks')
            .select('*')
            .eq('user_id', profile.id);

          if (allStocks) {
            const matchedByInclusion = allStocks.filter((s: any) => {
              const cleanName = (s.name || '').toLowerCase().trim();
              return cleanName && messageText.toLowerCase().includes(cleanName);
            });

            if (matchedByInclusion.length > 0) {
              matchedByInclusion.sort((a: any, b: any) => (b.name || '').length - (a.name || '').length);
              targetStock = matchedByInclusion[0];
              matchedStocks = [targetStock];
            }
          }

          let searchName = targetStock ? targetStock.name : parsedSearchName;

          // Check if searchName is generic or empty, in which case we fall back to the last accessed stock item context!
          const isGenericOpName = /^(ต้องการ)?(เพิ่ม|ลด|เบิก|หัก|ตัด|เติม|ปรับ|แก้ไข)(ยอด|จำนวน|สต็อก|สต๊อก|รายละเอียด|ข้อมูล|ชื่อ|เกณฑ์|ความสำคัญ)?$/i.test(searchName.trim());
          if (!targetStock && (!searchName || searchName.trim() === '' || isGenericOpName)) {
            const lastStock = lastStockContextCache.get(lineUserId);
            if (lastStock) {
              const { data: cachedStock } = await supabaseAdmin
                .from('stocks')
                .select('*')
                .eq('id', lastStock.id)
                .single();
              if (cachedStock) {
                targetStock = cachedStock;
                searchName = cachedStock.name;
                matchedStocks = [cachedStock];
              }
            }
          }

          if (!targetStock && searchName) {
            const { data: searchStocks } = await supabaseAdmin
              .from('stocks')
              .select('*')
              .eq('user_id', profile.id)
              .ilike('name', `%${searchName}%`);

            if (searchStocks) {
              matchedStocks = searchStocks;
              const exactMatch = matchedStocks.find(s => (s.name || '').toLowerCase() === searchName.toLowerCase());
              targetStock = exactMatch || (matchedStocks.length === 1 ? matchedStocks[0] : null);
            }
          }

          // If we found a unique targetStock, store it as the last accessed stock item context
          if (targetStock) {
            lastStockContextCache.set(lineUserId, { id: targetStock.id, name: targetStock.name });
          }
          
          // If material name is completely missing, prompt user for name and save conversational state
          if (!searchName || searchName.trim() === '') {
            const detectedOp = detectStockOperation(messageText);
            const qtyMatch = messageText.match(/\b(\d+)\b/);
            const quantity = qtyMatch ? parseInt(qtyMatch[1]) : null;
            
            // Extract unit if quantity is present
            const unitMatch = messageText.match(/(ชิ้น|กล่อง|ขวด|หลอด|แกลลอน|รีม|อัน|ม้วน|ถุง|ใบ|แท่ง|แพ็ค|แพค|แผ่น|เครื่อง|ตัว|คู่|ชุด|กิโล|ลิตร|มิลลิลิตร)/);
            const unit = unitMatch ? unitMatch[1] : null;

            memoryStateCache.set(lineUserId, {
              action: 'stock_pending_name',
              operation: detectedOp,
              quantity: quantity,
              unit: unit
            });

            const opText = detectedOp === 'SUBTRACT' ? 'เบิก' : 
                           detectedOp === 'ADD' ? 'เติม' : 
                           detectedOp === 'SET' ? 'ปรับยอด' : 
                           detectedOp === 'EDIT_NAME' ? 'แก้ไขชื่อ' :
                           detectedOp === 'EDIT_DESC' ? 'แก้ไขรายละเอียด' :
                           detectedOp === 'EDIT_MIN' ? 'แก้ไขเกณฑ์ขั้นต่ำ' :
                           detectedOp === 'EDIT_PRIORITY' ? 'แก้ไขความสำคัญ' :
                           'ตรวจสอบ';
            const qtyText = quantity ? ` "${quantity} ${unit || 'ชิ้น'}"` : '';
            await sendLineReply(replyToken, `🔍 คุณต้องการ${opText}สต็อก${qtyText} แต่ยังไม่ได้ระบุชื่อวัสดุ คุณต้องการจัดการวัสดุชิ้นไหนครับ?`);
            continue;
          }
          
          // Handle confirm_message (if AI outputted a low confidence suggestion)
          if (stockData.confirm_message) {
            memoryStateCache.set(lineUserId, {
              action: 'stock_pending_confirm',
              pendingStockData: {
                ...stockData,
                confirm_message: null // Clear to avoid loops
              },
              targetStockId: targetStock?.id || null,
              searchName: searchName
            });
            await sendLineReply(replyToken, stockData.confirm_message);
            continue;
          }

          // Handle CONFIRM_NEEDED fallback
          if (stockData.action === 'CONFIRM_NEEDED') {
            await sendLineReply(replyToken, `🤔 ไม่แน่ใจว่าต้องการทำอะไรกับวัสดุ "${searchName}" กรุณาลองพิมพ์ใหม่ให้ชัดเจนขึ้นครับ`);
            continue;
          }

          // Handle EDIT_NAME / EDIT_DESC / EDIT_MIN / EDIT_PRIORITY / EDIT_CATEGORY via AI text command
          if (['EDIT_NAME', 'EDIT_DESC', 'EDIT_MIN', 'EDIT_PRIORITY', 'EDIT_CATEGORY'].includes(stockData.action)) {
            if (lineGroupId) {
              await sendLineReply(replyToken, '❌ ไม่ได้รับสิทธิ์ในการแก้ไขข้อมูลรายละเอียดวัสดุผ่านกลุ่มไลน์ครับ');
              continue;
            }
            // Find target stock item
            let editTarget = targetStock;
            if (!editTarget) {
              const { data: editMatchedStocks } = await supabaseAdmin
                .from('stocks')
                .select('*')
                .eq('user_id', profile.id)
                .ilike('name', `%${searchName}%`);
              
              const editExact = editMatchedStocks?.find(s => s.name.toLowerCase() === searchName.toLowerCase());
              editTarget = editExact || (editMatchedStocks?.length === 1 ? editMatchedStocks[0] : null);
            }

            if (!editTarget) {
              if (matchedStocks && matchedStocks.length > 1) {
                // Multiple matches - show carousel to pick
                const bubbles = matchedStocks.slice(0, 9).map(s => createStockFlexBubble(s, 'CHECK', null));
                await sendLineReply(replyToken, {
                  type: 'flex',
                  altText: `📦 พบวัสดุหลายรายการที่ตรงกับ "${searchName}" กรุณาเลือก`,
                  contents: { type: 'carousel', contents: bubbles }
                });
              } else {
                await sendLineReply(replyToken, `❌ ไม่พบวัสดุชื่อ "${searchName}" ในคลัง กรุณาตรวจสอบชื่ออีกครั้งครับ`);
              }
              continue;
            }

            // Conversational Editing Flow: if edit parameter is missing, transition to editing state
            if (stockData.action === 'EDIT_NAME' && !stockData.new_name) {
              memoryStateCache.set(lineUserId, { action: 'stock_editing', stockId: editTarget.id, stockName: editTarget.name, field: 'name' });
              await sendLineReply(replyToken, `🏷️ กรุณาพิมพ์ชื่อใหม่สำหรับวัสดุ "${editTarget.name}":`);
              continue;
            }
            if (stockData.action === 'EDIT_DESC' && !stockData.description) {
              memoryStateCache.set(lineUserId, { action: 'stock_editing', stockId: editTarget.id, stockName: editTarget.name, field: 'desc' });
              await sendLineReply(replyToken, `📝 กรุณาพิมพ์รายละเอียดใหม่สำหรับวัสดุ "${editTarget.name}":\n(ค่าปัจจุบัน: ${editTarget.description || 'ไม่มี'})`);
              continue;
            }
            if (stockData.action === 'EDIT_MIN' && (stockData.new_min_threshold === null || stockData.new_min_threshold === undefined)) {
              memoryStateCache.set(lineUserId, { action: 'stock_editing', stockId: editTarget.id, stockName: editTarget.name, field: 'min' });
              await sendLineReply(replyToken, `🔔 กรุณาพิมพ์เกณฑ์ขั้นต่ำใหม่สำหรับวัสดุ "${editTarget.name}":\n(ค่าปัจจุบัน: ${editTarget.min_threshold ?? 0})\nพิมพ์เป็นตัวเลข เช่น "5"`);
              continue;
            }
            if (stockData.action === 'EDIT_PRIORITY' && !stockData.new_priority) {
              memoryStateCache.set(lineUserId, { action: 'stock_editing', stockId: editTarget.id, stockName: editTarget.name, field: 'priority' });
              await sendLineReply(replyToken, `⚡ กรุณาเลือกความสำคัญใหม่สำหรับวัสดุ "${editTarget.name}":\nพิมพ์ "High" (ด่วนมาก), "Medium" (ปานกลาง), หรือ "Low" (ทั่วไป)`);
              continue;
            }
            if (stockData.action === 'EDIT_CATEGORY' && !stockData.category) {
              memoryStateCache.set(lineUserId, { action: 'stock_editing', stockId: editTarget.id, stockName: editTarget.name, field: 'category' });
              await sendLineReply(replyToken, `📦 กรุณาระบุหมวดหมู่ใหม่สำหรับวัสดุ "${editTarget.name}":\n(ค่าปัจจุบัน: ${editTarget.category || 'ไม่มี'})\nพิมพ์ "อุปกรณ์สำนักงาน" หรือ "Laboratory"`);
              continue;
            }

            let updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
            let successMessage = '';

            if (stockData.action === 'EDIT_NAME' && stockData.new_name) {
              updatePayload.name = stockData.new_name;
              successMessage = `✅ แก้ไขชื่อวัสดุจาก "${editTarget.name}" เป็น "${stockData.new_name}" เรียบร้อยแล้วครับ! 📦`;
            } else if (stockData.action === 'EDIT_DESC') {
              updatePayload.description = stockData.description || '';
              successMessage = `✅ แก้ไขรายละเอียดของวัสดุ "${editTarget.name}" เรียบร้อยแล้วครับ!`;
            } else if (stockData.action === 'EDIT_MIN' && stockData.new_min_threshold !== null && stockData.new_min_threshold !== undefined) {
              updatePayload.min_threshold = stockData.new_min_threshold;
              successMessage = `✅ ตั้งเกณฑ์ขั้นต่ำของวัสดุ "${editTarget.name}" เป็น ${stockData.new_min_threshold} เรียบร้อยแล้วครับ! 🔔`;
            } else if (stockData.action === 'EDIT_PRIORITY' && stockData.new_priority) {
              updatePayload.priority = stockData.new_priority;
              const priorityLabel = stockData.new_priority === 'High' ? '🔴 ด่วนมาก' : stockData.new_priority === 'Medium' ? '🟡 ปานกลาง' : '🟢 ทั่วไป';
              successMessage = `✅ ตั้งความสำคัญของวัสดุ "${editTarget.name}" เป็น ${priorityLabel} เรียบร้อยแล้วครับ!`;
            } else if (stockData.action === 'EDIT_CATEGORY' && stockData.category) {
              updatePayload.category = stockData.category;
              successMessage = `✅ ย้ายหมวดหมู่ของวัสดุ "${editTarget.name}" ไปยัง "${stockData.category}" เรียบร้อยแล้วครับ! 📦`;
            } else {
              await sendLineReply(replyToken, `❌ ไม่สามารถแก้ไขข้อมูลได้ กรุณาระบุข้อมูลใหม่ให้ชัดเจนขึ้นครับ เช่น "แก้ชื่อ ${editTarget.name} เป็น [ชื่อใหม่]"`);
              continue;
            }

            const { error: editError } = await supabaseAdmin.from('stocks').update(updatePayload).eq('id', editTarget.id);
            if (editError) {
              await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการแก้ไขข้อมูลวัสดุ');
            } else {
              await sendLineReply(replyToken, successMessage);
            }
            continue;
          }

          if (!matchedStocks || matchedStocks.length === 0) {
            const { data: searchStocks, error: searchError } = await supabaseAdmin
              .from('stocks')
              .select('*')
              .eq('user_id', profile.id)
              .ilike('name', `%${searchName}%`);

            if (searchError) {
              await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการค้นหาคลังวัสดุ');
              continue;
            }
            matchedStocks = searchStocks || [];
          }

          // Case 1: No match found
          if (!matchedStocks || matchedStocks.length === 0) {
            if (lineGroupId) {
              await sendLineReply(
                replyToken,
                `❌ ไม่พบวัสดุชื่อ "${searchName}" ในคลังสต็อกร่วมครับ\n(การสั่งงานผ่านกลุ่มไลน์ไม่ได้รับสิทธิ์ในการเพิ่มวัสดุใหม่ กรุณาติดต่อผู้ดูแลคลังสต็อกโดยตรงเพื่อทำการเพิ่มรายการวัสดุนี้)`
              );
              continue;
            }
            if (stockData.action === 'ADD' && stockData.quantity !== null) {
              // Create immediately
              const category = searchName.includes('lab') || searchName.includes('แล็บ') || searchName.includes('สารเคมี') ? 'Laboratory' : 'อุปกรณ์สำนักงาน';
              const { data: newItem, error: createError } = await supabaseAdmin
                .from('stocks')
                .insert([{
                  user_id: profile.id,
                  name: searchName,
                  quantity: stockData.quantity,
                  unit: stockData.unit || 'ชิ้น',
                  category: category,
                  priority: stockData.priority || 'Medium',
                  min_threshold: stockData.min_threshold || 0
                }])
                .select('*')
                .single();

              if (createError || !newItem) {
                await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการสร้างวัสดุใหม่');
              } else {
                await sendLineReply(replyToken, `✅ ไม่พบวัสดุในคลัง จึงทำการสร้างวัสดุใหม่:\n📦 "${newItem.name}" จำนวนเริ่มต้น ${newItem.quantity} ${newItem.unit} สำเร็จแล้วครับ!`);
              }
            } else {
              const createNewPostback = `action=stock_create_prompt&name=${searchName}&qty=${stockData.quantity || ''}`;
              
              const notFoundFlex = {
                type: 'bubble',
                body: {
                  type: 'box',
                  layout: 'vertical',
                  spacing: 'md',
                  contents: [
                    {
                      type: 'text',
                      text: `🔎 ไม่พบวัสดุชื่อ "${searchName}" ในคลัง`,
                      weight: 'bold',
                      size: 'md',
                      color: '#1e293b',
                      wrap: true
                    },
                    {
                      type: 'text',
                      text: 'คุณต้องการบันทึกแอดวัสดุชิ้นนี้เข้าไปในระบบสต็อกใหม่เลยไหมครับ?',
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
                altText: `⚠️ ไม่พบวัสดุ "${searchName}" ในคลัง`,
                contents: notFoundFlex
              });
            }
            continue;
          }

          // Case 2: Exact name match found (or exactly 1 match)
          const exactMatch = matchedStocks.find(s => (s.name || '').toLowerCase() === searchName.toLowerCase());
          targetStock = targetStock || exactMatch || (matchedStocks.length === 1 ? matchedStocks[0] : null);

          if (targetStock && stockData.action === 'DELETE') {
            if (lineGroupId) {
              await sendLineReply(replyToken, '❌ สมาชิกกลุ่มไม่ได้รับอนุญาตให้ลบวัสดุออกจากคลังครับ');
              continue;
            }
            const { error: deleteError } = await supabaseAdmin
              .from('stocks')
              .delete()
              .eq('id', targetStock.id);

            if (deleteError) {
              await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการลบวัสดุออกจากคลัง');
            } else {
              await sendLineReply(replyToken, `🗑️ ลบวัสดุ "${targetStock.name}" ออกจากคลังเรียบร้อยแล้วครับ!`);
            }
            continue;
          }

          // Only update category if user explicitly requested a category change (not inferred)
          // Guard: Category should only be updated if the original action was specifically about category
          const isCategoryChangeRequest = /ย้ายหมวด|เปลี่ยนหมวด|ย้ายไป|เพิ่มในหมวด|ใส่ไว้หมวด/i.test(messageText);
          if (targetStock && stockData.category && isCategoryChangeRequest) {
            const { error: updateError } = await supabaseAdmin
              .from('stocks')
              .update({ category: stockData.category, updated_at: new Date().toISOString() })
              .eq('id', targetStock.id);

            if (updateError) {
              await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการย้ายหมวดหมู่ของวัสดุ');
            } else {
              const catLabel = stockData.category === 'Laboratory' ? '🔬 Laboratory' : '💼 อุปกรณ์สำนักงาน';
              await sendLineReply(replyToken, `✅ ย้ายหมวดหมู่ของวัสดุ "${targetStock.name}" ไปที่ "${catLabel}" เรียบร้อยแล้วครับ!`);
            }
            continue;
          }

          // If CHECK action, show the item as an Action Menu Flex Card directly containing all action buttons
          if (targetStock && stockData.action === 'CHECK') {
            await sendLineReply(replyToken, {
              type: 'flex',
              altText: `📦 จัดการวัสดุ "${targetStock.name}"`,
              contents: createStockActionMenuFlex(targetStock)
            });
            continue;
          }

          // If targetStock is matched, but quantity is null and action is ADD/SUBTRACT/SET, prompt for quantity
          if (targetStock && stockData.quantity === null && ['ADD', 'SUBTRACT', 'SET'].includes(stockData.action)) {
            memoryStateCache.set(lineUserId, {
              action: 'stock_pending_qty',
              stockId: targetStock.id,
              operation: stockData.action,
              stockName: targetStock.name,
              stockUnit: targetStock.unit
            });
            const opText = stockData.action === 'SUBTRACT' ? 'เบิก' : stockData.action === 'ADD' ? 'เติม' : 'ปรับยอด';
            await sendLineReply(replyToken, `📦 ต้องการ${opText}วัสดุ "${targetStock.name}" จำนวนเท่าไหร่ดีครับ?\n\n(กรุณาพิมพ์จำนวนเป็นตัวเลข เช่น "5" หรือ "10")`);
            continue;
          }

          if (targetStock && stockData.quantity !== null) {
            let newQty = targetStock.quantity;
            if (stockData.action === 'SUBTRACT') {
              newQty = Math.max(0, targetStock.quantity - stockData.quantity);
            } else if (stockData.action === 'ADD') {
              newQty = targetStock.quantity + stockData.quantity;
            } else if (stockData.action === 'SET') {
              newQty = stockData.quantity;
            }

            const { error: updateError } = await supabaseAdmin
              .from('stocks')
              .update({ quantity: newQty, updated_at: new Date().toISOString() })
              .eq('id', targetStock.id);

            if (updateError) {
              await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการปรับยอดสต็อก');
            } else {
              const opText = stockData.action === 'SUBTRACT' ? 'เบิกออก' : stockData.action === 'ADD' ? 'เติมสต็อก' : 'ปรับยอด';
              const isAlertTriggered = newQty <= targetStock.min_threshold && targetStock.quantity > targetStock.min_threshold;
              const alertMsg = isAlertTriggered ? `\n\n⚠️ **คำเตือน:** ระดับวัสดุลดลงต่ำกว่าเกณฑ์ขั้นต่ำแล้ว! (เกณฑ์: ${targetStock.min_threshold} ${targetStock.unit})` : '';
              await sendLineReply(replyToken, `✅ ทำการ${opText}วัสดุ "${targetStock.name}" เรียบร้อยแล้วครับ!\n\nยอดเดิม: ${targetStock.quantity} ${targetStock.unit}\nทำรายการ: ${stockData.quantity} ${targetStock.unit}\nยอดคงเหลือใหม่: ${newQty} ${targetStock.unit} 📦${alertMsg}`);
            }
            continue;
          }

          // Case 3: Multiple matches or quantity is missing
          const sortedStocks = matchedStocks.sort((a, b) => a.name.localeCompare(b.name));
          const bubbles = sortedStocks.slice(0, 9).map(stock => createStockFlexBubble(stock, stockData.action, stockData.quantity));
          
          // Append option to create as new item card at the end of the carousel (Only if NOT in group chat)
          if (searchName && !lineGroupId) {
            bubbles.push(createStockCreateFlexBubble(searchName, stockData.quantity));
          }

          await sendLineReply(replyToken, {
            type: 'flex',
            altText: `📦 รายการคลังที่ใกล้เคียงกับ "${searchName}"`,
            contents: {
              type: 'carousel',
              contents: bubbles
            }
          });
          break;
        }

        case 'SEARCH': {
          const query = parsedResult.search_query || '';
          
          const { data: searchResults, error: searchError } = await supabaseAdmin
            .from('items')
            .select('*')
            .eq('user_id', profile.id)
            .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
            .order('updated_at', { ascending: false })
            .limit(10);

          if (searchError || !searchResults || searchResults.length === 0) {
            await sendLineReply(replyToken, `🔍 ไม่พบรายการบันทึกใดๆ ที่เกี่ยวข้องกับ "${query}"`);
          } else {
            const requestUrl = new URL(request.url);
            const appUrl = requestUrl.origin;
            
            const bubbles = searchResults.map(item => createItemFlexBubble(item, appUrl));
            const flexMessage = {
              type: 'flex',
              altText: `🔍 ผลการค้นหาสำหรับ "${query}"`,
              contents: {
                type: 'carousel',
                contents: bubbles
              }
            };
            await sendLineReply(replyToken, flexMessage);
          }
          break;
        }

        case 'DELETE': {
          if (parsedResult.item_id) {
            const { data: itemToDelete } = await supabaseAdmin
              .from('items')
              .select('title')
              .eq('id', parsedResult.item_id)
              .single();

            const { error: deleteError } = await supabaseAdmin
              .from('items')
              .delete()
              .eq('id', parsedResult.item_id);

            if (deleteError) {
              await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการลบรายการ');
            } else {
              await sendLineReply(replyToken, `🗑️ ลบรายการ "${itemToDelete?.title || 'รายการ'}" เรียบร้อยแล้วครับ!`);
            }
          } else {
            await sendLineReply(replyToken, '❌ ไม่พบรายการที่คุณต้องการลบ กรุณาระบุชื่อรหัสท้าย 3 ตัวของรายการให้ชัดเจนในข้อความครับ');
          }
          break;
        }

        case 'COMPLETE': {
          if (parsedResult.item_id) {
            const { data: itemToComplete } = await supabaseAdmin
              .from('items')
              .select('*')
              .eq('id', parsedResult.item_id)
              .single();

            if (!itemToComplete) {
              await sendLineReply(replyToken, '❌ ไม่พบรายการที่ระบุ');
              break;
            }

            const { data: completedItem, error: completeError } = await supabaseAdmin
              .from('items')
              .update({
                status: 'Issuing Item',
                updated_at: new Date().toISOString()
              })
              .eq('id', parsedResult.item_id)
              .select('*')
              .single();

            if (completeError || !completedItem) {
              await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการบันทึกสำเร็จ');
            } else {
              const requestUrl = new URL(request.url);
              const appUrl = requestUrl.origin;
              const bubble = createItemFlexBubble(completedItem, appUrl);
              await sendLineReply(replyToken, {
                type: 'flex',
                altText: `🎉 บันทึกความสำเร็จรายการ "${completedItem.title}" เรียบร้อยแล้ว`,
                contents: bubble
              });
            }
          } else {
            await sendLineReply(replyToken, '❌ ไม่พบรายการที่ต้องการตั้งค่าให้เสร็จสิ้น กรุณาระบุชื่อหรือรหัสท้าย 3 ตัวให้ชัดเจนขึ้นครับ');
          }
          break;
        }

        case 'UPDATE': {
          if (parsedResult.item_id && parsedResult.update_data) {
            const { data: itemToUpdate } = await supabaseAdmin
              .from('items')
              .select('*')
              .eq('id', parsedResult.item_id)
              .single();

            if (itemToUpdate) {
              const updates: any = { ...parsedResult.update_data };
              
              // Credit terms calculation logic removed
              updates.updated_at = new Date().toISOString();

              const { data: updatedItem, error: updateError } = await supabaseAdmin
                .from('items')
                .update(updates)
                .eq('id', parsedResult.item_id)
                .select('*')
                .single();

              if (updateError || !updatedItem) {
                await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการแก้ไขข้อมูลรายการ');
              } else {
                const requestUrl = new URL(request.url);
                const appUrl = requestUrl.origin;
                const bubble = createItemFlexBubble(updatedItem, appUrl);
                await sendLineReply(replyToken, {
                  type: 'flex',
                  altText: `✅ แก้ไขรายการ "&apos;${updatedItem.title}&apos;" สำเร็จแล้ว`,
                  contents: bubble
                });
              }
            } else {
              await sendLineReply(replyToken, '❌ ไม่พบรายการที่ระบุสำหรับการแก้ไข');
            }
          } else {
            await sendLineReply(replyToken, '❌ ไม่พบรายการบันทึกหรือข้อมูลที่ต้องการแก้ไข กรุณาระบุชื่อ/รหัสย่อและข้อมูลที่ต้องการแก้ไขครับ');
          }
          break;
        }

        case 'UNKNOWN': {
          const helpMessage = parsedResult.message || `💡 ยินดีต้อนรับสู่ จำจด (JumJod) แชตบอตบันทึกช่วยจำ!\n\nคุณสามารถส่งข้อความหาบอทเพื่อช่วยจดจำสิ่งต่างๆ ได้ดังนี้:\n\n➕ **จดบันทึกใหม่:** พิมพ์สิ่งที่คุณต้องการบันทึกและวันเวลาที่ต้องการเตือนได้เลย เช่น "นัดประชุมพรุ่งนี้ 10 โมงเช้า" หรือ "จ่ายค่าน้ำประปา วันที่ 20/07/26 เวลา 14:00"\n🔍 **ค้นหาบันทึก:** พิมพ์คำว่า "ค้นหา" หรือรหัสท้าย 3 ตัว เช่น "ค้นหา ประชุม" หรือ "#7fa"\n🎉 **ทำเสร็จแล้ว:** พิมพ์ "สำเร็จ [รหัสท้าย 3 ตัว]" เช่น "สำเร็จ 7fa"\n🗑️ **ลบรายการ:** พิมพ์ "ลบ [รหัสท้าย 3 ตัว]" เช่น "ลบ 7fa"`;
          await sendLineReply(replyToken, helpMessage);
          break;
        }

        case 'CREATE':
        default: {
          const createData = parsedResult.create_data;
          if (!createData) {
            await sendLineReply(replyToken, '❌ ไม่เข้าใจรูปแบบบันทึก กรุณาลองพิมพ์ข้อความใหม่อีกครั้ง');
            continue;
          }

          // Insert directly into items table
          const { data: insertedItem, error: insertError } = await supabaseAdmin
            .from('items')
            .insert([
              {
                user_id: profile.id,
                title: createData.title,
                description: createData.description || `บันทึกผ่าน LINE Bot: ${messageText}`,
                status: 'Pending',
                reminder_date: createData.reminder_date,
                is_pr: false,
                line_group_id: lineGroupId
              },
            ])
            .select('*')
            .single();

          if (insertError || !insertedItem) {
            console.error('Error inserting item from LINE:', insertError);
            await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง');
            continue;
          }

          const requestUrl = new URL(request.url);
          const appUrl = requestUrl.origin;
          
          const bubble = createItemFlexBubble(insertedItem, appUrl);
          const flexMessage = {
            type: 'flex',
            altText: `✅ บันทึกรายการ "${insertedItem.title}" สำเร็จ`,
            contents: bubble
          };

          await sendLineReply(replyToken, flexMessage);
          break;
        }
      }
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('LINE webhook error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

async function downloadLineMessageContent(messageId: string): Promise<Buffer> {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!channelAccessToken) {
    throw new Error('Missing LINE_CHANNEL_ACCESS_TOKEN');
  }

  const response = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
    headers: {
      Authorization: `Bearer ${channelAccessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to download LINE message content: status ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
