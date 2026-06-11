const fs = require('fs');
const path = require('path');

const bakPath = 'c:\\Users\\DINESHMANI\\Desktop\\Pictures\\Trade\\src\\App.jsx.bak';

try {
  const content = fs.readFileSync(bakPath, 'utf8');
  const lines = content.split('\n');
  console.log('Total lines in App.jsx.bak:', lines.length);
  
  // Let's print lines 3100 to 3250 (1-based index is line 3100 = array index 3099)
  const startLine = 3100;
  const endLine = 3250;
  for (let i = startLine - 1; i < Math.min(endLine, lines.length); i++) {
    console.log(`${i + 1}: ${lines[i].replace('\r', '')}`);
  }
} catch (err) {
  console.error('Error:', err);
}
