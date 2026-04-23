import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const bleMockScript = fs.readFileSync(path.join(__dirname, 'ble-mock.js'), 'utf8');
const canonicalPayloads = JSON.parse(fs.readFileSync(path.join(__dirname, 'canonical-payloads.json'), 'utf8'));

test.beforeEach(async ({ page }) => {
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  await page.route('**/sw.js', route => route.abort());
  await page.addInitScript(bleMockScript);
  await page.addInitScript(() => {
    window.sentBlePayloads = [];
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.addStyleTag({ content: '.dim { display: none !important; pointer-events: none !important; }' });
});

test('BLE Interop: payloads match legacy baseline', async ({ page }) => {
  // 1. Connect
  await page.click('.scan .edsscan');
  
  // Wait for connection and characteristic setup
  await page.waitForFunction(() => window.characteristic_TX !== undefined);
  
  // Intercept and record writes
  await page.evaluate(() => {
    const original = mockTxCharacteristic.writeValueWithoutResponse;
    mockTxCharacteristic.writeValueWithoutResponse = function(val) {
      const arr = Array.from(val);
      console.log('INTERCEPTED WRITE:', JSON.stringify(arr));
      window.sentBlePayloads.push(arr);
      return original.call(this, val);
    };
    
    // Simulate getKey response (0x11) to unblock the app logic
    window.simulateBleNotification(0x29, 0x11, [0x01]);
  });

  // Wait for the app to send startRead (0xfa)
  await page.waitForFunction(() => window.sentBlePayloads.some(p => p[3] === 0xfa));

  // 2. Populate UI manually
  await page.evaluate(() => {
    appState.device_type = 'EDS TX';
    appState.info = {
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
    
    // Mock UI blocks to avoid overlay issues
    window.startBlock = () => { console.log('MOCK: startBlock'); };
    window.endBlock = () => { console.log('MOCK: endBlock'); };
    window.qalert = (msg) => { console.log('MOCK: qalert', msg); };

    $('.scan').hide();
    $('.txsettings').show();
    
    // Notify components
    bleClient.notifyStateChanged();
  });

  await expect(page.locator('.txsettings')).toBeVisible();
  // Wait for components to render
  await expect(page.locator('.txsettings gear-list[type="rear"] gear-input-row')).toHaveCount(5);

  // 3. Perform actions and assert payloads
  // Clear startup writes (getKey, startRead)
  await page.evaluate(() => { window.sentBlePayloads = []; });

  // ACTION 1: Shift Up
  // This is still in legacy ui-legacy.js or app.js handlers
  await page.evaluate(() => {
    console.log('TEST: clicking shift up');
    $('.txsettings .action_buttons .button.up').click();
  });
  await page.waitForFunction(() => window.sentBlePayloads.length > 0);
  
  // ACTION 2: Set First Gear (Now in Lit component)
  console.log('TEST: clicking set first gear');
  await page.locator('.txsettings gear-list[type="rear"] gear-input-row').nth(0).locator('.button.set').click({ force: true });
  await page.waitForFunction(() => window.sentBlePayloads.length > 1);

  // ACTION 3: Set All Gears (Now in Lit component)
  console.log('TEST: clicking set all gears');
  await page.locator('.txsettings gear-list[type="rear"]').locator('.button.set_all').click({ force: true });
  await page.waitForFunction(() => window.sentBlePayloads.length > 2);

  const currentPayloads = await page.evaluate(() => window.sentBlePayloads);

  // Compare with canonical values
  // Index 1 from canonical is rearLifting (Shift Up)
  expect(currentPayloads[0]).toEqual(canonicalPayloads.all[1]);
  
  // Index 2 from canonical is setFirstGear
  expect(currentPayloads[1]).toEqual(canonicalPayloads.all[2]);
  
  // Index 3 from canonical is first packet of setAllGears
  expect(currentPayloads[2]).toEqual(canonicalPayloads.all[3]);
});
