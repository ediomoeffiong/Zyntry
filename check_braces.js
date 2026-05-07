const fs = require('fs');
const content = fs.readFileSync('frontend/src/pages/Dashboard.jsx', 'utf8');

let openBraces = 0;
let openParens = 0;
let openBrackets = 0;

for (let i = 0; i < content.length; i++) {
  const char = content[i];
  if (char === '{') openBraces++;
  if (char === '}') openBraces--;
  if (char === '(') openParens++;
  if (char === ')') openParens--;
  if (char === '[') openBrackets++;
  if (char === ']') openBrackets--;
}

console.log('Braces:', openBraces);
console.log('Parens:', openParens);
console.log('Brackets:', openBrackets);
