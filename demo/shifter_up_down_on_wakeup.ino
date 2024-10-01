/*
 * This demo will sift up and down every time RD is wakeup
 * It require ESP32 board with ble support and arduino IDE
 */

#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <BLE2902.h>

// name of RD which will look before broadcast
#define RD "EDS OX"

#define SERVICE_UUID "6e400001-b5a3-f393-e0a9-e50e24dcca9e"

#define CHARACTERISTIC_UUID_RX "6e400003-b5a3-f393-e0a9-e50e24dcca9e"
#define CHARACTERISTIC_UUID_TX "6e400002-b5a3-f393-e0a9-e50e24dcca9e"

int count = 0;
bool deviceConnected = false;
bool gotMAC = false;

RTC_DATA_ATTR static BLEAdvertisedDevice *myDevice;

BLECharacteristic *pCharacteristicRX;
BLECharacteristic *pCharacteristicTX;

uint8_t MAC[] = { 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 };

class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *pServer) {
    BLEDevice::stopAdvertising();
    deviceConnected = true;
    count = 1;
    Serial.println("RD connect");
  };

  void onDisconnect(BLEServer *pServer) {
    BLEDevice::startAdvertising();
    deviceConnected = false;
    Serial.println("RD disconnect");
  }
};

class MyCallbacksRX : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) {
    String rxValue = pCharacteristic->getValue();

    if (rxValue.length() > 0) {
      Serial.println("*********");
      Serial.print("Received Value: ");
      for (int i = 0; i < rxValue.length(); i++) {
        Serial.print(rxValue[i]);
      }

      Serial.println();
      Serial.println("*********");
    }
  }
};
class MyCallbacksTX : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) {
    String rxValue = pCharacteristic->getValue();

    if (rxValue.length() > 0) {
      Serial.println("*********");
      Serial.print("Received Value: ");
      for (int i = 0; i < rxValue.length(); i++) {
        Serial.print(rxValue[i]);
      }

      Serial.println();
      Serial.println("*********");
    }
  }
};

class MyAdvertisedDeviceCallbacks : public BLEAdvertisedDeviceCallbacks
{
  void onResult(BLEAdvertisedDevice advertisedDevice)
  {
    if (advertisedDevice.getName() == RD)
    {
      BLEDevice::getScan()->stop();
      myDevice = new BLEAdvertisedDevice(advertisedDevice);

      int r = 0;
      char mac[17];
      strncpy(mac, myDevice->getAddress().toString().c_str(), 17);
      for (int t = 0; t < strlen(mac); t = t + 3)
      {
        sscanf(&mac[t], "%02hhX", &MAC[r]);
        r++;
      }
      gotMAC = true;
    }
  }
};

void startServer()
{
  BLEServer *pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());
  
  BLEService *pService = pServer->createService(SERVICE_UUID);
  
  pCharacteristicTX = pService->createCharacteristic(CHARACTERISTIC_UUID_RX, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_NOTIFY);
  pCharacteristicTX->addDescriptor(new BLE2902());
  pCharacteristicTX->setCallbacks(new MyCallbacksRX());

  pCharacteristicRX = pService->createCharacteristic(CHARACTERISTIC_UUID_TX, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_NOTIFY);
  pCharacteristicRX->addDescriptor(new BLE2902());
  pCharacteristicTX->setCallbacks(new MyCallbacksTX());

  pService->start();
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(false); //true

  uint8_t dataToAdvertise[] = { 0xff, 0xff, 0x07, 0x0f, 0x00, 0x14, 0x55, 0x6a, 0x84, 0x37, 0x02, 0x3a, 0x01, 0x24, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 };

  for (int t = 5; t >= 0; t--)
  {
    dataToAdvertise[sizeof(dataToAdvertise) - t - 1] = MAC[t];
  }
  String _advdata(dataToAdvertise, sizeof(dataToAdvertise));

  BLEAdvertisementData advdata = BLEAdvertisementData();
  advdata.setManufacturerData(_advdata);
  pAdvertising->setAdvertisementData(advdata);
  
  BLEDevice::startAdvertising();
  Serial.println("Setup done");
}

void setup() {
  Serial.begin(115200);
  Serial.println("Starting BLE");

  BLEDevice::init("");

  BLEScan *pBLEScan = BLEDevice::getScan();
  pBLEScan->setAdvertisedDeviceCallbacks(new MyAdvertisedDeviceCallbacks());
  pBLEScan->setInterval(100); // 1349
  pBLEScan->setWindow(99); // 449
  pBLEScan->setActiveScan(true);
  pBLEScan->start(60, false);
}

void loop() {
  // put your main code here, to run repeatedly:
  delay(1000);
  if (gotMAC)
  {
    gotMAC = false;

    startServer();
  }
  if (deviceConnected) {
    if (count == 2)
    {
      count = 3;
      uint8_t data[] = { 0x04, 0x01, 0x00 };
      data[2] = data[0] ^ data[1];
      pCharacteristicTX->setValue(data, sizeof(data));
      pCharacteristicTX->notify();
      Serial.println("shifter bottom button");
    }
    if (count == 1)
    {
      count = 2;
      uint8_t data[] = { 0x04, 0x02, 0x00 };
      data[2] = data[0] ^ data[1];
      pCharacteristicTX->setValue(data, sizeof(data));
      pCharacteristicTX->notify();
      Serial.println("shift top button");
    }
  }
}