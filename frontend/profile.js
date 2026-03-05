document.addEventListener('DOMContentLoaded', () => {
    const userEmail = localStorage.getItem('user_email');

    // Default fallback values
    document.getElementById('user-ip').textContent = 'Unavailable';
    const now = new Date();
    document.getElementById('last-login').textContent = now.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });

    if (userEmail) {
        // Fetch User Details from Backend
        fetch(`http://127.0.0.1:5000/user-details?email=${encodeURIComponent(userEmail)}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    document.getElementById('user-ip').textContent = data.ip_address || 'Unavailable';
                    if (data.last_login) {
                        let loginStr = data.last_login;
                        if (loginStr.endsWith('+00:00')) loginStr = loginStr.slice(0, -6);
                        else if (loginStr.endsWith('Z')) loginStr = loginStr.slice(0, -1);

                        const loginDate = new Date(loginStr);
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
                console.error('Error fetching user details:', err);
            });
    }

    // 3. Profile Image Upload Preview
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
                // Update both main profile image and navbar thumbnail
                const newImgData = e.target.result;
                mainProfileImg.src = newImgData;
                navProfileImg.src = newImgData;
                // Save to localStorage
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
                // Dropdown is handled by CSS hover, but this ensures clicking outside 
                // doesn't cause weird states on mobile if we ever add click-to-open.
            }
        }
    });
});

// Logout Popup Functions (Global scope to be called inline from HTML)

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