const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const dir = 'C:/Users/DINESHMANI/.gemini/antigravity/brain/1599aab6-1df6-45fd-878f-ac86e47ffad0';
  const targetTabs = [0, 1, 3, 4, 5, 6, 8, 9];

  // 1. Run Desktop Tests (1440 width)
  console.log('--- Running Desktop Viewport Audit (1440px) ---');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:8501');
  await page.waitForTimeout(2000);

  const allTabs = page.locator('.nav-tab');
  const count = await allTabs.count();
  console.log('Total tabs found:', count);

  for (const tabIdx of targetTabs) {
    if (tabIdx >= count) continue;
    const name = await allTabs.nth(tabIdx).textContent();
    console.log(`Clicking Tab ${tabIdx}: ${name.trim()} (Desktop)`);
    await allTabs.nth(tabIdx).click();
    await page.waitForTimeout(tabIdx === 1 ? 8000 : 1500);
    const filename = `tab_${tabIdx}_desktop.png`;
    await page.screenshot({ path: path.join(dir, filename), fullPage: false });
  }
  await browser.close();

  // 2. Run Tablet/Mobile Tests (768 width)
  console.log('\n--- Running Mobile/Tablet Viewport Audit (768px) ---');
  const mobileBrowser = await chromium.launch({ headless: true });
  const mobilePage = await mobileBrowser.newPage();
  await mobilePage.setViewportSize({ width: 768, height: 1024 });
  await mobilePage.goto('http://localhost:8501');
  await mobilePage.waitForTimeout(2000);

  const mobileTabs = mobilePage.locator('.nav-tab');

  for (const tabIdx of targetTabs) {
    if (tabIdx >= count) continue;
    const name = await mobileTabs.nth(tabIdx).textContent();
    console.log(`Clicking Tab ${tabIdx}: ${name.trim()} (Tablet)`);
    await mobileTabs.nth(tabIdx).click();
    await mobilePage.waitForTimeout(tabIdx === 1 ? 8000 : 1500);
    const filename = `tab_${tabIdx}_tablet.png`;
    await mobilePage.screenshot({ path: path.join(dir, filename), fullPage: false });
  }
  await mobileBrowser.close();

  console.log('\nAudit complete! All screenshots saved in the brain directory.');
})().catch(err => {
  console.error('Error running audit:', err);
  process.exit(1);
});
