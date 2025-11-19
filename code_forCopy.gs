/**
 * Google Apps Script: อ่านชีท 'orderz' แล้วคืนค่า JSON ของคำสั่งซื้อ
 * - คัดลอกไฟล์นี้ไปไว้ใน code.gs ของ Google Sheets project แล้ว deploy เป็น Web App (Anyone, even anonymous)
 * - คืนค่า array ของ objects ที่มีฟิลด์: date (ISO), customerName, orders (object), totalAmount, paidAmount, payments (array), paid (bool)
 */

function doGet(e) {
  try {
    const orders = getOrdersFromSheet_('orderz');
    return ContentService.createTextOutput(JSON.stringify(orders)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrdersFromSheet_(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("Sheet '" + sheetName + "' not found");

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data[0].map(h => String(h || '').trim());
  const rows = data.slice(1);

  const results = rows.map(r => {
    const rowObj = {};
    r.forEach((cell, i) => rowObj[headers[i] || ('col' + i)] = cell);

    // helpers to read common alternative column names
    const get = (keys) => {
      for (let k of keys) {
        if (rowObj.hasOwnProperty(k) && rowObj[k] !== '' && rowObj[k] !== null && rowObj[k] !== undefined) return rowObj[k];
        const lower = Object.keys(rowObj).find(h => String(h).toLowerCase() === k.toLowerCase());
        if (lower && rowObj[lower] !== '' && rowObj[lower] !== null && rowObj[lower] !== undefined) return rowObj[lower];
      }
      return null;
    };

    const dateField = get(['date','timestamp','createdAt','datetime','time']);
    const dateISO = dateField ? new Date(dateField).toISOString() : new Date().toISOString();

    const customerName = get(['customerName','name','customer','buyer']) || 'ลูกค้าไม่ระบุ';

    const ordersRaw = get(['orders','items','order_details','order']) || '';
    const ordersObj = parseOrdersField_(ordersRaw);

    let totalAmount = Number(get(['totalAmount','total','amount'])) || 0;
    if (!totalAmount) {
      totalAmount = Object.values(ordersObj).reduce((s, d) => s + (Number(d.total) || (Number(d.qty || 0) * Number(d.price || 0))), 0);
    }

    const paidRaw = get(['paidAmount','paid']);
    let paidAmount = 0;
    if (paidRaw !== null) {
      // if paidRaw is boolean true -> treat as paidAmount = totalAmount
      if (typeof paidRaw === 'boolean') {
        paidAmount = paidRaw ? totalAmount : 0;
      } else {
        paidAmount = Number(paidRaw) || 0;
      }
    }

    const paymentsRaw = get(['payments','payment','payment_history']);
    const payments = safeParseJSON_(paymentsRaw) || (paymentsRaw ? [paymentsRaw] : []);

    const paidFlagRaw = get(['paid']);
    const paidFlag = (typeof paidFlagRaw === 'boolean') ? paidFlagRaw : (String(paidFlagRaw || '').toLowerCase() === 'true' || Number(paidFlagRaw) === 1);
    const paid = Boolean(paidFlag) || (paidAmount >= totalAmount && totalAmount > 0);

    return {
      date: dateISO,
      customerName: customerName,
      orders: ordersObj,
      totalAmount: totalAmount,
      paidAmount: paidAmount,
      payments: payments,
      paid: paid
    };
  });

  return results;
}

/** พยายาม parse orders field ที่รองรับหลายรูปแบบ */
function parseOrdersField_(raw) {
  if (!raw && raw !== 0) return {};

  // ถ้าเป็น object/array แล้วให้ normalize
  if (typeof raw === 'object') {
    if (Array.isArray(raw)) {
      // array of items -> try convert to { name: {qty,price,total} } if possible
      const obj = {};
      raw.forEach((it) => {
        if (typeof it === 'object' && it.name) {
          const name = it.name;
          const qty = Number(it.qty || it.quantity || 1) || 0;
          const price = Number(it.price || it.unitPrice || 0) || 0;
          obj[name] = { qty, price, total: Number(it.total) || qty * price };
        }
      });
      return obj;
    } else {
      const obj = {};
      Object.entries(raw).forEach(([k, v]) => {
        if (typeof v === 'object') {
          const qty = Number(v.qty || v.quantity || 0) || 0;
          const price = Number(v.price || v.unitPrice || 0) || 0;
          obj[k] = { qty, price, total: Number(v.total) || qty * price };
        } else {
          // primitive -> treat as qty
          const qty = Number(v) || 1;
          obj[k] = { qty, price: 0, total: 0 };
        }
      });
      return obj;
    }
  }

  // ถ้าเป็นสตริง พยายาม parse JSON ก่อน
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    const j = safeParseJSON_(trimmed);
    if (j && (typeof j === 'object')) return parseOrdersField_(j);

    // แยกรายการโดย ; or | or newline
    const items = {};
    const parts = trimmed.split(/[\n;|]/).map(p => p.trim()).filter(Boolean);
    parts.forEach(token => {
      // รูปแบบ name:qty:price
      const a = token.split(':').map(s => s.trim());
      if (a.length >= 3) {
        const name = a[0];
        const qty = Number(a[1]) || 0;
        const price = Number(a[2]) || 0;
        items[name] = { qty, price, total: qty * price };
        return;
      }
      // รูปแบบ "Name x2 @50"
      const m = token.match(/^(.+?)\s*x\s*(\d+)\s*@\s*(\d+(\.\d+)?)$/i);
      if (m) {
        const name = m[1].trim();
        const qty = Number(m[2]) || 0;
        const price = Number(m[3]) || 0;
        items[name] = { qty, price, total: qty * price };
        return;
      }
      // รูปแบบ "Name (qty)" or "Name qty"
      const mm = token.match(/^(.+?)\s*(?:\(|x|\s)\s*(\d+)\)?$/i);
      if (mm) {
        const name = mm[1].trim();
        const qty = Number(mm[2]) || 1;
        items[name] = { qty, price: 0, total: 0 };
        return;
      }
      // fallback: treat as single qty=1
      items[token] = { qty: 1, price: 0, total: 0 };
    });
    return items;
  }

  // fallback
  return {};
}

/** พยายาม parse JSON แบบปลอดภัย */
function safeParseJSON_(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') return v;
  if (typeof v !== 'string') return null;
  try {
    return JSON.parse(v);
  } catch (e) {
    // บางกรณี quotes แตกต่าง ให้ลองแก้เครื่องหมายคู่เป็น JSON
    const s = v.replace(/“|”/g, '"').replace(/‘|’/g, "'").replace(/([a-zA-Z0-9_]+)\s*:/g, '"$1":');
    try { return JSON.parse(s); } catch (e2) { return null; }
  }
}

/**
 * Google Apps Script: รองรับการ POST เพื่ออัปเดตสถานะการชำระเงินในชีท 'orderz'
 */

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const { orderId, paidAmount, paymentMethod } = payload;

    if (!orderId || isNaN(paidAmount) || !paymentMethod) {
      throw new Error('ข้อมูลไม่ครบถ้วน');
    }

    const sheetName = 'orderz';
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error("Sheet '" + sheetName + "' not found");

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const orderIdIndex = headers.indexOf('orderId');
    const paidAmountIndex = headers.indexOf('paidAmount');
    const paymentsIndex = headers.indexOf('payments');
    const paidIndex = headers.indexOf('paid');

    if (orderIdIndex === -1 || paidAmountIndex === -1 || paymentsIndex === -1 || paidIndex === -1) {
      throw new Error('คอลัมน์ที่จำเป็นไม่พบในชีท');
    }

    const rowIndex = data.findIndex(row => row[orderIdIndex] === orderId);
    if (rowIndex === -1) {
      throw new Error('ไม่พบคำสั่งซื้อที่มี orderId: ' + orderId);
    }

    const currentPaidAmount = Number(data[rowIndex][paidAmountIndex]) || 0;
    const newPaidAmount = currentPaidAmount + paidAmount;

    const currentPayments = JSON.parse(data[rowIndex][paymentsIndex] || '[]');
    currentPayments.push({
      date: new Date().toISOString(),
      amount: paidAmount,
      method: paymentMethod
    });

    const isFullyPaid = newPaidAmount >= Number(data[rowIndex][headers.indexOf('totalAmount')]);

    sheet.getRange(rowIndex + 1, paidAmountIndex + 1).setValue(newPaidAmount);
    sheet.getRange(rowIndex + 1, paymentsIndex + 1).setValue(JSON.stringify(currentPayments));
    sheet.getRange(rowIndex + 1, paidIndex + 1).setValue(isFullyPaid ? 'TRUE' : 'FALSE');

    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: error.message })).setMimeType(ContentService.MimeType.JSON);
  }
}
