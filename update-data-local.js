#!/usr/bin/env node

/**
 * Script: update-data-local.js
 * ใช้สำหรับ test อัปเดต JSON files ในเครื่อง
 * 
 * วิธีใช้: node update-data-local.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

// อ่าน JSON file
function readJSON(filename) {
  try {
    if (fs.existsSync(filename)) {
      const data = fs.readFileSync(filename, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error(`❌ Error reading ${filename}:`, err.message);
  }
  return null;
}

// เขียน JSON file
function writeJSON(filename, data) {
  try {
    fs.writeFileSync(filename, JSON.stringify(data, null, 2), 'utf8');
    console.log(`✓ Updated ${filename}`);
    return true;
  } catch (err) {
    console.error(`❌ Error writing ${filename}:`, err.message);
    return false;
  }
}

// แสดง menu
async function showMenu() {
  console.log('\n=== Update JSON Data Files ===\n');
  console.log('1. View stock-data.json');
  console.log('2. Add stock to an item');
  console.log('3. View orders-log.json');
  console.log('4. Clear all orders');
  console.log('5. Validate JSON files');
  console.log('6. Exit\n');
  
  const choice = await question('Select option (1-6): ');
  return choice.trim();
}

// แสดง stock
async function viewStock() {
  const stock = readJSON('./stock-data.json');
  if (stock) {
    console.log('\n📦 Current Stock:');
    console.log('─'.repeat(50));
    Object.entries(stock).forEach(([item, qty]) => {
      console.log(`${item.padEnd(30)} : ${qty} units`);
    });
    console.log('─'.repeat(50));
  }
}

// เพิ่ม stock
async function addStock() {
  const stock = readJSON('./stock-data.json');
  if (!stock) return;
  
  console.log('\nAvailable items:');
  const items = Object.keys(stock);
  items.forEach((item, idx) => {
    console.log(`${idx + 1}. ${item} (current: ${stock[item]})`);
  });
  
  const itemIdx = await question('\nSelect item number: ');
  const item = items[parseInt(itemIdx) - 1];
  
  if (!item) {
    console.log('❌ Invalid selection');
    return;
  }
  
  const qty = await question(`Add quantity to ${item}: `);
  const addQty = parseInt(qty);
  
  if (isNaN(addQty)) {
    console.log('❌ Invalid quantity');
    return;
  }
  
  stock[item] = parseInt(stock[item]) + addQty;
  if (writeJSON('./stock-data.json', stock)) {
    console.log(`✓ Added ${addQty} units to ${item}`);
    console.log(`  New quantity: ${stock[item]} units`);
  }
}

// แสดง orders
async function viewOrders() {
  const orders = readJSON('./orders-log.json');
  if (!orders || orders.length === 0) {
    console.log('\n📋 No orders found');
    return;
  }
  
  console.log(`\n📋 Total Orders: ${orders.length}\n`);
  
  let totalRevenue = 0;
  orders.slice(-5).forEach((order, idx) => {
    console.log(`Order #${orders.length - idx}:`);
    console.log(`  Customer: ${order.customerName}`);
    console.log(`  Date: ${new Date(order.date).toLocaleString('th-TH')}`);
    console.log(`  Amount: ${order.totalAmount} บาท`);
    console.log('  Items:');
    Object.entries(order.orders).forEach(([item, qty]) => {
      console.log(`    - ${item}: ${qty}`);
    });
    totalRevenue += order.totalAmount;
    console.log('');
  });
  
  console.log(`Total Revenue: ${totalRevenue} บาท`);
}

// ลบ orders
async function clearOrders() {
  const confirm = await question('🚨 Delete ALL orders? (yes/no): ');
  if (confirm.toLowerCase() === 'yes') {
    if (writeJSON('./orders-log.json', [])) {
      console.log('✓ All orders cleared');
    }
  } else {
    console.log('Cancelled');
  }
}

// ตรวจสอบ JSON
async function validateJSON() {
  console.log('\n🔍 Validating JSON files...\n');
  
  const stockFile = './stock-data.json';
  const ordersFile = './orders-log.json';
  
  // ตรวจสอบ stock
  const stock = readJSON(stockFile);
  if (stock && typeof stock === 'object') {
    console.log('✓ stock-data.json is valid');
    let errors = 0;
    Object.entries(stock).forEach(([item, qty]) => {
      if (typeof qty !== 'number' || qty < 0) {
        console.log(`  ⚠️ ${item}: Invalid quantity (${qty})`);
        errors++;
      }
    });
    if (errors === 0) console.log('  ✓ All quantities are valid');
  } else {
    console.log('❌ stock-data.json is invalid');
  }
  
  // ตรวจสอบ orders
  const orders = readJSON(ordersFile);
  if (Array.isArray(orders)) {
    console.log('✓ orders-log.json is valid');
    console.log(`  Total entries: ${orders.length}`);
  } else {
    console.log('❌ orders-log.json is invalid');
  }
}

// Main loop
async function main() {
  console.clear();
  console.log('🛍️  GitHub Pages Shop - Data Manager\n');
  
  let running = true;
  while (running) {
    const choice = await showMenu();
    
    switch (choice) {
      case '1':
        await viewStock();
        break;
      case '2':
        await addStock();
        break;
      case '3':
        await viewOrders();
        break;
      case '4':
        await clearOrders();
        break;
      case '5':
        await validateJSON();
        break;
      case '6':
        running = false;
        console.log('\n👋 Goodbye!');
        break;
      default:
        console.log('❌ Invalid option');
    }
  }
  
  rl.close();
}

main().catch(console.error);
