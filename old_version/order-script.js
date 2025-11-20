// === ตั้งค่าเก็บข้อมูลบน GitHub Pages ===
const ITEM_PRICE = 20; // ราคาเริ่มต้น (fallback)

// --- Backend config ---
// หากต้องการให้บันทึกคำสั่งซื้อไปยังเซิร์ฟเวอร์ ให้ตั้งค่าเป็น URL ของ Web App / API
// ตัวอย่าง: const BACKEND_URL = 'https://script.google.com/macros/s/....../exec';
// หากไม่ต้องการ ให้เว้นเป็น '' (ค่าเริ่มต้น) — จะบันทึกเฉพาะใน localStorage เท่านั้น
//const BACKEND_URL = '';
const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbxI_onG1cy47WNP4j3_HrmSGyBwL9XGFwZBTZtZtnQTaI6y0N6sPL_9hP_XrCd76BI/exec';

// ส่งคำสั่งซื้อไปยัง backend (ถ้ามีการตั้งค่า)
async function postOrderToBackend(order) {
  if (!BACKEND_URL) return { ok: false, reason: 'no-backend' };
  try {
    const res = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order)
    });
    let body = null;
    try { body = await res.json(); } catch(e) { body = await res.text(); }
    if (!res.ok) return { ok: false, status: res.status, body };
    return { ok: true, status: res.status, body };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ====== ฟังก์ชันโหลด stock จากไฟล์ JSON ======
async function loadStock() {
  const statusElement = document.getElementById("status");
  if (statusElement) statusElement.textContent = "กำลังโหลดรายการสินค้า...";

  try {
    // ถ้ามีค่าใน localStorage ให้ใช้ค่านั้นเป็นที่ตั้ง (local-first)
    const saved = localStorage.getItem('stockData');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // หากข้อมูลเก่ายังเป็นรูปแบบ name->qty ให้ normalize เป็น { price, qty }
        const normalized = {};
        Object.entries(parsed || {}).forEach(([k, v]) => {
          if (v && typeof v === 'object' && (('qty' in v) || ('price' in v))) {
            normalized[k.replace(/\s*\(.*\)\s*$/, '').trim()] = {
              price: Number(v.price) || ITEM_PRICE,
              qty: Number(v.qty) || 0
            };
          } else {
            // primitive
            const qty = Number(v) || 0;
            const m = k.match(/\((\d+)/);
            const price = m ? Number(m[1]) : ITEM_PRICE;
            const baseName = k.replace(/\s*\(.*\)\s*$/, '').trim();
            normalized[baseName] = { price, qty };
          }
        });
        if (statusElement) statusElement.textContent = "";
        return normalized;
      } catch (e) {
        console.warn('Invalid stockData in localStorage, fallback to fetch', e);
      }
    }

    // มิฉะนั้น โหลดจากไฟล์ stock-data.json บน GitHub Pages
    const res = await fetch('stock-data.json');
    // ตรวจสอบสถานะการตอบกลับ
    if (!res.ok) {
      throw new Error(`การเชื่อมต่อผิดพลาด (HTTP Status: ${res.status})`);
    }
    if (statusElement) statusElement.textContent = "";
    return await res.json();

  } catch (err) {
    console.error("Error loading stock:", err);
    if (statusElement) statusElement.textContent = "❌ ไม่สามารถโหลดสต็อกได้: " + err.message;
    return {}; // คืนค่าว่าง
  }
}

// ====== ฟังก์ชันบันทึกการสั่งซื้อและตัด Stock ======
async function saveOrder(name, orders) {
  try {
    // โหลด orders log ปัจจุบัน
    let ordersLog = [];
    try {
      const res = await fetch('orders-log.json');
      if (res.ok) {
        ordersLog = await res.json();
      }
    } catch (e) {
      console.log("No existing orders log, creating new one");
    }
    
    // โหลด stock เพื่อคำนวณราคาและอัปเดตสต็อก
    const currentStock = await loadStock();

    // สร้าง order entry ใหม่: normalize orders เป็นรูปแบบ per-item { qty, price, total }
    const ordersNormalized = {};
    let totalAmount = 0;
    Object.keys(orders).forEach(item => {
      const qty = parseInt(orders[item], 10) || 0;
      const price = (currentStock[item] && Number.isFinite(Number(currentStock[item].price))) ? Number(currentStock[item].price) : ITEM_PRICE;
      const itemTotal = qty * price;
      ordersNormalized[item] = { qty, price, total: itemTotal };
      totalAmount += itemTotal;
    });

    const newOrder = {
      date: new Date().toISOString(),
      customerName: name,
      orders: ordersNormalized,
      totalAmount: totalAmount,
      // payment tracking
      payments: [], // array of { date, amount, method }
      paidAmount: 0,
      paid: false
    };
    
    // เพิ่มเข้า log
    ordersLog.push(newOrder);
    
    // บันทึกลง localStorage
    localStorage.setItem('ordersLog', JSON.stringify(ordersLog));
    
    // 🔴 อัปเดต Stock (ลด qty ของแต่ละรายการ)
    const updatedStock = { ...currentStock };

    Object.keys(ordersNormalized).forEach(item => {
      if (typeof updatedStock[item] !== 'undefined') {
        const currentQty = parseInt(updatedStock[item].qty, 10) || 0;
        const orderQty = parseInt(ordersNormalized[item].qty, 10) || 0;
        updatedStock[item].qty = Math.max(0, currentQty - orderQty); // ไม่ให้ติดลบ

        console.log(`✂️ ตัด stock: ${item} จาก ${currentQty} เหลือ ${updatedStock[item].qty} ชิ้น`);
      }
    });
    
    // บันทึก stock ใหม่ลง localStorage
    localStorage.setItem('stockData', JSON.stringify(updatedStock));
    console.log('📦 Stock ที่อัปเดต:', updatedStock);
    
    return newOrder;
    
  } catch (err) {
    console.error("Error saving order:", err);
    throw err;
  }
}

// ====== ฟังก์ชันลูกค้าสั่งของ ======
async function submitOrder(name, orders) {
  const statusEl = document.getElementById("status");
  statusEl.classList.remove('error', 'success');
  statusEl.classList.add('show', 'loading');
  statusEl.textContent = "⏳ กำลังประมวลผลคำสั่งซื้อ...";
  
  try {
    const orderResult = await saveOrder(name, orders);
    
    // สร้างเลขอ้างอิง
    const refCode = Math.floor(Math.random() * 900000) + 100000;
    const totalAmount = orderResult.totalAmount;

    // สรุปการตัด stock (ใช้ orders ที่ normalize แล้ว)
    let stockSummary = '<div style="line-height: 1.6; text-align: left; display: inline-block;">';
    Object.entries(orderResult.orders).forEach(([item, detail]) => {
      stockSummary += `📦 ${item}: ตัด ${detail.qty} ชิ้น (฿${detail.price} / ชิ้น) = ฿${detail.total}<br>`;
    });
    stockSummary += '</div>';
    
    // สร้าง QR Code Prompt Pay
    const qrCodeUrl = generatePromptPayQR(totalAmount);
    
    statusEl.classList.remove('loading', 'error');
    statusEl.classList.add('success');
    statusEl.innerHTML = `
      <div style="line-height: 1.8; text-align: center;">
        <strong style="font-size: 18px;">✓ สั่งซื้อสำเร็จแล้ว!</strong><br>
        
        <div style="margin: 15px 0; font-size: 12px; color: #666; text-align: left; display: inline-block;">
          ${stockSummary}
        </div>
        
        <div style="margin: 20px 0; border-top: 2px solid rgba(245,87,108,0.3); padding-top: 15px;">
          <div style="font-size: 18px; font-weight: bold; color: #f5576c;">💰 ยอดชำระ: ${totalAmount} บาท</div>
          <div style="font-size: 12px; color: #999; margin-top: 5px;">รหัสอ้างอิง: <strong>${refCode}</strong></div>
        </div>
        
        <div style="margin: 20px 0; border-top: 2px solid rgba(245,87,108,0.3); padding-top: 15px;">
          <div style="font-size: 14px; font-weight: bold; margin-bottom: 10px;">💳 ช่องทางชำระเงิน:</div>
          
          <div style="background: #f9f9f9; padding: 12px; border-radius: 8px; margin-bottom: 10px; font-size: 13px; line-height: 1.6;">
            <div style="margin-bottom: 8px;">
              <strong>🏦 บัญชีเงินฝาก</strong><br>
              กรุงไทย - ลัดดา ใบดำ<br>
              <span style="font-size: 16px; font-weight: bold; color: #2a5298;">4520184878</span>
            </div>
          </div>
          
          <div style="background: #f9f9f9; padding: 12px; border-radius: 8px; margin-bottom: 10px; font-size: 13px; line-height: 1.6;">
            <div>
              <strong>📱 PromptPay / พร้อมเพย์</strong><br>
              <span style="font-size: 16px; font-weight: bold; color: #2a5298;">0857450847</span>
            </div>
          </div>
          
          <div style="margin-top: 15px; padding: 12px; background: #f0f0f0; border-radius: 8px;">
            <div style="font-size: 12px; margin-bottom: 10px; color: #666;">
              📲 สแกน QR Code ด้านล่างเพื่อชำระเงิน
            </div>
            <img src="${qrCodeUrl}" alt="QR Code" style="width: 180px; height: 180px; border-radius: 6px; border: 2px solid #2a5298;">
          </div>
        </div>
        
        <div style="margin-top: 15px; padding: 12px; background: #fff3f5; border-radius: 8px; font-size: 12px; color: #666; border-left: 4px solid #f5576c;">
          ⏱️ รอดำเนินการประมวลผลจากผู้ขาย ขอบคุณครับ/ค่ะ
        </div>
      </div>
    `;
    
    // รีเซ็ตฟอร์ม
    document.getElementById('orderForm').reset();
    
    // รีโหลด Stock ใหม่หลังสั่งซื้อสำเร็จ
    setTimeout(() => {
      loadStockAndRenderMenu();
      // ไม่ซ่อน status element เพราะต้องการให้ลูกค้าเห็น QR code
    }, 4000);

    // หากกำหนด BACKEND_URL ให้พยายามส่งคำสั่งซื้อขึ้นเซิร์ฟเวอร์ด้วย
    (async () => {
      const serverResult = await postOrderToBackend(orderResult);
      const serverNote = document.createElement('div');
      serverNote.style.marginTop = '12px';
      serverNote.style.fontSize = '13px';
      serverNote.style.color = '#444';
      if (serverResult.ok) {
        serverNote.innerHTML = '📤 ข้อมูลถูกส่งไปยังเซิร์ฟเวอร์เรียบร้อย';
      } else if (serverResult.reason === 'no-backend') {
        serverNote.innerHTML = 'ℹ️ เซิร์ฟเวอร์ไม่ถูกตั้งค่า — ข้อมูลบันทึกเฉพาะในเครื่อง (localStorage)';
      } else {
        serverNote.innerHTML = '⚠️ เกิดข้อผิดพลาดในการส่งข้อมูลไปยังเซิร์ฟเวอร์: ' + (serverResult.error || serverResult.body || serverResult.status);
      }
      statusEl.appendChild(serverNote);
    })();
    
  } catch (err) {
    console.error("Error:", err);
    statusEl.classList.remove('loading');
    statusEl.classList.add('error');
    statusEl.textContent = "❌ เกิดข้อผิดพลาด: " + err.message;
  }
}

// ====== ฟังก์ชันสร้าง QR Code Prompt Pay ======
function generatePromptPayQR(amount) {
  // ใช้ API qrcode.thaipayment.net
  // Format: https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=...
  // สำหรับ PromptPay: 00020126360014th.co.mpm.promptpay0009100857450847540510${amount}6304xxxx
  
  // ทดแทน: ใช้ qrcode.thaipayment.net
  const phoneNumber = '0857450847';
  const promptPayData = `00020126360014th.co.mpm.promptpay0009${phoneNumber.padStart(13, '0')}540510${amount}6304XXXX`;
  
  // ใช้ API สร้าง QR Code
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(promptPayData)}`;
  
  return qrUrl;
}

// ****** Logic สำหรับหน้าสั่งสินค้า (order.html) ******
async function loadStockAndRenderMenu() {
    const stock = await loadStock();
    const menuDiv = document.getElementById('orderMenu');
    const totalP = document.getElementById('total');

    if (Object.keys(stock).length === 0) {
        menuDiv.innerHTML = '<p style="color:red;">ไม่พบรายการสินค้าในสต็อก. กรุณาตั้งค่าสต็อกก่อน</p>';
        return;
    }
    
    // 1. สร้างเมนู (ใช้โมเดล { price, qty })
    menuDiv.innerHTML = '';
    Object.keys(stock).forEach(name => {
        const item = stock[name] || { price: ITEM_PRICE, qty: 0 };
        const price = Number.isFinite(Number(item.price)) ? Number(item.price) : ITEM_PRICE;
        const qty = Number.isFinite(Number(item.qty)) ? Number(item.qty) : 0;
        menuDiv.innerHTML += `
            <div class="form-group">
              <label>${name} (เหลือ ${qty} ชิ้น) — ${price}.-</label>
              <input type="number" min="0" max="${qty}" data-name="${name}" value="0">
            </div>`;
    });

  // 2. Event Listener คำนวณยอดรวม (ใช้ราคาจาก stock model)
  menuDiv.addEventListener('input', () => {
    let total = 0;
    menuDiv.querySelectorAll('input').forEach(inp => {
      const qty = parseInt(inp.value || 0, 10) || 0;
      const itemName = inp.dataset.name;
      const price = (stock[itemName] && Number.isFinite(Number(stock[itemName].price))) ? Number(stock[itemName].price) : ITEM_PRICE;
      total += qty * price;
    });
    totalP.textContent = `รวมทั้งหมด: ${total} บาท`;
  });

    // 3. Event Listener สั่งสินค้า
    document.getElementById('orderForm')?.addEventListener('submit', e => {
        e.preventDefault();
        const name = document.getElementById('customerName').value;
        const orders = {};
        let itemsOrdered = 0;

        menuDiv.querySelectorAll('input').forEach(inp => {
            const qty = parseInt(inp.value);
            if (qty > 0) {
                orders[inp.dataset.name] = qty;
                itemsOrdered++;
            }
        });
        
        if (itemsOrdered === 0) {
            alert('กรุณาเลือกรายการสินค้าอย่างน้อย 1 ชิ้น');
            return;
        }

        submitOrder(name, orders);
    });
    
    // ตั้งค่าเริ่มต้น
    totalP.textContent = `รวมทั้งหมด: 0 บาท`;
}

document.addEventListener('DOMContentLoaded', loadStockAndRenderMenu);
