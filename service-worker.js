// Service Worker for Smart Study Tracker
const CACHE_NAME = 'study-tracker-v3.1.0';
const APP_VERSION = '3.1.0';

// URLs to cache on install
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Montserrat:wght@800;900&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css',
    'https://cdn.jsdelivr.net/npm/flatpickr',
    'https://cdn.jsdelivr.net/npm/flatpickr/dist/l10n/bn.js'
];

// Generate notification sound using Web Audio API
function playNotificationSound(type = 'success') {
    try {
        // Check if Web Audio API is supported
        if (!window.AudioContext && !window.webkitAudioContext) {
            console.warn('Web Audio API not supported');
            return;
        }
        
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContext();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        // Different tones for different notification types
        switch(type) {
            case 'success':
                oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
                break;
            case 'error':
                oscillator.frequency.setValueAtTime(349.23, audioContext.currentTime); // F4
                break;
            case 'warning':
                oscillator.frequency.setValueAtTime(440.00, audioContext.currentTime); // A4
                break;
            default:
                oscillator.frequency.setValueAtTime(392.00, audioContext.currentTime); // G4
        }
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'sine';
        
        // Volume envelope
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
        
        // Clean up audio context
        setTimeout(() => {
            audioContext.close();
        }, 600);
    } catch (error) {
        console.error('Error playing notification sound:', error);
    }
}

// Install event - cache all resources
self.addEventListener('install', event => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Caching app shell and core assets');
                return cache.addAll(urlsToCache.map(url => {
                    // Create requests with proper credentials mode
                    return new Request(url, {
                        credentials: 'same-origin',
                        mode: 'no-cors'
                    });
                })).catch(error => {
                    console.warn('Failed to cache some resources:', error);
                    // Continue even if some resources fail to cache
                });
            })
            .then(() => {
                console.log('Service Worker: Assets cached successfully');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('Service Worker: Cache installation failed:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Delete old caches that don't match current CACHE_NAME
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
        .then(() => {
            console.log('Service Worker: Claiming clients');
            return self.clients.claim();
        })
        .then(() => {
            // Send message to all clients about new version
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'NEW_VERSION',
                        version: APP_VERSION
                    });
                });
            });
        })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }
    
    // Skip browser extensions
    if (event.request.url.startsWith('chrome-extension://') || 
        event.request.url.includes('extension://')) {
        return;
    }
    
    // For API requests, go to network first
    if (event.request.url.includes('/api/')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Cache API responses if needed
                    if (response.status === 200) {
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // If network fails, try cache
                    return caches.match(event.request);
                })
        );
        return;
    }
    
    // For non-API requests, try cache first
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                // Return cached response if found
                if (cachedResponse) {
                    // Update cache in background
                    fetch(event.request)
                        .then(networkResponse => {
                            if (networkResponse && networkResponse.status === 200) {
                                const responseToCache = networkResponse.clone();
                                caches.open(CACHE_NAME)
                                    .then(cache => {
                                        cache.put(event.request, responseToCache);
                                    });
                            }
                        })
                        .catch(() => {
                            // Ignore fetch errors for background update
                        });
                    
                    return cachedResponse;
                }
                
                // Otherwise fetch from network
                return fetch(event.request)
                    .then(networkResponse => {
                        // Check if we received a valid response
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }
                        
                        // Clone the response
                        const responseToCache = networkResponse.clone();
                        
                        // Add to cache for future use
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                        
                        return networkResponse;
                    })
                    .catch(error => {
                        console.log('Fetch failed; returning offline page:', error);
                        
                        // If it's a navigation request, return offline page
                        if (event.request.mode === 'navigate') {
                            return caches.match('./index.html');
                        }
                        
                        // For CSS/JS requests, return empty response
                        if (event.request.url.includes('.css')) {
                            return new Response('', {
                                status: 200,
                                headers: { 'Content-Type': 'text/css' }
                            });
                        }
                        
                        if (event.request.url.includes('.js')) {
                            return new Response('', {
                                status: 200,
                                headers: { 'Content-Type': 'application/javascript' }
                            });
                        }
                        
                        // For other requests, return a fallback
                        return new Response('Network error occurred', {
                            status: 408,
                            headers: { 'Content-Type': 'text/plain' }
                        });
                    });
            })
    );
});

// Background sync for data
self.addEventListener('sync', event => {
    console.log('Service Worker: Background sync triggered', event.tag);
    
    if (event.tag === 'sync-study-data') {
        event.waitUntil(syncStudyData());
    }
});

// Push notifications
self.addEventListener('push', event => {
    console.log('Service Worker: Push notification received', event);
    
    if (!event.data) {
        console.log('Push event but no data');
        return;
    }
    
    let data;
    try {
        data = event.data.json();
    } catch (error) {
        console.log('Push data is not JSON, using text');
        data = {
            title: 'Study Tracker',
            body: event.data.text() || 'Notification',
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📚</text></svg>',
            tag: 'study-tracker-notification'
        };
    }
    
    const options = {
        body: data.body || 'Study Tracker Notification',
        icon: data.icon || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📚</text></svg>',
        badge: data.badge || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#6c63ff"/></svg>',
        tag: data.tag || 'study-tracker-notification',
        data: {
            url: data.url || './',
            timestamp: new Date().getTime()
        },
        actions: data.actions || [],
        requireInteraction: data.requireInteraction || false,
        silent: data.silent || false,
        vibrate: data.vibrate || [200, 100, 200]
    };
    
    // Play notification sound
    playNotificationSound(data.type || 'info');
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'Study Tracker', options)
    );
});

// Notification click event
self.addEventListener('notificationclick', event => {
    console.log('Service Worker: Notification clicked', event);
    
    event.notification.close();
    
    const urlToOpen = event.notification.data.url || './';
    
    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then(clientList => {
            // Check if there's already a window/tab open with the target URL
            for (const client of clientList) {
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            
            // If not, open a new window/tab
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// Message event handler
self.addEventListener('message', event => {
    console.log('Service Worker: Message received', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'PLAY_SOUND') {
        playNotificationSound(event.data.soundType || 'info');
    }
    
    if (event.data && event.data.type === 'GET_VERSION') {
        event.source.postMessage({
            type: 'VERSION_INFO',
            version: APP_VERSION,
            cacheName: CACHE_NAME
        });
    }
});

// Background sync functions
async function syncStudyData() {
    try {
        console.log('Syncing study data in background...');
        
        // Get all clients
        const clients = await self.clients.matchAll();
        
        // Request sync data from each client
        for (const client of clients) {
            client.postMessage({
                type: 'REQUEST_SYNC_DATA'
            });
        }
        
        console.log('Study data synced successfully');
        
        // Show notification
        await self.registration.showNotification('Study Data Synced', {
            body: 'Your study progress has been synchronized',
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📚</text></svg>',
            badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#6c63ff"/></svg>',
            tag: 'sync-notification'
        });
        
        // Play success sound
        playNotificationSound('success');
        
    } catch (error) {
        console.error('Failed to sync study data:', error);
        playNotificationSound('error');
    }
}

// Handle offline/online events
self.addEventListener('online', () => {
    console.log('Service Worker: Online - triggering sync');
    
    // Trigger sync when coming back online
    self.registration.sync.register('sync-study-data')
        .then(() => console.log('Sync registered'))
        .catch(err => console.error('Sync registration failed:', err));
    
    // Notify clients about online status
    self.clients.matchAll().then(clients => {
        clients.forEach(client => {
            client.postMessage({
                type: 'NETWORK_STATUS',
                online: true
            });
        });
    });
});

self.addEventListener('offline', () => {
    console.log('Service Worker: Offline');
    
    // Notify clients about offline status
    self.clients.matchAll().then(clients => {
        clients.forEach(client => {
            client.postMessage({
                type: 'NETWORK_STATUS',
                online: false
            });
        });
    });
});

// Periodic background sync (if supported)
if ('periodicSync' in self.registration) {
    self.addEventListener('periodicsync', event => {
        if (event.tag === 'study-data-backup') {
            console.log('Periodic background sync triggered');
            event.waitUntil(syncStudyData());
        }
    });
}

// Handle fetch errors with better offline support
self.addEventListener('fetch', event => {
    // For navigation requests, try to serve the cached offline page
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                return caches.match('./index.html');
            })
        );
    }
});

// Install event - pre-cache important pages
self.addEventListener('install', event => {
    // Pre-cache the offline page
    const offlinePage = new Response(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Study Tracker - Offline</title>
            <style>
                body {
                    font-family: 'Poppins', sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    background: linear-gradient(135deg, #6c63ff, #ff6584);
                    color: white;
                    text-align: center;
                    padding: 20px;
                }
                .container {
                    max-width: 500px;
                }
                h1 {
                    font-size: 48px;
                    margin-bottom: 20px;
                }
                p {
                    font-size: 18px;
                    margin-bottom: 30px;
                }
                .icon {
                    font-size: 80px;
                    margin-bottom: 20px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="icon">📚</div>
                <h1>You're Offline</h1>
                <p>Study Tracker requires an internet connection to sync your data.</p>
                <p>Your cached data is still available for viewing.</p>
            </div>
        </body>
        </html>
    `, {
        headers: { 'Content-Type': 'text/html' }
    });
    
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.put('./offline.html', offlinePage);
        })
    );
});