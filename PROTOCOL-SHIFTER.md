# OX

## Communication with the shifter

Communication with the shifter is different from communication with the app. It seems that is much simple and much faster. 

After wake up both RD and Shifter broadcast data. RD broadcast it's name (see above - [Communication with the app](#communication-with-the-app)).

On the other hand shifter is more cryptic. It broardcast some magic numbers for a bit: `070f0014556a8437023a0124000000000000000000`. 
What is known so far:
- `07 0f 00 14 55 6a 84` - prefix - seems to be the same for OX and TX
- `37` - device type - `37` = OX, `39` = TX Front, `36` = TX Left, `38` = TX Right
- `02 3a` - device firmware - 2.58
- `01 24` - device battery voltage * 100 - 292
- next 3 bytes vary for example `00 00 00`, `c8 b2 00`, `c2 f9 01`
- next 6 bytes are `00` at first

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