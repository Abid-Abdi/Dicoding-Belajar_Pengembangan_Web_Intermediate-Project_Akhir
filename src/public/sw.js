importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js');

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

const CACHE_NAME = 'StoryApp-v1';
const API_CACHE_NAME = 'StoryApp-API-v1';
const IMAGE_CACHE_NAME = 'StoryApp-Images-v1';

const urlsToCache = [
  '/',
  '/index.html',
  '/app.bundle.js',
  '/favicon.png',
  '/manifest.json',
  '/images/default-story.jpg'
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

// Fetch event with Workbox strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip chrome-extension requests and other non-app requests
  if (url.protocol === 'chrome-extension:' || 
      url.protocol === 'moz-extension:' || 
      url.protocol === 'ms-browser-extension:' ||
      !url.hostname.includes('localhost') && !url.hostname.includes('story-api.dicoding.dev')) {
    // Don't log skipped requests to reduce console noise
    return;
  }

  // Handle API requests with stale-while-revalidate (including login/register)
  if ((url.pathname.includes('/stories') || url.pathname.includes('/login') || url.pathname.includes('/register')) && url.origin === 'https://story-api.dicoding.dev') {
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

// Stale-while-revalidate for API requests
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE_NAME);
  
  // Try to get cached response first
  const cachedResponse = await cache.match(request);
  
  // Start fetching fresh data
  const fetchPromise = fetch(request).then(async (response) => {
    if (response.ok) {
      // Clone response to store in cache
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
    }
    return response;
  }).catch(() => {
    // If fetch fails, return null
    return null;
  });

  // Return cached response immediately if available
  if (cachedResponse) {
    return cachedResponse;
  }

  // If no cache, wait for fetch
  const freshResponse = await fetchPromise;
  if (freshResponse) {
    return freshResponse;
  }

  // If both cache and fetch fail, return offline response
  return new Response(JSON.stringify({
    error: 'No internet connection',
    message: 'Please check your connection and try again'
  }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Helper function to cache story images
async function cacheStoryImages(stories) {
  const imageCache = await caches.open(IMAGE_CACHE_NAME);
  let cachedCount = 0;
  let skippedCount = 0;
  
  const imagePromises = stories
    .filter(story => story.photoUrl && story.photoUrl.startsWith('https://'))
    .map(async (story) => {
      try {
        const response = await fetch(story.photoUrl);
        
        // Skip caching if server returns 503
        if (response.status === 503) {
          skippedCount++;
          return;
        }
        
        if (response.ok) {
          const responseToCache = response.clone();
          await imageCache.put(story.photoUrl, responseToCache);
          cachedCount++;
        }
      } catch (error) {
        log(LOG_LEVEL.WARN, 'Failed to pre-cache story image:', story.photoUrl, error);
      }
    });
  
  // Wait for all images to be cached
  await Promise.allSettled(imagePromises);
  log(LOG_LEVEL.INFO, `Story images pre-caching completed: ${cachedCount} cached, ${skippedCount} skipped (503)`);
}

// Cache-first strategy for story images from API
async function handleStoryImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE_NAME);
  const url = new URL(request.url);
  
  // Try cache first
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    log(LOG_LEVEL.INFO, 'Story image served from cache:', request.url);
    return cachedResponse;
  }

  // If not in cache, try to fetch
  try {
    const response = await fetch(request);
    
    // Handle 503 Service Unavailable specifically - return default image immediately
    if (response.status === 503) {
      log(LOG_LEVEL.WARN, `Service unavailable (503) for story image: ${request.url}, using default image`);
      const defaultImage = await cache.match('/images/default-story.jpg');
      if (defaultImage) {
        return defaultImage;
      }
      // If no default image, return placeholder
      return createPlaceholderImage();
    }
    
    if (response.ok) {
      const responseToCache = response.clone();
      await cache.put(request, responseToCache);
      log(LOG_LEVEL.INFO, 'Story image cached for offline use:', request.url);
      return response;
    }
    
    throw new Error(`Story image fetch failed with status: ${response.status}`);
  } catch (error) {
    log(LOG_LEVEL.WARN, 'Failed to fetch story image:', request.url, error);
    
    // Try fallback to default image
    const defaultImage = await cache.match('/images/default-story.jpg');
    if (defaultImage) {
      log(LOG_LEVEL.INFO, 'Using default image as fallback for:', request.url);
      return defaultImage;
    }
    
    // If no default image available, return placeholder
    log(LOG_LEVEL.INFO, 'Using placeholder image for:', request.url);
    return createPlaceholderImage();
  }
}

// Cache-first strategy for map tiles
async function handleMapTileRequest(request) {
  const cache = await caches.open(IMAGE_CACHE_NAME);
  
  // Try cache first
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    log(LOG_LEVEL.INFO, 'Map tile served from cache:', request.url);
    return cachedResponse;
  }

  // If not in cache, fetch and cache
  try {
    const response = await fetch(request);
    if (response.ok) {
      const responseToCache = response.clone();
      await cache.put(request, responseToCache);
      log(LOG_LEVEL.INFO, 'Map tile cached:', request.url);
      return response;
    }
    throw new Error('Map tile fetch failed');
  } catch (error) {
    log(LOG_LEVEL.WARN, 'Failed to fetch map tile:', request.url, error);
    
    // Return a transparent image or default tile if fetch fails
    return new Response('', {
      status: 404,
      statusText: 'Not Found',
      headers: { 'Content-Type': 'image/png' }
    });
  }
}

// Helper function to create a placeholder image
function createPlaceholderImage() {
  // Create a simple SVG placeholder
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200">
      <rect width="300" height="200" fill="#f5f5f5"/>
      <text x="150" y="100" font-family="Arial, sans-serif" font-size="16" fill="#999" text-anchor="middle" dy=".3em">
        Image Unavailable
      </text>
    </svg>
  `;
  
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000'
    }
  });
}

// Helper function to check if image is cached
async function isImageCached(imageUrl) {
  try {
    const cache = await caches.open(IMAGE_CACHE_NAME);
    const response = await cache.match(imageUrl);
    return response !== undefined;
  } catch (error) {
    log(LOG_LEVEL.WARN, 'Error checking image cache:', error);
    return false;
  }
}

// Helper function to cache image with retry
async function cacheImageWithRetry(imageUrl, maxRetries = 2) {
  let retryCount = 0;
  
  while (retryCount <= maxRetries) {
    try {
      const response = await fetch(imageUrl);
      
      if (response.status === 503) {
        log(LOG_LEVEL.WARN, `Service unavailable (503) for image: ${imageUrl}, skipping cache`);
        return false;
      }
      
      if (response.ok) {
        const cache = await caches.open(IMAGE_CACHE_NAME);
        const responseToCache = response.clone();
        await cache.put(imageUrl, responseToCache);
        log(LOG_LEVEL.INFO, 'Successfully cached image:', imageUrl);
        return true;
      }
      
      throw new Error(`Image fetch failed with status: ${response.status}`);
    } catch (error) {
      retryCount++;
      log(LOG_LEVEL.WARN, `Failed to cache image (attempt ${retryCount}/${maxRetries + 1}):`, imageUrl, error);
      
      if (retryCount <= maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }
  }
  
  return false;
}

// Cache-first strategy for images
async function handleImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE_NAME);
  const url = new URL(request.url);
  
  // Try cache first
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    // Log when serving story images from cache
    if (url.hostname.includes('story-api.dicoding.dev')) {
      log(LOG_LEVEL.INFO, 'Story image served from cache:', request.url);
    }
    return cachedResponse;
  }

  // If not in cache, fetch and cache with retry mechanism
  let retryCount = 0;
  const maxRetries = 1; // Reduce retries for 503 errors
  
  while (retryCount <= maxRetries) {
    try {
      const response = await fetch(request);
      
      // Handle 503 Service Unavailable specifically - return default image immediately
      if (response.status === 503) {
        log(LOG_LEVEL.WARN, `Service unavailable (503) for image: ${request.url}, using default image`);
        const defaultImage = await cache.match('/images/default-story.jpg');
        if (defaultImage) {
          return defaultImage;
        }
        // If no default image, return placeholder
        return createPlaceholderImage();
      }
      
      if (response.ok) {
        const responseToCache = response.clone();
        await cache.put(request, responseToCache);
        
        // Log when caching story images
        if (url.hostname.includes('story-api.dicoding.dev')) {
          log(LOG_LEVEL.INFO, 'Story image cached for offline use:', request.url);
        }
        
        return response;
      }
      
      throw new Error(`Image fetch failed with status: ${response.status}`);
    } catch (error) {
      retryCount++;
      
      // Log failed story image fetches
      if (url.hostname.includes('story-api.dicoding.dev')) {
        log(LOG_LEVEL.WARN, `Failed to fetch story image (attempt ${retryCount}/${maxRetries + 1}):`, request.url, error);
      }
      
      // If this is the last retry, try fallback
      if (retryCount > maxRetries) {
        break;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
    }
  }
  
  // All retries failed, try fallback
  const defaultImage = await cache.match('/images/default-story.jpg');
  if (defaultImage) {
    log(LOG_LEVEL.INFO, 'Using default image as fallback for:', request.url);
    return defaultImage;
  }
  
  // If no default image available, return placeholder
  log(LOG_LEVEL.INFO, 'Using placeholder image for:', request.url);
  return createPlaceholderImage();
}

// Network-first strategy for other requests
async function handleOtherRequest(request) {
  try {
    // Try network first
    const response = await fetch(request);
    if (response.ok) {
    return response;
    }
    throw new Error('Network response was not ok');
  } catch (error) {
    // Fallback to cache
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
    return cachedResponse;
    }
    
    // If no cache available, return a proper offline response
    // Check if this is likely an API request that expects JSON
    const url = new URL(request.url);
    const isApiRequest = url.hostname.includes('story-api.dicoding.dev') || 
                        request.headers.get('accept')?.includes('application/json') ||
                        request.headers.get('content-type')?.includes('application/json');
    
    if (isApiRequest) {
      return new Response(JSON.stringify({
        error: 'No internet connection',
        message: 'Please check your connection and try again'
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // For non-API requests, return plain text
    return new Response('Offline - No cached content available', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Activate event
self.addEventListener('activate', (event) => {
  log(LOG_LEVEL.INFO, 'Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME && cacheName !== IMAGE_CACHE_NAME) {
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

// Push notification event
self.addEventListener('push', (event) => {
  let options = {
    body: 'New story has been added!',
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
        title: 'View Story',
        icon: '/icons/icon-72x72.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icons/icon-72x72.png'
      }
    ]
  };

  // If push event has data, use it
  if (event.data) {
    try {
      const data = event.data.json();
      if (data.title) options.title = data.title;
      if (data.body) options.body = data.body;
      if (data.icon) options.icon = data.icon;
      if (data.data) options.data = { ...options.data, ...data.data };
    } catch (error) {
      log(LOG_LEVEL.WARN, 'Failed to parse push data:', error);
      // Use default options if parsing fails
    }
  }

  event.waitUntil(
    self.registration.showNotification('Story App', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  } else if (event.action === 'close') {
    // Just close the notification
    return;
  } else {
    // Default action - open the app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Notification close event
self.addEventListener('notificationclose', (event) => {
  log(LOG_LEVEL.INFO, 'Notification closed:', event.notification.tag);
}); 