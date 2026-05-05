// Role guard — redirect super_admins to their own dashboard
document.addEventListener('DOMContentLoaded', function () {
    var role = localStorage.getItem('role');
    var token = localStorage.getItem('auth_token');
    if (!role || !token) {
        window.location.href = 'login.html';
        return;
    }
    if (role === 'super_admin') {
        window.location.href = 'super_admin_dashboard.html';
    }
});

/* ===================================================
   TAB SWITCHING
   =================================================== */
function switchTab(tab) {
    document.querySelectorAll('.nav-tab').forEach(function (b) {
        b.classList.remove('active');
    });

    var uploadSection  = document.getElementById('upload-section');
    var previewSection = document.getElementById('preview-section');
    var singleSection  = document.getElementById('single-prediction-section');

    if (tab === 'upload') {
        document.getElementById('tab-upload').classList.add('active');
        if (singleSection) singleSection.style.display = 'none';
        // Restore whichever upload state is currently active
        var hasFile = (typeof uploadedFile !== 'undefined' && uploadedFile !== null);
        if (hasFile) {
            if (uploadSection)  uploadSection.style.display  = 'none';
            if (previewSection) previewSection.style.display = 'block';
        } else {
            if (uploadSection)  uploadSection.style.display  = 'block';
            if (previewSection) previewSection.style.display = 'none';
        }
    } else if (tab === 'single') {
        document.getElementById('tab-single').classList.add('active');
        if (uploadSection)  uploadSection.style.display  = 'none';
        if (previewSection) previewSection.style.display = 'none';
        if (singleSection)  singleSection.style.display  = 'block';
    }
}

/* ===================================================
   SINGLE MOTOR PREDICTION
   =================================================== */
var SP_ARC = 267; // half-circle arc length (π × 85)

function runSinglePrediction() {
    var airTemp    = document.getElementById('sp-air-temp').value.trim();
    var procTemp   = document.getElementById('sp-proc-temp').value.trim();
    var rotSpeed   = document.getElementById('sp-rot-speed').value.trim();
    var torque     = document.getElementById('sp-torque').value.trim();
    var toolWear   = document.getElementById('sp-tool-wear').value.trim();

    if (!airTemp || !procTemp || !rotSpeed || !torque || !toolWear) {
        showToast('Please fill in all 5 sensor fields.', true);
        return;
    }

    var btn = document.getElementById('sp-predict-btn');
    btn.disabled = true;
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Analyzing...';

    fetch(`${CONFIG.API_BASE_URL}/api/predict-single`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            air_temperature:    parseFloat(airTemp),
            process_temperature: parseFloat(procTemp),
            rotational_speed:   parseFloat(rotSpeed),
            torque:             parseFloat(torque),
            tool_wear:          parseFloat(toolWear)
        })
    })
    .then(function (res) { return res.json(); })
    .then(function (data) {
        if (!data.success) throw new Error(data.message || 'Prediction failed');
        displaySingleResult(data, {
            air: airTemp, proc: procTemp, rpm: rotSpeed, torque: torque, wear: toolWear
        });
        logSinglePredictionAudit();
        updateMetricsFromSingle(data.failure_probability);
    })
    .catch(function (err) {
        showToast(err.message, true);
    })
    .finally(function () {
        btn.disabled = false;
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> Predict Failure';
    });
}

function displaySingleResult(data, inputs) {
    var prob      = data.failure_probability;  // 0–100
    var riskLevel = data.risk_level;            // 'high' | 'medium' | 'low'

    // Show result card
    var resultCard = document.getElementById('sp-result');
    resultCard.style.display = 'flex';

    // Fill input summary
    document.getElementById('sp-r-air').textContent    = parseFloat(inputs.air).toFixed(1) + ' K';
    document.getElementById('sp-r-proc').textContent   = parseFloat(inputs.proc).toFixed(1) + ' K';
    document.getElementById('sp-r-rpm').textContent    = parseFloat(inputs.rpm).toFixed(0) + ' rpm';
    document.getElementById('sp-r-torque').textContent = parseFloat(inputs.torque).toFixed(1) + ' Nm';
    document.getElementById('sp-r-wear').textContent   = parseFloat(inputs.wear).toFixed(0) + ' min';

    // Risk badge
    var badge     = document.getElementById('sp-risk-badge');
    badge.className = 'sp-risk-badge';
    var noteEl    = document.getElementById('sp-result-note');
    if (riskLevel === 'high') {
        badge.classList.add('sp-risk-high');
        badge.textContent = 'HIGH RISK — Immediate Attention Required';
        noteEl.textContent = 'This motor shows a high likelihood of failure. Schedule immediate maintenance and consider taking it offline for inspection.';
    } else if (riskLevel === 'medium') {
        badge.classList.add('sp-risk-medium');
        badge.textContent = 'MEDIUM RISK — Monitor Closely';
        noteEl.textContent = 'This motor exhibits elevated failure probability. Increase monitoring frequency and plan preventive maintenance soon.';
    } else {
        badge.classList.add('sp-risk-low');
        badge.textContent = 'LOW RISK — Operating Normally';
        noteEl.textContent = 'This motor is operating within healthy parameters. Continue routine monitoring and scheduled maintenance intervals.';
    }

    // Animate gauge
    var fill = document.getElementById('spGaugeFill');
    var text = document.getElementById('spGaugeText');
    if (!fill || !text) return;

    var startTime = null;
    var duration  = 1400;
    var target    = prob;

    function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

    function step(ts) {
        if (!startTime) startTime = ts;
        var elapsed  = ts - startTime;
        var progress = Math.min(elapsed / duration, 1);
        var eased    = easeOut(progress);
        var cur      = eased * target;
        var offset   = SP_ARC * (1 - cur / 100);
        fill.setAttribute('stroke-dashoffset', offset.toFixed(2));
        text.textContent = Math.round(cur) + '%';
        if (progress < 1) requestAnimationFrame(step);
    }

    fill.setAttribute('stroke-dashoffset', SP_ARC);
    text.textContent = '0%';
    requestAnimationFrame(step);
}

function resetSinglePrediction() {
    document.getElementById('sp-result').style.display = 'none';
    ['sp-air-temp','sp-proc-temp','sp-rot-speed','sp-torque','sp-tool-wear'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
    });
    // Reset gauge
    var fill = document.getElementById('spGaugeFill');
    var text = document.getElementById('spGaugeText');
    if (fill) fill.setAttribute('stroke-dashoffset', SP_ARC);
    if (text) text.textContent = '0%';
}

function logSinglePredictionAudit() {
    var email = localStorage.getItem('user_email');
    if (!email) return;
    fetch(`${CONFIG.API_BASE_URL}/api/audit-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_email: email, csv_name: 'single_prediction', row_count: 1 })
    }).catch(function () {});
}

function updateMetricsFromSingle(prob) {
    var email = localStorage.getItem('user_email') || '';
    // Increment total predictions by 1
    var prev = parseInt(localStorage.getItem('dash_total_rows_' + email) || '0');
    localStorage.setItem('dash_total_rows_' + email, prev + 1);

    // Update critical alerts if high risk
    if (prob >= 70) {
        var alerts = parseInt(localStorage.getItem('dash_critical_alerts_' + email) || '0');
        localStorage.setItem('dash_critical_alerts_' + email, alerts + 1);
    }

    // Update last upload/run date
    localStorage.setItem('dash_last_upload_' + email, new Date().toLocaleString());
    updateMetricCards();
}
