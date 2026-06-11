const fs = require('fs');
const path = require('path');

const bakPath = 'c:\\Users\\DINESHMANI\\Desktop\\Pictures\\Trade\\src\\App.jsx.bak';

try {
  const content = fs.readFileSync(bakPath, 'utf8');
  const lines = content.split('\n');
  for (let i = 960; i < 1015; i++) {
    console.log(`${i + 1}: ${lines[i].replace('\r', '')}`);
  }
} catch (err) {
  console.error('Error:', err);
}
