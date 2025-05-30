
const cacheName = 'drEDS-v33';

const broadcast = new BroadcastChannel('dreds-channel');
broadcast.onmessage = (event) => {
    if (event.data && event.data.type === 'VERSION') {
	console.log('[Service Worker] get version');
	broadcast.postMessage({ type: event.data.type, payload: cacheName });
    } else
    if (event.data && event.data.type === "CACHE") {
	console.log('[Service Worker] get cache');
	var url = [];
	caches.open(cacheName).then(function (cache) {
	    cache.keys().then(function(keys) {
		return Promise.all(
                    keys.map(function(k) {
                	url.push(k.url);
                	return k.url;
		    })
                )
            }).then(function(u) {
        	broadcast.postMessage({ type: event.data.type, payload: url });
	    })
	});
    }
};

self.addEventListener('install', (e) => {
    console.log('[Service Worker] install');

    // force new service worker to be used
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    console.log('[Service Worker] activate');

    // delete old cache
    e.waitUntil(
        caches.keys().then((keyList) => {
	    return Promise.all(
		keyList.map((key) => {
		    if (key === cacheName) {
		        return;
        	    }
        	    return caches.delete(key);
    		}),
    	    );
	}),
    );

    // force new service worker to be used
    e.waitUntil(clients.claim());

    // notify app to reload itself to cache files
    broadcast.postMessage({ type: "ACTIVATE", payload: "RELOAD" });
});

self.addEventListener("fetch", (e) => {
    // Cache http and https only, skip unsupported chrome-extension:// and file://...
    if (!(
	e.request.url.startsWith('http:') || e.request.url.startsWith('https:')
    )) {
	return;
    }

    e.respondWith((async () => {
	// we got item in cache
	const r = await caches.match(e.request);
	if (r) {
	    console.log(`[Service Worker] get cached resource: ${e.request.url}`);
	    return r;
	}

	// not in cache
	const response = await fetch(e.request);
	const cache = await caches.open(cacheName);
	console.log(`[Service Worker] new caching resource: ${e.request.url}`);
	if (e.request.url.split(/[\\/]/).pop() != "sw.js")
	    cache.put(e.request, response.clone());
	return response;
    }) ());
});
