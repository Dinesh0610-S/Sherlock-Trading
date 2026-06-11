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
    if (line.includes('parseEvidenceItem') && !line.includes('<truncated')) {
      console.log(`Line ${i} matches (index ${JSON.parse(line).step_index || i})`);
      fs.writeFileSync(path.join(outDir, `evidence_match_${matchCount}.txt`), line, 'utf8');
      matchCount++;
    }
  }
  console.log(`Found ${matchCount} matching lines`);
} catch (err) {
  console.error('Error:', err);
}
