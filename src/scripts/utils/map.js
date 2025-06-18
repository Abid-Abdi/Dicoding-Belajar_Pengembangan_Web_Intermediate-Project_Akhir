class Map {
    constructor() {
        this.map = null;
        this.marker = null;
        this.markers = [];
        this.markerChangeCallback = null;
        this.defaultLocation = [-6.2088, 106.8456]; // Default to Jakarta
        this.defaultZoom = 13;
    }

    initialize(elementId, options = {}) {
        try {
            // Check if map already exists and remove it
            if (this.map) {
                this.cleanup();
            }

            const container = document.getElementById(elementId);
            if (!container) {
                throw new Error(`Map container with id "${elementId}" not found`);
            }

            // Clear any existing content
            container.innerHTML = '';

            // Initialize map
            this.map = L.map(elementId).setView(this.defaultLocation, this.defaultZoom);

            // Add OpenStreetMap tiles
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(this.map);

            // Add click handler to map only if clickable option is true
            if (options.clickable !== false) {
                this.map.on('click', (e) => {
                    const { lat, lng } = e.latlng;
                    
                    // Update or create marker
                    if (this.marker) {
                        this.marker.setLatLng([lat, lng]);
                    } else {
                        this.marker = L.marker([lat, lng]).addTo(this.map);
                    }

                    // Notify marker change
                    if (this.markerChangeCallback) {
                        this.markerChangeCallback({ latitude: lat, longitude: lng });
                    }
                });
            }
        } catch (error) {
            console.error('Error initializing map:', error);
            this.cleanup();
            throw error;
        }
    }

    onMarkerChange(callback) {
        this.markerChangeCallback = callback;
    }

    getMarkerLocation() {
        if (this.marker) {
            const { lat, lng } = this.marker.getLatLng();
            return { latitude: lat, longitude: lng };
        }
        return null;
    }

    setMarkerLocation(latitude, longitude, popup = null) {
        if (!this.map) return null;
        
        // Create and add new marker at specified location
        const marker = L.marker([latitude, longitude]).addTo(this.map);
        
        // Add popup if provided
        if (popup) {
            marker.bindPopup(popup);
        }
        
        // Add to markers array
        this.markers.push(marker);
        
        return marker;
    }

    clearMarkers() {
        // Remove all markers from map
        this.markers.forEach(marker => {
            if (this.map) {
                this.map.removeLayer(marker);
            }
        });
        this.markers = [];
    }

    clearMarker() {
        if (this.marker) {
            this.map.removeLayer(this.marker);
            this.marker = null;
        }
    }

    fitBounds() {
        if (this.markers.length > 0 && this.map) {
            const group = L.featureGroup(this.markers);
            this.map.fitBounds(group.getBounds().pad(0.1));
        }
    }

    // Helper method to create a custom marker icon
    createCustomIcon(iconUrl) {
        return L.icon({
            iconUrl: iconUrl,
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32]
        });
    }

    cleanup() {
        try {
            if (this.map) {
                this.clearMarkers();
                this.clearMarker();
                this.map.remove();
                this.map = null;
            }
            this.marker = null;
            this.markers = [];
            this.markerChangeCallback = null;
        } catch (error) {
            console.error('Error cleaning up map:', error);
        }
    }
}

export default Map;