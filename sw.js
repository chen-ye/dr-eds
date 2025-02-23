
const cacheName = 'drEDS-v1';

/*const contentToCache = [
    '/index.html',

    '/css/style.css',
    '/css/opensans.css',

    '/lang/en.js',
    '/lang/bg.js',
    '/lang/es.js',
    '/lang/de.js',
    '/lang/en.css',
    '/lang/bg.css',
    '/lang/es.css',
    '/lang/de.css',
];*/

self.addEventListener('install', (e) => {
    console.log('[Service Worker] install');

    /*e.waitUntil((async () => {
	const cache = await caches.open(cacheName);
	console.log('[Service Worker] caching all: app shell and content');
	await cache.addAll(contentToCache);
    })());*/
});

self.addEventListener('activate', (e) => {
    //console.log('[Service Worker] activate');
    //return self.clients.claim();
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
	cache.put(e.request, response.clone());
	return response;
    })());
});
