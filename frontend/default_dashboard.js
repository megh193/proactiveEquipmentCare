
// Logout Popup Functions
function showLogoutPopup() {
    const overlay = document.getElementById('logout-overlay');
    if (overlay) overlay.classList.add('show');
}

function hideLogoutPopup() {
    const overlay = document.getElementById('logout-overlay');
    if (overlay) overlay.classList.remove('show');
}

function performLogout() {
    localStorage.removeItem('user_email');
    localStorage.removeItem('role');
    window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('logout-overlay');
    if (overlay) {
        overlay.addEventListener('click', function (event) {
            if (event.target === this) hideLogoutPopup();
        });
    }

    const navProfileImg = document.getElementById('nav-profile-img');
    if (navProfileImg) {
        const savedImage = localStorage.getItem('profileImage');
        if (savedImage) navProfileImg.src = savedImage;
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

function handleFiles(files) {
    const fileName = files[0].name;
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
}
