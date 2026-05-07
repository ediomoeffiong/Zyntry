const fs = require('fs');
const parser = require('@babel/parser');
const code = fs.readFileSync('src/pages/Dashboard.jsx', 'utf8');
try {
  parser.parse(code, { sourceType: 'module', plugins: ['jsx'] });
  console.log('parsed ok');
} catch (e) {
  console.error(e.message);
  if (e.loc) console.error('loc', e.loc);
  process.exit(1);
}
