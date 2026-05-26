/**
 * UEP REGISTRAR APPLICATION SUITE - BACKEND INTEGRATION ENGINE
 * Architecture: REST API-First via Native Asynchronous Fetch & JWT Auth
 */

// 1. GLOBAL CONFIGURATION & STATE MANAGEMENT
const API_BASE_URL = window.location.origin + '/api/v1'; 

const AppState = {
    getBearerToken: () => localStorage.getItem('uep_registrar_jwt'),
    setBearerToken: (token) => localStorage.setItem('uep_registrar_jwt', token),
    clearAuth: () => {
        localStorage.removeItem('uep_registrar_jwt');
        window.location.href = 'login_page.html';
    },
    // Safely handles network headers with Authorization Interceptors
    getHeaders: () => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AppState.getBearerToken()}`
    })
};

// 2. ROUTER & ROUTE ENGINE INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    const currentPath = window.location.pathname;

    // Route guards: Force users back to login if token is missing (except on login itself)
    if (!AppState.getBearerToken() && !currentPath.includes('login_page.html')) {
        AppState.clearAuth();
        return;
    }

    // Initialize module controllers depending on which page the browser is viewing
    if (currentPath.includes('login_page.html')) {
        initLoginController();
    } else if (currentPath.includes('monitoring.html') || currentPath.includes('dashboard.html')) {
        initSystemMonitoringDashboard();
    } else if (currentPath.includes('admission.html')) {
        initAdmissionModule();
    } else if (currentPath.includes('profiling.html')) {
        initProfilingModule();
    } else if (currentPath.includes('archiving-dashboard.html')) {
        initArchivingDashboard();
    } else if (currentPath.includes('archiving.html')) {
        initArchivingRegistry();
    } else if (currentPath.includes('archiving-view.html')) {
        initArchivingViewDrilldown();
    } else if (currentPath.includes('system-integrity.html')) {
        initSystemIntegrityEngine();
    }

    // Attach global logout hooks across all active viewports
    const logoutBtn = document.querySelector('.logout, #action-logout-trigger');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            AppState.clearAuth();
        });
    }
});

/* ─────────────────────────────────────────────────────────────────────────
   MODULE CONTROLLERS (Interfacing with Java Endpoints & DOM Templates)
   ───────────────────────────────────────────────────────────────────────── */

// A. USER AUTHENTICATION CONTROLLER (login_page.html)
function initLoginController() {
    const form = document.getElementById('form-auth-submission');
    if (!form) return;

    form.removeAttribute('onsubmit'); // Remove temporary inline redirect
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const usernameInput = document.getElementById('input-auth-user').value;
        const passwordInput = document.getElementById('input-auth-pass').value;
        const submitBtn = document.getElementById('btn-auth-execute');

        try {
            submitBtn.textContent = "Authenticating...";
            submitBtn.disabled = true;

            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: usernameInput, password: passwordInput })
            });

            if (!response.ok) throw new Error('Invalid credentials or unauthorized personnel.');

            const data = await response.json();
            AppState.setBearerToken(data.token); // Secure token storage mapping
            
            // Send the authorized user to the System/Archiving selection page
            window.location.href = 'selection.html';
        } catch (err) {
            alert(`Authentication Error: ${err.message}`);
            submitBtn.textContent = "Login";
            submitBtn.disabled = false;
        }
    });
}

// B. SYSTEM MONITORING SUITE (monitoring.html / dashboard.html)
async function initSystemMonitoringDashboard() {
    try {
        const response = await fetch(`${API_BASE_URL}/monitoring/summary`, {
            headers: AppState.getHeaders()
        });
        if (!response.ok) throw new Error('Failed to retrieve system monitoring telemetry.');
        const data = await response.json();

        // Target and map dynamic card stats
        const elements = {
            students: document.getElementById('monitor-metric-students') || document.getElementById('core-metric-students'),
            admissions: document.getElementById('monitor-metric-admissions') || document.getElementById('core-metric-admissions'),
            profiling: document.getElementById('monitor-metric-profiling') || document.getElementById('core-metric-profiling'),
            requests: document.getElementById('monitor-metric-requests') || document.getElementById('core-metric-requests')
        };

        if (elements.students) elements.students.textContent = data.totalStudents;
        if (elements.admissions) elements.admissions.textContent = data.totalAdmissions;
        if (elements.profiling) elements.profiling.textContent = data.totalProfiling;
        if (elements.requests) elements.requests.textContent = data.totalRequests;

        // Render dynamic heights for native CSS bar charts based on peak values
        const peakValue = Math.max(data.requestsClaimed, data.requestsRelease, data.requestsPending, 1);
        
        const barClaimed = document.getElementById('monitor-bar-claimed') || document.getElementById('dom-bar-claimed');
        const barRelease = document.getElementById('monitor-bar-release') || document.getElementById('dom-bar-release');
        const barPending = document.getElementById('monitor-bar-pending') || document.getElementById('dom-bar-pending');

        if (barClaimed) barClaimed.style.height = `${(data.requestsClaimed / peakValue) * 100}%`;
        if (barRelease) barRelease.style.height = `${(data.requestsRelease / peakValue) * 100}%`;
        if (barPending) barPending.style.height = `${(data.requestsPending / peakValue) * 100}%`;

    } catch (err) {
        console.error(err);
    }
}

// C. ADMISSION DATABASE RENDERING (admission.html)
async function initAdmissionModule() {
    const tableBody = document.getElementById('target-admission-rows');
    const template = document.getElementById('template-admission-row');
    if (!tableBody || !template) return;

    try {
        const response = await fetch(`${API_BASE_URL}/admissions`, { headers: AppState.getHeaders() });
        const admissions = await response.json();

        tableBody.innerHTML = ''; // Wipe loading placeholder

        admissions.forEach(record => {
            const clone = template.content.cloneNode(true);
            clone.querySelector('.col-id').textContent = record.id;
            clone.querySelector('.col-admission-no').textContent = record.admissionNo;
            clone.querySelector('.col-name').textContent = record.fullName;
            clone.querySelector('.col-year').textContent = record.yearGraduated;
            clone.querySelector('.col-date-added').textContent = record.dateCreated;
            clone.querySelector('.route-view-btn').href = `admission-view.html?id=${record.id}`;
            tableBody.appendChild(clone);
        });

        document.getElementById('txt-admission-pagination').textContent = `1-${admissions.length} of ${admissions.length}`;
    } catch (err) {
        console.error('Failed to populate admissions table:', err);
    }
}

// D. PROFILING REGISTRY LOGS LOOP (profiling.html)
async function initProfilingModule() {
    const tableBody = document.getElementById('target-profiling-rows');
    const template = document.getElementById('template-profiling-row');
    if (!tableBody || !template) return;

    try {
        const response = await fetch(`${API_BASE_URL}/profiles`, { headers: AppState.getHeaders() });
        const profiles = await response.json();

        tableBody.innerHTML = '';

        profiles.forEach(record => {
            const clone = template.content.cloneNode(true);
            clone.querySelector('.col-student-id').textContent = record.studentId;
            clone.querySelector('.col-name').textContent = record.fullName;
            clone.querySelector('.col-date-added').textContent = record.dateCreated;
            clone.querySelector('.route-view-btn').href = `profiling-view.html?id=${record.studentId}`;
            tableBody.appendChild(clone);
        });

        document.getElementById('txt-profiling-pagination').textContent = `1-${profiles.length} of ${profiles.length}`;
    } catch (err) {
        console.error('Failed to populate profiling rows:', err);
    }
}

// E. ARCHIVING ANALYTICAL DASHBOARD ENGINE (archiving-dashboard.html)
async function initArchivingDashboard() {
    try {
        const response = await fetch(`${API_BASE_URL}/archive/dashboard-summary`, { headers: AppState.getHeaders() });
        const data = await response.json();

        document.getElementById('metric-summary-students').textContent = data.totalStudents;
        document.getElementById('metric-summary-archived').textContent = data.totalArchived;
        document.getElementById('metric-summary-eligible').textContent = data.totalEligible;

        document.getElementById('metric-telemetry-used').textContent = `${data.storageUsedGb} GB`;
        document.getElementById('metric-telemetry-total').textContent = `${data.storageTotalTb} TB`;
        document.getElementById('metric-telemetry-encryption').textContent = data.encryptionStatus;
        document.getElementById('metric-telemetry-checksum').textContent = data.lastChecksumRun;

        // Animate Archiving Chart Column Bars
        const ceiling = Math.max(data.totalStudents, data.totalArchived, data.totalEligible, 1);
        document.getElementById('bar-summary-students').style.height = `${(data.totalStudents / ceiling) * 100}%`;
        document.getElementById('bar-summary-archived').style.height = `${(data.totalArchived / ceiling) * 100}%`;
        document.getElementById('bar-summary-eligible').style.height = `${(data.totalEligible / ceiling) * 100}%`;

    } catch (err) {
        console.error('Failed to load archival dashboard variables:', err);
    }
}

// F. CORE ARCHIVAL PROCESSING TABLE (archiving.html)
async function initArchivingRegistry() {
    const tableBody = document.getElementById('target-archive-rows');
    const template = document.getElementById('template-archive-row');
    if (!tableBody || !template) return;

    try {
        const response = await fetch(`${API_BASE_URL}/archive/registry`, { headers: AppState.getHeaders() });
        const data = await response.json();

        tableBody.innerHTML = '';

        data.students.forEach(student => {
            const clone = template.content.cloneNode(true);
            clone.querySelector('.col-student-id').textContent = student.studentId;
            clone.querySelector('.col-name').textContent = student.fullName;
            clone.querySelector('.col-course').textContent = student.course;
            clone.querySelector('.col-college').textContent = student.college;
            
            // Render Status Badges programmatically
            const statusTd = clone.querySelector('.col-status');
            statusTd.innerHTML = `<span class="status-badge ${student.statusClass}">${student.statusText}</span>`;
            
            clone.querySelector('.route-view-btn').addEventListener('click', () => {
                window.location.href = `archiving-view.html?id=${student.studentId}`;
            });

            tableBody.appendChild(clone);
        });

        document.getElementById('telemetry-ssd-used').textContent = `${data.hardware.usedGb} GB`;
        document.getElementById('telemetry-ssd-total').textContent = `${data.hardware.totalTb} TB`;
        document.getElementById('telemetry-encryption-status').textContent = data.hardware.engineStatus;

    } catch (err) {
        console.error('Error populating archival verification board:', err);
    }
}

// G. STUDENT AUDIT & OCR DRILLED VIEW (archiving-view.html)
async function initArchivingViewDrilldown() {
    const urlParams = new URLSearchParams(window.location.search);
    const studentId = urlParams.get('id');
    if (!studentId) return;

    try {
        const response = await fetch(`${API_BASE_URL}/archive/students/${studentId}`, { headers: AppState.getHeaders() });
        const studentData = await response.json();

        // Inject Single Entity Values into layout DOM anchors
        document.getElementById('val-audit-status').textContent = studentData.auditStatus;
        document.getElementById('val-student-id').textContent = studentData.studentId;
        document.getElementById('val-student-name').textContent = studentData.fullName;
        document.getElementById('val-course').textContent = studentData.course;
        document.getElementById('val-year').textContent = studentData.yearLevel || '--';
        
        const badge = document.getElementById('val-badge-status');
        badge.textContent = studentData.statusText;
        badge.className = `status-highlight ${studentData.statusClass}`;
        badge.style.display = 'inline-block';

        // Dynamic compliance checklist extraction using the template node
        const listContainer = document.getElementById('target-ocr-checklist');
        const checklistTemplate = document.getElementById('template-ocr-check-item');
        listContainer.innerHTML = '';

        studentData.documents.forEach(doc => {
            const liClone = checklistTemplate.content.cloneNode(true);
            liClone.querySelector('.check-title').textContent = doc.documentName;
            if (!doc.passedOcrVerification) {
                liClone.querySelector('.check-mark').textContent = '❌';
                liClone.querySelector('.check-mark').style.color = 'var(--red)';
            }
            listContainer.appendChild(liClone);
        });

        // Trigger action implementation hook for executing archival
        document.getElementById('action-archive-execute').onclick = async () => {
            const execBtn = document.getElementById('action-archive-execute');
            execBtn.disabled = true;
            execBtn.textContent = "Processing Vault Link...";

            const archiveRes = await fetch(`${API_BASE_URL}/archive/execute/${studentId}`, {
                method: 'POST',
                headers: AppState.getHeaders()
            });

            if (archiveRes.ok) {
                alert('Record securely encrypted and committed to main archive database system successfully.');
                window.location.href = 'archiving.html';
            } else {
                alert('Archival action failure. Review file tracking log parameters.');
                execBtn.disabled = false;
                execBtn.textContent = "EXECUTE ARCHIVAL";
            }
        };

    } catch (err) {
        console.error('Critical archival payload breakdown context:', err);
    }
}

// H. INFRASTRUCTURE TRACING & INTEGRITY LEDGER (system-integrity.html)
async function initSystemIntegrityEngine() {
    const tableBody = document.getElementById('target-integrity-rows');
    const template = document.getElementById('template-integrity-row');
    if (!tableBody || !template) return;

    try {
        const response = await fetch(`${API_BASE_URL}/integrity/logs`, { headers: AppState.getHeaders() });
        const logData = await response.json();

        document.getElementById('metric-integrity-validated').textContent = logData.totalFilesVerified;
        document.getElementById('metric-integrity-bitrot').textContent = logData.bitRotErrorsDetected;
        document.getElementById('metric-integrity-timestamp').textContent = logData.lastExecutionTime;

        tableBody.innerHTML = '';

        logData.runs.forEach(run => {
            const clone = template.content.cloneNode(true);
            clone.querySelector('.col-run-id').textContent = run.runId;
            clone.querySelector('.col-date').textContent = run.executionDate;
            clone.querySelector('.col-time').textContent = run.executionTime;
            clone.querySelector('.col-files-count').textContent = run.filesProcessedCount;
            clone.querySelector('.col-errors-count').textContent = run.errorsFound;
            
            // Programmatically define class based on checksum index ratios
            const scoreTd = clone.querySelector('.col-score-badge');
            let scoreClass = 'score-perfect';
            if (run.score < 85) scoreClass = 'score-alert';
            else if (run.score < 100) scoreClass = 'score-warning';

            scoreTd.innerHTML = `<span class="${scoreClass}">${run.score}%</span>`;
            tableBody.appendChild(clone);
        });

    } catch (err) {
        console.error('Error fetching integrity snapshot registries:', err);
    }
}
// ATTACH LOCK MUTATION EVENT LISTENERS
function enableFormLockToggles() {
    document.querySelectorAll('.field-lock-toggle').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const inputField = button.parentElement.querySelector('input, select');
            
            if (inputField.readOnly) {
                inputField.readOnly = false;
                button.textContent = "🔓";
                inputField.style.borderColor = "var(--blue-accent)";
                inputField.focus();
            } else {
                inputField.readOnly = true;
                button.textContent = "🔒";
                inputField.style.borderColor = "var(--card-border)";
            }
        });
    });
}

// Automatically invoke function across view initializations
if (document.getElementById('form-admission-record') || document.getElementById('form-profiling-record')) {
    enableFormLockToggles();
}