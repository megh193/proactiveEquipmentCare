document.addEventListener('DOMContentLoaded', () => {
    const userEmail = localStorage.getItem('user_email');

    // Default fallback values
    document.getElementById('user-ip').textContent = 'Loading...';
    const now = new Date();
    document.getElementById('last-login').textContent = now.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });

    // Show user email in profile if element exists
    const emailEl = document.getElementById('user-email-display');
    if (emailEl && userEmail) {
        emailEl.textContent = userEmail;
    }

    // Fetch name from /api/profile
    if (userEmail) {
        fetch(`http://127.0.0.1:5000/api/profile?email=${encodeURIComponent(userEmail)}`)
            .then(res => res.json())
            .then(data => {
                if (data.success && data.name) {
                    const nameEl = document.getElementById('user-name');
                    if (nameEl) nameEl.textContent = data.name;
                }
            })
            .catch(() => {});
    }

    if (userEmail) {
        // Fetch User Details from Backend (IP + last login time from Supabase logs)
        fetch(`http://127.0.0.1:5000/user-details?email=${encodeURIComponent(userEmail)}`)
            .then(response => response.json())
            .then(data => {
                if (data.success && data.ip_address) {
                    document.getElementById('user-ip').textContent = data.ip_address;
                } else {
                    // Fallback: fetch public IP from ipify
                    fetchPublicIP();
                }

                if (data.last_login) {
                    let loginStr = data.last_login;
                    if (loginStr.endsWith('+00:00')) loginStr = loginStr.slice(0, -6);
                    else if (loginStr.endsWith('Z')) loginStr = loginStr.slice(0, -1);

                    const loginDate = new Date(loginStr);
                    if (!isNaN(loginDate.getTime())) {
                        document.getElementById('last-login').textContent = loginDate.toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                        });
                    }
                }
            })
            .catch(err => {
                console.error('Error fetching user details from backend:', err);
                // Fallback to public IP if backend is unreachable
                fetchPublicIP();
            });
    } else {
        // No email in storage — still try to show public IP
        fetchPublicIP();
    }

    // Fetch public IP via ipify as a reliable fallback/primary source
    function fetchPublicIP() {
        fetch('https://api.ipify.org?format=json')
            .then(res => res.json())
            .then(ipData => {
                document.getElementById('user-ip').textContent = ipData.ip || 'Unavailable';
            })
            .catch(() => {
                document.getElementById('user-ip').textContent = 'Unavailable';
            });
    }

    // Profile Image Upload Preview
    const profileUpload = document.getElementById('profile-upload');
    const mainProfileImg = document.getElementById('main-profile-img');
    const navProfileImg = document.getElementById('nav-profile-img');

    // Load existing image from localStorage if available
    const savedImage = localStorage.getItem('profileImage');
    if (savedImage) {
        mainProfileImg.src = savedImage;
        navProfileImg.src = savedImage;
    }

    profileUpload.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();

            reader.onload = function(e) {
                const newImgData = e.target.result;
                mainProfileImg.src = newImgData;
                navProfileImg.src = newImgData;
                localStorage.setItem('profileImage', newImgData);
            };

            reader.readAsDataURL(file);
        }
    });

    // Close dropdown when clicking outside
    window.addEventListener('click', function(e) {
        if (!e.target.matches('.profile-icon-btn') && !e.target.closest('.profile-icon-btn')) {
            const dropdown = document.querySelector('.dropdown-menu');
            if (dropdown && dropdown.style.opacity === '1') {
                // Dropdown is handled by CSS hover
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
document.getElementById('logout-overlay').addEventListener('click', function(event) {
    if (event.target === this) {
        hideLogoutPopup();
    }
});