// ── Auth guard ──
const userEmail = localStorage.getItem('user_email');
if (!userEmail) window.location.href = 'login.html';

// ── Profile image ──
const savedImg = localStorage.getItem('profileImage');
if (savedImg) document.getElementById('nav-profile-img').src = savedImg;

// ── State ──
let predictionData = [];
let uploadedBlob = null;

// ── On load: run predictions ──
window.addEventListener('DOMContentLoaded', async () => {
    const csvRaw = sessionStorage.getItem('csv_raw');
    const filename = sessionStorage.getItem('uploaded_filename') || 'data.csv';

    if (!csvRaw) {
        showError('No data found', 'Please go back to the Dashboard and upload a CSV file first.');
        return;
    }

    // Convert raw CSV string back to a File/Blob for FormData
    uploadedBlob = new Blob([csvRaw], { type: 'text/csv' });

    try {
        const formData = new FormData();
        formData.append('file', uploadedBlob, filename);

        const response = await fetch('http://127.0.0.1:5000/predict', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Prediction failed');
        }

        predictionData = result.predictions;
        renderAll(result.total_rows, filename);

    } catch (err) {
        showError('Prediction Failed', err.message);
    }
});

// ── Render everything ──
function renderAll(totalRows, filename) {
    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('analyse-content').classList.remove('hidden');

    // Meta
    document.getElementById('analyse-meta').textContent =
        `File: ${filename} · ${totalRows} predictions generated`;

    // Stats
    const probs = predictionData.map(r => r.failure_probability);
    const high = probs.filter(p => p >= 70).length;
    const medium = probs.filter(p => p >= 30 && p < 70).length;
    const low = probs.filter(p => p < 30).length;
    const avg = (probs.reduce((a, b) => a + b, 0) / probs.length).toFixed(1);

    document.getElementById('header-stats').innerHTML = `
        <div class="stat-chip danger">
            <span class="stat-val">${high}</span>
            <span class="stat-label">High Risk</span>
        </div>
        <div class="stat-chip warning">
            <span class="stat-val">${medium}</span>
            <span class="stat-label">Medium Risk</span>
        </div>
        <div class="stat-chip success">
            <span class="stat-val">${low}</span>
            <span class="stat-label">Low Risk</span>
        </div>
        <div class="stat-chip">
            <span class="stat-val">${avg}%</span>
            <span class="stat-label">Avg Probability</span>
        </div>
    `;

    renderFailureTimeChart();
    renderMotorRiskChart();
    renderRiskDistChart(high, medium, low);
    renderTempFailureChart();
    renderTorqueSpeedChart();
    renderToolWearChart();
}

// Chart defaults
Chart.defaults.font.family = 'Inter';
Chart.defaults.color = '#4B5563';

const GOLD = '#D4AF37';
const GOLD_LIGHT = 'rgba(212,175,55,0.15)';
const DANGER = '#EF4444';
const SUCCESS = '#10B981';
const WARNING = '#F59E0B';
const BLUE = '#3B82F6';

// ── Chart 1: Failure Probability Over Time (line) ──
function renderFailureTimeChart() {
    // Sample every N points to keep chart readable
    const step = Math.max(1, Math.floor(predictionData.length / 200));
    const sampled = predictionData.filter((_, i) => i % step === 0);

    new Chart(document.getElementById('chart-failure-time'), {
        type: 'line',
        data: {
            labels: sampled.map((_, i) => i * step),
            datasets: [{
                label: 'Failure Probability (%)',
                data: sampled.map(r => r.failure_probability),
                borderColor: GOLD,
                backgroundColor: GOLD_LIGHT,
                borderWidth: 2,
                pointRadius: 0,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { title: { display: true, text: 'Row Index' }, grid: { color: 'rgba(0,0,0,0.04)' } },
                y: { title: { display: true, text: 'Probability (%)' }, min: 0, grid: { color: 'rgba(0,0,0,0.04)' } }
            }
        }
    });
}

// ── Chart 2: Top 10 Motors by Risk (bar) ──
function renderMotorRiskChart() {
    // Group by motor_id, take max failure probability
    const motorMap = {};
    predictionData.forEach(r => {
        if (!motorMap[r.motor_id] || r.failure_probability > motorMap[r.motor_id]) {
            motorMap[r.motor_id] = r.failure_probability;
        }
    });
    const sorted = Object.entries(motorMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    new Chart(document.getElementById('chart-motor-risk'), {
        type: 'bar',
        data: {
            labels: sorted.map(([id]) => id),
            datasets: [{
                label: 'Max Failure Probability (%)',
                data: sorted.map(([, v]) => v.toFixed(2)),
                backgroundColor: sorted.map(([, v]) =>
                    v >= 70 ? 'rgba(239,68,68,0.75)' :
                    v >= 30 ? 'rgba(245,158,11,0.75)' :
                    'rgba(16,185,129,0.75)'
                ),
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false } },
                y: { title: { display: true, text: 'Probability (%)' }, min: 0, grid: { color: 'rgba(0,0,0,0.04)' } }
            }
        }
    });
}

// ── Chart 3: Risk Distribution (doughnut) ──
function renderRiskDistChart(high, medium, low) {
    new Chart(document.getElementById('chart-risk-dist'), {
        type: 'doughnut',
        data: {
            labels: ['High Risk (≥70%)', 'Medium Risk (30-70%)', 'Low Risk (<30%)'],
            datasets: [{
                data: [high, medium, low],
                backgroundColor: [
                    'rgba(239,68,68,0.8)',
                    'rgba(245,158,11,0.8)',
                    'rgba(16,185,129,0.8)'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { padding: 16, font: { size: 12 } } }
            },
            cutout: '60%'
        }
    });
}

// ── Chart 4: Air Temp vs Failure Probability (scatter) ──
function renderTempFailureChart() {
    const step = Math.max(1, Math.floor(predictionData.length / 300));
    const sampled = predictionData.filter((_, i) => i % step === 0);

    new Chart(document.getElementById('chart-temp-failure'), {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Air Temp vs Failure',
                data: sampled.map(r => ({ x: r.air_temp, y: r.failure_probability })),
                backgroundColor: 'rgba(212,175,55,0.5)',
                pointRadius: 3
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { title: { display: true, text: 'Air Temperature (K)' }, grid: { color: 'rgba(0,0,0,0.04)' } },
                y: { title: { display: true, text: 'Failure Probability (%)' }, grid: { color: 'rgba(0,0,0,0.04)' } }
            }
        }
    });
}

// ── Chart 5: Torque vs Rotational Speed (scatter) ──
function renderTorqueSpeedChart() {
    const step = Math.max(1, Math.floor(predictionData.length / 300));
    const sampled = predictionData.filter((_, i) => i % step === 0);

    new Chart(document.getElementById('chart-torque-speed'), {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Torque vs Speed',
                data: sampled.map(r => ({ x: r.rotational_speed, y: r.torque })),
                backgroundColor: sampled.map(r =>
                    r.failure_probability >= 70 ? 'rgba(239,68,68,0.6)' :
                    r.failure_probability >= 30 ? 'rgba(245,158,11,0.6)' :
                    'rgba(59,130,246,0.5)'
                ),
                pointRadius: 3
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { title: { display: true, text: 'Rotational Speed (rpm)' }, grid: { color: 'rgba(0,0,0,0.04)' } },
                y: { title: { display: true, text: 'Torque (Nm)' }, grid: { color: 'rgba(0,0,0,0.04)' } }
            }
        }
    });
}

// ── Chart 6: Tool Wear Distribution (histogram via bar) ──
function renderToolWearChart() {
    const wearValues = predictionData.map(r => r.tool_wear);
    const min = Math.min(...wearValues);
    const max = Math.max(...wearValues);
    const binCount = 20;
    const binSize = (max - min) / binCount;

    const bins = Array(binCount).fill(0);
    const labels = [];
    for (let i = 0; i < binCount; i++) {
        labels.push(`${Math.round(min + i * binSize)}`);
    }
    wearValues.forEach(v => {
        let idx = Math.floor((v - min) / binSize);
        if (idx >= binCount) idx = binCount - 1;
        bins[idx]++;
    });

    new Chart(document.getElementById('chart-tool-wear'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Count',
                data: bins,
                backgroundColor: 'rgba(212,175,55,0.65)',
                borderColor: GOLD,
                borderWidth: 1,
                borderRadius: 4,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { title: { display: true, text: 'Tool Wear (min)' }, grid: { display: false } },
                y: { title: { display: true, text: 'Count' }, grid: { color: 'rgba(0,0,0,0.04)' } }
            }
        }
    });
}

// ── Convert & Download ──
async function convertAndDownload() {
    if (!uploadedBlob) {
        showToast('No data available. Go back and upload a file.', true);
        return;
    }

    const btn = document.getElementById('convert-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

    try {
        const filename = sessionStorage.getItem('uploaded_filename') || 'data.csv';
        const formData = new FormData();
        formData.append('file', uploadedBlob, filename);

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

// ── Error State ──
function showError(title, msg) {
    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('error-state').classList.remove('hidden');
    document.getElementById('error-title').textContent = title;
    document.getElementById('error-msg').textContent = msg;
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
    document.getElementById('toast-msg').textContent = msg;
    toast.style.background = isError ? '#EF4444' : '#1F2937';
    toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add('hidden'), 3500);
}
