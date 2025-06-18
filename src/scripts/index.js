// CSS imports
import '../styles/styles.css';

import App from './pages/app';
import { registerServiceWorker, requestNotificationPermission, subscribeToPushNotifications } from './utils/sw-register';
import { initializePWAInstall } from './utils/pwa-install';
import NetworkStatus from './utils/network-status';
import { syncOfflineStories } from './data/api';

const app = new App();
let networkStatus = null;

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
  app._renderPage();
  
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
  
  // Setup online/offline event listeners
  setupNetworkEventListeners();
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

window.addEventListener('hashchange', () => {
  app._renderPage();
});


