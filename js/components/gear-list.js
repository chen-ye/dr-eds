import { LitElement, html, css } from 'lit';
import { bleClient, cmd_setGearUpValue, cmd_setFrontGearLimit, startBlock, appState } from '../ble-client.js';
import './gear-input-row.js';
import './stepper-control.js';

export class GearList extends LitElement {
  static properties = {
    type: { type: String }, // 'rear' or 'front'
    _gears: { state: true },
    _step: { state: true },
    _deviceType: { state: true },
    _totalGears: { state: true }
  };

  constructor() {
    super();
    this.type = 'rear';
    this._gears = [];
    this._step = 1;
    this._deviceType = '';
    this._totalGears = 0;
    this._handleStateChanged = this._handleStateChanged.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();
    bleClient.addEventListener('state-changed', this._handleStateChanged);
    this._syncState();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    bleClient.removeEventListener('state-changed', this._handleStateChanged);
  }

  _handleStateChanged(e) {
    this._syncState();
  }

  _syncState() {
    const state = bleClient.state;
    this._deviceType = state.device_type;
    
    const gears = [];
    if (this.type === 'rear') {
        this._totalGears = parseInt(state.info['TOTAL_CNT']) || 0;
        const keyPrefix = (this._deviceType === 'EDS OX') ? 'GEARS[' : 'H_GEA[';
        for (let i = 1; i <= this._totalGears; i++) {
            gears.push({
                index: i,
                value: parseInt(state.info[`${keyPrefix}${i}]`]) || 0
            });
        }
    } else {
        // front
        this._totalGears = parseInt(state.info['Q_TOTAL']) || 0;
        for (let i = 1; i <= this._totalGears; i++) {
            gears.push({
                index: i,
                value: parseInt(state.info[`Q_GEA[${i}]`]) || 0
            });
        }
    }
    
    this._gears = gears;
    this.requestUpdate();
  }

  static styles = css`
    :host {
      display: block;
      margin-top: 1em;
    }
    .container {
        display: flex;
        flex-direction: column;
        align-items: center;
    }
    .gear-rows {
        width: 100%;
    }
    .controls {
        display: flex;
        align-items: center;
        margin-bottom: 1em;
        gap: 0.5em;
    }
    .button {
      background-color: var(--main-color, #000);
      color: var(--main-background-color, #fff);
      padding: 0.4em 0.8em;
      cursor: pointer;
      border-radius: 4px;
      user-select: none;
      font-family: var(--main-font, sans-serif);
      font-size: var(--font-size-settings, 1em);
    }
  `;

  render() {
    if (this._totalGears === 0) return html`<div></div>`;

    const values = this._gears.map(g => g.value);
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 10000;

    return html`
      <div class="container">
        <div class="controls">
            <stepper-control 
                .currentStep=${this._step}
                @step-changed=${(e) => this._step = e.detail.step}
            ></stepper-control>
            <div class="button set_all" @click=${this._handleSetAll}>Set All</div>
        </div>
        
        <div class="gear-rows">
            ${this._gears.map((gear, i) => {
                const reverseIndex = (this.type === 'rear') ? (this._totalGears - i) : (i + 1);
                return html`
                    <gear-input-row
                        .gearIndex=${gear.index}
                        .value=${gear.value}
                        .min=${min}
                        .max=${max}
                        .step=${this._step}
                        .label=${this.type === 'rear' ? `gear${reverseIndex}` : `front${gear.index}`}
                        @gear-adjusted=${this._handleGearAdjusted}
                        @gear-set=${this._handleGearSet}
                    ></gear-input-row>
                `;
            })}
        </div>
      </div>
    `;
  }

  _handleGearAdjusted(e) {
    const { gearIndex, value } = e.detail;
    const gear = this._gears.find(g => g.index === gearIndex);
    if (gear) {
        gear.value = value;
        const keyPrefix = (this.type === 'rear') ? 
            ((this._deviceType === 'EDS OX') ? 'GEARS[' : 'H_GEA[') : 
            'Q_GEA[';
        bleClient.state.info[`${keyPrefix}${gearIndex}]`] = value;
        this.requestUpdate();
    }
  }

  _handleGearSet(e) {
    const { gearIndex, value } = e.detail;
    this._sendGearValue(gearIndex, value);
    console.log(`SET ${this.type} Gear ${gearIndex} to ${value}`);
  }

  _handleSetAll() {
    const label = (this.type === 'rear') ? 'L_UPDATE_ALL_VALUES' : 'L_UPDATE_ALL_LIMITS';
    const msg = (window.lang && window.lang[label]) || "Updating all values...";
    startBlock(msg);

    appState.all_gears = this._gears.map(g => ({
        gear: g.index,
        value: g.value
    }));

    const v = appState.all_gears.shift();
    this._sendGearValue(v.gear, v.value);
  }

  _sendGearValue(gearIndex, value) {
    const v1 = Math.floor(value / 256);
    const v2 = value % 256;
    const cmd = (this.type === 'rear') ? cmd_setGearUpValue : cmd_setFrontGearLimit;
    // sendPayload already adds the length byte based on the array length
    bleClient.sendPayload(cmd, [gearIndex, v1, v2]);
  }
}

customElements.define('gear-list', GearList);
