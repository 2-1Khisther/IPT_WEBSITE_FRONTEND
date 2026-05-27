/**
 * UEP REGISTRAR APPLICATION SUITE - BACKEND INTEGRATION ENGINE
 * Architecture: REST API-First via Native Asynchronous Fetch & JWT Auth
 */

// 1. GLOBAL CONFIGURATION & STATE MANAGEMENT
const API_URLS = {
    production: 'https://registrar-office-api.eastasia.cloudapp.azure.com/api/v1',
    local: 'http://127.0.0.1:8000/api/v1'
};

function safeLocalStorageGet(key) {
    try {
        return window.localStorage.getItem(key);
    } catch (error) {
        return null;
    }
}

function safeLocalStorageSet(key, value) {
    try {
        window.localStorage.setItem(key, value);
        return true;
    } catch (error) {
        return false;
    }
}

function safeLocalStorageRemove(key) {
    try {
        window.localStorage.removeItem(key);
    } catch (error) {
        // Storage may be unavailable in private or locked-down browser contexts.
    }
}

const API_BASE_URL = window.UEP_API_BASE_URL
    || safeLocalStorageGet('uep_api_base_url')
    || API_URLS.production;

const AUTH_TOKEN_KEY = 'uep_registrar_jwt';
const AUTH_ROLE_KEY = 'uep_registrar_role';
const STAFF_PORTAL_ROLES = ['staff', 'admin'];
const STAFF_DEFAULT_PAGE = 'dashboard.html';
const ADMIN_DEFAULT_PAGE = 'selection.html';
const ADMIN_ONLY_PAGES = [
    'selection.html',
    'archiving-dashboard.html',
    'archiving.html',
    'archiving-university-registry.html',
    'archiving-view.html',
    'archiving-system-integrity.html'
];

function getCurrentPageName() {
    const pathName = window.location.pathname.split('/').pop();
    return pathName || 'login_page.html';
}

function isLoginPage() {
    return getCurrentPageName() === 'login_page.html';
}

function redirectToLogin() {
    if (!isLoginPage()) {
        window.location.replace('login_page.html');
    }
}

function getLandingPageForRole(role) {
    if (role === 'admin') {
        return ADMIN_DEFAULT_PAGE;
    }

    if (role === 'staff') {
        return STAFF_DEFAULT_PAGE;
    }

    return 'login_page.html';
}

function getAllowedRolesForCurrentPage() {
    const pageName = getCurrentPageName();

    if (pageName === 'login_page.html') {
        return null;
    }

    if (ADMIN_ONLY_PAGES.includes(pageName)) {
        return ['admin'];
    }

    return STAFF_PORTAL_ROLES;
}

const AppState = {
    getBearerToken: () => safeLocalStorageGet(AUTH_TOKEN_KEY),
    getUserRole: () => safeLocalStorageGet(AUTH_ROLE_KEY),
    setAuth: (token, role) => {
        if (!safeLocalStorageSet(AUTH_TOKEN_KEY, token) || !safeLocalStorageSet(AUTH_ROLE_KEY, role)) {
            throw new Error('Browser storage is unavailable. Enable local storage to continue.');
        }
    },
    clearAuth: () => {
        safeLocalStorageRemove(AUTH_TOKEN_KEY);
        safeLocalStorageRemove(AUTH_ROLE_KEY);
        redirectToLogin();
    },
    // Safely handles network headers with Authorization Interceptors
    getHeaders: () => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AppState.getBearerToken()}`
    })
};

function userCanAccessCurrentPage() {
    const allowedRoles = getAllowedRolesForCurrentPage();

    if (!allowedRoles) {
        return true;
    }

    const token = AppState.getBearerToken();
    const role = AppState.getUserRole();

    return Boolean(token) && allowedRoles.includes(role);
}

function enforceRouteGuard() {
    const token = AppState.getBearerToken();
    const role = AppState.getUserRole();
    const allowedRoles = getAllowedRolesForCurrentPage();

    // If we are on the login page (allowedRoles is null)
    if (!allowedRoles) {
        // If user is already authenticated with a valid role, skip login
        if (token && role && STAFF_PORTAL_ROLES.includes(role)) {
            window.location.replace(getLandingPageForRole(role));
            return false;
        }
        return true;
    }

    // If we are on a protected page but have no token
    if (!token) {
        AppState.clearAuth();
        return false;
    }

    // If we have a token but the role is not allowed for this page
    if (!allowedRoles.includes(role)) {
        alert('Access Denied: You do not have the required permissions to access this module.');
        window.location.replace(getLandingPageForRole(role));
        return false;
    }

    return true;
}

function syncSidebarActions() {
    const role = AppState.getUserRole();

    document.querySelectorAll('[data-admin-only="true"]').forEach((element) => {
        element.hidden = role !== 'admin';
    });
}

function installAuthorizationFetchInterceptor() {
    const nativeFetch = window.fetch.bind(window);

    window.fetch = async (...args) => {
        const response = await nativeFetch(...args);

        if ((response.status === 401 || response.status === 403) && !isLoginPage()) {
            AppState.clearAuth();
        }

        return response;
    };
}

installAuthorizationFetchInterceptor();

async function parseApiResponse(response) {
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        const error = new Error(payload.message || 'Request failed.');
        error.status = response.status;
        error.payload = payload;
        throw error;
    }

    return payload;
}

function getResponseData(payload) {
    if (payload && Object.prototype.hasOwnProperty.call(payload, 'data')) {
        return payload.data || {};
    }

    return payload || {};
}

function handleApiError(error) {
    if (error.status === 401 || error.status === 403) {
        AppState.clearAuth();
    }

    console.error(error);
}

function requireDashboardCount(stats, key) {
    if (!Object.prototype.hasOwnProperty.call(stats, key)) {
        throw new Error(`Dashboard response missing ${key}.`);
    }

    const count = Number(stats[key]);

    if (!Number.isInteger(count) || count < 0) {
        throw new Error(`Dashboard response has invalid ${key}.`);
    }

    return count;
}

function renderYAxisLabels(peakValue) {
    const max = Math.max(5, Math.ceil(peakValue));

    document.querySelectorAll('.chart-card .y-axis').forEach((axis) => {
        const labels = axis.querySelectorAll('span');
        labels.forEach((label, index) => {
            if (index === labels.length - 1) {
                label.textContent = '0';
                return;
            }

            label.textContent = Math.ceil(max * ((labels.length - 1 - index) / (labels.length - 1)));
        });
    });
}

function setNoDataLabels(hasData) {
    ['msg-chart-requests-nodata', 'msg-chart-modules-nodata'].forEach((id) => {
        const label = document.getElementById(id);
        if (label) {
            label.style.display = hasData ? 'none' : 'block';
        }
    });
}

// 2. ROUTER & ROUTE ENGINE INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    const currentPage = getCurrentPageName();

    // Route guards: Force unauthenticated or unauthorized users back to login.
    if (!enforceRouteGuard()) {
        return;
    }

    syncSidebarActions();

    // Initialize module controllers depending on which page the browser is viewing
    if (currentPage === 'login_page.html') {
        initLoginController();
    } else if (currentPage === 'monitoring.html' || currentPage === 'dashboard.html') {
        initSystemMonitoringDashboard();
    } else if (currentPage === 'admission.html') {
        initAdmissionModule();
    } else if (currentPage === 'profiling.html') {
        initProfilingModule();
    } else if (currentPage === 'admission-view.html') {
        initAdmissionViewModule();
    } else if (currentPage === 'profiling-view.html') {
        initProfilingViewModule();
    } else if (currentPage === 'requests.html') {
        initRequestModule();
    } else if (currentPage === 'request-view.html') {
        initRequestViewModule();
    } else if (currentPage === 'archiving-dashboard.html') {
        initArchivingDashboard();
    } else if (currentPage === 'archiving.html' || currentPage === 'archiving-university-registry.html') {
        initArchivingRegistry();
    } else if (currentPage === 'archiving-view.html') {
        initArchivingViewDrilldown();
    } else if (currentPage === 'archiving-system-integrity.html') {
        initSystemIntegrityEngine();
    }

    // Attach global logout hooks across all active viewports
    const logoutButtons = document.querySelectorAll('[data-action="logout"], #action-logout-trigger');
    logoutButtons.forEach((logoutBtn) => {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            AppState.clearAuth();
        });
    });
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

            const response = await fetch(`${API_BASE_URL}/staff/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ staff_id: usernameInput, password: passwordInput })
            });

            const payload = await parseApiResponse(response);
            const token = payload.data && payload.data.access_token;
            const role = payload.data && payload.data.role;

            if (!token) {
                throw new Error('Login response did not include an access token.');
            }

            if (!STAFF_PORTAL_ROLES.includes(role)) {
                throw new Error('This account is not authorized to access the registrar admin portal.');
            }

            AppState.setAuth(token, role); // Secure token storage mapping
            
            // Send admins to subsystem selection and staff directly to their only module.
            window.location.href = getLandingPageForRole(role);
        } catch (err) {
            AppState.clearAuth();
            alert(`Authentication Error: ${err.message}`);
            submitBtn.textContent = "Login";
            submitBtn.disabled = false;
        }
    });
}

// B. SYSTEM MONITORING SUITE (monitoring.html / dashboard.html)
async function initSystemMonitoringDashboard() {
    try {
        const response = await fetch(`${API_BASE_URL}/dashboard/stats`, {
            headers: AppState.getHeaders()
        });
        const payload = await parseApiResponse(response);
        const stats = payload.data || {};
        const pendingRequests = requireDashboardCount(stats, 'pending_requests');
        const urgentRequests = requireDashboardCount(stats, 'urgent_requests');
        const archivedStudents = requireDashboardCount(stats, 'archived_students');
        const totalAdmissions = requireDashboardCount(stats, 'total_admissions');
        const totalProfiles = requireDashboardCount(stats, 'total_profiles');
        const hasDashboardData = (pendingRequests + urgentRequests + archivedStudents) > 0;

        // Target and map dynamic card stats
        const elements = {
            students: document.getElementById('monitor-metric-students') || document.getElementById('core-metric-students'),
            admissions: document.getElementById('monitor-metric-admissions') || document.getElementById('core-metric-admissions'),
            profiling: document.getElementById('monitor-metric-profiling') || document.getElementById('core-metric-profiling'),
            requests: document.getElementById('monitor-metric-requests') || document.getElementById('core-metric-requests')
        };

        if (elements.students) elements.students.textContent = archivedStudents;
        if (elements.admissions) elements.admissions.textContent = totalAdmissions;
        if (elements.profiling) elements.profiling.textContent = totalProfiles;
        if (elements.requests) elements.requests.textContent = pendingRequests;

        // Render dynamic heights for native CSS bar charts based on peak values
        const peakValue = Math.max(archivedStudents, totalAdmissions, pendingRequests, 1);
        renderYAxisLabels(peakValue);
        setNoDataLabels(hasDashboardData);
        
        const barClaimed = document.getElementById('monitor-bar-claimed') || document.getElementById('dom-bar-claimed');
        const barRelease = document.getElementById('monitor-bar-release') || document.getElementById('dom-bar-release');
        const barPending = document.getElementById('monitor-bar-pending') || document.getElementById('dom-bar-pending');

        if (barClaimed) barClaimed.style.height = `${(archivedStudents / peakValue) * 100}%`;
        if (barRelease) barRelease.style.height = `${(totalAdmissions / peakValue) * 100}%`;
        if (barPending) barPending.style.height = `${(pendingRequests / peakValue) * 100}%`;

        const barAdmission = document.getElementById('dom-bar-admission');
        const barProfiling = document.getElementById('dom-bar-profiling');
        const barRequests = document.getElementById('dom-bar-requests');
        if (barAdmission) barAdmission.style.height = `${(totalAdmissions / peakValue) * 100}%`;
        if (barProfiling) barProfiling.style.height = `${(totalProfiles / peakValue) * 100}%`;
        if (barRequests) barRequests.style.height = `${(pendingRequests / peakValue) * 100}%`;

    } catch (err) {
        handleApiError(err);
    }
}

// C. ADMISSION DATABASE RENDERING (admission.html)
async function initAdmissionModule() {
    const tableBody = document.getElementById('target-admission-rows');
    const template = document.getElementById('template-admission-row');
    if (!tableBody || !template) return;

    try {
        const response = await fetch(`${API_BASE_URL}/admissions`, { headers: AppState.getHeaders() });
        const payload = await parseApiResponse(response);
        const admissions = payload.data || [];

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
        handleApiError(err);
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
        const payload = await parseApiResponse(response);
        const profiles = payload.data || [];

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
        handleApiError(err);
        console.error('Failed to populate profiling rows:', err);
    }
}

// D2. ADMISSION DETAIL VIEW (admission-view.html)
async function initAdmissionViewModule() {
    const urlParams = new URLSearchParams(window.location.search);
    const admissionId = urlParams.get('id');
    if (!admissionId) return;

    try {
        const response = await fetch(`${API_BASE_URL}/admissions/${admissionId}`, { headers: AppState.getHeaders() });
        const payload = await parseApiResponse(response);
        const data = payload.data;

        document.getElementById('field-admission-no').value = data.admissionNo;
        document.getElementById('field-first-name').value = data.firstName;
        document.getElementById('field-middle-name').value = data.middleName;
        document.getElementById('field-last-name').value = data.lastName;
        document.getElementById('field-dob').value = data.dob;
        document.getElementById('field-pob').value = data.pob;
        document.getElementById('field-address').value = data.address;
        document.getElementById('field-email').value = data.email;
        document.getElementById('field-year-graduated').value = data.yearGraduated;

        const attachmentContainer = document.getElementById('container-admission-attachments');
        const attachmentTemplate = document.getElementById('template-attachment-item');
        attachmentContainer.innerHTML = '';

        data.documents.forEach(doc => {
            const clone = attachmentTemplate.content.cloneNode(true);
            clone.querySelector('.file-name').textContent = doc.name;
            attachmentContainer.appendChild(clone);
        });

    } catch (err) {
        handleApiError(err);
        console.error('Failed to load admission detail:', err);
    }
}

// D3. PROFILING DETAIL VIEW (profiling-view.html)
async function initProfilingViewModule() {
    const urlParams = new URLSearchParams(window.location.search);
    const studentId = urlParams.get('id');
    if (!studentId) return;

    try {
        const response = await fetch(`${API_BASE_URL}/profiles/${studentId}`, { headers: AppState.getHeaders() });
        const payload = await parseApiResponse(response);
        const data = payload.data;

        document.getElementById('field-prof-id').value = data.studentId;
        document.getElementById('field-prof-firstname').value = data.firstName;
        document.getElementById('field-prof-middlename').value = data.middleName;
        document.getElementById('field-prof-lastname').value = data.lastName;

        const tableBody = document.getElementById('target-profile-attachments');
        const template = document.getElementById('template-profile-file-row');
        tableBody.innerHTML = '';

        data.documents.forEach(doc => {
            const clone = template.content.cloneNode(true);
            clone.querySelector('.file-id').textContent = doc.id;
            clone.querySelector('.file-name').textContent = doc.name;
            clone.querySelector('.file-type').textContent = doc.type;
            tableBody.appendChild(clone);
        });

    } catch (err) {
        handleApiError(err);
        console.error('Failed to load profiling detail:', err);
    }
}

// D4. REQUESTS LISTING (requests.html)
async function initRequestModule() {
    const tableBody = document.getElementById('target-request-rows');
    const template = document.getElementById('template-request-row');
    if (!tableBody || !template) return;

    try {
        const response = await fetch(`${API_BASE_URL}/requests`, { headers: AppState.getHeaders() });
        const payload = await parseApiResponse(response);
        const requests = payload.data || [];

        tableBody.innerHTML = '';

        requests.forEach(record => {
            const clone = template.content.cloneNode(true);
            clone.querySelector('.col-student-id').textContent = record.studentId;
            clone.querySelector('.col-name').textContent = record.fullName;
            clone.querySelector('.col-date').textContent = record.dateRequested;
            
            const statusTd = clone.querySelector('.col-status');
            let statusClass = 'status-pending';
            if (record.status === 'URGENT') statusClass = 'status-urgent';
            else if (record.status === 'DONE') statusClass = 'status-archived';
            
            statusTd.innerHTML = `<span class="status-badge ${statusClass}">${record.status}</span>`;
            
            clone.querySelector('.route-view-btn').addEventListener('click', () => {
                window.location.href = `request-view.html?id=${record.studentId}`;
            });

            tableBody.appendChild(clone);
        });

        document.getElementById('txt-request-pagination').textContent = `1-${requests.length} of ${requests.length}`;
    } catch (err) {
        handleApiError(err);
        console.error('Failed to populate request table:', err);
    }
}

// D5. REQUEST DETAIL VIEW (request-view.html)
async function initRequestViewModule() {
    const urlParams = new URLSearchParams(window.location.search);
    const studentId = urlParams.get('id');
    if (!studentId) return;

    try {
        const response = await fetch(`${API_BASE_URL}/requests/${studentId}`, { headers: AppState.getHeaders() });
        const payload = await parseApiResponse(response);
        const data = payload.data;

        document.getElementById('req-view-id').textContent = data.studentId;
        document.getElementById('req-view-name').textContent = data.fullName;
        document.getElementById('req-view-course').textContent = data.course;
        document.getElementById('req-view-year').textContent = data.yearLevel;

        const tableBody = document.getElementById('target-request-items');
        const template = document.getElementById('template-request-item-row');
        tableBody.innerHTML = '';

        data.items.forEach(item => {
            const clone = template.content.cloneNode(true);
            clone.querySelector('.item-id').textContent = item.id;
            clone.querySelector('.item-name').textContent = item.document;
            clone.querySelector('.item-qty').textContent = item.quantity;
            tableBody.appendChild(clone);
        });

    } catch (err) {
        handleApiError(err);
        console.error('Failed to load request detail:', err);
    }
}

// E. ARCHIVING ANALYTICAL DASHBOARD ENGINE (archiving-dashboard.html)
async function initArchivingDashboard() {
    try {
        const response = await fetch(`${API_BASE_URL}/archive/dashboard-summary`, { headers: AppState.getHeaders() });
        const payload = await parseApiResponse(response);
        const data = getResponseData(payload);

        document.getElementById('metric-summary-students').textContent = data.totalStudents || 0;
        document.getElementById('metric-summary-archived').textContent = data.totalArchived || 0;
        document.getElementById('metric-summary-eligible').textContent = data.totalEligible || 0;

        document.getElementById('metric-telemetry-used').textContent = `${data.storageUsedGb || 0} GB`;
        document.getElementById('metric-telemetry-total').textContent = `${data.storageTotalTb || 0} TB`;
        document.getElementById('metric-telemetry-encryption').textContent = data.encryptionStatus || 'N/A';
        document.getElementById('metric-telemetry-checksum').textContent = data.lastChecksumRun || 'Never';

        // Animate Archiving Chart Column Bars
        const ceiling = Math.max(data.totalStudents || 0, data.totalArchived || 0, data.totalEligible || 0, 1);
        document.getElementById('bar-summary-students').style.height = `${((data.totalStudents || 0) / ceiling) * 100}%`;
        document.getElementById('bar-summary-archived').style.height = `${((data.totalArchived || 0) / ceiling) * 100}%`;
        document.getElementById('bar-summary-eligible').style.height = `${((data.totalEligible || 0) / ceiling) * 100}%`;

    } catch (err) {
        handleApiError(err);
        console.error('Failed to load archival dashboard variables:', err);
    }
}

// F. CORE ARCHIVAL PROCESSING TABLE (archiving.html)
async function initArchivingRegistry() {
    const tableBody = document.getElementById('target-archive-rows') || document.getElementById('target-registry-rows');
    const template = document.getElementById('template-archive-row') || document.getElementById('template-registry-row');
    if (!tableBody || !template) return;

    try {
        const response = await fetch(`${API_BASE_URL}/archive/registry`, { headers: AppState.getHeaders() });
        const payload = await parseApiResponse(response);
        const data = getResponseData(payload);
        const students = data.students || [];
        const hardware = data.hardware || {};
        const isUniversityRegistry = Boolean(document.getElementById('target-registry-rows'));

        tableBody.innerHTML = '';

        students.forEach(student => {
            const clone = template.content.cloneNode(true);
            clone.querySelector('.col-student-id').textContent = student.studentId;
            clone.querySelector('.col-name').textContent = student.fullName;
            clone.querySelector('.col-course').textContent = student.course;
            clone.querySelector('.col-college').textContent = student.college;
            const yearLevelCell = clone.querySelector('.col-year-level');
            if (yearLevelCell) yearLevelCell.textContent = student.yearLevel || 'N/A';

            const enrollmentStatusCell = clone.querySelector('.col-enrollment-status');
            if (enrollmentStatusCell) {
                enrollmentStatusCell.innerHTML = `<span class="status-badge ${student.statusClass || 'status-pending'}">${student.enrollmentStatus || student.statusText || 'ACTIVE'}</span>`;
            }

            const statusTd = clone.querySelector('.col-status');
            if (statusTd) {
                statusTd.innerHTML = `<span class="status-badge ${student.statusClass || 'status-pending'}">${student.statusText || 'ACTIVE'}</span>`;
            }

            const viewButton = clone.querySelector('.route-view-btn, .action-view-student');
            if (viewButton) viewButton.addEventListener('click', () => {
                window.location.href = `archiving-view.html?id=${student.studentId}`;
            });

            tableBody.appendChild(clone);
        });

        if (isUniversityRegistry) {
            document.getElementById('txt-registry-pagination').textContent = students.length ? `1-${students.length} of ${students.length}` : '0-0 of 0';
        } else {
            document.getElementById('txt-archive-pagination').textContent = students.length ? `1-${students.length} of ${students.length}` : '0-0 of 0';
            document.getElementById('telemetry-ssd-used').textContent = `${hardware.usedGb || 0} GB`;
            document.getElementById('telemetry-ssd-total').textContent = `${hardware.totalTb || 0} TB`;
            document.getElementById('telemetry-encryption-status').textContent = hardware.engineStatus || 'N/A';
        }

    } catch (err) {
        handleApiError(err);
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
        const payload = await parseApiResponse(response);
        const studentData = getResponseData(payload);

        // Inject Single Entity Values into layout DOM anchors
        document.getElementById('val-audit-status').textContent = studentData.auditStatus || 'N/A';
        document.getElementById('val-student-id').textContent = studentData.studentId || 'N/A';
        document.getElementById('val-student-name').textContent = studentData.fullName || 'N/A';
        document.getElementById('val-course').textContent = studentData.course || 'N/A';
        document.getElementById('val-year').textContent = studentData.yearLevel || '--';
        
        const badge = document.getElementById('val-badge-status');
        if (badge) {
            badge.textContent = studentData.statusText || 'Unknown';
            badge.className = `status-highlight ${studentData.statusClass || ''}`;
            badge.style.display = 'inline-block';
        }

        // Dynamic compliance checklist extraction using the template node
        const listContainer = document.getElementById('target-ocr-checklist');
        const checklistTemplate = document.getElementById('template-ocr-check-item');
        if (listContainer && checklistTemplate) {
            listContainer.innerHTML = '';
            const documents = studentData.documents || [];

            documents.forEach(doc => {
                const liClone = checklistTemplate.content.cloneNode(true);
                liClone.querySelector('.check-title').textContent = doc.documentName;
                if (!doc.passedOcrVerification) {
                    liClone.querySelector('.check-mark').textContent = '❌';
                    liClone.querySelector('.check-mark').style.color = 'var(--red)';
                }
                listContainer.appendChild(liClone);
            });
        }

        // Trigger action implementation hook for executing archival
        const archiveBtn = document.getElementById('action-archive-execute');
        if (archiveBtn) {
            archiveBtn.onclick = async () => {
                archiveBtn.disabled = true;
                archiveBtn.textContent = "Processing Vault Link...";

                try {
                    const archiveRes = await fetch(`${API_BASE_URL}/archive/execute/${studentId}`, {
                        method: 'POST',
                        headers: AppState.getHeaders()
                    });

                    if (archiveRes.ok) {
                        alert('Record securely encrypted and committed to main archive database system successfully.');
                        window.location.href = 'archiving.html';
                    } else {
                        const errPayload = await archiveRes.json().catch(() => ({}));
                        alert(`Archival action failure: ${errPayload.message || 'Review file tracking log parameters.'}`);
                        archiveBtn.disabled = false;
                        archiveBtn.textContent = "EXECUTE ARCHIVAL";
                    }
                } catch (err) {
                    alert(`Network Error: ${err.message}`);
                    archiveBtn.disabled = false;
                    archiveBtn.textContent = "EXECUTE ARCHIVAL";
                }
            };
        }

    } catch (err) {
        handleApiError(err);
        console.error('Critical archival payload breakdown context:', err);
    }
}

// H. INFRASTRUCTURE TRACING & INTEGRITY LEDGER (system-integrity.html)
async function initSystemIntegrityEngine() {
    const tableBody = document.getElementById('target-integrity-rows');
    const template = document.getElementById('template-integrity-row');
    if (!tableBody || !template) return;

    try {
        const logData = await fetchIntegrityLogData();
        renderIntegrityLogData(logData, tableBody, template);

    } catch (err) {
        handleApiError(err);
        console.error('Error fetching integrity snapshot registries:', err);
    }
}

async function fetchIntegrityLogData() {
    const response = await fetch(`${API_BASE_URL}/integrity/logs`, { headers: AppState.getHeaders() });

    if (response.status !== 404) {
        const payload = await parseApiResponse(response);
        return getResponseData(payload);
    }

    const summaryResponse = await fetch(`${API_BASE_URL}/archive/dashboard-summary`, { headers: AppState.getHeaders() });
    const summaryPayload = await parseApiResponse(summaryResponse);
    const summary = getResponseData(summaryPayload);

    return {
        totalFilesVerified: 0,
        bitRotErrorsDetected: 0,
        lastExecutionTime: summary.lastChecksumRun || 'No runs yet',
        runs: []
    };
}

function renderIntegrityLogData(logData, tableBody, template) {
    document.getElementById('metric-integrity-validated').textContent = logData.totalFilesVerified || 0;
    document.getElementById('metric-integrity-bitrot').textContent = logData.bitRotErrorsDetected || 0;
    document.getElementById('metric-integrity-timestamp').textContent = logData.lastExecutionTime || 'N/A';

    tableBody.innerHTML = '';
    const runs = logData.runs || [];

    runs.forEach(run => {
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
