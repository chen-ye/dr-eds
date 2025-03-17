
const cacheName = 'drEDS-v10';

const broadcast = new BroadcastChannel('version-channel');
broadcast.onmessage = (event) => {
    if (event.data && event.data.type === 'VERSION') {
	broadcast.postMessage({ payload: cacheName });
    }
};

self.addEventListener('install', (e) => {
    console.log('[Service Worker] install');
});

self.addEventListener('activate', (e) => {
    console.log('[Service Worker] activate');

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
	console.log(`[Service Worker] get cached resource: ${e.request.url}`);
	if (r) return r;

	// not in cache
	const response = await fetch(e.request);
	const cache = await caches.open(cacheName);
	console.log(`[Service Worker] new caching resource: ${e.request.url}`);
	if (e.request.url.split(/[\\/]/).pop() != "sw.js")
	    cache.put(e.request, response.clone());
	return response;
    })());
});
