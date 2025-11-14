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

// ****** Logic สำหรับหน้าตั้งค่าสินค้า (seller.html) ******
const ITEM_PRICE = 20; // fallback price

function normalizeStockObject(raw) {
  const out = {};
  Object.entries(raw || {}).forEach(([k, v]) => {
    if (v && typeof v === 'object' && (('qty' in v) || ('price' in v))) {
      out[k.replace(/\s*\(.*\)\s*$/, '').trim()] = {
        price: Number(v.price) || ITEM_PRICE,
        qty: Number(v.qty) || 0
      };
    } else {
      // primitive value (previous format: name -> qty)
      const qty = Number(v) || 0;
      const m = k.match(/\((\d+)/);
      const price = m ? Number(m[1]) : ITEM_PRICE;
      const baseName = k.replace(/\s*\(.*\)\s*$/, '').trim();
      out[baseName] = { price, qty };
    }
  });
  return out;
}

document.addEventListener('DOMContentLoaded', async () => {
    const stockForm = document.getElementById('stockForm');
    const stockDiv = document.getElementById('stockInputs');

    if (stockForm && stockDiv) {
        // โหลด stock จาก localStorage หรือจาก stock-data.json
        let currentStock = {};
        try {
          const saved = localStorage.getItem('stockData');
          if (saved) {
            const parsed = JSON.parse(saved);
            currentStock = normalizeStockObject(parsed);
            console.log('📦 โหลด stock จาก localStorage (normalized):', currentStock);
          } else {
            // พยายามโหลดจากไฟล์ stock-data.json (repo)
            try {
              const res = await fetch('stock-data.json');
              if (res.ok) currentStock = await res.json();
            } catch (e) {
              console.log('ไม่พบ stock-data.json ในเซิร์ฟเวอร์ หรือโหลดล้มเหลว', e);
            }
          }
        } catch (e) {
          console.log("No saved stock data", e);
        }

        // สร้างรายการจากคีย์ของ currentStock
        const menuList = Object.keys(currentStock);

        // ถ้าไม่มีข้อมูลเลย ให้แสดงช่องว่างเพื่อให้ผู้ใช้เพิ่มเอง (หรือแสดงข้อความ)
        if (!menuList || menuList.length === 0) {
            stockDiv.innerHTML = '<p>ยังไม่มีรายการสินค้า โปรดเพิ่มในไฟล์ stock-data.json หรือในช่องด้านล่าง</p>';
        } else {
            stockDiv.innerHTML = menuList.map(name => {
                const item = currentStock[name] || {};
                const qty = Number.isFinite(Number(item.qty)) ? Number(item.qty) : 0;
                const price = Number.isFinite(Number(item.price)) ? Number(item.price) : 0;
                return `
                <div class="form-group">
                  <label>${name}</label>
                  <input type="number" data-item="${name}" data-field="qty" min="0" value="${qty}" title="จำนวน">
                  <input type="number" data-item="${name}" data-field="price" min="0" value="${price}" title="ราคา (บาท)" style="width:100px; margin-left:8px;">
                  <span class="unit">ชิ้น</span>
                </div>
            `}).join('');
        }

        // จัดการ Event บันทึก
        stockForm.addEventListener('submit', e => {
            e.preventDefault();
            const stockData = {};
            // อ่านค่าแต่ละรายการจากฟอร์มโดยใช้ data-item
            stockDiv.querySelectorAll('[data-item]').forEach(el => {
                const itemName = el.dataset.item;
                const field = el.dataset.field;
                if (!stockData[itemName]) stockData[itemName] = { price: 0, qty: 0 };
                const val = parseInt(el.value, 10) || 0;
                if (field === 'qty') stockData[itemName].qty = val;
                if (field === 'price') stockData[itemName].price = val;
            });

            // เรียกใช้ฟังก์ชันบันทึก
            saveStock(stockData);
        });
    }
});
