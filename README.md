# Registrar Office Archiving System - Web Dashboard Frontend

## Overview
This is the Web Dashboard Frontend for the Registrar Office Document Scanner and Archiving System. It is built using HTML, CSS, and Vanilla JavaScript to provide an administrative interface for registrar staff and administrators to manage student records, document requests, system integrity, and archival processes.

## 🚀 Key Features

*   **Staff/Admin Authentication:** Secure login interface connecting to the backend API.
*   **Dashboard:** High-level statistics on admissions, requests, and archival status.
*   **Admissions & Profiling Management:** View and manage student demographic profiles and their linked documents.
*   **Document Request Handling:** Monitor and fulfill student document requests (urgent and standard).
*   **Archiving System (Admin):**
    *   View archival registry and eligibility status.
    *   Execute manual archival for graduated/dropped students.
    *   Monitor system integrity, storage capacity, and encryption status.
    *   Review weekly Bit-rot protection integrity logs.

## ⚙️ Configuration

The frontend communicates with the backend API. The integration logic is primarily located in `app-integration.js`.

Ensure the API base URL in `app-integration.js` or the respective configuration files matches your backend environment (local IP for development or the Azure production URL).

---

## 🎬 10-30 Minute Demo & Code Explanation Script

This script provides a structured flow for demonstrating the web dashboard's capabilities, focusing on the UI/UX, API integration, and key administrative workflows.

### Part 1: Introduction & Authentication (3-5 Minutes)

*   **Objective:** Introduce the dashboard's purpose and show the login process.
*   **Talking Points:**
    *   *Welcome:* "This is the web dashboard for Registrar Staff and Administrators. It provides a comprehensive view of the system's data and workflows."
    *   *Login (`login.html`):* "The entry point is a secure login screen. We use stateless JWT tokens provided by the backend."
    *   *Code Walkthrough (`app-integration.js` - Login):*
        *   Explain how the login form captures the `staff_id` and `password`.
        *   Show the `fetch` call to the `/api/v1/staff/login` endpoint.
        *   Explain how the returned `access_token` and `role` are stored in `localStorage` or `sessionStorage` to maintain the user's session across pages.

### Part 2: Dashboard Overview & Request Management (5-8 Minutes)

*   **Objective:** Show the high-level metrics and how staff fulfill student document requests.
*   **Talking Points:**
    *   *Dashboard (`dashboard.html`):* "Upon login, staff see key metrics fetched from the `/api/v1/dashboard/stats` endpoint: Pending Requests, Total Admissions, and System Health."
    *   *Document Requests:* Navigate to the requests view. "Here we see a list of student requests, highlighted if they are urgent."
    *   *Code Walkthrough (Fetching Requests):*
        *   Show the function that calls `/api/v1/requests`. Note the inclusion of the `Authorization: Bearer <token>` header.
        *   Explain how the UI dynamically renders the table rows based on the JSON response.
    *   *Fulfilling a Request:* Explain the UI flow for fulfilling a request (e.g., clicking a 'Fulfill' button, linking an uploaded document). Show the API call to `/api/v1/requests/{id}/fulfill`.

### Part 3: Profiling & Admissions (4-6 Minutes)

*   **Objective:** Demonstrate how staff view encrypted student data and manage digital surrogates.
*   **Talking Points:**
    *   *Profiling View (`admission-view.html` / `archiving-view.html`):* Navigate to a student's profile.
    *   "This view pulls data from `/api/v1/profiles/{id}` or `/api/v1/admissions/{id}`. Notice how the PII (Name, Address, Birthdate) is displayed seamlessly; the backend handles the decryption transparently."
    *   *Document Management:* Show the list of documents linked to the student. Explain that these are the 'Digital Surrogates' uploaded via the mobile app or web interface.
    *   *Preview/Download:* Mention that staff can preview (if supported) or download the documents via the respective backend endpoints.

### Part 4: Archiving System & Integrity Monitoring (Admin Only) (5-8 Minutes)

*   **Objective:** Highlight the critical archival and system health features reserved for Administrators.
*   **Talking Points:**
    *   *Archiving Dashboard (`archiving-dashboard.html`):* "This section is crucial for data lifecycle management and is restricted to Admin roles."
    *   "The summary shows storage usage, encryption engine status, and the number of students eligible for archiving."
    *   *Archival Registry (`archiving-university-registry.html`):* Show the list of students. Explain that only 'Graduated' or 'Dropped' students are 'Eligible' for archiving.
    *   *Execution:* Explain the UI action to trigger archival (calling `POST /api/v1/archive/execute/{id}`). Emphasize that this moves documents to encrypted cold storage.
    *   *System Integrity (`archiving-system-integrity.html`):* "This is our Bit-rot protection dashboard."
    *   *Code Walkthrough (Integrity Logs):* Show the API call to `/api/v1/integrity/logs`. Explain how the UI renders the history of weekly integrity runs, highlighting the 'Score' and any detected errors (checksum mismatches).

### Part 5: Q&A and Wrap-up (2-3 Minutes)

*   **Summary:** "The web dashboard provides a robust, role-based interface for managing the entire document lifecycle, from admission to immutable archival, relying on the secure backend API for all data operations."