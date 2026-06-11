import fs from 'fs';

function check(filename) {
  const content = fs.readFileSync(filename, 'utf8');
  console.log(`Checking ${filename}, length: ${content.length}`);
  const lines = content.split('\n');
  let count = 0;
  lines.forEach((line, idx) => {
    if (line.toLowerCase().includes('chat') || line.toLowerCase().includes('holmes')) {
      count++;
      if (count <= 15) {
        console.log(`  L${idx + 1}: ${line.trim()}`);
      }
    }
  });
  console.log(`Total matches in ${filename}: ${count}`);
}

check('backend/server.py');
check('backend/ai_advisory.py');
