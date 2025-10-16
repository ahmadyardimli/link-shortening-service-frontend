// I grab the elements we use frequently so we don't keep querying the DOM
const ui = {
    // Auth
    loginButton: document.getElementById('authBtn'),
    logoutButton: document.getElementById('logoutBtn'),
    authModal: document.getElementById('authModal'),
    authModalClose: document.querySelector('.close'),

    loginView: document.getElementById('loginForm'),
    registerView: document.getElementById('registerForm'),
    showRegisterLink: document.getElementById('showRegister'),
    showLoginLink: document.getElementById('showLogin'),

    loginForm: document.getElementById('loginFormElement'),
    registerForm: document.getElementById('registerFormElement'),
    authError: document.getElementById('authError'),
    authErrorMessage: document.getElementById('authErrorMessage'),

    // Shorten form
    shortenForm: document.getElementById('shortenForm'),
    inputLongUrl: document.getElementById('longUrl'),
    inputCustomAlias: document.getElementById('customAlias'),
    inputExpirationDays: document.getElementById('expirationDays'),
    checkboxReuseExisting: document.getElementById('reuseExisting'),

    toggleAdvancedButton: document.getElementById('toggleAdvanced'),
    advancedOptionsPanel: document.getElementById('advancedOptions'),

    // Result
    resultSection: document.getElementById('resultSection'),
    shortUrlInput: document.getElementById('shortUrlInput'),
    copyShortUrlButton: document.getElementById('copyBtn'),
    openShortUrlButton: document.getElementById('openBtn'), // added in HTML below
    errorSection: document.getElementById('errorSection'),
    errorMessage: document.getElementById('errorMessage'),

    // Stats overview (needs auth)
    statsSection: document.getElementById('statsSection'),
    totalUrlsValue: document.getElementById('totalUrls'),
    totalClicksValue: document.getElementById('totalClicks'),
    urlsList: document.getElementById('urlsList'),

    // Single stats
    statsForm: document.getElementById('statsForm'),
    inputShortCode: document.getElementById('shortCode'),
    singleStatsResult: document.getElementById('singleStatsResult'),
};

let lastCreatedShortCode = null;

document.addEventListener('DOMContentLoaded', () => {
    _renderAuthState();
    _wireEvents();

    // This is for loading stats immediately for signed-in users
    if (authManager.isAuthenticated()) {
        loadMyStats();
    }
});

// It takes action in case of session-expired coming from api.js refresh failure
window.addEventListener('auth:sessionExpired', (e) => {
    // We have to ensure state is cleared (api.js already logged out, but good to be a bit more defensive)
    authManager.logout();
    _renderAuthState();

    // We clear stats UI.
    ui.urlsList.innerHTML = '';
    ui.totalUrlsValue.textContent = '0';
    ui.totalClicksValue.textContent = '0';

    // Tell the user why they were logged out
    _toast('Your session has expired. Please log in again.');
});

// Auth UI
function _renderAuthState() {
    const signedIn = authManager.isAuthenticated();
    ui.loginButton.style.display = signedIn ? 'none' : 'inline-block';
    ui.logoutButton.style.display = signedIn ? 'inline-block' : 'none';
    ui.statsSection.style.display = signedIn ? 'block' : 'none';
}

function _wireEvents() {
    // Auth modal open/close
    ui.loginButton.addEventListener('click', (e) => {
        e.preventDefault();
        ui.authModal.style.display = 'block';
        _showLogin();
    });
    ui.authModalClose.addEventListener('click', () => (ui.authModal.style.display = 'none'));
    window.addEventListener('click', (e) => {
        if (e.target === ui.authModal) ui.authModal.style.display = 'none';
    });

    // Switch forms
    ui.showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        _showRegister();
    });
    ui.showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        _showLogin();
    });

    // Submit login/register
    ui.loginForm.addEventListener('submit', onLoginSubmit);
    ui.registerForm.addEventListener('submit', onRegisterSubmit);

    // Shorten actions
    ui.shortenForm.addEventListener('submit', onShortenSubmit);
    ui.copyShortUrlButton.addEventListener('click', copyShortUrlToClipboard);
    ui.openShortUrlButton?.addEventListener('click', openLatestShortUrl);

    // Advanced toggle
    ui.toggleAdvancedButton.addEventListener('click', () => {
        const visible = ui.advancedOptionsPanel.style.display !== 'none';
        ui.advancedOptionsPanel.style.display = visible ? 'none' : 'block';
        ui.toggleAdvancedButton.textContent = visible ? '⚙️ Advanced Options' : '⚙️ Hide Options';
    });

    // Single stats form
    ui.statsForm.addEventListener('submit', onGetStatsSubmit);
}

function _showLogin() {
    ui.loginView.style.display = 'block';
    ui.registerView.style.display = 'none';
    ui.authError.style.display = 'none';
}

function _showRegister() {
    ui.loginView.style.display = 'none';
    ui.registerView.style.display = 'block';
    ui.authError.style.display = 'none';
}

// Auth handlers
async function onLoginSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        return _showAuthError('Please enter both email and password.');
    }

    const result = await authManager.login(email, password);
    if (!result.success) {
        return _showAuthError(result.error);
    }

    ui.authModal.style.display = 'none';
    _renderAuthState();
    setTimeout(loadMyStats, 50);
    _toast('Successfully logged in!');
}

async function onRegisterSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;

    if (!email || !password) {
        return _showAuthError('Please enter both email and password.');
    }
    if (password.length < 6) {
        return _showAuthError('Password must be at least 6 characters long.');
    }

    const result = await authManager.register(email, password);
    if (!result.success) {
        return _showAuthError(result.error);
    }

    ui.authModal.style.display = 'none';
    _renderAuthState();
    setTimeout(loadMyStats, 50);
    _toast('Successfully registered and logged in!');
}

function _showAuthError(msg) {
    ui.authErrorMessage.textContent = msg;
    ui.authError.style.display = 'block';
}

ui.logoutButton.addEventListener('click', (e) => {
    e.preventDefault();
    authManager.logout();
    _renderAuthState();
    ui.urlsList.innerHTML = '';
    ui.totalUrlsValue.textContent = '0';
    ui.totalClicksValue.textContent = '0';
    _toast('Successfully logged out!');
});

// Shorten logic
async function onShortenSubmit(e) {
    e.preventDefault();
    ui.resultSection.style.display = 'none';
    ui.errorSection.style.display = 'none';

    const longUrl = ui.inputLongUrl.value.trim();
    if (!longUrl) {
        return _showError('Please enter a URL');
    }

    const customAlias = ui.inputCustomAlias.value.trim() || null;
    const expirationDays = ui.inputExpirationDays.value
        ? parseInt(ui.inputExpirationDays.value, 10)
        : null;
    const reuseExisting = ui.checkboxReuseExisting.checked;

    try {
        const result = await api.shortenUrl(longUrl, customAlias, expirationDays, reuseExisting);

        // To make sure "Open" works reliably in dev
        lastCreatedShortCode = result.shortCode;

        // Show the pretty URL string the backend returns 
        // (and it could be branded domain in prod)
        ui.shortUrlInput.value = result.shortUrl || window.__buildOpenUrlFromCode(result.shortCode);
        ui.resultSection.style.display = 'block';

        // We reset form
        ui.shortenForm.reset();
        ui.checkboxReuseExisting.checked = true;
        ui.advancedOptionsPanel.style.display = 'none';
        ui.toggleAdvancedButton.textContent = '⚙️ Advanced Options';

        // reload stats for signed-in users
        if (authManager.isAuthenticated()) {
            setTimeout(loadMyStats, 150);
        }
    } catch (error) {
        _showError(error.message || 'Failed to shorten URL. Please try again.');
    }
}

function copyShortUrlToClipboard() {
    ui.shortUrlInput.select();
    ui.shortUrlInput.setSelectionRange(0, 99999);
    const ok = document.execCommand('copy');
    if (!ok && navigator.clipboard) {
        navigator.clipboard.writeText(ui.shortUrlInput.value).catch(() => {});
    }
    _toast('Link copied to clipboard!');
}

function openLatestShortUrl() {
    if (!lastCreatedShortCode) return;
    const openUrl = window.__buildOpenUrlFromCode(lastCreatedShortCode);
    window.open(openUrl, '_blank');
}

// My Stats (this one requires auth)
async function loadMyStats() {
    try {
        const stats = await api.getMyStats();
        _renderMyStats(stats);
    } catch (error) {
        // show a friendly error right inside the list area
        ui.urlsList.innerHTML = `
            <div style="text-align:center; padding: 2rem; color: var(--error-color);">
                <p>Failed to load statistics: ${_escapeHtml(error.message)}</p>
                <button onclick="loadMyStats()" class="btn btn-primary" style="margin-top:1rem;">Retry</button>
            </div>
        `;
    }
}

function _renderMyStats(stats) {
    ui.totalUrlsValue.textContent = stats.totalUrls || 0;
    ui.totalClicksValue.textContent = stats.totalClicks || 0;

    if (stats.urls && stats.urls.length) {
        ui.urlsList.innerHTML = stats.urls
            .map((u) => _renderUrlItem(u))
            .join('');
    } else {
        ui.urlsList.innerHTML =
            '<p style="text-align:center; color: var(--text-secondary); padding:2rem;">No URLs yet. Create your first short link above!</p>';
    }
}

function _renderUrlItem(item) {
    const createdDate = new Date(item.createdAt).toLocaleDateString();
    const expiresDate = item.expiresAt ? new Date(item.expiresAt).toLocaleDateString() : 'Never';
    return `
        <div class="url-item">
            <div class="url-item-header">
                <span class="url-short">${_escapeHtml(item.shortCode)}</span>
                <span class="url-clicks">👁️ ${item.clickCount} clicks</span>
            </div>
            <div class="url-original">${_escapeHtml(item.originalUrl)}</div>
            <div class="url-meta">
                <span>📅 Created: ${createdDate}</span>
                <span>⏰ Expires: ${expiresDate}</span>
                ${item.customAlias ? `<span>🏷️ Alias: ${_escapeHtml(item.customAlias)}</span>` : ''}
            </div>
        </div>
    `;
}

// single URL stats (public)
async function onGetStatsSubmit(e) {
    e.preventDefault();
    ui.singleStatsResult.style.display = 'none';
    ui.singleStatsResult.innerHTML = '';

    const shortCode = ui.inputShortCode.value.trim();
    const userId = authManager.isAuthenticated() ? authManager.getUserId() : null;

    if (!shortCode) {
        ui.singleStatsResult.innerHTML = `<div class="error-section"><p>Please enter a short code</p></div>`;
        ui.singleStatsResult.style.display = 'block';
        return;
    }

    try {
        const stats = await api.getUrlStats(shortCode, userId);
        const createdDate = new Date(stats.createdAt).toLocaleString();
        const expiresDate = stats.expiresAt ? new Date(stats.expiresAt).toLocaleString() : 'Never';
        const openUrl = window.__buildOpenUrlFromCode(stats.shortCode);

        ui.singleStatsResult.innerHTML = `
            <h4>📊 Statistics for: ${_escapeHtml(stats.shortCode)}</h4>
            <p><strong>Original URL:</strong> ${_escapeHtml(stats.originalUrl)}</p>
            <p><strong>Clicks:</strong> ${stats.clickCount}</p>
            <p><strong>Created:</strong> ${createdDate}</p>
            <p><strong>Expires:</strong> ${expiresDate}</p>
            ${stats.customAlias ? `<p><strong>Custom Alias:</strong> ${_escapeHtml(stats.customAlias)}</p>` : ''}
            <div style="margin-top:12px;">
                <button type="button" class="btn btn-secondary" onclick="window.open('${openUrl}','_blank')">Open</button>
                <button type="button" class="btn btn-secondary" onclick="navigator.clipboard.writeText('${openUrl}')">Copy</button>
            </div>
        `;
        ui.singleStatsResult.style.display = 'block';
    } catch (error) {
        ui.singleStatsResult.innerHTML = `
            <div class="error-section">
                <p>${_escapeHtml(error.message) || 'Failed to retrieve statistics.'}</p>
            </div>
        `;
        ui.singleStatsResult.style.display = 'block';
    }
}

// some UI helpers
function _showError(message) {
    ui.errorMessage.textContent = message;
    ui.errorSection.style.display = 'block';
    setTimeout(() => (ui.errorSection.style.display = 'none'), 5000);
}

function _toast(message) {
    const toastNotificationElement = document.createElement('div');
    toastNotificationElement.className = 'success-notification';
    toastNotificationElement.style.cssText = `
      position: fixed; top: 20px; right: 20px; background: #10b981; color: white;
      padding: 1rem 1.5rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,.1);
      z-index: 10000; animation: slideIn .3s ease-out; max-width: 320px;
    `;
    toastNotificationElement.textContent = message;
    document.body.appendChild(toastNotificationElement);
    setTimeout(() => {
        toastNotificationElement.style.animation = 'fadeOut .3s ease-out';
        setTimeout(() => toastNotificationElement.remove(), 300);
    }, 2500);
}

function _escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, (m) => map[m]);
}

console.log('app.js loaded successfully');
