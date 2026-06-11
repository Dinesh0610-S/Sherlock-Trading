const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\DINESHMANI\\.gemini\\antigravity\\brain\\1599aab6-1df6-45fd-878f-ac86e47ffad0\\.system_generated\\logs\\transcript.jsonl';

try {
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n');
  let matchCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('App.jsx') && line.includes('VIEW_FILE')) {
      const parsed = JSON.parse(line);
      const args = parsed.tool_calls ? parsed.tool_calls[0].args : parsed.args;
      if (args) {
        console.log(`Step ${parsed.step_index || i}: view_file App.jsx from line ${args.StartLine} to ${args.EndLine}`);
      }
    }
  }
} catch (err) {
  console.error('Error:', err);
}
