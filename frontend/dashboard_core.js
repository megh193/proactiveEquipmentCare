// ── Auth guard ──
(function () {
    const email = localStorage.getItem('user_email');
    if (!email) window.location.href = 'login.html';
})();

// ── Profile image ──
window.addEventListener('DOMContentLoaded', function () {
    var saved = localStorage.getItem('profileImage');
    var img = document.getElementById('nav-profile-img');
    if (saved && img) img.src = saved;
    updateMetricCards();
});

// ── State ──
var uploadedFile = null;
var parsedRows = [];
var parsedHeaders = [];

// ── Wire up file input after DOM ready ──
window.addEventListener('DOMContentLoaded', function () {
    var uploadBox = document.getElementById('upload-box');
    var fileInput = document.getElementById('csv-upload');

    if (!uploadBox || !fileInput) return;

    // Drag & drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(function (evt) {
        uploadBox.addEventListener(evt, function (e) { e.preventDefault(); e.stopPropagation(); });
        document.body.addEventListener(evt, function (e) { e.preventDefault(); e.stopPropagation(); });
    });

    uploadBox.addEventListener('dragenter', function () { uploadBox.classList.add('dragover'); });
    uploadBox.addEventListener('dragover',  function () { uploadBox.classList.add('dragover'); });
    uploadBox.addEventListener('dragleave', function () { uploadBox.classList.remove('dragover'); });
    uploadBox.addEventListener('drop', function (e) {
        uploadBox.classList.remove('dragover');
        var files = e.dataTransfer.files;
        if (files.length) handleFile(files[0]);
    });

    // Browse button
    fileInput.addEventListener('change', function () {
        if (fileInput.files.length) handleFile(fileInput.files[0]);
    });
});

// ── Handle file ──
function handleFile(file) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
        showToast('Please upload a valid CSV file.', true);
        return;
    }
    uploadedFile = file;

    var reader = new FileReader();
    reader.onload = function (e) {
        parseCSV(e.target.result);
        renderPreview();
        document.getElementById('upload-section').style.display = 'none';
        document.getElementById('preview-section').style.display = 'block';
    };
    reader.readAsText(file);
}

// ── Parse CSV ──
function parseCSV(text) {
    var lines = text.trim().split('\n');
    parsedHeaders = lines[0].split(',').map(function (h) {
        return h.trim().replace(/^"|"$/g, '');
    });
    parsedRows = lines.slice(1).map(function (line) {
        return line.split(',').map(function (v) {
            return v.trim().replace(/^"|"$/g, '');
        });
    });

    // Save metrics for dashboard cards
    var productIdIdx = parsedHeaders.findIndex(function (h) {
        return h.toLowerCase().replace(/\s/g, '') === 'productid';
    });
    var uniqueMotors = 0;
    if (productIdIdx !== -1) {
        uniqueMotors = new Set(parsedRows.map(function (r) { return r[productIdIdx]; })).size;
    }
    var prevTotal = parseInt(localStorage.getItem('dash_total_rows') || '0');
    localStorage.setItem('dash_total_rows', prevTotal + parsedRows.length);
    localStorage.setItem('dash_unique_motors', uniqueMotors);
    localStorage.setItem('dash_last_upload', new Date().toLocaleString());
    updateMetricCards();
}

// ── Update metric cards from localStorage ──
function updateMetricCards() {
    var totalEl   = document.querySelector('.metric-card:nth-child(1) .metric-value');
    var motorsEl  = document.querySelector('.metric-card:nth-child(2) .metric-value');
    var alertsEl  = document.querySelector('.metric-card:nth-child(3) .metric-value');
    var uptimeEl  = document.querySelector('.metric-card:nth-child(4) .metric-value');
    var uptimeSubEl = document.querySelector('.metric-card:nth-child(4) .metric-sub');

    var total   = localStorage.getItem('dash_total_rows');
    var motors  = localStorage.getItem('dash_unique_motors');
    var alerts  = localStorage.getItem('dash_critical_alerts');
    var lastUpload = localStorage.getItem('dash_last_upload');

    if (totalEl  && total)   totalEl.textContent  = parseInt(total).toLocaleString();
    if (motorsEl && motors)  motorsEl.textContent = parseInt(motors).toLocaleString();
    if (alertsEl && alerts)  alertsEl.textContent = alerts;
    if (uptimeEl && lastUpload) {
        uptimeEl.textContent = lastUpload.split(',')[0];
        if (uptimeSubEl) uptimeSubEl.textContent = 'Last upload date';
    }
}

// ── Pagination state ──
var currentPage = 1;
var rowsPerPage = 10;

// ── Render preview table ──
function renderPreview() {
    currentPage = 1;
    renderPagedTable();
}

function renderPagedTable() {
    var thead = document.getElementById('preview-thead');
    var tbody = document.getElementById('preview-tbody');
    var meta  = document.getElementById('preview-meta');

    var totalRows = parsedRows.length;
    var totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    var startIdx = (currentPage - 1) * rowsPerPage;
    var endIdx   = Math.min(startIdx + rowsPerPage, totalRows);

    meta.textContent = 'Rows ' + (startIdx + 1) + '–' + endIdx + ' of ' + totalRows + ' · ' + parsedHeaders.length + ' columns';

    thead.innerHTML = '<tr>' + parsedHeaders.map(function (h) {
        return '<th>' + escapeHtml(h) + '</th>';
    }).join('') + '</tr>';

    tbody.innerHTML = parsedRows.slice(startIdx, endIdx).map(function (row) {
        return '<tr>' + row.map(function (v) {
            return '<td>' + escapeHtml(v) + '</td>';
        }).join('') + '</tr>';
    }).join('');

    // Render or update pagination controls
    renderPagination(currentPage, totalPages);
}

function renderPagination(page, totalPages) {
    var container = document.getElementById('table-pagination');
    if (!container) return;

    container.innerHTML = '';
    if (totalPages <= 1) return;

    // Prev button
    var prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn' + (page <= 1 ? ' disabled' : '');
    prevBtn.innerHTML = '&#8592; Prev';
    prevBtn.disabled = page <= 1;
    prevBtn.addEventListener('click', function () {
        if (currentPage > 1) { currentPage--; renderPagedTable(); }
    });
    container.appendChild(prevBtn);

    // Page info
    var info = document.createElement('span');
    info.className = 'page-info';
    info.textContent = 'Page ' + page + ' / ' + totalPages;
    container.appendChild(info);

    // Next button
    var nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn' + (page >= totalPages ? ' disabled' : '');
    nextBtn.innerHTML = 'Next &#8594;';
    nextBtn.disabled = page >= totalPages;
    nextBtn.addEventListener('click', function () {
        if (currentPage < totalPages) { currentPage++; renderPagedTable(); }
    });
    container.appendChild(nextBtn);
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// ── Reset upload ──
function resetUpload() {
    uploadedFile = null;
    parsedRows = [];
    parsedHeaders = [];
    var fi = document.getElementById('csv-upload');
    if (fi) fi.value = '';
    document.getElementById('preview-section').style.display = 'none';
    document.getElementById('upload-section').style.display = 'block';
}

// ── Navigate to Analyse ──
function goToAnalyse() {
    if (!uploadedFile) {
        showToast('Please upload a CSV file first.', true);
        return;
    }
    sessionStorage.setItem('uploaded_filename', uploadedFile.name);
    var reader = new FileReader();
    reader.onload = function (e) {
        sessionStorage.setItem('csv_raw', e.target.result);
        window.location.href = 'analyse.html';
    };
    reader.readAsText(uploadedFile);
}

// ── Convert & Download Predictions ──
function convertAndDownload() {
    if (!uploadedFile) {
        showToast('Please upload a CSV file first.', true);
        return;
    }

    var btn = document.getElementById('convert-btn');
    btn.disabled = true;
    btn.innerHTML = '⏳ Processing...';

    var formData = new FormData();
    formData.append('file', uploadedFile);

    fetch('http://127.0.0.1:5000/predict?download=true', {
        method: 'POST',
        body: formData
    })
    .then(function (response) {
        if (!response.ok) {
            return response.json().then(function (err) {
                throw new Error(err.message || 'Prediction failed');
            });
        }
        return response.blob();
    })
    .then(function (blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'predictions.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Predictions downloaded successfully!');
    })
    .catch(function (err) {
        showToast(err.message, true);
    })
    .finally(function () {
        btn.disabled = false;
        btn.innerHTML = '✦ Download Predictions';
    });
}

// ── Logout ──
function showLogoutPopup() {
    document.getElementById('logout-overlay').classList.add('show');
}
function hideLogoutPopup() {
    document.getElementById('logout-overlay').classList.remove('show');
}
function performLogout() {
    localStorage.removeItem('user_email');
    localStorage.removeItem('role');
    window.location.href = 'login.html';
}
window.addEventListener('DOMContentLoaded', function () {
    var overlay = document.getElementById('logout-overlay');
    if (overlay) {
        overlay.addEventListener('click', function (e) {
            if (e.target === this) hideLogoutPopup();
        });
    }
});

// ── Toast ──
var toastTimer;
function showToast(msg, isError) {
    var toast = document.getElementById('toast');
    var toastMsg = document.getElementById('toast-msg');
    if (!toast || !toastMsg) return;
    toastMsg.textContent = msg;
    toast.style.background = isError ? '#EF4444' : '#1F2937';
    toast.style.display = 'flex';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
        toast.style.display = 'none';
    }, 3500);
}
