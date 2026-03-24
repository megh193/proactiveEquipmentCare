// Role guard — redirect super_admins to their own dashboard
document.addEventListener('DOMContentLoaded', function () {
    var role = localStorage.getItem('role');
    if (!role) {
        window.location.href = 'login.html';
        return;
    }
    if (role === 'super_admin') {
        window.location.href = 'super_admin_dashboard.html';
    }
});
