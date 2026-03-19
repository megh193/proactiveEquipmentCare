
// Logout Popup Functions
function showLogoutPopup() {
    const overlay = document.getElementById('logout-overlay');
    if (overlay) overlay.classList.add('show');
}

function hideLogoutPopup() {
    const overlay = document.getElementById('logout-overlay');
    if (overlay) overlay.classList.remove('show');
}

async function performLogout() {
    const email = localStorage.getItem('user_email');
    if (email) {
        try {
            await fetch('http://127.0.0.1:5000/api/logout', {
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
    window.location.href = 'login.html';
}

window.addEventListener('beforeunload', function (e) {
    const email = localStorage.getItem('user_email');
    if (email) {
        navigator.sendBeacon('http://127.0.0.1:5000/api/logout', JSON.stringify({ email: email }));
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const userEmail = localStorage.getItem('user_email');
    if (userEmail) {
        fetch(`http://127.0.0.1:5000/api/profile?email=${encodeURIComponent(userEmail)}`)
            .then(res => res.json())
            .then(data => {
                if (data.success && data.avatar) {
                    const navProfileImg = document.getElementById('nav-profile-img');
                    if (navProfileImg) navProfileImg.src = data.avatar;
                }
            })
            .catch(err => console.error('Error fetching profile avatar:', err));
    }

    const overlay = document.getElementById('logout-overlay');
    if (overlay) {
        overlay.addEventListener('click', function (event) {
            if (event.target === this) hideLogoutPopup();
        });
    }
});

const uploadBox = document.querySelector('.upload-box');
const fileInput = document.getElementById('csv-upload');

// Prevent default drag behaviors
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    uploadBox.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// Highlight drop area when item is dragged over it
['dragenter', 'dragover'].forEach(eventName => {
    uploadBox.addEventListener(eventName, () => {
        uploadBox.classList.add('dragover');
    }, false);
});

['dragleave', 'drop'].forEach(eventName => {
    uploadBox.addEventListener(eventName, () => {
        uploadBox.classList.remove('dragover');
    }, false);
});

// Handle dropped files
uploadBox.addEventListener('drop', (e) => {
    let dt = e.dataTransfer;
    let files = dt.files;
    if (files.length) {
        fileInput.files = files;
        handleFiles(files);
    }
});

// Handle selected files
fileInput.addEventListener('change', (e) => {
    if (fileInput.files.length) {
        handleFiles(fileInput.files);
    }
});

async function handleFiles(files) {
    const file = files[0];

    // Check extension here quickly
    if (!file.name.toLowerCase().endsWith('.csv')) {
        showErrorModal("Invalid file format. Only CSV files are allowed.");
        fileInput.value = ''; // Reset
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('http://127.0.0.1:5000/api/validate-csv', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // File is valid, proceed with updating UI
            const fileName = file.name;
            const subtitle = document.querySelector('.upload-box p');
            subtitle.innerHTML = `<span style="color: #10B981;"><i class="fa-solid fa-file-csv"></i> ${fileName}</span> ready for analysis.`;
            subtitle.style.fontWeight = '500';

            // Add a subtle bounce animation to the icon
            const icon = document.querySelector('.upload-icon');
            icon.style.color = '#10B981';
            icon.classList.remove('fa-cloud-arrow-up');
            icon.classList.add('fa-check-circle');

            // Change button text
            const btn = document.querySelector('.upload-btn');
            btn.textContent = 'Change File';
        } else {
            showErrorModal(data.message || "Invalid file format. Only CSV files are allowed.");
            fileInput.value = ''; // Reset
        }
    } catch (error) {
        console.error('Error validating file:', error);
        showErrorModal("Network error while validating the file.");
        fileInput.value = ''; // Reset
    }
}

// Error Modal Functions
function showErrorModal(message) {
    document.getElementById('errorMessageText').textContent = message;
    document.getElementById('errorModal').style.display = 'flex';
}

function hideErrorModal() {
    document.getElementById('errorModal').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    const errorModal = document.getElementById('errorModal');
    if (errorModal) {
        errorModal.addEventListener('click', function (event) {
            if (event.target === this) hideErrorModal();
        });
        document.getElementById('closeErrorModal').addEventListener('click', hideErrorModal);
        document.getElementById('closeErrorBtn').addEventListener('click', hideErrorModal);
    }
});

