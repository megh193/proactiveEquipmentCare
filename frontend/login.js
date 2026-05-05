let currentMode = 'signin'; // 'signin' | 'signup'

// ── Tab switching ──────────────────────────────────────────
document.getElementById('signinTab').addEventListener('click', () => switchTab('signin'));
document.getElementById('signupTab').addEventListener('click', () => switchTab('signup'));

function switchTab(mode) {
    currentMode = mode;
    const isSignup = mode === 'signup';
    document.getElementById('signinTab').classList.toggle('active', !isSignup);
    document.getElementById('signupTab').classList.toggle('active', isSignup);
    document.getElementById('signinHeader').style.display  = isSignup ? 'none' : '';
    document.getElementById('signupHeader').style.display  = isSignup ? '' : 'none';
    document.getElementById('loginForm').style.display     = isSignup ? 'none' : '';
    document.getElementById('signupForm').style.display    = isSignup ? '' : 'none';
}

// ── Sign-up form ───────────────────────────────────────────
document.getElementById('signupForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const nameEl    = document.getElementById('signupName');
    const emailEl   = document.getElementById('signupEmail');
    const passEl    = document.getElementById('signupPassword');
    const confirmEl = document.getElementById('signupConfirm');
    const nameVal    = nameEl.value.trim();
    const emailVal   = emailEl.value.trim();
    const passVal    = passEl.value;
    const confirmVal = confirmEl.value;
    const signupBtn  = document.getElementById('signupBtn');

    let isValid = true;

    [nameEl, emailEl, passEl, confirmEl].forEach(el => el.classList.remove('input-error'));
    ['signupNameError','signupEmailError','signupPasswordError','signupConfirmError']
        .forEach(id => document.getElementById(id).classList.remove('visible'));

    if (!nameVal) {
        showError(nameEl, document.getElementById('signupNameError'), 'Name is required');
        isValid = false;
    }
    if (!emailVal) {
        showError(emailEl, document.getElementById('signupEmailError'), 'Email is required');
        isValid = false;
    } else if (!validateEmail(emailVal)) {
        showError(emailEl, document.getElementById('signupEmailError'), 'Please enter a valid email address');
        isValid = false;
    }
    if (!passVal) {
        showError(passEl, document.getElementById('signupPasswordError'), 'Password is required');
        isValid = false;
    } else if (passVal.length < 8) {
        showError(passEl, document.getElementById('signupPasswordError'), 'Password must be at least 8 characters');
        isValid = false;
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}/.test(passVal)) {
        showError(passEl, document.getElementById('signupPasswordError'), 'Password must contain uppercase, lowercase, number, and symbol');
        isValid = false;
    }
    if (!confirmVal) {
        showError(confirmEl, document.getElementById('signupConfirmError'), 'Please confirm your password');
        isValid = false;
    } else if (passVal !== confirmVal) {
        showError(confirmEl, document.getElementById('signupConfirmError'), 'Passwords do not match');
        isValid = false;
    }

    if (!isValid) return;

    signupBtn.disabled = true;
    signupBtn.querySelector('.button__text').innerText = 'Creating Account...';
    document.getElementById('signupSpinner').style.display = 'inline-flex';
    document.getElementById('signupBtnIcon').style.display  = 'none';

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: nameVal, email: emailVal, password: passVal })
        });
        const data = await response.json();

        if (response.ok) {
            showSuccessPopup('Your account has been created successfully. Please sign in.');
        } else {
            showErrorPopup(data.message || 'Sign up failed. Please try again.');
        }
    } catch (err) {
        showErrorPopup('Network error. Please try again.');
    } finally {
        signupBtn.disabled = false;
        signupBtn.querySelector('.button__text').innerText = 'Create Account';
        document.getElementById('signupSpinner').style.display = 'none';
        document.getElementById('signupBtnIcon').style.display  = '';
    }
});

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
        const email = document.getElementById('email').value.trim();
        const response = await fetch(`${CONFIG.API_BASE_URL}/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, otp: otp })
        });
        const data = await response.json();
        if (response.ok) {
            loginSuccess(data.email || email, data.role, data.token);
        } else {
            showErrorPopup(data.message || "Incorrect OTP");
            verifyBtn.disabled = false;
            verifyBtn.innerHTML = originalBtnText;
        }
    } catch (error) {
        showErrorPopup("Network Error. Please try again.");
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = originalBtnText;
    }
});

function loginSuccess(emailVal, roleVal, tokenVal) {
    // Default to admin if role wasn't explicitly returned
    let role = roleVal || 'admin';

    localStorage.setItem('user_email', emailVal);
    localStorage.setItem('role', role);
    if (tokenVal) localStorage.setItem('auth_token', tokenVal);

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
    const successModal = document.getElementById('successModal');
    if (event.target == successModal) {
        successModal.style.display = 'none';
        switchTab('signin');
    }
});

// Success popup
function showSuccessPopup(message) {
    document.getElementById('successMessageText').innerText = message;
    document.getElementById('successModal').style.display = 'flex';
}

document.getElementById('closeSuccessBtn').addEventListener('click', function () {
    document.getElementById('successModal').style.display = 'none';
    switchTab('signin');
});