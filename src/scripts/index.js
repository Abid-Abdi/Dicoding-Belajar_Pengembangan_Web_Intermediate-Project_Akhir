// CSS imports
import '../styles/styles.css';

import App from './pages/app';
import { registerServiceWorker, requestNotificationPermission, subscribeToPushNotifications } from './utils/sw-register';
import { initializePWAInstall } from './utils/pwa-install';
import NetworkStatus from './utils/network-status';
import { syncOfflineStories } from './data/api';
import DatabaseHelper from './utils/indexed-db';

const app = new App();
let networkStatus = null;

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
  app._renderPage();
  
  // Check if running in PWA mode
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                window.matchMedia('(display-mode: window-controls-overlay)').matches ||
                window.matchMedia('(display-mode: minimal-ui)').matches ||
                window.navigator.standalone === true;
  
  console.log(`🚀 App initialized - PWA Mode: ${isPWA}, Online: ${navigator.onLine}`);
  
  // Show PWA status in development
  if (isPWA && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    showPWAStatus();
  }
  
  // Register service worker for PWA
  try {
    const registration = await registerServiceWorker();
    if (registration) {
      console.log('Service Worker registered successfully');
    }
  } catch (error) {
    console.error('Failed to register service worker:', error);
  }
  
  // Initialize PWA install prompt
  initializePWAInstall();
  
  // Initialize network status indicator
  networkStatus = new NetworkStatus();
  
  // Add notification permission request button to the UI
  addNotificationPermissionButton();
  
  // Setup notification toggle
  setupNotificationToggle();
  
  // Make function available globally for templates.js
  window.setupNotificationToggle = setupNotificationToggle;
  
  // Setup online/offline event listeners
  setupNetworkEventListeners();
  
  // Check offline capabilities
  await checkOfflineCapabilities();
});

// Setup network event listeners for automatic sync
function setupNetworkEventListeners() {
  // Listen for online event
  window.addEventListener('online', async () => {
    console.log('Network connection restored');
    
    // Show sync notification
    showSyncNotification();
    
    // Try to sync offline stories
    try {
      const result = await syncOfflineStories();
      if (result.synced > 0) {
        showSyncSuccessNotification(result.synced);
        // Refresh the page to show synced stories
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to sync offline stories:', error);
      showSyncErrorNotification();
    }
  });
  
  // Listen for offline event
  window.addEventListener('offline', () => {
    console.log('Network connection lost');
    showOfflineNotification();
  });
}

// Show sync notification
function showSyncNotification() {
  const notification = document.createElement('div');
  notification.className = 'sync-notification';
  notification.innerHTML = `
    <div class="sync-content">
      <p>🔄 Syncing offline stories...</p>
    </div>
  `;
  
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    padding: 15px 20px;
    background-color: #2196F3;
    color: white;
    border-radius: 5px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    font-size: 14px;
  `;
  
  document.body.appendChild(notification);
  
  // Auto remove after 3 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 3000);
}

// Show sync success notification
function showSyncSuccessNotification(syncedCount) {
  const notification = document.createElement('div');
  notification.className = 'sync-success-notification';
  notification.innerHTML = `
    <div class="sync-content">
      <p>✅ Successfully synced ${syncedCount} story(ies) to server!</p>
    </div>
  `;
  
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    padding: 15px 20px;
    background-color: #4CAF50;
    color: white;
    border-radius: 5px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    font-size: 14px;
  `;
  
  document.body.appendChild(notification);
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 5000);
}

// Show sync error notification
function showSyncErrorNotification() {
  const notification = document.createElement('div');
  notification.className = 'sync-error-notification';
  notification.innerHTML = `
    <div class="sync-content">
      <p>❌ Failed to sync offline stories. Will retry later.</p>
    </div>
  `;
  
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    padding: 15px 20px;
    background-color: #f44336;
    color: white;
    border-radius: 5px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    font-size: 14px;
  `;
  
  document.body.appendChild(notification);
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 5000);
}

// Show offline notification
function showOfflineNotification() {
  const notification = document.createElement('div');
  notification.className = 'offline-notification';
  notification.innerHTML = `
    <div class="sync-content">
      <p>📱 You're offline. Stories will be saved locally and synced when online.</p>
    </div>
  `;
  
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    padding: 15px 20px;
    background-color: #FF9800;
    color: white;
    border-radius: 5px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    font-size: 14px;
  `;
  
  document.body.appendChild(notification);
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 5000);
}

// Add notification permission button to the UI
function addNotificationPermissionButton() {
  // Check if notification permission is already granted
  if (Notification.permission === 'granted') {
    console.log('Notification permission already granted');
    return;
  }
  
  // Check if notification is supported
  if (!('Notification' in window)) {
    console.log('Notifications not supported');
    return;
  }
  
  // Create notification permission button
  const notificationButton = document.createElement('button');
  notificationButton.textContent = '🔔 Enable Notifications';
  notificationButton.className = 'notification-permission-btn';
  notificationButton.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1000;
    padding: 10px 15px;
    background-color: #4CAF50;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 14px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    transition: background-color 0.3s ease;
  `;
  
  notificationButton.addEventListener('mouseenter', () => {
    notificationButton.style.backgroundColor = '#45a049';
  });
  
  notificationButton.addEventListener('mouseleave', () => {
    notificationButton.style.backgroundColor = '#4CAF50';
  });
  
  notificationButton.addEventListener('click', async () => {
    try {
      notificationButton.disabled = true;
      notificationButton.textContent = '⏳ Requesting...';
      
      const hasPermission = await requestNotificationPermission();
      if (hasPermission) {
        console.log('Notification permission granted');
        notificationButton.textContent = '✅ Notifications Enabled';
        notificationButton.style.backgroundColor = '#45a049';
        
        // Subscribe to push notifications
        const registration = await navigator.serviceWorker.ready;
        await subscribeToPushNotifications(registration);
        
        // Remove button after 3 seconds
        setTimeout(() => {
          if (notificationButton.parentNode) {
            notificationButton.parentNode.removeChild(notificationButton);
          }
        }, 3000);
      } else {
        console.log('Notification permission denied');
        notificationButton.textContent = '❌ Permission Denied';
        notificationButton.style.backgroundColor = '#f44336';
        
        // Reset button after 3 seconds
        setTimeout(() => {
          notificationButton.disabled = false;
          notificationButton.textContent = '🔔 Enable Notifications';
          notificationButton.style.backgroundColor = '#4CAF50';
        }, 3000);
      }
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      notificationButton.textContent = '❌ Error';
      notificationButton.style.backgroundColor = '#f44336';
      
      // Reset button after 3 seconds
      setTimeout(() => {
        notificationButton.disabled = false;
        notificationButton.textContent = '🔔 Enable Notifications';
        notificationButton.style.backgroundColor = '#4CAF50';
      }, 3000);
    }
  });
  
  document.body.appendChild(notificationButton);
}

// Show PWA status for debugging
function showPWAStatus() {
  const statusDiv = document.createElement('div');
  statusDiv.className = 'pwa-debug-status';
  
  const updateStatus = () => {
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                  window.matchMedia('(display-mode: window-controls-overlay)').matches ||
                  window.matchMedia('(display-mode: minimal-ui)').matches ||
                  window.navigator.standalone === true;
    
    statusDiv.innerHTML = `
      <div>📱 PWA: ${isPWA ? 'YES' : 'NO'}</div>
      <div>🌐 Online: ${navigator.onLine ? 'YES' : 'NO'}</div>
      <div>🔧 Dev: ${window.location.hostname === 'localhost' ? 'YES' : 'NO'}</div>
    `;
  };
  
  updateStatus();
  document.body.appendChild(statusDiv);
  
  // Update status when network changes
  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);
}

window.addEventListener('hashchange', () => {
  app._renderPage();
});

// Check offline capabilities and show status
async function checkOfflineCapabilities() {
  try {
    // Check if service worker is registered
    const registration = await navigator.serviceWorker.getRegistration();
    const hasServiceWorker = !!registration;
    
    // Check if IndexedDB is available
    const hasIndexedDB = 'indexedDB' in window;
    
    // Check if we have cached data
    let hasCachedData = false;
    if (hasIndexedDB) {
      try {
        const db = new DatabaseHelper();
        const stats = await db.getCacheStats();
        hasCachedData = stats.total > 0;
      } catch (error) {
        console.warn('Failed to check cached data:', error);
      }
    }
    
    // Check if we're in PWA mode
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                  window.matchMedia('(display-mode: window-controls-overlay)').matches ||
                  window.matchMedia('(display-mode: minimal-ui)').matches ||
                  window.navigator.standalone === true;
    
    console.log('📱 Offline Capabilities Check:', {
      hasServiceWorker,
      hasIndexedDB,
      hasCachedData,
      isPWA,
      isOnline: navigator.onLine
    });
    
    // Show offline status in development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      showOfflineStatus({
        hasServiceWorker,
        hasIndexedDB,
        hasCachedData,
        isPWA,
        isOnline: navigator.onLine
      });
    }
    
    return {
      hasServiceWorker,
      hasIndexedDB,
      hasCachedData,
      isPWA,
      isOnline: navigator.onLine
    };
  } catch (error) {
    console.error('Failed to check offline capabilities:', error);
    return {
      hasServiceWorker: false,
      hasIndexedDB: false,
      hasCachedData: false,
      isPWA: false,
      isOnline: navigator.onLine
    };
  }
}

// Show offline status for debugging
function showOfflineStatus(capabilities) {
  // Remove existing status if any
  const existingStatus = document.querySelector('.offline-capabilities-status');
  if (existingStatus) {
    existingStatus.remove();
  }
  
  const statusDiv = document.createElement('div');
  statusDiv.className = 'offline-capabilities-status';
  statusDiv.style.cssText = `
    position: fixed;
    bottom: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 15px;
    border-radius: 8px;
    font-size: 12px;
    z-index: 9999;
    font-family: monospace;
    max-width: 300px;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
  `;
  
  const getStatusIcon = (status) => status ? '✅' : '❌';
  
  statusDiv.innerHTML = `
    <div style="margin-bottom: 8px; font-weight: bold; color: #4CAF50;">Offline Status</div>
    <div>🌐 Online: ${getStatusIcon(capabilities.isOnline)}</div>
    <div>📱 PWA: ${getStatusIcon(capabilities.isPWA)}</div>
    <div>🔧 SW: ${getStatusIcon(capabilities.hasServiceWorker)}</div>
    <div>💾 IndexedDB: ${getStatusIcon(capabilities.hasIndexedDB)}</div>
    <div>📦 Cached: ${getStatusIcon(capabilities.hasCachedData)}</div>
  `;
  
  document.body.appendChild(statusDiv);
  
  // Auto remove after 10 seconds
  setTimeout(() => {
    if (statusDiv.parentNode) {
      statusDiv.parentNode.removeChild(statusDiv);
    }
  }, 10000);
}

// Setup notification toggle functionality
function setupNotificationToggle() {
  const notificationToggle = document.getElementById('notification-toggle');
  if (!notificationToggle) return;

  // Check current notification permission status
  updateNotificationToggleState();

  notificationToggle.addEventListener('click', async () => {
    try {
      if (Notification.permission === 'default') {
        // Request permission
        const permission = await Notification.requestPermission();
        updateNotificationToggleState();
        
        if (permission === 'granted') {
          showNotification('Notifications enabled!', 'success');
          // Subscribe to push notifications
          await subscribeToPushNotifications();
        } else {
          showNotification('Notifications disabled', 'error');
        }
      } else if (Notification.permission === 'granted') {
        // Disable notifications (this is a simplified approach)
        showNotification('Notifications disabled', 'info');
        // In a real app, you might want to unsubscribe from push notifications
      } else {
        // Permission denied, show instructions
        showNotification('Please enable notifications in browser settings', 'info');
      }
    } catch (error) {
      console.error('Error toggling notifications:', error);
      showNotification('Failed to toggle notifications', 'error');
    }
  });
}

// Update notification toggle button state
function updateNotificationToggleState() {
  const notificationToggle = document.getElementById('notification-toggle');
  if (!notificationToggle) return;

  const icon = notificationToggle.querySelector('i');
  
  switch (Notification.permission) {
    case 'granted':
      notificationToggle.classList.add('active');
      notificationToggle.classList.remove('disabled');
      icon.className = 'fas fa-bell';
      notificationToggle.title = 'Notifications enabled (click to disable)';
      break;
    case 'denied':
      notificationToggle.classList.remove('active');
      notificationToggle.classList.add('disabled');
      icon.className = 'fas fa-bell-slash';
      notificationToggle.title = 'Notifications blocked (enable in settings)';
      break;
    default:
      notificationToggle.classList.remove('active', 'disabled');
      icon.className = 'fas fa-bell';
      notificationToggle.title = 'Click to enable notifications';
      break;
  }
}

// Show notification message
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
      <span>${message}</span>
      <button class="notification-close">&times;</button>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Auto remove after 3 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 3000);
  
  // Close button functionality
  const closeBtn = notification.querySelector('.notification-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    });
  }
}


