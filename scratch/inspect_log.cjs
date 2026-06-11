const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\DINESHMANI\\.gemini\\antigravity\\brain\\1599aab6-1df6-45fd-878f-ac86e47ffad0\\.system_generated\\logs\\transcript.jsonl';

try {
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n');

  for (const line of lines) {
    if (line.includes('"step_index":9627') || line.includes('"step_index": 9627')) {
      const parsed = JSON.parse(line);
      console.log('parsed keys:', Object.keys(parsed));
      console.log('tool_calls type:', typeof parsed.tool_calls);
      console.log('tool_calls length:', parsed.tool_calls ? parsed.tool_calls.length : 'N/A');
      if (parsed.tool_calls && parsed.tool_calls.length > 0) {
        console.log('first tool call name:', parsed.tool_calls[0].name);
        console.log('first tool call args keys:', Object.keys(parsed.tool_calls[0].args || {}));
        console.log('args content sample:', JSON.stringify(parsed.tool_calls[0].args).substring(0, 300));
      }
      break;
    }
  }
} catch (err) {
  console.error('Error:', err);
}
