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

  _toggleFooter(show = true) {
    const footer = document.querySelector('.footer');
    const body = document.body;
    
    if (footer) {
      if (show) {
        footer.classList.remove('hidden');
        body.classList.remove('auth-page');
      } else {
        footer.classList.add('hidden');
        body.classList.add('auth-page');
      }
    }
  }

  _shouldHideFooter(path) {
    // Hide footer for login and register pages
    return path === '/login' || path === '/register';
  }

  async _renderPage() {
    const mainContent = document.querySelector('#main-content');
    const hash = window.location.hash.slice(1);
    const [path, queryString] = hash.split('?');
    const url = path || '/';
    
    // Use getRoute to handle 404 pages
    const page = getRoute(url);

    // Check if we're transitioning from auth page to home page
    const isFromAuthToHome = this._currentPage && 
                           (this._currentPage.constructor.name === 'LoginPage' || 
                            this._currentPage.constructor.name === 'RegisterPage') &&
                           url === '/';

    try {
      // Special handling for auth to home transition
      if (isFromAuthToHome) {
        // Remove auth page styling immediately
        document.body.classList.remove('auth-page');
        
        // Show footer immediately
        const footer = document.querySelector('.footer');
        if (footer) {
          footer.classList.remove('hidden');
          footer.style.opacity = '1';
          footer.style.transform = 'translateY(0)';
        }
        
        // Render home page content directly
        mainContent.innerHTML = await page.render();
        
        // Store current page instance
        this._currentPage = page;
        
        // Run afterRender
        await page.afterRender();
        
        // Add fade-in animation to main content
        mainContent.style.opacity = '0';
        mainContent.style.transform = 'translateY(20px)';
        
        // Trigger reflow
        mainContent.offsetHeight;
        
        // Animate in
        mainContent.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        mainContent.style.opacity = '1';
        mainContent.style.transform = 'translateY(0)';
        
        // Clean up styles after animation
        setTimeout(() => {
          mainContent.style.transition = '';
          mainContent.style.opacity = '';
          mainContent.style.transform = '';
        }, 400);
        
        return;
      }

      // Show loader for other transitions
      mainContent.innerHTML = generateContentLoader();

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
          
          // Toggle footer based on current page
          this._toggleFooter(!this._shouldHideFooter(url));
        });

        // Wait for the transition to complete
        await transition.finished;
      } else {
        // Fallback for browsers that don't support View Transitions API
        mainContent.innerHTML = await page.render();
        
        // Store current page instance
        this._currentPage = page;
        
        await page.afterRender();
        
        // Toggle footer based on current page
        this._toggleFooter(!this._shouldHideFooter(url));
      }
    } catch (error) {
      console.error('Error rendering page:', error);
      mainContent.innerHTML = '<h1>Error loading page</h1>';
    }
  }
}

export default App;
