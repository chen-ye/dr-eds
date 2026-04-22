# Objective
Make the preset list horizontally scrollable instead of wrapping to the next line. This will improve the layout by keeping the presets in a single row that users can scroll through.

# Key Files & Context
*   `css/style.css`: Contains the styling for the application, including the `.presets` container and its children.

# Implementation Steps
1.  **Update `.presets` Container Styling:**
    *   File: `css/style.css`
    *   Action: Modify the CSS rules targeting `.presets` (around line 427). Add `white-space: nowrap;` to prevent the children from wrapping, and `overflow-x: auto;` to enable horizontal scrolling. Ensure a smooth scrolling experience by adding `overflow-y: hidden;` and `scrollbar-width: thin;` (optional, for aesthetics).
2.  **Adjust Child Element Styling:**
    *   File: `css/style.css`
    *   Action: Currently, `.preset_wrap` has `white-space: nowrap;` and `display: inline-block;`. Because the parent `.presets` will now handle the `nowrap`, the children should remain `inline-block` to flow horizontally within the parent. We'll verify the styling of `.preset_wrap` (around line 433) doesn't conflict with the scrolling. No changes might be strictly necessary here if they already display `inline-block`, but ensuring the parent `.presets` controls the overflow is key.

# Proposed CSS Change
```css
.settings .gear_values .presets,
.txsettings .gear_values .presets,
.gxsettings .gear_values .presets,
.ox2settings .gear_values .presets {
    margin-top: 1em;
    margin-bottom: 1em;
    overflow-x: auto;
    overflow-y: hidden;
    white-space: nowrap;
    /* Optional: hide scrollbar in WebKit but allow scrolling */
    /* -webkit-overflow-scrolling: touch; */
}
```

# Verification & Testing
1.  Open the application in a browser.
2.  Add several presets until they exceed the width of the screen.
3.  Verify that the presets do not wrap to the next line.
4.  Verify that a horizontal scrollbar appears (or touch scrolling works on mobile) allowing the user to view all presets.
