import { addStory } from '../../data/api';
import DatabaseHelper from '../../utils/indexed-db';

class StoryPresenter {
    constructor(view) {
        this.view = view;
        this.db = new DatabaseHelper();
    }

    async handleStorySubmit({ description, imageBlob, latitude, longitude }) {
        try {
            // Update UI to loading state
            this.view.showLoading(true);

            // Check if we're online
            if (navigator.onLine) {
                await this.submitOnline(description, imageBlob, latitude, longitude);
            } else {
                await this.saveOffline(description, imageBlob, latitude, longitude);
            }
        } catch (error) {
            console.error('Error submitting story:', error);
            
            // If online submission fails, try to save offline
            if (navigator.onLine) {
                try {
                    await this.saveOffline(description, imageBlob, latitude, longitude);
                } catch (offlineError) {
                    console.error('Failed to save offline:', offlineError);
                    this.view.showError('Failed to save story. Please try again when online.');
                }
            } else {
                this.view.showError(error.message || 'An error occurred while adding story');
            }
        } finally {
            this.view.showLoading(false);
        }
    }

    async submitOnline(description, imageBlob, latitude, longitude) {
        // Create FormData for multipart/form-data
        const formData = new FormData();
        formData.append('description', description);
        formData.append('photo', imageBlob);
        
        // Add location if available
        if (latitude && longitude) {
            formData.append('lat', latitude);
            formData.append('lon', longitude);
        }

        // Call Model to add story
        const response = await addStory(formData);

        if (response.status === 'success') {
            await this.handleStorySuccess('Story added successfully!');
        } else {
            throw new Error(response.message || 'Failed to add story');
        }
    }

    async saveOffline(description, imageBlob, latitude, longitude) {
        // Convert image blob to base64 for storage
        const base64Image = await this.blobToBase64(imageBlob);
        
        // Create story object for offline storage
        const story = {
            title: description.substring(0, 50) + (description.length > 50 ? '...' : ''),
            description: description,
            photoUrl: base64Image,
            latitude: latitude,
            longitude: longitude,
            isOffline: true
        };

        // Save to IndexedDB using the new method
        await this.db.addOfflineStory(story);
        
        await this.handleStorySuccess('Story saved offline! It will be synced when you\'re online.');
    }

    async blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    async handleStorySuccess(message) {
        try {
            // Show success message
            this.view.showSuccess(message);
            
            // Navigate to home page
            window.location.replace('#/');
            
            // Reload the page to ensure fresh data
            window.location.reload();
        } catch (error) {
            console.error('Error during success handling:', error);
            // Fallback navigation
            window.location.href = '#/';
        }
    }

    cleanup() {
        // No cleanup needed as we're not using event listeners anymore
    }
}

export default StoryPresenter;
