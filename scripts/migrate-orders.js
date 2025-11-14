const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const ordersPath = path.join(repoRoot, 'orders-log.json');
const stockPath = path.join(repoRoot, 'stock-data.json');

function loadJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return null;
  }
}

function saveJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
}

function parsePriceFromName(name) {
  if (!name || typeof name !== 'string') return null;
  const m = name.match(/\((\d+)/);
  if (m) return Number(m[1]);
  const any = name.match(/(\d+)/);
  return any ? Number(any[1]) : null;
}

function normalizeKey(name) {
  return (name || '').replace(/\s*\(.*\)\s*$/, '').trim();
}

function migrate() {
  const ordersLog = loadJson(ordersPath) || [];
  const stock = loadJson(stockPath) || {};

  if (!Array.isArray(ordersLog) || ordersLog.length === 0) {
    console.log('No orders to migrate.');
    return;
  }

  let changed = false;
  const migrated = ordersLog.map(order => {
    if (!order || !order.orders) return order;
    // if orders already appear normalized (value is object with qty)
    const sampleVal = Object.values(order.orders)[0];
    if (sampleVal && typeof sampleVal === 'object' && ('qty' in sampleVal)) {
      return order; // assume already migrated
    }

    const newOrders = {};
    Object.entries(order.orders).forEach(([rawName, qtyRaw]) => {
      const base = normalizeKey(rawName);
      const qty = Number(qtyRaw) || 0;
      let price = null;
      if (stock[base] && typeof stock[base] === 'object' && Number.isFinite(Number(stock[base].price))) {
        price = Number(stock[base].price);
      }
      if (price === null) {
        const parsed = parsePriceFromName(rawName);
        if (parsed) price = parsed;
      }
      if (price === null) price = 20; // fallback
      newOrders[base] = { qty, price, total: qty * price };
    });

    const totalAmount = Object.values(newOrders).reduce((s, d) => s + (d.total || 0), 0);
    changed = true;
    return Object.assign({}, order, { orders: newOrders, totalAmount });
  });

  if (changed) {
    saveJson(ordersPath, migrated);
    console.log('Migration complete. Updated orders-log.json');
  } else {
    console.log('No changes required (already migrated).');
  }
}

migrate();
