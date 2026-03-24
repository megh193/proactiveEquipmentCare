// ── Auth guard ──
const userEmail = localStorage.getItem('user_email');
if (!userEmail) window.location.href = 'login.html';

// ── Profile image ──
document.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('profileImage');
    if (saved) document.getElementById('nav-profile-img').src = saved;
});

// ── State ──
let uploadedFile = null;
let parsedRows = [];
let parsedHeaders = [];

// ── Upload box drag & drop ──
const uploadBox = document.getElementById('upload-box');
const fileInput = document.getElementById('csv-upload');

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
    uploadBox.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); });
    document.body.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); });
});
['dragenter', 'dragover'].forEach(evt => uploadBox.addEventListener(evt, () => uploadBox.classList.add('dragover')));
['dragleave', 'drop'].forEach(evt => uploadBox.addEventListener(evt, () => uploadBox.classList.remove('dragover')));

uploadBox.addEventListener('drop', e => {
    const files = e.dataTransfer.files;
    if (files.length) handleFile(files[0]);
});

fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleFile(fileInput.files[0]);
});

// ── Handle file ──
function handleFile(file) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
        showToast('Please upload a valid CSV file.', true);
        return;
    }
    uploadedFile = file;

    const reader = new FileReader();
    reader.onload = function (e) {
        const text = e.target.result;
        parseCSV(text);
        renderPreview();
        document.getElementById('upload-section').classList.add('hidden');
        document.getElementById('preview-section').classList.remove('hidden');
    };
    reader.readAsText(file);
}

// ── Parse CSV ──
function parseCSV(text) {
    const lines = text.trim().split('\n');
    parsedHeaders = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    parsedRows = lines.slice(1).map(line => {
        return line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    });
}

// ── Render preview table ──
function renderPreview() {
    const thead = document.getElementById('preview-thead');
    const tbody = document.getElementById('preview-tbody');
    const meta = document.getElementById('preview-meta');

    const previewCount = Math.min(10, parsedRows.length);
    meta.textContent = `Showing first ${previewCount} of ${parsedRows.length} rows · ${parsedHeaders.length} columns`;

    // Headers
    thead.innerHTML = '<tr>' + parsedHeaders.map(h => `<th>${h}</th>`).join('') + '</tr>';

    // Rows
    tbody.innerHTML = parsedRows.slice(0, previewCount).map(row => {
        return '<tr>' + row.map(v => `<td>${v}</td>`).join('') + '</tr>';
    }).join('');
}

// ── Reset upload ──
function resetUpload() {
    uploadedFile = null;
    parsedRows = [];
    parsedHeaders = [];
    fileInput.value = '';
    document.getElementById('preview-section').classList.add('hidden');
    document.getElementById('upload-section').classList.remove('hidden');
}

// ── Navigate to Analyse ──
function goToAnalyse() {
    if (!uploadedFile) {
        showToast('Please upload a CSV file first.', true);
        return;
    }
    // Store file name in sessionStorage so analyse page knows a file is ready
    sessionStorage.setItem('uploaded_filename', uploadedFile.name);
    sessionStorage.setItem('csv_headers', JSON.stringify(parsedHeaders));
    sessionStorage.setItem('csv_row_count', parsedRows.length);
    // Store the raw CSV text for the analyse page to send to backend
    const reader = new FileReader();
    reader.onload = e => {
        sessionStorage.setItem('csv_raw', e.target.result);
        window.location.href = 'analyse.html';
    };
    reader.readAsText(uploadedFile);
}

// ── Convert & Download ──
async function convertAndDownload() {
    if (!uploadedFile) {
        showToast('Please upload a CSV file first.', true);
        return;
    }

    const btn = document.getElementById('convert-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

    try {
        const formData = new FormData();
        formData.append('file', uploadedFile);

        const response = await fetch('http://127.0.0.1:5000/predict?download=true', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Prediction failed');
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'predictions.csv';
        a.click();
        URL.revokeObjectURL(url);
        showToast('Predictions downloaded successfully!');
    } catch (err) {
        showToast(err.message, true);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Convert & Download';
    }
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
document.getElementById('logout-overlay').addEventListener('click', function (e) {
    if (e.target === this) hideLogoutPopup();
});

// ── Toast ──
let toastTimer;
function showToast(msg, isError = false) {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-msg');
    toastMsg.textContent = msg;
    toast.style.background = isError ? '#EF4444' : '#1F2937';
    toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add('hidden'), 3500);
}
