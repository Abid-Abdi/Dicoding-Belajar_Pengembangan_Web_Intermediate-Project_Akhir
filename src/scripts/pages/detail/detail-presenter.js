import { storyDetail } from '../../data/api';
import Map from '../../utils/map';

class DetailPresenter {
  constructor(view, map) {
    this.view = view;
    this.map = map;
    this.story = null;
  }

  async loadStoryDetail(storyId) {
    try {
      // Show loading state through view
      this.view.showLoading();

      // Fetch story details from API (Model)
      const response = await storyDetail(storyId);
      this.story = response.story;

      // Update UI through view
      this.view.updateStoryDetail(this.story);

      // Initialize map if location exists
      if (this.story.lat && this.story.lon) {
        this.initializeMap();
      }
    } catch (error) {
      console.error('Error loading story details:', error);
      this.view.showError(error.message);
    }
  }

  initializeMap() {
    // Initialize map with story location
    this.map.initialize('story-detail-map', {
      center: [this.story.lat, this.story.lon],
      zoom: 10,
      clickable: false
    });

    // Add marker for story location
    this.map.setMarkerLocation(
      this.story.lat,
      this.story.lon,
      `
        <div class="story-popup">
          <h3>${this.story.name}</h3>
          <p>${this.story.description}</p>
          <p><small>Posted on: ${new Date(this.story.createdAt).toLocaleDateString()}</small></p>
        </div>
      `
    );

    // Ensure map focuses on the marker
    this.map.map.setView([this.story.lat, this.story.lon], 10);
  }
}

export default DetailPresenter; 