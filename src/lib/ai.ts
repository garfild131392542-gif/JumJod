import { ItemStatus } from './types';

export interface ParsedProcurementData {
  title: string;
  description: string;
  credit_term: 30 | 60 | 90 | null;
  po_date: string | null;
  budget_due_date: string | null;
  reminder_date: string | null;
}

export interface GeminiParsedOutput {
  intent: 'CREATE' | 'SEARCH' | 'UPDATE' | 'DELETE' | 'COMPLETE' | 'UNKNOWN' | 'STOCK';
  search_query?: string;
  item_id?: string;
  create_data?: ParsedProcurementData;
  update_data?: {
    title?: string;
    description?: string;
    credit_term?: 30 | 60 | 90 | null;
    po_date?: string | null;
    budget_due_date?: string | null;
    status?: 'Pending' | 'Purchasing' | 'Issuing Item';
  };
  stock_data?: {
    action: 'ADD' | 'SUBTRACT' | 'SET' | 'DELETE' | 'CHECK' | 'EDIT_NAME' | 'EDIT_DESC' | 'EDIT_MIN' | 'EDIT_PRIORITY' | 'EDIT_CATEGORY' | 'CONFIRM_NEEDED';
    name: string | null;
    quantity: number | null;
    unit: string | null;
    category?: string | null;
    new_name?: string | null;
    description?: string | null;
    new_min_threshold?: number | null;
    new_priority?: 'High' | 'Medium' | 'Low' | null;
    confidence?: number;
    confirm_message?: string;
    priority?: 'High' | 'Medium' | 'Low' | null;
    min_threshold?: number | null;
  };
  message?: string;
}

/**
 * Calculates a due date based on the PO date and credit term (days).
 */
export function calculateDueDate(poDateStr: string | null, creditTerm: number | null): string | null {
  if (!poDateStr || !creditTerm) return null;
  const date = new Date(poDateStr);
  if (isNaN(date.getTime())) return null;
  date.setDate(date.getDate() + creditTerm);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Helper to select one of the available Gemini API keys from env variables.
 */
export function getGeminiApiKey(): string | undefined {
  const keys = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY
  ].filter(Boolean) as string[];

  if (keys.length === 0) return undefined;
  // Rotate key randomly to load balance and manage rate limits
  const randomIndex = Math.floor(Math.random() * keys.length);
  return keys[randomIndex];
}

/**
 * Classifies user intent using a specialized, focused Gemini prompt.
 */
async function classifyIntentWithAI(
  messageText: string,
  existingItems: any[],
  apiKey: string
): Promise<'CREATE' | 'SEARCH' | 'UPDATE' | 'DELETE' | 'COMPLETE' | 'UNKNOWN' | 'STOCK'> {
  const modelName = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{
      parts: [{
        text: `You are an intent classifier for JodJum (จำจด) - a procurement and inventory planner system.
Analyze this message from the user: "${messageText}"

Existing items context (recent active procurement items):
${JSON.stringify(existingItems.map(item => ({ id: item.id, title: item.title })))}

Classify the user's intent into one of the following:
- STOCK: User wants to manage stock, inventory, laboratory, or office supplies (e.g. "เบิกแอลกอฮอล์ 2 ขวด", "เพิ่มกระดาษ 10 รีม", "เช็กสต็อกกระดาษ A4", "แอดแอลกอฮอล์ 95%", "สต็อก", "ตัดสต็อก", "ลบวัสดุแอลกอฮอล์ออกจากคลัง", "แอลกอฮอล์").
- CREATE: User wants to add/remember a new procurement item, task, or purchase reminder (e.g. "บันทึก เคลียร์ไฟล์งบประมาณ", "สั่งซื้อคอม", "แจ้งเตือนสเก็ตงานพรุ่งนี้").
- SEARCH: User wants to search or look up items (e.g. "ค้นหาระเบียบ", "หา กระดาษ").
- UPDATE: User wants to edit/change/update details of an existing item (e.g. "แก้ไข ซื้อหมึก เพิ่มเครดิตเป็น 60 วัน", "แก้รายละเอียดคอม").
- DELETE: User wants to delete or remove an item (e.g. "ลบรายการกระดาษ", "ลบ b77", "ยกเลิกใบสั่งคอม").
- COMPLETE: User wants to mark an item as finished/done/completed/successful (e.g. "สำเร็จ b78", "เสร็จแล้วรายการซื้อคอม").
- UNKNOWN: Generic greetings, friendly replies, help requests, or comments that do not perform operations.

Format the output strictly as a JSON object:
{
  "intent": "STOCK" | "CREATE" | "SEARCH" | "UPDATE" | "DELETE" | "COMPLETE" | "UNKNOWN"
}`
      }]
    }],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Classifier API error: status ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const parsed = JSON.parse(rawText.trim());
  return parsed.intent;
}

/**
 * Extracts details specifically for creating a new item.
 */
async function parseCreateMessageWithAI(
  messageText: string,
  apiKey: string
): Promise<ParsedProcurementData> {
  const modelName = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const nowUtc = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const localDate = new Date(nowUtc.getTime() + 7 * 60 * 60 * 1000);
  const localDateTimeStr = `${localDate.getUTCFullYear()}-${pad(localDate.getUTCMonth() + 1)}-${pad(localDate.getUTCDate())}T${pad(localDate.getUTCHours())}:${pad(localDate.getUTCMinutes())}:${pad(localDate.getUTCSeconds())}+07:00`;

  const body = {
    contents: [{
      parts: [{
        text: `You are a data extraction AI for JodJum (จำจด).
Today's local date and time in Thailand (ICT, UTC+7) is ${localDateTimeStr}.
Analyze this message from the user to extract details for creating a new item: "${messageText}"

Extract the following fields and format strictly as JSON:
{
  "title": "Clean, short, and descriptive title of the procurement or task. CRITICAL: Never include keyword prefixes like 'แจ้งเตือน', 'ให้แจ้งเตือน', 'ไม่แจ้งเตือน', 'เตือน', 'ช่วยเตือน', 'ช่วยแจ้งเตือน', 'บันทึก', 'จด', 'เพิ่ม' in the title. Remove them and any leading colons/dashes. E.g. for 'บันทึก เคลียร์ไฟล์งบประมาณ ให้พี่เทียม' the title is 'เคลียร์ไฟล์งบประมาณ ให้พี่เทียม', for 'แจ้งเตือนซื้อหมึกพิมพ์' the title is 'ซื้อหมึกพิมพ์'",
  "description": "Full description details (optional)",
  "credit_term": 30 | 60 | 90 | null (if mentioned, e.g. เครดิต 30 วัน, otherwise null),
  "po_date": "YYYY-MM-DD (default to today if credit term is matched, otherwise null)",
  "budget_due_date": "YYYY-MM-DD (calculated as po_date + credit_term if matched, otherwise null)",
  "reminder_date": "ISOString in Thailand timezone (+07:00) or UTC (optional reminder date and time. Parse if message mentions when to remind, including time if specified, e.g. 'วันจันทร์หน้า', 'พรุ่งนี้ 10:30', '30/07/26 ตอนบ่ายสอง', 'อีก 2 ชั่วโมง'. Always convert relative times accurately based on today's date/time. If only date is specified, default time to 09:00:00+07:00)"
}`
      }]
    }],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Create parser API error: status ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const parsed = JSON.parse(rawText.trim()) as ParsedProcurementData;

  // Clean title prefix just in case Gemini missed it
  if (parsed.title) {
    parsed.title = parsed.title.replace(/^(?:ให้แจ้งเตือน|ไม่แจ้งเตือน|ช่วยแจ้งเตือน|แจ้งเตือน|ช่วยเตือน|เตือน|บันทึก|จด|เพิ่ม)\s*/i, '').trim();
    parsed.title = parsed.title.replace(/^[:\-ー\s\.]+/, '').trim();
  }

  return parsed;
}

/**
 * Extracts details specifically for updating an existing item.
 */
async function parseUpdateMessageWithAI(
  messageText: string,
  existingItems: any[],
  apiKey: string
): Promise<{ item_id: string | null; update_data: any }> {
  const modelName = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{
      parts: [{
        text: `You are an update parser for JodJum (จำจด).
Identify which item to update and what fields should be modified based on this message: "${messageText}"

Here is the list of active/recent items for this user:
${JSON.stringify(existingItems.map(item => ({ id: item.id, title: item.title, description: item.description, status: item.status, credit_term: item.credit_term })))}

Format output strictly as JSON:
{
  "item_id": "UUID of the matching item to update from the list, or null if no match",
  "update_data": {
    "title": "New title if user requested to change the title (clean and descriptive, strip keywords like 'แจ้งเตือน', 'ให้แจ้งเตือน', 'บันทึก')",
    "description": "New description details if requested",
    "credit_term": 30 | 60 | 90 | null (if user changed credit term),
    "po_date": "YYYY-MM-DD",
    "budget_due_date": "YYYY-MM-DD",
    "status": "Pending" | "Purchasing" | "Issuing Item"
  }
}`
      }]
    }],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Update parser API error: status ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const parsed = JSON.parse(rawText.trim());

  if (parsed.update_data && parsed.update_data.title) {
    parsed.update_data.title = parsed.update_data.title.replace(/^(?:ให้แจ้งเตือน|ไม่แจ้งเตือน|ช่วยแจ้งเตือน|แจ้งเตือน|ช่วยเตือน|เตือน|บันทึก|จด|เพิ่ม)\s*/i, '').trim();
    parsed.update_data.title = parsed.update_data.title.replace(/^[:\-ー\s\.]+/, '').trim();
  }

  return parsed;
}

/**
 * Extracts details specifically for stock operations.
 */
export async function parseStockMessageWithAI(
  messageText: string,
  apiKey: string
): Promise<{
  action: 'ADD' | 'SUBTRACT' | 'SET' | 'DELETE' | 'CHECK' | 'EDIT_NAME' | 'EDIT_DESC' | 'EDIT_MIN' | 'EDIT_PRIORITY' | 'EDIT_CATEGORY' | 'CONFIRM_NEEDED';
  name: string | null;
  quantity: number | null;
  unit: string | null;
  category?: string | null;
  new_name?: string | null;
  description?: string | null;
  new_min_threshold?: number | null;
  new_priority?: 'High' | 'Medium' | 'Low' | null;
  confidence?: number;
  confirm_message?: string;
}> {
  const modelName = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{
      parts: [{
        text: `You are an inventory data extraction AI for JodJum (จำจด).
Analyze this user message related to stock: "${messageText}"

Extract the following fields and format strictly as JSON:
{
  "action": one of:
    "ADD" (adding stock/deposit/new material, e.g. "เพิ่มกระดาษ 10 รีม", "แอดแอลกอฮอล์ 5 ขวด"),
    "SUBTRACT" (withdrawing/reducing/using, e.g. "เบิกปากกา 2 แท่ง", "ตัดออก 1"),
    "SET" (setting specific quantity, e.g. "ปรับยอดกระดาษเป็น 20"),
    "DELETE" (removing from stock entirely, e.g. "ลบวัสดุแอลกอฮอล์ออก"),
    "CHECK" (checking stock balance, e.g. "เช็คยอดปากกา", "มีกระดาษเท่าไหร่"),
    "EDIT_NAME" (renaming a material, e.g. "เปลี่ยนชื่อปากกา Permanent เป็น ปากกาลบไม่ได้", "แก้ชื่อกระดาษ A4"),
    "EDIT_DESC" (editing description/detail, e.g. "แก้รายละเอียดแอลกอฮอล์ว่า ใช้สำหรับทำความสะอาด", "เพิ่มคำอธิบาย"),
    "EDIT_MIN" (changing min threshold, e.g. "ตั้งเกณฑ์ขั้นต่ำปากกาเป็น 5", "กำหนดการเตือนเมื่อเหลือน้อยกว่า 3"),
    "EDIT_PRIORITY" (changing priority, e.g. "ตั้งด่วนกระดาษ A4 เป็น High", "เปลี่ยนความสำคัญ"),
    "EDIT_CATEGORY" (changing category, e.g. "ย้ายถ้วย Crucible ไปหมวดหมู่ Lab", "เปลี่ยนหมวดหมู่กระดาษเป็นอุปกรณ์สำนักงาน"),
  "name": "Current name of the material in stock (strip all action verbs like 'เบิก', 'เพิ่ม', 'แอด', 'ลด', 'ลบ', 'เช็ก', 'เช็ค', 'ดู', 'ตรวจสอบ', 'เปลี่ยนชื่อ', 'แก้ชื่อ', 'ตั้งเกณฑ์', 'กำหนด', 'แก้รายละเอียด', 'ย้ายหมวดหมู่', 'เปลี่ยนหมวด'). This should be the EXISTING name in stock.",
  "quantity": number or null,
  "unit": "string or null",
  "category": CRITICAL RULE - Only provide category value in these specific cases:
    1. User explicitly says 'เปลี่ยนหมวด', 'ย้ายหมวดหมู่', 'เพิ่มในหมวด Lab', etc.
    2. NEVER set category for CHECK action - always null.
    3. NEVER set category just because you think the item belongs to a category.
    Set to "อุปกรณ์สำนักงาน" or "Laboratory" only when explicitly requested, otherwise null.,
  "new_name": "The new name to rename to (only for EDIT_NAME action, otherwise null)",
  "description": "New description text (only for EDIT_DESC action, otherwise null)",
  "new_min_threshold": number or null (only for EDIT_MIN action, the new threshold value),
  "new_priority": "High" | "Medium" | "Low" | null (only for EDIT_PRIORITY action),
  "confidence": integer 1-100 (how confident you are about this interpretation),
  "confirm_message": "Thai question to ask user to confirm if confidence < 70, e.g. 'คุณต้องการ [action] [name] ใช่ไหมครับ?', otherwise null"
}

IMPORTANT RULES:
- If confidence < 70, provide confirm_message but still set 'action' and other fields to your best guess. Only set action to 'CONFIRM_NEEDED' if you cannot guess the action at all.
- For CHECK action: category MUST be null
- For EDIT_* actions: extract the current item name carefully from the message
- Strip all Thai action verbs from the name field`
      }]
    }],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Stock parser API error: status ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const parsed = JSON.parse(rawText.trim());

  // Clean stock name
  if (parsed.name) {
    parsed.name = parsed.name.replace(/^(?:เบิก|เพิ่ม|แอด|ลด|ลบ|เช็ก|ดู|สต็อก|สต๊อก|เช็ค|เปลี่ยนชื่อ|แก้ชื่อ|ตั้งเกณฑ์|กำหนด|แก้รายละเอียด|ตั้ง)\s*/i, '').trim();
    parsed.name = parsed.name.replace(/^[:\-ー\s\.]+/, '').trim();
  }

  // Enforce: CHECK action must never have a category
  if (parsed.action === 'CHECK') {
    parsed.category = null;
  }

  return parsed;
}

/**
 * AI-assisted fallback to match item by title/semantic query if local matching fails.
 */
async function findClosestItemWithAI(
  query: string,
  items: any[],
  apiKey: string
): Promise<string | null> {
  if (items.length === 0 || !query) return null;
  const modelName = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{
      parts: [{
        text: `Find the single closest matching item from the list below for the search query: "${query}"

Items list:
${JSON.stringify(items.map(item => ({ id: item.id, title: item.title })))}

Return the UUID of the closest matching item as a JSON object. Do NOT guess if there is no matching item.
{
  "item_id": "UUID of the matching item, or null if there is no reasonable match (do NOT guess if it's completely different)"
}`
      }]
    }],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!response.ok) return null;
    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = JSON.parse(rawText.trim());
    return parsed.item_id || null;
  } catch (err) {
    console.error('findClosestItemWithAI error:', err);
    return null;
  }
}

/**
 * Helper to match item by last 3 digits of its ID.
 */
function findItemByShortId(messageText: string, items: any[]): any | null {
  if (items.length === 0) return null;
  // Match #7fa or 7fa at word boundary or end of string
  const match = messageText.match(/(?:#)?\b([a-f0-9]{3})\b/i) || messageText.match(/(?:#)?([a-f0-9]{3})$/i);
  if (match) {
    const shortId = match[1].toLowerCase();
    const found = items.find(item => item.id.toLowerCase().endsWith(shortId));
    if (found) return found;
  }
  return null;
}

export async function generateHelpfulFallbackResponseWithAI(
  messageText: string,
  existingItems: any[],
  activeMode: 'stock' | 'reminder' | null,
  apiKey: string
): Promise<string> {
  const modelName = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  // Build list of existing items for typo matching and suggestions
  const itemsContext = existingItems.slice(0, 15).map(item => `- ${item.title} (Status: ${item.status || 'Pending'})`).join('\n');

  const promptText = `You are a helpful inventory and procurement chatbot assistant named JodJum (จำจด) for LINE messaging.
The user sent a message that could not be recognized as a specific command: "${messageText}"
Current mode of the user is: ${activeMode || 'none (no mode selected)'}

Here is a list of some existing items in the database for context/correction suggestions if applicable:
${itemsContext || '(No items registered yet)'}

Instructions:
1. Analyze the user's message.
2. If they have a typo matching an item (e.g. they typed 'Crucble' close to 'Crucible'), politely ask if they meant that item.
3. If they typed a stock/inventory action but are not in stock mode (current mode is not 'stock'), tell them to switch to stock mode by sending "สต็อก" or guide them.
4. If their message is completely incomprehensible, offer general help politely and suggest some clear examples of what they can do:
   - For reminders/items: "ซื้อกระดาษ A4 10 รีม เครดิต 30 วัน"
   - For stock/inventory: "เบิก แอลกอฮอล์ 2 ขวด"
5. Respond in polite Thai (speak nicely, use 'ครับ/ค่ะ', keep it friendly and supportive). Keep the response brief, engaging, and clear (max 3-4 sentences).
6. DO NOT repeat this prompt. Only output the friendly conversational response.`;

  const body = {
    contents: [{
      parts: [{
        text: promptText
      }]
    }]
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Fallback API response status ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return rawText.trim() || '🤖 ขออภัยครับ ผมไม่เข้าใจคำสั่งนี้ กรุณาลองพิมพ์ข้อความใหม่อีกครั้ง หรือสลับโหมดการทำงานครับ';
  } catch (err) {
    console.error('Error generating fallback help message:', err);
    return '🤖 ขออภัยครับ ผมไม่เข้าใจคำสั่งนี้ กรุณาลองพิมพ์ข้อความใหม่อีกครั้ง หรือสลับโหมดการทำงานครับ';
  }
}

/**
 * Coordinates classification and parsing with specialized AI modular functions.
 */
export async function classifyAndParseMessageWithAI(
  messageText: string,
  existingItems: any[],
  activeMode: 'stock' | 'reminder' | null = null
): Promise<GeminiParsedOutput> {
  const text = messageText.toLowerCase().trim();
  const matchedItem = findItemByShortId(messageText, existingItems);

  // 1. Intercept generic/empty commands to ask for details
  const isGenericWord = /^(เพิ่มข้อมูล|เพิ่ม|จด|บันทึก|จดบันทึก|สั่ง|ซื้อ)$/i.test(text);
  if (isGenericWord) {
    return {
      intent: 'UNKNOWN',
      message: 'ต้องการเพิ่มข้อมูลอะไรดีครับ? พิมพ์บอกจำจดได้เลยจ้า เช่น "ซื้อหมึกพิมพ์ 5 กล่อง เครดิต 30 วัน" หรือ "สั่งกระดาษ A4" ครับ 😊'
    };
  }

  // 2. Intercept greetings and help prompts for instant, friendly replies (no API delay)
  const isGreeting = /^(สวัสดี|หวัดดี|ดีครับ|ดีค่ะ|ดีจ้า|hello|hi|hey|hola|greetings)/i.test(text);
  const isHelpPrompt = /^(ช่วยจดบันทึก|ช่วยจด|จดบันทึก|จดหน่อย|ช่วยหน่อย|ทำอะไรได้บ้าง|คู่มือ|ใช้งานยังไง)/i.test(text);

  if (isGreeting) {
    return {
      intent: 'UNKNOWN',
      message: 'สวัสดีครับ ยินดีต้อนรับสู่จำจด! มีอะไรให้ผมช่วยบันทึกหรือช่วยจำวันนี้ไหมครับ 😊'
    };
  }

  if (isHelpPrompt) {
    return {
      intent: 'UNKNOWN',
      message: 'ยินดีครับ! คุณสามารถพิมพ์สั่งบันทึกการจัดซื้อหรือแจ้งเตือนได้เลยจ้า\n\nตัวอย่างเช่น:\n📝 "ซื้อหมึกพิมพ์ 5 กล่อง เครดิต 30 วัน"\n📝 "สั่งคอมพิวเตอร์กราฟิก เครดิต 60 วัน"'
    };
  }

  // 3. Fast exact matching for ID targeted commands (No API delay, 100% accurate)
  if (matchedItem) {
    if (/(สำเร็จ|เสร็จ|complete|finish|done|ออกรหัส|ออกไอเทม|ออก\s*pr\s*แล้ว)/i.test(text)) {
      return { intent: 'COMPLETE', item_id: matchedItem.id };
    }
    if (/(ลบ|ยกเลิก|delete|remove)/i.test(text)) {
      return { intent: 'DELETE', item_id: matchedItem.id };
    }
    if (/(แจ้งจัดซื้อ|ขอไอเทม|แอดไอเทม|ส่งจัดซื้อ)/i.test(text)) {
      return {
        intent: 'UPDATE',
        item_id: matchedItem.id,
        update_data: {
          item_request_status: 'Pending',
          status: 'Purchasing'
        } as any
      };
    }
    if (/(แก้ไข|แก้|update|edit)/i.test(text)) {
      const creditMatch = text.match(/(?:เครดิต|credit)\s*(30|60|90)/i);
      const credit_term = creditMatch ? Number(creditMatch[1]) as 30 | 60 | 90 : null;
      return {
        intent: 'UPDATE',
        item_id: matchedItem.id,
        update_data: credit_term ? { credit_term } : {}
      };
    }
    // If just typing short ID, treat as search
    const isJustId = text === matchedItem.id.substring(matchedItem.id.length - 3).toLowerCase() || 
                      text === '#' + matchedItem.id.substring(matchedItem.id.length - 3).toLowerCase();
    const isSearch = text.includes('ค้นหา') || text.includes('หา') || text.includes('search') || text.includes('find') || text.includes('ดู');
    
    if (isJustId || isSearch) {
      return {
        intent: 'SEARCH',
        search_query: matchedItem.title,
        item_id: matchedItem.id
      };
    }
  }

  // 4. Fallback to API if keys are available
  const apiKey = getGeminiApiKey();
  if (apiKey) {
    try {
      // Step 1: Classify intent
      const intent = await classifyIntentWithAI(messageText, existingItems, apiKey);
      console.log(`[AI Modular] Classified intent: ${intent} for message: "${messageText}"`);

      // Dispatch to specialized parsers
      if (intent === 'STOCK') {
        const stockData = await parseStockMessageWithAI(messageText, apiKey);
        return {
          intent: 'STOCK',
          stock_data: stockData
        };
      }

      if (intent === 'CREATE') {
        const createData = await parseCreateMessageWithAI(messageText, apiKey);
        return {
          intent: 'CREATE',
          create_data: createData
        };
      }

      if (intent === 'UPDATE') {
        const updateResult = await parseUpdateMessageWithAI(messageText, existingItems, apiKey);
        let itemId = updateResult.item_id;
        if (!itemId) {
          // Fallback to search query matching
          const query = messageText.replace(/^(แก้ไข|แก้|edit|update)\s*/i, '').trim();
          itemId = await findClosestItemWithAI(query, existingItems, apiKey);
        }
        return {
          intent: 'UPDATE',
          item_id: itemId || undefined,
          update_data: updateResult.update_data
        };
      }

      if (intent === 'DELETE') {
        const query = messageText.replace(/^(ลบ|delete|ยกเลิก)\s*/i, '').trim();
        let matched = findClosestItem(query, existingItems);
        if (!matched) {
          const aiMatchedId = await findClosestItemWithAI(query, existingItems, apiKey);
          if (aiMatchedId) {
            matched = existingItems.find(item => item.id === aiMatchedId);
          }
        }
        return {
          intent: 'DELETE',
          item_id: matched?.id || undefined
        };
      }

      if (intent === 'COMPLETE') {
        const query = messageText.replace(/^(เสร็จแล้ว|สำเร็จ|complete|เสร็จ|ออกรหัส|ออกไอเทม)\s*/i, '').trim();
        let matched = findClosestItem(query, existingItems);
        if (!matched) {
          const aiMatchedId = await findClosestItemWithAI(query, existingItems, apiKey);
          if (aiMatchedId) {
            matched = existingItems.find(item => item.id === aiMatchedId);
          }
        }
        return {
          intent: 'COMPLETE',
          item_id: matched?.id || undefined
        };
      }

      if (intent === 'SEARCH') {
        const query = messageText.replace(/^(ค้นหา|หา|search|find|ดู)\s*/i, '').trim();
        let matched = findClosestItem(query, existingItems);
        if (!matched) {
          const aiMatchedId = await findClosestItemWithAI(query, existingItems, apiKey);
          if (aiMatchedId) {
            matched = existingItems.find(item => item.id === aiMatchedId);
          }
        }
        return {
          intent: 'SEARCH',
          search_query: matched ? matched.title : query,
          item_id: matched ? matched.id : undefined
        };
      }

      const fallbackMessage = await generateHelpfulFallbackResponseWithAI(messageText, existingItems, activeMode, apiKey);
      return {
        intent: 'UNKNOWN',
        message: fallbackMessage
      };

    } catch (err) {
      console.error('[AI Modular] Error, falling back to local parser:', err);
    }
  }

  // 5. Fallback to Regex Parser
  return regexFallbackParser(messageText, existingItems);
}

function extractReminderDate(text: string): string | null {
  const dateMatch = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
  if (dateMatch) {
    const day = parseInt(dateMatch[1]);
    const month = dateMatch[2]; // 1-indexed string representation
    let year = parseInt(dateMatch[3]);
    
    if (year < 100) {
      year += 2000;
    } else if (year > 2500) {
      year -= 543;
    }
    
    let hours = 9;
    let minutes = 0;
    
    // Check for HH:mm or HH.mm time after "เวลา" or "at"
    const timeMatch = text.match(/(?:เวลา|at)\s*(\d{1,2})[:.](\d{2})/i);
    if (timeMatch) {
      hours = parseInt(timeMatch[1]);
      minutes = parseInt(timeMatch[2]);
    } else {
      // Check for simple Thai "โมง" or "โมงเช้า" / "บ่าย..." time representation
      const mongMatch = text.match(/(\d{1,2})\s*โมง/i);
      if (mongMatch) {
        let h = parseInt(mongMatch[1]);
        if (text.includes('บ่าย') && h < 12) {
          h += 12;
        } else if (text.includes('เย็น') && h < 12) {
          h += 12;
        } else if (text.includes('ค่ำ') && h < 12) {
          h += 12;
        }
        hours = h;
      }
    }

    const pad = (n: number) => String(n).padStart(2, '0');
    const localISO = `${year}-${pad(Number(month))}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00+07:00`;
    const date = new Date(localISO);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return null;
}

/**
 * Regex-based fallback parser in case Gemini API is offline or not configured.
 */
export function regexFallbackParser(messageText: string, existingItems: any[]): GeminiParsedOutput {
  const text = messageText.toLowerCase().trim();

  // 0. STOCK intent in fallback
  const isStockAction = /(?:สต็อก|สต๊อก|คลัง|จำนวน|ชิ้น|กล่อง|ขวด|หลอด|แกลลอน|รีม|เบิก|หักยอด|ตัดยอด|แอดวัสดุ|เพิ่มสต็อก|แล็บ|lab|วัสดุ|หมวดหมู่|หมวด)/i.test(text);
  if (isStockAction) {
    let action: 'ADD' | 'SUBTRACT' | 'SET' | 'DELETE' | 'CHECK' | 'EDIT_CATEGORY' = 'CHECK';
    if (text.startsWith('เบิก') || text.startsWith('หัก') || text.startsWith('ลด') || text.includes('ตัดยอด') || text.includes('เบิกออก') || text.includes('เอาไปใช้') || text.includes('หักลบ') || text.startsWith('ลบ')) {
      action = 'SUBTRACT';
    } else if (text.startsWith('เพิ่ม') || text.startsWith('แอด') || text.includes('เติม') || text.includes('เพิ่มสต็อก') || text.includes('บวกเพิ่ม')) {
      action = 'ADD';
    } else if (text.startsWith('ตั้ง') || text.includes('ปรับยอด') || text.startsWith('ใส่ยอด') || text.includes('เท่ากับ')) {
      action = 'SET';
    } else if (text.includes('ย้ายหมวด') || text.includes('เปลี่ยนหมวด') || text.includes('ย้ายไป') || text.includes('หมวดหมู่') || text.includes('หมวด')) {
      action = 'EDIT_CATEGORY';
    }

    // Extract quantity
    const qtyMatch = text.match(/\b(\d+)\b/);
    const quantity = qtyMatch ? parseInt(qtyMatch[1]) : null;

    // Common units
    const unitMatch = text.match(/(ชิ้น|กล่อง|ขวด|หลอด|แกลลอน|รีม|อัน|ม้วน|ถุง|ใบ|แท่ง|แพ็ค|แพค|แผ่น|เครื่อง|ตัว|คู่|ชุด|กิโล|ลิตร|มิลลิลิตร)/);
    const unit = unitMatch ? unitMatch[1] : 'ชิ้น';

    // Extract priority in fallback
    let priority: 'High' | 'Medium' | 'Low' = 'Medium';
    if (text.includes('ด่วน') || text.includes('สำคัญมาก')) {
      priority = 'High';
    } else if (text.includes('ทั่วไป') || text.includes('ไม่ด่วน')) {
      priority = 'Low';
    }

    // Extract min threshold in fallback
    const thresholdMatch = text.match(/(?:เตือนเมื่อเหลือ|เกณฑ์|ขั้นต่ำ)\s*(\d+)/i);
    const min_threshold = thresholdMatch ? parseInt(thresholdMatch[1]) : 0;

    // Extract name by removing action, quantity, units
    let name = messageText
      .replace(/^(?:เบิก|หัก|ลด|ตัดยอด|เบิกออก|เพิ่ม|แอด|เติม|ลบ|ตั้ง|เช็ก|ดู|สต็อก|สต๊อก|เช็ค|ปรับยอด|ปรับยอดใหม่|ปรับ|ย้าย|เปลี่ยนหมวดหมู่|เปลี่ยนหมวด|ย้ายหมวดหมู่|ย้ายหมวด)\s*/i, '')
      .replace(/\b\d+\b/g, '')
      .replace(/(?:จำนวน|เท่ากับ|เป็น|ยอด|ชิ้น|กล่อง|ขวด|หลอด|แกลลอน|รีม|อัน|ม้วน|ถุง|ใบ|แท่ง|แพ็ค|แพค|แผ่น|เครื่อง|ตัว|คู่|ชุด|กิโล|ลิตร|มิลลิลิตร|วัน|เครดิต|ด่วน|ทั่วไป|ไม่ด่วน|สำคัญมาก|ไปหมวดหมู่|ไปหมวด|หมวดหมู่|หมวด|laboratory|office|lab|แล็บ)/gi, '')
      .replace(/(?:ครับ|ค่ะ|จ้า|นะ|นะครับ|นะคะ|ด้วย|ด้วยครับ|ด้วยค่ะ|หน่อย|หน่อยครับ|หน่อยค่ะ)\s*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    name = name.replace(/^[:\-ー\s\.]+/, '').trim();

    return {
      intent: 'STOCK',
      stock_data: {
        action,
        name: name || null,
        quantity,
        unit,
        category: text.includes('lab') || text.includes('แล็บ') || text.includes('สารเคมี') ? 'Laboratory' : 'อุปกรณ์สำนักงาน',
        priority,
        min_threshold
      }
    };
  }

  // 1. SEARCH intent
  if (text.startsWith('ค้นหา') || text.startsWith('หา') || text.startsWith('search') || text.startsWith('find') || text.startsWith('ดู')) {
    const query = messageText.replace(/^(ค้นหา|หา|search|find|ดู)\s*/i, '').trim();
    const matched = findClosestItem(query, existingItems);
    return { 
      intent: 'SEARCH', 
      search_query: matched ? matched.title : query,
      item_id: matched ? matched.id : undefined
    };
  }

  // 2. DELETE intent
  if (text.startsWith('ลบ') || text.startsWith('delete') || text.startsWith('ยกเลิก')) {
    const query = messageText.replace(/^(ลบ|delete|ยกเลิก)\s*/i, '').trim();
    const matched = findClosestItem(query, existingItems);
    return { intent: 'DELETE', item_id: matched?.id || undefined };
  }

  // 3. COMPLETE intent
  if (text.startsWith('เสร็จแล้ว') || text.startsWith('สำเร็จ') || text.startsWith('complete') || text.includes('เสร็จ') || text.includes('สำเร็จ') || text.includes('ออกรหัส') || text.includes('ออกไอเทม')) {
    const query = messageText.replace(/^(เสร็จแล้ว|สำเร็จ|complete|เสร็จ|ออกรหัส|ออกไอเทม)\s*/i, '').trim();
    const matched = findClosestItem(query, existingItems);
    return { intent: 'COMPLETE', item_id: matched?.id || undefined };
  }

  // 4. Request AX Item intent
  if (text.startsWith('แจ้งจัดซื้อ') || text.startsWith('ขอไอเทม') || text.startsWith('แอดไอเทม') || text.startsWith('ส่งจัดซื้อ')) {
    const query = messageText.replace(/^(แจ้งจัดซื้อ|ขอไอเทม|แอดไอเทม|ส่งจัดซื้อ)\s*/i, '').trim();
    const matched = findClosestItem(query, existingItems);
    return {
      intent: 'UPDATE',
      item_id: matched?.id || undefined,
      update_data: {
        item_request_status: 'Pending',
        status: 'Purchasing'
      } as any
    };
  }

  // 5. UPDATE intent
  if (text.startsWith('แก้ไข') || text.startsWith('แก้') || text.startsWith('edit') || text.startsWith('update')) {
    const query = messageText.replace(/^(แก้ไข|แก้|edit|update)\s*/i, '').trim();
    const creditMatch = query.match(/(?:เครดิต|credit)\s*(30|60|90)/i);
    const credit_term = creditMatch ? Number(creditMatch[1]) as 30 | 60 | 90 : null;

    let targetQuery = query.replace(/(?:เครดิต|credit)\s*(30|60|90)/i, '').trim();
    const matched = findClosestItem(targetQuery, existingItems);

    return {
      intent: 'UPDATE',
      item_id: matched?.id || undefined,
      update_data: credit_term ? { credit_term } : {}
    };
  }

  // 6. CREATE intent (default fallback)
  let credit_term: 30 | 60 | 90 | null = null;
  let po_date: string | null = null;
  let budget_due_date: string | null = null;

  const creditMatch = messageText.match(/(?:เครดิต|credit|cr)\s*(30|60|90)\s*(?:วัน|days)?/i);
  if (creditMatch) {
    credit_term = Number(creditMatch[1]) as 30 | 60 | 90;
    po_date = new Date().toISOString().substring(0, 10);
    budget_due_date = calculateDueDate(po_date, credit_term);
  }

  const reminder_date = extractReminderDate(messageText);

  let title = messageText.replace(/(?:เครดิต|credit|cr)\s*(30|60|90)\s*(?:วัน|days)?/i, '').trim();
  title = title.replace(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g, '').trim();
  title = title.replace(/(?:แจ้งเตือน|เตือน|วันจันทร์ที่|วันอังคารที่|วันพุธที่|วันพฤหัสบดีที่|วันศุกร์ที่|วันเสาร์ที่|วันอาทิตย์ที่|วันที่|วัน)\s*$/i, '').trim();
  title = title.replace(/^(เพิ่ม)\s*/i, '').trim();
  
  // Clean up prefix reminder/action keywords from the beginning of the title (e.g. "ไม่แจ้งเตือน", "ให้แจ้งเตือน", "แจ้งเตือน")
  title = title.replace(/^(?:ให้แจ้งเตือน|ไม่แจ้งเตือน|ช่วยแจ้งเตือน|แจ้งเตือน|ช่วยเตือน|เตือน|บันทึก|จด|เพิ่ม)\s*/i, '').trim();
  // Strip any leading colons, dashes or spaces left over from the keyword removal (e.g. "แจ้งเตือน: ..." -> "...")
  title = title.replace(/^[:\-ー\s\.]+/, '').trim();

  return {
    intent: 'CREATE',
    create_data: {
      title: title || messageText,
      description: `บันทึกผ่าน LINE Bot: ${messageText}`,
      credit_term,
      po_date,
      budget_due_date,
      reminder_date
    }
  };
}

/**
 * Searches and finds the closest matching item in the list.
 * Will return null if targeted short ID lookup is not found, to prevent accidental mismatches.
 */
function findClosestItem(query: string, items: any[]): any | null {
  if (items.length === 0 || !query) return null;
  const cleanQuery = query.toLowerCase().trim();

  // Try matching by short ID first (most specific)
  const shortIdMatch = cleanQuery.match(/(?:#)?\b([a-f0-9]{3})\b/) || cleanQuery.match(/(?:#)?([a-f0-9]{3})$/);
  if (shortIdMatch) {
    const shortId = shortIdMatch[1];
    const found = items.find(item => item.id.toLowerCase().endsWith(shortId));
    if (found) return found;
    
    // CRITICAL: If short ID is matched but item is not found, do NOT fall back to title substring.
    // Return null to prevent deleting or modifying the wrong item.
    return null;
  }

  // Try direct substring match
  for (const item of items) {
    if (item.title.toLowerCase().includes(cleanQuery) || cleanQuery.includes(item.title.toLowerCase())) {
      return item;
    }
  }
  return null; // Return null instead of items[0] to prevent accidental destructive actions
}

/**
 * Extracts and parses details specifically for editing an existing item.
 */
export async function parseItemEditWithAI(
  messageText: string,
  currentItem: { title: string; description: string | null; credit_term: number | null; reminder_date: string | null },
  apiKey: string
): Promise<{
  title?: string;
  description?: string;
  credit_term?: number | null;
  po_date?: string | null;
  budget_due_date?: string | null;
  reminder_date?: string | null;
}> {
  const modelName = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const nowUtc = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const localDate = new Date(nowUtc.getTime() + 7 * 60 * 60 * 1000);
  const localDateTimeStr = `${localDate.getUTCFullYear()}-${pad(localDate.getUTCMonth() + 1)}-${pad(localDate.getUTCDate())}T${pad(localDate.getUTCHours())}:${pad(localDate.getUTCMinutes())}:${pad(localDate.getUTCSeconds())}+07:00`;

  let currentReminderStr = 'None';
  if (currentItem.reminder_date) {
    const d = new Date(currentItem.reminder_date);
    const lDate = new Date(d.getTime() + 7 * 60 * 60 * 1000);
    currentReminderStr = `${lDate.getUTCFullYear()}-${pad(lDate.getUTCMonth() + 1)}-${pad(lDate.getUTCDate())} ${pad(lDate.getUTCHours())}:${pad(lDate.getUTCMinutes())}`;
  }

  const body = {
    contents: [{
      parts: [{
        text: `You are an edit parser for JodJum (จำจด).
Today's local date and time in Thailand (ICT, UTC+7) is ${localDateTimeStr}.

The user is editing a specific item. Here is the current state of the item:
- Title: "${currentItem.title}"
- Description: "${currentItem.description || 'None'}"
- Credit Term: ${currentItem.credit_term || 'None'} days
- Scheduled Reminder: ${currentReminderStr}

The user has sent this edit request: "${messageText}"

Analyze the request to see what fields they want to change.
Rules:
1. If the user wants to change/set/update the reminder time (e.g., "แจ้งเตือนตอน 12:00", "แก้เวลาเป็นพรุ่งนี้ 9 โมงเช้า", "เตือนพรุ่งนี้บ่ายโมง", "แก้เวลาแจ้งเตือนใหม่", "แก้เวลาเป็น 15/07/26 เวลา 10:00", "แจ้งเตือนเวลาตอน 12:00 น."), extract/calculate the new "reminder_date" as an ISO String in Thailand timezone (+07:00).
   - If they specify only a time (e.g. "ตอน 12:00 น.", "แก้เวลาเป็น 10:00"), keep the date of today (or tomorrow if the time has already passed today, but default to today first) or keep the current reminder's date if appropriate.
   - If they specify a time edit but it has no date/time information at all (e.g. just "แก้เวลาแจ้งเตือนใหม่" without any time), do not change the reminder_date or the title. Leave both unchanged.
   - If they say "ยกเลิกแจ้งเตือน" / "ไม่เตือนแล้ว" / "ลบวันแจ้งเตือน" / "ไม่แจ้งเตือนแล้ว", set "reminder_date" to null.
2. If the user wants to change the title (e.g. "แก้ชื่อเป็น คอมพิวเตอร์ i7", "เปลี่ยนชื่อรายการเป็น ซื้ออุปกรณ์สำนักงาน", "แก้ชื่อเป็น สมุดโน้ต", or they type a clear new name like "กระดาษ A4 10 กล่อง" without referencing dates/times or credit terms), set the "title" field.
   - CRITICAL: Never include keyword prefixes like 'แจ้งเตือน', 'ให้แจ้งเตือน', 'ไม่แจ้งเตือน', 'เตือน', 'ช่วยเตือน', 'ช่วยแจ้งเตือน', 'บันทึก', 'จด', 'เพิ่ม', 'แก้ชื่อเป็น', 'เปลี่ยนชื่อเป็น' in the title. Remove them.
3. If they only requested to change the reminder date/time (e.g., "แจ้งเตือนเวลาตอน 12:00 น.") or the credit term, and did NOT request a title change, do NOT return the "title" field in your JSON output (or set it to null), so that the existing title is preserved! E.g. for "แจ้งเตือนเวลาตอน 12:00 น.", the user wants to update the reminder_date, NOT change the title to "แจ้งเตือนเวลาตอน 12:00 น.".
4. If they want to change the credit term (e.g., "เครดิต 60 วัน"), set "credit_term" (30 | 60 | 90) and set "po_date" to today's date "YYYY-MM-DD" and "budget_due_date" to "YYYY-MM-DD" (po_date + credit_term).
5. If the request is a mix of changes (e.g., "แก้ชื่อเป็น คอมพิวเตอร์ และเตือนพรุ่งนี้ 9 โมง"), return both "title" and "reminder_date" fields.

Format the output strictly as JSON with the following structure (include only fields that are being updated):
{
  "title": "New title if updated (or null/omit if title should not be changed)",
  "description": "New description if updated (or null/omit)",
  "credit_term": 30 | 60 | 90 | null (if updated, otherwise omit),
  "po_date": "YYYY-MM-DD (if credit_term updated, otherwise omit)",
  "budget_due_date": "YYYY-MM-DD (if credit_term updated, otherwise omit)",
  "reminder_date": "ISOString with +07:00 offset (if reminder date/time is updated/added), or null (if user requested to delete/clear the reminder), or omit if no changes to reminder"
}`
      }]
    }],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Item edit parser API error: status ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const parsed = JSON.parse(rawText.trim());

  if (parsed.title) {
    parsed.title = parsed.title.replace(/^(?:ให้แจ้งเตือน|ไม่แจ้งเตือน|ช่วยแจ้งเตือน|แจ้งเตือน|ช่วยเตือน|เตือน|บันทึก|จด|เพิ่ม|แก้ชื่อเป็น|เปลี่ยนชื่อเป็น|แก้ชื่อ|เปลี่ยนชื่อ|แก้|เปลี่ยน)\s*/i, '').trim();
    parsed.title = parsed.title.replace(/^[:\-ー\s\.]+/, '').trim();
  }

  return parsed;
}

/**
 * Analyzes an image with Gemini Multimodal API.
 */
export async function analyzeImageWithAI(
  imageBase64: string,
  mimeType: string,
  activeMode: 'stock' | 'reminder' | null,
  apiKey: string
): Promise<any> {
  const modelName = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const nowUtc = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const localDate = new Date(nowUtc.getTime() + 7 * 60 * 60 * 1000);
  const localDateTimeStr = `${localDate.getUTCFullYear()}-${pad(localDate.getUTCMonth() + 1)}-${pad(localDate.getUTCDate())}T${pad(localDate.getUTCHours())}:${pad(localDate.getUTCMinutes())}:${pad(localDate.getUTCSeconds())}+07:00`;

  let prompt = '';
  if (activeMode === 'stock') {
    prompt = `You are a stock receipt and item parser for JodJum (จำจด).
Today's local date and time in Thailand (ICT, UTC+7) is ${localDateTimeStr}.

Analyze this image of a receipt, item package, or stock listing. Extract any stock materials/items.
For each item, extract:
- name: Clean, short name of the material (in Thai if Thai, e.g. 'กระดาษ A4')
- quantity: Numeric quantity (integer or float)
- unit: Unit (in Thai if Thai, e.g. 'ชิ้น', 'กล่อง', 'ขวด', 'อัน', 'แผ่น')

Format the response strictly as JSON with the following structure:
{
  "type": "STOCK",
  "items": [
    {
      "name": "Clean name of item",
      "quantity": 10,
      "unit": "ชิ้น"
    }
  ]
}`;
  } else {
    prompt = `You are a reminder and task parser for JodJum (จำจด).
Today's local date and time in Thailand (ICT, UTC+7) is ${localDateTimeStr}.

Analyze this image of a receipt, document, or handwritten note. Extract the main task/reminder details.
Suggest a reminder title and when to remind if specified.

Format the response strictly as JSON with the following structure:
{
  "type": "REMINDER",
  "title": "Clean, short, and descriptive title (in Thai, e.g. 'จ่ายค่าน้ำประปา', 'เคลียร์งบประมาณ')",
  "description": "Short description of details extracted from the image (in Thai)",
  "reminder_date": "ISOString in Thailand timezone (+07:00) of when to remind, or null if no specific time is found (If only date is specified, default time to 09:00:00+07:00)"
}`;
  }

  const body = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType,
              data: imageBase64
            }
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Gemini Multimodal API error: status ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return JSON.parse(rawText.trim());
}


