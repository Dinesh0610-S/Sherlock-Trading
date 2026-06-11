const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\DINESHMANI\\.gemini\\antigravity\\brain\\1599aab6-1df6-45fd-878f-ac86e47ffad0';

try {
  const files = fs.readdirSync(brainDir);
  for (const file of files) {
    const filePath = path.join(brainDir, file);
    if (fs.statSync(filePath).isFile()) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.toLowerCase().includes('parseverdict')) {
        console.log(`Found in: ${file}`);
      }
    }
  }
} catch (err) {
  console.error('Error:', err);
}
