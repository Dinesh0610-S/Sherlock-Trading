const fs = require('fs');
const path = require('path');

try {
  const matchPath = path.join(__dirname, 'match_8.txt');
  const content = fs.readFileSync(matchPath, 'utf8');
  const parsed = JSON.parse(content);
  
  // Write the parsed content field to a separate file
  fs.writeFileSync(path.join(__dirname, 'match_8_unpacked.txt'), parsed.content || '', 'utf8');
  console.log('Successfully wrote unpacked content to match_8_unpacked.txt');
} catch (err) {
  console.error('Error:', err);
}
