const fs = require('fs');
const path = require('path');

try {
  const filePath = path.join(__dirname, 'sharedHelpers_view_851_1650.txt');
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  console.log('Total lines in file:', lines.length);
  
  // Print last 100 lines
  const start = Math.max(0, lines.length - 100);
  for (let i = start; i < lines.length; i++) {
    console.log(lines[i]);
  }
} catch (err) {
  console.error('Error:', err);
}
