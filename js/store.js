export class Store extends EventTarget {
    constructor() {
        super();
        this.state = {
            connectionState: 'disconnected', // disconnected, scanning, connected
            deviceType: null,
            batteryLevel: null,
            totalGears: 0,
            gearValues: {}, // gear -> value
            frontGearValues: {}, // front gear -> value
            stepperIncrement: 1,
            info: {},
            rawInfo: [],
            presets: []
        };
    }

    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.dispatchEvent(new CustomEvent('state-changed', { detail: this.state }));
    }

    setGearValue(gearIndex, value) {
        const updatedGears = { ...this.state.gearValues, [gearIndex]: value };
        this.setState({ gearValues: updatedGears });
    }

    setFrontGearValue(gearIndex, value) {
        const updatedGears = { ...this.state.frontGearValues, [gearIndex]: value };
        this.setState({ frontGearValues: updatedGears });
    }
}

export const store = new Store();
