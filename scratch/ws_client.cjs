const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3001');

ws.on('open', () => {
  console.log('Connected to WebSocket server!');
  ws.send(JSON.stringify({ subscribe: 'NIFTY' }));
  console.log('Sent subscription for NIFTY');
});

ws.on('message', (data) => {
  console.log('Received message:', data.toString());
});

ws.on('error', (err) => {
  console.error('WS Error:', err);
});

ws.on('close', () => {
  console.log('WS Connection closed');
  process.exit(0);
});

setTimeout(() => {
  console.log('Timeout reached. Closing connection...');
  ws.close();
}, 10000);
