import { readFileSync } from 'fs';

const src = readFileSync('./server.js', 'utf8');
const lines = src.split('\n');
lines.forEach((line, idx) => {
  if (line.includes("app.get('/udf") || line.includes('app.get("/udf')) {
    console.log(idx + 1, ':', line.trim());
  }
});
