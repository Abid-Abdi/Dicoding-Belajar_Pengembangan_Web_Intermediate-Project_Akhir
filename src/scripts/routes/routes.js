import { isAuthenticated } from '../data/api.js';

// Import pages
import HomePage from '../pages/home/home-page.js';
import StoryPage from '../pages/Story/story-page.js';
import LoginPage from '../pages/login/login-page.js';
import RegisterPage from '../pages/register/register-page.js';
import AboutPage from '../pages/about/about-page.js';
import DetailPage from '../pages/detail/detail-page.js';
import NotFoundPage from '../pages/not-found/not-found.js';

// Helper function to check authentication
const requireAuth = (page) => {
  return {
    render: async () => {
      if (!isAuthenticated()) {
        window.location.href = '#/login';
        return '';
      }
      return await page.render();
    },
    afterRender: async () => {
      if (isAuthenticated()) {
        await page.afterRender();
      }
    }
  };
};

// Helper function to redirect if authenticated
const redirectIfAuth = (page) => {
  return {
    render: async () => {
      if (isAuthenticated()) {
        window.location.href = '#/';
        return '';
      }
      return await page.render();
    },
    afterRender: async () => {
      if (!isAuthenticated()) {
        await page.afterRender();
      }
    }
  };
};

const routes = {
  '/': requireAuth(new HomePage()),
  '/login': redirectIfAuth(new LoginPage()),
  '/register': redirectIfAuth(new RegisterPage()),
  '/about': requireAuth(new AboutPage()),
  '/story/add': requireAuth(new StoryPage()),
  '/detail': requireAuth(new DetailPage()),
};

// Helper function to get route or return 404
export const getRoute = (path) => {
  return routes[path] || {
    render: async () => {
      const notFoundPage = new NotFoundPage();
      return await notFoundPage.render();
    },
    afterRender: async () => {
      const notFoundPage = new NotFoundPage();
      await notFoundPage.afterRender();
    }
  };
};

export default routes;
