// === ตั้งค่า URL ของ Google Apps Script Web App ===
const SCRIPT_URL = "https://script.google.com/macros/s/PUT_YOUR_SCRIPT_ID_HERE/exec"; 

// ====== ฟังก์ชันผู้ขาย: บันทึก stock ======
function saveStock(stockData) {
  fetch(SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify({ type: "setStock", data: stockData })
  })
  .then(res => res.text())
  .then(txt => document.getElementById("status").textContent = "✅ บันทึกสำเร็จ!")
  .catch(err => alert("เกิดข้อผิดพลาด: " + err));
}

// ====== ฟังก์ชันโหลด stock ======
async function loadStock() {
  const res = await fetch(SCRIPT_URL + "?type=getStock");
  return await res.json();
}

// ====== ฟังก์ชันลูกค้าสั่งของ ======
function submitOrder(name, orders) {
  fetch(SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify({ type: "order", name, orders })
  })
  .then(res => res.text())
  .then(txt => document.getElementById("status").textContent = "🧾 บันทึกคำสั่งซื้อแล้ว!")
  .catch(err => alert("เกิดข้อผิดพลาด: " + err));
}
