const fs = require('fs');
const path = require('path');

try {
  const file0 = path.join(__dirname, 'app_replace_0.txt');
  const file1 = path.join(__dirname, 'app_replace_1.txt');
  
  if (fs.existsSync(file0)) {
    const p0 = JSON.parse(fs.readFileSync(file0, 'utf8'));
    fs.writeFileSync(path.join(__dirname, 'unpacked_app_r0.txt'), JSON.stringify(p0.tool_calls[0].args, null, 2), 'utf8');
    console.log('Wrote unpacked r0');
  }
  if (fs.existsSync(file1)) {
    const p1 = JSON.parse(fs.readFileSync(file1, 'utf8'));
    fs.writeFileSync(path.join(__dirname, 'unpacked_app_r1.txt'), JSON.stringify(p1.tool_calls[0].args, null, 2), 'utf8');
    console.log('Wrote unpacked r1');
  }
} catch (err) {
  console.error('Error:', err);
}
