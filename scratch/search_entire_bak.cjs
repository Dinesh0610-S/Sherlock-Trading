const fs = require('fs');
const path = require('path');

const bakPath = 'c:\\Users\\DINESHMANI\\Desktop\\Pictures\\Trade\\src\\App.jsx.bak';

try {
  const content = fs.readFileSync(bakPath, 'utf8');
  const lines = content.split('\n');
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes('parseverdict')) {
      console.log(`Line ${i + 1}: ${lines[i].trim()}`);
      count++;
    }
  }
  console.log(`Found ${count} lines matching 'parseverdict' in App.jsx.bak`);
} catch (err) {
  console.error('Error:', err);
}
