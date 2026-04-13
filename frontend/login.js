document.getElementById('loginForm').addEventListener('submit', async function (e) {
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
    } else if (!validateEmail(emailVal)) {
        showError(emailInput, emailError, 'Please enter a valid email address');
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
        submitBtn.disabled = true;
        submitBtn.querySelector('.button__text').innerText = 'Authenticating...';

        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: emailVal,
                    password: passwordVal
                })
            });

            const data = await response.json();

            if (response.ok) {
                if (data.step === 'otp_sent') {
                    // Show OTP Modal
                    document.getElementById('otpModal').style.display = 'flex';
                    submitBtn.disabled = false;
                    submitBtn.querySelector('.button__text').innerText = 'Login';
                } else {
                    // Fallback if backend doesn't require OTP (should not happen based on current logic)
                    loginSuccess(emailVal);
                }
            } else {
                if (data.message) {
                    showErrorPopup(data.message);
                } else {
                    showErrorPopup('Authentication failed');
                }
                submitBtn.disabled = false;
                submitBtn.querySelector('.button__text').innerText = 'Login';
            }
        } catch (error) {
            console.error('Login Error:', error);
            showErrorPopup('Network error');
            submitBtn.disabled = false;
            submitBtn.querySelector('.button__text').innerText = 'Login';
        }
    }
});

// OTP Verification Logic
document.getElementById('verifyOtpBtn').addEventListener('click', async function () {
    const otpInput = document.getElementById('otpInput');
    const otp = otpInput.value.trim();
    const email = document.getElementById('email').value.trim();
    const otpError = document.getElementById('otpError');
    const verifyBtn = document.getElementById('verifyOtpBtn');
    const originalBtnText = verifyBtn.innerHTML;

    if (otp.length !== 6) {
        otpError.innerText = "Please enter a 6-digit OTP";
        otpError.classList.add('visible');
        return;
    }

    verifyBtn.disabled = true;
    verifyBtn.innerText = "Verifying...";

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, otp: otp })
        });

        const data = await response.json();

        if (response.ok) {
            loginSuccess(data.email || email, data.role);
        } else {
            // Updated to show Popup
            showErrorPopup(data.message || "Incorrect OTP");
            verifyBtn.disabled = false;
            verifyBtn.innerHTML = originalBtnText;
        }
    } catch (error) {
        // Updated to show Popup
        showErrorPopup("Network Error. Please try again.");
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = originalBtnText;
    }
});

function loginSuccess(emailVal, roleVal) {
    // Default to admin if role wasn't explicitly returned
    let role = roleVal || 'admin';

    localStorage.setItem('user_email', emailVal);
    localStorage.setItem('role', role);

    loadDashboard(role);
}

// Close modal logic
document.getElementById('closeOtpModal').addEventListener('click', function () {
    document.getElementById('otpModal').style.display = 'none';
});

// Clear OTP error on input
document.getElementById('otpInput').addEventListener('input', function () {
    document.getElementById('otpError').classList.remove('visible');
});

async function loadDashboard(role) {
    if (role === 'super_admin') {
        window.location.href = 'super_admin_dashboard.html';
    } else {
        window.location.href = 'admin_dashboard.html';
    }
}

async function logout() {
    const email = localStorage.getItem('user_email');
    if (email) {
        try {
            await fetch(`${CONFIG.API_BASE_URL}/api/logout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email })
            });
        } catch (error) {
            console.error('Logout API error:', error);
        }
    }
    localStorage.removeItem('user_email');
    localStorage.removeItem('role');
    location.reload();
}

window.addEventListener('beforeunload', function (e) {
    const email = localStorage.getItem('user_email');
    if (email) {
        navigator.sendBeacon(`${CONFIG.API_BASE_URL}/api/logout`, JSON.stringify({ email: email }));
    }
});

function showError(inputElement, errorElement, message) {
    inputElement.classList.add('input-error');
    errorElement.innerText = message;
    errorElement.classList.add('visible');
}

document.querySelectorAll('.login__input').forEach(input => {
    input.addEventListener('input', function () {
        this.classList.remove('input-error');
        const errorSpan = this.parentElement.querySelector('.error-message');
        if (errorSpan) errorSpan.classList.remove('visible');
    });
});

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
}

// Error Popup Logic
function showErrorPopup(message) {
    const errorModal = document.getElementById('errorModal');
    const errorMessageText = document.getElementById('errorMessageText');
    errorMessageText.innerText = message;
    errorModal.style.display = 'flex';
}

// Close Error Modal
document.getElementById('closeErrorModal').addEventListener('click', function () {
    document.getElementById('errorModal').style.display = 'none';
});

document.getElementById('closeErrorBtn').addEventListener('click', function () {
    document.getElementById('errorModal').style.display = 'none';
});

// Close modal when clicking outside
window.addEventListener('click', function (event) {
    const errorModal = document.getElementById('errorModal');
    if (event.target == errorModal) {
        errorModal.style.display = 'none';
    }
});