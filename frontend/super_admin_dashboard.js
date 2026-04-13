// Role guard — redirect non-super-admins away
document.addEventListener('DOMContentLoaded', function () {
    var role = localStorage.getItem('role');
    if (!role) {
        window.location.href = 'login.html';
        return;
    }
    if (role !== 'super_admin') {
        window.location.href = 'admin_dashboard.html';
    }
});

// ── Section visibility helpers ──
function hideAllSections() {
    document.getElementById('upload-section').style.display = 'none';
    document.getElementById('preview-section').style.display = 'none';
    document.getElementById('audit-section').style.display = 'none';
    document.getElementById('login-logs-section').style.display = 'none';
    document.querySelectorAll('.pill-btn').forEach(function (b) { b.classList.remove('active'); });
}

function showAuditSection() {
    hideAllSections();
    document.getElementById('audit-section').style.display = 'block';
    document.getElementById('pill-audit').classList.add('active');
    loadAuditLogs();
}

function showLoginLogsSection() {
    hideAllSections();
    document.getElementById('login-logs-section').style.display = 'block';
    document.getElementById('pill-login').classList.add('active');
    loadLoginLogs();
}

// Restore upload section when Data Upload pill is clicked (override inline onclick)
document.addEventListener('DOMContentLoaded', function () {
    var uploadPill = document.querySelector('.pill-btn:first-child');
    if (uploadPill) {
        uploadPill.addEventListener('click', function () {
            hideAllSections();
            document.getElementById('upload-section').style.display = 'block';
            uploadPill.classList.add('active');
        });
    }
});

// ── Audit Logs ──
var auditLogsData = [];

function loadAuditLogs() {
    var tbody = document.getElementById('audit-tbody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:#64748B;">Loading...</td></tr>';
    fetch(`${CONFIG.API_BASE_URL}/api/audit-logs`)
        .then(function (r) { return r.json(); })
        .then(function (data) {
            auditLogsData = data.logs || [];
            renderAuditTable(auditLogsData);
        })
        .catch(function () {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:#EF4444;">Failed to load audit logs.</td></tr>';
        });
}

function renderAuditTable(logs) {
    var tbody = document.getElementById('audit-tbody');
    if (!logs.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:#64748B;">No audit logs found.</td></tr>';
        return;
    }
    tbody.innerHTML = logs.map(function (row, i) {
        var ts = row.ran_at ? new Date(row.ran_at).toLocaleString() : '—';
        return '<tr>' +
            '<td>' + (i + 1) + '</td>' +
            '<td>' + escapeHtml(row.user_email || '—') + '</td>' +
            '<td>' + escapeHtml(row.csv_name || '—') + '</td>' +
            '<td>' + (row.row_count != null ? row.row_count : '—') + '</td>' +
            '<td>' + ts + '</td>' +
            '</tr>';
    }).join('');
}

function exportAuditCSV() {
    if (!auditLogsData.length) { showToast('No audit logs to export.', true); return; }
    var header = ['#', 'User Email', 'CSV File', 'Row Count', 'Ran At'];
    var rows = auditLogsData.map(function (row, i) {
        return [i + 1, row.user_email || '', row.csv_name || '', row.row_count != null ? row.row_count : '', row.ran_at || ''];
    });
    downloadCSV('audit_logs.csv', header, rows);
}

// ── Login Logs ──
var loginLogsData = [];

function loadLoginLogs() {
    var tbody = document.getElementById('login-logs-tbody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:#64748B;">Loading...</td></tr>';
    fetch(`${CONFIG.API_BASE_URL}/api/login-logs`)
        .then(function (r) { return r.json(); })
        .then(function (data) {
            loginLogsData = data.logs || [];
            renderLoginTable(loginLogsData);
        })
        .catch(function () {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:#EF4444;">Failed to load login logs.</td></tr>';
        });
}

function renderLoginTable(logs) {
    var tbody = document.getElementById('login-logs-tbody');
    if (!logs.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:#64748B;">No login logs found.</td></tr>';
        return;
    }
    tbody.innerHTML = logs.map(function (row, i) {
        var ts = row.created_at ? new Date(row.created_at).toLocaleString() : '—';
        var statusClass = (row.status || '').toLowerCase() === 'success' ? 'badge-success' : 'badge-fail';
        return '<tr>' +
            '<td>' + (i + 1) + '</td>' +
            '<td>' + escapeHtml(row.user_email || '—') + '</td>' +
            '<td><span class="status-badge ' + statusClass + '">' + escapeHtml(row.status || '—') + '</span></td>' +
            '<td>' + escapeHtml(row.ip_address || '—') + '</td>' +
            '<td>' + ts + '</td>' +
            '</tr>';
    }).join('');
}

function exportLoginCSV() {
    if (!loginLogsData.length) { showToast('No login logs to export.', true); return; }
    var header = ['#', 'User Email', 'Status', 'IP Address', 'Timestamp'];
    var rows = loginLogsData.map(function (row, i) {
        return [i + 1, row.user_email || '', row.status || '', row.ip_address || '', row.created_at || ''];
    });
    downloadCSV('login_logs.csv', header, rows);
}

// ── CSV download helper ──
function downloadCSV(filename, header, rows) {
    var csvContent = [header].concat(rows).map(function (r) {
        return r.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\n');
    var blob = new Blob([csvContent], { type: 'text/csv' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
}
