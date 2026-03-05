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
                showErrorPopup(data.message || 'Authentication failed');
                submitBtn.disabled = false;
                submitBtn.querySelector('.button__text').innerText = 'Login';
            }
        } catch (error) {
            console.error('Login Error:', error);
            showErrorPopup('Network Error. Please try again.');
            submitBtn.disabled = false;
            submitBtn.querySelector('.button__text').innerText = 'Login';
        }
    }
});

// OTP Verification Logic
document.getElementById('verifyOtpBtn').addEventListener('click', async function() {
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
        const response = await fetch('http://127.0.0.1:5000/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, otp: otp })
        });

        const data = await response.json();

        if (response.ok) {
            loginSuccess(email);
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

function loginSuccess(emailVal) {
    // Determine mock role based on email for demo
    let role = 'viewer';
    if (emailVal.toLowerCase().includes('admin')) role = 'admin';
    else if (emailVal.toLowerCase().includes('analyst')) role = 'analyst';

    localStorage.setItem('user_email', emailVal);
    localStorage.setItem('role', role);

    loadDashboard(role);
}

// Close modal logic
document.getElementById('closeOtpModal').addEventListener('click', function() {
    document.getElementById('otpModal').style.display = 'none';
});

// Clear OTP error on input
document.getElementById('otpInput').addEventListener('input', function() {
    document.getElementById('otpError').classList.remove('visible');
});

async function loadDashboard(role) {
    window.location.href = 'default_dashboard.html';
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
document.getElementById('closeErrorModal').addEventListener('click', function() {
    document.getElementById('errorModal').style.display = 'none';
});

document.getElementById('closeErrorBtn').addEventListener('click', function() {
    document.getElementById('errorModal').style.display = 'none';
});

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const errorModal = document.getElementById('errorModal');
    if (event.target == errorModal) {
        errorModal.style.display = 'none';
    }
});