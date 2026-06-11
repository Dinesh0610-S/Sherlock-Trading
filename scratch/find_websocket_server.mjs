import { readFileSync } from 'fs';

const src = readFileSync('./server.js', 'utf8');
const lines = src.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('ws') || line.includes('WebSocket') || line.includes('Socket') || line.includes('wss')) {
    if (line.includes('require') || line.includes('new ') || line.includes('on(') || line.includes('send(')) {
      console.log(idx + 1, ':', line.trim());
    }
  }
});
