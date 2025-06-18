import LoginPresenter from './login-presenter';

export default class LoginPage {
    constructor() {
        this.presenter = new LoginPresenter(this);
    }

    async render() {
        return `
          <section class="container">
            <div class="login-container">
                <h1>Login</h1>
                <form id="login-form">
                    <div class="input-form-group">
                        <label for="email">Email</label>
                        <input type="email" name="email" id="email" class="input-field" placeholder="john_doe@example.com" required>
                    </div>
                    <div class="input-form-group">
                        <label for="password">Password</label>
                        <input type="password" name="password" id="password" class="input-field" placeholder="********" required>
                    </div>
                    <button type="submit">Login</button>
                    <p>Don't have an account? <a href="#/register">Register</a></p>
                </form>
            </div>
          </section>
        `;
    }
    
    async afterRender() {
        const loginForm = document.getElementById('login-form');
        
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            
            // Get form values
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            // Emit event untuk Presenter
            const loginEvent = new CustomEvent('login', {
                detail: {
                    email: email,
                    password: password
                }
            });
            
            // Dispatch event
            document.dispatchEvent(loginEvent);
        });
    }

    // View methods for UI updates
    updateUIState(isLoading) {
        const submitButton = document.querySelector('#login-form button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = isLoading;
            submitButton.textContent = isLoading ? 'Logging in...' : 'Login';
        }
    }

    handleLoginSuccess() {
        window.location.href = '#/';
    }

    handleLoginError(message) {
        // Show error in a more user-friendly way
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        const form = document.getElementById('login-form');
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
    