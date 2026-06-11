const { chromium } = require('playwright');
const { spawn } = require('child_process');

(async () => {
  console.log('Starting Streamlit dashboard on port 8505...');
  // Spawn the streamlit process
  const streamlitProcess = spawn('python', [
    '-m', 'streamlit', 'run', 'groww_dashboard.py',
    '--server.port', '8505',
    '--server.headless', 'true'
  ], {
    cwd: 'c:/Users/DINESHMANI/Desktop/Pictures/Trade',
    shell: true
  });

  // Log streamlit outputs to debug if needed
  streamlitProcess.stdout.on('data', (data) => {
    console.log(`[Streamlit] ${data.toString().trim()}`);
  });
  streamlitProcess.stderr.on('data', (data) => {
    console.log(`[Streamlit Error] ${data.toString().trim()}`);
  });

  // Wait 12 seconds for Streamlit server to start up
  console.log('Waiting for Streamlit to start up...');
  await new Promise(resolve => setTimeout(resolve, 12000));

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    console.log('Navigating to http://localhost:8505...');
    await page.goto('http://localhost:8505', { waitUntil: 'load', timeout: 45000 });
    await page.waitForTimeout(5000);

    // Verify Title
    console.log('Verifying groww brand element...');
    const brand = page.locator('text=groww').first();
    await brand.waitFor({ state: 'visible', timeout: 10000 });
    const brandText = await brand.innerText();
    console.log(`✅ Brand header found: ${brandText}`);

    // Verify Option Premiums are visible
    console.log('Verifying live option premiums grid...');
    const ceCard = page.locator('.option-card').first();
    await ceCard.waitFor({ state: 'visible', timeout: 10000 });
    console.log('✅ Option premium card loaded.');

    // Switch Option Toggle to PUT OPTION
    console.log('Switching selection toggle to PUT OPTION...');
    const putOptionLabel = page.locator('div[data-testid="stRadio"] label:has-text("PUT OPTION")').first();
    await putOptionLabel.click();
    await page.waitForTimeout(2000);
    console.log('✅ Selection switched successfully.');

    // Verify Put Premium card is loaded
    console.log('Verifying Put Premium card is loaded...');
    const peCardTitleLoc = page.locator('text=23750 PE').first();
    await peCardTitleLoc.waitFor({ state: 'visible', timeout: 10000 });
    const peCardTitle = await peCardTitleLoc.innerText();
    console.log(`✅ Loaded option card: ${peCardTitle}`);

    // Fill order quantities and limit price
    console.log('Filling mock transaction order for PUT premium...');
    await page.locator('input[type="number"]').first().fill('100');
    await page.locator('input[type="number"]').nth(1).fill('95.50');
    
    // Submit transaction
    console.log('Submitting mock transaction order...');
    const executeBtn = page.locator('button:has-text("EXECUTE ORDER")').first();
    await executeBtn.click();
    await page.waitForTimeout(2000);

    // Check for placement status
    console.log('Checking for placement status...');
    const orderAlert = page.locator('text=Order Placed!').first();
    await orderAlert.waitFor({ state: 'visible', timeout: 5000 });
    const alertText = await orderAlert.innerText();
    console.log(`✅ Order confirmation dialog displays: ${alertText}`);

    // Save UI Verification Screenshot
    const shotPath = 'c:/Users/DINESHMANI/Desktop/Pictures/Trade/groww_live_dashboard.png';
    await page.screenshot({ path: shotPath, fullPage: true });
    console.log(`✅ Screenshot saved → ${shotPath}`);

  } catch (err) {
    console.error('❌ E2E Error: ' + err.message);
    const errPath = 'c:/Users/DINESHMANI/Desktop/Pictures/Trade/groww_dashboard_error.png';
    await page.screenshot({ path: errPath });
    console.log(`Error screenshot saved → ${errPath}`);
  } finally {
    console.log('Cleaning up browser and stopping Streamlit server...');
    await browser.close();
    // Kill Streamlit process and its children
    streamlitProcess.kill();
  }
})();
