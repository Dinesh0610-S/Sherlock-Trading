const fs = require('fs');
const path = require('path');

const files = ['verdict_text_match_10.txt', 'verdict_text_match_11.txt', 'verdict_text_match_13.txt'];

for (const file of files) {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`=== File: ${file} ===`);
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log('type:', parsed.type);
    console.log('content sample:', parsed.content ? parsed.content.substring(0, 1500) : 'N/A');
    if (parsed.tool_calls) {
      parsed.tool_calls.forEach((tc, idx) => {
        console.log(`Tool call ${idx}: ${tc.name}`);
        if (tc.args) {
          console.log('args keys:', Object.keys(tc.args));
          console.log('CommandLine:', tc.args.CommandLine);
          console.log('CodeContent sample:', tc.args.CodeContent ? tc.args.CodeContent.substring(0, 1500) : 'N/A');
        }
      });
    }
  }
}
