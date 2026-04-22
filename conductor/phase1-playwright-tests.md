# Phase 1: Establish a Safety Net with Playwright Tests

## Objective
Before undertaking a significant architectural refactor, we must establish a regression safety net. Since the application relies heavily on the Web Bluetooth API, manual testing is tedious and requires physical hardware. We will use Playwright to mock the Bluetooth API and automate UI interactions to ensure core functionalities remain intact during the refactor.

## Key Files & Context
*   `package.json` (New): Required to manage the Playwright dependency and test scripts.
*   `playwright.config.js` (New): Configuration for the test suite.
*   `tests/ble-mock.js` (New): A utility script to inject into the browser context to mock `navigator.bluetooth`.
*   `tests/app.spec.js` (New): The primary test suite covering the core user flows.

## Implementation Steps

### 1. Setup Playwright Environment
1.  Initialize a `package.json` file in the project root: `npm init -y`.
2.  Install Playwright: `npm install -D @playwright/test`.
3.  Create `playwright.config.js` configuring a local web server (e.g., using `npx serve` or Python's `http.server`) to serve the static files during testing.

### 2. Implement Web Bluetooth API Mocking
1.  Create `tests/ble-mock.js`. This script will be injected into the page before it loads using Playwright's `page.addInitScript()`.
2.  The mock must intercept calls to `navigator.bluetooth.requestDevice()`.
3.  It should return a mock `BluetoothDevice` object.
4.  The mock device must provide a `gatt.connect()` method returning a mock `BluetoothRemoteGATTServer`.
5.  The server must provide `getPrimaryService()` returning a mock `BluetoothRemoteGATTService`.
6.  The service must provide `getCharacteristic()` returning mock `BluetoothRemoteGATTCharacteristic` objects (specifically for the RX and TX characteristics used in `js/functions.js`).
7.  Crucially, the mock must allow the test suite to trigger `characteristicvaluechanged` events with specific byte arrays to simulate receiving data from the derailleur (e.g., battery levels, gear configurations).
8.  It must also spy on `writeValueWithoutResponse()` to assert that the UI is sending the correct byte sequences when buttons are clicked.

### 3. Write Core Test Scenarios (`tests/app.spec.js`)
Implement the following test cases to cover the essential application states:

*   **Test 1: Device Connection and Initial State:**
    *   Load the page.
    *   Click the "Scan" button.
    *   Resolve the mocked `requestDevice` promise for an "EDS TX" device.
    *   Assert that the UI transitions from the `.scan` view to the `.txsettings` view.
    *   Simulate an incoming GATT notification containing a known gear configuration byte array.
    *   Assert that the correct number of gear input rows are rendered with the expected values.
*   **Test 2: Gear Adjustment (Plus/Minus):**
    *   Connect and load the mock state (as in Test 1).
    *   Click the `+` button on a specific gear row.
    *   Assert that the input value increments correctly.
    *   Verify that `writeValueWithoutResponse` was called on the mock TX characteristic with the correct byte payload representing the new gear value.
*   **Test 3: Segmented Stepper Control:**
    *   Connect and load the mock state.
    *   Click the '3' button on the new segmented stepper control.
    *   Click the `+` button on a gear row.
    *   Assert the value increments by 3.
*   **Test 4: Sparkline Rendering:**
    *   Connect and load a mock state with known min and max gear values.
    *   Assert that the `.dot` element within the `.sparkline` for the lowest gear has `left: 0%` and the highest gear has `left: 100%`.
*   **Test 5: Changing Number of Gears:**
    *   Connect and load state.
    *   Change the value in the "Total Gears" `<select>` dropdown.
    *   Assert the correct byte payload is sent via `writeValueWithoutResponse`.

## Verification
*   Run the test suite using `npx playwright test`.
*   Ensure all tests pass reliably against the current, unmodified (pre-refactor) `js/functions.js` codebase. This establishes our baseline.