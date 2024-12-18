# EDS OX

What is known so far:
- Rear derailleur (RD) and shifter use ble to communicate with each other
- RD fall to sleep after 20s when not connected
- Shifter fall to sleep after 10s when not connected
- RD fall to sleep after 3min when connected to shifter
- RD never fall to sleep when connected to the app

# Open source WEB/PWA app
This repo now contain open source WEB/PWA app which is hosted at https://drwtox.jeckyll.net/.

APK file can be downloaed from: https://drwtox.jeckyll.net/releases/0.0.0.1/drWtOX-0.0.0.1.apk (buld from published source trough APK Builder)

You can clone repo and host it yourself or use it from supplied URL.

### What's working:

- Displaying battery voltages - RD and shifter
- Displaying firmware versions - RD and shifter
- Up/Down shifting - click on Up/Down shift buttons
- Set number of gears (3/14) - click on `total gears` button and select from drop down - allow to set number of gears only if you are on lower than selected gear to prevent errors
- Initial calibration - will show up/down buttons only when RD is on smallest gear to prevent user errors
- Adjust every gear value - use `+` and `-` buttons or enter value - click `Set`
- Set all gear values - click `Set all` button
- Save values as preset - click `Save as` - enter name - use only letters and numbers - you will see new button with that name to appear
- Export - click `Export` button - file with all current values and all presets will be saved on your device with file name `drWtOX-gears-[date/time].json`
- Import - Click on `Import` button to import exported file - all current and saved as preset values will be overwritten, but not uploaded to a RD - use `Set all` to upload to RD
- Presets - all saved presets are displayed as buttons with option to be deleted - clicking on preset will put all values from it, on edit boxes, but not will be uploaded to RD - click `Set all` to upload them to RD
- Button functions - normal (top button up shift/bottom button downshift) and reverse (top button down shift/bottom button up shift) buttons functions

### What's missing:

- Offline mode - at that point app load all need files from Internet. On later stage it may become entirely offline
- Firmware upgrade - if it is even possible, since it require some AES encryption
- Please, feel free to add more ...

### Requirements:

- Google chrome/Brave/Vivaldi browser (may be other Chromium based browsers) installed on the device - Firefox don't support WEB Bluetooth, Opera don't work for some reason
- Enabled WEB Bluetooth on the browser - check for WEB Bluetooth in `chrome://flags`, `brave://flags` & etc (new Chrome and Vivaldi versions have flag enabled, Brave have it disabled) and enable flag if needed
- Internet access - at least for now
- Bluetooth

### Something not working: 

Make sure `X` button is pressed and debug messages are visible, then douple tap on them and they will be copied to the clipboard. Open new issue here and paste debug information, so they can be analized and problem to be fixed.


### Sreenshots:
![Main screen without debug info](https://drwtox.jeckyll.net/images/shot1.png){width=24%}
![Main screen with debug info](https://drwtox.jeckyll.net/images/shot2.png){width=24%}
![Main screen (bottom part) withou debug info](https://drwtox.jeckyll.net/images/shot4.png){width=24%}
![Main screen (bottom part) with debug info](https://drwtox.jeckyll.net/images/shot3.png){width=24%}



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

Here is dump of all information from my OX:
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
- `NUM` - current gear
- `PTOTECT` - unknown - 2
- `KeySwitch` - shifter buttons function - 0 = bottom +, top -, 1 = bottom -, top +
- `MCU_DATA` - unknown - 14,0,0,1,0
- `ErrList` - unknown - some kind array of errors? - 0x20,0x0,0x0
- `ERRCODE` - unknown - may be fatal error code - 0x0
- `GEARS[1-TOTAL_CNT]` - number of steps or each gear (right padded with 0x00)

## Communication with the shifter

Communication with the shifter is different from communication with the app. It seems that is much simple and much faster. 

After wake up both RD and Shifter broadcast data. RD broadcast it's name (see above - [Communication with the app](#communication-with-the-app)).

On the other hand shifter is more cryptic. It broardcast some magic numbers for a bit: `070f0014556a8437023a0124000000000000000000`. For now only know part is `0124` which seems to be shifter battery voltage. In any case `070f0014556a8437023a` seems pretty consistent and doesn't change (at least on mine OX - need more testers). May be it is just a fixed value which RD seek when trying to connect, or it have some encrypted meaning ...

After couple of broadcast last part of the message (last 6 bytes) become RD mac address in reverse. It seems that shifter is listening for RD broadcasts and when it find OX device it put it's mac address in his own broadcast. 

Then RD make a connection to the shifter which become slave and RD become master device. 

Next RD look for primary service `6e400001-b5a3-f393-e0a9-e50e24dcca9e` and TX characteristic `6e400002-b5a3-f393-e0a9-e50e24dcca9e`. 

When shifter button is pressed it sends only 3 bytes: `0x04 0x01 0x05`. Here `0x04` is a prefix, `0x01` or `0x02` seems to be the button, and `0x05` looks like simpe xor checksum.

Meanings for position `R` for small sliding button (normal operation):
- `0x01` - bottom shifter button is pressed - normally going to lower gear | larger cog
- `0x02` - top shifter button is pressed - normally going to higher gear | smaller cog
- `0x03` - bottom shifter button is holded down - sended 1/2s after `0x01` - multiple shifts
- `0x04` - top shifter button is holded down - sended 1/2s after `0x02` - multiple shifts

Meanings for position `T` for small sliding button (fine tune):
- `0x05` - bottom shifter button is pressed - move RD 0.2mm towards smaller cogs
- `0x06` - top shifter button is pressed - move RD 0.2mm towards biggest cogs
- `0x07` - bottom shifter button is holded down - sended 1/2s after `0x05` - currently doing nothing
- `0x08` - top shifter button is holded down - sended 1/2s after `0x06` - currently doing nothing

Common:
- `0x09` - bottom shifter button is released
- `0x0a` - top shifter button is releases

This means that shifter don't know on which gear RD is. It just send which button is pressed, holded down or released.

## Pairing

First wake up RD (shake bike). Then attach magnetic connector. USB cable must be powered. After that RD led (side one, not top one which will be red for charging) will blink in blue. This seems to make RD to "forget" for old shifter and to try to connect to new one. Without this process RD never try to connect to new shifter.

## Demos

### Shifting using app protcol

[https://youtu.be/mDlyekZ2KaY](https://youtu.be/mDlyekZ2KaY)

Demo uses `rearLifting` command. It just send `0xfe, 0x32, key, rearLifting, 0x01, 0x01, crc16, crc16` and then switch back to the same gear `0xfe, 0x32, key, rearLifting, 0x01, 0x02, crc16, crc16`. As you can see `0x01` and `0x02` are payloads for shift up and down.

### Shifting using shifter protocol

Simple demo shifting can be found in file [shifter_up_down_on_wakeup.ino](https://git.jeckyll.net/published/personal/eds-ox/-/blob/main/demo/shifter_up_down_on_wakeup.ino?ref_type=heads) in `demo` folder. Demo will shift up and down every time RD is waked up.

### Get information from RD

This demo connects to RD and fetch available information about RD [RD_information.ino](https://git.jeckyll.net/published/personal/eds-ox/-/blob/main/demo/RD_information.ino?ref_type=heads)

### Custom shifter with buttons

This is custom shifter with buttons attached to ESP32 microcontroller. You can find code here: [custom_shifter.ino](https://git.jeckyll.net/published/personal/eds-ox/-/blob/main/demo/custom_shifter.ino?ref_type=heads)

Video demostration: [https://www.youtube.com/watch?v=uqFBi5RrbSE](https://www.youtube.com/watch?v=uqFBi5RrbSE)


# App

App seems to have several access levels which can be activated with some passwords. Account permissions are located in `User menu` -> `Account permissions`. They are:

- `User` - `1` - this is the default level
- `R&D` - `2`
- `Dealer` - `3`
- `OE Factory` - `4`

While these passwords are unknow they are validated against WT server (`121.196.97.253`). Communication is not encrypted and don't even use TLS. This open atack vector with using a simple MITM proxy.

## How to elevate account permissions

You will need to install [mitmproxy](https://mitmproxy.org/) and run it with simple script like that [mitm_wheeltop.py]:

```python
from mitmproxy import ctx
from mitmproxy import http
import json

def response(flow: http.HTTPFlow) -> None:
    data = flow.response.get_text()
    data = data.replace('"code":300', '"code":200')
    data = data.replace('"role":1', '"role":2')
    flow.response.text = data
```

Run the proxy: `mitmproxy -s mitm_wheeltop.py`. If you want to use proxy on non local addresses run it with `--set block_global=false` option. You can also set `--proxyauth username:password` to enable proxy authentication.

Then setup your phone to use proxy and point it to your MITM proxy.

Please note that Android don't allow you to set global proxy settings for all apps. You can use some app like [Super proxy](https://play.google.com/store/apps/details?id=com.scheler.superproxy).

After that you will be granted `R&D` access. No need to enter any password in the app. You can check access level by going to `User menu` -> `Account permissions`.

If you want to set other level, you can change `data = data.replace('"role":1', '"role":2')` line and set "role" to `3` or `4`.

Enjoy your new access level and unlocked features, like ability to micro adjust front derailleur!


## MQTT
It worth nothing to mention, that app uses MQTT to send some statistics to WT. MQTT broker is at `121.196.97.253`, username is `WHEELTOP` and password is `le21923ks`. There are at least two main topics: `/device/notifi/WHEELTOP/` and `/app/user/notifi/WHEELTOP/`.

Use can use:
```
mosquitto_sub -h 121.196.97.253 -p 1883 -u WHEELTOP -P le21923ks -t /device/notifi/WHEELTOP/# -v -d
Client null received PUBLISH (d0, q0, r0, m0, '/device/notifi/WHEELTOP/CE:1F:6C:D2:46:30', ... (102 bytes))
/device/notifi/WHEELTOP/CE:1F:6C:D2:46:30 {"rideStatus":1,"eventType":137,"id":36263,"type":"event","userId":18104,"device":"CE:1F:6C:D2:46:30"}
```
and
```
mosquitto_sub -h 121.196.97.253 -p 1883 -u WHEELTOP -P le21923ks -t /app/user/notifi/WHEELTOP/# -v -d
Client null received PUBLISH (d0, q0, r0, m0, '/app/user/notifi/WHEELTOP/16703', ... (174 bytes))
/app/user/notifi/WHEELTOP/16703 {"uid":"16703","type":"otherLogin","title":"其他设备登录","uuid":"0E4AFBD4-DE47-43EB-8D5F-198E3E8FC3E8","content":"你的账号已在其他设备登录","pushType":"1"}
```

Single username and password seems problematic, since everyone who know them can see all the information on the broker. There no ACLs imposed, which is not a good news.


# DISCLAIMER
This information is only for educational and personal use.

I'm not responsible if you damge your EDS OX. 