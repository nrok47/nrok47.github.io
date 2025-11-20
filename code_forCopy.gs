// Google Apps Script สำหรับโปรเจคขายของ (seller/order/index)
// Sheet: 'seller', 'orderz'
// Web App: Deploy as 'Anyone, even anonymous'

function doGet(e) {
  const type = (e && e.parameter && e.parameter.type) ? String(e.parameter.type).toLowerCase() : '';
  if (type === 'getseller') {
    return ContentService.createTextOutput(JSON.stringify(getSeller_())).setMimeType(ContentService.MimeType.JSON);
  }
  // default: getOrders
  return ContentService.createTextOutput(JSON.stringify(getOrders_())).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    let payload = {};
    const contentType = (e.postData && (e.postData.type || e.postData.contentType || ''));
    if (contentType && contentType.toLowerCase().indexOf('application/json') !== -1) {
      payload = JSON.parse(e.postData.contents || '{}');
    } else if (e.postData && e.postData.contents) {
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

    // อัปเดต stock
    if (payload.type === 'updateStock' && payload.stock) {
      return updateStock_(payload.stock);
    }
    // สร้าง order
    if (payload.customerName && payload.orders) {
      return createOrder_(payload);
    }
    // เก็บเงิน
    if (payload.orderId && payload.paidAmount && payload.paymentMethod) {
      return updatePayment_(payload);
    }
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Unknown request' })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

function getSeller_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('seller');
  if (!sheet) return [];
  const vals = sheet.getDataRange().getValues();
  if (!vals || vals.length < 2) return [];
  const headers = vals[0].map(h => String(h || '').trim());
  return vals.slice(1).map(r => {
    const obj = {};
    r.forEach((cell, i) => obj[headers[i] || `col${i}`] = cell);
    return obj;
  });
}

function updateStock_(stock) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('seller');
  if (!sheet) throw new Error("Sheet 'seller' not found");
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h || '').trim());
  const idIdx = headers.indexOf('itemId');
  const stockIdx = headers.indexOf('stock') !== -1 ? headers.indexOf('stock') : headers.indexOf('reorderLevel');
  if (idIdx === -1 || stockIdx === -1) throw new Error('itemId or stock column not found');
  let updated = 0;
  Object.entries(stock).forEach(([itemId, qty]) => {
    const rowIdx = data.findIndex((row, i) => i > 0 && String(row[idIdx]) === String(itemId));
    if (rowIdx > 0) {
      sheet.getRange(rowIdx + 1, stockIdx + 1).setValue(Number(qty));
      updated++;
    }
  });
  return ContentService.createTextOutput(JSON.stringify({ success: true, updated })).setMimeType(ContentService.MimeType.JSON);
}

function createOrder_(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('orderz');
  if (!sheet) throw new Error("Sheet 'orderz' not found");
  const data = sheet.getDataRange().getValues();
  const headers = data.length ? data[0].map(h => String(h || '').trim()) : [];
  const idxMap = {};
  headers.forEach((h,i)=> idxMap[h]=i);
  const orderId = 'ORD-' + Date.now().toString(36).toUpperCase();
  const date = new Date().toISOString();
  const customerName = payload.customerName || 'ลูกค้าไม่ระบุ';
  const orders = JSON.stringify(payload.orders);
  const totalAmount = Number(payload.totalAmount || 0);
  const paidAmount = 0;
  const payments = '[]';
  const paid = 'FALSE';
  const row = new Array(headers.length).fill('');
  row[idxMap['orderId']] = orderId;
  row[idxMap['date']] = date;
  row[idxMap['customerName']] = customerName;
  row[idxMap['orders']] = orders;
  row[idxMap['totalAmount']] = totalAmount;
  row[idxMap['paidAmount']] = paidAmount;
  row[idxMap['payments']] = payments;
  row[idxMap['paid']] = paid;
  sheet.appendRow(row);
  return ContentService.createTextOutput(JSON.stringify({ success: true, orderId })).setMimeType(ContentService.MimeType.JSON);
}

function getOrders_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('orderz');
  if (!sheet) return [];
  const vals = sheet.getDataRange().getValues();
  if (!vals || vals.length < 2) return [];
  const headers = vals[0].map(h => String(h || '').trim());
  return vals.slice(1).map((r, idx) => {
    const obj = {};
    r.forEach((cell, i) => obj[headers[i] || `col${i}`] = cell);
    obj.orders = safeParseJSON_(obj.orders);
    obj.payments = safeParseJSON_(obj.payments);
    obj.paid = String(obj.paid).toLowerCase() === 'true' || String(obj.paid).toUpperCase() === 'TRUE';
    obj.rowNumber = idx + 2;
    return obj;
  });
}

function updatePayment_(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('orderz');
  if (!sheet) throw new Error("Sheet 'orderz' not found");
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h || '').trim());
  const orderIdIdx = headers.indexOf('orderId');
  const paidAmountIdx = headers.indexOf('paidAmount');
  const paymentsIdx = headers.indexOf('payments');
  const paidIdx = headers.indexOf('paid');
  const totalAmountIdx = headers.indexOf('totalAmount');
  let rowIdx = data.findIndex((row, i) => i > 0 && String(row[orderIdIdx]) === String(payload.orderId));
  if (rowIdx === -1 && payload.rowNumber) rowIdx = Number(payload.rowNumber) - 1;
  if (rowIdx <= 0) throw new Error('Order not found');
  const currentPaid = Number(data[rowIdx][paidAmountIdx]) || 0;
  const newPaid = currentPaid + Number(payload.paidAmount);
  let payments = safeParseJSON_(data[rowIdx][paymentsIdx]) || [];
  payments.push({ date: new Date().toISOString(), amount: Number(payload.paidAmount), method: payload.paymentMethod });
  sheet.getRange(rowIdx + 1, paidAmountIdx + 1).setValue(newPaid);
  sheet.getRange(rowIdx + 1, paymentsIdx + 1).setValue(JSON.stringify(payments));
  const totalAmount = Number(data[rowIdx][totalAmountIdx]) || 0;
  sheet.getRange(rowIdx + 1, paidIdx + 1).setValue(newPaid >= totalAmount ? 'TRUE' : 'FALSE');
  return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
}

function safeParseJSON_(v) {
  try { return JSON.parse(v); } catch { return null; }
}
