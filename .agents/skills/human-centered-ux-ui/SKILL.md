---
name: human-centered-ux-ui
description: Design principles and guidelines for crafting modern, human-centered UX/UI for web dashboards and LINE Flex messages. Focuses on clean information density, professional aesthetics, and avoiding generic "AI-generated" design cliches.
---

# Human-Centered UX/UI Design System & Guidelines

คู่มือและมาตรฐานการออกแบบ UX/UI ระดับมืออาชีพ (Human-Crafted Look & Feel) สำหรับทั้ง Web Application (Next.js + Tailwind CSS) และ LINE Bot (Flex Messages) โดยหลีกเลี่ยงดีไซน์แบบ "AI-Generated Cliché"

---

## 1. สิ่งที่ต้องหลีกเลี่ยง (Anti-Patterns: อย่าให้ดูเหมือน AI ออกแบบ)

| จุดสังเกตของงานที่ดูเหมือน AI ทำ | แนวทางแก้ไขแบบ Human-Crafted (มืออาชีพ) |
| :--- | :--- |
| **ไล่เฉดสีม่วง/ชมพูจัดจ้าน (Purple/Pink Gradients) ทั่วไปหมด** | ใช้พื้นหลัง Neutral สะอาดตา (`bg-slate-50`, `bg-white`) และใช้สี Accent เฉพาะจุดที่มีฟังก์ชันชัดเจน |
| **ขอบโค้งมนเกินพอดี (Over-rounded pills) ในทุกองค์ประกอบ** | ใช้ `rounded-lg` (8px) หรือ `rounded-xl` (12px) สำหรับ Card และ `rounded-md` สำหรับปุ่ม เพื่อความคมชัดเป็นระเบียบ |
| **ใส่เงาฟุ้งและแสงเรือง (Heavy Glow & Shadows) ลอยๆ** | ใช้เงาบางเบาแบบ Subdued (`shadow-xs` หรือ `shadow-sm`) เน้นขอบเส้นขอบบาง (`border border-slate-200/80`) |
| **อัด Emoji ในทุกบรรทัดจนลายตา** | ใช้ไอคอน Stroke เรียบคม (Lucide Icons) ในหน้าเว็บ และใช้ Emoji เฉพาะหัวข้อหลักหรือ Badge สำคัญ 1 จุดต่อการ์ด |
| **เนื้อหาเว้นช่องว่างโหวงเหวง (Low Information Density)** | จัดวางข้อมูลแบบ Compact แต่อ่านง่าย (Structured Data Rows) ตอบโจทย์คนทำงานจริง |
| **ตัวหนังสือสีเทาจาง (`text-gray-400`) ทำให้อ่านยาก** | ใช้ Contrast สูง: ข้อความหลัก `text-slate-900`, ข้อความรอง `text-slate-600`, Label `text-slate-500` |

---

## 2. Color Palette เชิงหน้าที่ (Functional Palette)

อย่าสุ่มสีหรือใช้สีแฟนซี ให้ใช้สีตามสถานะจริงของงาน:
- **Canvas / Neutral**:
  - Background: `#f8fafc` (`slate-50`), Cards: `#ffffff`
  - Borders & Dividers: `#e2e8f0` (`slate-200`), `#cbd5e1` (`slate-300`)
  - Typography: Title `#0f172a` (`slate-900`), Body `#334155` (`slate-700`), Muted `#64748b` (`slate-500`)
- **Semantic Accents**:
  - **Primary Action (Brand)**: Indigo `#4f46e5` หรือ Deep Violet `#6366f1`
  - **Success / Completed / In Stock**: Emerald `#10b981` (Badge: `#ecfdf5` text `#047857`)
  - **Pending / In Progress**: Amber `#f59e0b` (Badge: `#fffbeb` text `#b45309`)
  - **Warning / Low Stock**: Orange `#f97316` (Badge: `#fff7ed` text `#c2410c`)
  - **Danger / Overdue**: Rose `#f43f5e` (Badge: `#fff1f2` text `#be123c`)

---

## 3. Typography & การแสดงผลภาษาไทย

- **Line Height**: ฟอนต์ภาษาไทย (เช่น Sarabun, Prompt, หรือ Geist ใน Next.js) สระบน-ล่างมักล้น ต้องใช้ `leading-relaxed` (1.625) เสมอ ไม่ใช้ `leading-none` ในภาษาไทย
- **ตัวเลขและวันที่**: ใส่คลาส `tabular-nums` เพื่อให้ตัวเลขในตารางและราคาเรียงตรงกันอย่างสวยงาม
- **ลำดับความสำคัญ (Hierarchy)**:
  - ขนาดหัวข้อ 16-18px Bold สำหรับ Card Title
  - ข้อมูลประกอบ 13-14px Regular
  - Meta info / Badge 11-12px Medium

---

## 4. มาตรฐานการออกแบบ LINE Flex Messages (Chat UX)

1. **ขนาดกะทัดรัด (Compact & Thumb-Friendly)**:
   - กว้างพอดีหน้าจอโทรศัพท์ ไม่ยืดยาวจนต้องเลื่อนจอหลายตลบ
   - แสดงข้อมูลสำคัญใน 3 วินาทีแรก: **ชื่อรายการ + กำหนดเวลา + สถานะปัจจุบัน**
2. **ปุ่มกดและ Quick Replies (Zero Typing)**:
   - ลดภาระการพิมพ์ของผู้ใช้ด้วย Quick Reply Buttons เสมอ เมื่อถามตัวเลือก (เช่น "วันนี้", "พรุ่งนี้", "10 โมง")
   - Action Button หลักใน Card ใช้ `style: "primary"` สีชัดเจน ส่วน Action รอง (เช่น แก้ไข/ลบ) ใช้ `style: "secondary"`
3. **โครงสร้าง Card ที่เป็นมืออาชีพ**:
   - Header: ชนิดของเอกสาร (เช่น `📌 บันทึกช่วยจำ`, `📦 สต็อกวัสดุ`) + รหัสย่อ `#12a`
   - Body: ชื่อรายการเด่นชัด + ข้อมูลแบบ Key-Value 2 คอลัมน์ (เช่น สถานะ, จำนวน, กำหนดส่ง)
   - Footer: ปุ่มดำเนินการทันที 1-2 ปุ่ม (เช่น `✅ ทำรายการเสร็จสิ้น`, `✍️ แก้ไข`)

---

## 5. Web UI Layout & Ergonomics (Mobile-First Dashboard)

- **Touch Target**: ปุ่มบนมือถือต้องมีขนาดไม่ต่ำกว่า `h-11` (44px)
- **Feedback ทันที**:
  - เมื่อกดทำรายการ ให้เปลี่ยนสถานะบนหน้าจอทันที (Optimistic Update) แล้ว sync เบื้องหลัง
  - มี Toast แจ้งเตือนสั้นๆ มุมจอแทนการเด้ง Dialog บังหน้าจอ
- **Empty States เชิงรุก**:
  - เมื่อไม่มีข้อมูล อย่าปล่อยให้เป็นหน้าจอว่างเปล่า
  - ให้แสดงไอคอนเรียบง่าย + ข้อความสั้น + ปุ่ม "➕ สร้างรายการแรก" ทันที
