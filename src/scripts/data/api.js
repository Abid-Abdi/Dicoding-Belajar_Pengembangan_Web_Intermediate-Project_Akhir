import CONFIG from "../config";
import DatabaseHelper from "../utils/indexed-db";

const ENDPOINTS = {
  REGISTER: `${CONFIG.BASE_URL}/register`,
  LOGIN: `${CONFIG.BASE_URL}/login`,
  STORY: `${CONFIG.BASE_URL}/stories`,
  STORIES: `${CONFIG.BASE_URL}/stories`,
  DETAIL: (idStory) => `${CONFIG.BASE_URL}/stories/${idStory}`,
};

// Initialize database helper
const db = new DatabaseHelper();

// Helper function to get token
const getToken = () => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('No authentication token found. Please login first.');
  }
  return token;
};

// Helper function to handle API responses
const handleResponse = async (response) => {
  const responseJson = await response.json();
  
  if (!response.ok) {
    throw new Error(responseJson.message || `Request failed with status ${response.status}`);
  }
  
  return responseJson;
};

// Helper function to dispatch auth state change
const dispatchAuthStateChange = () => {
  document.dispatchEvent(new Event('authStateChanged'));
};

// Public APIs (no token required)
export async function userRegister({name, email, password}) {
  try {
    const response = await fetch(ENDPOINTS.REGISTER, {
      method: "POST",
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({name, email, password}),
    });
    
    return await handleResponse(response);
  } catch (error) {
    console.error('Error during registration:', error);
    throw new Error(error.message || 'Failed to register. Please check your internet connection.');
  }
}

export async function userLogin({email, password}) {
  try {
    const response = await fetch(ENDPOINTS.LOGIN, {
      method: "POST",
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        password: password
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }
    
    // Store token and user data after successful login
    if (data.loginResult && data.loginResult.token) {
      localStorage.setItem('token', data.loginResult.token);
      localStorage.setItem('user', JSON.stringify(data.loginResult));
      dispatchAuthStateChange(); // Dispatch event after successful login
    }
    
    return data;
  } catch (error) {
    console.error('Error during login:', error);
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw new Error(error.message || 'Failed to login. Please check your credentials.');
  }
}

// Protected APIs (require token)
export const addStory = async (formData) => {
  try {
    // Check if we're online
    if (navigator.onLine) {
      try {
        const response = await fetch(ENDPOINTS.STORY, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
          body: formData,
        });

        const responseJson = await response.json();

        if (!response.ok) {
          throw new Error(responseJson.message || 'Failed to add story');
        }

        // Cache the new story for offline access
        if (responseJson.story) {
          await db.cacheStories([responseJson.story]);
        }

        return responseJson;
      } catch (apiError) {
        console.warn('API failed, saving story offline:', apiError);
        // Fall through to offline save
      }
    }
    
    // If offline or API failed, save to IndexedDB
    const storyData = {
      description: formData.get('description'),
      photoUrl: null,
      lat: formData.get('lat') || null,
      lon: formData.get('lon') || null,
      createdAt: new Date().toISOString(),
      isOffline: true
    };
    
    // Handle photo if it exists - store as base64 for better offline reliability
    const photoFile = formData.get('photo');
    if (photoFile && photoFile instanceof File) {
      try {
        // Convert file to base64 for reliable offline storage
        const arrayBuffer = await photoFile.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        storyData.photoUrl = `data:${photoFile.type};base64,${base64}`;
        storyData.photoType = photoFile.type;
        storyData.photoName = photoFile.name;
      } catch (photoError) {
        console.warn('Failed to convert photo to base64:', photoError);
        // Continue without photo
      }
    }
    
    // Check for duplicate before saving
    try {
      const duplicate = await db.checkDuplicateStory(storyData);
      if (duplicate) {
        console.log('Duplicate story detected, skipping save:', duplicate.id);
        return {
          story: duplicate,
          error: 'duplicate',
          message: 'Story already exists offline.'
        };
      }
    } catch (duplicateError) {
      console.warn('Failed to check for duplicate:', duplicateError);
      // Continue with save even if duplicate check fails
    }
    
    // Save to IndexedDB
    await db.addOfflineStory(storyData);
    
    console.log('Story saved offline with unique ID:', storyData.id);
    
    return {
      story: storyData,
      error: 'offline',
      message: 'Story saved offline. It will be synced when you go online.'
    };
    
  } catch (error) {
    console.error('Error adding story:', error);
    throw new Error(error.message || 'An error occurred while adding story');
  }
};

export async function showStories() {
  try {
    // Check if we're online
    if (navigator.onLine) {
      // Try to sync offline stories first (only if not already syncing)
      const isCurrentlySyncing = sessionStorage.getItem('isSyncingOfflineStories');
      if (!isCurrentlySyncing) {
        try {
          sessionStorage.setItem('isSyncingOfflineStories', 'true');
          const syncResult = await syncOfflineStories();
          console.log('Sync result:', syncResult);
        } catch (syncError) {
          console.warn('Failed to sync offline stories:', syncError);
        } finally {
          sessionStorage.removeItem('isSyncingOfflineStories');
        }
      }
      
      // Try to fetch from API
      try {
        const token = getToken();
        const response = await fetch(ENDPOINTS.STORIES, {
          method: 'GET',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          },
        });
        
        const data = await handleResponse(response);
        
        // Cache the stories for offline access
        if (data.listStory && data.listStory.length > 0) {
          await db.cacheStories(data.listStory);
        }
        
        // Log the stories that are now available from API
        console.log(`📱 Fetched ${data.listStory.length} stories from API`);
        
        return data;
      } catch (apiError) {
        console.log('API failed, trying cached data:', apiError);
        // Fall through to cached data
      }
    }
    
    // If offline or API failed, try to get cached data
    const cachedStories = await db.getCachedStories();
    if (cachedStories.length > 0) {
      console.log(`📱 Showing ${cachedStories.length} cached stories (offline mode)`);
      return {
        listStory: cachedStories,
        error: 'offline',
        message: 'Showing cached stories. Some features may be limited.'
      };
    }
    
    throw new Error('No stories available offline. Please check your internet connection.');
  } catch (error) {
    console.error('Error fetching stories:', error);
    throw new Error(error.message || 'Failed to fetch stories. Please check your internet connection.');
  }
}

// Function to sync offline stories to API
export async function syncOfflineStories() {
  try {
    // Reset any stuck syncing stories first
    try {
      await db.resetStuckSyncingStories();
    } catch (resetError) {
      console.warn('Failed to reset stuck syncing stories:', resetError);
    }
    
    // Clean up permanently failed sync stories
    try {
      await db.cleanupFailedSyncStories();
    } catch (cleanupError) {
      console.warn('Failed to cleanup failed sync stories:', cleanupError);
    }
    
    const offlineStories = await db.getOfflineStories();
    
    if (offlineStories.length === 0) {
      return { synced: 0, failed: 0, skipped: 0 };
    }
    
    console.log(`Syncing ${offlineStories.length} offline stories to API...`);
    
    let synced = 0;
    let failed = 0;
    let skipped = 0;
    
    for (const story of offlineStories) {
      try {
        // Skip if story is already synced or has syncing flag
        if (story.isSyncing || story.syncedAt) {
          console.log('Skipping already synced story:', story.id);
          skipped++;
          continue;
        }
        
        // Check if this story already exists in API by comparing content
        const isAlreadyInAPI = await checkIfStoryExistsInAPI(story);
        if (isAlreadyInAPI) {
          console.log('Story already exists in API, marking as synced:', story.id);
          // Mark as synced without actually syncing
          await db.updateStory(story.id, {
            ...story,
            isOffline: false,
            isSyncing: false,
            syncedAt: new Date().toISOString(),
            syncMethod: 'detected_existing'
          });
          skipped++;
          continue;
        }
        
        // Mark story as syncing to prevent duplicate sync
        await db.updateStory(story.id, {
          ...story,
          isSyncing: true,
          syncStartedAt: new Date().toISOString()
        });
        
        // Create FormData for the story
        const formData = new FormData();
        formData.append('description', story.description);
        
        // Handle photo if it exists
        let hasValidPhoto = false;
        if (story.photoUrl) {
          try {
            // If photoUrl is a base64 data URL, convert it back to file
            if (story.photoUrl.startsWith('data:')) {
              try {
                // Convert base64 to blob
                const response = await fetch(story.photoUrl);
                const blob = await response.blob();
                const fileName = story.photoName || 'story-photo.jpg';
                const fileType = story.photoType || blob.type || 'image/jpeg';
                const file = new File([blob], fileName, { type: fileType });
                formData.append('photo', file);
                hasValidPhoto = true;
              } catch (base64Error) {
                console.warn('Failed to convert base64 to file for story:', story.id, base64Error);
              }
            } else if (story.photoUrl.startsWith('blob:')) {
              // Check if blob URL is still valid
              try {
                const response = await fetch(story.photoUrl);
                if (response.ok) {
                  const blob = await response.blob();
                  const file = new File([blob], 'story-photo.jpg', { type: blob.type });
                  formData.append('photo', file);
                  hasValidPhoto = true;
                } else {
                  console.warn('Blob URL not accessible for story:', story.id);
                }
              } catch (blobError) {
                console.warn('Failed to access blob URL for story:', story.id, blobError);
                // Continue without photo
              }
            } else {
              // If it's a regular URL, fetch and convert to file
              const response = await fetch(story.photoUrl);
              if (response.ok) {
                const blob = await response.blob();
                const file = new File([blob], 'story-photo.jpg', { type: blob.type });
                formData.append('photo', file);
                hasValidPhoto = true;
              } else {
                console.warn('Photo URL not accessible for story:', story.id);
              }
            }
          } catch (photoError) {
            console.warn('Failed to process photo for story:', story.id, photoError);
            // Continue without photo
          }
        }
        
        // Add location if available
        if (story.lat && story.lon) {
          formData.append('lat', story.lat);
          formData.append('lon', story.lon);
        }
        
        // Send to API
        const apiResponse = await fetch(ENDPOINTS.STORY, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
          body: formData,
        });
        
        if (apiResponse.ok) {
          const result = await apiResponse.json();
          console.log('Successfully synced offline story:', result);
          
          // Update the story in IndexedDB with the new API ID and mark as synced
          await db.updateStory(story.id, {
            ...story,
            id: result.story.id, // Use the new API ID
            isOffline: false, // Mark as synced
            isSyncing: false, // Remove syncing flag
            syncedAt: new Date().toISOString(),
            syncStartedAt: null, // Clear sync start time
            syncMethod: 'api_sync'
          });
          
          synced++;
        } else {
          const errorText = await apiResponse.text();
          console.error('Failed to sync story:', story.id, apiResponse.status, errorText);
          
          // If it's a 503 error, don't mark as failed permanently
          if (apiResponse.status === 503) {
            console.log('Server unavailable (503), will retry later for story:', story.id);
            // Reset syncing flag but keep as offline for retry
            await db.updateStory(story.id, {
              ...story,
              isSyncing: false,
              syncStartedAt: null,
              lastSyncAttempt: new Date().toISOString()
            });
            skipped++; // Don't count as failed, will retry later
          } else {
            // For other errors, mark as failed permanently
            await db.updateStory(story.id, {
              ...story,
              isSyncing: false,
              syncStartedAt: null,
              syncFailed: true,
              syncError: `${apiResponse.status}: ${errorText}`,
              lastSyncAttempt: new Date().toISOString()
            });
            failed++;
          }
        }
      } catch (error) {
        console.error('Error syncing story:', story.id, error);
        
        // Reset syncing flag on error
        try {
          await db.updateStory(story.id, {
            ...story,
            isSyncing: false,
            syncStartedAt: null,
            syncFailed: true,
            syncError: error.message,
            lastSyncAttempt: new Date().toISOString()
          });
        } catch (updateError) {
          console.error('Failed to reset syncing flag:', updateError);
        }
        
        failed++;
      }
    }
    
    console.log(`Sync completed: ${synced} synced, ${failed} failed, ${skipped} skipped`);
    
    // Clean up old synced stories to prevent duplicates
    if (synced > 0) {
      try {
        await db.cleanupSyncedStories();
      } catch (cleanupError) {
        console.warn('Failed to cleanup synced stories:', cleanupError);
      }
    }
    
    return { synced, failed, skipped };
    
  } catch (error) {
    console.error('Error during offline sync:', error);
    throw error;
  }
}

// Function to check if story already exists in API
async function checkIfStoryExistsInAPI(offlineStory) {
  try {
    // Get all stories from API
    const token = getToken();
    const response = await fetch(ENDPOINTS.STORIES, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      const apiStories = data.listStory || [];
      
      // Check if any API story matches the offline story content
      const matchingStory = apiStories.find(apiStory => {
        // Compare description
        if (apiStory.description !== offlineStory.description) {
          return false;
        }
        
        // Compare location if available
        if (offlineStory.lat && offlineStory.lon) {
          if (!apiStory.lat || !apiStory.lon) {
            return false;
          }
          // Allow small difference in coordinates (GPS precision)
          const latDiff = Math.abs(parseFloat(apiStory.lat) - parseFloat(offlineStory.lat));
          const lonDiff = Math.abs(parseFloat(apiStory.lon) - parseFloat(offlineStory.lon));
          if (latDiff > 0.0001 || lonDiff > 0.0001) {
            return false;
          }
        }
        
        // Compare creation time (within 5 minutes)
        const offlineTime = new Date(offlineStory.createdAt).getTime();
        const apiTime = new Date(apiStory.createdAt).getTime();
        const timeDiff = Math.abs(offlineTime - apiTime);
        
        return timeDiff < 5 * 60 * 1000; // 5 minutes
      });
      
      if (matchingStory) {
        console.log('Found matching story in API:', matchingStory.id, 'for offline story:', offlineStory.id);
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.warn('Failed to check if story exists in API:', error);
    return false; // Assume not exists if check fails
  }
}

export async function storyDetail(idStory) {
  try {
    // Check if we're online
    if (navigator.onLine) {
  try {
    const token = getToken();
    const response = await fetch(ENDPOINTS.DETAIL(idStory), {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
    });
    
        const data = await handleResponse(response);
        
        // Cache the story detail
        if (data.story) {
          await db.cacheStories([data.story]);
        }
        
        return data;
      } catch (apiError) {
        console.log('API failed, trying cached data:', apiError);
        // Fall through to cached data
      }
    }
    
    // If offline or API failed, try to get cached data
    const cachedStory = await db.getStoryById(idStory);
    if (cachedStory) {
      return {
        story: cachedStory,
        error: 'offline',
        message: 'Showing cached story. Some features may be limited.'
      };
    }
    
    throw new Error('Story not available offline. Please check your internet connection.');
  } catch (error) {
    console.error('Error fetching story detail:', error);
    throw new Error(error.message || 'Failed to fetch story detail. Please check your internet connection.');
  }
}

// Helper function to check if user is authenticated
export const isAuthenticated = () => {
  return !!localStorage.getItem('token');
};

// Helper function to logout
export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  dispatchAuthStateChange(); // Dispatch event after logout
  window.location.href = '#/login';
};

// Helper function to check if we have cached data
export const hasCachedData = async () => {
  return await db.hasCachedData();
};
