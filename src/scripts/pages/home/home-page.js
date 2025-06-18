import { generateStoryList } from '../../templates.js';
import HomePresenter from './home-presenter.js';
import Map from '../../utils/map.js';

export default class HomePage {
  constructor() {
    this.map = new Map();
    this.presenter = new HomePresenter(this, this.map);
  }

  async render() {
    return `
      <section class="container">
        <!-- Welcome Section -->
        <div class="welcome-section">
          <h1>Welcome to Story App</h1>
          <p class="welcome-message">Share your stories and explore others' experiences</p>
        </div>

        <!-- Notification Subscription Section -->
        <div class="notification-section">
          <div class="notification-content">
            <div class="notification-icon">🔔</div>
            <div class="notification-text">
              <h3>Stay Updated!</h3>
              <p>Get notified when new stories are added to the app</p>
            </div>
            <button id="subscribe-notifications" class="btn subscribe-btn">
              <span class="btn-icon">📱</span>
              <span class="btn-text">Subscribe to Notifications</span>
            </button>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="action-buttons">
          <button id="view-stories" class="btn primary">View All Stories</button>
          <a href="#/story/add" class="btn secondary">Add New Story</a>
        </div>

        <!-- Map Section -->
        <div class="map-section">
          <h2>Story Locations</h2>
          <div id="story-map" style="height: 400px;"></div>
        </div>

        <!-- Stories Section -->
        <div class="stories-section">
          <h2>Latest Stories</h2>
          <div id="story-list" class="story-list-container">
            <div class="loader-container">
              <div class="loader"></div>
              <div class="loader-text">Loading stories...</div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  async afterRender() {
    await this.presenter.afterRender();
    
    // Setup event listeners after DOM is ready
    this.setupEventListeners();
    
    // Check subscription status on page load
    await this.checkSubscriptionStatus();
  }

  async checkSubscriptionStatus() {
    try {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        const registration = await navigator.serviceWorker.ready;
        const { checkSubscriptionStatus } = await import('../../utils/sw-register.js');
        
        const status = await checkSubscriptionStatus(registration);
        
        if (status.subscribed) {
          this.updateSubscribeButtonState('subscribed');
        }
      }
    } catch (error) {
      console.error('Error checking subscription status:', error);
    }
  }

  setupEventListeners() {
    const viewStoriesButton = document.getElementById('view-stories');
    viewStoriesButton.addEventListener('click', () => {
      const storyList = document.getElementById('story-list');
      storyList.scrollIntoView({ behavior: 'smooth' });
    });

    // Notification subscription button
    const subscribeButton = document.getElementById('subscribe-notifications');
    if (subscribeButton) {
      subscribeButton.addEventListener('click', () => {
        this.handleNotificationSubscription();
      });
    }

    const storyList = document.getElementById('story-list');
    storyList.addEventListener('click', (event) => {
      const storyCard = event.target.closest('.story-card');
      if (!storyCard) return;

      const storyId = storyCard.dataset.storyId;
      if (!storyId) return;

      this.presenter.handleStoryClick(storyId);
    });

    // Add keyboard support for accessibility
    storyList.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        const storyCard = event.target.closest('.story-card');
        if (storyCard) {
          event.preventDefault();
          storyCard.click();
        }
      }
    });
  }

  async handleNotificationSubscription() {
    const subscribeButton = document.getElementById('subscribe-notifications');
    if (!subscribeButton) return;

    try {
      // Disable button and show loading state
      subscribeButton.disabled = true;
      subscribeButton.innerHTML = `
        <span class="btn-icon">⏳</span>
        <span class="btn-text">Requesting Permission...</span>
      `;

      // Check if notifications are supported
      if (!('Notification' in window)) {
        this.showNotificationMessage('Notifications are not supported in this browser', 'error');
        return;
      }

      // Check current permission status
      if (Notification.permission === 'granted') {
        // Already subscribed, try to subscribe to push notifications
        await this.subscribeToPushNotifications();
      } else if (Notification.permission === 'denied') {
        this.showNotificationMessage('Notification permission was denied. Please enable it in your browser settings.', 'error');
      } else {
        // Request permission
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          await this.subscribeToPushNotifications();
        } else {
          this.showNotificationMessage('Notification permission denied', 'error');
        }
      }
    } catch (error) {
      console.error('Error handling notification subscription:', error);
      this.showNotificationMessage('Failed to subscribe to notifications', 'error');
    } finally {
      // Reset button state
      this.resetSubscribeButton();
    }
  }

  async subscribeToPushNotifications() {
    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Check if already subscribed
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        this.showNotificationMessage('Already subscribed to notifications!', 'success');
        return;
      }

      // Import the subscription function
      const { subscribeToPushNotifications } = await import('../../utils/sw-register.js');
      
      // Subscribe to push notifications
      const subscription = await subscribeToPushNotifications(registration);
      
      if (subscription) {
        this.showNotificationMessage('Successfully subscribed to notifications!', 'success');
        this.updateSubscribeButtonState('subscribed');
      } else {
        this.showNotificationMessage('Failed to subscribe to notifications', 'error');
      }
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      this.showNotificationMessage('Failed to subscribe to notifications', 'error');
    }
  }

  showNotificationMessage(message, type = 'info') {
    // Remove existing notification
    const existingNotification = document.querySelector('.notification-message');
    if (existingNotification) {
      existingNotification.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification-message notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-text">${message}</span>
        <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;
    
    const colors = {
      success: '#4CAF50',
      error: '#f44336',
      info: '#2196F3'
    };
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1000;
      padding: 15px 20px;
      background-color: ${colors[type]};
      color: white;
      border-radius: 5px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      font-size: 14px;
      max-width: 400px;
      animation: slideDown 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
  }

  updateSubscribeButtonState(state) {
    const subscribeButton = document.getElementById('subscribe-notifications');
    if (!subscribeButton) return;

    if (state === 'subscribed') {
      subscribeButton.innerHTML = `
        <span class="btn-icon">✅</span>
        <span class="btn-text">Subscribed!</span>
      `;
      subscribeButton.style.backgroundColor = '#4CAF50';
      subscribeButton.disabled = true;
    }
  }

  resetSubscribeButton() {
    const subscribeButton = document.getElementById('subscribe-notifications');
    if (!subscribeButton) return;

    subscribeButton.disabled = false;
    subscribeButton.innerHTML = `
      <span class="btn-icon">📱</span>
      <span class="btn-text">Subscribe to Notifications</span>
    `;
    subscribeButton.style.backgroundColor = '';
  }

  // UI Update Methods
  updateStoriesList(stories) {
    const storyListContainer = document.getElementById('story-list');
    if (stories.length === 0) {
      storyListContainer.innerHTML = `
        <div class="empty-state">
          <p>No stories available yet. Be the first to share your story!</p>
        </div>
      `;
    } else {
      storyListContainer.innerHTML = generateStoryList(stories);
    }
  }

  showLoading() {
    const storyListContainer = document.getElementById('story-list');
    storyListContainer.innerHTML = `
      <div class="loader-container">
        <div class="loader"></div>
        <div class="loader-text">Loading stories...</div>
      </div>
    `;
  }

  showError(message) {
    const storyListContainer = document.getElementById('story-list');
    storyListContainer.innerHTML = `
      <div class="error-state">
        <p>Error: ${message}</p>
        <button onclick="window.location.reload()">Try Again</button>
      </div>
    `;
  }

  updateMapMarkers(stories) {
    // Clear existing markers
    this.map.clearMarkers();

    // Add markers for each story with location
    stories.forEach(story => {
      if (story.lat && story.lon) {
        const popupContent = `
          <div class="story-popup">
            <h3>${story.name}</h3>
            <p>${story.description}</p>
            <small>Posted on: ${new Date(story.createdAt).toLocaleDateString()}</small>
            <a href="#/detail?id=${story.id}" class="popup-link">View Details</a>
          </div>
        `;
        
        this.map.setMarkerLocation(story.lat, story.lon, popupContent);
      }
    });

    // Fit map to show all markers
    this.map.fitBounds();
  }
}
