// 🚀 ScanzoQR Service Worker - Production Ready
const CACHE_NAME = 'scanzo-qr-v2.1.0';
const STATIC_CACHE = 'scanzo-static-v2.1.0';
const DYNAMIC_CACHE = 'scanzo-dynamic-v2.1.0';

// Essential files to cache for offline functionality
const STATIC_ASSETS = [
    './',
    './index.html',
    './styles.css',
    './manifest.json',
    './icons/icon-72.png',
    './icons/icon-96.png',
    './icons/icon-128.png',
    './icons/icon-144.png',
    './icons/icon-152.png',
    './icons/icon-192.png',
    './icons/icon-384.png',
    './icons/icon-512.png',
    // Essential external resources
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
    'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'
];

// Dynamic content patterns
const DYNAMIC_PATTERNS = [
    /^https:\/\/fonts\.gstatic\.com\//,
    /^https:\/\/cdnjs\.cloudflare\.com\//,
    /^https:\/\/cdn\.jsdelivr\.net\//
];

// 🎯 Install Event - Cache Static Assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker v2.1.0');
    
    event.waitUntil(
        (async () => {
            try {
                // Clear old caches first
                const cacheNames = await caches.keys();
                await Promise.all(
                    cacheNames
                        .filter(name => name.startsWith('scanzo-') && name !== STATIC_CACHE)
                        .map(name => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );

                // Cache static assets
                const staticCache = await caches.open(STATIC_CACHE);
                console.log('[SW] Caching static assets...');
                
                // Cache assets one by one with error handling
                const cachePromises = STATIC_ASSETS.map(async (url) => {
                    try {
                        const response = await fetch(url, {
                            mode: 'cors',
                            cache: 'default'
                        });
                        
                        if (response.ok) {
                            await staticCache.put(url, response);
                            console.log('[SW] Cached:', url);
                        } else {
                            console.warn('[SW] Failed to cache (bad response):', url);
                        }
                    } catch (error) {
                        console.warn('[SW] Failed to cache (network error):', url, error.message);
                    }
                });

                await Promise.allSettled(cachePromises);
                console.log('[SW] Static assets cached successfully');
                
                // Force activation
                self.skipWaiting();
                
            } catch (error) {
                console.error('[SW] Install failed:', error);
            }
        })()
    );
});

// 🔄 Activate Event - Clean Up & Take Control
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker v2.1.0');
    
    event.waitUntil(
        (async () => {
            try {
                // Clean up old caches
                const cacheNames = await caches.keys();
                const deletePromises = cacheNames
                    .filter(name => {
                        return name.startsWith('scanzo-') && 
                               name !== STATIC_CACHE && 
                               name !== DYNAMIC_CACHE;
                    })
                    .map(name => {
                        console.log('[SW] Deleting obsolete cache:', name);
                        return caches.delete(name);
                    });

                await Promise.all(deletePromises);
                
                // Take control of all clients immediately
                await self.clients.claim();
                console.log('[SW] Service Worker activated and claimed all clients');
                
            } catch (error) {
                console.error('[SW] Activation failed:', error);
            }
        })()
    );
});

// 🌐 Fetch Event - Advanced Caching Strategy
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip Chrome extension requests
    if (url.protocol === 'chrome-extension:') {
        return;
    }

    event.respondWith(handleFetch(request));
});

// 🎯 Advanced Fetch Handler
async function handleFetch(request) {
    const url = new URL(request.url);
    
    try {
        // Strategy 1: Static Assets (Cache First)
        if (STATIC_ASSETS.some(asset => request.url.includes(asset.replace('./', '')))) {
            return await cacheFirst(request, STATIC_CACHE);
        }
        
        // Strategy 2: Dynamic Content (Network First with Cache Fallback)
        if (DYNAMIC_PATTERNS.some(pattern => pattern.test(request.url))) {
            return await networkFirstWithCache(request, DYNAMIC_CACHE);
        }
        
        // Strategy 3: Same Origin (Stale While Revalidate)
        if (url.origin === self.location.origin) {
            return await staleWhileRevalidate(request, STATIC_CACHE);
        }
        
        // Strategy 4: External Resources (Network First)
        return await networkFirst(request);
        
    } catch (error) {
        console.error('[SW] Fetch failed:', request.url, error);
        return await handleFetchError(request);
    }
}

// 📦 Cache First Strategy
async function cacheFirst(request, cacheName) {
    try {
        const cache = await caches.open(cacheName);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            console.log('[SW] Cache hit:', request.url);
            return cachedResponse;
        }
        
        console.log('[SW] Cache miss, fetching:', request.url);
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            await cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
        
    } catch (error) {
        console.error('[SW] Cache first failed:', error);
        return new Response('Offline - Resource not available', { 
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

// 🌐 Network First with Cache Fallback
async function networkFirstWithCache(request, cacheName) {
    try {
        const networkResponse = await fetch(request, {
            mode: 'cors',
            cache: 'default'
        });
        
        if (networkResponse.ok) {
            const cache = await caches.open(cacheName);
            await cache.put(request, networkResponse.clone());
            console.log('[SW] Network success, cached:', request.url);
        }
        
        return networkResponse;
        
    } catch (error) {
        console.log('[SW] Network failed, trying cache:', request.url);
        
        const cache = await caches.open(cacheName);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            console.log('[SW] Served from cache:', request.url);
            return cachedResponse;
        }
        
        throw error;
    }
}

// 🔄 Stale While Revalidate Strategy
async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    // Async revalidate in background
    const fetchPromise = fetch(request).then(networkResponse => {
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    }).catch(error => {
        console.warn('[SW] Background revalidation failed:', error);
    });
    
    // Return cached version immediately if available
    if (cachedResponse) {
        console.log('[SW] Stale while revalidate - cache hit:', request.url);
        return cachedResponse;
    }
    
    // Wait for network if no cache
    console.log('[SW] Stale while revalidate - waiting for network:', request.url);
    return await fetchPromise;
}

// 🌐 Network First Strategy
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        console.log('[SW] Network first success:', request.url);
        return networkResponse;
        
    } catch (error) {
        console.log('[SW] Network first failed:', request.url);
        throw error;
    }
}

// ❌ Error Handler
async function handleFetchError(request) {
    const url = new URL(request.url);
    
    // Return offline page for HTML requests
    if (request.headers.get('Accept')?.includes('text/html')) {
        return new Response(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>ScanzoQR - Offline</title>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { 
                        font-family: 'Inter', sans-serif; 
                        text-align: center; 
                        padding: 50px; 
                        background: #0D1117; 
                        color: #F0F6FC; 
                    }
                    .offline-icon { font-size: 64px; margin-bottom: 20px; }
                    .offline-title { font-size: 24px; margin-bottom: 16px; }
                    .offline-message { color: #8B949E; margin-bottom: 24px; }
                    .retry-btn { 
                        background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%); 
                        color: white; 
                        border: none; 
                        padding: 12px 24px; 
                        border-radius: 12px; 
                        cursor: pointer; 
                        font-weight: 600;
                    }
                </style>
            </head>
            <body>
                <div class="offline-icon">📱</div>
                <h1 class="offline-title">You're Offline</h1>
                <p class="offline-message">ScanzoQR works offline! Your cached content is still available.</p>
                <button class="retry-btn" onclick="location.reload()">Try Again</button>
            </body>
            </html>
        `, {
            status: 200,
            headers: { 'Content-Type': 'text/html' }
        });
    }
    
    // Return generic offline response for other requests
    return new Response('Offline', { 
        status: 503,
        statusText: 'Service Unavailable'
    });
}

// 💬 Message Handler for Communication with Main Thread
self.addEventListener('message', (event) => {
    const { type, payload } = event.data;
    
    switch (type) {
        case 'SKIP_WAITING':
            console.log('[SW] Received SKIP_WAITING message');
            self.skipWaiting();
            break;
            
        case 'GET_VERSION':
            event.ports[0].postMessage({
                type: 'VERSION_RESPONSE',
                version: CACHE_NAME
            });
            break;
            
        case 'CLEAR_CACHE':
            clearAllCaches().then(() => {
                event.ports[0].postMessage({
                    type: 'CACHE_CLEARED',
                    success: true
                });
            }).catch(error => {
                event.ports[0].postMessage({
                    type: 'CACHE_CLEARED',
                    success: false,
                    error: error.message
                });
            });
            break;
            
        case 'CACHE_STATUS':
            getCacheStatus().then(status => {
                event.ports[0].postMessage({
                    type: 'CACHE_STATUS_RESPONSE',
                    status
                });
            });
            break;
            
        default:
            console.log('[SW] Unknown message type:', type);
    }
});

// 🧹 Clear All Caches
async function clearAllCaches() {
    try {
        const cacheNames = await caches.keys();
        await Promise.all(
            cacheNames
                .filter(name => name.startsWith('scanzo-'))
                .map(name => caches.delete(name))
        );
        console.log('[SW] All caches cleared');
        return true;
    } catch (error) {
        console.error('[SW] Failed to clear caches:', error);
        throw error;
    }
}

// 📊 Get Cache Status
async function getCacheStatus() {
    try {
        const cacheNames = await caches.keys();
        const status = {};
        
        for (const name of cacheNames) {
            if (name.startsWith('scanzo-')) {
                const cache = await caches.open(name);
                const keys = await cache.keys();
                status[name] = {
                    size: keys.length,
                    urls: keys.map(request => request.url)
                };
            }
        }
        
        return status;
    } catch (error) {
        console.error('[SW] Failed to get cache status:', error);
        return {};
    }
}

// 🔄 Background Sync (for future enhancement)
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync triggered:', event.tag);
    
    if (event.tag === 'background-sync') {
        event.waitUntil(handleBackgroundSync());
    }
});

async function handleBackgroundSync() {
    try {
        // Sync any pending data when back online
        console.log('[SW] Performing background sync...');
        
        // Future: Sync QR history, settings, etc.
        // For now, just update caches
        const cache = await caches.open(STATIC_CACHE);
        const requests = await cache.keys();
        
        for (const request of requests) {
            try {
                const response = await fetch(request);
                if (response.ok) {
                    await cache.put(request, response);
                }
            } catch (error) {
                console.warn('[SW] Background sync failed for:', request.url);
            }
        }
        
        console.log('[SW] Background sync completed');
        
    } catch (error) {
        console.error('[SW] Background sync error:', error);
    }
}

// 🔔 Push Notifications (for future enhancement)
self.addEventListener('push', (event) => {
    console.log('[SW] Push message received');
    
    const options = {
        body: 'ScanzoQR has been updated with new features!',
        icon: './icons/icon-192.png',
        badge: './icons/icon-96.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: 'Explore',
                icon: './icons/icon-192.png'
            },
            {
                action: 'close',
                title: 'Close',
                icon: './icons/icon-192.png'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('ScanzoQR Update', options)
    );
});

// 🔔 Notification Click Handler
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event.action);
    
    event.notification.close();
    
    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// 📱 Periodic Background Sync (for future PWA features)
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'update-cache') {
        event.waitUntil(updateCachePeriodically());
    }
});

async function updateCachePeriodically() {
    try {
        console.log('[SW] Periodic cache update started');
        
        // Update critical resources
        const cache = await caches.open(STATIC_CACHE);
        const criticalUrls = ['./', './index.html', './styles.css'];
        
        for (const url of criticalUrls) {
            try {
                const response = await fetch(url);
                if (response.ok) {
                    await cache.put(url, response);
                }
            } catch (error) {
                console.warn('[SW] Periodic update failed for:', url);
            }
        }
        
        console.log('[SW] Periodic cache update completed');
        
    } catch (error) {
        console.error('[SW] Periodic sync error:', error);
    }
}

console.log('[SW] Service Worker v2.1.0 script loaded');
