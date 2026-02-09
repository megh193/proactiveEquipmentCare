document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const submitBtn = document.getElementById('submitBtn');
    const usernameVal = usernameInput.value.trim();
    const passwordVal = passwordInput.value.trim();

    // Validations
    let isValid = true;
    const userError = document.getElementById('usernameError');
    usernameInput.classList.remove('input-error');
    userError.classList.remove('visible');

    if (usernameVal === '') {
        showError(usernameInput, userError, 'Username is required');
        isValid = false;
    } else if (usernameVal.length < 3) {
        showError(usernameInput, userError, 'Username must be at least 3 characters');
        isValid = false;
    }

    const passError = document.getElementById('passwordError');
    passwordInput.classList.remove('input-error');
    passError.classList.remove('visible');

    if (passwordVal === '') {
        showError(passwordInput, passError, 'Password is required');
        isValid = false;
    }

    if (isValid) {
        // Determine mock role based on username for demo
        // admin -> admin role
        // analyst -> analyst role
        // other -> viewer role
        let role = 'viewer';
        if (usernameVal.toLowerCase().includes('admin')) role = 'admin';
        else if (usernameVal.toLowerCase().includes('analyst')) role = 'analyst';

        submitBtn.disabled = true;
        submitBtn.querySelector('.button__text').innerText = 'Authenticating...';

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: usernameVal,
                    role: role
                })
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('token', data.token);
                localStorage.setItem('role', role);

                // Access the protected dashboard
                loadDashboard(data.token, role);
            } else {
                showError(usernameInput, userError, 'Authentication failed');
                submitBtn.disabled = false;
                submitBtn.querySelector('.button__text').innerText = 'Login';
            }
        } catch (error) {
            console.error('Login Error:', error);
            showError(usernameInput, userError, 'Network error');
            submitBtn.disabled = false;
            submitBtn.querySelector('.button__text').innerText = 'Login';
        }
    }
});

async function loadDashboard(token, role) {
    // Simple redirection to the new dashboard page
    window.location.href = 'dashboard.html';
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    location.reload();
}

function showError(inputElement, errorElement, message) {
    inputElement.classList.add('input-error');
    errorElement.innerText = message;
    errorElement.classList.add('visible');
}

document.querySelectorAll('.login__input').forEach(input => {
    input.addEventListener('input', function() {
        this.classList.remove('input-error');
        const errorSpan = this.parentElement.querySelector('.error-message');
        if (errorSpan) errorSpan.classList.remove('visible');
    });
});