document.addEventListener('DOMContentLoaded', async function() {
  const container = document.getElementById('site-menu');
  if (!container) return;
  try {
    const resp = await fetch('include/menu.html');
    if (!resp.ok) throw new Error('Menu not found');
    const html = await resp.text();
    container.innerHTML = html;
  } catch (err) {
    console.error('Failed loading menu:', err);
    // fallback: class-based markup (no inline styles)
    container.innerHTML = '<nav id="site-nav" class="site-nav">'
      + '<div class="site-nav-inner">'
      + '<a href="index.html" class="site-nav-brand">🏠 หน้าแรก</a>'
      + '<a href="order.html">🛍️ สั่งซื้อ</a>'
      + '<a href="seller.html">📦 สต็อก</a>'
      + '<a href="report.html">📋 รายงาน</a>'
      + '<a href="simple-shop/index.html" class="site-nav-shop">🛒 Shop</a>'
      + '</div></nav>';
  }
});
