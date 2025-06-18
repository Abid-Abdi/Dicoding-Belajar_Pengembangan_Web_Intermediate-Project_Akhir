// Network Status Indicator
class NetworkStatus {
    constructor() {
        this.statusIndicator = null;
        this.init();
    }

    init() {
        // Create status indicator
        this.createStatusIndicator();
        
        // Listen for online/offline events
        window.addEventListener('online', () => this.updateStatus(true));
        window.addEventListener('offline', () => this.updateStatus(false));
        
        // Initial status
        this.updateStatus(navigator.onLine);
    }

    createStatusIndicator() {
        this.statusIndicator = document.createElement('div');
        this.statusIndicator.className = 'network-status';
        this.statusIndicator.innerHTML = `
            <div class="network-status-content">
                <i class="fas fa-wifi"></i>
                <span class="network-status-text">Online</span>
            </div>
        `;
        
        document.body.appendChild(this.statusIndicator);
    }

    updateStatus(isOnline) {
        if (!this.statusIndicator) return;

        const icon = this.statusIndicator.querySelector('i');
        const text = this.statusIndicator.querySelector('.network-status-text');
        
        if (isOnline) {
            this.statusIndicator.className = 'network-status network-status-online';
            icon.className = 'fas fa-wifi';
            text.textContent = 'Online';
            
            // Hide after 3 seconds when online
            setTimeout(() => {
                this.statusIndicator.classList.add('network-status-hidden');
            }, 3000);
        } else {
            this.statusIndicator.className = 'network-status network-status-offline';
            icon.className = 'fas fa-wifi-slash';
            text.textContent = 'Offline';
            this.statusIndicator.classList.remove('network-status-hidden');
        }
    }

    destroy() {
        if (this.statusIndicator && this.statusIndicator.parentNode) {
            this.statusIndicator.parentNode.removeChild(this.statusIndicator);
        }
    }
}

export default NetworkStatus; 