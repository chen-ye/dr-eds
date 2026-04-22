window.mockGattServer = {
  getPrimaryService: async () => window.mockGattService,
  connected: true,
  disconnect: () => {
    console.log('Mock disconnect called');
    window.mockGattServer.connected = false;
  }
};

window.location.reload = () => { console.log('Mock reload called'); };

window.mockGattService = {
  getCharacteristic: async (uuid) => {
    // TX characteristic: 6e400002-...
    if (uuid.startsWith('6e400002')) return window.mockTxCharacteristic;
    // RX characteristic: 6e400003-...
    if (uuid.startsWith('6e400003')) return window.mockRxCharacteristic;
    throw new Error('Unknown UUID: ' + uuid);
  }
};

window.mockBluetoothDevice = {
  id: 'mock-device',
  name: 'EDS TX',
  gatt: window.mockGattServer,
  addEventListener: () => {}
};

window.mockTxCharacteristic = {
  uuid: '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
  writeValueWithoutResponse: async (value) => {
    const arr = Array.from(new Uint8Array(value.buffer));
    window.dispatchEvent(new CustomEvent('mock-ble-write', { detail: arr }));
  }
};

window.mockRxCharacteristic = {
  uuid: '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
  addEventListener: (eventName, listener) => {
    if (eventName === 'characteristicvaluechanged') {
      window.mockRxCharacteristicListener = listener;
    }
  },
  startNotifications: async () => window.mockRxCharacteristic,
};

navigator.bluetooth = {
  requestDevice: async () => window.mockBluetoothDevice
};

window.createMockPayload = (key, cmd, payloadBytes) => {
  const length = payloadBytes.length;
  const arr = new Uint8Array(length + 7);
  arr[0] = 0xfe;
  arr[1] = 0x32;
  arr[2] = key;
  arr[3] = cmd;
  arr[4] = length;
  for (let i = 0; i < length; i++) {
    arr[5 + i] = payloadBytes[i];
  }
  // setCRC16 is globally defined in functions.js
  if (typeof window.setCRC16 === 'function') {
    return window.setCRC16(arr);
  } else {
    console.error('setCRC16 is not defined globally!');
    return arr;
  }
};

window.simulateBleNotification = (key, cmd, payloadBytes) => {
  if (window.mockRxCharacteristicListener) {
    const uint8Array = window.createMockPayload(key, cmd, payloadBytes);
    const event = {
      target: {
        value: {
          buffer: uint8Array.buffer,
          byteLength: uint8Array.length,
          getUint8: (i) => uint8Array[i]
        }
      }
    };
    window.mockRxCharacteristicListener(event);
  } else {
    console.error('No RX characteristic listener attached');
  }
};
