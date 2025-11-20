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
    // fallback: simple inline links
    container.innerHTML = '<div style="padding:8px;background:#fff;border-bottom:1px solid #eee;"></div>';
  }
});
