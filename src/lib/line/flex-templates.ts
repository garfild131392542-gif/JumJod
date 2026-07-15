export function createItemFlexBubble(item: any, appUrl: string, isAlert: boolean = false) {
  const shortId = item.id.substring(item.id.length - 3);
  const editUrl = `${appUrl}/dashboard?edit=${item.id}`;
  
  // Determine Status text and badge color
  let statusText = item.status === 'Pending' ? 'กำลังดำเนินการ' : 'สำเร็จ';
  let statusColor = item.status === 'Pending' ? '#f59e0b' : '#10b981';

  const bubble: any = {
    type: 'bubble',
    size: 'mega',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'text',
              text: '📌 บันทึกช่วยจำ',
              weight: 'bold',
              size: 'xs',
              color: '#64748b',
              flex: 1
            },
            {
              type: 'text',
              text: `#${shortId}`,
              weight: 'bold',
              size: 'xs',
              color: '#94a3b8',
              align: 'end',
              flex: 0
            }
          ]
        },
        {
          type: 'text',
          text: item.title,
          weight: 'bold',
          size: 'md',
          margin: 'md',
          wrap: true,
          color: '#1e293b'
        }
      ]
    }
  };

  // Add description if exists
  if (item.description) {
    bubble.body.contents.push({
      type: 'text',
      text: item.description,
      size: 'xs',
      color: '#64748b',
      margin: 'sm',
      wrap: true
    });
  }

  // Separator & Status Info
  bubble.body.contents.push(
    {
      type: 'separator',
      margin: 'md'
    },
    {
      type: 'box',
      layout: 'vertical',
      margin: 'md',
      spacing: 'sm',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'text',
              text: 'สถานะ:',
              size: 'xs',
              color: '#94a3b8',
              flex: 2
            },
            {
              type: 'text',
              text: statusText,
              size: 'xs',
              weight: 'bold',
              color: statusColor,
              flex: 8,
              wrap: true
            }
          ]
        }
      ]
    }
  );

  // Add reminder details if exists
  if (item.reminder_date) {
    const dateObj = new Date(item.reminder_date);
    const dateStr = dateObj.toLocaleDateString('en-GB', { timeZone: 'Asia/Bangkok' });
    const timeStr = dateObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
    bubble.body.contents[bubble.body.contents.length - 1].contents.push({
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: 'แจ้งเตือน:',
          size: 'xs',
          color: '#94a3b8',
          flex: 2
        },
        {
          type: 'text',
          text: `🔔 ${dateStr} (เวลา ${timeStr} น.)`,
          size: 'xs',
          color: '#8b5cf6',
          weight: 'bold',
          flex: 8
        }
      ]
    });
  }

  // Footer Action buttons
  bubble.footer = {
    type: 'box',
    layout: 'vertical',
    spacing: 'sm',
    contents: []
  };

  // Action buttons depending on state
  const actions = [];
  
  // 1. "แจ้งสำเร็จ" button - always available if not finished yet
  if (item.status !== 'Issuing Item') {
    actions.push({
      type: 'button',
      style: 'primary',
      height: 'sm',
      color: '#10b981',
      action: {
        type: 'postback',
        label: '✅ สำเร็จ',
        data: `action=complete&itemId=${item.id}`
      }
    });
  }

  // 3. Edit button in LINE
  actions.push({
    type: 'button',
    style: 'secondary',
    height: 'sm',
    action: {
      type: 'postback',
      label: '✍️ แก้ไขรายการ',
      data: `action=request_edit&itemId=${item.id}`
    }
  });

  // Snooze Actions if isAlert is true
  if (isAlert) {
    actions.push({
      type: 'box',
      layout: 'horizontal',
      spacing: 'xs',
      margin: 'md',
      contents: [
        {
          type: 'button',
          style: 'secondary',
          height: 'sm',
          action: {
            type: 'postback',
            label: '⏳ 15 น.',
            data: `action=snooze&itemId=${item.id}&minutes=15`
          }
        },
        {
          type: 'button',
          style: 'secondary',
          height: 'sm',
          action: {
            type: 'postback',
            label: '⏰ 1 ชม.',
            data: `action=snooze&itemId=${item.id}&minutes=60`
          }
        },
        {
          type: 'button',
          style: 'secondary',
          height: 'sm',
          action: {
            type: 'postback',
            label: '📅 พรุ่งนี้เช้า',
            data: `action=snooze&itemId=${item.id}&time=tomorrow_morning`
          }
        }
      ]
    });
  }

  bubble.footer.contents = actions;

  return bubble;
}

export function createStockFlexBubble(stock: any, op: string, qty: number | null) {
  const isAlert = stock.quantity <= (stock.min_threshold ?? 0);
  const displayName = stock.name;
  const priorityLabel = stock.priority === 'High' ? '🔴 ด่วนมาก' : stock.priority === 'Medium' ? '🟡 ปานกลาง' : '🟢 ทั่วไป';
  
  const bubble: any = {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      background: {
        type: 'linearGradient',
        angle: '135deg',
        startColor: '#6366f1',
        endColor: '#3b82f6'
      },
      paddingAll: '20px',
      contents: [
        {
          type: 'text',
          text: `📦 หมวดหมู่: ${stock.category || 'ทั่วไป'}`,
          weight: 'bold',
          size: 'xs',
          color: '#dbeafe'
        },
        {
          type: 'text',
          text: displayName,
          weight: 'bold',
          size: 'lg',
          color: '#ffffff',
          margin: 'sm',
          wrap: true
        }
      ]
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '20px',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'text',
              text: 'สถานะ:',
              size: 'xs',
              color: '#64748b',
              flex: 4
            },
            {
              type: 'text',
              text: isAlert ? '⚠️ ยอดต่ำกว่าเกณฑ์' : '🟢 ระดับปกติ',
              weight: 'bold',
              size: 'xs',
              color: isAlert ? '#ef4444' : '#10b981',
              flex: 8
            }
          ]
        },
        {
          type: 'separator',
          margin: 'md'
        },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'md',
          spacing: 'sm',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: 'คงเหลือปัจจุบัน:',
                  size: 'xs',
                  color: '#64748b',
                  flex: 4
                },
                {
                  type: 'text',
                  text: `${stock.quantity} ${stock.unit}`,
                  size: 'sm',
                  weight: 'bold',
                  color: isAlert ? '#ef4444' : '#0f172a',
                  flex: 8
                }
              ]
            },
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: 'เกณฑ์ขั้นต่ำ:',
                  size: 'xs',
                  color: '#64748b',
                  flex: 4
                },
                {
                  type: 'text',
                  text: `${stock.min_threshold ?? 0} ${stock.unit}`,
                  size: 'xs',
                  color: '#334155',
                  flex: 8
                }
              ]
            },
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: 'ความสำคัญ:',
                  size: 'xs',
                  color: '#64748b',
                  flex: 4
                },
                {
                  type: 'text',
                  text: priorityLabel,
                  size: 'xs',
                  color: '#334155',
                  flex: 8
                }
              ]
            },
            ...(stock.description ? [
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  {
                    type: 'text',
                    text: 'รายละเอียด:',
                    size: 'xs',
                    color: '#64748b',
                    flex: 4
                  },
                  {
                    type: 'text',
                    text: stock.description,
                    size: 'xs',
                    color: '#334155',
                    wrap: true,
                    flex: 8
                  }
                ]
              }
            ] : [])
          ]
        }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '15px',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: '#4f46e5',
          height: 'sm',
          action: {
            type: 'postback',
            label: '✅ เลือกวัสดุนี้',
            data: `action=stock_select_action&id=${stock.id}`
          }
        }
      ]
    }
  };

  return bubble;
}

export function createStockActionMenuFlex(stock: any) {
  const isAlert = stock.quantity <= (stock.min_threshold ?? 0);
  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      background: {
        type: 'linearGradient',
        angle: '135deg',
        startColor: '#7c3aed',
        endColor: '#ec4899'
      },
      paddingAll: '20px',
      contents: [
        {
          type: 'text',
          text: '⚡ INVENTORY OPERATIONS',
          weight: 'bold',
          size: 'xxs',
          color: '#fdf2f8'
        },
        {
          type: 'text',
          text: `📦 ${stock.name}`,
          weight: 'bold',
          color: '#ffffff',
          size: 'md',
          margin: 'xs',
          wrap: true
        },
        {
          type: 'text',
          text: `คงเหลือปัจจุบัน: ${stock.quantity} ${stock.unit}${isAlert ? ' ⚠️ (ต่ำกว่าเกณฑ์)' : ''}`,
          size: 'xs',
          color: '#fbcfe8',
          margin: 'xs'
        }
      ]
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      paddingAll: '20px',
      contents: [
        {
          type: 'text',
          text: 'กรุณาเลือกการดำเนินการที่ต้องการ:',
          size: 'xs',
          color: '#64748b',
          weight: 'bold'
        },
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'md',
          contents: [
            {
              type: 'button',
              style: 'primary',
              color: '#ef4444',
              height: 'sm',
              flex: 1,
              action: {
                type: 'postback',
                label: '🔻 เบิกออก',
                data: `action=stock_execute&id=${stock.id}&op=SUBTRACT&qty=`
              }
            },
            {
              type: 'button',
              style: 'primary',
              color: '#10b981',
              height: 'sm',
              flex: 1,
              action: {
                type: 'postback',
                label: '🔺 เติมสต็อก',
                data: `action=stock_execute&id=${stock.id}&op=ADD&qty=`
              }
            }
          ]
        },
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'md',
          contents: [
            {
              type: 'button',
              style: 'primary',
              color: '#6366f1',
              height: 'sm',
              flex: 1,
              action: {
                type: 'postback',
                label: '🔢 ปรับยอด',
                data: `action=stock_execute&id=${stock.id}&op=SET&qty=`
              }
            },
            {
              type: 'button',
              style: 'primary',
              color: '#0ea5e9',
              height: 'sm',
              flex: 1,
              action: {
                type: 'postback',
                label: '📊 เช็คยอด',
                data: `action=stock_execute&id=${stock.id}&op=CHECK&qty=`
              }
            }
          ]
        },
        {
          type: 'button',
          style: 'primary',
          color: '#f59e0b',
          height: 'sm',
          action: {
            type: 'postback',
            label: '✏️ แก้ไขรายละเอียดวัสดุ',
            data: `action=stock_edit_menu&id=${stock.id}`
          }
        },
        {
          type: 'button',
          style: 'secondary',
          color: '#dc2626',
          height: 'sm',
          action: {
            type: 'postback',
            label: '🗑️ ลบจากคลังคุมสินค้า',
            data: `action=stock_delete_confirm&id=${stock.id}`
          }
        }
      ]
    }
  };
}

export function createStockEditMenuFlex(stock: any) {
  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      background: {
        type: 'linearGradient',
        angle: '135deg',
        startColor: '#334155',
        endColor: '#475569'
      },
      paddingAll: '20px',
      contents: [
        {
          type: 'text',
          text: '✏️ EDIT STOCK DETAIL',
          weight: 'bold',
          size: 'xxs',
          color: '#cbd5e1'
        },
        {
          type: 'text',
          text: stock.name,
          weight: 'bold',
          color: '#ffffff',
          size: 'md',
          margin: 'xs',
          wrap: true
        }
      ]
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      paddingAll: '20px',
      contents: [
        {
          type: 'text',
          text: 'เลือกรายการที่คุณต้องการจะแก้ไข:',
          size: 'xs',
          color: '#64748b',
          weight: 'bold'
        },
        {
          type: 'button',
          style: 'primary',
          color: '#3b82f6',
          height: 'sm',
          action: {
            type: 'postback',
            label: '🏷️ แก้ไขชื่อวัสดุ',
            data: `action=stock_request_edit&id=${stock.id}&field=name`
          }
        },
        {
          type: 'button',
          style: 'primary',
          color: '#10b981',
          height: 'sm',
          action: {
            type: 'postback',
            label: '📝 แก้ไขรายละเอียดวัสดุ',
            data: `action=stock_request_edit&id=${stock.id}&field=desc`
          }
        },
        {
          type: 'button',
          style: 'primary',
          color: '#f59e0b',
          height: 'sm',
          action: {
            type: 'postback',
            label: '🔔 แก้ไขเกณฑ์ขั้นต่ำ',
            data: `action=stock_request_edit&id=${stock.id}&field=min`
          }
        },
        {
          type: 'button',
          style: 'primary',
          color: '#8b5cf6',
          height: 'sm',
          action: {
            type: 'postback',
            label: '⚡ แก้ไขระดับความสำคัญ',
            data: `action=stock_request_edit&id=${stock.id}&field=priority`
          }
        }
      ]
    }
  };
}

export function createStockDashboardFlex(stocks: any[]) {
  const total = stocks.length;
  const alertItems = stocks.filter(s => s.quantity <= (s.min_threshold ?? 0) && s.quantity > 0);
  const emptyItems = stocks.filter(s => s.quantity === 0);
  const normalItems = stocks.filter(s => s.quantity > (s.min_threshold ?? 0));
  const labItems = stocks.filter(s => s.category === 'Laboratory');
  const officeItems = stocks.filter(s => s.category === 'อุปกรณ์สำนักงาน');
  const sortedByQty = [...stocks].sort((a, b) => a.quantity - b.quantity).slice(0, 3);

  const alertRows = alertItems.slice(0, 5).map(s => ({
    type: 'box',
    layout: 'horizontal',
    contents: [
      { type: 'text', text: `⚠️ ${s.name}`, size: 'xs', color: '#ef4444', flex: 7, wrap: true },
      { type: 'text', text: `${s.quantity} ${s.unit}`, size: 'xs', color: '#ef4444', align: 'end', flex: 3 }
    ]
  }));

  const emptyRows = emptyItems.slice(0, 3).map(s => ({
    type: 'box',
    layout: 'horizontal',
    contents: [
      { type: 'text', text: `❌ ${s.name}`, size: 'xs', color: '#94a3b8', flex: 7, wrap: true },
      { type: 'text', text: 'หมดแล้ว', size: 'xs', color: '#94a3b8', align: 'end', flex: 3 }
    ]
  }));

  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#1e293b',
      contents: [
        {
          type: 'text',
          text: '📊 Dashboard สรุปสต็อกวัสดุ',
          weight: 'bold',
          color: '#ffffff',
          size: 'md'
        },
        {
          type: 'text',
          text: `อัปเดตล่าสุด: ${new Date().toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Bangkok' })}`,
          size: 'xs',
          color: '#94a3b8',
          margin: 'xs'
        }
      ]
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        // Summary cards row
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'sm',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              backgroundColor: '#f8fafc',
              cornerRadius: '8px',
              paddingAll: 'sm',
              flex: 1,
              contents: [
                { type: 'text', text: `${total}`, weight: 'bold', size: 'xl', color: '#1e293b', align: 'center' },
                { type: 'text', text: 'ทั้งหมด', size: 'xxs', color: '#64748b', align: 'center' }
              ]
            },
            {
              type: 'box',
              layout: 'vertical',
              backgroundColor: '#dcfce7',
              cornerRadius: '8px',
              paddingAll: 'sm',
              flex: 1,
              contents: [
                { type: 'text', text: `${normalItems.length}`, weight: 'bold', size: 'xl', color: '#10b981', align: 'center' },
                { type: 'text', text: 'ปกติ', size: 'xxs', color: '#10b981', align: 'center' }
              ]
            },
            {
              type: 'box',
              layout: 'vertical',
              backgroundColor: '#fef9c3',
              cornerRadius: '8px',
              paddingAll: 'sm',
              flex: 1,
              contents: [
                { type: 'text', text: `${alertItems.length}`, weight: 'bold', size: 'xl', color: '#d97706', align: 'center' },
                { type: 'text', text: 'ใกล้หมด', size: 'xxs', color: '#d97706', align: 'center' }
              ]
            },
            {
              type: 'box',
              layout: 'vertical',
              backgroundColor: '#fee2e2',
              cornerRadius: '8px',
              paddingAll: 'sm',
              flex: 1,
              contents: [
                { type: 'text', text: `${emptyItems.length}`, weight: 'bold', size: 'xl', color: '#ef4444', align: 'center' },
                { type: 'text', text: 'หมดแล้ว', size: 'xxs', color: '#ef4444', align: 'center' }
              ]
            }
          ]
        },
        // Category breakdown
        {
          type: 'separator'
        },
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: '🔬 Laboratory:', size: 'xs', color: '#64748b', flex: 5 },
            { type: 'text', text: `${labItems.length} รายการ`, size: 'xs', color: '#334155', weight: 'bold', flex: 5 }
          ]
        },
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: '💼 สำนักงาน:', size: 'xs', color: '#64748b', flex: 5 },
            { type: 'text', text: `${officeItems.length} รายการ`, size: 'xs', color: '#334155', weight: 'bold', flex: 5 }
          ]
        },
        // Alert items
        ...(alertRows.length > 0 ? [
          { type: 'separator' },
          { type: 'text', text: '⚠️ วัสดุที่ต้องเติมด่วน:', size: 'xs', weight: 'bold', color: '#ef4444' },
          ...alertRows
        ] : []),
        // Empty items
        ...(emptyRows.length > 0 ? [
          { type: 'separator' },
          { type: 'text', text: '❌ วัสดุที่หมดแล้ว:', size: 'xs', weight: 'bold', color: '#94a3b8' },
          ...emptyRows
        ] : []),
        // Top low stock
        ...(sortedByQty.length > 0 ? [
          { type: 'separator' },
          { type: 'text', text: '📉 ยอดต่ำสุด 3 อันดับ:', size: 'xs', weight: 'bold', color: '#64748b' },
          ...sortedByQty.map(s => ({
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: s.name, size: 'xs', color: '#334155', flex: 7, wrap: true },
              { type: 'text', text: `${s.quantity} ${s.unit}`, size: 'xs', color: '#8b5cf6', align: 'end', flex: 3 }
            ]
          }))
        ] : [])
      ]
    }
  };
}

export function createStockCreateFlexBubble(searchName: string, qty: number | null) {
  const createNewPostback = `action=stock_create_prompt&name=${searchName}&qty=${qty || ''}`;
  return {
    type: 'bubble',
    size: 'mega',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: '➕ เพิ่มวัสดุใหม่',
          weight: 'bold',
          size: 'md',
          color: '#8b5cf6'
        },
        {
          type: 'text',
          text: `ไม่พบวัสดุที่ตรงใจ หรือต้องการสร้างเพิ่มใหม่สำหรับ "${searchName}" หรือไม่?`,
          size: 'xs',
          color: '#64748b',
          margin: 'md',
          wrap: true
        }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: '#8b5cf6',
          height: 'sm',
          action: {
            type: 'postback',
            label: `สร้างวัสดุ "${searchName}"`,
            data: createNewPostback
          }
        }
      ]
    }
  };
}

export function createModeSelectionFlex() {
  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#f8fafc',
      contents: [
        {
          type: 'text',
          text: '🤖 ยินดีต้อนรับสู่ระบบ จำจด (JumJod)',
          weight: 'bold',
          size: 'md',
          color: '#1e293b'
        },
        {
          type: 'text',
          text: 'กรุณาเลือกโหมดการทำงานเพื่อเริ่มป้อนข้อมูล:',
          size: 'xs',
          color: '#64748b',
          margin: 'xs'
        }
      ]
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: '#8b5cf6',
          height: 'sm',
          action: {
            type: 'message',
            label: '📝 โหมดบันทึกช่วยจำ',
            text: 'บันทึกช่วยจำ'
          }
        },
        {
          type: 'button',
          style: 'primary',
          color: '#10b981',
          height: 'sm',
          action: {
            type: 'message',
            label: '📦 โหมดสต็อก',
            text: 'สต็อก'
          }
        }
      ]
    }
  };
}

export function createOcrStockConfirmationFlex(items: Array<{ name: string, quantity: number, unit: string }>) {
  const contents: any[] = [
    {
      type: 'text',
      text: '📸 ผลการสแกนรูปภาพวัสดุ',
      weight: 'bold',
      size: 'md',
      color: '#1e293b'
    },
    {
      type: 'text',
      text: 'กรุณาคลิกเลือกเพื่อแอดวัสดุที่ตรวจพบเข้าคลังสต็อก:',
      size: 'xs',
      color: '#64748b',
      margin: 'xs',
      wrap: true
    },
    {
      type: 'separator',
      margin: 'md'
    }
  ];

  items.forEach((item, index) => {
    contents.push({
      type: 'box',
      layout: 'vertical',
      margin: 'md',
      spacing: 'xs',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'text',
              text: `${index + 1}. ${item.name}`,
              weight: 'bold',
              size: 'sm',
              color: '#334155',
              flex: 7,
              wrap: true
            },
            {
              type: 'text',
              text: `${item.quantity} ${item.unit}`,
              size: 'sm',
              color: '#475569',
              flex: 3,
              align: 'end',
              weight: 'bold'
            }
          ]
        },
        {
          type: 'button',
          style: 'secondary',
          height: 'sm',
          color: '#10b981',
          margin: 'xs',
          action: {
            type: 'postback',
            label: '➕ แอดเข้าคลัง',
            data: `action=stock_create_prompt&name=${encodeURIComponent(item.name)}&qty=${item.quantity}`
          }
        }
      ]
    });
  });

  return {
    type: 'bubble',
    size: 'mega',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents
    }
  };
}

export function createOcrReminderConfirmationFlex(reminder: { title: string, description: string, reminder_date: string | null }) {
  const dateText = reminder.reminder_date ? (() => {
    const d = new Date(reminder.reminder_date);
    const dateStr = d.toLocaleDateString('en-GB', { timeZone: 'Asia/Bangkok' });
    const timeStr = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
    return `🔔 ${dateStr} (${timeStr} น.)`;
  })() : 'ไม่มี (จดอย่างเดียว)';

  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#f8fafc',
      contents: [
        {
          type: 'text',
          text: '📸 สแกนบันทึกช่วยจำจากภาพ',
          weight: 'bold',
          size: 'md',
          color: '#8b5cf6'
        }
      ]
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        {
          type: 'box',
          layout: 'vertical',
          spacing: 'xs',
          contents: [
            {
              type: 'text',
              text: 'หัวข้อบันทึก:',
              size: 'xs',
              color: '#94a3b8'
            },
            {
              type: 'text',
              text: reminder.title,
              weight: 'bold',
              size: 'sm',
              color: '#1e293b',
              wrap: true
            }
          ]
        },
        {
          type: 'box',
          layout: 'vertical',
          spacing: 'xs',
          contents: [
            {
              type: 'text',
              text: 'รายละเอียด:',
              size: 'xs',
              color: '#94a3b8'
            },
            {
              type: 'text',
              text: reminder.description || '-',
              size: 'sm',
              color: '#334155',
              wrap: true
            }
          ]
        },
        {
          type: 'box',
          layout: 'vertical',
          spacing: 'xs',
          contents: [
            {
              type: 'text',
              text: 'วันเวลาแจ้งเตือน:',
              size: 'xs',
              color: '#94a3b8'
            },
            {
              type: 'text',
              text: dateText,
              weight: 'bold',
              size: 'sm',
              color: '#ef4444'
            }
          ]
        }
      ]
    },
    footer: {
      type: 'box',
      layout: 'horizontal',
      spacing: 'sm',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: '#8b5cf6',
          height: 'sm',
          action: {
            type: 'postback',
            label: '✅ ตกลงบันทึก',
            data: 'action=confirm_ocr_reminder'
          }
        },
        {
          type: 'button',
          style: 'secondary',
          height: 'sm',
          action: {
            type: 'postback',
            label: '❌ ยกเลิก',
            data: 'action=cancel_ocr_reminder'
          }
        }
      ]
    }
  };
}

