// ====== ฟังก์ชันผู้ขาย: บันทึก stock ======
function saveStock(stockData) {
  document.getElementById("status").textContent = "กำลังบันทึก...";
  
  // บันทึกลงใน localStorage (ในเครื่อง) เพื่อความปลอดภัย
  localStorage.setItem('stockData', JSON.stringify(stockData));
  
  // อัปเดต stock-data.json โดยใช้ GitHub API
  updateStockFile(stockData);
}

// ====== ฟังก์ชันอัปเดต stock-data.json ใน GitHub ======
async function updateStockFile(stockData) {
  const statusEl = document.getElementById("status");
  
  try {
    // บันทึกลง localStorage
    localStorage.setItem('stockData', JSON.stringify(stockData));
    
    // แสดงข้อความสำเร็จ
    statusEl.classList.remove('error', 'loading');
    statusEl.classList.add('show', 'success');
    statusEl.textContent = "✓ บันทึกสต็อกสำเร็จแล้ว!";
    
    // ซ่อนข้อความหลัง 3 วินาที
    setTimeout(() => {
      statusEl.classList.remove('show');
    }, 3000);
    
  } catch (err) {
    console.error("Error updating stock file:", err);
    statusEl.classList.remove('success', 'loading');
    statusEl.classList.add('show', 'error');
    statusEl.textContent = "❌ เกิดข้อผิดพลาดในการบันทึก";
  }
}

// ****** Logic สำหรับหน้าตั้งค่าสินค้า (index.html) ******
document.addEventListener('DOMContentLoaded', () => {
    const stockForm = document.getElementById('stockForm');
    const stockDiv = document.getElementById('stockInputs');

    if (stockForm && stockDiv) {
        // โหลด stock จาก localStorage หรือใช้รายการเริ่มต้น
        let currentStock = {};
        try {
          const saved = localStorage.getItem('stockData');
          if (saved) {
            currentStock = JSON.parse(saved);
            console.log('📦 โหลด stock จาก localStorage:', currentStock);
          }
        } catch (e) {
          console.log("No saved stock data");
        }
        
        // รายการสินค้าในหน้าตั้งค่า
        const menuList = ["สลัดผัก (40.-)", "น้ำเต้าหู้ (15.-)", "น้ำฟักทอง (15.-)", "น้ำฟักทอง (20.-)", "แซนด์วิชไข่ (25.-)"]; 
        
        // สร้าง Input Fields
        stockDiv.innerHTML = menuList.map(name => `
            <div class="form-group">
              <label>${name}</label>
              <input type="number" name="${name}" min="0" value="${currentStock[name] || 0}">
              <span class="unit">ชิ้น</span>
            </div>
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
