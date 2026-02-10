document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const submitBtn = document.getElementById('submitBtn');
    const emailVal = emailInput.value.trim();
    const passwordVal = passwordInput.value.trim();

    // Validations
    let isValid = true;
    const emailError = document.getElementById('emailError');
    emailInput.classList.remove('input-error');
    emailError.classList.remove('visible');

    if (emailVal === '') {
        showError(emailInput, emailError, 'Email is required');
        isValid = false;
    } else if (emailVal.length < 3) {
        showError(emailInput, emailError, 'Email must be at least 3 characters');
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
        // Determine mock role based on email for demo
        // admin -> admin role
        // analyst -> analyst role
        // other -> viewer role
        let role = 'viewer';
        if (emailVal.toLowerCase().includes('admin')) role = 'admin';
        else if (emailVal.toLowerCase().includes('analyst')) role = 'analyst';

        submitBtn.disabled = true;
        submitBtn.querySelector('.button__text').innerText = 'Authenticating...';

        try {
            const response = await fetch('http://127.0.0.1:5000/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: emailVal,
                    password: passwordVal
                })
            });

            if (response.ok) {
                const data = await response.json();
                // Store minimal info or token if provided by backend (backend returns success message)
                localStorage.setItem('user_email', emailVal);
                localStorage.setItem('role', role);

                // Access the protected dashboard
                loadDashboard(role);
            } else {
                alert('Authentication failed');
                submitBtn.disabled = false;
                submitBtn.querySelector('.button__text').innerText = 'Login';
            }
        } catch (error) {
            console.error('Login Error:', error);
            alert('Network error');
            submitBtn.disabled = false;
            submitBtn.querySelector('.button__text').innerText = 'Login';
        }
    }
});

async function loadDashboard(role) {
    // Simple redirection to the new dashboard page
    window.location.href = 'dashboard.html';
}

function logout() {
    localStorage.removeItem('user_email');
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