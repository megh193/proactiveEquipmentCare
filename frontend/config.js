const CONFIG = {
    API_BASE_URL: 'http://13.126.238.21'
        // API_BASE_URL: 'http://127.0.0.1:5000'
};

// Intercept fetch to add JWT token globally
const originalFetch = window.fetch;
window.fetch = async function () {
    let [resource, config] = arguments;
    
    if (typeof resource === 'string' && resource.startsWith(CONFIG.API_BASE_URL)) {
        const token = localStorage.getItem('auth_token');
        if (token) {
            config = config || {};
            
            // Check if headers are Headers object or plain object
            if (config.headers instanceof Headers) {
                config.headers.append('Authorization', `Bearer ${token}`);
            } else {
                config.headers = config.headers || {};
                config.headers['Authorization'] = `Bearer ${token}`;
            }
        }
    }
    
    const response = await originalFetch(resource, config);
    
    // Auto-logout on 401 Unauthorized
    if (response.status === 401 && !resource.includes('/login') && !resource.includes('/verify-otp') && !resource.includes('/api/signup')) {
        // Read response body to detect session hijacking reason
        let securityAlert = null;
        try {
            const cloned = response.clone();
            const errData = await cloned.json();
            if (errData && errData.reason === 'session_hijack') {
                securityAlert = '⚠️ Security Alert: Your session was accessed from a different device or location. You have been logged out for your protection.';
            } else if (errData && errData.reason === 'token_revoked') {
                securityAlert = 'Your session has been terminated (logged out from another tab or device). Please log in again.';
            }
        } catch (e) { /* ignore parse errors */ }

        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_email');
        localStorage.removeItem('role');
        sessionStorage.clear();

        // Re-set alert AFTER sessionStorage.clear() so it survives the redirect
        if (securityAlert) {
            sessionStorage.setItem('security_alert', securityAlert);
        }
        window.location.replace('login.html');
    }
    
    return response;
};