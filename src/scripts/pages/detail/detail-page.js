import DetailPresenter from './detail-presenter';
import Map from '../../utils/map';

export default class DetailPage {
  constructor() {
    this.map = new Map();
    this.presenter = new DetailPresenter(this, this.map);
  }

  async render() {
    return `
      <section class="container">
        <div class="story-detail-section">
          <div class="story-detail-header">
            <a href="#/" class="back-button">
              <i class="fas fa-arrow-left"></i> Back to Stories
            </a>
          </div>
          
          <div id="story-detail-content">
            <div class="loader-container">
              <div class="loader"></div>
              <div class="loader-text">Loading story details...</div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  async afterRender() {
    try {
      // Get story ID from URL
      const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
      const storyId = urlParams.get('id');

      if (!storyId) {
        this.showError('Story ID not found');
        return;
      }

      // Load story details through presenter
      await this.presenter.loadStoryDetail(storyId);
    } catch (error) {
      console.error('Error loading story details:', error);
      this.showError(error.message);
    }
  }

  // UI Update Methods
  updateStoryDetail(story) {
    const contentContainer = document.getElementById('story-detail-content');
    const createdAt = new Date(story.createdAt).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    contentContainer.innerHTML = `
      <div class="story-detail">
        <div class="story-detail-image">
          <img src="${story.photoUrl}" alt="${story.name}' story" loading="lazy">
        </div>
        
        <div class="story-detail-content">
          <div class="story-detail-header">
            <h1 class="story-detail-title">${story.name}</h1>
            <div class="story-detail-meta">
              <span class="story-detail-author">
                <i class="fas fa-user"></i>
                Posted by: ${story.name}
              </span>
              <span class="story-detail-date">
                <i class="fas fa-calendar"></i>
                Posted on: ${createdAt}
              </span>
            </div>
          </div>

          <div class="story-detail-description">
            <h2>Description</h2>
            <p>${story.description}</p>
          </div>

          ${story.lat && story.lon ? `
            <div class="story-detail-location">
              <h2>Location Details</h2>
              <div class="location-coordinates">
                <div class="coordinate">
                  <i class="fas fa-map-marker-alt"></i>
                  <span>Latitude: ${story.lat}</span>
                </div>
                <div class="coordinate">
                  <i class="fas fa-map-marker-alt"></i>
                  <span>Longitude: ${story.lon}</span>
                </div>
              </div>
            </div>
          ` : ''}
        </div>

        ${story.lat && story.lon ? `
          <div class="story-detail-map-container">
            <h2>Story Location</h2>
            <div id="story-detail-map" style="height: 400px;"></div>
          </div>
        ` : ''}
      </div>
    `;
  }

  showLoading() {
    const contentContainer = document.getElementById('story-detail-content');
    contentContainer.innerHTML = `
      <div class="loader-container">
        <div class="loader"></div>
        <div class="loader-text">Loading story details...</div>
      </div>
    `;
  }

  showError(message) {
    const contentContainer = document.getElementById('story-detail-content');
    contentContainer.innerHTML = `
      <div class="error-state">
        <p>Error: ${message}</p>
        <a href="#/" class="btn primary">Back to Home</a>
      </div>
    `;
  }

  cleanup() {
    if (this.map) {
      this.map.cleanup();
    }
  }
} 