document.addEventListener('DOMContentLoaded', () => {
    // Load saved profile photo from localStorage immediately
    const savedAvatar = localStorage.getItem('profileImage');
    if (savedAvatar) {
        const navImg = document.getElementById('nav-profile-img');
        const mainImg = document.getElementById('main-profile-img');
        if (navImg) navImg.src = savedAvatar;
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
                    // Update IP and Time
                    if (data.last_login) {
                        document.getElementById('user-ip').textContent = data.last_login.ip_address || 'Unavailable';

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
                        document.getElementById('last-login').textContent = formattedTime;
                    } else {
                        document.getElementById('user-ip').textContent = 'Unavailable';
                        document.getElementById('last-login').textContent = 'No records found';
                    }

                    // Update Avatar if custom one exists
                    if (data.avatar) {
                        const mainProfileImg = document.getElementById('main-profile-img');
                        const navProfileImg = document.getElementById('nav-profile-img');
                        mainProfileImg.src = data.avatar;
                        navProfileImg.src = data.avatar;
                    }
                }
            })
            .catch(err => {
                console.error('Error fetching profile data:', err);
                document.getElementById('user-ip').textContent = 'Unavailable';
                document.getElementById('last-login').textContent = 'Unavailable';
            });
    } else {
        document.getElementById('user-ip').textContent = 'No User Session';
        document.getElementById('last-login').textContent = 'No User Session';
    }

    // 3. Profile Image Upload Preview & Save
    const profileUpload = document.getElementById('profile-upload');
    const mainProfileImg = document.getElementById('main-profile-img');
    const navProfileImg = document.getElementById('nav-profile-img');

    profileUpload.addEventListener('change', function (event) {
        const file = event.target.files[0];
        if (file && userEmail) {
            const reader = new FileReader();

            reader.onload = function (e) {
                const base64Avatar = e.target.result;

                // Update both main profile image and navbar thumbnail immediately
                mainProfileImg.src = base64Avatar;
                navProfileImg.src = base64Avatar;

                // Save to localStorage so dashboards and other pages sync instantly
                localStorage.setItem('profileImage', base64Avatar);

                // Save to Backend
                fetch('http://127.0.0.1:5000/api/profile/avatar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: userEmail,
                        avatar: base64Avatar
                    })
                })
                    .then(res => res.json())
                    .then(resData => {
                        if (!resData.success) {
                            console.error('Failed to save avatar:', resData.message);
                            alert("Failed to save avatar to server.");
                        }
                    })
                    .catch(err => console.error('Error saving avatar:', err));
            };

            reader.readAsDataURL(file);
        }
    });

    // Close dropdown when clicking outside
    window.addEventListener('click', function (e) {
        if (!e.target.matches('.profile-icon-btn') && !e.target.closest('.profile-icon-btn')) {
            const dropdown = document.querySelector('.dropdown-menu');
            if (dropdown && dropdown.style.opacity === '1') {
                // Dropdown is handled by CSS hover, but this ensures clicking outside 
                // doesn't cause weird states on mobile if we ever add click-to-open.
            }
        }
    });
});

// Logout Popup Functions (Global scope to be called inline from HTML)

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
