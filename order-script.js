// === ตั้งค่าเก็บข้อมูลบน GitHub Pages ===
const ITEM_PRICE = 20; // ราคาเริ่มต้น

// ====== ฟังก์ชันโหลด stock จากไฟล์ JSON ======
async function loadStock() {
  const statusElement = document.getElementById("status");
  if (statusElement) statusElement.textContent = "กำลังโหลดรายการสินค้า...";

  try {
    // โหลดจากไฟล์ stock-data.json บน GitHub Pages
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

// ====== ฟังก์ชันบันทึกการสั่งซื้อ ======
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
    
    // สร้าง order entry ใหม่
    const newOrder = {
      date: new Date().toISOString(),
      customerName: name,
      orders: orders,
      totalAmount: Object.keys(orders).reduce((sum, item) => sum + (orders[item] * ITEM_PRICE), 0)
    };
    
    // เพิ่มเข้า log
    ordersLog.push(newOrder);
    
    // บันทึกลง localStorage
    localStorage.setItem('ordersLog', JSON.stringify(ordersLog));
    
    // คำนวณ stock ใหม่
    const currentStock = await loadStock();
    const updatedStock = { ...currentStock };
    
    Object.keys(orders).forEach(item => {
      if (updatedStock[item]) {
        updatedStock[item] = parseInt(updatedStock[item]) - parseInt(orders[item]);
      }
    });
    
    // บันทึก stock ใหม่
    localStorage.setItem('stockData', JSON.stringify(updatedStock));
    
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
    
    statusEl.classList.remove('loading', 'error');
    statusEl.classList.add('success');
    statusEl.innerHTML = `
      <div style="line-height: 1.6;">
        ✓ สั่งซื้อสำเร็จแล้ว!<br>
        ยอดรวม: ${totalAmount} บาท<br>
        <strong>รหัสอ้างอิง: ${refCode}</strong>
      </div>
    `;
    
    // รีเซ็ตฟอร์ม
    document.getElementById('orderForm').reset();
    
    // รีโหลด Stock ใหม่หลังสั่งซื้อสำเร็จ
    setTimeout(() => {
      loadStockAndRenderMenu();
      statusEl.classList.remove('show');
    }, 2000);
    
  } catch (err) {
    console.error("Error:", err);
    statusEl.classList.remove('loading');
    statusEl.classList.add('error');
    statusEl.textContent = "❌ เกิดข้อผิดพลาด: " + err.message;
  }
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
    
    // 1. สร้างเมนู
    menuDiv.innerHTML = '';
    Object.keys(stock).forEach(name => {
        menuDiv.innerHTML += `
            <div class="form-group">
              <label>${name} (เหลือ ${stock[name]} ชิ้น)</label>
              <input type="number" min="0" max="${stock[name]}" data-name="${name}" value="0">
            </div>`;
    });

    // 2. Event Listener คำนวณยอดรวม
    menuDiv.addEventListener('input', () => {
        let total = 0;
        menuDiv.querySelectorAll('input').forEach(inp => {
            total += parseInt(inp.value || 0) * ITEM_PRICE; // ใช้ ITEM_PRICE
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
