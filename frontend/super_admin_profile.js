document.addEventListener('DOMContentLoaded', () => {
    // ── Load saved profile photo from localStorage immediately ──
    const savedAvatar = localStorage.getItem('profileImage');
    if (savedAvatar) {
        const mainImg = document.getElementById('main-profile-img');
        if (mainImg) mainImg.src = savedAvatar;
    }

    const userEmail = localStorage.getItem('user_email');

    if (userEmail) {
        fetch(`http://127.0.0.1:5000/api/profile?email=${encodeURIComponent(userEmail)}`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    if (data.name) {
                        const nameEl = document.getElementById('user-name');
                        if (nameEl) nameEl.textContent = data.name;
                    }
                    if (data.email) {
                        const emailEl = document.getElementById('user-email');
                        if (emailEl) emailEl.textContent = data.email;
                    }
                    // Update IP and Time
                    if (data.last_login) {
                        const ipEl = document.getElementById('user-ip');
                        if (ipEl) ipEl.textContent = data.last_login.ip_address || 'Unavailable';

                        let dateStr = data.last_login.created_at;
                        if (!dateStr.endsWith('Z') && !dateStr.includes('+')) {
                            dateStr += 'Z';
                        }
                        const dateObj = new Date(dateStr);
                        const formattedTime = dateObj.toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                        });
                        const loginEl = document.getElementById('last-login');
                        if (loginEl) loginEl.textContent = formattedTime;
                    } else {
                        const ipEl = document.getElementById('user-ip');
                        const loginEl = document.getElementById('last-login');
                        if (ipEl) ipEl.textContent = 'Unavailable';
                        if (loginEl) loginEl.textContent = 'No records found';
                    }

                    // Update Avatar if backend has one – also sync to localStorage
                    if (data.avatar) {
                        const mainProfileImg = document.getElementById('main-profile-img');
                        if (mainProfileImg) mainProfileImg.src = data.avatar;
                        // Sync to localStorage so all other pages (dashboard, analyse) update
                        localStorage.setItem('profileImage', data.avatar);
                    }
                }
            })
            .catch(err => {
                console.error('Error fetching profile data:', err);
                const ipEl = document.getElementById('user-ip');
                const loginEl = document.getElementById('last-login');
                if (ipEl) ipEl.textContent = 'Unavailable';
                if (loginEl) loginEl.textContent = 'Unavailable';
            });
    } else {
        const ipEl = document.getElementById('user-ip');
        const loginEl = document.getElementById('last-login');
        if (ipEl) ipEl.textContent = 'No User Session';
        if (loginEl) loginEl.textContent = 'No User Session';
    }

    // ── Profile Image Upload Preview & Save ──
    const profileUpload = document.getElementById('profile-upload');
    const mainProfileImg = document.getElementById('main-profile-img');

    if (profileUpload) {
        profileUpload.addEventListener('change', function (event) {
            const file = event.target.files[0];
            const currentEmail = localStorage.getItem('user_email');
            if (file && currentEmail) {
                const reader = new FileReader();

                reader.onload = function (e) {
                    const base64Avatar = e.target.result;

                    // Update main profile image immediately
                    if (mainProfileImg) mainProfileImg.src = base64Avatar;

                    // Save to localStorage so ALL pages (dashboard, analyse) sync instantly
                    localStorage.setItem('profileImage', base64Avatar);

                    // Show confirmation toast
                    showProfileToast('Profile photo updated! Changes are reflected everywhere.');

                    // Save to Backend
                    fetch('http://127.0.0.1:5000/api/profile/avatar', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            email: currentEmail,
                            avatar: base64Avatar
                        })
                    })
                        .then(res => res.json())
                        .then(resData => {
                            if (!resData.success) {
                                console.error('Failed to save avatar:', resData.message);
                            }
                        })
                        .catch(err => console.error('Error saving avatar:', err));
                };

                reader.readAsDataURL(file);
            }
        });
    }
});

// ── Simple toast notification ──
function showProfileToast(msg) {
    let t = document.getElementById('profile-toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'profile-toast';
        t.style.cssText = 'position:fixed;bottom:2rem;right:2rem;background:#1F2937;color:white;padding:1rem 1.5rem;border-radius:8px;font-weight:500;font-size:0.9rem;z-index:3000;box-shadow:0 10px 15px -3px rgba(0,0,0,0.2);opacity:1;transition:opacity 0.4s;';
        document.body.appendChild(t);
    }
    t.textContent = '\u2713 ' + msg;
    t.style.opacity = '1';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.style.opacity = '0'; }, 3500);
}

// ── Change Password Modal ──
function showChangePasswordModal() {
    document.getElementById('cp-step-1').style.display = 'block';
    document.getElementById('cp-step-2').style.display = 'none';
    document.getElementById('change-password-overlay').classList.add('show');
}

function hideChangePasswordModal() {
    document.getElementById('change-password-overlay').classList.remove('show');
}

function requestPasswordOtp() {
    const email = localStorage.getItem('user_email');
    if (!email) return alert('No user session found.');
    fetch('http://127.0.0.1:5000/api/change-password/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    })
    .then(r => r.json())
    .then(d => {
        if (d.success) {
            document.getElementById('cp-step-1').style.display = 'none';
            document.getElementById('cp-step-2').style.display = 'block';
        } else {
            alert(d.message || 'Failed to send OTP.');
        }
    })
    .catch(() => alert('Server error. Please try again.'));
}

function submitPasswordChange() {
    const email = localStorage.getItem('user_email');
    const otp = document.getElementById('cp-otp').value.trim();
    const newPw = document.getElementById('cp-new-password').value;
    const confirmPw = document.getElementById('cp-confirm-password').value;
    const errEl = document.getElementById('cp-error');
    errEl.textContent = '';

    if (!otp || !newPw || !confirmPw) { errEl.textContent = 'All fields are required.'; return; }
    if (newPw !== confirmPw) { errEl.textContent = 'Passwords do not match.'; return; }
    if (newPw.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; return; }

    fetch('http://127.0.0.1:5000/api/change-password/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, new_password: newPw })
    })
    .then(r => r.json())
    .then(d => {
        if (d.success) {
            hideChangePasswordModal();
            alert('Password updated successfully!');
        } else {
            errEl.textContent = d.message || 'Failed to update password.';
        }
    })
    .catch(() => { errEl.textContent = 'Server error. Please try again.'; });
}

document.getElementById('change-password-overlay').addEventListener('click', function(e) {
    if (e.target === this) hideChangePasswordModal();
});

// ── Logout ──
function showLogoutPopup() {
    const overlay = document.getElementById('logout-overlay');
    overlay.classList.add('show');
}

function hideLogoutPopup() {
    const overlay = document.getElementById('logout-overlay');
    overlay.classList.remove('show');
}

function performLogout() {
    localStorage.removeItem('user_email');
    localStorage.removeItem('role');
    window.location.href = 'login.html';
}

// Close popup if clicking outside the modal box
document.getElementById('logout-overlay').addEventListener('click', function (event) {
    if (event.target === this) {
        hideLogoutPopup();
    }
});
