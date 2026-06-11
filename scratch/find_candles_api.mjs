import { readFileSync } from 'fs';

const src = readFileSync('./server.js', 'utf8');
const lines = src.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('/api/candles') || line.includes('api/candles')) {
    console.log(idx + 1, ':', line.trim());
  }
});
