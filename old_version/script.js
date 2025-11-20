// === ตั้งค่า URL ของ Google Apps Script Web App ===
// ****** ตรวจสอบให้แน่ใจว่าเป็น URL /exec ล่าสุดที่ Deploy แล้ว ******
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxI_onG1cy47WNP4j3_HrmSGyBwL9XGFwZBTZtZtnQTaI6y0N6sPL_9hP_XrCd76BI/exec"; 

// ====== ฟังก์ชันผู้ขาย: บันทึก stock ======
function saveStock(stockData) {
    const statusEl = document.getElementById("status");
    statusEl.textContent = "กำลังบันทึก...";
    statusEl.className = "show";
    fetch(SCRIPT_URL, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: "updateStock", stock: stockData })
    })
        .then(res => res.json())
        .then(result => {
            if (result.success) {
                statusEl.textContent = "✅ บันทึกสต็อกสำเร็จ";
                statusEl.className = "show success";
                loadAndRenderSellerTable();
            } else {
                statusEl.textContent = "❌ เกิดข้อผิดพลาด: " + (result.message || "ไม่สามารถบันทึกได้");
                statusEl.className = "show error";
            }
        })
        .catch(err => {
            statusEl.textContent = "❌ เกิดข้อผิดพลาด: " + err;
            statusEl.className = "show error";
        });
}

// ====== ฟังก์ชันโหลดและแสดง seller table ======
async function loadAndRenderSellerTable() {
    const statusEl = document.getElementById("status");
    try {
        const res = await fetch(SCRIPT_URL + "?type=getSeller");
        if (!res.ok) throw new Error(`Network error: ${res.statusText}`);
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            const sellerRows = await res.json();
            const tbody = document.querySelector('#seller-table tbody');
            tbody.innerHTML = '';
            sellerRows.slice(0, 5).forEach(row => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${row.itemId}</td>
                    <td>${row.name}</td>
                    <td>${row.price}</td>
                    <td><input type="number" min="0" value="${row.reorderLevel}" data-itemid="${row.itemId}" class="stock-input" style="width:80px"></td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            throw new Error("Backend did not return JSON. Check Web App Deploy settings.");
        }
    } catch (err) {
        console.error("Error loading stock:", err);
        if (statusEl) statusEl.textContent = "ไม่สามารถโหลดสต็อกได้: " + err.message;
    }
}

// ====== ฟังก์ชันลูกค้าสั่งของ ======
async function submitOrder(name, orders) {
    const statusEl = document.getElementById("status");
    try {
        statusEl.className = 'loading show';
        statusEl.textContent = 'กำลังสั่งซื้อ...';

        // สร้าง orderId และคำนวณ total
        const orderId = 'ORD-' + Date.now().toString(36).toUpperCase();
        const date = new Date().toISOString();
        let totalAmount = 0;
        Object.values(orders || {}).forEach(it => totalAmount += Number(it.total || (it.qty * it.price) || 0));

        const payload = {
            type: 'order',
            orderId,
            date,
            customerName: name,
            orders,
            totalAmount,
            paidAmount: 0,
            payments: '[]',
            paid: false
        };

        // พยายามส่งแบบ JSON (fetch)
        const resp = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!resp.ok) throw new Error('Network response not OK: ' + resp.status);
        const json = await resp.json().catch(()=>null);
        if (json && json.success) {
            statusEl.className = 'success show';
            statusEl.textContent = 'สั่งซื้อสำเร็จ หมายเลข: ' + (json.orderId || orderId);
            // reset form if present
            const form = document.getElementById('orderForm');
            if (form) form.reset();
            return json;
        }

        // ถ้า server ตอบมาแต่ไม่ success -> show error and fallback
        statusEl.className = 'error show';
        statusEl.textContent = 'เซิร์ฟเวอร์ตอบกลับผิดพลาด — จะลองส่งแบบฟอร์มเป็น fallback...';
    } catch (err) {
        statusEl.className = 'error show';
        statusEl.textContent = 'ไม่สามารถส่งผ่าน AJAX: ' + (err.message || err.name || err) + ' — จะลองส่งแบบฟอร์มเป็น fallback...';
    }

    // Fallback: สร้าง form แล้ว submit (bypass CORS)
    try {
        const fallbackForm = document.createElement('form');
        fallbackForm.method = 'POST';
        fallbackForm.action = SCRIPT_URL;
        fallbackForm.target = '_blank';
        // copy payload into hidden inputs
        const payload = arguments[0]; // not used, rebuild below
        const finalPayload = {
            type: 'order',
            orderId: orderId || ('ORD-' + Date.now().toString(36).toUpperCase()),
            date: date || new Date().toISOString(),
            customerName: name,
            orders: JSON.stringify(orders),
            totalAmount: String(Object.values(orders || {}).reduce((s, it) => s + Number(it.total || (it.qty * it.price) || 0), 0)),
            paidAmount: '0',
            payments: '[]',
            paid: 'FALSE'
        };
        Object.entries(finalPayload).forEach(([k,v]) => {
            const inp = document.createElement('input');
            inp.type = 'hidden';
            inp.name = k;
            inp.value = v;
            fallbackForm.appendChild(inp);
        });
        document.body.appendChild(fallbackForm);
        fallbackForm.submit();
        setTimeout(()=>fallbackForm.remove(), 2000);
        return { success: true, fallback: true };
    } catch (e) {
        statusEl.className = 'error show';
        statusEl.textContent = 'ส่งคำสั่งซื้อไม่สำเร็จ (ทั้ง AJAX และ fallback): ' + (e.message || e);
        return { success: false, message: e.message || e };
    }
}

// ====== ฟังก์ชันโฮลดออเดอร์ทั้งหมด (สำหรับ index.html) ======
async function getOrders() {
    try {
        const res = await fetch(SCRIPT_URL + "?type=getOrders");
        if (!res.ok) throw new Error(`Network error: ${res.statusText}`);
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            return await res.json();
        } else {
            throw new Error("Backend did not return JSON. Check Web App Deploy settings.");
        }
    } catch (err) {
        console.error("Error loading orders:", err);
        return [];
    }
}

// ====== ฟังก์ชันอัปเดตสถานะการจ่ายเงิน (สำหรับ index.html) ======
async function setPaid(orderId, paidAmount, paymentMethod) {
    try {
        const payload = {
            type: "setPaid",
            orderId,
            paidAmount: Number(paidAmount),
            paymentMethod
        };
        const res = await fetch(SCRIPT_URL, {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error("Network error");
        const result = await res.json().catch(() => ({ success: false, message: "Invalid JSON response" }));
        return result;
    } catch (err) {
        return { success: false, message: err.message };
    }
}

// ****** ส่วนใหม่: Logic สำหรับหน้าตั้งค่าสินค้า (seller.html) ******

// ใช้ DOMContentLoaded เพื่อให้แน่ใจว่าองค์ประกอบ HTML ถูกโหลดแล้ว
document.addEventListener('DOMContentLoaded', () => {
    // สำหรับ seller.html
    const stockForm = document.getElementById('stockForm');
    const sellerTable = document.getElementById('seller-table');
    if (stockForm && sellerTable) {
        loadAndRenderSellerTable();
        stockForm.addEventListener('submit', e => {
            e.preventDefault();
            const inputs = document.querySelectorAll('.stock-input');
            const stockData = {};
            inputs.forEach(input => {
                const itemId = input.getAttribute('data-itemid');
                stockData[itemId] = input.value;
            });
            saveStock(stockData);
        });
    }
    // ... (order.html logic remains unchanged)
});

// ****** โค้ดที่ใช้สำหรับ seller.html: ใช้ script.js แทน ******

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
