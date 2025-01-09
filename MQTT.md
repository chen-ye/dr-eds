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
