import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

function searchDir(dir) {
  const files = readdirSync(dir);
  for (const file of files) {
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        searchDir(fullPath);
      }
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      const src = readFileSync(fullPath, 'utf8');
      const lines = src.split('\n');
      lines.forEach((line, idx) => {
        if (line.toLowerCase().includes('strategy window') || line.toLowerCase().includes('timeline')) {
          console.log(`${fullPath}:${idx + 1}: ${line.trim()}`);
        }
      });
    }
  }
}

searchDir('./src');
