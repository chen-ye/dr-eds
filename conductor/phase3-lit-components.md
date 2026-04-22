# Phase 3: Gradual Migration to Reactive Lit Components

## Objective
With the business logic (Bluetooth and State) safely decoupled into ES Modules in Phase 2, the final phase involves replacing the imperative, error-prone jQuery DOM manipulations with declarative, reactive Web Components using the Lit library. This will modernize the codebase, improve maintainability, and encapsulate UI logic into reusable components, all while maintaining the requirement of being statically servable via CDN imports.

## Key Files & Context
*   `index.html`: Will be updated to use custom HTML tags (e.g., `<derailleur-app>`) instead of the hardcoded layout `<div>`s.
*   `js/ui-legacy.js`: Will be systematically dismantled and replaced by Lit components.
*   `js/components/` (New): A directory to house the new Lit Web Components.
*   `js/store.js`: Will remain the source of truth, passing state down to the Lit components as properties.

## Implementation Steps

### 1. Setup Lit via CDN
Since we are avoiding a build step (Webpack/Vite), we will import Lit directly into our modules using unpkg or jsDelivr.
*   Example import in a component file:
    ```javascript
    import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
    ```

### 2. Bottom-Up Component Replacement Strategy
We will replace the UI incrementally, starting with small, stateless "leaf" components and working our way up to larger container components.

#### Step 2a: Small Reusable Components
*   **`<gear-sparkline>` (`js/components/gear-sparkline.js`)**
    *   **Props:** `min`, `max`, `value`
    *   **Logic:** Replaces the imperative `updateSparklines()` calculation. Uses Lit's reactive properties to automatically recalculate the percentage and update the dot's inline style whenever the props change.
    *   **Styles:** Move the `.sparkline` CSS here using Lit's `css` tag for scoped styling.
*   **`<stepper-control>` (`js/components/stepper-control.js`)**
    *   **Props:** `currentStep`
    *   **Events:** Dispatches a custom `step-changed` event when a segment is clicked.
    *   **Styles:** Encapsulate the `.segmented-control` CSS.

#### Step 2b: Mid-Level Components
*   **`<gear-input-row>` (`js/components/gear-input-row.js`)**
    *   **Props:** `gearIndex`, `value`, `min`, `max`, `currentStep`
    *   **Template:** Renders the `-` button, the `<input>`, the `+` button, the `<gear-sparkline>`, and the "Set" button.
    *   **Logic:** Handles its own `+`/`-` clicks by calculating the new value based on `currentStep`, then dispatches a `gear-adjusted` event with the new value. It handles input validation natively.

#### Step 2c: Container Components
*   **`<derailleur-settings>` (`js/components/derailleur-settings.js`)**
    *   **Props:** The full `gearValues` array/object from the store, `deviceType`.
    *   **Template:** Uses Lit's `map` directive to iterate over the `gearValues` and render a list of `<gear-input-row>` components. It also renders the `<stepper-control>` and the "Preview/Set all/Save as" buttons.
    *   **Logic:** Listens for `gear-adjusted` events from its children and updates the central `store`. Listens for `step-changed` events from the stepper control.

#### Step 2d: The App Shell
*   **`<derailleur-app>` (`js/components/derailleur-app.js`)**
    *   This becomes the root component mounted in `index.html`.
    *   It connects directly to `store.js` (e.g., using a Reactive Controller or simple event listeners in `connectedCallback`).
    *   It handles the top-level routing/visibility logic (showing the Scan screen vs. the Settings screen based on the store's `connectionState`).

### 3. Cleanup
*   Once `<derailleur-app>` is fully implemented and manages the entire view based on the central store, we can remove `js/ui-legacy.js` entirely.
*   Remove the `<script src="js/jquery-3.1.1.min.js"></script>` tag from `index.html` and delete the jQuery file from the repository, completing the modernization process.

## Verification
*   Run the Playwright test suite.
*   All tests must pass, confirming that the new Lit components correctly render the state and dispatch the appropriate events to trigger the Bluetooth client.