// Service Worker for Story App
// Using traditional service worker format (not ES6 modules) for better compatibility

// Log level control
const LOG_LEVEL = {
  NONE: 0,
  ERROR: 1,
  WARN: 2,
  INFO: 3,
  DEBUG: 4
};

// Set log level based on environment
// In production, only show errors and warnings
// In development, show more detailed logs
const isDevelopment = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';
const CURRENT_LOG_LEVEL = isDevelopment ? LOG_LEVEL.INFO : LOG_LEVEL.WARN;

// Logging utility
function log(level, message, ...args) {
  if (level <= CURRENT_LOG_LEVEL) {
    switch (level) {
      case LOG_LEVEL.ERROR:
        console.error(`[SW] ${message}`, ...args);
        break;
      case LOG_LEVEL.WARN:
        console.warn(`[SW] ${message}`, ...args);
        break;
      case LOG_LEVEL.INFO:
        console.info(`[SW] ${message}`, ...args);
        break;
      case LOG_LEVEL.DEBUG:
        console.log(`[SW] ${message}`, ...args);
        break;
    }
  }
}

const CACHE_NAME = 'StoryApp-v2';
const API_CACHE_NAME = 'StoryApp-API-v2';
const IMAGE_CACHE_NAME = 'StoryApp-Images-v2';

const urlsToCache = [
  '/',
  '/index.html',
  '/app.bundle.js',
  '/favicon.png',
  '/manifest.json',
  '/images/default-story.jpg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install event
self.addEventListener('install', (event) => {
  log(LOG_LEVEL.INFO, 'Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        log(LOG_LEVEL.INFO, 'Opened cache');
        return cache.addAll(urlsToCache).catch((error) => {
          log(LOG_LEVEL.WARN, 'Some resources failed to cache:', error);
          // Continue with installation even if some resources fail to cache
          return Promise.resolve();
        });
      })
      .then(() => {
        // Pre-cache some common map tiles
        return preCacheCommonMapTiles();
      })
      .then(() => {
        log(LOG_LEVEL.INFO, 'Service Worker installed successfully');
        // Skip waiting to activate immediately
        return self.skipWaiting();
      })
  );
});

// Helper function to pre-cache common map tiles
async function preCacheCommonMapTiles() {
  try {
    const imageCache = await caches.open(IMAGE_CACHE_NAME);
    
    // Common map tiles for Indonesia area (zoom level 10-12)
    const commonTiles = [
      'https://a.tile.openstreetmap.org/10/511/256.png',
      'https://b.tile.openstreetmap.org/10/511/256.png',
      'https://c.tile.openstreetmap.org/10/511/256.png',
      'https://a.tile.openstreetmap.org/11/1022/512.png',
      'https://b.tile.openstreetmap.org/11/1022/512.png',
      'https://c.tile.openstreetmap.org/11/1022/512.png',
      'https://a.tile.openstreetmap.org/12/2044/1024.png',
      'https://b.tile.openstreetmap.org/12/2044/1024.png',
      'https://c.tile.openstreetmap.org/12/2044/1024.png'
    ];
    
    let cachedCount = 0;
    const tilePromises = commonTiles.map(async (tileUrl) => {
      try {
        const response = await fetch(tileUrl);
        if (response.ok) {
          const responseToCache = response.clone();
          await imageCache.put(tileUrl, responseToCache);
          cachedCount++;
        }
      } catch (error) {
        log(LOG_LEVEL.WARN, 'Failed to pre-cache map tile:', tileUrl, error);
      }
    });
    
    await Promise.allSettled(tilePromises);
    log(LOG_LEVEL.INFO, `Map tiles pre-caching completed: ${cachedCount}/${commonTiles.length} tiles cached`);
  } catch (error) {
    log(LOG_LEVEL.WARN, 'Failed to pre-cache map tiles:', error);
  }
}

// Fetch event
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip chrome-extension requests and other non-app requests
  if (url.protocol === 'chrome-extension:' || 
      url.protocol === 'moz-extension:' || 
      url.protocol === 'ms-browser-extension:' ||
      url.hostname === 'localhost' && url.port !== '' ||
      url.hostname === '127.0.0.1' && url.port !== '') {
    return;
  }

  // Handle API requests (login, register, stories) with network-first strategy
  if (url.hostname.includes('story-api.dicoding.dev')) {
    log(LOG_LEVEL.DEBUG, 'Handling API request:', request.url);
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle story images from API specifically
  if (url.hostname.includes('story-api.dicoding.dev') && url.pathname.includes('/images/stories/')) {
    log(LOG_LEVEL.DEBUG, 'Handling story image request:', request.url);
    event.respondWith(handleStoryImageRequest(request));
    return;
  }

  // Handle map tiles with cache-first strategy
  if (url.hostname.includes('tile.openstreetmap.org')) {
    log(LOG_LEVEL.DEBUG, 'Handling map tile request:', request.url);
    event.respondWith(handleMapTileRequest(request));
    return;
  }

  // Handle other image requests with cache-first strategy
  if (request.destination === 'image') {
    log(LOG_LEVEL.DEBUG, 'Handling general image request:', request.url);
    event.respondWith(handleImageRequest(request));
    return;
  }

  // Handle other requests with network-first
  log(LOG_LEVEL.DEBUG, 'Handling other request:', request.url);
  event.respondWith(handleOtherRequest(request));
});

// Network-first for API requests (login, register, stories)
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE_NAME);
  
  try {
    // Try network first for API requests
    const response = await fetch(request);
    
    if (response.ok) {
      // Cache successful API responses
      const responseToCache = response.clone();
      await cache.put(request, responseToCache);
      
      // If this is a stories request, also cache the story images
      if (request.url.includes('/stories') && !request.url.includes('/stories/')) {
        try {
          // Clone response again for reading JSON data
          const responseForJson = response.clone();
          const responseData = await responseForJson.json();
          if (responseData.listStory && responseData.listStory.length > 0) {
            await cacheStoryImages(responseData.listStory);
          }
        } catch (error) {
          log(LOG_LEVEL.WARN, 'Failed to cache story images:', error);
        }
      }
      
      return response;
    }
    
    // If response is not ok, throw error
    throw new Error(`API request failed with status: ${response.status}`);
    
  } catch (error) {
    log(LOG_LEVEL.WARN, 'Network failed for API request, trying cache:', request.url, error);
    
    // If network fails, try cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      log(LOG_LEVEL.INFO, 'Serving API response from cache:', request.url);
      return cachedResponse;
    }
    
    // If both network and cache fail, return appropriate error response
    if (request.url.includes('/login') || request.url.includes('/register')) {
      // For login/register, return JSON error response
      return new Response(JSON.stringify({
        error: 'No internet connection',
        message: 'Unable to authenticate. Please check your connection and try again.'
      }), {
        status: 503,
        statusText: 'Service Unavailable',
        headers: {
          'Content-Type': 'application/json',
        }
      });
    } else if (request.url.includes('/stories')) {
      // For stories, return JSON with empty list
      return new Response(JSON.stringify({
        error: 'No internet connection',
        listStory: [],
        message: 'Unable to fetch stories. Please check your connection.'
      }), {
        status: 503,
        statusText: 'Service Unavailable',
        headers: {
          'Content-Type': 'application/json',
        }
      });
    } else {
      // For other API requests
      return new Response(JSON.stringify({
        error: 'No internet connection',
        message: 'Service unavailable. Please check your connection.'
      }), {
        status: 503,
        statusText: 'Service Unavailable',
        headers: {
          'Content-Type': 'application/json',
        }
      });
    }
  }
}

// Cache story images
async function cacheStoryImages(stories) {
  try {
    const imageCache = await caches.open(IMAGE_CACHE_NAME);
    const imagePromises = stories.map(async (story) => {
      if (story.photoUrl) {
        try {
          const response = await fetch(story.photoUrl);
          if (response.ok) {
            const responseToCache = response.clone();
            await imageCache.put(story.photoUrl, responseToCache);
            log(LOG_LEVEL.DEBUG, 'Cached story image:', story.photoUrl);
          }
        } catch (error) {
          log(LOG_LEVEL.WARN, 'Failed to cache story image:', story.photoUrl, error);
        }
      }
    });
    
    await Promise.allSettled(imagePromises);
    log(LOG_LEVEL.INFO, 'Story images caching completed');
  } catch (error) {
    log(LOG_LEVEL.WARN, 'Failed to cache story images:', error);
  }
}

// Cache-first for story images
async function handleStoryImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE_NAME);
  
  // Try cache first
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    log(LOG_LEVEL.DEBUG, 'Serving story image from cache:', request.url);
    return cachedResponse;
  }
  
  // If not in cache, try to fetch and cache
  try {
    const response = await fetch(request);
    if (response.ok) {
      const responseToCache = response.clone();
      await cache.put(request, responseToCache);
      log(LOG_LEVEL.DEBUG, 'Cached new story image:', request.url);
    }
    return response;
  } catch (error) {
    log(LOG_LEVEL.WARN, 'Failed to fetch story image:', request.url, error);
    // Return a placeholder image or default image
    return cache.match('/images/default-story.jpg') || new Response('Image not available', { status: 404 });
  }
}

// Cache-first for map tiles
async function handleMapTileRequest(request) {
  const cache = await caches.open(IMAGE_CACHE_NAME);
  
  // Try cache first
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // If not in cache, try to fetch and cache
  try {
    const response = await fetch(request);
    if (response.ok) {
      const responseToCache = response.clone();
      await cache.put(request, responseToCache);
    }
    return response;
  } catch (error) {
    log(LOG_LEVEL.WARN, 'Failed to fetch map tile:', request.url, error);
    // Return a placeholder or empty response
    return new Response('', { status: 404 });
  }
}

// Cache-first for general images
async function handleImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE_NAME);
  
  // Try cache first
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // If not in cache, try to fetch and cache
  try {
    const response = await fetch(request);
    if (response.ok) {
      const responseToCache = response.clone();
      await cache.put(request, responseToCache);
    }
    return response;
  } catch (error) {
    log(LOG_LEVEL.WARN, 'Failed to fetch image:', request.url, error);
    // Return a placeholder or empty response
    return new Response('', { status: 404 });
  }
}

// Network-first for other requests
async function handleOtherRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  
  try {
    // Try network first
    const response = await fetch(request);
    if (response.ok) {
      // Cache successful responses
      const responseToCache = response.clone();
      await cache.put(request, responseToCache);
    }
    return response;
  } catch (error) {
    log(LOG_LEVEL.WARN, 'Network failed, trying cache:', request.url, error);
    
    // If network fails, try cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If both network and cache fail, return a fallback for HTML requests
    if (request.destination === 'document' || request.mode === 'navigate') {
      return cache.match('/index.html') || new Response('Offline - Please check your connection', { status: 503 });
    }
    
    // For other requests, return error
    return new Response('Not available offline', { status: 503 });
  }
}

// Activate event
self.addEventListener('activate', (event) => {
  log(LOG_LEVEL.INFO, 'Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && 
              cacheName !== API_CACHE_NAME && 
              cacheName !== IMAGE_CACHE_NAME) {
            log(LOG_LEVEL.INFO, 'Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Clean up old story images (keep only recent ones)
      return cleanupOldStoryImages();
    }).then(() => {
      // Log cache statistics
      return getCacheStats();
    }).then((stats) => {
      log(LOG_LEVEL.INFO, 'Service Worker activated successfully');
      log(LOG_LEVEL.INFO, 'Current cache statistics:', stats);
      // Claim all clients immediately
      return self.clients.claim();
    })
  );
});

// Helper function to clean up old story images
async function cleanupOldStoryImages() {
  try {
    const imageCache = await caches.open(IMAGE_CACHE_NAME);
    const requests = await imageCache.keys();
    
    // Filter story images (from story-api.dicoding.dev)
    const storyImageRequests = requests.filter(request => 
      request.url.includes('story-api.dicoding.dev')
    );
    
    // Filter map tiles (from openstreetmap.org)
    const mapTileRequests = requests.filter(request => 
      request.url.includes('tile.openstreetmap.org')
    );
    
    // If we have too many story images, remove the oldest ones
    const MAX_STORY_IMAGES = 100; // Increased limit for better offline experience
    if (storyImageRequests.length > MAX_STORY_IMAGES) {
      const imagesToRemove = storyImageRequests.slice(0, storyImageRequests.length - MAX_STORY_IMAGES);
      await Promise.all(imagesToRemove.map(request => imageCache.delete(request)));
      log(LOG_LEVEL.INFO, `Cleaned up ${imagesToRemove.length} old story images`);
    }
    
    // If we have too many map tiles, remove the oldest ones
    const MAX_MAP_TILES = 200; // Increased limit for better offline experience
    if (mapTileRequests.length > MAX_MAP_TILES) {
      const tilesToRemove = mapTileRequests.slice(0, mapTileRequests.length - MAX_MAP_TILES);
      await Promise.all(tilesToRemove.map(request => imageCache.delete(request)));
      log(LOG_LEVEL.INFO, `Cleaned up ${tilesToRemove.length} old map tiles`);
    }
  } catch (error) {
    log(LOG_LEVEL.WARN, 'Failed to cleanup old images:', error);
  }
}

// Helper function to get cache statistics
async function getCacheStats() {
  try {
    const imageCache = await caches.open(IMAGE_CACHE_NAME);
    const requests = await imageCache.keys();
    
    const storyImages = requests.filter(request => 
      request.url.includes('story-api.dicoding.dev')
    ).length;
    
    const mapTiles = requests.filter(request => 
      request.url.includes('tile.openstreetmap.org')
    ).length;
    
    const otherImages = requests.filter(request => 
      !request.url.includes('story-api.dicoding.dev') && 
      !request.url.includes('tile.openstreetmap.org')
    ).length;
    
    log(LOG_LEVEL.INFO, 'Cache Statistics:', {
      totalImages: requests.length,
      storyImages,
      mapTiles,
      otherImages
    });
    
    return { storyImages, mapTiles, otherImages, total: requests.length };
  } catch (error) {
    log(LOG_LEVEL.WARN, 'Failed to get cache stats:', error);
    return { storyImages: 0, mapTiles: 0, otherImages: 0, total: 0 };
  }
}

// Background sync for offline stories
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-stories') {
    log(LOG_LEVEL.INFO, 'Background sync triggered');
    event.waitUntil(syncOfflineStories());
  }
});

// Sync offline stories
async function syncOfflineStories() {
  try {
    // This would typically sync stories stored in IndexedDB
    log(LOG_LEVEL.INFO, 'Syncing offline stories...');
    // Implementation would depend on your IndexedDB structure
  } catch (error) {
    log(LOG_LEVEL.ERROR, 'Failed to sync offline stories:', error);
  }
}

// Push notification handling
self.addEventListener('push', (event) => {
  log(LOG_LEVEL.INFO, 'Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'New story available!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'View Stories',
        icon: '/icons/icon-96x96.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icons/icon-96x96.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Story App', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  log(LOG_LEVEL.INFO, 'Notification clicked');
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Notification close event
self.addEventListener('notificationclose', (event) => {
  log(LOG_LEVEL.INFO, 'Notification closed:', event.notification.tag);
}); 