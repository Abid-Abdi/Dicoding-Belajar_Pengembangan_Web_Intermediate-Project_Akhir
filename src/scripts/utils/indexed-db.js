import CONFIG from '../config';

// Log level control for IndexedDB
const LOG_LEVEL = {
  NONE: 0,
  ERROR: 1,
  WARN: 2,
  INFO: 3,
  DEBUG: 4
};

// Set log level (change this to control logging)
const CURRENT_LOG_LEVEL = LOG_LEVEL.WARN; // Only show warnings and errors in production

// Logging utility
function log(level, message, ...args) {
  if (level <= CURRENT_LOG_LEVEL) {
    switch (level) {
      case LOG_LEVEL.ERROR:
        console.error(`[IndexedDB] ${message}`, ...args);
        break;
      case LOG_LEVEL.WARN:
        console.warn(`[IndexedDB] ${message}`, ...args);
        break;
      case LOG_LEVEL.INFO:
        console.info(`[IndexedDB] ${message}`, ...args);
        break;
      case LOG_LEVEL.DEBUG:
        console.log(`[IndexedDB] ${message}`, ...args);
        break;
    }
  }
}

class DatabaseHelper {
  constructor() {
    this.dbName = CONFIG.DATABASE_NAME;
    this.dbVersion = CONFIG.DATABASE_VERSION;
    this.objectStoreName = CONFIG.OBJECT_STORE_NAME;
  }

  async openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new Error('Failed to open database'));
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.objectStoreName)) {
          const objectStore = db.createObjectStore(this.objectStoreName, {
            keyPath: 'id',
            autoIncrement: false // Use API ID as key
          });
          
          // Create indexes
          objectStore.createIndex('title', 'title', { unique: false });
          objectStore.createIndex('description', 'description', { unique: false });
          objectStore.createIndex('createdAt', 'createdAt', { unique: false });
          objectStore.createIndex('isOffline', 'isOffline', { unique: false });
        }
      };
    });
  }

  // Cache API stories for offline access
  async cacheStories(stories) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.objectStoreName], 'readwrite');
      const objectStore = transaction.objectStore(this.objectStoreName);
      
      // Get existing stories to check for duplicates
      const getAllRequest = objectStore.getAll();
      
      getAllRequest.onsuccess = () => {
        const existingStories = getAllRequest.result;
        
        // Clear existing cached stories (but keep offline stories and recently synced stories)
      const clearRequest = objectStore.openCursor();
      clearRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const story = cursor.value;
            // Only delete if it's not an offline story and not recently synced (within last 5 minutes)
            const isRecentlySynced = story.syncedAt && 
              (new Date().getTime() - new Date(story.syncedAt).getTime()) < 5 * 60 * 1000;
            
            if (!story.isOffline && !isRecentlySynced) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          // All stories processed, now add new ones
          let completed = 0;
          const total = stories.length;
          
          if (total === 0) {
            resolve();
            return;
          }
          
          stories.forEach(story => {
              // Check if this story already exists (by API ID or content)
              const existingStory = existingStories.find(existing => 
                existing.id === story.id || 
                (existing.description === story.description && 
                 Math.abs(new Date(existing.createdAt).getTime() - new Date(story.createdAt).getTime()) < 60000)
              );
              
              if (existingStory) {
                // Update existing story with latest data from API
                const request = objectStore.put({
                  ...existingStory,
                  ...story,
                  cachedAt: new Date().toISOString(),
                  isOffline: false,
                  isSyncing: false,
                  syncedAt: existingStory.syncedAt || new Date().toISOString(),
                  syncMethod: existingStory.syncMethod || 'api_cache'
                });
                
                request.onsuccess = () => {
                  completed++;
                  if (completed === total) {
                    // Pre-cache images for offline use
                    this._preCacheStoryImages(stories);
                    resolve();
                  }
                };
                
                request.onerror = () => {
                  reject(new Error('Failed to update existing story'));
                };
              } else {
                // Add new story
            const request = objectStore.put({
              ...story,
              cachedAt: new Date().toISOString(),
                  isOffline: false,
                  isSyncing: false,
                  syncedAt: new Date().toISOString(),
                  syncMethod: 'api_cache'
            });
            
            request.onsuccess = () => {
              completed++;
              if (completed === total) {
                    // Pre-cache images for offline use
                    this._preCacheStoryImages(stories);
                resolve();
              }
            };
            
            request.onerror = () => {
              reject(new Error('Failed to cache story'));
            };
              }
          });
        }
        };
      };
      
      getAllRequest.onerror = () => {
        reject(new Error('Failed to get existing stories'));
      };
    });
  }

  // Helper function to pre-cache story images
  async _preCacheStoryImages(stories) {
    try {
      const imageCache = await caches.open('StoryApp-Images-v1');
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
      
      await Promise.allSettled(imagePromises);
      log(LOG_LEVEL.INFO, `IndexedDB story images pre-caching: ${cachedCount} cached, ${skippedCount} skipped (503)`);
    } catch (error) {
      log(LOG_LEVEL.WARN, 'Failed to pre-cache story images from IndexedDB:', error);
    }
  }

  // Get cached stories for offline display
  async getCachedStories() {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.objectStoreName], 'readonly');
      const objectStore = transaction.objectStore(this.objectStoreName);
      const request = objectStore.getAll();

      request.onsuccess = () => {
        const stories = request.result;
        
        // Pre-cache images for offline use when loading stories
        if (stories.length > 0) {
          this._preCacheStoryImages(stories);
        }
        
        resolve(stories);
      };

      request.onerror = () => {
        reject(new Error('Failed to get cached stories'));
      };
    });
  }

  // Add offline story (when user creates story offline)
  async addOfflineStory(story) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.objectStoreName], 'readwrite');
      const objectStore = transaction.objectStore(this.objectStoreName);
      
      // Generate unique offline ID with timestamp and random component
      const timestamp = Date.now();
      const random = Math.random().toString(36).substr(2, 9);
      const offlineId = `offline_${timestamp}_${random}`;
      
      const request = objectStore.add({
        ...story,
        id: offlineId,
        originalId: story.id || null, // Keep original ID if exists
        createdAt: new Date().toISOString(),
        isOffline: true,
        syncAttempts: 0,
        lastSyncAttempt: null
      });

      request.onsuccess = () => {
        // Pre-cache image for offline story
        if (story.photoUrl) {
          this._preCacheStoryImages([story]);
        }
        log(LOG_LEVEL.INFO, 'Offline story added with ID:', offlineId);
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error('Failed to add offline story'));
      };
    });
  }

  // Check if story with same content already exists (prevent duplicates)
  async checkDuplicateStory(story) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.objectStoreName], 'readonly');
      const objectStore = transaction.objectStore(this.objectStoreName);
      const request = objectStore.getAll();

      request.onsuccess = () => {
        const allStories = request.result;
        
        // Check for exact duplicate based on description and timestamp
        const duplicate = allStories.find(existingStory => 
          existingStory.description === story.description &&
          existingStory.isOffline === true &&
          Math.abs(new Date(existingStory.createdAt).getTime() - new Date(story.createdAt).getTime()) < 60000 // Within 1 minute
        );
        
        resolve(duplicate || null);
      };

      request.onerror = () => {
        reject(new Error('Failed to check for duplicate story'));
      };
    });
  }

  // Update story with better ID tracking
  async updateStory(id, updatedStory) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.objectStoreName], 'readwrite');
      const objectStore = transaction.objectStore(this.objectStoreName);
      
      // First get the existing story
      const getRequest = objectStore.get(id);
      
      getRequest.onsuccess = () => {
        const existingStory = getRequest.result;
        if (!existingStory) {
          reject(new Error('Story not found'));
          return;
        }
        
        // Update the story with better tracking
        const updatedStoryData = {
          ...existingStory,
          ...updatedStory,
          updatedAt: new Date().toISOString(),
          syncAttempts: (existingStory.syncAttempts || 0) + 1
        };
        
        // If this is a successful sync, update the ID
        if (updatedStory.isOffline === false && updatedStory.id !== existingStory.id) {
          updatedStoryData.originalOfflineId = existingStory.id;
          log(LOG_LEVEL.INFO, `Story synced: ${existingStory.id} -> ${updatedStory.id}`);
        }
        
        const request = objectStore.put(updatedStoryData);
        
        request.onsuccess = () => {
          log(LOG_LEVEL.INFO, 'Story updated successfully:', id);
          resolve(request.result);
        };
        
        request.onerror = () => {
          reject(new Error('Failed to update story'));
        };
      };
      
      getRequest.onerror = () => {
        reject(new Error('Failed to get story for update'));
      };
    });
  }

  // Delete story
  async deleteStory(id) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.objectStoreName], 'readwrite');
      const objectStore = transaction.objectStore(this.objectStoreName);
      const request = objectStore.delete(id);

      request.onsuccess = () => {
        log(LOG_LEVEL.INFO, 'Story deleted successfully:', id);
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to delete story'));
      };
    });
  }

  // Clear all stories (for testing or reset)
  async clearAllStories() {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.objectStoreName], 'readwrite');
      const objectStore = transaction.objectStore(this.objectStoreName);
      const request = objectStore.clear();

      request.onsuccess = () => {
        log(LOG_LEVEL.INFO, 'All stories cleared');
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to clear stories'));
      };
    });
  }

  // Check if we have any cached data
  async hasCachedData() {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.objectStoreName], 'readonly');
      const objectStore = transaction.objectStore(this.objectStoreName);
      const request = objectStore.count();

      request.onsuccess = () => {
        resolve(request.result > 0);
      };

      request.onerror = () => {
        reject(new Error('Failed to check cached data'));
      };
    });
  }

  // Reset stuck syncing stories (stories that have been syncing for too long)
  async resetStuckSyncingStories() {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.objectStoreName], 'readwrite');
      const objectStore = transaction.objectStore(this.objectStoreName);
      
      const clearRequest = objectStore.openCursor();
      let resetCount = 0;
      
      clearRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const story = cursor.value;
          
          // Reset stories that have been syncing for more than 5 minutes
          if (story.isSyncing && story.syncStartedAt) {
            const syncStartTime = new Date(story.syncStartedAt).getTime();
            const currentTime = new Date().getTime();
            const timeDiff = currentTime - syncStartTime;
            
            // If syncing for more than 5 minutes, reset the flag
            if (timeDiff > 5 * 60 * 1000) {
              const updatedStory = {
                ...story,
                isSyncing: false,
                syncStartedAt: null
              };
              cursor.update(updatedStory);
              resetCount++;
            }
          }
          cursor.continue();
        } else {
          if (resetCount > 0) {
            log(LOG_LEVEL.INFO, `Reset ${resetCount} stuck syncing stories`);
          }
          resolve(resetCount);
        }
      };
      
      clearRequest.onerror = () => {
        reject(new Error('Failed to reset stuck syncing stories'));
      };
    });
  }

  // Clean up permanently failed sync stories
  async cleanupFailedSyncStories() {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.objectStoreName], 'readwrite');
      const objectStore = transaction.objectStore(this.objectStoreName);
      
      const clearRequest = objectStore.openCursor();
      let cleanedCount = 0;
      
      clearRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const story = cursor.value;
          
          // Remove stories that failed sync more than 1 hour ago
          if (story.syncFailed && story.lastSyncAttempt) {
            const lastAttemptTime = new Date(story.lastSyncAttempt).getTime();
            const currentTime = new Date().getTime();
            const timeDiff = currentTime - lastAttemptTime;
            
            // If failed more than 1 hour ago, remove it
            if (timeDiff > 60 * 60 * 1000) {
              cursor.delete();
              cleanedCount++;
            }
          }
          cursor.continue();
        } else {
          if (cleanedCount > 0) {
            log(LOG_LEVEL.INFO, `Cleaned up ${cleanedCount} permanently failed sync stories`);
          }
          resolve(cleanedCount);
        }
      };
      
      clearRequest.onerror = () => {
        reject(new Error('Failed to cleanup failed sync stories'));
      };
    });
  }

  // Get cache statistics
  async getCacheStats() {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.objectStoreName], 'readonly');
      const objectStore = transaction.objectStore(this.objectStoreName);
      const request = objectStore.getAll();

      request.onsuccess = () => {
        const stories = request.result;
        const offlineStories = stories.filter(story => 
          story.isOffline === true && 
          !story.isSyncing && 
          !story.syncedAt &&
          !story.syncFailed
        );
        const cachedStories = stories.filter(story => !story.isOffline);
        const syncingStories = stories.filter(story => story.isSyncing);
        const failedStories = stories.filter(story => story.syncFailed);
        
        resolve({
          total: stories.length,
          offline: offlineStories.length,
          cached: cachedStories.length,
          syncing: syncingStories.length,
          failed: failedStories.length
        });
      };

      request.onerror = () => {
        reject(new Error('Failed to get cache stats'));
      };
    });
  }

  // Get offline stories (stories created while offline)
  async getOfflineStories() {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.objectStoreName], 'readonly');
      const objectStore = transaction.objectStore(this.objectStoreName);
      const request = objectStore.getAll();

      request.onsuccess = () => {
        const allStories = request.result;
        // Filter stories that are offline and not currently syncing and not permanently failed
        const offlineStories = allStories.filter(story => 
          story.isOffline === true && 
          !story.isSyncing && 
          !story.syncedAt &&
          !story.syncFailed // Exclude permanently failed stories
        );
        log(LOG_LEVEL.INFO, `Found ${offlineStories.length} offline stories out of ${allStories.length} total`);
        resolve(offlineStories);
      };

      request.onerror = () => {
        reject(new Error('Failed to get offline stories'));
      };
    });
  }

  // Get story by ID
  async getStoryById(id) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.objectStoreName], 'readonly');
      const objectStore = transaction.objectStore(this.objectStoreName);
      const request = objectStore.get(id);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error('Failed to get story by ID'));
      };
    });
  }

  // Clean up synced stories (remove old synced stories to prevent duplicates)
  async cleanupSyncedStories() {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.objectStoreName], 'readwrite');
      const objectStore = transaction.objectStore(this.objectStoreName);
      
      const clearRequest = objectStore.openCursor();
      let cleanedCount = 0;
      
      clearRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const story = cursor.value;
          
          // Remove stories that were synced more than 10 minutes ago and are not offline
          if (story.syncedAt && !story.isOffline) {
            const syncedTime = new Date(story.syncedAt).getTime();
            const currentTime = new Date().getTime();
            const timeDiff = currentTime - syncedTime;
            
            // If synced more than 10 minutes ago, remove it
            if (timeDiff > 10 * 60 * 1000) {
              cursor.delete();
              cleanedCount++;
            }
          }
          cursor.continue();
        } else {
          log(LOG_LEVEL.INFO, `Cleaned up ${cleanedCount} old synced stories`);
          resolve(cleanedCount);
        }
      };
      
      clearRequest.onerror = () => {
        reject(new Error('Failed to cleanup synced stories'));
      };
    });
  }

  // Get all stories (for debugging and sync method tracking)
  async getAllStories() {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.objectStoreName], 'readonly');
      const objectStore = transaction.objectStore(this.objectStoreName);
      const request = objectStore.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error('Failed to get all stories'));
      };
    });
  }
}

export default DatabaseHelper; 