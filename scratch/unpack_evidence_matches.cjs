const fs = require('fs');
const path = require('path');

try {
  const m4 = path.join(__dirname, 'evidence_match_4.txt');
  const m5 = path.join(__dirname, 'evidence_match_5.txt');
  
  if (fs.existsSync(m4)) {
    const p4 = JSON.parse(fs.readFileSync(m4, 'utf8'));
    fs.writeFileSync(path.join(__dirname, 'unpacked_evidence_m4.txt'), p4.content || '', 'utf8');
    console.log('Wrote unpacked m4');
  }
  if (fs.existsSync(m5)) {
    const p5 = JSON.parse(fs.readFileSync(m5, 'utf8'));
    fs.writeFileSync(path.join(__dirname, 'unpacked_evidence_m5.txt'), p5.content || '', 'utf8');
    console.log('Wrote unpacked m5');
  }
} catch (err) {
  console.error('Error:', err);
}
