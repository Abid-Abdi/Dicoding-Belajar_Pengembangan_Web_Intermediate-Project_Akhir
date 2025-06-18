import { userRegister } from '../../data/api';

class RegisterPresenter {
    constructor(view) {
        this.view = view;
        this.init();
    }

    init() {
        // Listen for register event from View
        document.addEventListener('register', async (event) => {
            const { name, email, password, confirmPassword } = event.detail;
            await this.handleRegister(name, email, password, confirmPassword);
        });
    }

    async handleRegister(name, email, password, confirmPassword) {
        try {
            // Validate passwords match
            if (password !== confirmPassword) {
                this.view.handleRegisterError('Passwords do not match!');
                return;
            }

            // Update UI to loading state through view
            this.view.updateUIState(true);

            // Call Model to perform registration
            const response = await userRegister({ name, email, password });

            if (response.ok) {
                // Registration successful
                this.view.handleRegisterSuccess();
            } else {
                // Registration failed
                this.view.handleRegisterError(response.message || 'Registration failed. Please try again.');
            }
        } catch (error) {
            // Handle error through view
            this.view.handleRegisterError(error.message || 'An error occurred during registration.');
        } finally {
            // Reset UI state through view
            this.view.updateUIState(false);
        }
    }
}

export default RegisterPresenter; 