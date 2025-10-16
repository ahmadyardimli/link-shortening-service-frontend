// API base URL for Spring Boot backend (dev)
const API_BASE_URL = 'http://localhost:8080';


// this is the helper I added so anywhere in the app, it can be possible to build open url
// in prodoction, of course real doamain.
function buildOpenUrlFromCode(shortCode) {
    return `${API_BASE_URL}/${encodeURIComponent(shortCode)}`;
}

// make it globally available for app.js
window.__buildOpenUrlFromCode = buildOpenUrlFromCode;

// API Client with auto refresh once logic
class ApiClient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this._refreshInFlight = null;
        console.log('API Client initialized with base URL:', baseUrl);
    }

    _getAuthHeader() {
        // we store the value exactly as returned by backend: "Bearer <jwt>"
        const storedAccessToken = localStorage.getItem('accessToken');
        return storedAccessToken ? { Authorization: storedAccessToken } : {};
    }

    // this is my core request helper. It send JSON, and on 401/403 tries a single refresh/retry.
    async request(endpoint, options = {}, attempt = 0) {
        const absoluteUrl = `${this.baseUrl}${endpoint}`;
        const mergedConfig = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...this._getAuthHeader(),
                ...(options.headers || {}),
            },
        };

        try {
            const response = await fetch(absoluteUrl, mergedConfig);

            // extra safety. handle 204 or 302 quickly (some browsers won't give a body)
            if (response.status === 204 || response.status === 302) {
                return { success: true };
            }

            // parse payload if present
            const contentType = response.headers.get('content-type') || '';
            const payload = contentType.includes('application/json')
                ? await response.json()
                : (await response.text()) || {};

            // auto-refresh once on 401/403 Unauthorized or Forbidden
            if ((response.status === 401 || response.status === 403) && attempt === 0) {
                const refreshed = await this._tryRefreshTokensOnce();
                if (refreshed) {
                    // re-run same call with the new Authorization header
                    return this.request(endpoint, options, attempt + 1);
                }
            }

            if (!response.ok) {
                // If message from server prefer that one
                const message =
                    (payload && (payload.message || payload.error)) ||
                    `${response.status} ${response.statusText}`;
                throw new Error(message);
            }

            return payload;
        } catch (err) {
            if (err.message === 'Failed to fetch') {
                throw new Error(
                    `Cannot connect to server at ${this.baseUrl}. Make sure the backend is running.`
                );
            }
            throw err;
        }
    }

    async _tryRefreshTokensOnce() {
        // Avoid multiple refresh attempts when several requests fail (401/403) at the same time
        if (!this._refreshInFlight) {
            this._refreshInFlight = this._refreshTokens();
        }
        try {
            const success = await this._refreshInFlight;
            return success;
        } finally {
            this._refreshInFlight = null;
        }
    }

    async _refreshTokens() {
        const storedRefreshToken = localStorage.getItem('refreshToken');
        if (!storedRefreshToken) return false;

        try {
            const res = await fetch(`${this.baseUrl}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: storedRefreshToken }),
            });

            if (!res.ok) {
                // If refresh fails, clear auth and broadcast session-expired
                window.authManager?.logout();
                window.dispatchEvent(new CustomEvent('auth:sessionExpired', {
                    detail: { reason: 'refresh_failed', status: res.status }
                }));
                return false;
            }

            const data = await res.json();
            // this will be something like { accessToken: "Bearer ...", refreshToken: "...", userId: 123 }
            window.authManager?.setTokens(
                data.accessToken,
                data.refreshToken,
                data.userId
            );
            return true;
        } catch {
            // network or other unexpected failure -> treat as expired session
            window.authManager?.logout();
            window.dispatchEvent(new CustomEvent('auth:sessionExpired', {
                detail: { reason: 'refresh_exception' }
            }));
            return false;
        }
    }

    // My Auth endpoints
    async register(email, password) {
        return this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
    }

    async login(email, password) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
    }

    async refresh(refreshToken) {
        return this.request('/auth/refresh', {
            method: 'POST',
            body: JSON.stringify({ refreshToken }),
        });
    }

    // my url endpoints
    async shortenUrl(longUrl, customAlias = null, expirationDays = null, reuseExisting = true) {
        const requestBody = {
            url: longUrl,
            customAlias: customAlias || null,
            expirationDays: expirationDays || null,
            reuseExisting,
        };
        return this.request('/shorten', {
            method: 'POST',
            body: JSON.stringify(requestBody),
        });
    }

    // my statistics endpoints
    async getUrlStats(shortCode, userId = null) {
        const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
        return this.request(`/stats/${encodeURIComponent(shortCode)}${query}`, { method: 'GET' });
    }

    async getMyStats() {
        return this.request('/users/me/stats', { method: 'GET' });
    }

    async getUserStats(userId) {
        return this.request(`/users/${encodeURIComponent(userId)}/stats`, { method: 'GET' });
    }
}

// I created one global API instance
const api = new ApiClient(API_BASE_URL);
window.api = api;
console.log('api.js loaded successfully');
