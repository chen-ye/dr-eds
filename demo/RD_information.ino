/*
 * This demo will connect to RD and get information about it
 * It require ESP32 board with ble support and arduino IDE
 * Flash ESP32 then wakeup RD - after a while it must connect and show information in Serial monitor
 * You can play with DEBUG statements for more information
 */


#include "BLEDevice.h"

//#define DEBUG_PARSE
//#define DEBUG_RX
//#define DEBUG_TX
//#define DEBUG_SETUP
//#define DEBUG_LOOP
//#define DEBUG_CALLBACK
//#define DEBUG_CONNECT
//#define DEBUG_SCAN

#define cmd_getKey 0x11
#define cmd_getLockInfo 0x31
#define cmd_getPowerInfo 0x42
#define cmd_getDeviceMac 0x86
#define cmd_getCurrentGear 0x97
#define cmd_serverReportGear 0x98
#define cmd_rearLifting 0x99
#define cmd_startRead 0xfa
#define cmd_read 0xfb

#define RD "EDS OX"

RTC_DATA_ATTR int boot = 1;

static BLEUUID serviceUUID("6e400001-b5a3-f393-e0a9-e50e24dcca9e");
static BLEUUID charUUID_RX("6e400003-b5a3-f393-e0a9-e50e24dcca9e");
static BLEUUID charUUID_TX("6e400002-b5a3-f393-e0a9-e50e24dcca9e");

RTC_DATA_ATTR static boolean doConnect = false;
RTC_DATA_ATTR static boolean connected = false;
RTC_DATA_ATTR static boolean doScan = false;
RTC_DATA_ATTR static BLERemoteCharacteristic *pRemoteCharacteristic_RX;
RTC_DATA_ATTR static BLERemoteCharacteristic *pRemoteCharacteristic_TX;
RTC_DATA_ATTR static BLEAdvertisedDevice *myDevice;

char step = 0;
RTC_DATA_ATTR char key;
RTC_DATA_ATTR char blocks = 0;

struct command {
  char error = 0;
  char cmd;
  int length;
  char key;
  char payload[50];
  int payload_length = 0;
};

int crc16(uint8_t *payload, int i, int i2)
{
  int CRC8Table[] = {0, 94, 188, 226, 97, 63, 221, 131, 194, 156, 126, 32, 163, 253, 31, 65, 157, 195, 33, 127, 252, 162, 64, 30, 95, 1, 227, 189, 62, 96, 130, 220, 35, 125, 159, 193, 66, 28, 254, 160, 225, 191, 93, 3, 128, 222, 60, 98, 190, 224, 2, 92, 223, 129, 99, 61, 124, 34, 192, 158, 29, 67, 161, 255, 70, 24, 250, 164, 39, 121, 155, 197, 132, 218, 56, 102, 229, 187, 89, 7, 219, 133, 103, 57, 186, 228, 6, 88, 25, 71, 165, 251, 120, 38, 196, 154, 101, 59, 217, 135, 4, 90, 184, 230, 167, 249, 27, 69, 198, 152, 122, 36, 248, 166, 68, 26, 153, 199, 37, 123, 58, 100, 134, 216, 91, 5, 231, 185, 140, 210, 48, 110, 237, 179, 81, 15, 78, 16, 242, 172, 47, 113, 147, 205, 17, 79, 173, 243, 112, 46, 204, 146, 211, 141, 111, 49, 178, 236, 14, 80, 175, 241, 19, 77, 206, 144, 114, 44, 109, 51, 209, 143, 12, 82, 176, 238, 50, 108, 142, 208, 83, 13, 239, 177, 240, 174, 76, 18, 145, 207, 45, 115, 202, 148, 118, 40, 171, 245, 23, 73, 8, 86, 180, 234, 105, 55, 213, 139, 87, 9, 235, 181, 54, 104, 138, 212, 149, 203, 41, 119, 244, 170, 72, 22, 233, 183, 85, 11, 136, 214, 52, 106, 43, 117, 151, 201, 74, 20, 246, 168, 116, 42, 200, 150, 21, 75, 169, 247, 182, 232, 10, 84, 215, 137, 107, 53};
  int t_crc16_h[] = {0, -63, -127, 64, 1, -64, -128, 65, 1, -64, -128, 65, 0, -63, -127, 64, 1, -64, -128, 65, 0, -63, -127, 64, 0, -63, -127, 64, 1, -64, -128, 65, 1, -64, -128, 65, 0, -63, -127, 64, 0, -63, -127, 64, 1, -64, -128, 65, 0, -63, -127, 64, 1, -64, -128, 65, 1, -64, -128, 65, 0, -63, -127, 64, 1, -64, -128, 65, 0, -63, -127, 64, 0, -63, -127, 64, 1, -64, -128, 65, 0, -63, -127, 64, 1, -64, -128, 65, 1, -64, -128, 65, 0, -63, -127, 64, 0, -63, -127, 64, 1, -64, -128, 65, 1, -64, -128, 65, 0, -63, -127, 64, 1, -64, -128, 65, 0, -63, -127, 64, 0, -63, -127, 64, 1, -64, -128, 65, 1, -64, -128, 65, 0, -63, -127, 64, 0, -63, -127, 64, 1, -64, -128, 65, 0, -63, -127, 64, 1, -64, -128, 65, 1, -64, -128, 65, 0, -63, -127, 64, 0, -63, -127, 64, 1, -64, -128, 65, 1, -64, -128, 65, 0, -63, -127, 64, 1, -64, -128, 65, 0, -63, -127, 64, 0, -63, -127, 64, 1, -64, -128, 65, 0, -63, -127, 64, 1, -64, -128, 65, 1, -64, -128, 65, 0, -63, -127, 64, 1, -64, -128, 65, 0, -63, -127, 64, 0, -63, -127, 64, 1, -64, -128, 65, 1, -64, -128, 65, 0, -63, -127, 64, 0, -63, -127, 64, 1, -64, -128, 65, 0, -63, -127, 64, 1, -64, -128, 65, 1, -64, -128, 65, 0, -63, -127, 64};
  int t_crc16_l[] = {0, -64, -63, 1, -61, 3, 2, -62, -58, 6, 7, -57, 5, -59, -60, 4, -52, 12, 13, -51, 15, -49, -50, 14, 10, -54, -53, 11, -55, 9, 8, -56, -40, 24, 25, -39, 27, -37, -38, 26, 30, -34, -33, 31, -35, 29, 28, -36, 20, -44, -43, 21, -41, 23, 22, -42, -46, 18, 19, -45, 17, -47, -48, 16, -16, 48, 49, -15, 51, -13, -14, 50, 54, -10, -9, 55, -11, 53, 52, -12, 60, -4, -3, 61, -1, 63, 62, -2, -6, 58, 59, -5, 57, -7, -8, 56, 40, -24, -23, 41, -21, 43, 42, -22, -18, 46, 47, -17, 45, -19, -20, 44, -28, 36, 37, -27, 39, -25, -26, 38, 34, -30, -29, 35, -31, 33, 32, -32, -96, 96, 97, -95, 99, -93, -94, 98, 102, -90, -89, 103, -91, 101, 100, -92, 108, -84, -83, 109, -81, 111, 110, -82, -86, 106, 107, -85, 105, -87, -88, 104, 120, -72, -71, 121, -69, 123, 122, -70, -66, 126, 127, -65, 125, -67, -68, 124, -76, 116, 117, -75, 119, -73, -74, 118, 114, -78, -77, 115, -79, 113, 112, -80, 80, -112, -111, 81, -109, 83, 82, -110, -106, 86, 87, -105, 85, -107, -108, 84, -100, 92, 93, -99, 95, -97, -98, 94, 90, -102, -101, 91, -103, 89, 88, -104, -120, 72, 73, -119, 75, -117, -118, 74, 78, -114, -113, 79, -115, 77, 76, -116, 68, -124, -123, 69, -121, 71, 70, -122, -126, 66, 67, -125, 65, -127, -128, 64};

  int i3 = 65535;
  int i4 = (65280 & i3) >> 8;
  int b = i3 & 255;
  int i5 = 0;
  while (i5 < i2)
  {
    int b2 = (b ^ payload[i + i5]) & 255;
    i5++;
    int b3 = i4 ^ t_crc16_h[b2];
    i4 = t_crc16_l[b2];
    b = b3;
  }

  return ((i4 & 255) << 8) | (b & 255 & 65535);
}

command parse_packet(uint8_t *hex, int length, int check_confirm = 0)
{
  struct command r;
  bool ascii = false;

  r.error = 0;
  int crc = hex[length - 2] << 8 | hex[length - 1];
  int crcc = crc16(hex, 0, length - 2);
  
  int u8 = (hex[1] - 50) & 255;
  r.key = hex[2] ^ u8;
  r.cmd = hex[3] ^ u8;
  r.length = hex[4] ^ u8;

  if (crc == crcc)
  {
    #ifdef DEBUG_PARSE
    Serial.printf("CRC: %02x = %02x -> OK\n", crc, crcc);
    #endif
  } else {
    if (blocks == 0)
    {
      #ifdef DEBUG_PARSE
      Serial.printf("CRC: %02x != %02x -> FAILED\n", crc, crcc);
      #endif
    
      r.error = 1;
      return r;
    } else {
      r.length = 20; // !FIXME!
      
      // plain ascii
      #ifdef DEBUG_PARSE
      Serial.printf("CRC: skip - ASCII content\n");
      #endif

      ascii = true;
    }
  }
  if (!ascii)
  {
    #ifdef DEBUG_PARSE
    Serial.printf("prefix: %02x\n", hex[0]);
    Serial.printf("u8: %02x\n", u8);
    Serial.printf("key: %02x\n", r.key);
    Serial.printf("cmd: %02x\n", r.cmd);
    Serial.printf("length: %02x\n", r.length);
    #endif
    for (int t = 5; t < 5 + r.length; t++)
    {
      r.payload[t - 5] = hex[t] ^ u8;
      r.payload_length++;
    }
    #ifdef DEBUG_PARSE
    Serial.printf("payload: ");
    for (int t = 0; t < r.payload_length; t++)
    {
      Serial.printf("%02x ", r.payload[t]);
    }
    Serial.printf("\n");
    #endif
  } else {
    for (int t = 0; t < r.length; t++)
    {
      r.payload[t] = hex[t];
      r.payload_length++;
    }

    #ifdef DEBUG_PARSE
    Serial.printf("block %d: ", hex[3]);
    #endif
    
    // skip first 4 bytes = unknown what they are
    for (int t = 4; t < r.payload_length; t++)
    {
      Serial.printf("%c", r.payload[t]);
    }

    #ifdef DEBUG_PARSE
    Serial.printf("\n");
    #endif
  }

  return r;
}

void setCRC16(uint8_t *buf, int length)
{
  int crc = crc16(buf, 0, length - 2);
  char crc2 = (crc & 0xFF);
  char crc1 = ((crc >> 8) & 0xFF);
  buf[length - 2] = crc1;
  buf[length - 1] = crc2;
}

void printBuffer(const char *text, uint8_t *buf, int length)
{
  Serial.print(text);
  for (int t = 0; t < length; t++)
  {
    Serial.printf("%02x ", buf[t]);
  }
  Serial.println("");
}

static void notifyCallback_RX(BLERemoteCharacteristic *pBLERemoteCharacteristic, uint8_t *pData, size_t length, bool isNotify)
{
  uint8_t buffer[length];
  
  #ifdef DEBUG_RX
  Serial.print("RX< ");
  //Serial.print(pBLERemoteCharacteristic->getUUID().toString().c_str());
  Serial.print("len ");
  Serial.println(length);
  Serial.print("data: ");
  #endif
  
  for (int t = 0; t < length; t++)
  {
    buffer[t] = pData[t];

    #ifdef DEBUG_RX
    Serial.print(pData[t], HEX);
    Serial.write(" ");
    #endif
  }
  #ifdef DEBUG_RX
  Serial.println();
  #endif

  command r = parse_packet(buffer, length, 0);

  if (r.cmd == cmd_getKey)
  {
    key = r.key;

    Serial.printf("* rcv key: %02x\n", r.key);

    step = 2;
  }
  if (r.cmd == cmd_startRead)
  {
    blocks = r.payload[1];
    
    #ifdef DEBUG_RX
    Serial.printf("* rcv blocks: %02x\n", blocks);
    #endif
    
    step = 4;
  }
  if (r.cmd == cmd_rearLifting)
  {
    if (r.payload[0] == 0x00) {
      #ifdef DEBUG_RX
      Serial.printf("* RD recv shifting command\n");
      #endif
    }
  }
  if (r.cmd == cmd_serverReportGear)
  {
    if (r.payload[5] == 0x01) {
      #ifdef DEBUG_RX
      Serial.printf("* RD begin shifting to gear %d\n", r.payload[4]);
      #endif
    }
    if (r.payload[5] == 0x00) {
      #ifdef DEBUG_RX
      Serial.printf("* RD end shifting to gear %d\n", r.payload[4]);
      #endif

      if (step < 4)
        step = 4;
    }
  }
  if (r.cmd == cmd_getCurrentGear)
  {
    Serial.println("getCurrentGear");
  }
}

static void notifyCallback_TX(BLERemoteCharacteristic *pBLERemoteCharacteristic, uint8_t *pData, size_t length, bool isNotify)
{
  char buffer[length];
  #ifdef DEBUG_TX
  Serial.print("TX> ");
  //Serial.print(pBLERemoteCharacteristic->getUUID().toString().c_str());
  Serial.print("len ");
  Serial.println(length);
  Serial.print("data: ");
  #endif
  for (int t = 0; t < length; t++) {
    buffer[t] = pData[t];
    
    #ifdef DEBUG_TX
    Serial.print(pData[t], HEX);
    Serial.write(" ");
    #endif
  }
  #ifdef DEBUG_TX
  Serial.println();
  #endif
}

class MyClientCallback : public BLEClientCallbacks
{
  void onConnect(BLEClient *pclient)
  {
  }

  void onDisconnect(BLEClient *pclient)
  {
    connected = false;
    #ifdef DEBUG_CALLBACK
    Serial.println("on disconnect ...");
    #endif
  }
};

bool connectToServer()
{
  Serial.print("Connecting to ");
  Serial.println(myDevice->getAddress().toString().c_str());

  BLEClient *pClient = BLEDevice::createClient();
  Serial.println(" - Client created");

  pClient->setClientCallbacks(new MyClientCallback());

  pClient->connect(myDevice);
  Serial.println(" - Connected");
  
  pClient->setMTU(517);  //set client to request maximum MTU from server (default is 23 otherwise)

  BLERemoteService *pRemoteService = pClient->getService(serviceUUID);
  if (pRemoteService == nullptr)
  {
    Serial.print("No service UUID: ");
    Serial.println(serviceUUID.toString().c_str());
    pClient->disconnect();
    return false;
  }
  Serial.println(" - Found service");

  pRemoteCharacteristic_RX = pRemoteService->getCharacteristic(charUUID_RX);
  if (pRemoteCharacteristic_RX == nullptr)
  {
    #ifdef DEBUG_CONNECT
    Serial.print("No characteristic UUID: ");
    Serial.println(charUUID_RX.toString().c_str());
    #endif
    pClient->disconnect();
  }
  #ifdef DEBUG_CONNECT
  Serial.println(" - Found RX characteristic");
  #endif

  pRemoteCharacteristic_TX = pRemoteService->getCharacteristic(charUUID_TX);
  if (pRemoteCharacteristic_TX == nullptr)
  {
    #ifdef DEBUG_CONNECT
    Serial.print("Failed to find our characteristic UUID: ");
    Serial.println(charUUID_TX.toString().c_str());
    #endif
    pClient->disconnect();
  }
  #ifdef DEBUG_CONNECT
  Serial.println(" - Found TX characteristic");
  #endif

  if (pRemoteCharacteristic_RX->canRead())
  {
    String value = pRemoteCharacteristic_RX->readValue();
    #ifdef DEBUG_CONNECT
    Serial.print("RX< ");
    Serial.println(value.c_str());
    #endif
  }

  if (pRemoteCharacteristic_TX->canRead())
  {
    String value = pRemoteCharacteristic_TX->readValue();
    #ifdef DEBUG_CONNECT
    Serial.println("TX> ");
    Serial.println(value.c_str());
    #endif
  }

  if (pRemoteCharacteristic_RX->canNotify())
  {
    pRemoteCharacteristic_RX->registerForNotify(notifyCallback_RX);
  }

  if (pRemoteCharacteristic_TX->canNotify())
  {
    pRemoteCharacteristic_TX->registerForNotify(notifyCallback_TX);
  }

  connected = true;
  return true;
}

class MyAdvertisedDeviceCallbacks : public BLEAdvertisedDeviceCallbacks
{
  void onResult(BLEAdvertisedDevice advertisedDevice)
  {
    #ifdef DEBUG_SCAN
    Serial.print("Found device: ");
    Serial.println(advertisedDevice.toString().c_str());
    #endif
    
    if (advertisedDevice.getName() == RD)
    {
      BLEDevice::getScan()->stop();
      myDevice = new BLEAdvertisedDevice(advertisedDevice);
      doConnect = true;
      doScan = true;
    }
  }
};

void setup()
{
  if (boot)
  {
    boot = 0;
    
    randomSeed(analogRead(0));

    Serial.begin(115200);
    
    Serial.println("Starting ...");
    
    BLEDevice::init("");
  
    BLEScan *pBLEScan = BLEDevice::getScan();
    pBLEScan->setAdvertisedDeviceCallbacks(new MyAdvertisedDeviceCallbacks());
    pBLEScan->setInterval(1349);
    pBLEScan->setWindow(449);
    pBLEScan->setActiveScan(true);
    pBLEScan->start(60, false);
  }
}

void loop()
{
  if (doConnect == true) {
    if (connectToServer()) {
      Serial.println("done.");
    } else {
      Serial.println("failed.");
    }
    doConnect = false;
  }

  if (connected) {

    if (step == 0)
    {
      step = 1;
      
      Serial.println("Get key ...");

      // key is request with some password - yOTmK50z = 0x79 0x4f 0x54 0x6d 0x4b 0x35 0x30 0x7a
      uint8_t buf[] = { 0xfe, 0x32, 0x29, cmd_getKey, 0x08, 0x79, 0x4f, 0x54, 0x6d, 0x4b, 0x35 ,0x30, 0x7a, 0x00, 0x00 };
      setCRC16(buf, sizeof(buf));
      #ifdef DEBUG_LOOP
      printBuffer("TX> ", buf, sizeof(buf));
      #endif
      pRemoteCharacteristic_TX->writeValue(buf, sizeof(buf), true);
    }
    if (step == 2)
    {
      step = 3;

      Serial.println("startRead ...");

      uint8_t buf[] = { 0xfe, 0x32, key, cmd_startRead, 0x00, 0x00, 0x00 };
      setCRC16(buf, sizeof(buf));
      #ifdef DEBUG_LOOP
      printBuffer("TX> ", buf, sizeof(buf));
      #endif
      pRemoteCharacteristic_TX->writeValue(buf, sizeof(buf), true);
    }
    if (step == 4)
    {
      step = 5;

      #ifdef DEBUG_LOOP
      Serial.println("read ...");
      #endif

      for (uint8_t t = 0; t < blocks; t++)
      {
        uint8_t buf[] = { 0xfe, 0x32, key, cmd_read, 0x03, 0x00, t, 0x51, 0x00, 0x00 };
        setCRC16(buf, sizeof(buf));
        #ifdef DEBUG_LOOP
        printBuffer("TX> ", buf, sizeof(buf));
        #endif
        pRemoteCharacteristic_TX->writeValue(buf, sizeof(buf), true);
      }

      blocks = 0;
    }
  } else if (doScan) {
    BLEDevice::getScan()->start(0);
  }
 
  delay(1000);
}