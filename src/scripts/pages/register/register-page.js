import RegisterPresenter from './register-presenter';

export default class RegisterPage {
    constructor() {
        this.presenter = new RegisterPresenter(this);
    }

    async render() {
        return `
            <div class="register-container">
                <h1>Register</h1>
                <form id="register-form">
                    <div class="input-form-group">
                        <label for="username">Username</label>
                        <input type="text" name="username" id="username" class="input-field" placeholder="john_doe" required>
                    </div>
                    <div class="input-form-group">
                        <label for="email">Email</label>
                        <input type="email" name="email" id="email" class="input-field" placeholder="john_doe@example.com" required>
                    </div>
                    <div class="input-form-group">
                        <label for="password">Password</label>
                        <input type="password" name="password" id="password" class="input-field" placeholder="********" required>
                    </div>
                    <div class="input-form-group">
                        <label for="confirm-password">Confirm Password</label>
                        <input type="password" name="confirm-password" id="confirm-password" class="input-field" placeholder="********" required>
                    </div>
                    <button type="submit">Register</button>
                    <p>Already have an account? <a href="#/login">Login</a></p>
                </form>
            </div>
        `;
    }
    
    async afterRender() {
        const registerForm = document.getElementById('register-form');
        
        registerForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            
            // Get form values
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            
            // Emit event untuk Presenter
            const registerEvent = new CustomEvent('register', {
                detail: {
                    name: username,
                    email: email,
                    password: password,
                    confirmPassword: confirmPassword
                }
            });
            
            // Dispatch event
            document.dispatchEvent(registerEvent);
        });
    }

    // View methods for UI updates
    updateUIState(isLoading) {
        const submitButton = document.querySelector('#register-form button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = isLoading;
            submitButton.textContent = isLoading ? 'Registering...' : 'Register';
        }
    }

    handleRegisterSuccess() {
        // Show success message in a user-friendly way
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.textContent = 'Registration successful! Please login.';
        
        const form = document.getElementById('register-form');
        form.insertBefore(successDiv, form.firstChild);
        
        // Navigate to login page after 2 seconds with smooth transition
        setTimeout(() => {
            // Remove auth page styling immediately
            document.body.classList.remove('auth-page');
            
            // Show footer immediately
            const footer = document.querySelector('.footer');
            if (footer) {
                footer.classList.remove('hidden');
                footer.style.opacity = '1';
                footer.style.transform = 'translateY(0)';
            }
            
            // Navigate to login page immediately
            window.location.href = '#/login';
        }, 2000);
    }

    handleRegisterError(message) {
        // Show error in a more user-friendly way
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        const form = document.getElementById('register-form');
        const existingError = form.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }
        form.insertBefore(errorDiv, form.firstChild);
        
        // Auto-remove error after 3 seconds
        setTimeout(() => {
            errorDiv.remove();
        }, 3000);
    }
}
    