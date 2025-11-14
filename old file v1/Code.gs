// A. กำหนดตัวแปรและโครงสร้างเมนู (คงเดิม)
const MENU_ITEMS = [
  'สลัดผัก (40.-)', 
  'น้ำเต้าหู้ (15.-)', 
  'น้ำข้าวโพด (15.-)', 
  'สลัดโรลไก่ (55.-)', 
  'แซนด์วิชไข่ (45.-)'
];
const PRICES = [40, 15, 15, 55, 45];
const STOCK_SHEET_NAME = 'Config';
const ORDER_SHEET_NAME = 'Orders';

// **สำคัญ: วาง Web App URL ที่คุณ Deploy แล้วไว้ที่นี่**
// (URL ที่ได้จากการ Deploy Web App ของ Code.gs ชุดนี้)
const WEB_APP_URL = 'YOUR_WEB_APP_URL_HERE'; 

// =============================================================
// B. ฟังก์ชัน Web App หลัก: ใช้แสดงผล (doGet - สำหรับดึง Stock)
// =============================================================

function doGet(e) {
  const page = e.parameter.page; 
  if (page === 'seller') {
    return showSellerStockForm(e); 
  } else if (page === 'stock_data') {
  // 1. ฟังก์ชันใหม่: ส่งข้อมูล Stock และ Price กลับไปเป็น JSON ให้ seller.html (บน GitHub)
    return getStockDataAsJson();
  } else {
  // ใช้สำหรับส่งโค้ด seller.html เป็นค่าเริ่มต้น (ถ้ายังไม่ได้ใช้ GitHub Pages)
    // แต่เมื่อใช้ GitHub Pages แล้ว ลิงก์หลักนี้อาจไม่ได้ใช้
    return HtmlService.createHtmlOutput('Access this page from your GitHub.io URL');
  }
}
/*
function getStockDataAsJson() {
  const stockSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(STOCK_SHEET_NAME);
  let stockData = [];
  
  for (let i = 0; i < MENU_ITEMS.length; i++) {
    const stock = stockSheet.getRange(i + 2, 3).getValue() || 0; 
    stockData.push({
      name: MENU_ITEMS[i],
      price: PRICES[i],
      stock: stock
    });
  }
  
  // แปลงข้อมูลเป็น JSON และตั้งค่า Header เพื่อให้เบราว์เซอร์อ่านได้
  return ContentService.createTextOutput(JSON.stringify(stockData))
      .setMimeType(ContentService.MimeType.JSON);
}
*/
function getStockDataAsJson() {
  const stockSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(STOCK_SHEET_NAME);
  let stockData = [];
  
  for (let i = 0; i < MENU_ITEMS.length; i++) {
    const stock = stockSheet.getRange(i + 2, 3).getValue() || 0; 
    stockData.push({
      name: MENU_ITEMS[i],
      price: PRICES[i],
      stock: stock
    });
  }
  
  // ****** จุดที่ต้องแก้ไข/เพิ่ม: เพิ่ม Header CORS ******
  const jsonOutput = ContentService.createTextOutput(JSON.stringify(stockData))
      .setMimeType(ContentService.MimeType.JSON);
      
  // อนุญาตให้ทุกเว็บไซต์ (Origin: *) เข้าถึงข้อมูลนี้ได้
  jsonOutput.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); // (ไม่เกี่ยวกับ CORS โดยตรง แต่ช่วยเรื่อง iframe)
  
  // ส่วนสำคัญที่สุดสำหรับ CORS
  const response = jsonOutput.setContent(jsonOutput.getContent()).setMimeType(ContentService.MimeType.JSON);
  response.setHeader('Access-Control-Allow-Origin', '*'); // อนุญาตให้ทุก Origin เข้าถึงได้

  return response;
  // ******************************************************
}


// =============================================================
// C. ฟังก์ชัน Web App สำหรับรับข้อมูล (doPost) 
//    * ใช้รับคำสั่งสั่งซื้อจาก seller.html (บน GitHub)
// =============================================================

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    // เรียกใช้ฟังก์ชันบันทึกและตัด Stock
    const result = recordOrder(data); 

  // ส่งผลลัพธ์กลับไปเป็น JSON ให้ seller.html
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: result }))
        .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.message }))
        .setMimeType(ContentService.MimeType.JSON);
  }
}


// =============================================================
// D. ฟังก์ชันบันทึกออเดอร์และตัด STOCK (recordOrder)
//    * เปลี่ยนให้รับข้อมูลจาก doPost แทน formObject
// =============================================================

function recordOrder(data) {
  const orderSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ORDER_SHEET_NAME);
  const stockSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(STOCK_SHEET_NAME);
  
  const customerName = data.customerName;
  let totalAmount = 0;
  let orderDetails = [];
  let orderedItems = 0;

  for (let i = 0; i < PRICES.length; i++) {
    const qty = parseInt(data['qty' + i]) || 0; 
    totalAmount += qty * PRICES[i];
    orderDetails.push(qty);
    if (qty > 0) orderedItems++;
  }

  if (orderedItems === 0) {
    throw new Error('กรุณาเลือกรายการสั่งซื้ออย่างน้อย 1 รายการ');
  }
  if (!customerName) {
    throw new Error('กรุณาใส่ชื่อผู้สั่ง');
  }

  // ... (ส่วนการบันทึก Sheet และตัด Stock เหมือนเดิม)
  const timestamp = new Date().getTime();
  const refCode = (timestamp % 100000) + 1;
  const totalAmountRounded = totalAmount; 

  const newRow = [new Date(), customerName, totalAmountRounded.toFixed(2), refCode, ...orderDetails];
  orderSheet.appendRow(newRow);
  
  // ตัด STOCK
  for (let i = 0; i < orderDetails.length; i++) {
    const orderedQty = orderDetails[i];
    if (orderedQty > 0) {
      const stockCell = stockSheet.getRange(i + 2, 3);
      const currentStock = stockCell.getValue() || 0;
      const newStock = currentStock - orderedQty;
      stockCell.setValue(newStock); 
    }
  }
  
  return `สั่งซื้อสำเร็จ! ยอดรวมที่ต้องชำระ: ${totalAmountRounded.toFixed(2)} บาท (รหัสอ้างอิง: ${refCode})`;
}

// ... (ฟังก์ชันอื่น ๆ เช่น showSellerStockForm, saveStockConfig, onOpen ยังคงเดิม)
