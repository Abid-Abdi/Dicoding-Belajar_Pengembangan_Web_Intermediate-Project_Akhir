import StoryPresenter from './story-presenter';
import Camera from '../../utils/camera';
import Map from '../../utils/map';

export default class StoryPage {
    constructor() {
        this.camera = null;
        this.map = new Map();
        this.presenter = new StoryPresenter(this);
        this.boundSubmitHandler = this.handleFormSubmit.bind(this);
    }
    
    async render() {
        return `
          <section class="container">
            <h1>Add New Story</h1>
            <form id="story-form">
                <div class="input-form-group">
                    <label for="description">Description</label>
                    <textarea id="description" class="input-field" resize="none" required></textarea>
                </div>

                <div class="input-form-group">
                    <label for="camera-input">Photo</label>
                    <div class="camera-container">
                        <select id="camera-select" class="camera-select">
                            <option value="">Initializing camera...</option>
                        </select>
                        <div class="camera-preview-container">
                            <div class="camera-preview-wrapper">
                                <video id="camera-preview" autoplay playsinline></video>
                                <button type="button" id="camera-capture" class="camera-button" disabled>Take Photo</button>
                            </div>
                            <div class="camera-result-wrapper">
                                <img id="camera-result" style="display: none;">
                            </div>
                        </div>
                        <canvas id="camera-canvas" style="display: none;"></canvas>
                    </div>
                </div>

                <div class="input-form-group">
                    <label for="map">Location</label>
                    <div id="map" class="map-container" style="height: 400px;"></div>
                    <p class="map-info">Click on the map to set location</p>
                    <div class="location-inputs">
                        <div class="input-group">
                            <label for="latitude">Latitude</label>
                            <input type="text" id="latitude" class="input-field" readonly>
                        </div>
                        <div class="input-group">
                            <label for="longitude">Longitude</label>
                            <input type="text" id="longitude" class="input-field" readonly>
                        </div>
                    </div>
                </div>

                <button type="submit" id="submit-button">Add Story</button>
            </form>
          </section>
        `;
    }
    
    async afterRender() {
        try {
            // Create new camera instance
            this.camera = new Camera();
            
            // Initialize camera
            await this.initializeCamera();

            // Initialize map with clickable option enabled
            this.map.initialize('map', { clickable: true });

            // Setup map marker change listener
            this.map.onMarkerChange((location) => {
                this.updateLocationInputs(location);
            });

            // Setup form submission
            const storyForm = document.getElementById('story-form');
            if (storyForm) {
                storyForm.addEventListener('submit', this.boundSubmitHandler);
            }

        } catch (error) {
            console.error('Error initializing story page:', error);
            this.showError('Failed to initialize page. Please refresh and try again.');
        }
    }

    updateLocationInputs(location) {
        const latitudeInput = document.getElementById('latitude');
        const longitudeInput = document.getElementById('longitude');
        
        if (location) {
            latitudeInput.value = location.latitude.toFixed(6);
            longitudeInput.value = location.longitude.toFixed(6);
        } else {
            latitudeInput.value = '';
            longitudeInput.value = '';
        }
    }

    async handleFormSubmit(event) {
        event.preventDefault();
        
        const descriptionInput = document.getElementById('description');
        if (!descriptionInput) {
            this.showError('Form elements not found. Please refresh the page.');
            return;
        }

        const description = descriptionInput.value.trim();
        if (!description) {
            this.showError('Please fill in the description field.');
            return;
        }

        try {
            const imageBlob = await this.camera.getImageBlob();
            if (!imageBlob) {
                this.showError('Please take a photo first.');
                return;
            }

            const location = this.map.getMarkerLocation();
            
            // Call presenter to handle submission
            await this.presenter.handleStorySubmit({
                description,
                imageBlob,
                latitude: location?.latitude,
                longitude: location?.longitude
            });
        } catch (error) {
            console.error('Error submitting story:', error);
            this.showError('Error submitting story. Please try again.');
        }
    }

    showError(message) {
        alert(message);
    }

    showSuccess(message) {
        // Create a success notification
        const notification = document.createElement('div');
        notification.className = 'notification notification-success';
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-check-circle"></i>
                <span>${message}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;

        document.body.appendChild(notification);

        // Auto remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);

        // Close button
        notification.querySelector('.notification-close').addEventListener('click', () => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });
    }

    showLoading(isLoading) {
        const submitButton = document.getElementById('submit-button');
        if (submitButton) {
            submitButton.disabled = isLoading;
            submitButton.textContent = isLoading ? 'Adding Story...' : 'Add Story';
        }
    }

    async initializeCamera() {
        try {
            // Check if all required elements exist
            const requiredElements = [
                'camera-preview',
                'camera-canvas',
                'camera-capture',
                'camera-result',
                'camera-select'
            ];

            const missingElements = requiredElements.filter(id => !document.getElementById(id));
            if (missingElements.length > 0) {
                throw new Error(`Missing camera elements: ${missingElements.join(', ')}`);
            }

            await this.camera.initialize();
            
            // Enable capture button after successful initialization
            const captureButton = document.getElementById('camera-capture');
            if (captureButton) {
                captureButton.disabled = false;
            }
        } catch (error) {
            console.error('Error initializing camera:', error);
            throw error;
        }
    }

    // Cleanup method to be called when leaving the page
    cleanup() {
        // Remove form event listener
        const storyForm = document.getElementById('story-form');
        if (storyForm) {
            storyForm.removeEventListener('submit', this.boundSubmitHandler);
        }
        
        // Stop camera stream and cleanup
        if (this.camera) {
            this.camera.cleanup();
            this.camera = null;
        }
        
        // Reset camera UI elements
        this.resetCameraUI();
        
        // Cleanup map
        if (this.map) {
            this.map.cleanup();
        }

        // Cleanup presenter
        if (this.presenter) {
            this.presenter.cleanup();
        }
    }

    resetCameraUI() {
        const video = document.getElementById('camera-preview');
        const resultImage = document.getElementById('camera-result');
        const captureButton = document.getElementById('camera-capture');
        const selectCamera = document.getElementById('camera-select');
        
        if (video) {
            video.srcObject = null;
            video.pause();
        }
        if (resultImage) {
            resultImage.src = '';
            resultImage.style.display = 'none';
        }
        if (captureButton) {
            captureButton.disabled = true;
        }
        if (selectCamera) {
            selectCamera.innerHTML = '<option value="">Initializing camera...</option>';
        }
    }
}
    