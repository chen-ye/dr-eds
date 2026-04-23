import { LitElement, html, css } from 'lit';

export class GearSparkline extends LitElement {
  static properties = {
    min: { type: Number },
    max: { type: Number },
    value: { type: Number },
  };

  static styles = css`
    :host {
      display: block;
      flex: 1;
      min-width: 20px;
      height: 2px;
      background-color: var(--main-text-light-color, #ccc);
      position: relative;
      margin-right: 0.5em;
      align-self: center;
    }
    .dot {
      width: 8px;
      height: 8px;
      background-color: var(--main-text-color, #000);
      border-radius: 50%;
      position: absolute;
      top: 50%;
      transform: translate(-50%, -50%);
      transition: left 0.2s ease-out;
    }
  `;

  render() {
    const min = this.min || 0;
    const max = this.max || 1;
    const value = this.value || 0;
    
    let percent = 0;
    if (max > min) {
      percent = ((value - min) / (max - min)) * 100;
    }
    
    // Clamp between 0 and 100
    percent = Math.max(0, Math.min(100, percent));

    return html`<div class="dot" style="left: ${percent}%"></div>`;
  }
}

customElements.define('gear-sparkline', GearSparkline);
