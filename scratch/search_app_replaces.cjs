const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\DINESHMANI\\.gemini\\antigravity\\brain\\1599aab6-1df6-45fd-878f-ac86e47ffad0\\.system_generated\\logs\\transcript.jsonl';
const outDir = __dirname;

try {
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n');
  let matchCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('App.jsx') && line.includes('replace_file_content') && line.includes('parseVerdict')) {
      const parsed = JSON.parse(line);
      console.log(`Step ${parsed.step_index || i}: replace_file_content in App.jsx (untruncated match)`);
      if (line.includes('<truncated')) {
        console.log('  (truncated in log)');
      } else {
        fs.writeFileSync(path.join(outDir, `app_replace_${matchCount}.txt`), line, 'utf8');
        matchCount++;
      }
    }
  }
  console.log(`Found ${matchCount} untruncated replace matches`);
} catch (err) {
  console.error('Error:', err);
}
