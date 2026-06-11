import { readFileSync } from 'fs';

const src = readFileSync('./src/components/clueboard/TradingViewChart.jsx', 'utf8');
const lines = src.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('spotPrice')) {
    console.log(idx + 1, ':', line.trim());
  }
});
