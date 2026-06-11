const fs = require('fs');
const path = require('path');

const scratchDir = __dirname;
const files = fs.readdirSync(scratchDir).filter(f => f.startsWith('verdict_def_line_') && f.endsWith('.txt'));

for (const file of files) {
  const filePath = path.join(scratchDir, file);
  console.log(`=== File: ${file} ===`);
  const content = fs.readFileSync(filePath, 'utf8');
  try {
    const parsed = JSON.parse(content);
    // Print parts of content or tool calls
    if (parsed.content) {
      console.log('Content sample:', parsed.content.substring(0, 1000));
    }
    if (parsed.tool_calls) {
      for (const tc of parsed.tool_calls) {
        console.log(`Tool call: ${tc.name}`);
        if (tc.args) {
          console.log('Args keys:', Object.keys(tc.args));
          if (tc.args.ReplacementContent) {
            console.log('ReplacementContent sample:', tc.args.ReplacementContent.substring(0, 1500));
          }
          if (tc.args.CodeContent) {
            console.log('CodeContent sample:', tc.args.CodeContent.substring(0, 1500));
          }
        }
      }
    }
  } catch (err) {
    console.error(`Error parsing ${file}:`, err);
  }
}
