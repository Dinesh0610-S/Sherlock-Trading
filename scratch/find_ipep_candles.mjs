import { readFileSync } from 'fs';

const src = readFileSync('./src/components/clueboard/InstitutionalPatternEnginePanel.jsx', 'utf8');
const lines = src.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('api/candles') || line.includes('/api/candles') || line.includes('getCandles')) {
    console.log(idx + 1, ':', line.trim());
  }
});
