# How to debug EDS OX

This document will help you with setup debug environment and collecting data about EDS OX and Bluetooth communication in general

## What you need

### Hardware
1. Some kind of Blutooth sniffing device. For example: [Holyiot nRF52840 USB dongle](https://vi.aliexpress.com/item/1005004708842967.html) - please contact seller to send corrected hardware dongle!
2. Original magnetic charging cable or replacement like: [Magnetic Charging Cable USB](https://vi.aliexpress.com/item/1005005089724589.html) - be sure to purchase correct cable - 2.5mm-8mm NS! Check polarity with DMM before using it - reverse polarity may (always) damage your RD!
3. Power bank or USB charger

### Software
1. [nRF sniffer for Bluetooth](https://www.nordicsemi.com/Products/Development-tools/nRF-Sniffer-for-Bluetooth-LE/Download?lang=en#infotabs)
2. [Wireshark](https://www.wireshark.org/)
3. [Python](https://www.python.org/downloads/)

There is very good video explaining setup process and sniffing here:
- [Part 1](https://youtu.be/JIh2YYwkzoE)
- [Part 2](https://youtu.be/_2RuJ5-pF5I)

### Flashing (depends from dongle)
Some USB dongles come preflashed with sniffer firmware, but linked above does not. Flashing is simple process, but you need [nRF Connect](https://www.nordicsemi.com/Products/Development-tools/nRF-Connect-for-Desktop/Download#infotabs)

Sniffer firmware is located in `hex` folder in `nRF sniffer for Bluetooth` package (see 1 from software section).

More information can be found in Nordic website: [https://docs.nordicsemi.com/bundle/nrfutil/page/nrfutil-ble-sniffer/guides/overview.html](https://docs.nordicsemi.com/bundle/nrfutil/page/nrfutil-ble-sniffer/guides/overview.html)

NOTE: My first `Holyiot nRF52840 USB dongle` was with hardware bug and doesn't work after flashing. There is patch for firmware to make it work - [https://github.com/danielstuart14/nrfsniffer_patcher/tree/master](https://github.com/danielstuart14/nrfsniffer_patcher/tree/master)

## How to sniff

Sniffing process can be seen in `Part 2` video in software section.

RD is very easy to be found in Wireshark list of Bluetooth devices, since it advertise it's name. 

Shifter on the other hand is not so easy to be found, sice it advertise itself for a very brief time, until it is connected by the RD. If you can go to place without any or minimal Blutooth devices, to find your Shifter adres.

Easier way I found is to remove shifter battery and put it back. For a short time shifter mac address and broadcast will appear in wiresharl. Then select mac address to start sniffing shifter trafick and repeat remove/insert battery to get actuall traffic between shifter and RD.