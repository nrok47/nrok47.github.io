function doGet(e) {
  try {
    const type = (e && e.parameter && e.parameter.type) ? String(e.parameter.type).toLowerCase() : '';
    let result;
    if (type === 'getseller' || type === 'getstock') {
      result = getSellerFromSheet_('seller');
    } else {
      result = getOrdersFromSheet_('orderz');
    }
    return setCORSHeaders_(ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON));
  } catch (err) {
    return setCORSHeaders_(ContentService.createTextOutput(JSON.stringify({ success: false, message: err.message })).setMimeType(ContentService.MimeType.JSON));
  }
}
function getSellerFromSheet_(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  const vals = sheet.getDataRange().getValues();
  if (!vals || vals.length < 2) return [];
  const headers = vals[0].map(h => String(h || '').trim());
  const rows = vals.slice(1);
  return rows.map(r => {
    const obj = {};
    r.forEach((cell, i) => obj[headers[i] || `col${i}`] = cell);
    return obj;
  });
}

function getOrdersFromSheet_(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error(`Sheet '${sheetName}' not found`);

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data[0].map(h => String(h || '').trim());
  const rows = data.slice(1);

  return rows.map((r, idx) => {
    const rowObj = {};
    r.forEach((cell, i) => rowObj[headers[i] || `col${i}`] = cell);

    const get = (keys) => keys.map(k => rowObj[k] || rowObj[Object.keys(rowObj).find(h => h.toLowerCase() === k.toLowerCase())]).find(v => v != null);

    const dateISO = new Date(get(['date', 'timestamp', 'createdAt', 'datetime', 'time']) || new Date()).toISOString();
    const customerName = get(['customerName', 'name', 'customer', 'buyer']) || 'ลูกค้าไม่ระบุ';
    const ordersObj = parseOrdersField_(get(['orders', 'items', 'order_details', 'order']) || '');
    const totalAmount = Number(get(['totalAmount', 'total', 'amount'])) || Object.values(ordersObj).reduce((s, d) => s + (d.total || d.qty * d.price || 0), 0);
    const paidAmount = Number(get(['paidAmount', 'paid'])) || 0;
    const payments = safeParseJSON_(get(['payments', 'payment', 'payment_history'])) || [];
    const paid = Boolean(get(['paid'])) || paidAmount >= totalAmount;

    // include orderId if present in sheet headers, and always include rowNumber (sheet row)
    const orderIdVal = get(['orderId', 'orderID', 'id']) || null;
    const rowNumber = idx + 2; // sheet row (header is row 1)

    return { date: dateISO, customerName, orders: ordersObj, totalAmount, paidAmount, payments, paid, orderId: orderIdVal, rowNumber };
  });
}

function parseOrdersField_(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return Array.isArray(raw) ? raw.reduce((o, it) => ({ ...o, [it.name]: { qty: it.qty || 1, price: it.price || 0, total: it.total || it.qty * it.price } }), {}) : raw;
  if (typeof raw === 'string') {
    const items = {};
    raw.split(/[\n;|]/).map(p => p.trim()).filter(Boolean).forEach(token => {
      const [name, qty, price] = token.split(':').map(s => s.trim());
      if (qty && price) items[name] = { qty: Number(qty), price: Number(price), total: Number(qty) * Number(price) };
      else if (token.match(/^(.+?)\s*x\s*(\d+)\s*@\s*(\d+)/)) {
        const [, n, q, p] = token.match(/^(.+?)\s*x\s*(\d+)\s*@\s*(\d+)/);
        items[n] = { qty: Number(q), price: Number(p), total: Number(q) * Number(p) };
      } else items[token] = { qty: 1, price: 0, total: 0 };
    });
    return items;
  }
  return {};
}

function safeParseJSON_(v) {
  try { return JSON.parse(v); } catch { return null; }
}

function doGet(e) {
  try {
    const type = (e && e.parameter && e.parameter.type) ? String(e.parameter.type).toLowerCase() : '';
    let result;
    if (type === 'getseller' || type === 'getstock') {
      result = getSellerFromSheet_('seller');
    } else {
      result = getOrdersFromSheet_('orderz');
    }
    return setCORSHeaders_(ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON));
  } catch (err) {
    return setCORSHeaders_(ContentService.createTextOutput(JSON.stringify({ success: false, message: err.message })).setMimeType(ContentService.MimeType.JSON));
  }
}

function doOptions(e) {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
}

function setCORSHeaders_(output) {
  return output.setHeaders({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
}

function doPost(e) {
  try {
    let payload = {};
    // robust: รองรับทั้ง JSON และ form-urlencoded
    const contentType = (e.postData && (e.postData.type || e.postData.contentType || ''));
    if (contentType && contentType.toLowerCase().indexOf('application/json') !== -1) {
      // JSON body
      payload = JSON.parse(e.postData.contents || '{}');
    } else if (e.postData && e.postData.contents) {
      // form-urlencoded
      const raw = e.postData.contents;
      raw.split('&').forEach(pair => {
        if (!pair) return;
        const idx = pair.indexOf('=');
        const key = idx === -1 ? decodeURIComponent(pair) : decodeURIComponent(pair.slice(0, idx));
        const val = idx === -1 ? '' : decodeURIComponent(pair.slice(idx + 1)).replace(/\+/g, ' ');
        payload[key] = val;
      });
      Object.assign(payload, e.parameter || {});
    } else {
      payload = e.parameter || {};
    }

    // --- NEW: seller stock update ---
    if (payload.type === 'updateStock' && payload.stock && typeof payload.stock === 'object') {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('seller');
      if (!sheet) throw new Error("Sheet 'seller' not found");
      const data = sheet.getDataRange().getValues();
      const headers = data[0].map(h => String(h || '').trim());
      const idIdx = headers.indexOf('itemId');
      const qtyIdx = headers.indexOf('reorderLevel') !== -1 ? headers.indexOf('reorderLevel') : headers.indexOf('qty');
      if (idIdx === -1 || qtyIdx === -1) throw new Error('itemId or stock column not found');
      let updated = 0;
      Object.entries(payload.stock).forEach(([itemId, qty]) => {
        const rowIdx = data.findIndex((row, i) => i > 0 && String(row[idIdx]) === String(itemId));
        if (rowIdx > 0) {
          sheet.getRange(rowIdx + 1, qtyIdx + 1).setValue(Number(qty));
          updated++;
        }
      });
      return setCORSHeaders_(ContentService.createTextOutput(JSON.stringify({ success: true, updated })).setMimeType(ContentService.MimeType.JSON));
    }

    // If request includes customerName or orders => create new order
    if (payload.customerName || payload.orders || payload.items || payload.order) {
      return setCORSHeaders_(createOrder_(payload));
    }

    // Otherwise treat as payment update
    const orderIdInput = payload.orderId || null;
    const rowNumberInput = payload.rowNumber ? Number(payload.rowNumber) : null;
    const paidAmount = Number(payload.paidAmount || 0);
    const paymentMethod = payload.paymentMethod;

    if (!orderIdInput && !rowNumberInput) {
      throw new Error('ข้อมูลไม่ครบถ้วน: ต้องมี orderId หรือ rowNumber');
    }

    if (isNaN(paidAmount) || paidAmount <= 0) {
      throw new Error('ข้อมูลไม่ครบถ้วน: ต้องระบุ paidAmount และต้องเป็นตัวเลขที่มากกว่า 0');
    }

    if (!paymentMethod) {
      throw new Error('ข้อมูลไม่ครบถ้วน: ต้องระบุ paymentMethod');
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('orderz');
    if (!sheet) throw new Error("Sheet 'orderz' not found");

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const orderIdIndex = headers.indexOf('orderId');
    const paidAmountIndex = headers.indexOf('paidAmount');
    const paymentsIndex = headers.indexOf('payments');
    const paidIndex = headers.indexOf('paid');
    const totalAmountIndex = headers.indexOf('totalAmount');

    if (paidAmountIndex === -1 || paymentsIndex === -1 || paidIndex === -1 || totalAmountIndex === -1) {
      throw new Error('คอลัมน์ที่จำเป็น (paidAmount, payments, paid, totalAmount) ไม่พบในชีท');
    }

    let rowIndex = -1;
    if (orderIdInput) {
      rowIndex = data.findIndex(row => String(row[orderIdIndex]) === String(orderIdInput));
      if (rowIndex === -1) {
        throw new Error('ไม่พบคำสั่งซื้อที่ระบุ (ตรวจสอบ orderId)');
      }
    } else if (rowNumberInput) {
      // rowNumber is expected to be the sheet row number (1-based). data array is 0-based including header row
      rowIndex = rowNumberInput - 1;
      if (rowIndex < 1 || rowIndex >= data.length) {
        throw new Error('rowNumber นอกช่วงข้อมูล');
      }
    }

    const currentPaidAmount = Number(data[rowIndex][paidAmountIndex]) || 0;
    const newPaidAmount = currentPaidAmount + paidAmount;
    const currentPayments = safeParseJSON_(data[rowIndex][paymentsIndex]) || [];
    currentPayments.push({ date: new Date().toISOString(), amount: paidAmount, method: paymentMethod });

    sheet.getRange(rowIndex + 1, paidAmountIndex + 1).setValue(newPaidAmount);
    sheet.getRange(rowIndex + 1, paymentsIndex + 1).setValue(JSON.stringify(currentPayments));
    sheet.getRange(rowIndex + 1, paidIndex + 1).setValue(newPaidAmount >= Number(data[rowIndex][totalAmountIndex]) ? 'TRUE' : 'FALSE');

    return setCORSHeaders_(ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON));
  } catch (error) {
    return setCORSHeaders_(ContentService.createTextOutput(JSON.stringify({ success: false, message: error.message })).setMimeType(ContentService.MimeType.JSON));
  }
}
// ฟังก์ชันสร้าง order ใหม่และบันทึกลง sheet
function createOrder_(payload) {
  const sheetName = 'orderz';
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("Sheet '" + sheetName + "' not found");

  const data = sheet.getDataRange().getValues();
  let headers = data.length ? data[0].map(h => String(h || '').trim()) : [];

  const required = ['orderId','date','customerName','orders','totalAmount','paidAmount','payments','paid'];
  required.forEach(h => { if (headers.indexOf(h) === -1) { headers.push(h); sheet.getRange(1, headers.length).setValue(h); }});
  // rebuild header map
  const idxMap = {};
  headers.forEach((h,i)=> idxMap[h]=i);

  const orderId = payload.orderId || ('ORD-' + Date.now().toString(36).toUpperCase());
  const date = payload.date || new Date().toISOString();
  const customerName = payload.customerName || 'ลูกค้าไม่ระบุ';
  let ordersRaw = payload.orders || payload.items || payload.order || '';
  if (typeof ordersRaw === 'object') ordersRaw = JSON.stringify(ordersRaw);

  // --- NEW: parse orders by itemId and lookup seller prices ---
  // seller lookup helper (reads seller sheet once)
  function buildSellerMap_() {
    const s = ss.getSheetByName('seller');
    if (!s) return {};
    const vals = s.getDataRange().getValues();
    if (!vals || vals.length < 2) return {};
    const hdr = vals[0].map(c => String(c || '').trim());
    const idIdx = hdr.indexOf('itemId') !== -1 ? hdr.indexOf('itemId') : 0;
    const nameIdx = hdr.indexOf('name') !== -1 ? hdr.indexOf('name') : 1;
    const priceIdx = hdr.indexOf('price') !== -1 ? hdr.indexOf('price') : 2;
    const map = {};
    for (let i=1;i<vals.length;i++){
      const row = vals[i];
      const id = String(row[idIdx] || '').trim();
      if (!id) continue;
      map[id] = { name: String(row[nameIdx]||'').trim(), price: Number(row[priceIdx]||0) };
    }
    return map;
  }

  const sellerMap = buildSellerMap_();

  // parse ordersRaw into ordersObj: { itemId: { name, qty, price, total } }
  let ordersObj = {};
  try {
    // if ordersRaw is JSON object string, try parse it first
    const maybe = safeParseJSON_(ordersRaw);
    if (maybe && typeof maybe === 'object') {
      // normalize entries if they look like { name:{qty,price} } or { itemId:{...} }
      Object.entries(maybe).forEach(([k,v])=>{
        const qty = Number(v.qty||v.quantity||0) || 0;
        const price = Number(v.price||v.unitPrice||0) || (sellerMap[k] ? sellerMap[k].price : 0);
        ordersObj[k] = { name: v.name || (sellerMap[k] && sellerMap[k].name) || k, qty, price, total: Number(v.total) || qty * price };
      });
    } else if (String(ordersRaw).trim()) {
      const parts = String(ordersRaw).split(/[\n;|,]/).map(p=>p.trim()).filter(Boolean);
      parts.forEach(token=>{
        // support formats:
        // ITEMID:qty[:price]
        // name:qty:price (fallback)
        const a = token.split(':').map(x=>x.trim());
        if (a.length >= 2 && /^[A-Z0-9\-]+$/i.test(a[0])) {
          const itemId = a[0];
          const qty = Number(a[1]) || 0;
          const price = (a[2]!==undefined) ? Number(a[2]) : (sellerMap[itemId] ? sellerMap[itemId].price : 0);
          const name = (sellerMap[itemId] && sellerMap[itemId].name) || itemId;
          ordersObj[itemId] = { name, qty, price, total: qty * price };
        } else if (a.length >= 3) {
          // fallback name:qty:price
          const name = a[0];
          const qty = Number(a[1])||0;
          const price = Number(a[2])||0;
          ordersObj[name] = { name, qty, price, total: qty*price };
        } else {
          // single token — treat as item name qty=1 price=0
          const name = token;
          ordersObj[name] = { name, qty:1, price:0, total:0 };
        }
      });
    }
  } catch(e){
    ordersObj = {};
  }

  // compute totalAmount if not provided
  let totalAmount = Number(payload.totalAmount || 0);
  if (!totalAmount) {
    totalAmount = Object.values(ordersObj).reduce((s,d)=> s + (Number(d.total)|| (Number(d.qty||0)*Number(d.price||0)) ), 0);
  }

  const paidAmount = Number(payload.paidAmount || 0);
  const payments = payload.payments ? (typeof payload.payments === 'string' ? payload.payments : JSON.stringify(payload.payments)) : '[]';
  const paidFlag = payload.paid ? (String(payload.paid).toLowerCase()==='true') : (paidAmount >= totalAmount && totalAmount>0);

  // store orders column as JSON string (normalized)
  const ordersToStore = JSON.stringify(ordersObj);

  const row = new Array(headers.length).fill('');
  row[idxMap['orderId']] = orderId;
  row[idxMap['date']] = date;
  row[idxMap['customerName']] = customerName;
  row[idxMap['orders']] = ordersToStore;
  row[idxMap['totalAmount']] = totalAmount;
  row[idxMap['paidAmount']] = paidAmount;
  row[idxMap['payments']] = payments;
  row[idxMap['paid']] = paidFlag ? 'TRUE' : 'FALSE';

  sheet.appendRow(row);

  // --- NEW: decrement seller 'reorderLevel' (or 'qty') according to ordered quantities ---
  try {
    const sellerSheet = ss.getSheetByName('seller');
    if (sellerSheet) {
      const svals = sellerSheet.getDataRange().getValues();
      if (svals && svals.length >= 2) {
        const shdr = svals[0].map(c => String(c || '').trim());
        const idIdx = shdr.indexOf('itemId') !== -1 ? shdr.indexOf('itemId') : 0;
        const nameIdx = shdr.indexOf('name') !== -1 ? shdr.indexOf('name') : 1;
        const reorderIdx = shdr.indexOf('reorderLevel') !== -1 ? shdr.indexOf('reorderLevel') : (shdr.indexOf('qty') !== -1 ? shdr.indexOf('qty') : -1);
        const lastUpdatedIdx = shdr.indexOf('lastUpdated') !== -1 ? shdr.indexOf('lastUpdated') : -1;

        // build maps for quick lookup
        const idToRow = {};
        const nameToId = {};
        for (let i = 1; i < svals.length; i++) {
          const row = svals[i];
          const id = String(row[idIdx] || '').trim();
          const nm = String(row[nameIdx] || '').trim();
          if (id) idToRow[id] = i + 1; // sheet row number
          if (nm) nameToId[nm] = id || null;
        }

        if (reorderIdx !== -1) {
          Object.entries(ordersObj).forEach(([key, it]) => {
            // prefer itemId match; otherwise try match by name
            let itemId = null;
            if (sellerMap[key]) itemId = key;
            else if (nameToId[key]) itemId = nameToId[key];
            else {
              const possible = Object.keys(idToRow).find(k => k.toLowerCase() === key.toLowerCase());
              if (possible) itemId = possible;
            }

            if (!itemId) return; // can't map this order item to seller row
            const rowNumber = idToRow[itemId];
            if (!rowNumber) return;
            const currentVal = Number(sellerSheet.getRange(rowNumber, reorderIdx + 1).getValue()) || 0;
            const reduceBy = Number(it.qty || 0);
            const newVal = Math.max(0, currentVal - reduceBy);
            sellerSheet.getRange(rowNumber, reorderIdx + 1).setValue(newVal);
            if (lastUpdatedIdx !== -1) sellerSheet.getRange(rowNumber, lastUpdatedIdx + 1).setValue(new Date().toISOString());
          });
        }
      }
    }
  } catch (e) {
    // non-fatal: if updating seller stock fails, don't block order creation
    console.error('Failed updating seller stock:', e.message || e);
  }

  return ContentService.createTextOutput(JSON.stringify({ success: true, orderId })).setMimeType(ContentService.MimeType.JSON);
}
