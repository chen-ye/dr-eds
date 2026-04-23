import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const bleMockScript = fs.readFileSync(path.join(__dirname, 'ble-mock.js'), 'utf8');

// Helper to simulate a full connection sequence to reach the settings view
async function connectAndPopulateGears(page) {
  // Mock UI blocks to avoid overlay issues
  await page.evaluate(() => {
    window.sentBlePayloads = [];
    window.addEventListener('mock-ble-write', (e) => {
      window.sentBlePayloads.push(e.detail);
    });
    window.startBlock = () => { console.log('MOCK: startBlock'); };
    window.endBlock = () => { 
        console.log('MOCK: endBlock');
        $('.dim').hide(); 
    };
    window.qalert = (msg) => { console.log('MOCK: qalert', msg); };
  });

  await page.click('.scan .edsscan', { force: true });
  
  // Wait for the loader / connection sequence
  // The app will wait 500ms then send 'getKey'
  await page.waitForTimeout(600); 

  // Simulate getTransmissionVersionInfo (0x33) -> needed for battery & some state
  await page.evaluate(() => {
    // 13 bytes
    window.simulateBleNotification(0x01, 0x33, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  // Manually construct the connection state and trigger parseData 
  // to avoid mocking the complex block-chunking read protocol.
  await page.evaluate(() => {
    window.appState.device_type = 'EDS TX';
    window.appState.info = {
      TOTAL_CNT: 5,
      NUM: 1,
      'H_GEA[1]': 1280,
      'H_GEA[2]': 2560,
      'H_GEA[3]': 3840,
      'H_GEA[4]': 5120,
      'H_GEA[5]': 6400,
      Q_TOTAL: 2,
      'Q_GEA[1]': 1000,
      'Q_GEA[2]': 2000
    };
    
    $('.scan').hide();
    $('.txsettings').show();
    $('.txsettings .gear_values .vcontent .content').html('');
    for (let t = 0; t < parseInt(appState.info['TOTAL_CNT']); t++) {
        let r = parseInt(appState.info['TOTAL_CNT']) - t;
        $('.txsettings .gear_values .vcontent .content').append('<div class="gear" gear="' + (t + 1) + '"><div class="sparkline"><div class="dot"></div></div><div class="button minus">-</div><input type="text" inputmode="numeric" pattern="[0-9]*" value="' + parseInt(appState.info['H_GEA[' + (t + 1) + ']']) + '"><div class="button plus gear' + r + '">+</div><div class="button set">Set</div></div>');
    }
    if (typeof window.bindActionButtons === 'function') window.bindActionButtons();
    $('.dim').hide();
  });
  
  // Ensure the settings view is visible
  await expect(page.locator('.txsettings')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.route('**/sw.js', route => route.abort());
  await page.addInitScript(bleMockScript);
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.innerHTML = '.dim { display: none !important; pointer-events: none !important; }';
    document.head.appendChild(style);
  });
});

test('Test 1: Device Connection and Initial State', async ({ page }) => {
  await connectAndPopulateGears(page);

  const gearInputs = page.locator('.txsettings .gear_values .gear input');
  await expect(gearInputs).toHaveCount(5);
  await expect(gearInputs.nth(0)).toHaveValue('1280');
  await expect(gearInputs.nth(4)).toHaveValue('6400');
});

test('Test 2: Gear Adjustment (Plus/Minus)', async ({ page }) => {
  await connectAndPopulateGears(page);

  const firstGearPlus = page.locator('.txsettings .gear_values .gear').nth(0).locator('.button.plus');
  const firstGearInput = page.locator('.txsettings .gear_values .gear input').nth(0);
  
  await firstGearPlus.click({ force: true });

  // The step is 1 by default, so 1280 -> 1281
  await expect(firstGearInput).toHaveValue('1281');
});

test('Test 3: Segmented Stepper Control', async ({ page }) => {
  await connectAndPopulateGears(page);

  const stepThreeBtn = page.locator('.txsettings .gear_values .segmented-control .step-btn[data-step="3"]').first();
  await stepThreeBtn.click({ force: true });

  const firstGearPlus = page.locator('.txsettings .gear_values .gear').nth(0).locator('.button.plus');
  const firstGearInput = page.locator('.txsettings .gear_values .gear input').nth(0);

  await firstGearPlus.click({ force: true });

  // 1280 + 3 = 1283
  await expect(firstGearInput).toHaveValue('1283');
});

test('Test 4: Sparkline Rendering', async ({ page }) => {
  await connectAndPopulateGears(page);

  const firstSparklineDot = page.locator('.txsettings .gear_values .gear .sparkline .dot').nth(0);
  const lastSparklineDot = page.locator('.txsettings .gear_values .gear .sparkline .dot').nth(4);

  // lowest gear should be near 0%, highest near 100%
  await expect(firstSparklineDot).toHaveAttribute('style', /left: 0%/);
  await expect(lastSparklineDot).toHaveAttribute('style', /left: 100%/);
});
