# EDS OX

What is known so far:
- Rear derailleur (RD) and shifter use ble to communicate with each other
- RD fall to sleep after 20s
- Shifter fall to sleep after 10s

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

crc16 calculation is a bit of black magic, but with a little bit a help from the app it can be calculted. See code (when published).

Here are some commands:
- `0x11` => `getKey` - dec 17
- `0x97` => `getCurrentGear` - dec 151
- `0x98` => `serverReportGear` - dec 152
- `0x99` => `rearLifting` - dec 153
- `0xfa` => `startRead` - dec 250
- `0xfb` => `read` - dec 251
- `0x87` => `getFrontCurrentGear` - dec 135

Unfortunatly I (still) can't manage to receive a reply from RD when send commands which must retrive info. For example app send `startRead` and then multiple times `read` command to retrive information from RD. Here is information:

```
REMOTE_V:2.58,POWER_1:292,.
GEARS_V:2.89,POWER_2:712,.
TOTAL_CNT:12.NUM:6,PTOTECT:2,KeySwitch:0.
MCU_DATA:14,0,0,1,0,ErrList:0x20,0x0,0x0.
ERRCODE:0x0.
GEARS[1]:   0,GEARS[2]: 220,GEARS[3]: 450,GEARS[4]: 650,GEARS[5]: 860,GEARS[6]:1040,GEARS[7]:1240,GEARS[8]:1440,GEARS[9]:1680,GEARS[10]:1920,
```

As you can see here we have information about shifter firmware version, shifter battery voltage, RD firmware version, RD battery voltage, for how many gears RD is configured, current gear, how may steps RD must do for each gear and other information which is still unknown.

It is interesting that RD have no problem to switch gears with command `rearLifting`. You can see demo here: [https://youtu.be/mDlyekZ2KaY](https://youtu.be/mDlyekZ2KaY)

Demo uses `rearLifting` command. It just send `0xfe, 0x32, key, rearLifting, 0x01, 0x01, crc16, crc16` and then switch back to the same gear `0xfe, 0x32, key, rearLifting, 0x01, 0x02, crc16, crc16`. As you can see `0x01` and `0x02` are payloads for shift up and down.


## Communication with the shifter

Communication with the shifter is different from communication with the app. It seems that is much simple and much faster. 

After wake up both RD and Shifter broadcast data. RD broadcast it's name (see above - [Communication with the app](https://git.jeckyll.net/published/personal/eds-ox/-/blob/main/README.md?ref_type=heads#communication-with-the-app)).

On the other hand shifter is more cryptic. It broardcast some magic numbers for a bit: `070f0014556a8437023a0124000000000000000000`. For now only know part is `0124` which seems to be shifter battery voltage. In any case `070f0014556a8437023a` seems pretty consistent and doesn't change (at least on mine OX - need more testers). May be it is just a fixed value which RD seek when trying to connect, or it have some encrypted meaning ...

After couple of broadcast last part of the message (last 6 bytes) become RD mac address in reverse. It seems that shifter is listening for RD broadcasts and when it find OX device it put it's mac address in his own broadcast. 

Then RD make a connection to the shifter which become slave and RD become master device. 

Next RD look for primary service `6e400001-b5a3-f393-e0a9-e50e24dcca9e` and TX characteristic `6e400002-b5a3-f393-e0a9-e50e24dcca9e`. 

When shifter button is pressed it sends only 3 bytes: `0x04 0x01 0x05`. Here `0x04` is a prefix, `0x01` or `0x02` seems to be the button, and `0x05` looks like simpe xor checksum.

There is also repeat command `0x03` for `0x01` button | `0x04` for `0x02` button which is send when button is holded down for multiple shifts. Delay between button press and repeat command is about 1/2 a second. When button is released shifter send `0x09` for `0x01` button | `0x0a` for `0x02` button.

This means that shifter don't know on which gear RD is. It just send button is pressed, holded down or released.

Simple demo shifting can be found in file [shifter_up_down_on_wakeup.ino](https://git.jeckyll.net/published/personal/eds-ox/-/blob/main/demo/shifter_up_down_on_wakeup.ino?ref_type=heads) in `demo` folder. Demo will shift up and down every time RD is waked up.

## Pairing

First wake up RD (shake bike). Then attach magnetic connector. USB cable must be powered. After that RD led (side one, not top one which will be red for charging) will blink in blue. This seems to make RD to "forget" for old shifter and to try to connect to new one. Without this process RD never try to connect to new shifter.

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