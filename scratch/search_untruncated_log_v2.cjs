const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\DINESHMANI\\.gemini\\antigravity\\brain\\1599aab6-1df6-45fd-878f-ac86e47ffad0\\.system_generated\\logs\\transcript.jsonl';

try {
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n');
  let count = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('parseVerdict(text)')) {
      console.log(`Line ${i} matches (index ${JSON.parse(line).step_index || i})`);
      console.log('Contains <truncated:', line.includes('<truncated'));
      
      const parsed = JSON.parse(line);
      fs.writeFileSync(path.join(__dirname, `verdict_text_match_${count}.txt`), JSON.stringify(parsed, null, 2), 'utf8');
      count++;
    }
  }
  console.log(`Found ${count} lines.`);
} catch (err) {
  console.error('Error:', err);
}
