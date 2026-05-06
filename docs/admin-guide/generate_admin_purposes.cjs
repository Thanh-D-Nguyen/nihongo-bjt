#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const adminItemsPath = path.join(root, 'docs', 'admin-guide', 'html', 'admin_items.html');
const itemsDir = path.join(root, 'docs', 'admin-guide', 'html', 'items');

function extractScript(html, id) {
  const re = new RegExp(`<script[^>]*id="${id}"[^>]*>([\s\S]*?)<\\/script>`, 'i');
  const m = html.match(re);
  if (!m) return null;
  let json = m[1].trim();
  try {
    return JSON.parse(json);
  } catch (e) {
    console.error('JSON parse failed for', id, e.message);
    return null;
  }
}

if (!fs.existsSync(adminItemsPath)) {
  console.error('admin_items.html not found at', adminItemsPath);
  process.exit(1);
}

// Try to parse nav items from admin_items.html first
let navItems = [];
const adminHtml = fs.readFileSync(adminItemsPath, 'utf8');
const navData = extractScript(adminHtml, 'nav-data');
if (navData && Array.isArray(navData.navItems) && navData.navItems.length) {
  navItems = navData.navItems;
} else {
  // Fallback: parse apps/admin/lib/admin-nav-data.ts to extract item({ ... }) blocks
  const navTsPath = path.join(root, 'apps', 'admin', 'lib', 'admin-nav-data.ts');
  if (!fs.existsSync(navTsPath)) {
    console.error('admin-nav-data.ts not found and nav-data not present. Exiting.');
    process.exit(1);
  }
  const navTs = fs.readFileSync(navTsPath, 'utf8');
  const itemRe = /item\(\s*\{([\s\S]*?)\}\s*\)/g;
  const matches = navTs.matchAll(itemRe);
  for (const m of matches) {
    const block = m[1];
    const idM = block.match(/id:\s*['"]([^'"]+)['"]/);
    const hrefM = block.match(/href:\s*['"]([^'"]+)['"]/);
    const labelM = block.match(/labelKey:\s*['"]([^'"]+)['"]/);
    const permM = block.match(/permissions:\s*\[([^\]]*)\]/);
    const id = idM ? idM[1] : null;
    const href = hrefM ? hrefM[1] : null;
    const title = labelM ? labelM[1] : (id || '');
    let perms = null;
    if (permM) {
      perms = permM[1].split(',').map(s => s.replace(/["'\s]/g, '').trim()).filter(Boolean);
    }
    if (id) navItems.push({ id, href, title, required_frontend_permissions: perms });
  }
}

if (!navItems.length) {
  console.error('No navItems found from either admin_items.html or admin-nav-data.ts. Exiting.');
  process.exit(1);
}

fs.mkdirSync(itemsDir, { recursive: true });
const created = [];
const updated = [];

function synthesizePurpose(item){
  const raw = (item.title || item.id).replace(/^shell\.navItems\./, '');
  const display = raw.replace(/([A-Z])/g, ' $1').replace(/[_\-]/g, ' ').trim();
  return `Quản lý giao diện admin cho route ${item.href || '/'} — dùng để xem, giám sát và thao tác quản lý chức năng (${display || item.id}).`;
}

navItems.forEach(item => {
  const id = item.id;
  const filename = id.replace(/\./g, '_') + '.html';
  const filePath = path.join(itemsDir, filename);
  const titleKey = (item.title || id);
  const displayTitle = titleKey.replace(/^shell\.navItems\./, '').replace(/([A-Z])/g, ' $1').replace(/[_\-]/g, ' ').trim();
  const purpose = item.purpose || synthesizePurpose(item);

  const template = "<!doctype html>\n<html lang=\"vi\">\n<head><meta charset=\"utf-8\"/><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/><title>"+displayTitle+" — "+item.href+"</title>\n<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;padding:20px;color:#111}h1{color:#0b4a6f}pre{background:#f6f8fa;padding:8px;border-radius:6px}</style>\n</head>\n<body>\n<h1>"+displayTitle+"</h1>\n<p><strong>Route:</strong> <code>"+item.href+"</code></p>\n<p><strong>ID:</strong> "+id+"</p>\n<h2>Mục đích</h2>\n<p>"+purpose+"</p>\n<h2>Quyền</h2>\n<p>"+((item.required_frontend_permissions||[]).join(', ') || 'không yêu cầu')+"</p>\n<h2>Hướng dẫn</h2>\n<p class=\"muted\">Chưa có hướng dẫn chi tiết; xem trang tổng hợp hoặc mã nguồn UI trong apps/admin/app/[locale].</p>\n<h2>Files UI (gợi ý)</h2>\n<p class=\"muted\">Kiểm tra: apps/admin/app/[locale] ...</p>\n<p><a href=\"../index.html\">← Về index</a></p>\n</body>\n</html>";

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, template, 'utf8');
    created.push(filename);
  } else {
    const existing = fs.readFileSync(filePath, 'utf8');
    const hasHeading = /<h2>\s*Mục đích\s*<\/h2>/i.test(existing);
    if (!hasHeading) {
      const idPos = existing.indexOf('</p>', existing.indexOf('<strong>ID:'));
      if (idPos !== -1) {
        const insertPos = idPos + 4;
        const newContent = existing.slice(0, insertPos) + '\n' + `<h2>Mục đích</h2>\n<p>${purpose}</p>\n` + existing.slice(insertPos);
        fs.writeFileSync(filePath, newContent, 'utf8');
        updated.push(filename);
      }
    } else {
      const match = existing.match(/<h2>\s*Mục đích\s*<\/h2>([\s\S]*?)(?=<h2|<\/body>)/i);
      const inner = match ? match[1].trim() : '';
      if (!inner || inner.length < 20 || /chưa/i.test(inner)) {
        const replaced = existing.replace(/<h2>\s*Mục đích\s*<\/h2>([\s\S]*?)(?=<h2|<\/body>)/i, `<h2>Mục đích</h2>\n<p>${purpose}</p>\n`);
        fs.writeFileSync(filePath, replaced, 'utf8');
        updated.push(filename);
      }
    }
  }
});

console.log('created:', created.length);
created.forEach(f=>console.log('  +', f));
console.log('updated:', updated.length);
updated.forEach(f=>console.log('  ~', f));

console.log('Done.');
