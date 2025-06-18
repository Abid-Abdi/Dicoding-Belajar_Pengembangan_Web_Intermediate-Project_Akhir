import { userLogin } from '../../data/api';

class LoginPresenter {
    constructor(view) {
        this.view = view;
        this.init();
    }

    init() {
        // Listen for login event from View
        document.addEventListener('login', async (event) => {
            const { email, password } = event.detail;
            await this.handleLogin(email, password);
        });
    }

    async handleLogin(email, password) {
        try {
            // Update UI to loading state through view
            this.view.updateUIState(true);

            // Call Model to perform login
            const response = await userLogin({ email, password });

            if (response.loginResult && response.loginResult.token) {
                // Login successful
                this.view.handleLoginSuccess();
            } else {
                // Login failed
                this.view.handleLoginError('Login failed. Please check your credentials.');
            }
        } catch (error) {
            // Handle error through view
            this.view.handleLoginError(error.message || 'An error occurred during login.');
        } finally {
            // Reset UI state through view
            this.view.updateUIState(false);
        }
    }
}

export default LoginPresenter; 