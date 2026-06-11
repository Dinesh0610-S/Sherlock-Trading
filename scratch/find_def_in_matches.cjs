const fs = require('fs');
const path = require('path');

const scratchDir = __dirname;
const files = fs.readdirSync(scratchDir).filter(f => f.startsWith('match_') && f.endsWith('.txt'));

for (const file of files) {
  const content = fs.readFileSync(path.join(scratchDir, file), 'utf8');
  if (content.includes('function parseVerdict') || content.includes('const parseEvidenceItem')) {
    console.log(`Found definition in: ${file}`);
    const parsed = JSON.parse(content);
    console.log(`=== Content of ${file} ===`);
    console.log(parsed.content || JSON.stringify(parsed, null, 2));
  }
}
