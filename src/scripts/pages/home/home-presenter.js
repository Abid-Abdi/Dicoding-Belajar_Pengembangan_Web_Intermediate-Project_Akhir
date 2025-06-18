import { showStories } from '../../data/api';
import DatabaseHelper from '../../utils/indexed-db';

class HomePresenter {
  constructor(view, map) {
    this.view = view;
    this.map = map;
    this.stories = [];
    this.db = new DatabaseHelper();
  }

  async loadStories() {
    try {
      // Show loading state through view
      this.view.showLoading();

      // Fetch stories from API (Model) - sync happens automatically
      const response = await showStories();
      this.stories = response.listStory || [];

      // Update UI through view
      this.view.updateStoriesList(this.stories);
      this.view.updateMapMarkers(this.stories);
      
      // Log sync status for debugging
      await this.logSyncStatus();
    } catch (error) {
      console.error('Error loading stories:', error);
      this.view.showError(error.message);
    }
  }

  async logSyncStatus() {
    try {
      const stats = await this.db.getCacheStats();
      console.log('📊 Cache Status:', {
        total: stats.total,
        offline: stats.offline,
        cached: stats.cached,
        syncing: stats.syncing,
        failed: stats.failed
      });
      
      if (stats.offline > 0) {
        console.log(`📱 ${stats.offline} offline stories will be synced automatically when online`);
      }
      
      if (stats.syncing > 0) {
        console.log(`⏳ ${stats.syncing} stories are currently syncing`);
      }
      
      if (stats.failed > 0) {
        console.log(`❌ ${stats.failed} stories failed to sync permanently`);
      }
      
      // Log sync methods if available
      try {
        const allStories = await this.db.getAllStories();
        const syncMethods = {};
        allStories.forEach(story => {
          if (story.syncMethod) {
            syncMethods[story.syncMethod] = (syncMethods[story.syncMethod] || 0) + 1;
          }
        });
        
        if (Object.keys(syncMethods).length > 0) {
          console.log('🔄 Sync Methods:', syncMethods);
        }
      } catch (error) {
        // Ignore error for sync method logging
      }
    } catch (error) {
      console.error('Failed to get cache stats:', error);
    }
  }

  handleStoryClick(storyId) {
    // Handle navigation through presenter
    window.location.hash = `#/detail?id=${storyId}`;
  }

  async afterRender() {
    // Initialize map with clickable option disabled
    this.map.initialize('story-map', { clickable: false });

    // Load initial stories
    await this.loadStories();
  }
}

export default HomePresenter;
