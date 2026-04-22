# Phase 2: ESM Transition & Separation of Concerns

## Objective
The current `js/functions.js` file is a monolithic script operating in the global scope, tightly coupling Web Bluetooth API interactions, application state management, and jQuery DOM manipulations. This phase aims to untangle this "God object" into distinct, modular ES Modules (ESM). This will improve readability, testability, and pave the way for a modern reactive UI layer in Phase 3, while retaining the ability to serve the application statically.

## Key Files & Context
*   `index.html`: Will need to be updated to load the main script as an ES module (`<script type="module">`).
*   `js/functions.js`: Will be dismantled and eventually removed.
*   `js/ble-client.js` (New): Dedicated module for Bluetooth communication.
*   `js/store.js` (New): Dedicated module for state management.
*   `js/ui-legacy.js` (New): An intermediate module holding the jQuery DOM logic, adapted to consume the new store and client.
*   `js/main.js` (New): The entry point that ties the modules together.

## Implementation Steps

### 1. Enable ES Modules in HTML
*   Update `index.html`: Change `<script src="js/functions.js"></script>` to `<script type="module" src="js/main.js"></script>`.

### 2. Extract `ble-client.js` (The Model/Service Layer)
*   Create a new class or module responsible *solely* for interacting with the Web Bluetooth API.
*   Move the `navigator.bluetooth.requestDevice` logic, service/characteristic UUID constants, and connection setup here.
*   Move the complex byte array parsing and formatting logic (e.g., the CRC16 calculations, translating raw bytes into gear values) into this module.
*   **Event Emitting:** When data is received and parsed, this module should not touch the DOM. Instead, it should emit custom events or use a simple pub/sub mechanism to broadcast the parsed data (e.g., `this.dispatchEvent(new CustomEvent('device-connected', { detail: deviceInfo }))`).
*   Provide public methods like `connect()`, `disconnect()`, `setGearValue(gearIndex, value)`, `shiftUp()`, etc., which construct the byte arrays and call `characteristic.writeValueWithoutResponse()`.

### 3. Extract `store.js` (State Management)
*   Create a central store to hold the application's state, replacing the global `info` array and `device_type` variables.
*   The store should contain properties like:
    *   `connectionState` (disconnected, scanning, connected)
    *   `deviceType` (OX, TX, GeX, OX2)
    *   `batteryLevel`
    *   `gearValues` (an array or object of current settings)
    *   `presets`
    *   `stepperIncrement` (1, 3, or 5)
*   The store should subscribe to events emitted by `ble-client.js` to update its internal state.
*   When its state changes, the store should emit its own events (e.g., `state-changed`) so the UI layer can react.

### 4. Create `ui-legacy.js` (The View Layer)
*   Move all the jQuery DOM manipulation code (the `.append()`, `.html()`, `.show()`, `.hide()`, and event listeners like `.on('click')`) from `functions.js` into this module.
*   **Decoupling:** Remove all direct Bluetooth calls from the click handlers. Instead, the UI handlers should call methods on the `ble-client` or dispatch actions to the `store`.
*   **Reactivity Simulation:** Create a `render()` or `updateUI()` function that listens to the `state-changed` event from `store.js`. When the state changes, this function should update the DOM elements based on the new state (e.g., updating the sparklines, recreating the gear rows if the total gears changed).

### 5. Wire it up in `main.js`
*   Import `BleClient`, `Store`, and the `UILegacy` module.
*   Instantiate them and set up the event listeners connecting the client to the store, and the store to the UI.

## Verification
*   Run the Playwright test suite created in Phase 1.
*   **Crucial:** All tests *must* pass without modification. The external behavior of the application must remain identical; only the internal architecture should change.