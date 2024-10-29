# How to debug EDS OX

This document will help you with setup debug environment and collecting data about EDS OX and Bluetooth communication in general

## What you need

### Hardware
1. Some kind of Blutooth sniffing device. For example: [Holyiot nRF52840 USB dongle](https://vi.aliexpress.com/item/1005004708842967.html)
2. Original magnetic charging cable or replacement like: [Magnetic Charging Cable USB](https://vi.aliexpress.com/item/1005005089724589.html)
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

Sniffer firmware is located in `hex` folder in `nRF sniffer for Bluetooth` package (see 1 from software section)

More information can be found in Nordic website: [https://docs.nordicsemi.com/bundle/nrfutil/page/nrfutil-ble-sniffer/guides/overview.html](https://docs.nordicsemi.com/bundle/nrfutil/page/nrfutil-ble-sniffer/guides/overview.html)

## How to sniff

Sniffing process can be seen in `Part 2` video in software section.