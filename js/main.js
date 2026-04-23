import { store } from './store.js';
import { 
    bleClient, appState,
    cmd_rearLifting, cmd_setGearUpValue, cmd_setFrontGearLimit, cmd_setTotalGear, 
    cmd_getCurrentGear, cmd_frontLifting, cmd_shutdown, cmd_backDialSleep,
    log, _setItem, _getItem, qalert, error, startBlock, endBlock, closePopup, _dialog,
    characteristic_TX, setCRC16, buildPresets, detectDoubleTap
} from './ble-client.js';
import './ui-legacy.js';
import './components/gear-list.js';

// Setup connection flow from ui-legacy.js
$(document).ready(function() {
    // The ui-legacy.js script has the event listeners attached to the DOM on ready.
    // But it also contains the click handler for .scan .button.edsscan which calls navigator.bluetooth.requestDevice.
});

window.store = store;
window.bleClient = bleClient;
window.appState = appState;
window.setCRC16 = setCRC16;
Object.defineProperty(window, 'characteristic_TX', { get: () => characteristic_TX });
window.startBlock = startBlock;
window.endBlock = endBlock;
window.qalert = qalert;
