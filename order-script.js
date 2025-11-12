// === ตั้งค่า URL ของ Google Apps Script Web App ===
// ****** ต้องเป็น URL /exec ที่ถูกต้องและ Deploy แล้ว ******
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwCJcXJ4U5TKVk9Qu6UKHpMAGeeG90QfdfTspaSWIApvoEaHVpVCp3KS9QcLUREg_P1/exec"; 
const ITEM_PRICE = 20; // ราคาเริ่มต้น (ตามโค้ดเดิม) หรือคุณอาจจะต้องตั้งราคาที่ถูกต้อง

// ====== ฟังก์ชันโหลด stock ======
async function loadStock() {
  const statusElement = document.getElementById("status");
  if (statusElement) statusElement.textContent = "กำลังโหลดรายการสินค้า...";

  try {
    // ยิง GET request เพื่อดึง JSON Stock Data
    const res = await fetch(SCRIPT_URL + "?type=getStock");
    
    // ตรวจสอบสถานะการตอบกลับ
    if (!res.ok) {
        throw new Error(`การเชื่อมต่อผิดพลาด (HTTP Status: ${res.status})`);
    }

    // ตรวจสอบ Content-Type เพื่อหลีกเลี่ยง Error
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
        // ถ้า Web App ส่ง HTML Error กลับมา จะไม่ใช่ JSON
        throw new Error("Backend ไม่ได้ส่ง JSON กลับมา อาจเป็นเพราะ CORS หรือ Deploy ผิดพลาด");
    }

    if (statusElement) statusElement.textContent = "";
    return await res.json();

  } catch (err) {
    console.error("Error loading stock:", err);
    if (statusElement) statusElement.textContent = "❌ ไม่สามารถโหลดสต็อกได้: " + err.message;
    return {}; // คืนค่าว่าง
  }
}

// ====== ฟังก์ชันลูกค้าสั่งของ ======
function submitOrder(name, orders) {
  document.getElementById("status").textContent = "กำลังสั่งซื้อ...";
  fetch(SCRIPT_URL, {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: "order", name, orders })
  })
  .then(res => res.text())
  .then(txt => {
    document.getElementById("status").textContent = txt; // แสดงผลตอบกลับจาก code.gs
    // รีโหลด Stock ใหม่หลังสั่งซื้อสำเร็จ
    loadStockAndRenderMenu();
  })
  .catch(err => document.getElementById("status").textContent = "❌ เกิดข้อผิดพลาดในการสั่งซื้อ: " + err);
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
        // *** ราคาถูก Hardcode เป็น 20 บาท ตามโค้ดเดิมของคุณ ***
        menuDiv.innerHTML += `
            <label>${name} (เหลือ ${stock[name]}): 
            <input type="number" min="0" max="${stock[name]}" data-name="${name}" value="0"></label>`;
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
