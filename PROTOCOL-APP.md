## Communication with the app

When wake up RD broadcast it's name `EDS OX` and manufacturer specifica data - 11 bytes. First 6 bytes are mac address. Last five looks like some sort of serial number (?!).

When app connect to RD, it become slave, phone become master device.

After connection master discover primary service `6e400001-b5a3-f393-e0a9-e50e24dcca9e` (Nordic UART service)

Then it discover RX `6e400003-b5a3-f393-e0a9-e50e24dcca9e` and TX `6e400002-b5a3-f393-e0a9-e50e24dcca9e` characheristics.

Next step is to get `key` which is used for communication. This is done with command `getKey` = `0x11`. 

App send: `fe 32 29 11 08 79 4f 54 6d 4b 35 30 7a 41 15`.

Here is how packet is sructured:
- offset 00 = `0xfe` - `prefix`
- offset 01 = `0x32` - `xor byte` which is calculated (`0x32` - 0x32) & 0xff = 0x00
- offset 02 = `0x29`- `key`
- offset 03 = `0x11` - `command`
- offset 04 = `0x08` - `payload length`
- offset 05-12 = `79 4f 54 6d 4b 35 30 7a` - `payload`
- offset 13-14 = crc16 of payload

`key`,`command`, `payload length` and `payload` must be XOR-ed with `xor byte`.

Example: here we have `xor byte` of zero, so `command` = 0x11 xor 0x00 = 0x11

In `getCommand` we need very specific `payload`. This seems to be some hardcoded password in the app, which is `yOTmK50z` or in hex `79 4f 54 6d 4b 35 30 7a`.

RD reposnd with the same `command` - in this case `getKey` with payload actual key: `fe b7 00 94 84 00 33 c3`.

Here is how packet is sructured (which is same as structure above):
- offset 00 = `0xfe` - `prefix`
- offset 01 = `0xb7` - `xor byte` which is calculated (`0xb7` - 0x32) & 0xff = 0x85
- offset 02 = `0x00`- `key` - 0x00 xor 0x85 = 0x85
- offset 03 = `0x94` - `command` - 0x94 xor 0x85 = 0x11 (getKey)
- offset 04 = `0x84` - `payload length` - 0x84 xor 0x85 = 0x01
- offset 05 = `0x00` - `payload` - 0x00 xor 0x85 = 0x85
- offset 06-07 = `0x33 0xc3` - crc16 of payload

crc16 calculation is a bit of black magic, but with a little bit a help from the app it can be calculted. See code snipet here: [crc16.c](https://git.jeckyll.net/published/personal/eds-ox/-/blob/main/demo/crc16.c?ref_type=heads)

Same process is valid for other commands.

Here are some commands:
- `0x11` => `getKey` - dec 17
- `0x97` => `getCurrentGear` - dec 151
- `0x98` => `serverReportGear` - dec 152
- `0x99` => `rearLifting` - dec 153
- `0xfa` => `startRead` - dec 250
- `0xfb` => `read` - dec 251
- `0x87` => `getFrontCurrentGear` - dec 135

Using `startRead` and `read` commands we can extract information about RD. First send `startRead`, then RD will respond with a packet with same command (`startRead`) and payload similar to `00 14 a6 ce 51 00 00 00 00`. For now it is clear that offset 00 and 01 (0x00 0x14) holds how many blocks of information can be retrieved with `read` command. Then send `read` command 0x0014 times in this case. Packet must look like `fe 32 d1 fb 03 00 00 51 2d eb`:
- offset 00 = `0xfe` - `prefix`
- offset 01 = `0x32` - `xor byte` - if you use 0x32 there will be no need to encode other fields, sice `xor byte` will be 0x00
- offset 02 = `0xd1`- `key`
- offset 03 = `0xfb` - read `command`
- offset 04 = `0x03` - `payload length`
- offset 05-07 = `00 00 51` - 51 stay the same, first and second bytes indicate block number - here is first one, to get next one use `00 01 51`, then `00, 02, 51` and so on.
- offset 08-09 = `0x2d 0xeb` - crc16 of payload

`read` command return plain ASCII with 4 bytes prefix: `67 d4 00 00 52 45 4d 4f 54 45 5f 56 3a 32 2e 35 38 2c 50 4f` = `REMOTE_V:2.58,PO`. It is unknown what all first 4 bytes mean, but it seems that last two of them are block number. Here they are `00 00`, for the next block will be `00 01` and so on.

Here is dump of all information from OX:
```
REMOTE_V:2.58,POWER_1:292,
GEARS_V:2.89,POWER_2:712,
TOTAL_CNT:12.NUM:6,PTOTECT:2,KeySwitch:0
MCU_DATA:14,0,0,1,0,ErrList:0x20,0x0,0x0
ERRCODE:0x0
GEARS[1]:   0,GEARS[2]: 220,GEARS[3]: 450,GEARS[4]: 650,GEARS[5]: 860,GEARS[6]:1040,GEARS[7]:1240,GEARS[8]:1440,GEARS[9]:1680,GEARS[10]:1920,GEARS[11]:2180,GEARS[12]:2560,
```

Some values are still unknown, but here is what I guess is valid:
- `REMOTE_V` - shifter firmware version - 2.58
- `POWER_1` - shifter battery voltage /100 - 2.92V
- `GEARS_V` - RD firmware version - 2.89
- `POWER_2` - RD battery voltage /100 - 7.12V
- `TOTAL_CNT` - total number of gears - 12
- `NUM` - current gear - 6
- `PTOTECT` - RD treshold - 2 = normal mode, 1 = race mode (experimental)
- `KeySwitch` - shifter buttons function - 0 = bottom +, top -, 1 = bottom -, top +
- `MCU_DATA` - unknown - 14,0,0,1,0
- `ErrList` - unknown - some kind array of errors? - 0x20,0x0,0x0
- `ERRCODE` - unknown - may be fatal error code - 0x0
- `GEARS[1-TOTAL_CNT]` - number of steps of each gear (right padded with 0x00)

Here is dump of all information from TX:
```
L_Ver:3.23,L_POWER:318,R_Ver:4.28,R_POWER:311,
Q_Ver:1.34,Q_POWER:780,H_Ver:2.60,H_POWER:730,
TOTAL_CNT:11,NUM:4,PTOTECT:2,KeySwitch:213:0x0,0x0,0x0
ERRCODE:0x0
H_GEA[1]:0,H_GEA[2]:220,H_GEA[3]:420,H_GEA[4]:600,H_GEA[5]:780,H_GEA[6]:980,H_GEA[7]:1170,H_GEA[8]:1370,H_GEA[9]:1580,H_GEA[10]:1780,H_GEA[11]:2030,Q_TOTAL:6,Q_NUM:4,Q_PTOTECT:1,
ANT_Ver:6.2,Q_CODE:0x0,
Q_GEA[1]:50,
Q_GEA[2]:0,
Q_GEA[3]:180,
Q_GEA[4]:780,
Q_GEA[5]:1010,
Q_GEA[6]:660,
```
NOTE: TX have some bug, which cause RD not to send all `Q` information and `Q_TOTAL`, `Q_GEA` is missing. App will try to fetch these values with `getFrontAndRearDerailleurGearValuesInfo`.

Some values are still unknown, but here is what I guess is valid:
- `L_Ver` - left shifter firmware version - 3.23
- `L_POWER` - left shifter battery voltage /100 - 3.18V
- `R_Ver` - right shifter firmware version - 4.28
- `R_POWER` - right shifter battery voltage /100 - 3.11V
- `Q_Ver` - FD firmware version - 1.34
- `Q_POWER` - FD battery voltage /100 - 7.8V
- `H_Ver` - RD firmware version - 2.60
- `H_POWER` - RD battery voltage /100 - 7.3V
- `TOTAL_CNT` - total number of gears - 11
- `NUM` - current gear - 4
- `PTOTECT` - RD treshold - 2 = normal mode, 1 = race mode (experimental)
- `KeySwitch` - first digit = right small button, second digit = right big button, third digit = left button | 1 = to smallest cog (up shift), 2 = to largest cog (down shift), 3 = front shift
- `0x0,0x0,0x0` - unknown
- `ERRCODE` - unknown - may be fatal error code - 0x0
- `H_GEA[1-TOTAL_CNT]` - number of steps or each gear of RD
- `Q_TOTAL` - number of FD limits - 6
- `Q_NUM` - current FD position - 1,2,3 - big chainring, 4,5,6 - small chainring
- `Q_PTOTECT` - FD treshold - 1 - may be something like race mode, but still unknown
- `ANT_Ver` - ANT+ firmware version - 6.2
- `Q_CODE` - FD error code? - unknown - 0x0
- `Q_GEA[1-Q_TOTAL]` - FD limits

Some of the commands:
- `getKey` = 0x11
- `cmd_getLockInfo` = 0x31
- `getPowerInfo` = 0x42
- `getTransmissionVersionInfo` = 0x60
- `getFrontAndRearDerailleurGearValuesInfo` = 0x61
- `backDialSleep` = 0x63
- `backSetting` = 0x67
- `setFrontGearLimit` = 0x82
- `fineTuneFrontGear` = 0x85
- `getDeviceMac` = 0x86
- `frontStatusReport` = 0x88
- `frontLifting` = 0x89
- `shutdown` = 0x90
- `setTotalGear` = 0x91
- `setGearUpValue` = 0x92
- `setProtectionThreshold` = 0x93
- `fineTuneGear` = 0x95
- `getCurrentGear` = 0x97
- `serverReportGear` = 0x98
- `switchFingerOrder` = 0x9c
- `rearLifting` = 0x99
- `startRead` = 0xfa
- `read` = 0xfb
