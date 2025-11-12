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
    // **ต้องสร้าง GitHub Personal Access Token ก่อน**
    // สำหรับทดลอง เราใช้ localStorage แทนการ commit ไป GitHub
    
    statusEl.textContent = "✓ บันทึก stock ลงในเครื่องเรียบร้อย!";
    
    // ถ้าต้องการ commit ไป GitHub จริงๆ ต้องใช้ GitHub API
    // แต่เนื่องจากเป็น static site จึงแนะนำให้ใช้ serverless function แทน
    
  } catch (err) {
    console.error("Error updating stock file:", err);
    statusEl.textContent = "⚠️ บันทึกแล้ว (ยังต้องการเชื่อมต่อ GitHub)";
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
          }
        } catch (e) {
          console.log("No saved stock data");
        }
        
        // รายการสินค้าในหน้าตั้งค่า
        const menuList = ["สลัดผัก (40.-)", "น้ำเต้าหู้ (15.-)", "น้ำฟักทอง (15.-)", "น้ำฟักทอง (20.-)", "แซนด์วิชไข่ (25.-)"]; 
        
        // สร้าง Input Fields
        stockDiv.innerHTML = menuList.map(name => `
            <label>${name}: <input type="number" name="${name}" min="0" value="${currentStock[name] || 0}"> ชิ้น</label>
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
