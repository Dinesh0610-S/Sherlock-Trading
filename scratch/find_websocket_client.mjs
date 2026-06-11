import { readFileSync } from 'fs';

const src = readFileSync('./src/components/clueboard/ClueBoardTab.jsx', 'utf8');
const lines = src.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('connectWebSocket')) {
    console.log(idx + 1, ':', line.trim());
  }
});
