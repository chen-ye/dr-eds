# Phase 3: Gradual Migration to Reactive Lit Components

## Objective
With the business logic (Bluetooth and State) safely decoupled into ES Modules in Phase 2, the final phase involves replacing the imperative, error-prone jQuery DOM manipulations with declarative, reactive Web Components using the Lit library. This will modernize the codebase, improve maintainability, and encapsulate UI logic into reusable components, all while maintaining the requirement of being statically servable via CDN imports without a build step.

## Key Files & Context
*   `index.html`: Will be updated to use an Import Map for Lit and custom HTML tags (e.g., `<gear-list>`) instead of hardcoded layout `<div>`s.
*   `js/ui-legacy.js`: Will be systematically dismantled and replaced by Lit components.
*   `js/components/` (New): A directory to house the new Lit Web Components.
*   `js/ble-client.js`: Contains `appState` and the `bleClient` singleton, which handles Bluetooth communication and state events.

## Implementation Steps

### 1. Setup Lit via Import Maps (No Build Step)
Since we are avoiding a build step (Webpack/Vite), we will use an Import Map in `index.html` to resolve bare specifiers like `lit` to a CDN.
*   Update `index.html` head:
    ```html
    <script type="importmap">
      {
        "imports": {
          "lit": "https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js",
          "lit/": "https://cdn.jsdelivr.net/gh/lit/dist@3/"
        }
      }
    </script>
    ```
*   This allows clean imports in our components: `import { LitElement, html, css } from 'lit';`

### 2. State Management & Client Lifecycle
*   **The Singleton Client:** `bleClient` is already exported from `js/ble-client.js` as a singleton instance of `BleClient`, which extends `EventTarget`. Its lifecycle persists for the duration of the user's session (the page load).
*   **State Broadcasting:** We will update `ble-client.js` so that whenever the central `appState` object is modified (e.g., when a BLE payload parses new gear values), the `bleClient` singleton dispatches a custom `state-changed` event.
    ```javascript
    bleClient.dispatchEvent(new CustomEvent('state-changed', { detail: appState }));
    ```
*   **Component Subscription:** Lit components will import the `bleClient` singleton. They will subscribe to the `state-changed` event in their `connectedCallback` lifecycle method to sync their local state with the central store, and unsubscribe in `disconnectedCallback` to prevent memory leaks.

### 3. Bottom-Up Component Replacement Strategy
We will replace the UI incrementally, starting with small, stateless "leaf" components and working our way up.

#### Step 3a: Small Reusable Components
*   **`<gear-sparkline>` (`js/components/gear-sparkline.js`)**
    *   **Props:** `min`, `max`, `value`
    *   **Logic:** Replaces `updateSparklines()`. Uses Lit's reactive properties to automatically calculate percentage and update the dot's inline style.
    *   **Styles:** Encapsulates `.sparkline` CSS.

*   **`<stepper-control>` (`js/components/stepper-control.js`)**
    *   **Props:** `currentStep` (defaults to 1)
    *   **Events:** Dispatches `step-changed` when a segment is clicked.
    *   **Styles:** Encapsulates `.segmented-control` CSS.

#### Step 3b: Mid-Level Components
*   **`<gear-input-row>` (`js/components/gear-input-row.js`)**
    *   **Props:** `gearIndex`, `value`, `min`, `max`, `step`
    *   **Template:** Renders `-` button, `<input>`, `+` button, `<gear-sparkline>`, and `Set` button.
    *   **Logic:** Handles `+`/`-` clicks, calculates new value, and dispatches a standard DOM `gear-adjusted` event. Dispatches `gear-set` when Set is clicked.

#### Step 3c: Container Components
*   **`<gear-list>` (`js/components/gear-list.js`)**
    *   **Lifecycle:** Imports `bleClient` singleton. Listens to `bleClient`'s `state-changed` event in `connectedCallback`.
    *   **Template:** Uses Lit's `map` directive to iterate over gear counts and render `<gear-input-row>` components. Also renders `<stepper-control>`.
    *   **Logic:** Listens for `gear-adjusted` and `gear-set` events to call the appropriate methods on the `bleClient` singleton (e.g., `bleClient.sendPayload(cmd_setGearUpValue, ...)`).

#### Step 3d: The App Shell (Optional/Final)
*   **`<derailleur-app>` (`js/components/derailleur-app.js`)**
    *   Root component replacing the main body content.
    *   Manages routing/visibility (Scan screen vs. Settings screen) based on connection state exposed via `bleClient`.

### 4. Cleanup
*   Once all UI is managed by Lit components, delete `js/ui-legacy.js` and remove jQuery from `index.html`.

## Verification
*   Run the Playwright test suite (`npx playwright test`).
*   The tests should seamlessly pass if the Lit components emit the same events and render the same data as the legacy UI, verifying that hardware communication remains stable.
