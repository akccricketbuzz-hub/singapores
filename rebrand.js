const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.html') || file.endsWith('.js') || file.endsWith('.json')) {
        results.push(file);
      }
    }
  });
  return results;
}

const publicDir = 'c:\\Users\\HP\\Desktop\\sg avm\\public';
const files = walk(publicDir);

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Order matters: replace longer strings first
  content = content.replace(/AVM Academy/g, 'Soulmates');
  content = content.replace(/avm-academy/g, 'soulmates');
  content = content.replace(/avm_academy/g, 'soulmates');
  
  content = content.replace(/AVM Pro/g, 'Soulmates Pro');
  
  // Bare AVM (with word boundaries to avoid replacing parts of other words like 'navmesh' if it existed, though less likely)
  content = content.replace(/\bAVM\b/g, 'Soulmates');
  content = content.replace(/\bavm\b/g, 'soulmates');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated: ${file}`);
  }
}
