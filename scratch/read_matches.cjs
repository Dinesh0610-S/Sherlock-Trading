const fs = require('fs');
const path = require('path');

const scratchDir = __dirname;
const files = fs.readdirSync(scratchDir).filter(f => f.startsWith('match_') && f.endsWith('.txt'));

for (const file of files) {
  const filePath = path.join(scratchDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  try {
    const parsed = JSON.parse(content);
    console.log(`=== File: ${file} (Step: ${parsed.step_index}) ===`);
    // Look in content
    if (parsed.content && parsed.content.includes('parseVerdict')) {
      const idx = parsed.content.indexOf('parseVerdict');
      console.log('Found in content (sample):', parsed.content.substring(idx - 100, idx + 1000));
    }
    // Look in tool calls
    if (parsed.tool_calls) {
      for (const tc of parsed.tool_calls) {
        if (tc.args && JSON.stringify(tc.args).includes('parseVerdict')) {
          const str = JSON.stringify(tc.args);
          const idx = str.indexOf('parseVerdict');
          console.log('Found in tool call args:', str.substring(idx - 100, idx + 1000));
        }
      }
    }
  } catch (err) {
    console.error(`Error parsing ${file}:`, err);
  }
}
