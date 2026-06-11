const fs = require('fs');
const path = require('path');

const bakPath = 'c:\\Users\\DINESHMANI\\Desktop\\Pictures\\Trade\\src\\App.jsx.bak';

try {
  const content = fs.readFileSync(bakPath, 'utf8');
  const lines = content.split('\n');

  // Helper to extract block of code starting at a certain line, and ending when braces balance or next component starts
  function extractBlock(startLineNum, label) {
    let output = [];
    let braceCount = 0;
    let started = false;
    
    for (let i = startLineNum - 1; i < lines.length; i++) {
      const line = lines[i];
      output.push(line);
      
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;
      braceCount += openBraces - closeBraces;
      
      if (!started && openBraces > 0) {
        started = true;
      }
      
      if (started && braceCount === 0) {
        break;
      }
    }
    const result = output.join('\n');
    fs.writeFileSync(path.join(__dirname, `${label}.txt`), result, 'utf8');
    console.log(`Extracted ${label} (${output.length} lines)`);
  }

  extractBlock(1006, 'DataStatusBanner');
  extractBlock(1197, 'MTFConfirmationPanel');
  extractBlock(1343, 'VerdictAccuracyTracker');

} catch (err) {
  console.error('Error:', err);
}
