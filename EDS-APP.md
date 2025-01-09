# Official ppp

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
