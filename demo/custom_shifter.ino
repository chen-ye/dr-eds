/*
 * This demo will sift up and down every time RD is wakeup
 * It require ESP32 board with ble support and arduino IDE
 * You will need two push buttons attached bettwen GPIO 5 and GND and GPIO 18 and GND (or change then bellow BUTTON_UP and BUTTON_DOWN)
 * Optionally you can attach two LEDs: 
 *  - between GPIO 22 and VDD (3.3V) for connect indication 
 *  - between GPIO 19 and VDD (3.3V) to indicate button press
 * On original WT shifter there is one LED - green when connected and button is pressed and white wne button is pressed, but not connected
 * To pair: 
 * 1. Remove battery from shifter
 * 2. Attach magntic cable with power source
 * 3. You must see LED light blink on the side of RD (not on the top which will be red!)
 * 4. After a couple of seconds press button - shifter must shift
 * 5. If it is not shifting wake up RD by shaking it, then repeat 4
 */

#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <BLE2902.h>

#define RD "EDS OX"

#define SERVICE_UUID "6e400001-b5a3-f393-e0a9-e50e24dcca9e"

#define CHARACTERISTIC_UUID_RX "6e400003-b5a3-f393-e0a9-e50e24dcca9e"
#define CHARACTERISTIC_UUID_TX "6e400002-b5a3-f393-e0a9-e50e24dcca9e"

#define BUTTON_UP 5
#define BUTTON_DOWN 18

#define LED_CONNECTED 22
#define LED_COMMAND 19

unsigned long debounceDuration = 100; // millis

byte lastButtonStateUp = HIGH;
byte lastButtonStateDown = HIGH;

unsigned long lastTimeButtonStateChangedUp = 0;
unsigned long lastTimeButtonStateChangedDown = 0;

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
    digitalWrite(LED_CONNECTED, LOW);
    Serial.println("RD connect");
  };

  void onDisconnect(BLEServer *pServer) {
    BLEDevice::startAdvertising();
    deviceConnected = false;
    digitalWrite(LED_CONNECTED, HIGH);
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
  pinMode(BUTTON_UP, INPUT_PULLUP);
  pinMode(BUTTON_DOWN, INPUT_PULLUP);

  pinMode(LED_CONNECTED, OUTPUT);
  pinMode(LED_COMMAND, OUTPUT);

  digitalWrite(LED_CONNECTED, HIGH);
  digitalWrite(LED_COMMAND, HIGH);

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
  if (gotMAC)
  {
    gotMAC = false;

    startServer();
  }
  if (deviceConnected) {
    if (millis() - lastTimeButtonStateChangedUp > debounceDuration)
    {
      byte buttonStateUp = digitalRead(BUTTON_UP);
      if (buttonStateUp != lastButtonStateUp)
      {
        lastTimeButtonStateChangedUp = millis();
        lastButtonStateUp = buttonStateUp;
        if (buttonStateUp == LOW)
        {
          uint8_t data[] = { 0x04, 0x01, 0x00 };
          data[2] = data[0] ^ data[1];
          pCharacteristicTX->setValue(data, sizeof(data));
          pCharacteristicTX->notify();
          digitalWrite(LED_COMMAND, LOW);
          Serial.println("Button UP pressed");
          delay(100);
          digitalWrite(LED_COMMAND, HIGH);
        }
      }
    }
    if (millis() - lastTimeButtonStateChangedDown > debounceDuration)
    {
      byte buttonStateDown = digitalRead(BUTTON_DOWN);
      if (buttonStateDown != lastButtonStateDown)
      {
        lastTimeButtonStateChangedDown = millis();
        lastButtonStateDown = buttonStateDown;
        if (buttonStateDown == LOW)
        {
          uint8_t data[] = { 0x04, 0x02, 0x00 };
          data[2] = data[0] ^ data[1];
          pCharacteristicTX->setValue(data, sizeof(data));
          pCharacteristicTX->notify();
          digitalWrite(LED_COMMAND, LOW);
          Serial.println("Button DOWN pressed");
          delay(100);
          digitalWrite(LED_COMMAND, HIGH);
        }
      }
     }
  } else delay(1000);
}