import fs from 'fs';
import path from 'path';

const appPath = path.resolve('src/App.jsx');
let content = fs.readFileSync(appPath, 'utf8');

const hasCRLF = content.includes('\r\n');
let normalized = content.replace(/\r\n/g, '\n');

// Read target and replacement files and normalize their line endings to LF
const targetLayout = fs.readFileSync(path.resolve('scratch/target.txt'), 'utf8')
  .replace(/\r\n/g, '\n').trim();
const replacementLayout = fs.readFileSync(path.resolve('scratch/replacement.txt'), 'utf8')
  .replace(/\r\n/g, '\n').trim();

if (normalized.includes(targetLayout)) {
  normalized = normalized.replace(targetLayout, replacementLayout);
  console.log('✓ Successfully replaced Option Intelligence Layout');
  
  if (hasCRLF) {
    content = normalized.replace(/\n/g, '\r\n');
  } else {
    content = normalized;
  }
} else {
  console.log('✗ targetLayout not found in normalized App.jsx');
}

fs.writeFileSync(appPath, content, 'utf8');
