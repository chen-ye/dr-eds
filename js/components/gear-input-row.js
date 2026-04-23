import { LitElement, html, css } from 'lit';
import './gear-sparkline.js';

export class GearInputRow extends LitElement {
  static properties = {
    gearIndex: { type: Number },
    value: { type: Number },
    min: { type: Number },
    max: { type: Number },
    step: { type: Number },
    label: { type: String }
  };

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      margin-bottom: 0.2em;
      white-space: nowrap;
    }
    .button {
      background-color: var(--main-color, #000);
      color: var(--main-background-color, #fff);
      padding: 0.4em 0.8em;
      margin: 0 0.2em;
      cursor: pointer;
      border-radius: 4px;
      user-select: none;
      font-family: var(--main-font, sans-serif);
      font-size: var(--font-size-settings, 1em);
    }
    input {
      width: 4em;
      text-align: center;
      font-size: var(--font-size-settings, 1em);
      border: 1px solid var(--main-text-light-color, #ccc);
      border-radius: 4px;
      padding: 0.3em;
      margin: 0 0.2em;
      font-family: var(--main-font, sans-serif);
    }
    .button.set {
      margin-left: 0.5em;
    }
    gear-sparkline {
        margin-right: 0.5em;
    }
    .plus-wrapper {
        position: relative;
    }
    .plus-label {
        color: var(--main-text-light-color, #ccc);
        position: absolute;
        bottom: -0.2em;
        left: -6em;
        width: 6em;
        font-size: 0.7em;
        text-align: right;
        pointer-events: none;
        z-index: 1;
    }
  `;

  render() {
    return html`
      <gear-sparkline .min=${this.min} .max=${this.max} .value=${this.value}></gear-sparkline>
      <div class="button minus" @click=${this._decrement}>-</div>
      <input 
        type="text" 
        inputmode="numeric" 
        pattern="[0-9]*" 
        .value=${this.value} 
        @change=${this._handleInputChange}
      >
      <div class="plus-wrapper">
        ${this.label ? html`<div class="plus-label">${this.label}</div>` : ''}
        <div class="button plus" @click=${this._increment}>+</div>
      </div>
      <div class="button set" @click=${this._handleSet}>Set</div>
    `;
  }

  _increment() {
    const newValue = parseInt(this.value) + (this.step || 1);
    this._dispatchAdjustment(newValue);
  }

  _decrement() {
    const newValue = parseInt(this.value) - (this.step || 1);
    this._dispatchAdjustment(newValue);
  }

  _handleInputChange(e) {
    const newValue = parseInt(e.target.value);
    if (!isNaN(newValue)) {
      this._dispatchAdjustment(newValue);
    }
  }

  _dispatchAdjustment(newValue) {
    this.dispatchEvent(new CustomEvent('gear-adjusted', {
      detail: { gearIndex: this.gearIndex, value: newValue },
      bubbles: true,
      composed: true
    }));
  }

  _handleSet() {
    this.dispatchEvent(new CustomEvent('gear-set', {
      detail: { gearIndex: this.gearIndex, value: this.value },
      bubbles: true,
      composed: true
    }));
  }
}

customElements.define('gear-input-row', GearInputRow);
