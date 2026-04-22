# Objective
Add a visual set of sparklines to the left of each gear setting in config mode. The sparklines will depict the position of the current value in a range from min to max possible values, forming a dot chart that visualizes the shift ramp spacing.

# Key Files & Context
*   `js/functions.js`: Handles HTML generation for gear lists and user interactions (plus/minus buttons).
*   `css/style.css`: Contains styling for the UI elements.

# Implementation Steps

## 1. CSS Styling (`css/style.css`)
Add new rules to style the sparkline container and the dot indicator.
```css
.sparkline {
    width: 60px;
    height: 2px;
    background-color: var(--main-text-light-color, #ccc);
    position: relative;
    display: inline-block;
    margin-right: 0.5em;
    vertical-align: middle;
}
.sparkline .dot {
    width: 8px;
    height: 8px;
    background-color: var(--main-text-color, #333);
    border-radius: 50%;
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
}
```

## 2. HTML Generation (`js/functions.js`)
Modify the locations where the gear setting rows are dynamically built by adding the `<div class="sparkline"><div class="dot"></div></div>` HTML snippet directly before the minus button.
*   Update `$('.settings .gear_values .vcontent .content').append(...)`
*   Update `$('.ox2settings .gear_values .vcontent .content').append(...)`
*   Update `$('.txsettings .gear_values .vcontent .content').append(...)`
*   Update `$('.gxsettings .gear_values .vcontent .content').append(...)`
*   Update `$('.txsettings .gear_values .fvcontent .content').append(...)` (for front derailleurs)

## 3. JavaScript Logic (`js/functions.js`)
Create a new function `updateSparklines()` to calculate the min and max values of the currently displayed inputs and update the position of each dot accordingly.
```javascript
function updateSparklines() {
    var prefixes = ['.settings', '.ox2settings', '.txsettings', '.gxsettings'];
    prefixes.forEach(function(pr) {
        var blocks = [pr + ' .gear_values .vcontent .content', pr + ' .gear_values .fvcontent .content'];
        blocks.forEach(function(blockSel) {
            var container = $(blockSel);
            if (container.length === 0) return;

            var inputs = container.find('input');
            if (inputs.length === 0) return;

            var min = Infinity;
            var max = -Infinity;

            inputs.each(function() {
                var v = parseInt($(this).val());
                if (!isNaN(v)) {
                    if (v < min) min = v;
                    if (v > max) max = v;
                }
            });

            if (min === Infinity || max === -Infinity) return;

            inputs.each(function() {
                var v = parseInt($(this).val());
                if (!isNaN(v)) {
                    var percent = 0;
                    if (max > min) {
                        percent = ((v - min) / (max - min)) * 100;
                    }
                    $(this).siblings('.sparkline').find('.dot').css('left', percent + '%');
                }
            });
        });
    });
}
```

## 4. Triggering the Update (`js/functions.js`)
Call `updateSparklines()` at appropriate times:
*   At the end of the data population block in the Bluetooth `valuechanged` event listener.
*   Inside the `.button.minus` and `.button.plus` click handlers.
*   By adding a `keyup` event listener to the inputs so the dots update as users manually type values.
*   Inside the preset loading block to ensure sparklines update when a preset is loaded.

# Verification & Testing
1. Connect or simulate connecting to a device to load the config mode gear settings.
2. Verify that a line with a dot appears to the left of the `-` button for each gear.
3. Verify that the lowest value's dot is at the far left, the highest is at the far right, and the others are proportionally placed in between.
4. Increment or decrement a value and ensure the corresponding dot (and potentially others, if min/max changed) immediately updates its position.