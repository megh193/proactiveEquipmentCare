/* =========================================================
   Manage Users Dashboard – manage_users.js
   Handles: auth guard, user list, add user, delete user
   All UI updates are instant (no page reload needed)
 ========================================================= */

const API = typeof CONFIG !== 'undefined' ? CONFIG.API_BASE_URL : 'http://127.0.0.1:5000';

// ── Initialisation ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Auth guard: must be super_admin
    const email = localStorage.getItem('user_email');
    const role  = localStorage.getItem('role');
    if (!email || role !== 'super_admin') {
        window.location.href = 'login.html';
        return;
    }

    // Load avatar
    loadAvatar(email);

    // Load user list
    loadUsers();
});

// ── Avatar ──────────────────────────────────────────────
function loadAvatar(email) {
    fetch(`${API}/api/profile?email=${encodeURIComponent(email)}`)
        .then(r => r.json())
        .then(d => {
            if (d.success && d.avatar) {
                document.getElementById('nav-profile-img').src = d.avatar;
            }
        })
        .catch(() => {}); // silent fail – avatar is cosmetic
}

// ── Tab Switching ────────────────────────────────────────
function switchTab(tab) {
    // Reset all tabs
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');

    document.getElementById(`tab-${tab}`).classList.add('active');
    document.getElementById(`panel-${tab}`).style.display = 'block';
}

// ── Load User List ───────────────────────────────────────
async function loadUsers() {
    const loading = document.getElementById('users-loading');
    const empty   = document.getElementById('users-empty');
    const wrapper = document.getElementById('users-table-wrapper');
    const tbody   = document.getElementById('users-tbody');

    // Reset to loading state
    loading.style.display = 'flex';
    empty.style.display   = 'none';
    wrapper.style.display = 'none';
    tbody.innerHTML = '';

    // Animate refresh button icon
    const refreshBtn = document.querySelector('.refresh-btn i');
    if (refreshBtn) refreshBtn.style.animation = 'spin 0.8s linear infinite';

    try {
        const res  = await fetch(`${API}/api/users`);
        const data = await res.json();

        if (!data.success) throw new Error(data.message);

        const users = data.users;

        loading.style.display = 'none';
        if (refreshBtn) refreshBtn.style.animation = '';

        if (!users || users.length === 0) {
            empty.style.display = 'flex';
            return;
        }

        wrapper.style.display = 'block';
        users.forEach((user, idx) => {
            tbody.appendChild(buildUserRow(user, idx + 1));
        });

    } catch (err) {
        loading.style.display = 'none';
        if (refreshBtn) refreshBtn.style.animation = '';
        console.error('Error loading users:', err);
        showToast('Failed to load users: ' + err.message, 'error');
    }
}

// ── Build Table Row ──────────────────────────────────────
function buildUserRow(user, rowNum) {
    const tr = document.createElement('tr');
    tr.setAttribute('data-user-id', user.id);

    const roleLower = (user.role || user.Role || '').toLowerCase().replace(/_/g, ' ');
    const isSuperAdmin = roleLower === 'super admin' || roleLower === 'super_admin';

    const roleLabel  = isSuperAdmin ? 'Super Admin' : 'Admin';
    const roleCls    = isSuperAdmin ? 'role-super-admin' : 'role-admin';
    const roleIcon   = isSuperAdmin ? 'fa-crown' : 'fa-user-tie';

    const initials = getInitials(user.name || user.email || '?');

    tr.innerHTML = `
        <td style="color:var(--text-muted); font-size:0.85rem;">${rowNum}</td>
        <td>
            <div class="user-name-cell">
                <div class="user-avatar-circle">${initials}</div>
                <span>${escapeHtml(user.name || '—')}</span>
            </div>
        </td>
        <td style="color:var(--text-muted);">${escapeHtml(user.email || '—')}</td>
        <td><span class="role-badge ${roleCls}"><i class="fa-solid ${roleIcon}"></i>${roleLabel}</span></td>
        <td>
            <button class="delete-row-btn"
                onclick="promptDelete('${user.id}', '${escapeHtml(user.email || '')}')">
                <i class="fa-solid fa-trash-can"></i> Delete
            </button>
        </td>
    `;
    return tr;
}

// ── Add User ─────────────────────────────────────────────
async function handleAddUser(e) {
    e.preventDefault();

    const name     = document.getElementById('inp-name').value.trim();
    const email    = document.getElementById('inp-email').value.trim();
    const password = document.getElementById('inp-password').value.trim();
    const role     = document.getElementById('inp-role').value;

    // Clear previous errors
    clearErrors();

    let valid = true;
    if (!name)     { showFieldError('err-name',     'Name is required');                 valid = false; }
    if (!email)    { showFieldError('err-email',    'Email is required');                valid = false; }
    else if (!isValidEmail(email)) { showFieldError('err-email', 'Invalid email address'); valid = false; }
    if (!password) { showFieldError('err-password', 'Password is required');             valid = false; }
    else if (password.length < 8) { showFieldError('err-password', 'Min. 8 characters'); valid = false; }
    else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}/.test(password)) { showFieldError('err-password', 'Needs uppercase, lowercase, number, symbol'); valid = false; }
    if (!role)     { showFieldError('err-role',     'Please select a role');             valid = false; }

    if (!valid) return;

    setFormLoading(true);

    try {
        const res  = await fetch(`${API}/api/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, role, requester_email: localStorage.getItem('user_email') })
        });
        const data = await res.json();

        setFormLoading(false);

        if (!data.success) {
            showFormMsg(data.message || 'Failed to create user', 'error');
            return;
        }

        // Reset form
        document.getElementById('add-user-form').reset();
        showFormMsg('User created successfully!', 'success');
        showToast(`✓ User "${name}" created and registered in Supabase Auth`, 'success');

        // Instantly add to users table without a full reload
        instantAddRow(data.user);

        // Switch to users tab after short delay so user sees success
        setTimeout(() => switchTab('users'), 1200);

    } catch (err) {
        setFormLoading(false);
        showFormMsg('Network error: ' + err.message, 'error');
    }
}

// Instantly prepend a new row to the table
function instantAddRow(user) {
    const tbody   = document.getElementById('users-tbody');
    const wrapper = document.getElementById('users-table-wrapper');
    const empty   = document.getElementById('users-empty');

    // Count existing rows to determine row number
    const existingRows = tbody.querySelectorAll('tr');
    const rowNum = existingRows.length + 1;

    const newRow = buildUserRow(user, rowNum);
    newRow.style.opacity = '0';
    tbody.appendChild(newRow);

    // Show table if it was hidden (first user)
    wrapper.style.display = 'block';
    empty.style.display   = 'none';

    // Animate in
    requestAnimationFrame(() => {
        newRow.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        newRow.style.opacity    = '1';
        newRow.style.transform  = 'translateX(0)';
    });
}

// ── Delete User ───────────────────────────────────────────
let pendingDeleteId    = null;
let pendingDeleteEmail = null;

function promptDelete(userId, userEmail) {
    pendingDeleteId    = userId;
    pendingDeleteEmail = userEmail;

    document.getElementById('delete-modal-msg').textContent =
        `Are you sure you want to permanently delete "${userEmail}"? This will remove their record from the database AND Supabase Auth.`;

    showOverlay('delete-overlay');

    // Wire confirm button
    const confirmBtn = document.getElementById('confirm-delete-btn');
    confirmBtn.onclick = executeDelete;
}

async function executeDelete() {
    if (!pendingDeleteId) return;

    const confirmBtn = document.getElementById('confirm-delete-btn');
    confirmBtn.textContent = 'Deleting…';
    confirmBtn.disabled    = true;

    try {
        const res  = await fetch(`${API}/api/users/${pendingDeleteId}`, { method: 'DELETE' });
        const data = await res.json();

        hideOverlay('delete-overlay');
        confirmBtn.textContent = 'Delete';
        confirmBtn.disabled    = false;

        if (!data.success) {
            showToast(data.message || 'Delete failed', 'error');
            return;
        }

        // Instantly remove the row from the DOM
        const row = document.querySelector(`tr[data-user-id="${pendingDeleteId}"]`);
        if (row) {
            row.style.transition = 'all 0.35s ease';
            row.style.opacity    = '0';
            row.style.transform  = 'translateX(30px)';
            setTimeout(() => {
                row.remove();
                renumberRows();
                // Show empty state if no rows left
                if (!document.querySelector('#users-tbody tr')) {
                    document.getElementById('users-table-wrapper').style.display = 'none';
                    document.getElementById('users-empty').style.display = 'flex';
                }
            }, 350);
        }

        showToast(`✓ User "${pendingDeleteEmail}" deleted from DB and Supabase Auth`, 'success');

    } catch (err) {
        hideOverlay('delete-overlay');
        confirmBtn.textContent = 'Delete';
        confirmBtn.disabled    = false;
        showToast('Network error: ' + err.message, 'error');
    }

    pendingDeleteId    = null;
    pendingDeleteEmail = null;
}

function hideDeleteModal() {
    hideOverlay('delete-overlay');
    pendingDeleteId    = null;
    pendingDeleteEmail = null;
}

// ── Helpers ──────────────────────────────────────────────

function renumberRows() {
    document.querySelectorAll('#users-tbody tr').forEach((row, i) => {
        const firstCell = row.querySelector('td:first-child');
        if (firstCell) firstCell.textContent = i + 1;
    });
}

function togglePassword(inputId, btn) {
    const inp = document.getElementById(inputId);
    if (inp.type === 'password') {
        inp.type = 'text';
        btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
    } else {
        inp.type = 'password';
        btn.innerHTML = '<i class="fa-solid fa-eye"></i>';
    }
}

function setFormLoading(isLoading) {
    const btn     = document.getElementById('submit-btn');
    const text    = btn.querySelector('.btn-text');
    const loader  = btn.querySelector('.btn-loader');
    btn.disabled  = isLoading;
    text.style.display   = isLoading ? 'none'  : 'flex';
    loader.style.display = isLoading ? 'flex'  : 'none';
}

function showFieldError(id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg;
}

function clearErrors() {
    ['err-name','err-email','err-password','err-role'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '';
    });
    const fm = document.getElementById('form-msg');
    if (fm) fm.style.display = 'none';
}

function showFormMsg(msg, type) {
    const fm = document.getElementById('form-msg');
    fm.textContent  = msg;
    fm.className    = `form-msg ${type}`;
    fm.style.display = 'block';
}

let toastTimer;
function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className   = `toast toast-${type} show`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

function showOverlay(id)  { document.getElementById(id).classList.add('show'); }
function hideOverlay(id)  { document.getElementById(id).classList.remove('show'); }

// Close overlay when clicking outside modal box
document.querySelectorAll('.overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.classList.remove('show');
    });
});

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getInitials(str) {
    const parts = str.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return str.slice(0, 2).toUpperCase();
}

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function capitalize(str) {
    if (!str) return '';
    return str[0].toUpperCase() + str.slice(1);
}

// ── Logout ────────────────────────────────────────────────
function showLogoutPopup()  { showOverlay('logout-overlay'); }
function hideLogoutPopup()  { hideOverlay('logout-overlay'); }

async function performLogout() {
    const email = localStorage.getItem('user_email');
    if (email) {
        try {
            await fetch(`${API}/api/logout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
        } catch (_) {}
    }
    localStorage.removeItem('user_email');
    localStorage.removeItem('role');
    window.location.href = 'login.html';
}

window.addEventListener('beforeunload', () => {
    const email = localStorage.getItem('user_email');
    if (email) {
        navigator.sendBeacon(`${API}/api/logout`, JSON.stringify({ email }));
    }
});
