const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\DINESHMANI\\.gemini\\antigravity\\brain\\1599aab6-1df6-45fd-878f-ac86e47ffad0\\.system_generated\\logs\\transcript.jsonl';

try {
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n');

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (line.includes('sharedHelpers.jsx') && line.includes('replace_file_content')) {
      const parsed = JSON.parse(line);
      console.log('--- Step Index:', parsed.step_index);
      console.log('type:', parsed.type);
      console.log('status:', parsed.status);
      if (parsed.tool_calls) {
        for (const tc of parsed.tool_calls) {
          if (tc.name === 'replace_file_content' && tc.args) {
            console.log('TargetFile:', tc.args.TargetFile);
            console.log('ReplacementContent length:', tc.args.ReplacementContent ? tc.args.ReplacementContent.length : 'N/A');
            console.log('Snippet:', tc.args.ReplacementContent ? tc.args.ReplacementContent.substring(0, 100) : 'N/A');
            // Write to a separate file per step index
            fs.writeFileSync(path.join(__dirname, `step_${parsed.step_index}_replacement.txt`), tc.args.ReplacementContent || '', 'utf8');
          }
        }
      }
    }
  }
} catch (err) {
  console.error('Error:', err);
}
