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
        const isDark = localStorage.getItem('darkMode');
        localStorage.clear();
        sessionStorage.clear();
        if (isDark) localStorage.setItem('darkMode', isDark);
        window.location.replace('login.html');
    }
    
    return response;
};