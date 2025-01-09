# Demos
Couple of demos using `EPS32`

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