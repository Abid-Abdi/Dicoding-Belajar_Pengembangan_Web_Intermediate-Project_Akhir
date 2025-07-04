import { isAuthenticated, logout } from './data/api';

export function generateContentLoader() {
  return `
    <div class="loader-container" id="global-loader">
      <div class="loader"></div>
      <div class="loader-text">Loading...</div>
    </div>`;
}

export function generateHeader() {
  const isLoggedIn = isAuthenticated();
  const currentPath = window.location.hash.slice(1) || '/';
  
  // Base header structure
  const baseHeader = `
    <header class="app-header">
      <div class="main-header container">
        <a class="brand-name" href="#/">Story App</a>
        <nav id="navigation-drawer" class="navigation-drawer">
          <ul id="nav-list" class="nav-list">
            ${generateNavigationItems(isLoggedIn, currentPath)}
          </ul>
        </nav>
        <button id="drawer-button" class="drawer-button" aria-label="Toggle navigation menu">☰</button>
      </div>
    </header>
  `;

  return baseHeader;
}

// Helper function to generate navigation items based on auth state
function generateNavigationItems(isLoggedIn, currentPath) {
  // Auth pages (login/register) should show minimal navigation
  if (currentPath === '/login' || currentPath === '/register') {
    return `
      <li><a href="#/login" class="${currentPath === '/login' ? 'active' : ''}">Login</a></li>
      <li><a href="#/register" class="${currentPath === '/register' ? 'active' : ''}">Register</a></li>
    `;
  }

  // Main navigation for logged-in users
  if (isLoggedIn) {
    return `
      <li><a href="#/" class="${currentPath === '/' ? 'active' : ''}">Home</a></li>
      <li><a href="#/about" class="${currentPath === '/about' ? 'active' : ''}">About</a></li>
      <li><a href="#/story/add" class="${currentPath === '/story/add' ? 'active' : ''}">Add Story</a></li>
      <li><a href="#/logout" id="logout-link" class="nav-link">Logout</a></li>
    `;
  }

  // Default navigation for non-logged in users
  return `
    <li><a href="#/login">Login</a></li>
    <li><a href="#/register">Register</a></li>
  `;
}

export function generateStoryCard(story) {
  // Format date
  const createdAt = new Date(story.createdAt).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `
    <div class="story-card" data-story-id="${story.id}" role="button" tabindex="0">
      <div class="story-image">
        <img src="${story.photoUrl}" alt="${story.name}' story" loading="lazy">
      </div>
      <div class="story-content">
        <h3 class="story-name">${story.name}</h3>
        <p class="story-description">${story.description}</p>
        <div class="story-meta">
          <span class="story-date">${createdAt}</span>
        </div>
      </div>
    </div>
  `;
}

export function generateStoryList(stories) {
  if (!stories || stories.length === 0) {
    return `
      <div class="empty-state">
        <p>No stories available yet. Be the first to share your story!</p>
      </div>
    `;
  }

  return `
    <div class="story-list">
      ${stories.map(story => generateStoryCard(story)).join('')}
    </div>
  `;
}

export function setupHeader() {
  const drawerButton = document.getElementById('drawer-button');
  const navDrawer = document.getElementById('navigation-drawer');
  const logoutLink = document.getElementById('logout-link');

  // Toggle drawer
  if (drawerButton) {
    drawerButton.addEventListener('click', () => {
      navDrawer.classList.toggle('open');
    });
  }

  // Handle logout
  if (logoutLink) {
    logoutLink.addEventListener('click', (event) => {
      event.preventDefault();
      logout();
    });
  }

  // Close drawer when clicking outside
  document.addEventListener('click', (event) => {
    if (navDrawer && !navDrawer.contains(event.target) && !drawerButton.contains(event.target)) {
      navDrawer.classList.remove('open');
    }
  });
}

