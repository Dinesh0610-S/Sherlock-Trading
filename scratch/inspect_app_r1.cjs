const fs = require('fs');
const path = require('path');

try {
  const m1 = path.join(__dirname, 'app_replace_1.txt');
  if (fs.existsSync(m1)) {
    const p1 = JSON.parse(fs.readFileSync(m1, 'utf8'));
    console.log('p1 keys:', Object.keys(p1));
    console.log('p1 type:', p1.type);
    console.log('p1 status:', p1.status);
    console.log('p1 content sample:', p1.content ? p1.content.substring(0, 500) : 'N/A');
    if (p1.tool_calls) {
      console.log('tool_calls length:', p1.tool_calls.length);
    }
  }
} catch (err) {
  console.error('Error:', err);
}
