import { SupabaseClient } from '@supabase/supabase-js';
import { sendLineReply } from '@/lib/line/client';
import { createPrFlexBubble } from '@/lib/line/flex-templates';
import { PrService } from '@/services';
import { Profile, PrRequest, PrStatus } from '@/lib/types';

export class PrModeController {
  static async handleMessage(
    messageText: string,
    profile: Profile,
    replyToken: string,
    lineUserId: string,
    supabaseAdmin: SupabaseClient,
    appUrl: string
  ): Promise<boolean> {
    const text = messageText.trim();
    if (!text) return false;

    // 1. Pattern: "ใส่เลข PR/PO/QT [PR Query] [Number]"
    // Examples: "ใส่เลข PR ซื้อคอม PR-69001", "เติมเลข PO หมึก PO-2026-042", "ใส่เลข QT QT-8891"
    const numMatch = text.match(/^(?:ใส่เลข|เติมเลข|แก้เลข|อัปเดตเลข|ใส่|เติม)\s*(pr|po|qt)\s+(.+?)\s+([a-z0-9\-_/]+)$/i);
    if (numMatch) {
      const fieldType = numMatch[1].toLowerCase();
      const query = numMatch[2].trim();
      const val = numMatch[3].trim();

      const targetPr = await PrService.findPrByQuery(supabaseAdmin, profile.id, query);
      if (!targetPr) {
        await sendLineReply(replyToken, `❌ ไม่พบรายการ PR ที่ตรงกับ "${query}" ในระบบครับ`);
        return true;
      }

      const fieldMap: Record<string, keyof PrRequest> = {
        pr: 'pr_no',
        po: 'po_no',
        qt: 'qt_no'
      };
      const fieldKey = fieldMap[fieldType];

      const updates: Partial<PrRequest> = { [fieldKey]: val };

      // Auto update status if appropriate
      if (fieldType === 'pr' && targetPr.status === 'Pending') {
        updates.status = 'PR Issued';
      } else if (fieldType === 'po' && (targetPr.status === 'Pending' || targetPr.status === 'PR Issued')) {
        updates.status = 'PO Issued';
      }

      const updated = await PrService.updatePr(supabaseAdmin, targetPr.id, updates);
      if (!updated) {
        await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการอัปเดตข้อมูล PR');
      } else {
        const bubble = createPrFlexBubble(updated, appUrl);
        const labelName = fieldType.toUpperCase();
        await sendLineReply(replyToken, [
          `✅ อัปเดตเลข ${labelName} ของ PR "${updated.title}" เป็น "${val}" เรียบร้อยแล้วครับ!`,
          {
            type: 'flex',
            altText: `📑 อัปเดตเลข ${labelName} ของ PR "${updated.title}"`,
            contents: bubble
          }
        ]);
      }
      return true;
    }

    // 1.2 Pattern: "ใส่เลข/เติมเลข PR/PO/QT [Number]" (omitting query, apply to latest PR)
    // Examples: "เติมเลข PR PR-69001", "ใส่เลข PO PO-2026-042", "เลข PR PR-12345"
    const singleNumMatch = text.match(/^(?:ใส่เลข|เติมเลข|แก้เลข|อัปเดตเลข|เลข)\s*(pr|po|qt)[:\s]+([a-z0-9\-_/]+)$/i);
    if (singleNumMatch) {
      const fieldType = singleNumMatch[1].toLowerCase();
      const val = singleNumMatch[2].trim();

      const { data: latestPrs } = await supabaseAdmin
        .from('pr_requests')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (latestPrs && latestPrs.length > 0) {
        const targetPr = latestPrs[0];
        const fieldMap: Record<string, keyof PrRequest> = {
          pr: 'pr_no',
          po: 'po_no',
          qt: 'qt_no'
        };
        const fieldKey = fieldMap[fieldType];
        const updates: Partial<PrRequest> = { [fieldKey]: val };

        if (fieldType === 'pr' && targetPr.status === 'Pending') {
          updates.status = 'PR Issued';
        } else if (fieldType === 'po' && (targetPr.status === 'Pending' || targetPr.status === 'PR Issued')) {
          updates.status = 'PO Issued';
        }

        const updated = await PrService.updatePr(supabaseAdmin, targetPr.id, updates);
        if (!updated) {
          await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการอัปเดตข้อมูล PR');
        } else {
          const bubble = createPrFlexBubble(updated, appUrl);
          const labelName = fieldType.toUpperCase();
          await sendLineReply(replyToken, [
            `✅ อัปเดตเลข ${labelName} ของ PR "${updated.title}" เป็น "${val}" เรียบร้อยแล้วครับ!`,
            {
              type: 'flex',
              altText: `📑 อัปเดตเลข ${labelName} ของ PR "${updated.title}"`,
              contents: bubble
            }
          ]);
        }
        return true;
      }
    }

    // 1.5 Pattern: "ใส่ราคา [PR Query] [Price] [VAT optional]"
    // Examples: "ใส่ราคา ซื้อคอม 15000", "เติมราคา หมึก 2500 vat 175"
    const priceMatch = text.match(/^(?:ใส่ราคา|เติมราคา|แก้ราคา|อัปเดตราคา|ราคา)\s*pr?\s+(.+?)\s+([0-9\.,]+)(?:\s*(?:vat|ภาษี)\s*([0-9\.,]+))?$/i);
    if (priceMatch) {
      const query = priceMatch[1].trim();
      const subStr = priceMatch[2].replace(/,/g, '').trim();
      const vatStr = priceMatch[3] ? priceMatch[3].replace(/,/g, '').trim() : null;

      const subNum = parseFloat(subStr);
      if (isNaN(subNum)) {
        await sendLineReply(replyToken, '❌ จำนวนเงินไม่ถูกต้อง กรุณาระบุตัวเลข เช่น "ใส่ราคา ซื้อคอม 15000"');
        return true;
      }

      const vatNum = vatStr ? parseFloat(vatStr) : Math.round(subNum * 0.07 * 100) / 100;
      const totNum = Math.round((subNum + vatNum) * 100) / 100;

      const targetPr = await PrService.findPrByQuery(supabaseAdmin, profile.id, query);
      if (!targetPr) {
        await sendLineReply(replyToken, `❌ ไม่พบรายการ PR ที่ตรงกับ "${query}" ในระบบครับ`);
        return true;
      }

      const updated = await PrService.updatePr(supabaseAdmin, targetPr.id, {
        subtotal: subNum,
        vat_amount: vatNum,
        total_amount: totNum
      });

      if (!updated) {
        await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการอัปเดตราคา PR');
      } else {
        const bubble = createPrFlexBubble(updated, appUrl);
        await sendLineReply(replyToken, [
          `💰 บันทึกราคา PR "${updated.title}" เรียบร้อยแล้ว!\n• ราคาต้น: ${subNum.toLocaleString('th-TH')} บาท\n• VAT 7%: ${vatNum.toLocaleString('th-TH')} บาท\n• ราคารวมสุทธิ: ${totNum.toLocaleString('th-TH')} บาท`,
          {
            type: 'flex',
            altText: `💰 อัปเดตราคา PR "${updated.title}"`,
            contents: bubble
          }
        ]);
      }
      return true;
    }

    // 2. Pattern: "เปลี่ยนสถานะ PR [PR Query] เป็น [Status]"
    // Examples: "เปลี่ยนสถานะ PR ซื้อคอม เป็น ออก PO แล้ว", "แก้สถานะ PR หมึก เป็น Completed"
    const statusMatch = text.match(/^(?:เปลี่ยนสถานะ|อัปเดตสถานะ|แก้สถานะ|สถานะ)\s*pr\s+(.+?)\s*(?:เป็น|->|=)?\s*(รอเลข pr|ออก pr แล้ว|ออก po แล้ว|เสร็จสมบูรณ์|pending|pr issued|po issued|completed)$/i);
    if (statusMatch) {
      const query = statusMatch[1].trim();
      const rawStatus = statusMatch[2].trim().toLowerCase();

      let newStatus: PrStatus = 'Pending';
      if (rawStatus.includes('ออก pr') || rawStatus === 'pr issued') newStatus = 'PR Issued';
      else if (rawStatus.includes('ออก po') || rawStatus === 'po issued') newStatus = 'PO Issued';
      else if (rawStatus.includes('เสร็จ') || rawStatus === 'completed') newStatus = 'Completed';
      else if (rawStatus.includes('รอ') || rawStatus === 'pending') newStatus = 'Pending';

      const targetPr = await PrService.findPrByQuery(supabaseAdmin, profile.id, query);
      if (!targetPr) {
        await sendLineReply(replyToken, `❌ ไม่พบรายการ PR ที่ตรงกับ "${query}" ในระบบครับ`);
        return true;
      }

      const updated = await PrService.updatePr(supabaseAdmin, targetPr.id, { status: newStatus });
      if (!updated) {
        await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการอัปเดตสถานะ PR');
      } else {
        const bubble = createPrFlexBubble(updated, appUrl);
        await sendLineReply(replyToken, [
          `🔄 อัปเดตสถานะ PR "${updated.title}" เป็น "${newStatus}" เรียบร้อยแล้วครับ!`,
          {
            type: 'flex',
            altText: `📑 อัปเดตสถานะ PR "${updated.title}"`,
            contents: bubble
          }
        ]);
      }
      return true;
    }

    // 3. Pattern: "แก้ PR [PR Query] [Details/Fields]"
    // Examples: "แก้ PR ซื้อคอม pr_no PR-69001 po_no PO-2026-001", "แก้ PR #1234 PR-69001"
    const editMatch = text.match(/^(?:แก้|แก้ไข|อัปเดต)\s*pr\s+(.+?)\s+(.+)$/i);
    if (editMatch) {
      const query = editMatch[1].trim();
      const restPayload = editMatch[2].trim();

      const targetPr = await PrService.findPrByQuery(supabaseAdmin, profile.id, query);
      if (!targetPr) {
        await sendLineReply(replyToken, `❌ ไม่พบรายการ PR ที่ตรงกับ "${query}" ในระบบครับ`);
        return true;
      }

      const updates: Partial<PrRequest> = {};

      const prNoMatch = restPayload.match(/(?:pr_no|เลข\s*pr|pr)[:\s]*([a-z0-9\-_/]+)/i);
      const poNoMatch = restPayload.match(/(?:po_no|เลข\s*po|po)[:\s]*([a-z0-9\-_/]+)/i);
      const qtNoMatch = restPayload.match(/(?:qt_no|เลข\s*qt|qt)[:\s]*([a-z0-9\-_/]+)/i);
      const titleMatch = restPayload.match(/(?:ชื่อ|title)[:\s]*([^\n,]+)/i);
      const notesMatch = restPayload.match(/(?:หมายเหตุ|notes)[:\s]*([^\n]+)/i);

      if (prNoMatch) updates.pr_no = prNoMatch[1].trim();
      if (poNoMatch) updates.po_no = poNoMatch[1].trim();
      if (qtNoMatch) updates.qt_no = qtNoMatch[1].trim();
      if (titleMatch) updates.title = titleMatch[1].trim();
      if (notesMatch) updates.notes = notesMatch[1].trim();

      if (Object.keys(updates).length === 0) {
        if (/^pr[-_\s]?\d+/i.test(restPayload)) {
          updates.pr_no = restPayload;
          if (targetPr.status === 'Pending') updates.status = 'PR Issued';
        } else if (/^po[-_\s]?\d+/i.test(restPayload)) {
          updates.po_no = restPayload;
          if (targetPr.status === 'Pending' || targetPr.status === 'PR Issued') updates.status = 'PO Issued';
        } else if (/^qt[-_\s]?\d+/i.test(restPayload)) {
          updates.qt_no = restPayload;
        } else {
          updates.title = restPayload;
        }
      }

      const updated = await PrService.updatePr(supabaseAdmin, targetPr.id, updates);
      if (!updated) {
        await sendLineReply(replyToken, '❌ เกิดข้อผิดพลาดในการอัปเดตข้อมูล PR');
      } else {
        const bubble = createPrFlexBubble(updated, appUrl);
        await sendLineReply(replyToken, [
          `✅ อัปเดตข้อมูล PR "${updated.title}" เรียบร้อยแล้วครับ!`,
          {
            type: 'flex',
            altText: `📑 อัปเดตข้อมูล PR "${updated.title}"`,
            contents: bubble
          }
        ]);
      }
      return true;
    }

    return false;
  }
}
