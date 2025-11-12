// === ตั้งค่า URL ของ Google Apps Script Web App ===
// ****** ต้องเป็น URL /exec ที่ถูกต้องและ Deploy แล้ว ******
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxU2AYB6wwheqEiAb5h85e_leIoBYsHsQgEQgvccp-dVzpU0BrVYlQViYxIDf3wrYn-/exec"; 

// ====== ฟังก์ชันผู้ขาย: บันทึก stock ======
function saveStock(stockData) {
  document.getElementById("status").textContent = "กำลังบันทึก...";
  fetch(SCRIPT_URL, {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: "setStock", data: stockData })
  })
  .then(res => res.text())
  .then(txt => document.getElementById("status").textContent = txt) // แสดงผลตอบกลับจาก code.gs
  .catch(err => document.getElementById("status").textContent = "❌ เกิดข้อผิดพลาดในการเชื่อมต่อ: " + err);
}

// ****** Logic สำหรับหน้าตั้งค่าสินค้า (index.html) ******
document.addEventListener('DOMContentLoaded', () => {
    const stockForm = document.getElementById('stockForm');
    const stockDiv = document.getElementById('stockInputs');

    if (stockForm && stockDiv) {
        // รายการสินค้าในหน้าตั้งค่า
        // **ต้องเป็นรายการที่ผู้ขายใช้ตั้งค่า ไม่จำเป็นต้องตรงกับ code.gs เสมอไป**
        const menuList = ["สลัดผัก (40.-)", "น้ำเต้าหู้ (15.-)", "น้ำฟักทอง (15.-)", "น้ำฟักทอง (20.-)", "แซนด์วิชไข่ (25.-)"]; 
        
        // สร้าง Input Fields
        stockDiv.innerHTML = menuList.map(name => `
            <label>${name}: <input type="number" name="${name}" min="0" value="0"> ชิ้น</label>
        `).join('');
        
        // จัดการ Event บันทึก
        stockForm.addEventListener('submit', e => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const stockData = {};
            formData.forEach((v, k) => stockData[k] = v); 
            
            // เรียกใช้ฟังก์ชันบันทึก
            saveStock(stockData); 
        });
    }
});
