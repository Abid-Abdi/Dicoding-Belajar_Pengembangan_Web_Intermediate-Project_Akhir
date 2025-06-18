// PWA Install Prompt
let deferredPrompt;
let installPrompt = null;

export const initializePWAInstall = () => {
  // Listen for the beforeinstallprompt event
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    
    // Stash the event so it can be triggered later
    deferredPrompt = e;
    
    // Show the install prompt after a delay
    setTimeout(() => {
      showInstallPrompt();
    }, 3000);
  });

  // Listen for successful installation
  window.addEventListener('appinstalled', () => {
    console.log('PWA was installed');
    hideInstallPrompt();
    
    // Clear the deferredPrompt
    deferredPrompt = null;
  });
};

const showInstallPrompt = () => {
  // Don't show if already shown or if user dismissed it
  if (installPrompt || !deferredPrompt) {
    return;
  }

  // Create the install prompt element
  installPrompt = document.createElement('div');
  installPrompt.className = 'pwa-install-prompt';
  installPrompt.innerHTML = `
    <div class="pwa-install-content">
      <h4>Install Story App</h4>
      <p>Add this app to your home screen for quick and easy access when you're on the go.</p>
      <div class="pwa-install-actions">
        <button class="btn-secondary" id="pwa-dismiss">Not now</button>
        <button class="btn-primary" id="pwa-install">Install</button>
      </div>
    </div>
  `;

  document.body.appendChild(installPrompt);

  // Add event listeners
  document.getElementById('pwa-install').addEventListener('click', async () => {
    if (deferredPrompt) {
      // Show the install prompt
      deferredPrompt.prompt();
      
      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      
      // Clear the deferredPrompt
      deferredPrompt = null;
    }
    
    hideInstallPrompt();
  });

  document.getElementById('pwa-dismiss').addEventListener('click', () => {
    hideInstallPrompt();
    // Store in localStorage to remember user's choice
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  });
};

const hideInstallPrompt = () => {
  if (installPrompt) {
    installPrompt.remove();
    installPrompt = null;
  }
};

// Check if user has recently dismissed the prompt
export const shouldShowInstallPrompt = () => {
  const dismissed = localStorage.getItem('pwa-install-dismissed');
  if (!dismissed) return true;
  
  // Show again after 7 days
  const dismissedTime = parseInt(dismissed);
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  
  return Date.now() - dismissedTime > sevenDays;
}; 