// === ตั้งค่า URL ของ Google Apps Script Web App ===
// ****** ตรวจสอบให้แน่ใจว่าเป็น URL /exec ล่าสุดที่ Deploy แล้ว ******
const SCRIPT_URL = "https://script.google.com/macros/s/160GHbEAuxzyaIINmSvad-TKLGK9OobSBEZDLN64w3Po/exec"; 

// ====== ฟังก์ชันผู้ขาย: บันทึก stock ======
function saveStock(stockData) {
  document.getElementById("status").textContent = "กำลังบันทึก...";
  fetch(SCRIPT_URL, {
    method: "POST",
    headers: { // สำคัญ: กำหนด Content-Type ให้ถูกต้อง
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: "setStock", data: stockData })
  })
  .then(res => res.text()) // อ่านผลลัพธ์เป็นข้อความ (เพราะเราส่งกลับเป็น ContentService.createTextOutput)
  .then(txt => document.getElementById("status").textContent = txt)
  .catch(err => document.getElementById("status").textContent = "❌ เกิดข้อผิดพลาด: " + err);
}

// ====== ฟังก์ชันโหลด stock ======
async function loadStock() {
  try {
    const res = await fetch(SCRIPT_URL + "?type=getStock");
    if (!res.ok) throw new Error(`Network error: ${res.statusText}`);

    // ตรวจสอบว่า Content-Type เป็น JSON ก่อนเรียก .json()
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await res.json();
    } else {
      // ถ้าไม่ได้ส่ง JSON กลับมา อาจจะเป็น HTML error page ของ Google
      throw new Error("Backend did not return JSON. Check Web App Deploy settings.");
    }
  } catch (err) {
    console.error("Error loading stock:", err);
    document.getElementById("status")?.textContent = "❌ ไม่สามารถโหลดสต็อกได้: " + err.message;
    return {}; // คืนค่าว่างเพื่อไม่ให้โค้ดใน order.html พัง
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
  .then(res => res.text()) // อ่านผลลัพธ์เป็นข้อความ
  .then(txt => document.getElementById("status").textContent = txt)
  .catch(err => document.getElementById("status").textContent = "❌ เกิดข้อผิดพลาด: " + err);
}

// ****** ส่วนใหม่: Logic สำหรับหน้าตั้งค่าสินค้า (index.html) ******

// ใช้ DOMContentLoaded เพื่อให้แน่ใจว่าองค์ประกอบ HTML ถูกโหลดแล้ว
document.addEventListener('DOMContentLoaded', () => {
    // 1. Logic สำหรับหน้าตั้งค่าสินค้า (index.html)
    const stockForm = document.getElementById('stockForm');
    const stockDiv = document.getElementById('stockInputs');

    if (stockForm && stockDiv) {
        // รายการสินค้าของคุณที่ใช้ใน index.html
        // ต้องตรงกับโค้ดที่เคยอยู่ใน index.html (ตัวอย่างสินค้าใหม่ของคุณอาจไม่ตรงกับสินค้าเดิมที่ใช้ใน code.gs)
        const menuList = ["ชาเขียว", "โกโก้", "กาแฟเย็น", "น้ำผึ้งมะนาว", "นมสด"]; 
        
        // ******* ฟังก์ชันสร้าง Input Fields (เอามาจาก index.html เดิม) *******
        menuList.forEach(name => {
            stockDiv.innerHTML += `
                <label>${name}: <input type="number" name="${name}" min="0" value="0"> ชิ้น</label>`;
        });
        // *******************************************************************
        
        // ******* ฟังก์ชันจัดการ Event บันทึก (เอามาจาก index.html เดิม) *******
        stockForm.addEventListener('submit', e => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const stockData = {};
            // สร้าง Object { "ชาเขียว": 10, "โกโก้": 5, ... }
            formData.forEach((v, k) => stockData[k] = v); 
            saveStock(stockData); // เรียกใช้ฟังก์ชันใน script.js
        });
        // *******************************************************************
    }
    
    // 2. Logic สำหรับหน้าสั่งสินค้า (order.html) - โค้ดเดิม
    // ... (ส่วนนี้ควรถูกแยกไปอยู่ใน block อื่น หรืออยู่ใน order.html)
    // แต่ถ้าต้องการรวม ให้ตรวจสอบว่า loadStock ทำงานบน order.html ได้
});

// ****** โค้ดที่ใช้สำหรับ index.html: ใช้ script.js แทน ******

// if (document.getElementById('stockForm')) {
//   const menuList = ["ชาเขียว", "โกโก้", "กาแฟเย็น", "น้ำผึ้งมะนาว", "นมสด"];
//   const stockDiv = document.getElementById('stockInputs');
//   menuList.forEach(name => {
//     stockDiv.innerHTML += `
//       <label>${name}: <input type="number" name="${name}" min="0" value="0"> ชิ้น</label>`;
//   });

//   document.getElementById('stockForm').addEventListener('submit', e => {
//     e.preventDefault();
//     const formData = new FormData(e.target);
//     const stockData = {};
//     formData.forEach((v, k) => stockData[k] = v);
//     saveStock(stockData);
//   });
// }
