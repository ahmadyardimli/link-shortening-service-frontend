// This is my Authentication Manager with tiny, explicit API.
class AuthManager {
    constructor() {
        this.accessToken = localStorage.getItem('accessToken');
        this.refreshToken = localStorage.getItem('refreshToken');
        this.userId = localStorage.getItem('userId');
        console.log('AuthManager initialized. Authenticated:', this.isAuthenticated());
    }

    isAuthenticated() {
        return Boolean(this.accessToken && this.userId);
    }

    async login(email, password) {
        try {
            const response = await api.login(email, password);

            // it expect: { accessToken: "Bearer ...", refreshToken: "...", userId: number }
            if (!response?.accessToken || !response?.refreshToken || !response?.userId) {
                throw new Error('Invalid response from server');
            }

            this.setTokens(response.accessToken, response.refreshToken, response.userId);
            return { success: true };

        } catch (error) {
            return {
                success: false,
                error: error.message || 'Login failed. Please check your credentials.',
            };
        }
    }

    async register(email, password) {
        try {
            const response = await api.register(email, password);
            
            if (!response?.accessToken || !response?.refreshToken || !response?.userId) {
                throw new Error('Invalid response from server');
            }

            this.setTokens(response.accessToken, response.refreshToken, response.userId);
            return { success: true };
        } catch (error) {
            let friendly = 'Registration failed. Please try again.';
            if (error.message?.toLowerCase().includes('already')) {
                friendly = 'Email already in use. Please login or use a different email.';
            }
            return { success: false, error: friendly };
        }
    }

    setTokens(accessToken, refreshToken, userId) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.userId = String(userId);

        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('userId', String(userId));
    }

    logout() {
        this.accessToken = null;
        this.refreshToken = null;
        this.userId = null;
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userId');
    }

    getUserId() {
        return this.userId;
    }

    getAccessToken() {
        return this.accessToken;
    }
}

// Make it globally accessible for api.js retry logic
const authManager = new AuthManager();
window.authManager = authManager;
console.log('auth.js loaded successfully');
