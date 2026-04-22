# Objective
Add a segmented control to the "Preview/Set all/Save as" row (`.gear_values .buttons`) that allows changing the stepper increment between 1, 3, and 5. This modifies the amount by which the plus/minus buttons increment/decrement the gear values.

# Key Files & Context
*   `index.html`: Contains the structural markup for the `.gear_values .buttons` rows where the new control will be placed.
*   `css/style.css`: Requires new styling rules to visually match the control to the project's existing theme (using CSS variables like `--main-color`).
*   `js/functions.js`: Requires logic updates to handle click events on the segmented control and to modify the plus/minus button functions to respect the selected step value.

# Implementation Steps

## 1. HTML (`index.html`)
Inject the following `<div class="segmented-control step-control">` snippet into each of the 5 instances of `<div class="buttons">` located inside `.gear_values` (this includes both `.vcontent` and `.fvcontent` variants).

```html
<div class="segmented-control step-control">
    <div class="step-btn selected" data-step="1">1</div>
    <div class="step-btn" data-step="3">3</div>
    <div class="step-btn" data-step="5">5</div>
</div>
```

## 2. CSS (`css/style.css`)
Add styles to structure the segmented control and provide visual feedback for the selected state.
```css
.segmented-control {
    display: flex;
    border: 2px solid var(--main-color);
    border-radius: 4px;
    overflow: hidden;
    margin: 0 0.5em;
    align-items: stretch;
}
.segmented-control .step-btn {
    padding: 0.4em 0.8em;
    cursor: pointer;
    background-color: var(--main-background-color);
    color: var(--main-text-color);
    border-right: 1px solid var(--main-color);
    font-size: calc(var(--font-size-settings) * 0.9);
    font-family: var(--main-font);
    display: flex;
    align-items: center;
    justify-content: center;
}
.segmented-control .step-btn:last-child {
    border-right: none;
}
.segmented-control .step-btn.selected {
    background-color: var(--selected-background-color);
    color: var(--selected-text-color);
}
```

## 3. JavaScript (`js/functions.js`)

**a. Add Control Interaction**
Add a click listener to handle switching the active class among `.step-btn` elements when a user selects a new step value:
```javascript
$(document).on('click', '.step-btn', function() {
    $(this).siblings().removeClass('selected');
    $(this).addClass('selected');
});
```

**b. Modify Plus/Minus Logic**
Find the `.minus` and `.plus` click event handlers inside `bindActionButtons()`. Update them to dynamically query the nearest `.step-control` for the currently selected value, defaulting to 1 if none is found.

*Minus Logic Update:*
```javascript
var step = parseInt($(this).closest('.gear_values').find('.step-control .selected').attr('data-step')) || 1;
var v = parseInt($(this).next().val());
if (v >= step) v -= step;
else v = 0; // Prevent going below 0 if that's the intention
$(this).next().val(v);
```

*Plus Logic Update:*
```javascript
var step = parseInt($(this).closest('.gear_values').find('.step-control .selected').attr('data-step')) || 1;
var v = parseInt($(this).prev().val());
v += step;
$(this).prev().val(v);
```

# Verification & Testing
1.  Open the application in a browser and navigate to the settings page.
2.  Verify the segmented control (1, 3, 5) appears next to the "Preview/Set all/Save as" buttons in all derailleur configurations.
3.  Click the segments (3 or 5) and visually verify the active state changes.
4.  Click the `+` and `-` buttons on a gear input and confirm the value increments/decrements by the newly selected step size (1, 3, or 5).
5.  Verify the sparkline dots continue to accurately reflect the changes.