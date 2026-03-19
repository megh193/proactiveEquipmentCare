
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

// Role-Based Access Control and User Management
document.addEventListener('DOMContentLoaded', () => {
    // Check role, if not super admin, kick them out
    const role = localStorage.getItem('role');
    if (role !== 'super_admin') {
        window.location.href = 'admin_dashboard.html';
        return;
    }

    // Manage Users button is visible by default in HTML now, or we can just always show it
    const manageUsersBtn = document.querySelector('.manage-users-btn');
    if (manageUsersBtn) manageUsersBtn.style.display = 'inline-block';
});

function showUserManagement() {
    const overlay = document.getElementById('user-management-overlay');
    if (overlay) {
        overlay.classList.add('show');
        overlay.style.display = 'flex'; // Ensure it displays
        // Switch to Manage Admins tab by default
        switchUserTab('manage-admins');
        fetchUsers();
    }
}

function hideUserManagement() {
    const overlay = document.getElementById('user-management-overlay');
    if (overlay) {
        overlay.classList.remove('show');
        overlay.style.display = 'none';
        document.getElementById('user-management-msg').style.display = 'none';

        // Reset inputs
        const nameInput = document.getElementById('new-admin-name');
        if (nameInput) nameInput.value = '';
        const emailInput = document.getElementById('new-admin-email');
        if (emailInput) emailInput.value = '';
        const passInput = document.getElementById('new-admin-password');
        if (passInput) passInput.value = '';
    }
}

function switchUserTab(tabId) {
    // Update tab buttons
    document.querySelectorAll('.user-tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabId) {
            btn.classList.add('active');
        }
    });

    // Update tab content blocks
    document.querySelectorAll('.user-tab-content').forEach(content => {
        content.style.display = 'none';
        if (content.id === tabId + '-content') {
            content.style.display = 'block';
        }
    });
}

async function fetchUsers() {
    try {
        const response = await fetch('http://127.0.0.1:5000/api/users');
        const data = await response.json();

        if (response.ok && data.success) {
            const tbody = document.getElementById('users-table-body');
            tbody.innerHTML = '';

            data.users.forEach(user => {
                const tr = document.createElement('tr');

                // Format status
                const rawStatus = user.status || 'Active';
                const displayStatus = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();
                const statusColor = displayStatus === 'Active' ? '#10B981' : '#EF4444';
                
                tr.innerHTML = `
                    <td style="padding: 8px; border-bottom: 1px solid #ddd; word-break: break-word;">${user.name || 'N/A'}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd; word-break: break-all;">${user.email}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd;">
                        <span class="role-badge role-${user.role ? user.role.toLowerCase().replace(/\\s+/g, '-').replace('_', '-') : ''}">${user.role ? user.role.replace('_', ' ') : ''}</span>
                    </td>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd;">
                        <span style="color: ${statusColor}; font-weight: 600;">${displayStatus}</span>
                    </td>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">
                        <button onclick="deleteUser('${user.id}')" style="background: none; border: none; color: #d32f2f; cursor: pointer;" title="Delete User">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (error) {
        console.error('Error fetching users:', error);
    }
}

async function addNewAdmin() {
    const name = document.getElementById('new-admin-name').value.trim();
    const email = document.getElementById('new-admin-email').value.trim();
    const password = document.getElementById('new-admin-password').value.trim();
    const roleSelect = document.getElementById('new-admin-role');
    const role = roleSelect ? roleSelect.value : 'admin';
    const msgElement = document.getElementById('user-management-msg');

    if (!name || !email || !password || !role) {
        msgElement.textContent = "Name, email, password, and role are required.";
        msgElement.style.display = 'block';
        return;
    }

    try {
        const response = await fetch('http://127.0.0.1:5000/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, role })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            msgElement.style.color = '#10B981';
            msgElement.textContent = "Admin added successfully.";
            msgElement.style.display = 'block';
            document.getElementById('new-admin-name').value = '';
            document.getElementById('new-admin-email').value = '';
            document.getElementById('new-admin-password').value = '';
            fetchUsers(); // Refresh list
        } else {
            msgElement.style.color = '#d32f2f';
            msgElement.textContent = data.message || "Failed to add admin.";
            msgElement.style.display = 'block';
        }
    } catch (error) {
        console.error('Error adding user:', error);
        msgElement.style.color = '#d32f2f';
        msgElement.textContent = "Network error while adding user.";
        msgElement.style.display = 'block';
    }
}

let userToDeleteId = null;

function deleteUser(userId) {
    userToDeleteId = userId;
    const overlay = document.getElementById('delete-user-overlay');
    if (overlay) {
        overlay.classList.add('show');
    }
}

function hideDeletePopup() {
    userToDeleteId = null;
    const overlay = document.getElementById('delete-user-overlay');
    if (overlay) {
        overlay.classList.remove('show');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Other DOM listeners...
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', performUserDeletion);
    }
});

async function performUserDeletion() {
    if (!userToDeleteId) return;

    try {
        const response = await fetch(`http://127.0.0.1:5000/api/users/${userToDeleteId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (response.ok && data.success) {
            hideDeletePopup();
            fetchUsers(); // Refresh list
        } else {
            hideDeletePopup();
            showErrorModal(data.message || 'Failed to delete user.');
        }
    } catch (error) {
        hideDeletePopup();
        console.error('Error deleting user:', error);
        showErrorModal('Network error while deleting user.');
    }
}
