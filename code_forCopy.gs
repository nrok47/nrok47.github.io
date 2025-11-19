function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify(getOrdersFromSheet_('orderz')))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrdersFromSheet_(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error(`Sheet '${sheetName}' not found`);

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data[0].map(h => String(h || '').trim());
  const rows = data.slice(1);

  return rows.map(r => {
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

    return { date: dateISO, customerName, orders: ordersObj, totalAmount, paidAmount, payments, paid };
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

function doPost(e) {
  try {
    let payload;
    if (e.postData && e.postData.type === 'application/json') {
      payload = JSON.parse(e.postData.contents);
    } else {
      // form-encoded: use e.parameter
      payload = e.parameter || {};
    }
    const orderId = payload.orderId;
    const paidAmount = Number(payload.paidAmount || 0);
    const paymentMethod = payload.paymentMethod;
    if (!orderId || isNaN(paidAmount) || !paymentMethod) throw new Error('ข้อมูลไม่ครบถ้วน');

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('orderz');
    if (!sheet) throw new Error("Sheet 'orderz' not found");

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const orderIdIndex = headers.indexOf('orderId');
    const paidAmountIndex = headers.indexOf('paidAmount');
    const paymentsIndex = headers.indexOf('payments');
    const paidIndex = headers.indexOf('paid');
    const totalAmountIndex = headers.indexOf('totalAmount');

    if (orderIdIndex === -1) throw new Error('คอลัมน์ orderId ไม่พบ');

    const rowIndex = data.findIndex(row => String(row[orderIdIndex]) == String(orderId));
    if (rowIndex === -1) throw new Error('ไม่พบคำสั่งซื้อที่มี orderId: ' + orderId);

    const currentPaidAmount = Number(data[rowIndex][paidAmountIndex]) || 0;
    const newPaidAmount = currentPaidAmount + paidAmount;
    const currentPayments = safeParseJSON_(data[rowIndex][paymentsIndex]) || [];
    currentPayments.push({ date: new Date().toISOString(), amount: paidAmount, method: paymentMethod });

    sheet.getRange(rowIndex + 1, paidAmountIndex + 1).setValue(newPaidAmount);
    sheet.getRange(rowIndex + 1, paymentsIndex + 1).setValue(JSON.stringify(currentPayments));
    sheet.getRange(rowIndex + 1, paidIndex + 1).setValue(newPaidAmount >= Number(data[rowIndex][totalAmountIndex]) ? 'TRUE' : 'FALSE');

    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: error.message })).setMimeType(ContentService.MimeType.JSON);
  }
}
