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
