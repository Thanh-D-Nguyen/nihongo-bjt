#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const inventoryPath = path.join(root, 'company', 'admin-module-inventory.md');
const itemsDir = path.join(root, 'docs', 'admin-guide', 'html', 'items');

if (!fs.existsSync(inventoryPath)) {
  console.error('Inventory file not found:', inventoryPath);
  process.exit(1);
}

const inv = fs.readFileSync(inventoryPath, 'utf8');

// Regex: find '- id: <id>' blocks and extract reason: "..."
const itemRe = /- id:\s*([^\s\n]+)[\s\S]*?reason:\s*"([\s\S]*?)"/g;
let m;
const map = {};
while ((m = itemRe.exec(inv)) !== null) {
  const id = m[1].trim();
  const reason = m[2].trim().replace(/\s+/g, ' ');
  map[id] = reason;
}

if (!Object.keys(map).length) {
  console.error('No reason entries parsed from inventory. Exiting.');
  process.exit(1);
}

function escapeHtml(s){
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const created = [];
const updated = [];

for (const id of Object.keys(map)){
  const filename = id.replace(/\./g,'_') + '.html';
  const filePath = path.join(itemsDir, filename);
  const purpose = map[id];
  const purposeHtml = escapeHtml(purpose);

  if (fs.existsSync(filePath)){
    let content = fs.readFileSync(filePath,'utf8');
    if (/ <h2>\s*Mục đích\s*<\/h2>/i.test(content) || /<h2>\s*Mục đích\s*<\/h2>/i.test(content)){
      // replace block between mục đích and next h2 or </body>
      const replaced = content.replace(/(<h2>\s*Mục đích\s*<\/h2>)([\s\S]*?)(?=<h2|<\/body>)/i, `$1\n<p>${purposeHtml}</p>\n`);
      if (replaced !== content){
        fs.writeFileSync(filePath, replaced, 'utf8');
        updated.push(filename);
      }
    } else {
      // insert after ID paragraph
      const idPos = content.indexOf('</p>', content.indexOf('<strong>ID:'));
      if (idPos !== -1){
        const insertPos = idPos + 4;
        const newContent = content.slice(0, insertPos) + '\n' + `<h2>Mục đích</h2>\n<p>${purposeHtml}</p>\n` + content.slice(insertPos);
        fs.writeFileSync(filePath, newContent, 'utf8');
        updated.push(filename);
      }
    }
  } else {
    const template = `<!doctype html>\n<html lang=\"vi\">\n<head><meta charset=\"utf-8\"/><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/><title>${id}</title>\n<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;padding:20px;color:#111}h1{color:#0b4a6f}</style>\n</head>\n<body>\n<h1>${id}</h1>\n<p><strong>ID:</strong> ${id}</p>\n<h2>Mục đích</h2>\n<p>${purposeHtml}</p>\n<p><a href=\"../index.html\">← Về index</a></p>\n</body>\n</html>`;
    fs.writeFileSync(filePath, template, 'utf8');
    created.push(filename);
  }
}

console.log('created:', created.length);
created.forEach(f=>console.log('  +', f));
console.log('updated:', updated.length);
updated.forEach(f=>console.log('  ~', f));
console.log('Done.');
