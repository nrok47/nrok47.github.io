# 🛍️ GitHub Pages Shop - Automation Setup

## GitHub Actions Workflows ที่เพิ่มเข้ามา

### 1. **sync-data.yml** - Sync Data to JSON Files
- **ตัวอักษร**: อัปเดต `stock-data.json` และ `orders-log.json` อัตโนมัติ
- **ตารางเวลา**: ทุก 5 นาที
- **คุณสมบัติ**:
  - ตรวจสอบข้อมูลที่ติดลบ (ป้องกัน negative quantities)
  - Commit อัตโนมัติหากมีการเปลี่ยนแปลง
  - ข้อมูลทั้งหมดจาก localStorage

**ไฟล์**: `.github/workflows/sync-data.yml`

### 2. **backup-orders.yml** - Process Orders Backup
- **วัตถุประสงค์**: สร้าง backup รายวันและสรุป orders
- **ตารางเวลา**: ทุกวันเที่ยง 12:00 UTC
- **คุณสมบัติ**:
  - สร้าง backup ในโฟลเดอร์ `backups/`
  - คำนวณ total revenue และ items sold
  - สรุปข้อมูลรายวัน

**ไฟล์**: `.github/workflows/backup-orders.yml`

---

## Local Management Script

### `update-data-local.js` - Data Manager Tool

ใช้สำหรับ manage ข้อมูลในเครื่องของคุณ

#### ติดตั้ง:
```bash
# ต้องมี Node.js ติดตั้งแล้ว
node update-data-local.js
```

#### เมนู:
1. **View stock-data.json** - ดูสต็อก
2. **Add stock to an item** - เพิ่มสต็อกสินค้า
3. **View orders-log.json** - ดูรายการสั่งซื้อ
4. **Clear all orders** - ลบ orders ทั้งหมด
5. **Validate JSON files** - ตรวจสอบไฟล์ JSON
6. **Exit** - ออก

---

## ขั้นตอนการตั้งค่า

### Step 1: Push ไปยัง GitHub
```bash
git add .github/workflows/ update-data-local.js
git commit -m "Add GitHub Actions workflows for auto-sync"
git push origin main
```

### Step 2: ตรวจสอบ GitHub Actions
1. ไปที่ GitHub repo: `https://github.com/nrok47/nrok47.github.io`
2. คลิก **Actions** tab
3. ควรจะเห็น workflows: `Sync Data to JSON Files` และ `Process Orders Backup`

### Step 3: ต้องการให้ auto-commit ให้เซ็ตอนุญาต

โปรดทำตามนี้เพื่อให้ GitHub Actions สามารถ push ได้:

1. ไปที่ **Settings** → **Actions** → **General**
2. ค้นหา **Workflow permissions**
3. เลือก **Read and write permissions**
4. คลิก **Allow GitHub Actions to create and approve pull requests**

---

## วิธีใช้งาน

### ผู้ขาย (Seller)
1. เข้าไปที่ `seller.html`
2. บันทึกสต็อกสินค้า → บันทึกใน localStorage
3. GitHub Actions จะอัปเดต `stock-data.json` ใน repo ทุก 5 นาที

### ลูกค้า (Customer)
1. เข้าไปที่ `order.html`
2. สั่งสินค้า → บันทึกใน localStorage
3. GitHub Actions จะอัปเดต `orders-log.json` ใน repo ทุก 5 นาที

### Local Management
```bash
node update-data-local.js
```
- ใช้สำหรับ add stock หรือดู orders โดยไม่ต้องเข้าเว็บ

---

## Workflow Timeline

```
12:00 AM ─────────────────────── 12:00 PM ─────────────────────── 12:00 AM
  │                               │                                 │
  └─── backup-orders.yml ─────┐   └─── sync-data.yml (ทุก 5 นาที)
       (Daily summary)        │
       Orders backup          └─→ Create backup ─→ Commit to GitHub
```

---

## ไฟล์ที่สร้างเพิ่มเติม

```
.github/
├── workflows/
│   ├── sync-data.yml           # Auto-sync every 5 minutes
│   └── backup-orders.yml       # Daily backup at noon
│
update-data-local.js            # Local management tool
backups/                        # Daily order backups (auto-created)
└── orders-backup-YYYY-MM-DD.json
```

---

## Troubleshooting

### ❓ GitHub Actions ไม่ทำงาน?
- ตรวจสอบ **Actions** tab ใน repo
- ดู **Workflow runs** log
- ตรวจสอบ **Permissions** ในการ Settings

### ❓ Changes ไม่ปรากฏใน repo?
- ตรวจสอบว่า localStorage มีข้อมูลไหม
- รอ 5 นาทีให้ sync-data workflow ทำงาน
- ตรวจสอบ git log: `git log --oneline | head`

### ❓ JSON files corrupt?
- รัน: `node update-data-local.js`
- เลือก option 5 เพื่อ validate
- ถ้ายังไม่ได้ reset ใน GitHub repo

---

## ข้อมูลเพิ่มเติม

- **GitHub Actions Docs**: https://docs.github.com/en/actions
- **Workflow Syntax**: https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions
- **Cron Schedule**: https://crontab.guru/

---

**Last Updated**: November 12, 2025  
**Status**: ✅ Ready for production
