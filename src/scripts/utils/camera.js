class Camera {
    constructor() {
        this.video = null;
        this.canvas = null;
        this.captureButton = null;
        this.resultImage = null;
        this.stream = null;
        this.selectCameraElement = null;
        this.devices = [];
        this.isInitialized = false;
        this.boundCaptureImage = this.captureImage.bind(this);
        this.boundSwitchCamera = this.switchCamera.bind(this);
        this.boundHandleNavigation = this.handleNavigation.bind(this);
        this.lastCapturedBlob = null;
    }

    async initialize() {
        if (this.isInitialized) return;

        this.video = document.getElementById('camera-preview');
        this.canvas = document.getElementById('camera-canvas');
        this.captureButton = document.getElementById('camera-capture');
        this.resultImage = document.getElementById('camera-result');
        this.selectCameraElement = document.getElementById('camera-select');

        if (!this.video || !this.canvas || !this.captureButton || !this.resultImage || !this.selectCameraElement) {
            console.error('Required camera elements not found');
            return;
        }

        try {
            // Get initial stream with default camera
            this.stream = await this.getStream();
            if (this.stream) {
                this.video.srcObject = this.stream;
                this.captureButton.addEventListener('click', this.boundCaptureImage);
                
                // Populate camera devices list
                await this.populateDeviceList();
                
                // Add event listener for camera selection change
                this.selectCameraElement.addEventListener('change', this.boundSwitchCamera);

                // Add event listener for navigation
                window.addEventListener('hashchange', this.boundHandleNavigation);
                document.addEventListener('story-submit', this.boundHandleNavigation);

                this.isInitialized = true;
            }
        } catch (error) {
            console.error('Error accessing camera:', error);
            alert('Could not access camera. Please make sure you have granted camera permissions.');
        }
    }

    handleNavigation() {
        // Stop camera when navigating away or submitting
        this.stopCamera();
    }

    async getStream() {
        try {
            const deviceId = this.selectCameraElement?.value || undefined;
            
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    deviceId: deviceId ? { exact: deviceId } : undefined,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });

            return stream;
        } catch (error) {
            console.error('Error getting stream:', error);
            return null;
        }
    }

    async populateDeviceList() {
        try {
            // Get all video input devices
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.devices = devices.filter(device => device.kind === 'videoinput');

            // Clear existing options
            this.selectCameraElement.innerHTML = '';

            // Add options for each camera
            this.devices.forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `Camera ${this.selectCameraElement.length + 1}`;
                this.selectCameraElement.appendChild(option);
            });

            // If we have multiple cameras, show the select element
            this.selectCameraElement.style.display = this.devices.length > 1 ? 'block' : 'none';
        } catch (error) {
            console.error('Error populating device list:', error);
        }
    }

    async switchCamera() {
        try {
            // Stop current stream
            this.stopCamera();

            // Get new stream with selected camera
            this.stream = await this.getStream();
            if (this.stream) {
                this.video.srcObject = this.stream;
                this.isInitialized = true;
            }
        } catch (error) {
            console.error('Error switching camera:', error);
            alert('Failed to switch camera. Please try again.');
        }
    }

    async captureImage() {
        try {
            if (!this.video || !this.canvas) {
                throw new Error('Camera not properly initialized');
            }

            // Set canvas size to match video
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
            
            // Draw current video frame to canvas
            const context = this.canvas.getContext('2d');
            context.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
            
            // Convert canvas to blob and display
            this.canvas.toBlob((blob) => {
                if (blob) {
                    // Store the blob for later use
                    this.lastCapturedBlob = blob;
                    
                    // Create and display image URL
                    const imageUrl = URL.createObjectURL(blob);
                    this.resultImage.src = imageUrl;
                    this.resultImage.style.display = 'block';

                    // Revoke previous URL to prevent memory leaks
                    if (this.resultImage.dataset.previousUrl) {
                        URL.revokeObjectURL(this.resultImage.dataset.previousUrl);
                    }
                    this.resultImage.dataset.previousUrl = imageUrl;
                } else {
                    console.error('Failed to create image blob');
                    alert('Failed to capture image. Please try again.');
                }
            }, 'image/jpeg', 0.8);
        } catch (error) {
            console.error('Error capturing image:', error);
            alert('Failed to capture image. Please try again.');
        }
    }

    async getImageBlob() {
        return this.lastCapturedBlob;
    }

    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => {
                track.stop();
                track.enabled = false;
            });
            this.stream = null;
        }
        if (this.video) {
            this.video.srcObject = null;
            this.video.pause();
        }
        if (this.resultImage && this.resultImage.dataset.previousUrl) {
            URL.revokeObjectURL(this.resultImage.dataset.previousUrl);
        }
        this.lastCapturedBlob = null;
        this.isInitialized = false;
    }

    cleanup() {
        // Stop camera stream
        this.stopCamera();
        
        // Remove event listeners
        if (this.captureButton) {
            this.captureButton.removeEventListener('click', this.boundCaptureImage);
        }
        if (this.selectCameraElement) {
            this.selectCameraElement.removeEventListener('change', this.boundSwitchCamera);
        }
        window.removeEventListener('hashchange', this.boundHandleNavigation);
        document.removeEventListener('story-submit', this.boundHandleNavigation);

        // Clear any remaining references
        this.video = null;
        this.canvas = null;
        this.captureButton = null;
        this.resultImage = null;
        this.selectCameraElement = null;
        this.devices = [];
    }
}

export default Camera;