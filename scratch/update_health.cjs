const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'server.js');
let content = fs.readFileSync(filePath, 'utf8');

const target = `// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status:    'OK',
    timestamp: new Date().toISOString(),
    routes: [
      '/api/premarket/scan',
      '/api/premarket/options-entry',
      '/api/nse/indices',
      '/api/fiidii/today'
    ]
  });
});`;

const replacement = `// Health check (Issue 1 support: /health and /api/health returning status and time)
app.get(['/health', '/api/health'], (req, res) => {
  res.json({
    status: "ok",
    time: Date.now(),
    timestamp: new Date().toISOString(),
    routes: [
      '/api/premarket/scan',
      '/api/premarket/options-entry',
      '/api/nse/indices',
      '/api/fiidii/today'
    ]
  });
});`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully updated /health route in server.js');
} else {
  console.warn('Target health check route not found in server.js. It may have already been replaced.');
}
