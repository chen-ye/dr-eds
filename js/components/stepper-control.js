import { LitElement, html, css } from 'lit';

export class StepperControl extends LitElement {
  static properties = {
    currentStep: { type: Number },
  };

  static styles = css`
    :host {
      display: block;
    }
    .segmented-control {
      display: flex;
      border: 2px solid var(--main-color, #000);
      border-radius: 4px;
      overflow: hidden;
      margin: 0 0.5em;
      align-items: stretch;
    }
    .step-btn {
      padding: 0.4em 0.8em;
      cursor: pointer;
      background-color: var(--main-background-color, #fff);
      color: var(--main-text-color, #000);
      border-right: 1px solid var(--main-color, #000);
      font-size: 0.9em;
      font-family: var(--main-font, sans-serif);
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1;
    }
    .step-btn:last-child {
      border-right: none;
    }
    .step-btn.selected {
      background-color: var(--selected-background-color, #ccc);
      color: var(--selected-text-color, #000);
    }
  `;

  render() {
    const steps = [1, 3, 5, 10];
    return html`
      <div class="segmented-control">
        ${steps.map(step => html`
          <div 
            class="step-btn ${this.currentStep === step ? 'selected' : ''}" 
            @click=${() => this._handleStepClick(step)}
            data-step="${step}"
          >
            ${step}
          </div>
        `)}
      </div>
    `;
  }

  _handleStepClick(step) {
    this.currentStep = step;
    this.dispatchEvent(new CustomEvent('step-changed', {
      detail: { step },
      bubbles: true,
      composed: true
    }));
  }
}

customElements.define('stepper-control', StepperControl);
