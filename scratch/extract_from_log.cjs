const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\DINESHMANI\\.gemini\\antigravity\\brain\\1599aab6-1df6-45fd-878f-ac86e47ffad0\\.system_generated\\logs\\transcript.jsonl';

try {
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n');
  let count = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('parseVerdict') || line.includes('parseEvidenceItem')) {
      // Let's inspect if this line contains the definition: "export function parseVerdict" or "export const parseEvidenceItem" or similar
      if (line.includes('function parseVerdict') && line.includes('function parseEvidenceItem') || line.includes('export const parseEvidenceItem')) {
        console.log(`Found possible definition at Line ${i} (Step Index: ${JSON.parse(line).step_index || i})`);
        console.log('Line length:', line.length);
        console.log('Contains <truncated:', line.includes('<truncated'));
        
        // Save the whole line unpacked to a file
        const parsed = JSON.parse(line);
        fs.writeFileSync(path.join(__dirname, `verdict_def_line_${i}.txt`), JSON.stringify(parsed, null, 2), 'utf8');
        count++;
      }
    }
  }
  console.log(`Found ${count} lines with definitions.`);
} catch (err) {
  console.error('Error:', err);
}
