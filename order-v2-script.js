// order-v2-script.js
// UI for button-based +1 ordering. Depends on global loadStock() and submitOrder(name, orders)

document.addEventListener('DOMContentLoaded', () => {
  const itemsContainer = document.getElementById('itemsContainer');
  const totalEl = document.getElementById('total');
  const submitBtn = document.getElementById('submitBtn');
  const clearAllBtn = document.getElementById('clearAll');
  const nameInput = document.getElementById('customerName');
  const statusEl = document.getElementById('status');

  let stock = {};
  let counters = {}; // name -> qty selected

  function renderItems() {
    itemsContainer.innerHTML = '';
    Object.keys(stock).forEach(name => {
      const item = stock[name] || { price: 0, qty: 0 };
      const price = Number(item.price) || 0;
      const avail = Number(item.qty) || 0;

      const card = document.createElement('div');
      card.className = 'card';

      const meta = document.createElement('div'); meta.className = 'meta';
      const nm = document.createElement('div'); nm.className = 'name'; nm.textContent = name;
      const pr = document.createElement('div'); pr.className = 'price'; pr.textContent = price + '.-';
      meta.appendChild(nm); meta.appendChild(pr);

      const info = document.createElement('div'); info.style.fontSize = '12px'; info.style.color = '#666';
      info.textContent = `เหลือ ${avail} ชิ้น`;

  const controls = document.createElement('div'); controls.className = 'controls';
  const btnMinus = document.createElement('button'); btnMinus.className = 'ghost'; btnMinus.textContent = '-';
  const btnPlus = document.createElement('button'); btnPlus.className = 'btn'; btnPlus.textContent = '+';
  const cnt = document.createElement('div'); cnt.className = 'count'; cnt.textContent = '0';
  const btnClear = document.createElement('button'); btnClear.className = 'ghost'; btnClear.textContent = 'ล้าง';

      btnPlus.addEventListener('click', () => {
        const cur = counters[name] || 0;
        if (cur < avail) {
          counters[name] = cur + 1;
          cnt.textContent = counters[name];
          updateTotal();
        } else {
          // optionally feedback
          statusEl.className = 'show'; statusEl.textContent = `สินค้าหมด: ${name}`; setTimeout(()=>statusEl.className='',1500);
        }
      });

      btnMinus.addEventListener('click', () => {
        const cur = counters[name] || 0;
        if (cur > 0) {
          counters[name] = cur - 1;
          cnt.textContent = counters[name];
          updateTotal();
        }
      });

      btnClear.addEventListener('click', () => {
        counters[name] = 0; cnt.textContent = '0'; updateTotal();
      });

  controls.appendChild(btnMinus);
  controls.appendChild(btnPlus);
  controls.appendChild(cnt);
  controls.appendChild(btnClear);

      card.appendChild(meta);
      card.appendChild(info);
      card.appendChild(controls);

      itemsContainer.appendChild(card);
    });
  }

  function updateTotal() {
    let total = 0;
    Object.keys(counters).forEach(name => {
      const qty = counters[name] || 0;
      const price = (stock[name] && Number(stock[name].price)) ? Number(stock[name].price) : 0;
      total += qty * price;
    });
    totalEl.textContent = `รวม: ${total} บาท`;
  }

  function gatherOrders() {
    const out = {};
    Object.keys(counters).forEach(name => {
      const q = counters[name] || 0;
      if (q > 0) out[name] = q;
    });
    return out;
  }

  submitBtn.addEventListener('click', async () => {
    const customerName = (nameInput.value || '').trim() || 'ลูกค้าไม่ระบุ';
    const orders = gatherOrders();
    if (Object.keys(orders).length === 0) { alert('กรุณาเลือกสินค้าก่อนสั่ง'); return; }

    // disable UI while submitting
    submitBtn.disabled = true; submitBtn.textContent = 'กำลังส่ง...';
    try {
      await submitOrder(customerName, orders);
      // on success, reset counters and re-render (loadStockAndRenderMenu will update stock, but we also reload local stock)
      const newStock = await loadStock();
      stock = newStock; counters = {}; renderItems(); updateTotal();
    } catch (e) {
      console.error(e);
      alert('เกิดข้อผิดพลาดในการส่งคำสั่งซื้อ');
    } finally {
      submitBtn.disabled = false; submitBtn.textContent = 'ยืนยันการสั่งซื้อ';
    }
  });

  clearAllBtn.addEventListener('click', () => { counters = {}; renderItems(); updateTotal(); });

  // initial load
  (async () => {
    itemsContainer.textContent = 'กำลังโหลดรายการ...';
    try {
      const loaded = await loadStock();
      stock = loaded || {};
      // ensure counters keys
      Object.keys(stock).forEach(k => counters[k] = 0);
      renderItems(); updateTotal();
    } catch (err) {
      console.error('Cannot load stock for v2 page', err);
      itemsContainer.innerHTML = '<p style="color:red">ไม่สามารถโหลดรายการสินค้าได้</p>';
    }
  })();
});
