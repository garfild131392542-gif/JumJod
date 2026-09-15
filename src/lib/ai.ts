
function safeJsonParse(text: string): any {
  try {
    const clean = text.replace(/^\`\`\`(?:json)?\s*/i, '').replace(/\s*\`\`\`$/i, '').trim();
    return JSON.parse(clean);
  } catch (e) {
    console.error('safeJsonParse error on:', text);
    throw e;
  }
}
import { ItemStatus } from './types';

export interface ParsedProcurementData {
  title: string;
  description: string;
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
    status?: 'Pending' | 'Issuing Item';
    reminder_date?: string | null;
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

const GEMINI_CANDIDATE_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-2.5-flash',
  'gemini-3.7-flash'
];

/**
 * Fetches Gemini API with dynamic model fallback chain.
 */
export async function fetchGeminiWithFallback(body: any, apiKey: string): Promise<any> {
  let lastError: Error | null = null;
  for (const modelName of GEMINI_CANDIDATE_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (response.ok) {
        return await response.json();
      }
      const errText = await response.text().catch(() => '');
      lastError = new Error(`Gemini API error status ${response.status} for model ${modelName}: ${errText}`);
    } catch (err: any) {
      lastError = err;
    }
  }
  throw lastError || new Error('All Gemini models failed');
}

/**
 * Classifies user intent using a specialized, focused Gemini prompt.
 */
async function classifyIntentWithAI(
  messageText: string,
  existingItems: any[],
  apiKey: string
): Promise<'CREATE' | 'SEARCH' | 'UPDATE' | 'DELETE' | 'COMPLETE' | 'UNKNOWN' | 'STOCK'> {
  const body = {
    contents: [{
      parts: [{
        text: `You are an intent classifier for JodJum (เธเธณเธเธ”) - a procurement and inventory planner system.
Analyze this message from the user: "${messageText}"

Existing items context (recent active procurement items):
${JSON.stringify(existingItems.map(item => ({ id: item.id, title: item.title })))}

Classify the user's intent into one of the following:
- STOCK: User wants to manage stock, inventory, laboratory, or office supplies (e.g. "เน€เธเธดเธเนเธญเธฅเธเธญเธฎเธญเธฅเน 2 เธเธงเธ”", "เน€เธเธดเนเธกเธเธฃเธฐเธ”เธฒเธฉ 10 เธฃเธตเธก", "เน€เธเนเธเธชเธ•เนเธญเธเธเธฃเธฐเธ”เธฒเธฉ A4", "เนเธญเธ”เนเธญเธฅเธเธญเธฎเธญเธฅเน 95%", "เธชเธ•เนเธญเธ", "เธ•เธฑเธ”เธชเธ•เนเธญเธ", "เธฅเธเธงเธฑเธชเธ”เธธเนเธญเธฅเธเธญเธฎเธญเธฅเนเธญเธญเธเธเธฒเธเธเธฅเธฑเธ", "เนเธญเธฅเธเธญเธฎเธญเธฅเน").
- CREATE: User wants to add/remember a new procurement item, task, or purchase reminder (e.g. "เธเธฑเธเธ—เธถเธ เน€เธเธฅเธตเธขเธฃเนเนเธเธฅเนเธเธเธเธฃเธฐเธกเธฒเธ“", "เธชเธฑเนเธเธเธทเนเธญเธเธญเธก", "เนเธเนเธเน€เธ•เธทเธญเธเธชเน€เธเนเธ•เธเธฒเธเธเธฃเธธเนเธเธเธตเน").
- SEARCH: User wants to search or look up items (e.g. "เธเนเธเธซเธฒเธฃเธฐเน€เธเธตเธขเธ", "เธซเธฒ เธเธฃเธฐเธ”เธฒเธฉ").
- UPDATE: User wants to edit/change/update details of an existing item (e.g. "เนเธเนเนเธ เธเธทเนเธญเธซเธกเธถเธ เน€เธเธดเนเธกเน€เธเธฃเธ”เธดเธ•เน€เธเนเธ 60 เธงเธฑเธ", "เนเธเนเธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”เธเธญเธก").
- DELETE: User wants to delete or remove an item (e.g. "เธฅเธเธฃเธฒเธขเธเธฒเธฃเธเธฃเธฐเธ”เธฒเธฉ", "เธฅเธ b77", "เธขเธเน€เธฅเธดเธเนเธเธชเธฑเนเธเธเธญเธก").
- COMPLETE: User wants to mark an item as finished/done/completed/successful (e.g. "เธชเธณเน€เธฃเนเธ b78", "เน€เธชเธฃเนเธเนเธฅเนเธงเธฃเธฒเธขเธเธฒเธฃเธเธทเนเธญเธเธญเธก").
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

  const data = await fetchGeminiWithFallback(body, apiKey);
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const parsed = safeJsonParse(rawText);
  return parsed.intent;
}

/**
 * Extracts details specifically for creating a new item.
 */
async function parseCreateMessageWithAI(
  messageText: string,
  apiKey: string
): Promise<ParsedProcurementData> {
  const nowUtc = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const localDate = new Date(nowUtc.getTime() + 7 * 60 * 60 * 1000);
  const localDateTimeStr = `${localDate.getUTCFullYear()}-${pad(localDate.getUTCMonth() + 1)}-${pad(localDate.getUTCDate())}T${pad(localDate.getUTCHours())}:${pad(localDate.getUTCMinutes())}:${pad(localDate.getUTCSeconds())}+07:00`;

  const body = {
    contents: [{
      parts: [{
        text: `You are a data extraction AI for JodJum (เธเธณเธเธ”).
Today's local date and time in Thailand (ICT, UTC+7) is ${localDateTimeStr}.
Analyze this message from the user to extract details for creating a new item: "${messageText}"

Extract the following fields and format strictly as JSON:
{
  "title": "Clean, short, and descriptive title of the procurement or task. CRITICAL: Never include keyword prefixes or suffixes related to dates, times, or reminder instructions in the title. Strip any phrases like 'เนเธเนเธเน€เธ•เธทเธญเธเธงเธฑเธเธ—เธตเน...', 'เธ•เธญเธ...', 'เน€เธ•เธทเธญเธ...', 'เธงเธฑเธเธเธฑเธเธ—เธฃเนเธซเธเนเธฒ', 'เน€เธงเธฅเธฒ...' entirely. E.g. for 'เธกเธตเธญเธเธฃเธกเธเธฒเธฃเน€เธเธดเนเธกเนเธญเน€เธ—เธกเนเธเธฃเธฐเธเธAX เนเธเนเธเน€เธ•เธทเธญเธเธงเธฑเธเธ—เธตเน 17/07/26 เธ•เธญเธ 07.00 เธ.' the title MUST BE ONLY 'เธกเธตเธญเธเธฃเธกเธเธฒเธฃเน€เธเธดเนเธกเนเธญเน€เธ—เธกเนเธเธฃเธฐเธเธAX', for 'เธเธฑเธเธ—เธถเธ เน€เธเธฅเธตเธขเธฃเนเนเธเธฅเนเธเธเธเธฃเธฐเธกเธฒเธ“ เนเธซเนเธเธตเนเน€เธ—เธตเธขเธก' the title is 'เน€เธเธฅเธตเธขเธฃเนเนเธเธฅเนเธเธเธเธฃเธฐเธกเธฒเธ“ เนเธซเนเธเธตเนเน€เธ—เธตเธขเธก'",
  "description": "Full description details (optional)",
  "credit_term": 30 | 60 | 90 | null (if mentioned, e.g. เน€เธเธฃเธ”เธดเธ• 30 เธงเธฑเธ, otherwise null),
  "po_date": "YYYY-MM-DD (default to today if credit term is matched, otherwise null)",
  "budget_due_date": "YYYY-MM-DD (calculated as po_date + credit_term if matched, otherwise null)",
  "reminder_date": "ISOString in Thailand timezone (+07:00) or UTC (optional reminder date and time. Parse if message mentions when to remind, including time if specified. Pay close attention to Thai time formats like 'เธ•เธญเธ 07.00 เธ.' (which is 07:00:00), 'เธ•เธญเธ 7 เนเธกเธเน€เธเนเธฒ' (which is 07:00:00), 'เธ•เธญเธเธเนเธฒเธขเธชเธฒเธก' (which is 15:00:00). Always convert relative times accurately based on today's date/time. If only date is specified, default time to 09:00:00+07:00. Note: Thai short year like '26' in '17/07/26' means 2026 C.E. (not 2069 or 2026 B.E. B.E. 2569 is C.E. 2026))"
}`
      }]
    }],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  const data = await fetchGeminiWithFallback(body, apiKey);
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const parsed = safeJsonParse(rawText) as ParsedProcurementData;

  // Clean title prefix and suffix just in case Gemini missed it
  if (parsed.title) {
    parsed.title = parsed.title.replace(/^(?:เนเธซเนเนเธเนเธเน€เธ•เธทเธญเธ|เนเธกเนเนเธเนเธเน€เธ•เธทเธญเธ|เธเนเธงเธขเนเธเนเธเน€เธ•เธทเธญเธ|เนเธเนเธเน€เธ•เธทเธญเธ|เธเนเธงเธขเน€เธ•เธทเธญเธ|เน€เธ•เธทเธญเธ|เธเธฑเธเธ—เธถเธ|เธเธ”|เน€เธเธดเนเธก)\s*/i, '').trim();
    parsed.title = parsed.title.replace(/(?:เนเธเนเธเน€เธ•เธทเธญเธ)?เธงเธฑเธเธ—เธตเน\s*\d+[\/\.\-]\d+[\/\.\-]\d+(?:\s*(?:เธ•เธญเธ|เน€เธงเธฅเธฒ)?\s*\d+[\.\:]\d+\s*เธ\.?)?$/i, '').trim();
    parsed.title = parsed.title.replace(/(?:เนเธเนเธเน€เธ•เธทเธญเธ)?เธงเธฑเธเธ—เธตเน\s*\d+[\/\.\-]\d+[\/\.\-]\d+$/i, '').trim();
    parsed.title = parsed.title.replace(/(?:\s*(?:เธ•เธญเธ|เน€เธงเธฅเธฒ)?\s*\d+[\.\:]\d+\s*เธ\.?)$/i, '').trim();
    parsed.title = parsed.title.replace(/^[:\-ใผ\s\.]+/, '').trim();
    parsed.title = parsed.title.replace(/[:\-ใผ\s\.]+$/, '').trim();
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
  const body = {
    contents: [{
      parts: [{
        text: `You are an update parser for JodJum (เธเธณเธเธ”).
Identify which item to update and what fields should be modified based on this message: "${messageText}"

Here is the list of active/recent items for this user:
${JSON.stringify(existingItems.map(item => ({ id: item.id, title: item.title, description: item.description, status: item.status, credit_term: item.credit_term })))}

Format output strictly as JSON:
{
  "item_id": "UUID of the matching item to update from the list, or null if no match",
  "update_data": {
    "title": "New title if user requested to change the title (clean and descriptive, strip keywords like 'เนเธเนเธเน€เธ•เธทเธญเธ', 'เนเธซเนเนเธเนเธเน€เธ•เธทเธญเธ', 'เธเธฑเธเธ—เธถเธ')",
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

  const data = await fetchGeminiWithFallback(body, apiKey);
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const parsed = safeJsonParse(rawText);

  if (parsed.update_data && parsed.update_data.title) {
    parsed.update_data.title = parsed.update_data.title.replace(/^(?:เนเธซเนเนเธเนเธเน€เธ•เธทเธญเธ|เนเธกเนเนเธเนเธเน€เธ•เธทเธญเธ|เธเนเธงเธขเนเธเนเธเน€เธ•เธทเธญเธ|เนเธเนเธเน€เธ•เธทเธญเธ|เธเนเธงเธขเน€เธ•เธทเธญเธ|เน€เธ•เธทเธญเธ|เธเธฑเธเธ—เธถเธ|เธเธ”|เน€เธเธดเนเธก)\s*/i, '').trim();
    parsed.update_data.title = parsed.update_data.title.replace(/^[:\-ใผ\s\.]+/, '').trim();
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
  const body = {
    contents: [{
      parts: [{
        text: `You are an inventory data extraction AI for JodJum (เธเธณเธเธ”).
Analyze this user message related to stock: "${messageText}"

Extract the following fields and format strictly as JSON:
{
  "action": one of:
    "ADD" (adding stock/deposit/new material, e.g. "เน€เธเธดเนเธกเธเธฃเธฐเธ”เธฒเธฉ 10 เธฃเธตเธก", "เนเธญเธ”เนเธญเธฅเธเธญเธฎเธญเธฅเน 5 เธเธงเธ”"),
    "SUBTRACT" (withdrawing/reducing/using, e.g. "เน€เธเธดเธเธเธฒเธเธเธฒ 2 เนเธ—เนเธ", "เธ•เธฑเธ”เธญเธญเธ 1"),
    "SET" (setting specific quantity, e.g. "เธเธฃเธฑเธเธขเธญเธ”เธเธฃเธฐเธ”เธฒเธฉเน€เธเนเธ 20"),
    "DELETE" (removing from stock entirely, e.g. "เธฅเธเธงเธฑเธชเธ”เธธเนเธญเธฅเธเธญเธฎเธญเธฅเนเธญเธญเธ"),
    "CHECK" (checking stock balance, e.g. "เน€เธเนเธเธขเธญเธ”เธเธฒเธเธเธฒ", "เธกเธตเธเธฃเธฐเธ”เธฒเธฉเน€เธ—เนเธฒเนเธซเธฃเน"),
    "EDIT_NAME" (renaming a material, e.g. "เน€เธเธฅเธตเนเธขเธเธเธทเนเธญเธเธฒเธเธเธฒ Permanent เน€เธเนเธ เธเธฒเธเธเธฒเธฅเธเนเธกเนเนเธ”เน", "เนเธเนเธเธทเนเธญเธเธฃเธฐเธ”เธฒเธฉ A4"),
    "EDIT_DESC" (editing description/detail, e.g. "เนเธเนเธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”เนเธญเธฅเธเธญเธฎเธญเธฅเนเธงเนเธฒ เนเธเนเธชเธณเธซเธฃเธฑเธเธ—เธณเธเธงเธฒเธกเธชเธฐเธญเธฒเธ”", "เน€เธเธดเนเธกเธเธณเธญเธเธดเธเธฒเธข"),
    "EDIT_MIN" (changing min threshold, e.g. "เธ•เธฑเนเธเน€เธเธ“เธ‘เนเธเธฑเนเธเธ•เนเธณเธเธฒเธเธเธฒเน€เธเนเธ 5", "เธเธณเธซเธเธ”เธเธฒเธฃเน€เธ•เธทเธญเธเน€เธกเธทเนเธญเน€เธซเธฅเธทเธญเธเนเธญเธขเธเธงเนเธฒ 3"),
    "EDIT_PRIORITY" (changing priority, e.g. "เธ•เธฑเนเธเธ”เนเธงเธเธเธฃเธฐเธ”เธฒเธฉ A4 เน€เธเนเธ High", "เน€เธเธฅเธตเนเธขเธเธเธงเธฒเธกเธชเธณเธเธฑเธ"),
    "EDIT_CATEGORY" (changing category, e.g. "เธขเนเธฒเธขเธ–เนเธงเธข Crucible เนเธเธซเธกเธงเธ”เธซเธกเธนเน Lab", "เน€เธเธฅเธตเนเธขเธเธซเธกเธงเธ”เธซเธกเธนเนเธเธฃเธฐเธ”เธฒเธฉเน€เธเนเธเธญเธธเธเธเธฃเธ“เนเธชเธณเธเธฑเธเธเธฒเธ"),
  "name": "Current name of the material in stock (strip all action verbs like 'เน€เธเธดเธ', 'เน€เธเธดเนเธก', 'เนเธญเธ”', 'เธฅเธ”', 'เธฅเธ', 'เน€เธเนเธ', 'เน€เธเนเธ', 'เธ”เธน', 'เธ•เธฃเธงเธเธชเธญเธ', 'เน€เธเธฅเธตเนเธขเธเธเธทเนเธญ', 'เนเธเนเธเธทเนเธญ', 'เธ•เธฑเนเธเน€เธเธ“เธ‘เน', 'เธเธณเธซเธเธ”', 'เนเธเนเธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”', 'เธขเนเธฒเธขเธซเธกเธงเธ”เธซเธกเธนเน', 'เน€เธเธฅเธตเนเธขเธเธซเธกเธงเธ”'). This should be the EXISTING name in stock.",
  "quantity": number or null,
  "unit": "string or null",
  "category": CRITICAL RULE - Only provide category value in these specific cases:
    1. User explicitly says 'เน€เธเธฅเธตเนเธขเธเธซเธกเธงเธ”', 'เธขเนเธฒเธขเธซเธกเธงเธ”เธซเธกเธนเน', 'เน€เธเธดเนเธกเนเธเธซเธกเธงเธ” Lab', etc.
    2. NEVER set category for CHECK action - always null.
    3. NEVER set category just because you think the item belongs to a category.
    Set to "เธญเธธเธเธเธฃเธ“เนเธชเธณเธเธฑเธเธเธฒเธ" or "Laboratory" only when explicitly requested, otherwise null.,
  "new_name": "The new name to rename to (only for EDIT_NAME action, otherwise null)",
  "description": "New description text (only for EDIT_DESC action, otherwise null)",
  "new_min_threshold": number or null (only for EDIT_MIN action, the new threshold value),
  "new_priority": "High" | "Medium" | "Low" | null (only for EDIT_PRIORITY action),
  "confidence": integer 1-100 (how confident you are about this interpretation),
  "confirm_message": "Thai question to ask user to confirm if confidence < 70, e.g. 'เธเธธเธ“เธ•เนเธญเธเธเธฒเธฃ [action] [name] เนเธเนเนเธซเธกเธเธฃเธฑเธ?', otherwise null"
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

  const data = await fetchGeminiWithFallback(body, apiKey);
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const parsed = safeJsonParse(rawText);

  // Clean stock name
  if (parsed.name) {
    parsed.name = parsed.name.replace(/^(?:เน€เธเธดเธ|เน€เธเธดเนเธก|เนเธญเธ”|เธฅเธ”|เธฅเธ|เน€เธเนเธ|เธ”เธน|เธชเธ•เนเธญเธ|เธชเธ•เนเธญเธ|เน€เธเนเธ|เน€เธเธฅเธตเนเธขเธเธเธทเนเธญ|เนเธเนเธเธทเนเธญ|เธ•เธฑเนเธเน€เธเธ“เธ‘เน|เธเธณเธซเธเธ”|เนเธเนเธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”|เธ•เธฑเนเธ)\s*/i, '').trim();
    parsed.name = parsed.name.replace(/^[:\-ใผ\s\.]+/, '').trim();
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
    const data = await fetchGeminiWithFallback(body, apiKey);
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = safeJsonParse(rawText);
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
  // Build list of existing items for typo matching and suggestions
  const itemsContext = existingItems.slice(0, 15).map(item => `- ${item.title} (Status: ${item.status || 'Pending'})`).join('\n');

  const promptText = `You are a helpful inventory and procurement chatbot assistant named JodJum (เธเธณเธเธ”) for LINE messaging.
The user sent a message that could not be recognized as a specific command: "${messageText}"
Current mode of the user is: ${activeMode || 'none (no mode selected)'}

Here is a list of some existing items in the database for context/correction suggestions if applicable:
${itemsContext || '(No items registered yet)'}

Instructions:
1. Analyze the user's message.
2. If they have a typo matching an item (e.g. they typed 'Crucble' close to 'Crucible'), politely ask if they meant that item.
3. If they typed a stock/inventory action but are not in stock mode (current mode is not 'stock'), tell them to switch to stock mode by sending "เธชเธ•เนเธญเธ" or guide them.
4. If their message is completely incomprehensible, offer general help politely and suggest some clear examples of what they can do:
   - For reminders/items: "เธเธทเนเธญเธเธฃเธฐเธ”เธฒเธฉ A4 10 เธฃเธตเธก เน€เธเธฃเธ”เธดเธ• 30 เธงเธฑเธ"
   - For stock/inventory: "เน€เธเธดเธ เนเธญเธฅเธเธญเธฎเธญเธฅเน 2 เธเธงเธ”"
5. Respond in polite Thai (speak nicely, use 'เธเธฃเธฑเธ/เธเนเธฐ', keep it friendly and supportive). Keep the response brief, engaging, and clear (max 3-4 sentences).
6. DO NOT repeat this prompt. Only output the friendly conversational response.`;

  const body = {
    contents: [{
      parts: [{
        text: promptText
      }]
    }]
  };

  try {
    const data = await fetchGeminiWithFallback(body, apiKey);
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return rawText.trim() || '๐ค– เธเธญเธญเธ เธฑเธขเธเธฃเธฑเธ เธเธกเนเธกเนเน€เธเนเธฒเนเธเธเธณเธชเธฑเนเธเธเธตเน เธเธฃเธธเธ“เธฒเธฅเธญเธเธเธดเธกเธเนเธเนเธญเธเธงเธฒเธกเนเธซเธกเนเธญเธตเธเธเธฃเธฑเนเธ เธซเธฃเธทเธญเธชเธฅเธฑเธเนเธซเธกเธ”เธเธฒเธฃเธ—เธณเธเธฒเธเธเธฃเธฑเธ';
  } catch (err) {
    console.error('Error generating fallback help message:', err);
    return '๐ค– เธเธญเธญเธ เธฑเธขเธเธฃเธฑเธ เธเธกเนเธกเนเน€เธเนเธฒเนเธเธเธณเธชเธฑเนเธเธเธตเน เธเธฃเธธเธ“เธฒเธฅเธญเธเธเธดเธกเธเนเธเนเธญเธเธงเธฒเธกเนเธซเธกเนเธญเธตเธเธเธฃเธฑเนเธ เธซเธฃเธทเธญเธชเธฅเธฑเธเนเธซเธกเธ”เธเธฒเธฃเธ—เธณเธเธฒเธเธเธฃเธฑเธ';
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
  const isGenericWord = /^(เน€เธเธดเนเธกเธเนเธญเธกเธนเธฅ|เน€เธเธดเนเธก|เธเธ”|เธเธฑเธเธ—เธถเธ|เธเธ”เธเธฑเธเธ—เธถเธ|เธชเธฑเนเธ|เธเธทเนเธญ)$/i.test(text);
  if (isGenericWord) {
    return {
      intent: 'UNKNOWN',
      message: 'เธ•เนเธญเธเธเธฒเธฃเน€เธเธดเนเธกเธเนเธญเธกเธนเธฅเธญเธฐเนเธฃเธ”เธตเธเธฃเธฑเธ? เธเธดเธกเธเนเธเธญเธเธเธณเธเธ”เนเธ”เนเน€เธฅเธขเธเนเธฒ เน€เธเนเธ "เธเธฑเธ”เธเธฃเธฐเธเธธเธกเธเธฃเธธเนเธเธเธตเน 10 เนเธกเธเน€เธเนเธฒ" เธซเธฃเธทเธญ "เธเนเธฒเธขเธเนเธฒเธเนเธณเธเธฃเธฐเธเธฒ เธงเธฑเธเธ—เธตเน 20/07/26 เน€เธงเธฅเธฒ 14:00" เธเธฃเธฑเธ ๐'
    };
  }

  // 2. Intercept greetings and help prompts for instant, friendly replies (no API delay)
  const isGreeting = /^(เธชเธงเธฑเธชเธ”เธต|เธซเธงเธฑเธ”เธ”เธต|เธ”เธตเธเธฃเธฑเธ|เธ”เธตเธเนเธฐ|เธ”เธตเธเนเธฒ|hello|hi|hey|hola|greetings)/i.test(text);
  const isHelpPrompt = /^(เธเนเธงเธขเธเธ”เธเธฑเธเธ—เธถเธ|เธเนเธงเธขเธเธ”|เธเธ”เธเธฑเธเธ—เธถเธ|เธเธ”เธซเธเนเธญเธข|เธเนเธงเธขเธซเธเนเธญเธข|เธ—เธณเธญเธฐเนเธฃเนเธ”เนเธเนเธฒเธ|เธเธนเนเธกเธทเธญ|เนเธเนเธเธฒเธเธขเธฑเธเนเธ)/i.test(text);

  if (isGreeting) {
    return {
      intent: 'UNKNOWN',
      message: 'เธชเธงเธฑเธชเธ”เธตเธเธฃเธฑเธ เธขเธดเธเธ”เธตเธ•เนเธญเธเธฃเธฑเธเธชเธนเนเธเธณเธเธ”! เธกเธตเธญเธฐเนเธฃเนเธซเนเธเธกเธเนเธงเธขเธเธฑเธเธ—เธถเธเธซเธฃเธทเธญเธเนเธงเธขเธเธณเธงเธฑเธเธเธตเนเนเธซเธกเธเธฃเธฑเธ ๐'
    };
  }

  if (isHelpPrompt) {
    return {
      intent: 'UNKNOWN',
      message: 'เธขเธดเธเธ”เธตเธเธฃเธฑเธ! เธเธธเธ“เธชเธฒเธกเธฒเธฃเธ–เธเธดเธกเธเนเธชเธฑเนเธเธเธ”เธเธฑเธเธ—เธถเธเธซเธฃเธทเธญเธ•เธฑเนเธเน€เธ•เธทเธญเธเธเธงเธฒเธกเธเธณเนเธ”เนเน€เธฅเธขเธเนเธฒ\n\nเธ•เธฑเธงเธญเธขเนเธฒเธเน€เธเนเธ:\n๐“ "เธเธฑเธ”เธเธฃเธฐเธเธธเธกเธเธฃเธธเนเธเธเธตเน 10 เนเธกเธเน€เธเนเธฒ"\n๐“ "เธเนเธฒเธขเธเนเธฒเธเนเธณเธเธฃเธฐเธเธฒ เธงเธฑเธเธ—เธตเน 20/07/26 เน€เธงเธฅเธฒ 14:00"'
    };
  }

  // 3. Fast exact matching for ID targeted commands (No API delay, 100% accurate)
  if (matchedItem) {
    if (/(เธชเธณเน€เธฃเนเธ|เน€เธชเธฃเนเธ|complete|finish|done|เธญเธญเธเธฃเธซเธฑเธช|เธญเธญเธเนเธญเน€เธ—เธก|เธญเธญเธ\s*pr\s*เนเธฅเนเธง)/i.test(text)) {
      return { intent: 'COMPLETE', item_id: matchedItem.id };
    }
    if (/(เธฅเธ|เธขเธเน€เธฅเธดเธ|delete|remove)/i.test(text)) {
      return { intent: 'DELETE', item_id: matchedItem.id };
    }
    if (/(เนเธเนเนเธ|เนเธเน|update|edit)/i.test(text)) {
      return {
        intent: 'UPDATE',
        item_id: matchedItem.id,
        update_data: {}
      };
    }
    // If just typing short ID, treat as search
    const isJustId = text === matchedItem.id.substring(matchedItem.id.length - 3).toLowerCase() || 
                      text === '#' + matchedItem.id.substring(matchedItem.id.length - 3).toLowerCase();
    const isSearch = text.includes('เธเนเธเธซเธฒ') || text.includes('เธซเธฒ') || text.includes('search') || text.includes('find') || text.includes('เธ”เธน');
    
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
      const nowUtc = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const localDate = new Date(nowUtc.getTime() + 7 * 60 * 60 * 1000);
      const localDateTimeStr = `${localDate.getUTCFullYear()}-${pad(localDate.getUTCMonth() + 1)}-${pad(localDate.getUTCDate())}T${pad(localDate.getUTCHours())}:${pad(localDate.getUTCMinutes())}:${pad(localDate.getUTCSeconds())}+07:00`;
      
      const itemsContext = existingItems.map(item => ({ id: item.id, title: item.title, description: item.description, status: item.status }));

      const body = {
        contents: [{
          parts: [{
            text: `You are an intelligent assistant for JodJum (เธเธณเธเธ”) - a procurement and inventory planner system.
Today's local date and time in Thailand is ${localDateTimeStr}.
Current user mode: ${activeMode || 'none'}.

Active Items Context:
${JSON.stringify(itemsContext)}

Analyze this message from the user: "${messageText}"

Your task is to determine the intent and extract relevant data in a SINGLE SHOT.
Possible intents: 'STOCK', 'CREATE', 'SEARCH', 'UPDATE', 'DELETE', 'COMPLETE', 'UNKNOWN'.

If the user's message is ambiguous, lacks critical information, or doesn't match a clear action, set intent to 'UNKNOWN' and provide a polite, friendly Thai \`message\` asking for clarification.
Example: user says "เน€เธเธดเนเธกเธเธฃเธฐเธ”เธฒเธฉ", you clarify "เธ•เนเธญเธเธเธฒเธฃเน€เธเธดเนเธกเธเธฃเธฐเธ”เธฒเธฉเธเธตเนเธฃเธตเธกเธเธฃเธฑเธ?".
Example: user says "เธชเธงเธฑเธชเธ”เธต", you greet back "เธชเธงเธฑเธชเธ”เธตเธเธฃเธฑเธ เธกเธตเธญเธฐเนเธฃเนเธซเนเธเธกเธเนเธงเธขเธเธ”เนเธซเธกเธเธฃเธฑเธ ๐".

Format the output strictly as a JSON object matching this structure:
{
  "intent": "STOCK" | "CREATE" | "SEARCH" | "UPDATE" | "DELETE" | "COMPLETE" | "UNKNOWN",
  "search_query": "string (for SEARCH)",
  "item_id": "string UUID of matched item from context (for UPDATE, DELETE, COMPLETE, SEARCH)",
  "create_data": {
    "title": "Clean, short title (strip keywords like 'เนเธเนเธเน€เธ•เธทเธญเธ', 'เธเธฑเธเธ—เธถเธ', etc.)",
    "description": "string or null",
    "reminder_date": "ISOString with +07:00 or null (parse Thai relative times e.g. เธ•เธญเธเธเนเธฒเธขเธชเธฒเธก -> 15:00:00. Note Thai short year like '26' means 2026 C.E.)"
  },
  "update_data": {
    "title": "New title if changed",
    "description": "New desc if changed",
    "status": "Pending" | "Issuing Item"
  },
  "stock_data": {
    "action": "ADD" | "SUBTRACT" | "SET" | "DELETE" | "CHECK" | "EDIT_NAME" | "EDIT_DESC" | "EDIT_MIN" | "EDIT_PRIORITY" | "EDIT_CATEGORY" | "CONFIRM_NEEDED",
    "name": "Current item name in stock (strip action verbs)",
    "quantity": number or null,
    "unit": "string or null",
    "category": "Laboratory" | "เธญเธธเธเธเธฃเธ“เนเธชเธณเธเธฑเธเธเธฒเธ" | null,
    "new_name": "string or null",
    "description": "string or null",
    "new_min_threshold": number or null,
    "new_priority": "High" | "Medium" | "Low" | null,
    "confidence": number (1-100),
    "confirm_message": "string or null (Thai question to confirm if confidence < 70)"
  },
  "message": "Friendly response for UNKNOWN intent, greetings, or clarifications. Keep it polite, Thai language, 'เธเธฃเธฑเธ/เธเนเธฐ'."
}

Few-shot examples:
User: "เธเธฑเธ”เธเธฃเธฐเธเธธเธกเธเธฃเธธเนเธเธเธตเนเธเนเธฒเธข 2"
Output: {"intent":"CREATE","create_data":{"title":"เธเธฑเธ”เธเธฃเธฐเธเธธเธก","description":"เธเธฑเธเธ—เธถเธเธเนเธฒเธ LINE Bot: เธเธฑเธ”เธเธฃเธฐเธเธธเธกเธเธฃเธธเนเธเธเธตเนเธเนเธฒเธข 2","reminder_date":"2026-09-15T14:00:00+07:00"}}

User: "เน€เธเธดเธเนเธญเธฅเธเธญเธฎเธญเธฅเน 2 เธเธงเธ”"
Output: {"intent":"STOCK","stock_data":{"action":"SUBTRACT","name":"เนเธญเธฅเธเธญเธฎเธญเธฅเน","quantity":2,"unit":"เธเธงเธ”","confidence":95}}

User: "เธเนเธเธซเธฒเธเธฃเธฐเธ”เธฒเธฉ"
Output: {"intent":"SEARCH","search_query":"เธเธฃเธฐเธ”เธฒเธฉ"}

User: "เน€เธชเธฃเนเธเนเธฅเนเธง b78"
Output: {"intent":"COMPLETE","item_id":"<full_uuid_of_b78>"}

User: "เธชเธงเธฑเธชเธ”เธตเธเนเธฒ"
Output: {"intent":"UNKNOWN","message":"เธชเธงเธฑเธชเธ”เธตเธเธฃเธฑเธ เธขเธดเธเธ”เธตเธ•เนเธญเธเธฃเธฑเธเธชเธนเนเธเธณเธเธ”! เธกเธตเธญเธฐเนเธฃเนเธซเนเธเธกเธเนเธงเธขเธเธฑเธเธ—เธถเธเธซเธฃเธทเธญเธเนเธงเธขเธเธณเธงเธฑเธเธเธตเนเนเธซเธกเธเธฃเธฑเธ ๐"}

User: "เน€เธเธดเนเธกเธเธญเธ"
Output: {"intent":"UNKNOWN","message":"เธ•เนเธญเธเธเธฒเธฃเน€เธเธดเนเธกเธงเธฑเธชเธ”เธธเธญเธฐเนเธฃ เธเธณเธเธงเธเน€เธ—เนเธฒเนเธซเธฃเนเธเธฃเธฑเธ? เธเธดเธกเธเนเธเธญเธเนเธ”เนเน€เธฅเธข เน€เธเนเธ 'เน€เธเธดเนเธกเธเธฒเธเธเธฒ 10 เธ”เนเธฒเธก' ๐"}`
          }]
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      };

      const data = await fetchGeminiWithFallback(body, apiKey);
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const parsed = safeJsonParse(rawText) as GeminiParsedOutput;
      
      console.log(`[AI Single-Shot] Parsed intent: ${parsed.intent} for message: "${messageText}"`);

      // Clean up title in create_data if exists, just in case
      if (parsed.create_data?.title) {
        let t = parsed.create_data.title;
        t = t.replace(/^(?:เนเธซเนเนเธเนเธเน€เธ•เธทเธญเธ|เนเธกเนเนเธเนเธเน€เธ•เธทเธญเธ|เธเนเธงเธขเนเธเนเธเน€เธ•เธทเธญเธ|เนเธเนเธเน€เธ•เธทเธญเธ|เธเนเธงเธขเน€เธ•เธทเธญเธ|เน€เธ•เธทเธญเธ|เธเธฑเธเธ—เธถเธ|เธเธ”|เน€เธเธดเนเธก)\s*/i, '').trim();
        t = t.replace(/(?:เนเธเนเธเน€เธ•เธทเธญเธ)?เธงเธฑเธเธ—เธตเน\s*\d+[\/\.\-]\d+[\/\.\-]\d+(?:\s*(?:เธ•เธญเธ|เน€เธงเธฅเธฒ)?\s*\d+[\.\:]\d+\s*เธ\.?)?$/i, '').trim();
        t = t.replace(/(?:\s*(?:เธ•เธญเธ|เน€เธงเธฅเธฒ)?\s*\d+[\.\:]\d+\s*เธ\.?)$/i, '').trim();
        t = t.replace(/^[:\-ใผ\s\.]+/, '').trim();
        t = t.replace(/[:\-ใผ\s\.]+$/, '').trim();
        parsed.create_data.title = t;
      }

      // Ensure item_id is not missing for actions that require it (but might not have found it in context)
      if ((parsed.intent === 'DELETE' || parsed.intent === 'COMPLETE') && !parsed.item_id) {
         // try local regex fallback finding if AI missed it
         const query = messageText.replace(/^(เธฅเธ|delete|เธขเธเน€เธฅเธดเธ|เน€เธชเธฃเนเธเนเธฅเนเธง|เธชเธณเน€เธฃเนเธ|complete|เน€เธชเธฃเนเธ|เธญเธญเธเธฃเธซเธฑเธช|เธญเธญเธเนเธญเน€เธ—เธก)\s*/i, '').trim();
         const matched = findClosestItem(query, existingItems);
         if (matched) parsed.item_id = matched.id;
      }
      
      if (parsed.intent === 'SEARCH' && !parsed.item_id) {
         const query = messageText.replace(/^(เธเนเธเธซเธฒ|เธซเธฒ|search|find|เธ”เธน)\s*/i, '').trim();
         const matched = findClosestItem(query, existingItems);
         if (matched) parsed.item_id = matched.id;
      }

      return parsed;
    } catch (err) {
      console.error('[AI Single-Shot] Error, falling back to local parser:', err);
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
    
    // Check for HH:mm or HH.mm time after "เน€เธงเธฅเธฒ" or "at"
    const timeMatch = text.match(/(?:เน€เธงเธฅเธฒ|at)\s*(\d{1,2})[:.](\d{2})/i);
    if (timeMatch) {
      hours = parseInt(timeMatch[1]);
      minutes = parseInt(timeMatch[2]);
    } else {
      // Check for simple Thai "เนเธกเธ" or "เนเธกเธเน€เธเนเธฒ" / "เธเนเธฒเธข..." time representation
      const mongMatch = text.match(/(\d{1,2})\s*เนเธกเธ/i);
      if (mongMatch) {
        let h = parseInt(mongMatch[1]);
        if (text.includes('เธเนเธฒเธข') && h < 12) {
          h += 12;
        } else if (text.includes('เน€เธขเนเธ') && h < 12) {
          h += 12;
        } else if (text.includes('เธเนเธณ') && h < 12) {
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
  const isStockAction = /(?:เธชเธ•เนเธญเธ|เธชเธ•เนเธญเธ|เธเธฅเธฑเธ|เธเธณเธเธงเธ|เธเธดเนเธ|เธเธฅเนเธญเธ|เธเธงเธ”|เธซเธฅเธญเธ”|เนเธเธฅเธฅเธญเธ|เธฃเธตเธก|เน€เธเธดเธ|เธซเธฑเธเธขเธญเธ”|เธ•เธฑเธ”เธขเธญเธ”|เนเธญเธ”เธงเธฑเธชเธ”เธธ|เน€เธเธดเนเธกเธชเธ•เนเธญเธ|เนเธฅเนเธ|lab|เธงเธฑเธชเธ”เธธ|เธซเธกเธงเธ”เธซเธกเธนเน|เธซเธกเธงเธ”)/i.test(text);
  if (isStockAction) {
    let action: 'ADD' | 'SUBTRACT' | 'SET' | 'DELETE' | 'CHECK' | 'EDIT_CATEGORY' = 'CHECK';
    if (text.startsWith('เน€เธเธดเธ') || text.startsWith('เธซเธฑเธ') || text.startsWith('เธฅเธ”') || text.includes('เธ•เธฑเธ”เธขเธญเธ”') || text.includes('เน€เธเธดเธเธญเธญเธ') || text.includes('เน€เธญเธฒเนเธเนเธเน') || text.includes('เธซเธฑเธเธฅเธ') || text.startsWith('เธฅเธ')) {
      action = 'SUBTRACT';
    } else if (text.startsWith('เน€เธเธดเนเธก') || text.startsWith('เนเธญเธ”') || text.includes('เน€เธ•เธดเธก') || text.includes('เน€เธเธดเนเธกเธชเธ•เนเธญเธ') || text.includes('เธเธงเธเน€เธเธดเนเธก')) {
      action = 'ADD';
    } else if (text.startsWith('เธ•เธฑเนเธ') || text.includes('เธเธฃเธฑเธเธขเธญเธ”') || text.startsWith('เนเธชเนเธขเธญเธ”') || text.includes('เน€เธ—เนเธฒเธเธฑเธ')) {
      action = 'SET';
    } else if (text.includes('เธขเนเธฒเธขเธซเธกเธงเธ”') || text.includes('เน€เธเธฅเธตเนเธขเธเธซเธกเธงเธ”') || text.includes('เธขเนเธฒเธขเนเธ') || text.includes('เธซเธกเธงเธ”เธซเธกเธนเน') || text.includes('เธซเธกเธงเธ”')) {
      action = 'EDIT_CATEGORY';
    }

    // Extract quantity
    const qtyMatch = text.match(/\b(\d+)\b/);
    const quantity = qtyMatch ? parseInt(qtyMatch[1]) : null;

    // Common units
    const unitMatch = text.match(/(เธเธดเนเธ|เธเธฅเนเธญเธ|เธเธงเธ”|เธซเธฅเธญเธ”|เนเธเธฅเธฅเธญเธ|เธฃเธตเธก|เธญเธฑเธ|เธกเนเธงเธ|เธ–เธธเธ|เนเธ|เนเธ—เนเธ|เนเธเนเธ|เนเธเธ|เนเธเนเธ|เน€เธเธฃเธทเนเธญเธ|เธ•เธฑเธง|เธเธนเน|เธเธธเธ”|เธเธดเนเธฅ|เธฅเธดเธ•เธฃ|เธกเธดเธฅเธฅเธดเธฅเธดเธ•เธฃ)/);
    const unit = unitMatch ? unitMatch[1] : 'เธเธดเนเธ';

    // Extract priority in fallback
    let priority: 'High' | 'Medium' | 'Low' = 'Medium';
    if (text.includes('เธ”เนเธงเธ') || text.includes('เธชเธณเธเธฑเธเธกเธฒเธ')) {
      priority = 'High';
    } else if (text.includes('เธ—เธฑเนเธงเนเธ') || text.includes('เนเธกเนเธ”เนเธงเธ')) {
      priority = 'Low';
    }

    // Extract min threshold in fallback
    const thresholdMatch = text.match(/(?:เน€เธ•เธทเธญเธเน€เธกเธทเนเธญเน€เธซเธฅเธทเธญ|เน€เธเธ“เธ‘เน|เธเธฑเนเธเธ•เนเธณ)\s*(\d+)/i);
    const min_threshold = thresholdMatch ? parseInt(thresholdMatch[1]) : 0;

    // Extract name by removing action, quantity, units
    let name = messageText
      .replace(/^(?:เน€เธเธดเธ|เธซเธฑเธ|เธฅเธ”|เธ•เธฑเธ”เธขเธญเธ”|เน€เธเธดเธเธญเธญเธ|เน€เธเธดเนเธก|เนเธญเธ”|เน€เธ•เธดเธก|เธฅเธ|เธ•เธฑเนเธ|เน€เธเนเธ|เธ”เธน|เธชเธ•เนเธญเธ|เธชเธ•เนเธญเธ|เน€เธเนเธ|เธเธฃเธฑเธเธขเธญเธ”|เธเธฃเธฑเธเธขเธญเธ”เนเธซเธกเน|เธเธฃเธฑเธ|เธขเนเธฒเธข|เน€เธเธฅเธตเนเธขเธเธซเธกเธงเธ”เธซเธกเธนเน|เน€เธเธฅเธตเนเธขเธเธซเธกเธงเธ”|เธขเนเธฒเธขเธซเธกเธงเธ”เธซเธกเธนเน|เธขเนเธฒเธขเธซเธกเธงเธ”)\s*/i, '')
      .replace(/\b\d+\b/g, '')
      .replace(/(?:เธเธณเธเธงเธ|เน€เธ—เนเธฒเธเธฑเธ|เน€เธเนเธ|เธขเธญเธ”|เธเธดเนเธ|เธเธฅเนเธญเธ|เธเธงเธ”|เธซเธฅเธญเธ”|เนเธเธฅเธฅเธญเธ|เธฃเธตเธก|เธญเธฑเธ|เธกเนเธงเธ|เธ–เธธเธ|เนเธ|เนเธ—เนเธ|เนเธเนเธ|เนเธเธ|เนเธเนเธ|เน€เธเธฃเธทเนเธญเธ|เธ•เธฑเธง|เธเธนเน|เธเธธเธ”|เธเธดเนเธฅ|เธฅเธดเธ•เธฃ|เธกเธดเธฅเธฅเธดเธฅเธดเธ•เธฃ|เธงเธฑเธ|เน€เธเธฃเธ”เธดเธ•|เธ”เนเธงเธ|เธ—เธฑเนเธงเนเธ|เนเธกเนเธ”เนเธงเธ|เธชเธณเธเธฑเธเธกเธฒเธ|เนเธเธซเธกเธงเธ”เธซเธกเธนเน|เนเธเธซเธกเธงเธ”|เธซเธกเธงเธ”เธซเธกเธนเน|เธซเธกเธงเธ”|laboratory|office|lab|เนเธฅเนเธ)/gi, '')
      .replace(/(?:เธเธฃเธฑเธ|เธเนเธฐ|เธเนเธฒ|เธเธฐ|เธเธฐเธเธฃเธฑเธ|เธเธฐเธเธฐ|เธ”เนเธงเธข|เธ”เนเธงเธขเธเธฃเธฑเธ|เธ”เนเธงเธขเธเนเธฐ|เธซเธเนเธญเธข|เธซเธเนเธญเธขเธเธฃเธฑเธ|เธซเธเนเธญเธขเธเนเธฐ)\s*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    name = name.replace(/^[:\-ใผ\s\.]+/, '').trim();

    return {
      intent: 'STOCK',
      stock_data: {
        action,
        name: name || null,
        quantity,
        unit,
        category: text.includes('lab') || text.includes('เนเธฅเนเธ') || text.includes('เธชเธฒเธฃเน€เธเธกเธต') ? 'Laboratory' : 'เธญเธธเธเธเธฃเธ“เนเธชเธณเธเธฑเธเธเธฒเธ',
        priority,
        min_threshold
      }
    };
  }

  // 1. SEARCH intent
  if (text.startsWith('เธเนเธเธซเธฒ') || text.startsWith('เธซเธฒ') || text.startsWith('search') || text.startsWith('find') || text.startsWith('เธ”เธน')) {
    const query = messageText.replace(/^(เธเนเธเธซเธฒ|เธซเธฒ|search|find|เธ”เธน)\s*/i, '').trim();
    const matched = findClosestItem(query, existingItems);
    return { 
      intent: 'SEARCH', 
      search_query: matched ? matched.title : query,
      item_id: matched ? matched.id : undefined
    };
  }

  // 2. DELETE intent
  if (text.startsWith('เธฅเธ') || text.startsWith('delete') || text.startsWith('เธขเธเน€เธฅเธดเธ')) {
    const query = messageText.replace(/^(เธฅเธ|delete|เธขเธเน€เธฅเธดเธ)\s*/i, '').trim();
    const matched = findClosestItem(query, existingItems);
    return { intent: 'DELETE', item_id: matched?.id || undefined };
  }

  // 3. COMPLETE intent
  if (text.startsWith('เน€เธชเธฃเนเธเนเธฅเนเธง') || text.startsWith('เธชเธณเน€เธฃเนเธ') || text.startsWith('complete') || text.includes('เน€เธชเธฃเนเธ') || text.includes('เธชเธณเน€เธฃเนเธ')) {
    const query = messageText.replace(/^(เน€เธชเธฃเนเธเนเธฅเนเธง|เธชเธณเน€เธฃเนเธ|complete|เน€เธชเธฃเนเธ)\s*/i, '').trim();
    const matched = findClosestItem(query, existingItems);
    return { intent: 'COMPLETE', item_id: matched?.id || undefined };
  }

  // 4. UPDATE intent
  if (text.startsWith('เนเธเนเนเธ') || text.startsWith('เนเธเน') || text.startsWith('edit') || text.startsWith('update')) {
    const query = messageText.replace(/^(เนเธเนเนเธ|เนเธเน|edit|update)\s*/i, '').trim();
    const matched = findClosestItem(query, existingItems);

    return {
      intent: 'UPDATE',
      item_id: matched?.id || undefined,
      update_data: {}
    };
  }

  // 5. CREATE intent (default fallback)
  const reminder_date = extractReminderDate(messageText);

  let title = messageText.replace(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g, '').trim();
  title = title.replace(/(?:เนเธเนเธเน€เธ•เธทเธญเธ|เน€เธ•เธทเธญเธ|เธงเธฑเธเธเธฑเธเธ—เธฃเนเธ—เธตเน|เธงเธฑเธเธญเธฑเธเธเธฒเธฃเธ—เธตเน|เธงเธฑเธเธเธธเธเธ—เธตเน|เธงเธฑเธเธเธคเธซเธฑเธชเธเธ”เธตเธ—เธตเน|เธงเธฑเธเธจเธธเธเธฃเนเธ—เธตเน|เธงเธฑเธเน€เธชเธฒเธฃเนเธ—เธตเน|เธงเธฑเธเธญเธฒเธ—เธดเธ•เธขเนเธ—เธตเน|เธงเธฑเธเธ—เธตเน|เธงเธฑเธ)\s*$/i, '').trim();
  title = title.replace(/^(เน€เธเธดเนเธก)\s*/i, '').trim();
  
  // Clean up prefix reminder/action keywords from the beginning of the title (e.g. "เนเธกเนเนเธเนเธเน€เธ•เธทเธญเธ", "เนเธซเนเนเธเนเธเน€เธ•เธทเธญเธ", "เนเธเนเธเน€เธ•เธทเธญเธ")
  title = title.replace(/^(?:เนเธซเนเนเธเนเธเน€เธ•เธทเธญเธ|เนเธกเนเนเธเนเธเน€เธ•เธทเธญเธ|เธเนเธงเธขเนเธเนเธเน€เธ•เธทเธญเธ|เนเธเนเธเน€เธ•เธทเธญเธ|เธเนเธงเธขเน€เธ•เธทเธญเธ|เน€เธ•เธทเธญเธ|เธเธฑเธเธ—เธถเธ|เธเธ”|เน€เธเธดเนเธก)\s*/i, '').trim();
  // Strip any leading colons, dashes or spaces left over from the keyword removal (e.g. "เนเธเนเธเน€เธ•เธทเธญเธ: ..." -> "...")
  title = title.replace(/^[:\-ใผ\s\.]+/, '').trim();

  return {
    intent: 'CREATE',
    create_data: {
      title: title || messageText,
      description: `เธเธฑเธเธ—เธถเธเธเนเธฒเธ LINE Bot: ${messageText}`,
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
  currentItem: { title: string; description: string | null; reminder_date: string | null },
  apiKey: string
): Promise<{
  title?: string;
  description?: string;
  status?: 'Pending' | 'Issuing Item';
  reminder_date?: string | null;
}> {
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
        text: `You are an edit parser for JodJum (เธเธณเธเธ”).
Today's local date and time in Thailand (ICT, UTC+7) is ${localDateTimeStr}.

The user is editing a specific item. Here is the current state of the item:
- Title: "${currentItem.title}"
- Description: "${currentItem.description || 'None'}"
- Scheduled Reminder: ${currentReminderStr}

The user has sent this edit request: "${messageText}"

Analyze the request to see what fields they want to change.
Rules:
1. If the user wants to change/set/update the reminder time (e.g., "เนเธเนเธเน€เธ•เธทเธญเธเธ•เธญเธ 12:00", "เนเธเนเน€เธงเธฅเธฒเน€เธเนเธเธเธฃเธธเนเธเธเธตเน 9 เนเธกเธเน€เธเนเธฒ", "เน€เธ•เธทเธญเธเธเธฃเธธเนเธเธเธตเนเธเนเธฒเธขเนเธกเธ", "เนเธเนเน€เธงเธฅเธฒเนเธเนเธเน€เธ•เธทเธญเธเนเธซเธกเน", "เนเธเนเน€เธงเธฅเธฒเน€เธเนเธ 15/07/26 เน€เธงเธฅเธฒ 10:00", "เนเธเนเธเน€เธ•เธทเธญเธเน€เธงเธฅเธฒเธ•เธญเธ 12:00 เธ."), extract/calculate the new "reminder_date" as an ISO String in Thailand timezone (+07:00).
   - If they specify only a time (e.g. "เธ•เธญเธ 12:00 เธ.", "เนเธเนเน€เธงเธฅเธฒเน€เธเนเธ 10:00"), keep the date of today (or tomorrow if the time has already passed today, but default to today first) or keep the current reminder's date if appropriate.
   - If they specify a time edit but it has no date/time information at all (e.g. just "เนเธเนเน€เธงเธฅเธฒเนเธเนเธเน€เธ•เธทเธญเธเนเธซเธกเน" without any time), do not change the reminder_date or the title. Leave both unchanged.
   - If they say "เธขเธเน€เธฅเธดเธเนเธเนเธเน€เธ•เธทเธญเธ" / "เนเธกเนเน€เธ•เธทเธญเธเนเธฅเนเธง" / "เธฅเธเธงเธฑเธเนเธเนเธเน€เธ•เธทเธญเธ" / "เนเธกเนเนเธเนเธเน€เธ•เธทเธญเธเนเธฅเนเธง", set "reminder_date" to null.
2. If the user wants to change the title (e.g. "เนเธเนเธเธทเนเธญเน€เธเนเธ เธเธญเธกเธเธดเธงเน€เธ•เธญเธฃเน i7", "เน€เธเธฅเธตเนเธขเธเธเธทเนเธญเธฃเธฒเธขเธเธฒเธฃเน€เธเนเธ เธเธทเนเธญเธญเธธเธเธเธฃเธ“เนเธชเธณเธเธฑเธเธเธฒเธ", "เนเธเนเธเธทเนเธญเน€เธเนเธ เธชเธกเธธเธ”เนเธเนเธ•", or they type a clear new name like "เธเธฃเธฐเธ”เธฒเธฉ A4 10 เธเธฅเนเธญเธ" without referencing dates/times or credit terms), set the "title" field.
   - CRITICAL: Never include keyword prefixes like 'เนเธเนเธเน€เธ•เธทเธญเธ', 'เนเธซเนเนเธเนเธเน€เธ•เธทเธญเธ', 'เนเธกเนเนเธเนเธเน€เธ•เธทเธญเธ', 'เน€เธ•เธทเธญเธ', 'เธเนเธงเธขเน€เธ•เธทเธญเธ', 'เธเนเธงเธขเนเธเนเธเน€เธ•เธทเธญเธ', 'เธเธฑเธเธ—เธถเธ', 'เธเธ”', 'เน€เธเธดเนเธก', 'เนเธเนเธเธทเนเธญเน€เธเนเธ', 'เน€เธเธฅเธตเนเธขเธเธเธทเนเธญเน€เธเนเธ' in the title. Remove them.
3. If they only requested to change the reminder date/time (e.g., "เนเธเนเธเน€เธ•เธทเธญเธเน€เธงเธฅเธฒเธ•เธญเธ 12:00 เธ.") and did NOT request a title change, do NOT return the "title" field in your JSON output (or set it to null), so that the existing title is preserved! E.g. for "เนเธเนเธเน€เธ•เธทเธญเธเน€เธงเธฅเธฒเธ•เธญเธ 12:00 เธ.", the user wants to update the reminder_date, NOT change the title to "เนเธเนเธเน€เธ•เธทเธญเธเน€เธงเธฅเธฒเธ•เธญเธ 12:00 เธ.".
4. If the request is a mix of changes (e.g., "เนเธเนเธเธทเนเธญเน€เธเนเธ เธเธญเธกเธเธดเธงเน€เธ•เธญเธฃเน เนเธฅเธฐเน€เธ•เธทเธญเธเธเธฃเธธเนเธเธเธตเน 9 เนเธกเธ"), return both "title" and "reminder_date" fields.

Format the output strictly as JSON with the following structure (include only fields that are being updated):
{
  "title": "New title if updated (or null/omit if title should not be changed)",
  "description": "New description if updated (or null/omit)",
  "reminder_date": "ISOString with +07:00 offset (if reminder date/time is updated/added), or null (if user requested to delete/clear the reminder), or omit if no changes to reminder"
}`
      }]
    }],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  const data = await fetchGeminiWithFallback(body, apiKey);
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const parsed = safeJsonParse(rawText);

  if (parsed.title) {
    parsed.title = parsed.title.replace(/^(?:เนเธซเนเนเธเนเธเน€เธ•เธทเธญเธ|เนเธกเนเนเธเนเธเน€เธ•เธทเธญเธ|เธเนเธงเธขเนเธเนเธเน€เธ•เธทเธญเธ|เนเธเนเธเน€เธ•เธทเธญเธ|เธเนเธงเธขเน€เธ•เธทเธญเธ|เน€เธ•เธทเธญเธ|เธเธฑเธเธ—เธถเธ|เธเธ”|เน€เธเธดเนเธก|เนเธเนเธเธทเนเธญเน€เธเนเธ|เน€เธเธฅเธตเนเธขเธเธเธทเนเธญเน€เธเนเธ|เนเธเนเธเธทเนเธญ|เน€เธเธฅเธตเนเธขเธเธเธทเนเธญ|เนเธเน|เน€เธเธฅเธตเนเธขเธ)\s*/i, '').trim();
    parsed.title = parsed.title.replace(/^[:\-ใผ\s\.]+/, '').trim();
  }

  return parsed;
}

/**
 * Analyzes an image with Gemini Multimodal API.
 */
export async function analyzeImageWithAI(
  imageBase64: string,
  mimeType: string,
  activeMode: 'stock' | 'reminder' | 'pr' | 'calibration' | null,
  apiKey: string
): Promise<any> {
  const nowUtc = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const localDate = new Date(nowUtc.getTime() + 7 * 60 * 60 * 1000);
  const localDateTimeStr = `${localDate.getUTCFullYear()}-${pad(localDate.getUTCMonth() + 1)}-${pad(localDate.getUTCDate())}T${pad(localDate.getUTCHours())}:${pad(localDate.getUTCMinutes())}:${pad(localDate.getUTCSeconds())}+07:00`;

  let prompt = '';
  if (activeMode === 'stock') {
    prompt = `You are a stock receipt and item parser for JodJum (เธเธณเธเธ”).
Today's local date and time in Thailand (ICT, UTC+7) is ${localDateTimeStr}.

Analyze this image of a receipt, item package, or stock listing. Extract any stock materials/items.
For each item, extract:
- name: Clean, short name of the material (in Thai if Thai, e.g. 'เธเธฃเธฐเธ”เธฒเธฉ A4')
- quantity: Numeric quantity (integer or float)
- unit: Unit (in Thai if Thai, e.g. 'เธเธดเนเธ', 'เธเธฅเนเธญเธ', 'เธเธงเธ”', 'เธญเธฑเธ', 'เนเธเนเธ')

Format the response strictly as JSON with the following structure:
{
  "type": "STOCK",
  "items": [
    {
      "name": "Clean name of item",
      "quantity": 10,
      "unit": "เธเธดเนเธ"
    }
  ]
}`;
  } else {
    prompt = `You are a reminder and task parser for JodJum (เธเธณเธเธ”).
Today's local date and time in Thailand (ICT, UTC+7) is ${localDateTimeStr}.

Analyze this image of a receipt, document, or handwritten note. Extract the main task/reminder details.
Suggest a reminder title and when to remind if specified.

Format the response strictly as JSON with the following structure:
{
  "type": "REMINDER",
  "title": "Clean, short, and descriptive title (in Thai, e.g. 'เธเนเธฒเธขเธเนเธฒเธเนเธณเธเธฃเธฐเธเธฒ', 'เน€เธเธฅเธตเธขเธฃเนเธเธเธเธฃเธฐเธกเธฒเธ“')",
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

  const data = await fetchGeminiWithFallback(body, apiKey);
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return safeJsonParse(rawText);
}



// ==========================================
// NEW CENTRAL AI ROUTER (DYNAMIC BOARDS)
// ==========================================

export interface CentralAIParsedOutput {
  is_conversation: boolean;
  reply_message?: string;
  command?: {
    board_id: string;
    action: 'ADD' | 'UPDATE' | 'DELETE' | 'SEARCH' | 'COMPLETE' | 'CHECK_STOCK' | 'SUBTRACT_STOCK' | 'ADD_STOCK' | 'LIST_ALL';
    target_item_name?: string;
    fields: {
      title?: string;
      description?: string;
      date?: string;
      quantity?: number;
      category?: string;
      priority?: 'High' | 'Medium' | 'Low';
    }
  }
}

export async function processMessageWithCentralAI(
  messageText: string,
  userBoards: any[],
  apiKey: string
): Promise<CentralAIParsedOutput> {
  const boardsContext = userBoards.map(b => 
    `- ID: ${b.id}, Name: '${b.name}', Type: ${b.type}`
  ).join('\n');

  const promptText = `You are a highly intelligent central router for JodJum, a dynamic tracker system.
The user sent a message: "${messageText}"

The user has the following boards available to store data:
${boardsContext}

INSTRUCTIONS:
1. Determine if the user is just chatting/greeting, or if they want to perform a database operation (add, check, update, delete).
2. If it is a conversation or unclear, set "is_conversation" to true, and provide a helpful, friendly, natural Thai response in "reply_message". (e.g., "รับทราบครับ มีอะไรให้ผมช่วยบันทึกหรือเช็คสต็อกบอกได้เลยนะครับ"). Do not ask them to select a mode, just ask what they want to record.
3. If it is a database command, set "is_conversation" to false.
4. Determine WHICH board the user wants to interact with based on the context of their message and the board names/types.
5. Determine the ACTION: 'ADD', 'UPDATE', 'DELETE', 'SEARCH', 'COMPLETE', 'CHECK_STOCK', 'SUBTRACT_STOCK', 'ADD_STOCK', 'LIST_ALL'.
6. Extract relevant fields into "fields". 
   - For DATE_TRACKER, try to extract a 'date' (YYYY-MM-DD).
   - For INVENTORY, extract 'quantity' (number).
   - For all, extract a clear 'title' (without action words like '@ฌ @@@', '@ฌ @@@@').
7. The "target_item_name" should contain the name of the item they are referring to for updates/deletes/stock checks.

Format output EXACTLY as this JSON structure:
{
  "is_conversation": boolean,
  "reply_message": "string or null",
  "command": {
    "board_id": "UUID",
    "action": "ADD|UPDATE|DELETE|SEARCH|COMPLETE|CHECK_STOCK|SUBTRACT_STOCK|ADD_STOCK|LIST_ALL",
    "target_item_name": "string or null",
    "fields": {
      "title": "string or null",
      "description": "string or null",
      "date": "YYYY-MM-DD or null",
      "quantity": number
    }
  }
}`;

  const body = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: { responseMimeType: "application/json" }
  };

  const data = await fetchGeminiWithFallback(body, apiKey);
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  return safeJsonParse(rawText);
}


