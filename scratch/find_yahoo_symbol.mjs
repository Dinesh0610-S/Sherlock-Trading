import { readFileSync } from 'fs';

const src = readFileSync('./server.js', 'utf8');
const lines = src.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('getYahooSymbol')) {
    console.log(idx + 1, ':', line.trim());
  }
});
