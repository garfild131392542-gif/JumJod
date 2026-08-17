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
      backgroundColor: '#f8fafc',
      paddingAll: '18px',
      contents: [
        {
          type: 'text',
          text: `📦 หมวดหมู่: ${stock.category || 'ทั่วไป'}`,
          weight: 'bold',
          size: 'xxs',
          color: '#0284c7'
        },
        {
          type: 'text',
          text: displayName,
          weight: 'bold',
          size: 'md',
          color: '#0f172a',
          margin: 'xs',
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
      backgroundColor: '#f8fafc',
      paddingAll: '18px',
      contents: [
        {
          type: 'text',
          text: '📦 คลังวัสดุ (INVENTORY)',
          weight: 'bold',
          size: 'xxs',
          color: '#0284c7'
        },
        {
          type: 'text',
          text: stock.name,
          weight: 'bold',
          color: '#0f172a',
          size: 'md',
          margin: 'xs',
          wrap: true
        },
        {
          type: 'text',
          text: `คงเหลือปัจจุบัน: ${stock.quantity} ${stock.unit}${isAlert ? ' ⚠️ (ต่ำกว่าเกณฑ์)' : ''}`,
          size: 'xs',
          color: isAlert ? '#ef4444' : '#64748b',
          margin: 'xs'
        }
      ]
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingAll: '18px',
      contents: [
        {
          type: 'text',
          text: 'เลือกการดำเนินการ:',
          size: 'xs',
          color: '#64748b',
          weight: 'bold',
          margin: 'none'
        },
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'secondary',
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
              style: 'secondary',
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
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              flex: 1,
              action: {
                type: 'postback',
                label: '⚙️ ปรับยอด',
                data: `action=stock_execute&id=${stock.id}&op=SET&qty=`
              }
            },
            {
              type: 'button',
              style: 'secondary',
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
          type: 'box',
          layout: 'horizontal',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              flex: 1,
              action: {
                type: 'postback',
                label: '✏️ แก้ไขข้อมูล',
                data: `action=stock_edit_menu&id=${stock.id}`
              }
            },
            {
              type: 'button',
              style: 'secondary',
              color: '#dc2626',
              height: 'sm',
              flex: 1,
              action: {
                type: 'postback',
                label: '🗑️ ลบจากคลัง',
                data: `action=stock_delete_confirm&id=${stock.id}`
              }
            }
          ]
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
      backgroundColor: '#f8fafc',
      paddingAll: '18px',
      contents: [
        {
          type: 'text',
          text: '✏️ แก้ไขข้อมูลสต็อก',
          weight: 'bold',
          size: 'xxs',
          color: '#0284c7'
        },
        {
          type: 'text',
          text: stock.name,
          weight: 'bold',
          color: '#0f172a',
          size: 'md',
          margin: 'xs',
          wrap: true
        }
      ]
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingAll: '18px',
      contents: [
        {
          type: 'text',
          text: 'เลือกรายการที่ต้องการแก้ไข:',
          size: 'xs',
          color: '#64748b',
          weight: 'bold',
          margin: 'none'
        },
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              flex: 1,
              action: {
                type: 'postback',
                label: '🏷️ แก้ชื่อวัสดุ',
                data: `action=stock_request_edit&id=${stock.id}&field=name`
              }
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              flex: 1,
              action: {
                type: 'postback',
                label: '📝 แก้รายละเอียด',
                data: `action=stock_request_edit&id=${stock.id}&field=desc`
              }
            }
          ]
        },
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              flex: 1,
              action: {
                type: 'postback',
                label: '🔔 เกณฑ์ขั้นต่ำ',
                data: `action=stock_request_edit&id=${stock.id}&field=min`
              }
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              flex: 1,
              action: {
                type: 'postback',
                label: '⚡ ความสำคัญ',
                data: `action=stock_request_edit&id=${stock.id}&field=priority`
              }
            }
          ]
        }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          style: 'link',
          color: '#64748b',
          height: 'sm',
          action: {
            type: 'postback',
            label: '⬅️ ย้อนกลับ',
            data: `action=stock_manage&id=${stock.id}`
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
      paddingAll: '18px',
      contents: [
        {
          type: 'text',
          text: '🤖 ยินดีต้อนรับสู่ระบบ จำจด (JodJum)',
          weight: 'bold',
          size: 'md',
          color: '#0f172a'
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
      spacing: 'sm',
      paddingAll: '18px',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              flex: 1,
              action: {
                type: 'message',
                label: '📌 ช่วยจำ',
                text: 'ช่วยจำ'
              }
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              flex: 1,
              action: {
                type: 'message',
                label: '📦 สต็อกวัสดุ',
                text: 'สต็อก'
              }
            }
          ]
        },
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              flex: 1,
              action: {
                type: 'message',
                label: '📄 ติดตาม PR',
                text: 'ติดตาม PR'
              }
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              flex: 1,
              action: {
                type: 'message',
                label: '🔬 Calibrate',
                text: 'Calibrate'
              }
            }
          ]
        }
      ]
    }
  };
}

export function createCalibrationFlexBubble(item: any, appUrl: string) {
  const shortId = item.id.substring(item.id.length - 4);
  const editUrl = `${appUrl}/calibration`;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'ไม่ระบุ';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric' });
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextDate = new Date(item.next_cal_date);
  nextDate.setHours(0, 0, 0, 0);

  const diffTime = nextDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let statusText = '🟢 ปกติ';
  let statusColor = '#10b981';
  if (diffDays < 0) {
    statusText = `🔴 เกินกำหนด (${Math.abs(diffDays)} วัน)`;
    statusColor = '#ef4444';
  } else if (diffDays <= 14) {
    statusText = `🟡 ใกล้ถึงกำหนด (ใน ${diffDays} วัน)`;
    statusColor = '#f59e0b';
  }

  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#f8fafc',
      paddingAll: '15px',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'text',
              text: '🔬 Calibrate เครื่องมือวัด Lab',
              weight: 'bold',
              size: 'xs',
              color: '#64748b',
              flex: 1
            },
            {
              type: 'text',
              text: `#LAB-${shortId}`,
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
          text: `1. ${item.name}`,
          weight: 'bold',
          size: 'md',
          margin: 'sm',
          wrap: true,
          color: '#1e293b'
        }
      ]
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: 'สถานะ:', size: 'xs', color: '#94a3b8', flex: 4 },
            { type: 'text', text: statusText, size: 'xs', weight: 'bold', color: statusColor, flex: 6 }
          ]
        },
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: '2. ครั้งก่อนส่ง Cal:', size: 'xs', color: '#94a3b8', flex: 4 },
            { type: 'text', text: formatDate(item.last_cal_date), size: 'xs', weight: 'bold', color: '#475569', flex: 6 }
          ]
        },
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: '3. ครั้งถัดไปส่ง Cal:', size: 'xs', color: '#94a3b8', flex: 4 },
            { type: 'text', text: formatDate(item.next_cal_date), size: 'xs', weight: 'bold', color: '#0d9488', flex: 6 }
          ]
        }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        {
          type: 'button',
          style: 'secondary',
          height: 'sm',
          action: {
            type: 'postback',
            label: '✅ Cal แล้ว (อัปเดตรอบถัดไป)',
            data: `action=cal_complete&itemId=${item.id}`
          }
        },
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              flex: 1,
              action: {
                type: 'postback',
                label: '✍️ แก้ไข',
                data: `action=request_cal_edit&itemId=${item.id}`
              }
            },
            {
              type: 'button',
              style: 'secondary',
              color: '#dc2626',
              height: 'sm',
              flex: 1,
              action: {
                type: 'postback',
                label: '🗑️ ลบรายการ',
                data: `action=cal_delete&itemId=${item.id}`
              }
            }
          ]
        },
        {
          type: 'button',
          style: 'secondary',
          height: 'sm',
          color: '#0d9488',
          action: {
            type: 'uri',
            label: '🌐 เปิดดูบนเว็บ',
            uri: editUrl
          }
        }
      ]
    }
  };
}

export function createPrFlexBubble(prItem: any, appUrl: string) {
  const shortId = prItem.id.substring(prItem.id.length - 4);
  const dateObj = new Date(prItem.created_at);
  const dateStr = dateObj.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric' });
  const timeStr = dateObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
  const editUrl = `${appUrl}/pr-tracker`;

  let statusText = '⏳ รอเลข PR';
  let statusColor = '#f59e0b';
  if (prItem.status === 'PR Issued') {
    statusText = '📄 ออก PR แล้ว';
    statusColor = '#3b82f6';
  } else if (prItem.status === 'PO Issued') {
    statusText = '📑 ออก PO แล้ว';
    statusColor = '#8b5cf6';
  } else if (prItem.status === 'Completed') {
    statusText = '✅ เสร็จสมบูรณ์';
    statusColor = '#10b981';
  }

  const footerActions: any[] = [];
  if (prItem.status !== 'Completed') {
    footerActions.push({
      type: 'button',
      style: 'primary',
      height: 'sm',
      color: '#10b981',
      action: {
        type: 'postback',
        label: '✅ ทำรายการเสร็จสิ้น',
        data: `action=pr_complete&itemId=${prItem.id}`
      }
    });
  }

  footerActions.push(
    {
      type: 'button',
      style: 'secondary',
      height: 'sm',
      action: {
        type: 'postback',
        label: '✍️ แก้ไขรายการ',
        data: `action=request_pr_edit&itemId=${prItem.id}`
      }
    },
    {
      type: 'button',
      style: 'secondary',
      height: 'sm',
      action: {
        type: 'postback',
        label: '🗑️ ลบรายการ',
        data: `action=pr_delete&itemId=${prItem.id}`
      }
    },
    {
      type: 'button',
      style: 'secondary',
      height: 'sm',
      color: '#6366f1',
      action: {
        type: 'uri',
        label: '✍️ เติมเลข PR/PO/QT บนเว็บ',
        uri: editUrl
      }
    }
  );

  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#f8fafc',
      paddingAll: '15px',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'text',
              text: '📑 ติดตามการออก PR',
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
          text: prItem.title,
          weight: 'bold',
          size: 'md',
          margin: 'sm',
          wrap: true,
          color: '#1e293b'
        }
      ]
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: 'สถานะ:', size: 'xs', color: '#94a3b8', flex: 3 },
            { type: 'text', text: statusText, size: 'xs', weight: 'bold', color: statusColor, flex: 7 }
          ]
        },
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: 'เลข PR:', size: 'xs', color: '#94a3b8', flex: 3 },
            { type: 'text', text: prItem.pr_no || '(ยังไม่ระบุ)', size: 'xs', weight: prItem.pr_no ? 'bold' : 'regular', color: prItem.pr_no ? '#8b5cf6' : '#94a3b8', flex: 7 }
          ]
        },
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: 'เลข PO:', size: 'xs', color: '#94a3b8', flex: 3 },
            { type: 'text', text: prItem.po_no || '(ยังไม่ระบุ)', size: 'xs', weight: prItem.po_no ? 'bold' : 'regular', color: prItem.po_no ? '#a855f7' : '#94a3b8', flex: 7 }
          ]
        },
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: 'เลข QT:', size: 'xs', color: '#94a3b8', flex: 3 },
            { type: 'text', text: prItem.qt_no || '(ยังไม่ระบุ)', size: 'xs', weight: prItem.qt_no ? 'bold' : 'regular', color: prItem.qt_no ? '#10b981' : '#94a3b8', flex: 7 }
          ]
        },
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: 'ทำรายการ:', size: 'xs', color: '#94a3b8', flex: 3 },
            { type: 'text', text: `${dateStr} (${timeStr} น.)`, size: 'xs', color: '#64748b', flex: 7 }
          ]
        },
        ...(prItem.subtotal || prItem.total_amount ? [
          {
            type: 'separator',
            margin: 'sm'
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'ราคาต้น:', size: 'xs', color: '#94a3b8', flex: 3 },
              { type: 'text', text: `${Number(prItem.subtotal || 0).toLocaleString('th-TH')} บาท`, size: 'xs', color: '#334155', flex: 7 }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'VAT 7%:', size: 'xs', color: '#94a3b8', flex: 3 },
              { type: 'text', text: `${Number(prItem.vat_amount || 0).toLocaleString('th-TH')} บาท`, size: 'xs', color: '#334155', flex: 7 }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'ราคารวมสุทธิ:', size: 'xs', color: '#94a3b8', flex: 3 },
              { type: 'text', text: `${Number(prItem.total_amount || 0).toLocaleString('th-TH')} บาท`, size: 'xs', weight: 'bold', color: '#8b5cf6', flex: 7 }
            ]
          }
        ] : [])
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: footerActions
    }
  };
}

export function createPrListMenuFlex() {
  return {
    type: 'flex',
    altText: '📋 เมนูเลือกดูรายการ PR',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#8b5cf6',
        contents: [
          {
            type: 'text',
            text: '📑 เมนูเลือกดูรายการ PR',
            weight: 'bold',
            color: '#ffffff',
            size: 'sm'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: 'กรุณาเลือกรายการ PR ที่คุณต้องการตรวจสอบ:',
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
              label: '⏳ PR ที่กำลังติดตาม',
              data: 'action=view_prs&status=pending'
            }
          },
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: {
              type: 'postback',
              label: '✅ PR ที่เสร็จสมบูรณ์แล้ว',
              data: 'action=view_prs&status=completed'
            }
          },
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: {
              type: 'postback',
              label: '📋 ดูรายการ PR ทั้งหมด',
              data: 'action=view_prs&status=all'
            }
          }
        ]
      }
    }
  };
}

export function createCalibrationListMenuFlex() {
  return {
    type: 'flex',
    altText: '📋 เมนูเลือกดูรายการ Calibration',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#0d9488',
        contents: [
          {
            type: 'text',
            text: '🔬 เมนูเลือกดูรายการ Calibrate',
            weight: 'bold',
            color: '#ffffff',
            size: 'sm'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: 'กรุณาเลือกประเภทรายการเครื่องมือที่คุณต้องการตรวจสอบ:',
            size: 'xs',
            color: '#64748b',
            wrap: true
          },
          {
            type: 'button',
            style: 'primary',
            color: '#0d9488',
            height: 'sm',
            action: {
              type: 'postback',
              label: '⚠️ เครื่องมือใกล้ถึงกำหนด Cal',
              data: 'action=view_calibrations&status=due'
            }
          },
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: {
              type: 'postback',
              label: '🔬 ดูรายการเครื่องมือทั้งหมด',
              data: 'action=view_calibrations&status=all'
            }
          }
        ]
      }
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

export function createPrEditMenuFlex(prItem: any) {
  const shortId = prItem.id.substring(prItem.id.length - 4);
  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#f8fafc',
      paddingAll: '18px',
      contents: [
        {
          type: 'text',
          text: '✏️ แก้ไขข้อมูล PR',
          weight: 'bold',
          size: 'xxs',
          color: '#0284c7'
        },
        {
          type: 'text',
          text: `"${prItem.title}" (#${shortId})`,
          size: 'sm',
          weight: 'bold',
          color: '#0f172a',
          margin: 'xs',
          wrap: true
        }
      ]
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingAll: '18px',
      contents: [
        {
          type: 'text',
          text: 'เอกสาร & ตัวเลข:',
          size: 'xs',
          color: '#64748b',
          weight: 'bold',
          margin: 'none'
        },
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              flex: 1,
              action: {
                type: 'postback',
                label: '📄 เลข PR',
                data: `action=request_pr_field&field=pr_no&itemId=${prItem.id}`
              }
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              flex: 1,
              action: {
                type: 'postback',
                label: '📑 เลข PO',
                data: `action=request_pr_field&field=po_no&itemId=${prItem.id}`
              }
            }
          ]
        },
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              flex: 1,
              action: {
                type: 'postback',
                label: '🏷️ เลข QT',
                data: `action=request_pr_field&field=qt_no&itemId=${prItem.id}`
              }
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              flex: 1,
              action: {
                type: 'postback',
                label: '💰 ราคา & VAT',
                data: `action=request_pr_field&field=subtotal&itemId=${prItem.id}`
              }
            }
          ]
        },
        {
          type: 'text',
          text: 'สถานะ & ข้อความ:',
          size: 'xs',
          color: '#64748b',
          weight: 'bold',
          margin: 'md'
        },
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              flex: 1,
              action: {
                type: 'postback',
                label: '🔄 เปลี่ยนสถานะ',
                data: `action=request_pr_status_menu&itemId=${prItem.id}`
              }
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              flex: 1,
              action: {
                type: 'postback',
                label: '✏️ แก้ไขหัวข้อ',
                data: `action=request_pr_field&field=title&itemId=${prItem.id}`
              }
            }
          ]
        },
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              flex: 1,
              action: {
                type: 'postback',
                label: '📝 แก้หมายเหตุ',
                data: `action=request_pr_field&field=notes&itemId=${prItem.id}`
              }
            },
            {
              type: 'button',
              style: 'secondary',
              color: '#ef4444',
              height: 'sm',
              flex: 1,
              action: {
                type: 'postback',
                label: '✕ ยกเลิก',
                data: 'action=cancel_edit'
              }
            }
          ]
        }
      ]
    }
  };
}

export function createPrStatusMenuFlex(prItem: any) {
  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#f8fafc',
      paddingAll: '18px',
      contents: [
        {
          type: 'text',
          text: '🔄 เลือกสถานะใหม่สำหรับ PR',
          weight: 'bold',
          color: '#0f172a',
          size: 'sm'
        },
        {
          type: 'text',
          text: `"${prItem.title}"`,
          size: 'xs',
          color: '#64748b',
          margin: 'xs',
          wrap: true
        }
      ]
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingAll: '18px',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              flex: 1,
              action: {
                type: 'postback',
                label: '⏳ รอเลข PR',
                data: `action=set_pr_status&status=Pending&itemId=${prItem.id}`
              }
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              flex: 1,
              action: {
                type: 'postback',
                label: '📄 ออก PR แล้ว',
                data: `action=set_pr_status&status=PR Issued&itemId=${prItem.id}`
              }
            }
          ]
        },
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              flex: 1,
              action: {
                type: 'postback',
                label: '📑 ออก PO แล้ว',
                data: `action=set_pr_status&status=PO Issued&itemId=${prItem.id}`
              }
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              flex: 1,
              action: {
                type: 'postback',
                label: '✅ เสร็จสมบูรณ์',
                data: `action=set_pr_status&status=Completed&itemId=${prItem.id}`
              }
            }
          ]
        }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          style: 'link',
          color: '#64748b',
          height: 'sm',
          action: {
            type: 'postback',
            label: '⬅️ ย้อนกลับ',
            data: `action=request_pr_edit&itemId=${prItem.id}`
          }
        }
      ]
    }
  };
}


