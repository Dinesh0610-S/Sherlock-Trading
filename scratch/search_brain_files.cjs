const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\DINESHMANI\\.gemini\\antigravity\\brain\\1599aab6-1df6-45fd-878f-ac86e47ffad0';

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (f !== '.system_generated' && f !== 'node_modules') {
        walkDir(dirPath, callback);
      }
    } else {
      callback(dirPath);
    }
  });
}

try {
  const matches = [];
  walkDir(brainDir, (filePath) => {
    if (filePath.endsWith('.txt') || filePath.endsWith('.md') || filePath.endsWith('.js') || filePath.endsWith('.cjs') || filePath.endsWith('.json')) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('parseVerdict')) {
        matches.push(filePath);
      }
    }
  });
  console.log('Found parseVerdict in the following brain files:');
  matches.forEach(m => console.log(' -', m));
} catch (err) {
  console.error('Error:', err);
}
