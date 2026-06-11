const { chromium } = require('playwright');

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 960 });

  console.log('Navigating to http://localhost:8501...');
  await page.goto('http://localhost:8501');
  await page.waitForTimeout(5000); // Allow initial loading

  console.log('Clicking Morning Brief tab...');
  const btn = page.locator('#morning-brief-tab');
  if (await btn.isVisible()) {
    await btn.click();
    await page.waitForTimeout(4000); // Wait for rendering and calendar loading
    
    const screenshotPath = `C:/Users/DINESHMANI/.gemini/antigravity/brain/1599aab6-1df6-45fd-878f-ac86e47ffad0/tab_7_morningBrief_captured.png`;
    await page.screenshot({ path: screenshotPath });
    console.log(`Screenshot saved to: ${screenshotPath}`);
  } else {
    console.log('Error: Morning Brief tab button not found.');
  }

  await browser.close();
  console.log('Capture completed.');
})().catch(err => {
  console.error('Error during capture:', err);
  process.exit(1);
});
