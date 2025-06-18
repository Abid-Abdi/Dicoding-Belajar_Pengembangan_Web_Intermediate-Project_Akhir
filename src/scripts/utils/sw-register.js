import CONFIG from '../config.js';

// Service Worker Registration
export const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered successfully:', registration);
      
      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New content is available, show update notification
            showUpdateNotification();
          }
        });
      });
      
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }
};

// Show update notification
const showUpdateNotification = () => {
  const notification = document.createElement('div');
  notification.className = 'update-notification';
  notification.innerHTML = `
    <div class="update-content">
      <p>New version available!</p>
      <button onclick="window.location.reload()">Update Now</button>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Auto remove after 10 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 10000);
};

// Request notification permission
export const requestNotificationPermission = async () => {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
};

// Subscribe to push notifications
export async function subscribeToPushNotifications(registration) {
  try {
    console.log('Attempting to subscribe to push notifications...');
    
    // Check if already subscribed
    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
      console.log('Already subscribed to push notifications');
      return existingSubscription;
    }

    // Get VAPID public key from config (CONFIG is already imported at the top)
    if (!CONFIG.VAPID_PUBLIC_KEY) {
      console.error('VAPID public key not found in config');
      return null;
    }

    console.log('VAPID public key found:', CONFIG.VAPID_PUBLIC_KEY.substring(0, 20) + '...');
    console.log('VAPID key length:', CONFIG.VAPID_PUBLIC_KEY.length);

    // Convert VAPID key to Uint8Array
    const vapidPublicKey = urlBase64ToUint8Array(CONFIG.VAPID_PUBLIC_KEY);
    console.log('Converted VAPID key to Uint8Array, length:', vapidPublicKey.length);
    
    // Subscribe to push notifications
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidPublicKey
    });

    console.log('Successfully subscribed to push notifications:', subscription);
    
    // Store subscription in localStorage for persistence
    localStorage.setItem('pushSubscription', JSON.stringify(subscription));
    
    return subscription;
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    return null;
  }
}

// Unsubscribe from push notifications
export async function unsubscribeFromPushNotifications(registration) {
  try {
    console.log('Attempting to unsubscribe from push notifications...');
    
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      localStorage.removeItem('pushSubscription');
      console.log('Successfully unsubscribed from push notifications');
      return true;
    }
    
    console.log('No active subscription found');
    return false;
  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error);
    return false;
  }
}

// Check subscription status
export async function checkSubscriptionStatus(registration) {
  try {
    const subscription = await registration.pushManager.getSubscription();
    return {
      subscribed: !!subscription,
      subscription: subscription
    };
  } catch (error) {
    console.error('Error checking subscription status:', error);
    return {
      subscribed: false,
      subscription: null
    };
  }
}

// Restore subscription from localStorage if needed
export async function restoreSubscription(registration) {
  try {
    const storedSubscription = localStorage.getItem('pushSubscription');
    if (storedSubscription) {
      const subscription = JSON.parse(storedSubscription);
      console.log('Restoring subscription from localStorage');
      return subscription;
    }
    return null;
  } catch (error) {
    console.error('Error restoring subscription:', error);
    return null;
  }
}

// Convert VAPID public key
const urlBase64ToUint8Array = (base64String) => {
  try {
    // Remove any whitespace
    const base64 = base64String.trim();
    
    // Add padding if needed
    const padding = '='.repeat((4 - base64.length % 4) % 4);
    const paddedBase64 = base64 + padding;
    
    // Convert URL-safe base64 to standard base64
    const standardBase64 = paddedBase64
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    // Decode base64 to binary
    const rawData = window.atob(standardBase64);
    const outputArray = new Uint8Array(rawData.length);

    // Convert to Uint8Array
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    
    console.log('VAPID key converted successfully, length:', outputArray.length);
    return outputArray;
  } catch (error) {
    console.error('Error converting VAPID key:', error);
    throw new Error('Invalid VAPID public key format');
  }
}; 