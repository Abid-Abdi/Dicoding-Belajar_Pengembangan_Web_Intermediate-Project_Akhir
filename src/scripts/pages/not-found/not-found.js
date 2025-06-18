class NotFoundPage {
  constructor() {
    this.currentPath = window.location.hash.slice(1) || '/';
  }

  async render() {
    return `
      <div class="not-found-page">
        <div class="container">
          <div class="not-found-content">
            <div class="not-found-icon">
              <i class="fas fa-exclamation-triangle"></i>
            </div>
            
            <h1 class="not-found-title">404</h1>
            <h2 class="not-found-subtitle">Page Not Found</h2>
            
            <p class="not-found-description">
              Oops! The page you're looking for doesn't exist.
            </p>
            
            <div class="not-found-details">
              <p><strong>Requested URL:</strong> <code>${this.currentPath}</code></p>
              <p>This page might have been moved, deleted, or you entered the wrong URL.</p>
            </div>
            
            <div class="not-found-actions">
              <a href="#/" class="btn btn-primary">
                <i class="fas fa-home"></i>
                Go to Home
              </a>
              <button onclick="history.back()" class="btn btn-secondary">
                <i class="fas fa-arrow-left"></i>
                Go Back
              </button>
            </div>
            
            <div class="not-found-suggestions">
              <h3>You might want to try:</h3>
              <ul>
                <li><a href="#/">Home Page</a></li>
                <li><a href="#/about">About</a></li>
                <li><a href="#/story/add">Add Story</a></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async afterRender() {
    // Add any additional functionality after render
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Add any event listeners if needed
  }

  cleanup() {
    // Cleanup any resources
  }
}

export default NotFoundPage; 