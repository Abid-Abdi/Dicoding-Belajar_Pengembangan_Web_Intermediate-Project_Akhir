import { generateHeader, setupHeader, generateContentLoader } from '../templates';
import routes, { getRoute } from '../routes/routes';
import { isAuthenticated } from '../data/api';

class App {
  constructor() {
    this._init();
    this._currentPage = null;
  }

  _init() {
    // Setup initial header
    this._updateHeader();

    // Setup routing
    window.addEventListener('hashchange', () => {
      // Cleanup current page if exists
      if (this._currentPage && typeof this._currentPage.cleanup === 'function') {
        this._currentPage.cleanup();
      }
      
      this._updateHeader();
      this._renderPage();
    });

    // Setup skip to content
    this._setupSkipToContent();

    // Initial render
    this._renderPage();
  }

  _setupSkipToContent() {
    const skipLink = document.querySelector('.skip-to-content');
    if (skipLink) {
      // Handle click and keydown events
      const handleSkipToContent = (e) => {
        // Prevent default behavior for both click and keydown
        e.preventDefault();
        
        const mainContent = document.querySelector('#main-content');
        if (mainContent) {
          // Set tabIndex to make the element focusable
          mainContent.tabIndex = -1;
          
          // Focus and scroll to main content
          mainContent.focus();
          mainContent.scrollIntoView({ behavior: 'smooth' });
          
          // Remove tabIndex after focus
          setTimeout(() => {
            mainContent.removeAttribute('tabIndex');
          }, 1000);
        }
      };

      // Add event listeners for both click and keydown
      skipLink.addEventListener('click', handleSkipToContent);
      skipLink.addEventListener('keydown', (e) => {
        // Handle both Enter and Space keys
        if (e.key === 'Enter' || e.key === ' ') {
          handleSkipToContent(e);
        }
      });
    }
  }

  _updateHeader() {
    document.querySelector('header').innerHTML = generateHeader();
    setupHeader();
  }

  async _renderPage() {
    const mainContent = document.querySelector('#main-content');
    const hash = window.location.hash.slice(1);
    const [path, queryString] = hash.split('?');
    const url = path || '/';
    
    // Use getRoute to handle 404 pages
    const page = getRoute(url);

    // Show loader
    mainContent.innerHTML = generateContentLoader();

    try {
      // Start view transition if supported
      if (document.startViewTransition) {
        // Create a new transition
        const transition = document.startViewTransition(async () => {
          // Render page content
          mainContent.innerHTML = await page.render();
          
          // Store current page instance
          this._currentPage = page;
          
          // Run afterRender
          await page.afterRender();
        });

        // Wait for the transition to complete
        await transition.finished;
      } else {
        // Fallback for browsers that don't support View Transitions API
        mainContent.innerHTML = await page.render();
        
        // Store current page instance
        this._currentPage = page;
        
        await page.afterRender();
      }
    } catch (error) {
      console.error('Error rendering page:', error);
      mainContent.innerHTML = '<h1>Error loading page</h1>';
    }
  }
}

export default App;
