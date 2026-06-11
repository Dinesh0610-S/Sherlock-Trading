const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('websocket', (ws) => {
    console.log(`[WebSocket opened] URL: ${ws.url()}`);
    
    ws.on('framereceived', (frame) => {
      console.log(`[WS Frame Received]`, frame.payload);
    });

    ws.on('framesent', (frame) => {
      console.log(`[WS Frame Sent]`, frame.payload);
    });

    ws.on('close', () => {
      console.log('[WebSocket closed]');
    });
  });

  console.log('Navigating to http://localhost:8501...');
  await page.goto('http://localhost:8501');
  await page.waitForTimeout(6000);

  await browser.close();
})();
