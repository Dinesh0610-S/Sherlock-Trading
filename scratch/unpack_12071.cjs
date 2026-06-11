const fs = require('fs');
const path = require('path');

try {
  const filePath = path.join(__dirname, 'verdict_def_line_12071.txt');
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(fileContent);
  
  if (parsed.content) {
    fs.writeFileSync(path.join(__dirname, 'sharedHelpers_view_851_1650.txt'), parsed.content, 'utf8');
    console.log('Successfully wrote to sharedHelpers_view_851_1650.txt');
  } else {
    console.log('No content in parsed json');
  }
} catch (err) {
  console.error('Error:', err);
}
