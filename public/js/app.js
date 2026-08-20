/**
 * Client Application Logic - Hall Booking Management System (Commercial ERP Core)
 */

function initApp() {
    // --- Application State ---
    let currentRole = 'Admin'; // 'Admin' | 'Staff'
    let currentUser = null; // Stored user profile from DB authentication
    let isAdminSession = false; // Flag to indicate if authentic user is Admin
    let currentView = 'dashboard';
    let editBookingId = null;

    const STORAGE_SESSION_KEY = 'hall_auth_session_v2';

    // Helper functions for Session Persistence
    function getStoredSession() {
        try {
            const raw = sessionStorage.getItem(STORAGE_SESSION_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.user && parsed.user.username) {
                    return parsed;
                }
            }
        } catch(e) {}
        return null;
    }

    function saveStoredSession(user, token) {
        try {
            sessionStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify({ user, token }));
        } catch(e) {}
    }

    function clearStoredSession() {
        try {
            sessionStorage.removeItem(STORAGE_SESSION_KEY);
            sessionStorage.removeItem('hall_user_role');
            sessionStorage.removeItem('hall_user_profile');
        } catch(e) {}
        currentUser = null;
        isAdminSession = false;
    }

    // Bootstrap Modal Instances
    const bookingModal = new bootstrap.Modal(document.getElementById('bookingModal'));
    const viewBookingModal = new bootstrap.Modal(document.getElementById('viewBookingModal'));
    const deleteModal = new bootstrap.Modal(document.getElementById('deleteModal'));
    const extraChargeModal = new bootstrap.Modal(document.getElementById('extraChargeModal'));
    const discountModal = new bootstrap.Modal(document.getElementById('discountModal'));
    const paymentModal = new bootstrap.Modal(document.getElementById('paymentModal'));
    const depositActionModal = new bootstrap.Modal(document.getElementById('depositActionModal'));
    const voidModal = new bootstrap.Modal(document.getElementById('voidModal'));
    const receiptModal = new bootstrap.Modal(document.getElementById('receiptModal'));
    const yearLedgerModal = new bootstrap.Modal(document.getElementById('yearLedgerModal'));
    const facultyEventModal = document.getElementById('facultyEventModal') ? new bootstrap.Modal(document.getElementById('facultyEventModal')) : null;
    const liveToast = new bootstrap.Toast(document.getElementById('liveToast'));

    // DOM Elements - Auth Screen
    const authView = document.getElementById('auth-view');
    const appWrapper = document.getElementById('wrapper');
    const mainLoginForm = document.getElementById('mainLoginForm');
    const authErrorAlert = document.getElementById('auth-error-alert');
    const authErrorMessage = document.getElementById('auth-error-message');
    const authPortalBadge = document.getElementById('auth-portal-badge');
    const authSwitchPrompt = document.getElementById('auth-switch-prompt');
    const btnAuthSubmit = document.getElementById('btn-auth-submit');
    const btnAuthSubmitText = document.getElementById('btn-auth-submit-text');
    const authSubmitSpinner = document.getElementById('auth-submit-spinner');
    const btnTogglePassword = document.getElementById('btn-toggle-password');
    const iconTogglePassword = document.getElementById('icon-toggle-password');
    const authInputPassword = document.getElementById('auth-input-password');
    const authInputUsername = document.getElementById('auth-input-username');

    // DOM Elements - App Topbar & Navigation
    const sidebarWrapper = document.getElementById('sidebar-wrapper');
    const menuToggle = document.getElementById('menu-toggle');
    const currentUserNameEl = document.getElementById('current-user-name');
    const currentRoleLabel = document.getElementById('current-role-label');
    const sidebarRoleBadge = document.getElementById('sidebar-role-badge');
    const routeIndicatorBadge = document.getElementById('route-indicator-badge');
    const adminNavGroup = document.getElementById('admin-nav-group');
    const staffNavGroup = document.getElementById('staff-nav-group');
    const facultyBanner = document.getElementById('faculty-notice-banner');
    const navAddBtn = document.getElementById('btn-add-booking-nav');
    const btnSwitchToStaff = document.getElementById('btn-switch-to-staff');
    const btnReturnToAdmin = document.getElementById('btn-return-to-admin');
    const btnLogout = document.getElementById('btn-logout');

    // =========================================================================
    // AUTOMATIC AUTHENTICATED FETCH WRAPPER
    // =========================================================================
    const originalFetch = window.fetch.bind(window);
    window.fetch = async function (resource, init = {}) {
        const customInit = { ...init };
        const headers = customInit.headers ? { ...(customInit.headers instanceof Headers ? Object.fromEntries(customInit.headers.entries()) : customInit.headers) } : {};
        headers['x-user-role'] = currentRole;
        if (currentUser && currentUser.username) {
            headers['x-auth-user'] = currentUser.username;
        }
        const session = getStoredSession();
        if (session && session.token) {
            headers['Authorization'] = `Bearer ${session.token}`;
        }
        customInit.headers = headers;

        const response = await originalFetch(resource, customInit);
        if (response.status === 401 && !resource.toString().includes('/api/auth/login')) {
            clearStoredSession();
            showAuthScreen();
            showToast('Session expired. Please log in again.');
        }
        return response;
    };

    // Default Date Helpers (Local YYYY-MM-DD string)
    const getTodayDateString = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Set Initial Date in Filter inputs
    if (document.getElementById('avail-date-picker')) {
        document.getElementById('avail-date-picker').value = getTodayDateString();
    }
    if (document.getElementById('day-slots-date-picker')) {
        document.getElementById('day-slots-date-picker').value = getTodayDateString();
    }
    if (document.getElementById('fac-date-picker')) {
        document.getElementById('fac-date-picker').value = getTodayDateString();
    }

    // =========================================================================
    // 1. PORTAL ROUTING & AUTHENTICATION GATE
    // =========================================================================
    function getRequestedPortal() {
        const currentPath = (window.location.pathname || '').toLowerCase();
        const currentHash = (window.location.hash || '').toLowerCase();
        if (currentPath.includes('/staff') || currentPath.includes('/faculty') || currentHash.includes('staff') || currentHash.includes('faculty')) {
            return 'Staff';
        }
        return 'Admin';
    }

    function showAuthScreen(portal = null) {
        const targetPortal = portal || getRequestedPortal();
        if (appWrapper) appWrapper.classList.add('d-none');
        if (authView) authView.classList.remove('d-none');

        if (authErrorAlert) authErrorAlert.classList.add('d-none');
        if (authInputPassword) authInputPassword.value = '';

        if (targetPortal === 'Staff') {
            if (authPortalBadge) {
                authPortalBadge.innerHTML = '<i class="bi bi-mortarboard me-1"></i>Staff Operations Sign In';
                authPortalBadge.className = 'badge px-3 py-1.5 rounded-pill shadow-xs bg-success bg-opacity-75 text-white';
            }
            if (authSwitchPrompt) {
                authSwitchPrompt.innerHTML = 'Need Admin Portal? <a href="/admin" class="text-primary text-decoration-none fw-semibold" id="link-switch-portal">Admin Portal Login</a>';
            }
            if (window.history && window.history.pushState && !window.location.pathname.includes('/staff')) {
                window.history.pushState(null, '', '/staff');
            }
        } else {
            if (authPortalBadge) {
                authPortalBadge.innerHTML = '<i class="bi bi-shield-lock me-1"></i>Admin Portal Sign In';
                authPortalBadge.className = 'badge px-3 py-1.5 rounded-pill shadow-xs bg-primary bg-opacity-75 text-white';
            }
            if (authSwitchPrompt) {
                authSwitchPrompt.innerHTML = 'Need Staff view? <a href="/staff" class="text-primary text-decoration-none fw-semibold" id="link-switch-portal">Staff Operations Login</a>';
            }
            if (window.history && window.history.pushState && !window.location.pathname.includes('/admin')) {
                window.history.pushState(null, '', '/admin');
            }
        }

        // Attach listener for portal switcher link on login card
        const dynamicSwitchLink = document.getElementById('link-switch-portal');
        if (dynamicSwitchLink) {
            dynamicSwitchLink.onclick = (e) => {
                e.preventDefault();
                const nextPortal = targetPortal === 'Staff' ? 'Admin' : 'Staff';
                showAuthScreen(nextPortal);
            };
        }

        if (authInputUsername) authInputUsername.focus();
    }

    function showDashboardApp() {
        if (authView) authView.classList.add('d-none');
        if (appWrapper) appWrapper.classList.remove('d-none');
        applyRolePermissions();
    }

    // =========================================================================
    // 2. NAVIGATION & VIEW SWITCHING
    // =========================================================================
    if (menuToggle) {
        menuToggle.addEventListener('click', (e) => {
            e.preventDefault();
            sidebarWrapper.classList.toggle('toggled');
        });
    }

    const navItems = document.querySelectorAll('#sidebar-wrapper .list-group-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const viewTarget = item.getAttribute('data-view');
            switchView(viewTarget);
        });
    });

    function switchView(viewName) {
        // Enforce role-based access restrictions on views
        if (currentRole === 'Staff') {
            const adminOnlyViews = ['dashboard', 'bookings', 'overall-summary', 'yearly-events', 'day-slots'];
            if (adminOnlyViews.includes(viewName)) {
                viewName = 'faculty-today';
                showToast('Notice: Admin views are restricted for Staff portal.');
            }
        } else if (currentRole === 'Admin') {
            const facultyOnlyViews = ['faculty-today', 'faculty-upcoming'];
            if (facultyOnlyViews.includes(viewName)) {
                viewName = 'dashboard';
            }
        }

        currentView = viewName;
        document.querySelectorAll('.content-view').forEach(el => el.classList.add('d-none'));

        const targetEl = document.getElementById(`view-${viewName}`);
        if (targetEl) targetEl.classList.remove('d-none');

        // Sync sidebar active status
        document.querySelectorAll('#sidebar-wrapper .list-group-item').forEach(i => {
            if (i.getAttribute('data-view') === viewName) {
                i.classList.add('active');
            } else {
                i.classList.remove('active');
            }
        });

        // Update Page Title
        const titleMap = {
            'dashboard': 'Dashboard Overview',
            'bookings': 'Booking Management List',
            'overall-summary': 'Overall Financial & Operational Summary',
            'yearly-events': 'Yearly Events Analytics & Trends',
            'day-slots': 'Day Slot Events Analysis',
            'availability': 'Hall Schedule Availability',
            'upcoming': 'Upcoming Events Schedule',
            'faculty-today': "Today's Event Tasks & Requirements",
            'faculty-upcoming': 'Upcoming Events & Task Preparation'
        };
        const titleEl = document.getElementById('page-title');
        if (titleEl) titleEl.textContent = titleMap[viewName] || 'Dashboard';

        // Load data for active view
        if (viewName === 'dashboard') {
            refreshDashboard();
        } else if (viewName === 'bookings') {
            loadBookingsList();
        } else if (viewName === 'overall-summary') {
            loadOverallSummaryView();
        } else if (viewName === 'yearly-events') {
            loadYearlyEventsView();
        } else if (viewName === 'day-slots') {
            loadDaySlotsView();
        } else if (viewName === 'availability') {
            loadHallAvailability();
        } else if (viewName === 'upcoming') {
            loadUpcomingViewEvents();
        } else if (viewName === 'faculty-today') {
            loadFacultyTodayView();
        } else if (viewName === 'faculty-upcoming') {
            loadFacultyUpcomingView();
        }
    }

    function refreshCurrentView(forceRefresh = true) {
        if (currentView === 'dashboard') {
            refreshDashboard();
        } else if (currentView === 'bookings') {
            loadBookingsList();
        } else if (currentView === 'overall-summary') {
            loadOverallSummaryView();
        } else if (currentView === 'yearly-events') {
            loadYearlyEventsView();
        } else if (currentView === 'day-slots') {
            loadDaySlotsView();
        } else if (currentView === 'availability') {
            loadHallAvailability();
        } else if (currentView === 'upcoming') {
            loadUpcomingViewEvents();
        } else if (currentView === 'faculty-today') {
            loadFacultyTodayView();
        } else if (currentView === 'faculty-upcoming') {
            loadFacultyUpcomingView();
        }
    }

    // =========================================================================
    // 3. ROLE PERMISSION ENFORCEMENT & VIEW RENDERING
    // =========================================================================
    function applyRolePermissions(targetView = null) {
        if (!currentUser) {
            showAuthScreen();
            return;
        }

        if (currentUserNameEl) {
            currentUserNameEl.textContent = currentUser.name || currentUser.username;
        }
        if (currentRoleLabel) {
            currentRoleLabel.textContent = `Role: ${currentRole}`;
        }

        if (sidebarRoleBadge) {
            sidebarRoleBadge.textContent = currentRole;
            sidebarRoleBadge.className = `badge px-2 py-0.5 nav-role-badge ${currentRole === 'Admin' ? 'bg-primary-subtle text-primary border border-primary-subtle' : 'bg-success-subtle text-success border border-success-subtle'}`;
        }

        if (routeIndicatorBadge) {
            if (currentRole === 'Admin') {
                routeIndicatorBadge.innerHTML = '<i class="bi bi-shield-lock me-1"></i>/admin';
                routeIndicatorBadge.className = 'badge bg-primary-subtle text-primary border border-primary-subtle px-2.5 py-1 small fw-semibold';
            } else {
                routeIndicatorBadge.innerHTML = '<i class="bi bi-mortarboard me-1"></i>/staff';
                routeIndicatorBadge.className = 'badge bg-success-subtle text-success border border-success-subtle px-2.5 py-1 small fw-semibold';
            }
        }

        if (currentRole === 'Staff') {
            if (adminNavGroup) adminNavGroup.classList.add('d-none');
            if (staffNavGroup) staffNavGroup.classList.remove('d-none');
            if (facultyBanner) {
                facultyBanner.classList.remove('d-none');
                facultyBanner.classList.add('d-flex');
            }
            if (navAddBtn) navAddBtn.classList.add('d-none');

            // Admin inspection controls
            if (isAdminSession) {
                if (btnReturnToAdmin) {
                    btnReturnToAdmin.classList.remove('d-none');
                    btnReturnToAdmin.classList.add('d-flex');
                }
                if (btnSwitchToStaff) btnSwitchToStaff.classList.add('d-none');
            } else {
                if (btnReturnToAdmin) btnReturnToAdmin.classList.add('d-none');
                if (btnSwitchToStaff) btnSwitchToStaff.classList.add('d-none');
            }

            if (window.history && window.history.pushState) {
                window.history.pushState(null, '', '/staff');
            }

            const adminViews = ['dashboard', 'bookings', 'overall-summary', 'yearly-events', 'day-slots'];
            if (adminViews.includes(currentView) || !currentView) {
                switchView(targetView || 'faculty-today');
            } else {
                switchView(targetView || currentView);
            }
        } else {
            // Admin Mode
            if (adminNavGroup) adminNavGroup.classList.remove('d-none');
            if (staffNavGroup) staffNavGroup.classList.add('d-none');
            if (facultyBanner) {
                facultyBanner.classList.add('d-none');
                facultyBanner.classList.remove('d-flex');
            }
            if (navAddBtn) navAddBtn.classList.remove('d-none');

            if (isAdminSession) {
                if (btnSwitchToStaff) {
                    btnSwitchToStaff.classList.remove('d-none');
                    btnSwitchToStaff.classList.add('d-flex');
                }
                if (btnReturnToAdmin) btnReturnToAdmin.classList.add('d-none');
            } else {
                if (btnSwitchToStaff) btnSwitchToStaff.classList.add('d-none');
                if (btnReturnToAdmin) btnReturnToAdmin.classList.add('d-none');
            }

            if (window.history && window.history.pushState) {
                window.history.pushState(null, '', '/admin');
            }

            const facultyViews = ['faculty-today', 'faculty-upcoming'];
            if (facultyViews.includes(currentView) || !currentView) {
                switchView(targetView || 'dashboard');
            } else {
                switchView(targetView || currentView);
            }
        }
    }

    // =========================================================================
    // 4. ADMIN TO STAFF VIEW SWITCHING ACTIONS
    // =========================================================================
    if (btnSwitchToStaff) {
        btnSwitchToStaff.addEventListener('click', (e) => {
            e.preventDefault();
            if (!isAdminSession) return;
            currentRole = 'Staff';
            currentView = 'faculty-today';
            applyRolePermissions();
            showToast('Switched to Staff View (Inspection Mode)');
        });
    }

    if (btnReturnToAdmin) {
        btnReturnToAdmin.addEventListener('click', (e) => {
            e.preventDefault();
            if (!isAdminSession) return;
            currentRole = 'Admin';
            currentView = 'dashboard';
            applyRolePermissions();
            showToast('Returned to Admin Portal');
        });
    }

    // =========================================================================
    // 5. AUTHENTICATION & LOGOUT HANDLERS
    // =========================================================================
    if (btnLogout) {
        btnLogout.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await fetch('/api/auth/logout', { method: 'POST' });
            } catch(e) {}
            clearStoredSession();
            showAuthScreen();
            showToast('Logged out successfully.');
        });
    }

    if (btnTogglePassword) {
        btnTogglePassword.addEventListener('click', () => {
            if (!authInputPassword) return;
            if (authInputPassword.type === 'password') {
                authInputPassword.type = 'text';
                if (iconTogglePassword) iconTogglePassword.className = 'bi bi-eye-slash text-muted';
            } else {
                authInputPassword.type = 'password';
                if (iconTogglePassword) iconTogglePassword.className = 'bi bi-eye text-muted';
            }
        });
    }

    if (mainLoginForm) {
        mainLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (authErrorAlert) authErrorAlert.classList.add('d-none');

            const username = authInputUsername ? authInputUsername.value.trim() : '';
            const password = authInputPassword ? authInputPassword.value : '';

            if (!username || !password) {
                if (authErrorAlert && authErrorMessage) {
                    authErrorMessage.textContent = 'Please enter both username and password.';
                    authErrorAlert.classList.remove('d-none');
                }
                return;
            }

            if (btnAuthSubmit) btnAuthSubmit.disabled = true;
            if (btnAuthSubmitText) btnAuthSubmitText.textContent = 'Signing in...';
            if (authSubmitSpinner) authSubmitSpinner.classList.remove('d-none');

            const targetPortal = getRequestedPortal();

            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const result = await res.json();

                if (result.success && result.user) {
                    const user = result.user;
                    // Enforce portal role compatibility: Staff cannot access Admin portal
                    if (targetPortal === 'Admin' && user.role !== 'Admin') {
                        if (authErrorAlert && authErrorMessage) {
                            authErrorMessage.textContent = 'Access Denied: Staff accounts cannot access the Admin Portal. Please use the Staff Portal.';
                            authErrorAlert.classList.remove('d-none');
                        }
                        return;
                    }

                    saveStoredSession(user, result.token);
                    currentUser = user;
                    isAdminSession = (user.role === 'Admin');

                    if (targetPortal === 'Staff') {
                        currentRole = 'Staff';
                        currentView = 'faculty-today';
                    } else {
                        currentRole = 'Admin';
                        currentView = 'dashboard';
                    }

                    showDashboardApp();
                    showToast(`Welcome, ${user.name || user.username} (${user.role})`);
                } else {
                    if (authErrorAlert && authErrorMessage) {
                        authErrorMessage.textContent = result.message || 'Invalid username or password.';
                        authErrorAlert.classList.remove('d-none');
                    }
                }
            } catch(err) {
                if (authErrorAlert && authErrorMessage) {
                    authErrorMessage.textContent = 'Unable to connect to login server. Please try again.';
                    authErrorAlert.classList.remove('d-none');
                }
            } finally {
                if (btnAuthSubmit) btnAuthSubmit.disabled = false;
                if (btnAuthSubmitText) btnAuthSubmitText.textContent = 'Sign In';
                if (authSubmitSpinner) authSubmitSpinner.classList.add('d-none');
            }
        });
    }


    // =========================================================================
    // 3. API SERVICE CALLS & DASHBOARD REFRESH LOGIC
    // =========================================================================

    /**
     * Dedicated Dashboard Data Refresh - Fetches directly from /api/bookings, /api/payments & /api/stats.
     * Operates completely independent of cached state from other views.
     */
    function renderDashboardCards(metrics = {}) {
        console.log("DEBUG: renderDashboardCards executed", metrics);
        const {
            totalBookings = 0,
            todayEventsCount = 0,
            isHall1BookedToday = false,
            isHall2BookedToday = false,
            hall1Status = null,
            hall2Status = null,
            todayCollections = 0,
            pendingRentDues = 0,
            totalRentRevenue = 0,
            totalDepositHeld = 0
        } = metrics;

        if (document.getElementById('stat-total')) {
            document.getElementById('stat-total').textContent = totalBookings;
        }
        if (document.getElementById('stat-today-count')) {
            document.getElementById('stat-today-count').textContent = todayEventsCount;
        }

        const formatHallDisplayStatus = (status, isBooked) => {
            if (status === 'maintenance' || status === 'Under Maintenance') {
                return { text: 'Under Maintenance', cssClass: 'text-warning' };
            }
            if (isBooked || status === 'Occupied' || status === 'Booked Today' || status === 'booked') {
                return { text: 'Occupied', cssClass: 'text-primary' };
            }
            return { text: 'Ready for Booking', cssClass: 'text-success' };
        };

        if (document.getElementById('stat-hall1')) {
            const h1El = document.getElementById('stat-hall1');
            const h1Info = formatHallDisplayStatus(hall1Status, isHall1BookedToday);
            h1El.textContent = h1Info.text;
            h1El.className = `fw-bold mb-0 text-truncate ${h1Info.cssClass}`;
        }
        if (document.getElementById('stat-hall2')) {
            const h2El = document.getElementById('stat-hall2');
            const h2Info = formatHallDisplayStatus(hall2Status, isHall2BookedToday);
            h2El.textContent = h2Info.text;
            h2El.className = `fw-bold mb-0 text-truncate ${h2Info.cssClass === 'text-primary' ? 'text-purple' : h2Info.cssClass}`;
        }
        if (document.getElementById('stat-today-collection')) {
            document.getElementById('stat-today-collection').textContent = `₹${todayCollections.toLocaleString()}`;
        }
        if (document.getElementById('stat-pending-payments')) {
            document.getElementById('stat-pending-payments').textContent = `₹${pendingRentDues.toLocaleString()}`;
        }
        if (document.getElementById('stat-total-revenue')) {
            document.getElementById('stat-total-revenue').textContent = `₹${totalRentRevenue.toLocaleString()}`;
        }
        if (document.getElementById('stat-deposits-held')) {
            document.getElementById('stat-deposits-held').textContent = `₹${totalDepositHeld.toLocaleString()}`;
        }
    }

    /**
     * Dedicated Dashboard Data Refresh - Fetches directly from /api/bookings, /api/payments & /api/stats.
     * Operates completely independent of cached state from other views.
     */
    async function loadDashboardData() {
        const today = getTodayDateString();
        setDashboardRefreshing(true);
        if (document.getElementById('today-date-badge')) {
            document.getElementById('today-date-badge').textContent = today;
        }

        try {
            let bookingsResult = { success: false, data: [] };
            let paymentsResult = { success: false, data: [] };
            let statsResult = { success: false, data: {} };

            const [bookingsRes, paymentsRes, statsRes] = await Promise.allSettled([
                fetch('/api/bookings').then(r => r.json()),
                fetch('/api/payments').then(r => r.json()),
                fetch('/api/stats').then(r => r.json())
            ]);

            if (bookingsRes.status === 'fulfilled' && bookingsRes.value) {
                bookingsResult = bookingsRes.value;
            }
            if (paymentsRes.status === 'fulfilled' && paymentsRes.value) {
                paymentsResult = paymentsRes.value;
            }
            if (statsRes.status === 'fulfilled' && statsRes.value) {
                statsResult = statsRes.value;
            }

            const bookingsSucceeded = bookingsResult && bookingsResult.success && Array.isArray(bookingsResult.data);
            const paymentsSucceeded = paymentsResult && paymentsResult.success && Array.isArray(paymentsResult.data);
            const statsData = (statsResult && statsResult.success && statsResult.data) ? statsResult.data : {};

            const bookings = bookingsSucceeded ? bookingsResult.data : [];
            const payments = paymentsSucceeded ? paymentsResult.data : [];

            // 1. Compute Operational Metrics directly from /api/bookings
            const totalBookings = bookings.length;
            const activeBookings = bookings.filter(b => b.status !== 'Cancelled' && b.status !== 'Archived');
            const todayEvents = bookings.filter(b => b.bookingDate === today && b.status !== 'Cancelled' && b.status !== 'Archived');

            const isSmallHallBookedToday = todayEvents.some(b => b.hall === 'Small Hall' || b.hall === 'Hall 1');
            const isBigHallBookedToday = todayEvents.some(b => b.hall === 'Big Hall' || b.hall === 'Hall 2');

            // 2. Compute Financial Metrics directly from /api/bookings & /api/payments
            let pendingRentDues = 0;
            let totalRentRevenue = 0;
            let totalDepositHeld = 0;

            activeBookings.forEach(b => {
                const f = b.financial || {};
                pendingRentDues += (f.remainingRent !== undefined ? f.remainingRent : 0);
                totalRentRevenue += (f.netRentPaid !== undefined ? f.netRentPaid : 0);
                totalDepositHeld += (f.effectiveDepositHeld !== undefined ? f.effectiveDepositHeld : 0);
            });

            // Calculate Today's Collection directly from /api/payments ledger
            const activeTodayTxns = payments.filter(t => !t.isVoided && t.status === 'Success' && t.date === today);
            const todayCollections = Math.max(0, activeTodayTxns.reduce((acc, t) => {
                if (t.type && (t.type.includes('Return') || t.type.includes('Refund'))) {
                    return acc - t.amount;
                } else if (t.type && !t.type.includes('Forfeiture') && !t.type.includes('Adjustment')) {
                    return acc + t.amount;
                }
                return acc;
            }, 0));

            const metrics = {
                totalBookings,
                todayEventsCount: todayEvents.length,
                isHall1BookedToday: isSmallHallBookedToday,
                isHall2BookedToday: isBigHallBookedToday,
                isSmallHallBookedToday,
                isBigHallBookedToday,
                hall1Status: statsData.hall1Status || (isSmallHallBookedToday ? 'Occupied' : 'Ready for Booking'),
                hall2Status: statsData.hall2Status || (isBigHallBookedToday ? 'Occupied' : 'Ready for Booking'),
                todayCollections,
                pendingRentDues,
                totalRentRevenue,
                totalDepositHeld
            };

            renderDashboardCards(metrics);

            // 3. Render Today's Event Schedule & Recent Activity Feed
            renderTodayDashboardEvents(todayEvents);
            renderRecentActivity(bookings.slice(-5).reverse());

            return metrics;

        } catch (err) {
            console.error("Error loading dashboard data directly from API:", err);
            renderDashboardNoData("No events scheduled for today");
            return null;
        } finally {
            setDashboardRefreshing(false);
        }
    }

    function setDashboardRefreshing(isRefreshing) {
        const status = document.getElementById('dashboard-refresh-status');
        if (!status) return;
        status.classList.toggle('d-none', !isRefreshing);
    }

    function clearDashboardDOM() {
        // Clear all metric DOM elements (set to 0 or "Loading...")
        if (document.getElementById('stat-total')) document.getElementById('stat-total').textContent = '0';
        if (document.getElementById('stat-today-count')) document.getElementById('stat-today-count').textContent = '0';
        if (document.getElementById('stat-hall1')) {
            document.getElementById('stat-hall1').textContent = 'Loading…';
            document.getElementById('stat-hall1').className = 'fw-bold mb-0 text-truncate text-muted';
        }
        if (document.getElementById('stat-hall2')) {
            document.getElementById('stat-hall2').textContent = 'Loading…';
            document.getElementById('stat-hall2').className = 'fw-bold mb-0 text-truncate text-muted';
        }
        if (document.getElementById('stat-today-collection')) document.getElementById('stat-today-collection').textContent = '₹0';
        if (document.getElementById('stat-pending-payments')) document.getElementById('stat-pending-payments').textContent = '₹0';
        if (document.getElementById('stat-total-revenue')) document.getElementById('stat-total-revenue').textContent = '₹0';
        if (document.getElementById('stat-deposits-held')) document.getElementById('stat-deposits-held').textContent = '₹0';

        const eventsContainer = document.getElementById('today-events-container');
        if (eventsContainer) {
            eventsContainer.innerHTML = `
                <div class="text-center py-3 text-muted small">
                    <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                    Loading…
                </div>`;
        }

        const activityContainer = document.getElementById('recent-activity-container');
        if (activityContainer) {
            activityContainer.innerHTML = `
                <div class="text-center py-3 text-muted small">
                    <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                    Loading…
                </div>`;
        }
    }

    async function refreshDashboard() {
        clearDashboardDOM();

        const metrics = await loadDashboardData();

        if (metrics) {
            renderDashboardCards(metrics);
        }
    }

    /**
     * Clean error/fallback safeguard UI rendering (Never display 'N/A' for available halls)
     */
    function renderDashboardNoData(message = "No data available") {
        if (document.getElementById('stat-total')) document.getElementById('stat-total').textContent = '0';
        if (document.getElementById('stat-today-count')) document.getElementById('stat-today-count').textContent = '0';
        if (document.getElementById('stat-hall1')) {
            document.getElementById('stat-hall1').textContent = 'Ready for Booking';
            document.getElementById('stat-hall1').className = 'fw-bold mb-0 text-truncate text-success';
        }
        if (document.getElementById('stat-hall2')) {
            document.getElementById('stat-hall2').textContent = 'Ready for Booking';
            document.getElementById('stat-hall2').className = 'fw-bold mb-0 text-truncate text-success';
        }
        if (document.getElementById('stat-today-collection')) document.getElementById('stat-today-collection').textContent = '₹0';
        if (document.getElementById('stat-pending-payments')) document.getElementById('stat-pending-payments').textContent = '₹0';
        if (document.getElementById('stat-total-revenue')) document.getElementById('stat-total-revenue').textContent = '₹0';
        if (document.getElementById('stat-deposits-held')) document.getElementById('stat-deposits-held').textContent = '₹0';

        const eventsContainer = document.getElementById('today-events-container');
        if (eventsContainer) {
            eventsContainer.innerHTML = `
                <div class="text-center py-4 text-muted">
                    <i class="bi bi-check-circle fs-3 text-success d-block mb-1"></i>
                    No events scheduled for today. Halls are <span class="badge bg-success-subtle text-success fw-semibold ms-1">Ready for Booking</span>
                </div>`;
        }

        const activityContainer = document.getElementById('recent-activity-container');
        if (activityContainer) {
            activityContainer.innerHTML = `
                <div class="text-center py-4 text-muted small">
                    <i class="bi bi-info-circle fs-4 d-block mb-1"></i>
                    ${message}
                </div>`;
        }
    }

    // Fetch Financial Stats for Payments Ledger KPI View
    async function fetchFinancialStats() {
        try {
            const res = await fetch('/api/payments/stats');
            const result = await res.json();
            if (result.success) {
                const f = result.data;
                if (document.getElementById('pay-stat-today')) {
                    document.getElementById('pay-stat-today').textContent = `₹${f.todayCollections.toLocaleString()}`;
                    document.getElementById('pay-stat-cash').textContent = `₹${f.cashCollection.toLocaleString()}`;
                    document.getElementById('pay-stat-upi').textContent = `₹${f.upiCollection.toLocaleString()}`;
                    document.getElementById('pay-stat-card').textContent = `₹${(f.cardCollection + f.otherCollection).toLocaleString()}`;
                }
            }
        } catch (err) {
            console.error("Error fetching financial stats for payments ledger:", err);
        }
    }

    const currentFilters = {
        search: '',
        date: '',
        hall: 'All',
        status: 'All',
        dues: 'All'
    };
    let bookingsListRequestId = 0;

    function syncCurrentFilters() {
        currentFilters.search = document.getElementById('filter-search')?.value.trim() || '';
        currentFilters.date = document.getElementById('filter-date')?.value.trim() || '';
        currentFilters.hall = document.getElementById('filter-hall')?.value || 'All';
        currentFilters.status = document.getElementById('filter-status')?.value || 'All';
        currentFilters.dues = document.getElementById('filter-booking-dues')?.value || 'All';
    }

    function getBookingsListUrl() {
        const params = new URLSearchParams();
        if (currentFilters.search) params.set('search', currentFilters.search);
        if (currentFilters.date) params.set('date', currentFilters.date);
        if (currentFilters.hall && currentFilters.hall !== 'All') params.set('hall', currentFilters.hall);
        if (currentFilters.status && currentFilters.status !== 'All') params.set('status', currentFilters.status);
        const query = params.toString();
        return query ? `/api/bookings?${query}` : '/api/bookings';
    }

    async function loadBookingsList() {
        syncCurrentFilters();

        const requestId = ++bookingsListRequestId;

        renderBookingsLoading();

        try {
            const res = await fetch(getBookingsListUrl());
            const result = await res.json();

            if (requestId !== bookingsListRequestId) return [];

            const fetchedData =
                result.success && Array.isArray(result.data)
                    ? result.data
                    : [];

            const filteredBookings = applyBookingsFilters(fetchedData);

            renderBookingsTable(filteredBookings);

            return filteredBookings;
        } catch (err) {
            if (requestId !== bookingsListRequestId) return [];

            console.error('Error loading filtered bookings:', err);
            renderBookingsTable([]);

            return [];
        }
    }

    function renderBookingsLoading() {
        const tbody = document.getElementById('bookings-table-body');
        if (!tbody) return;
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="text-center py-5 text-muted">
                    <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Refreshing bookings…
                </td>
            </tr>`;
    }

    function applyBookingsFilters(fetchedData) {
        if (!fetchedData) return [];

        const search = currentFilters.search.toLowerCase();
        const date = currentFilters.date;
        const hall = currentFilters.hall;
        const status = currentFilters.status;
        const duesFilter = currentFilters.dues;

        let bookings = [...fetchedData];

        if (search) {
            bookings = bookings.filter(b => 
                (b.customerName || '').toLowerCase().includes(search) ||
                (b.eventName || '').toLowerCase().includes(search) ||
                (b.id || '').toLowerCase().includes(search) ||
                (b.mobileNumber || '').includes(search) ||
                (b.hall || '').toLowerCase().includes(search) ||
                (b.status || '').toLowerCase().includes(search) ||
                (b.bookingDate || '').includes(search)
            );
        }

        if (date) {
            bookings = bookings.filter(b => b.bookingDate === date);
        }

        if (hall && hall !== 'All') {
            const hallQueries = hall.split(',').map(h => h.trim().toLowerCase());
            bookings = bookings.filter(b => hallQueries.includes((b.hall || '').toLowerCase()));
        }

        if (status && status !== 'All') {
            bookings = bookings.filter(b => {
                if (status === 'Booked' || status === 'Confirmed') {
                    return b.status === 'Booked' || b.status === 'Confirmed';
                }
                return b.status === status;
            });
        }

        if (duesFilter && duesFilter !== 'All') {
            bookings = bookings.filter(b => {
                const f = b.financial || {};
                const remRent = f.remainingRent !== undefined ? f.remainingRent : 0;
                const depHeld = f.effectiveDepositHeld !== undefined ? f.effectiveDepositHeld : 0;
                const isSettled = f.isFullySettled || (remRent <= 0 && depHeld === 0);
                if (duesFilter === 'DuesPending') return remRent > 0;
                if (duesFilter === 'CompletedDuesPending') return b.status === 'Completed' && remRent > 0;
                if (duesFilter === 'FullySettled') return isSettled;
                if (duesFilter === 'DepositHeld') return depHeld > 0;
                return true;
            });
        }

        return bookings;
    }

    // Load Payments View & Dropdown
    async function loadPaymentsView() {
        populatePaymentsBookingSelect();
        loadPaymentsLedger();
    }

    async function populatePaymentsBookingSelect() {
        try {
            const res = await fetch('/api/bookings');
            const result = await res.json();
            if (result.success) {
                const select = document.getElementById('pay-select-booking');
                const badgeContainer = document.getElementById('pay-pending-dues-summary-badge');
                const duesFilter = document.getElementById('filter-pay-dues') ? document.getElementById('filter-pay-dues').value : 'All';
                const currentVal = select.value;

                let dueCount = 0;
                let totalDueAmount = 0;

                const filteredBookings = result.data.filter(b => {
                    const f = b.financial || {};
                    const remRent = f.remainingRent !== undefined ? f.remainingRent : 0;
                    const depHeld = f.effectiveDepositHeld !== undefined ? f.effectiveDepositHeld : 0;
                    const isSettled = f.isFullySettled || (remRent <= 0 && depHeld === 0);

                    if (remRent > 0) {
                        dueCount++;
                        totalDueAmount += remRent;
                    }

                    if (duesFilter === 'DuesPending') return remRent > 0;
                    if (duesFilter === 'CompletedDuesPending') return b.status === 'Completed' && remRent > 0;
                    if (duesFilter === 'FullySettled') return isSettled;
                    if (duesFilter === 'DepositHeld') return depHeld > 0;
                    return true;
                });

                select.innerHTML = `<option value="">-- Select a Customer / Booking (${filteredBookings.length} found) --</option>`;

                filteredBookings.forEach(b => {
                    const f = b.financial || {};
                    const remRent = f.remainingRent !== undefined ? f.remainingRent : 0;
                    const depHeld = f.effectiveDepositHeld !== undefined ? f.effectiveDepositHeld : 0;
                    const isSettled = f.isFullySettled || (remRent <= 0 && depHeld === 0);

                    let statusTag = '';
                    if (remRent > 0) {
                        statusTag = `⚠️ Rent Due: ₹${remRent.toLocaleString()}`;
                    } else if (isSettled) {
                        statusTag = `✅ Fully Settled`;
                    } else if (depHeld > 0) {
                        statusTag = `🛡️ Deposit Held: ₹${depHeld.toLocaleString()}`;
                    } else {
                        statusTag = b.status;
                    }

                    const opt = document.createElement('option');
                    opt.value = b.id;
                    opt.textContent = `${b.id} - ${b.customerName} (${b.eventName} • ${statusTag})`;
                    select.appendChild(opt);
                });

                if (badgeContainer) {
                    if (dueCount > 0) {
                        badgeContainer.innerHTML = `
                            <span class="badge bg-danger-subtle text-danger border border-danger-subtle px-3 py-2 cursor-pointer btn-quick-filter-dues" title="Click to filter customers with pending rent dues">
                                <i class="bi bi-exclamation-triangle-fill me-1"></i>${dueCount} Customers with Rent Due (₹${totalDueAmount.toLocaleString()} Total Dues)
                            </span>
                        `;
                        const quickBtn = badgeContainer.querySelector('.btn-quick-filter-dues');
                        if (quickBtn) {
                            quickBtn.addEventListener('click', () => {
                                const duesSelect = document.getElementById('filter-pay-dues');
                                if (duesSelect) {
                                    duesSelect.value = 'DuesPending';
                                    loadPaymentsView();
                                }
                            });
                        }
                    } else {
                        badgeContainer.innerHTML = `
                            <span class="badge bg-success-subtle text-success border border-success-subtle px-3 py-2">
                                <i class="bi bi-check-circle-fill me-1"></i>All Customer Accounts Settled (Zero Outstanding Dues)
                            </span>
                        `;
                    }
                }

                if (currentVal && Array.from(select.options).some(o => o.value === currentVal)) {
                    select.value = currentVal;
                }
            }
        } catch (err) {
            console.error(err);
        }
    }

    // Load Payments Ledger Table
    async function loadPaymentsLedger() {
        const search = document.getElementById('filter-pay-search').value;
        const duesFilter = document.getElementById('filter-pay-dues') ? document.getElementById('filter-pay-dues').value : 'All';
        const paymentMethod = document.getElementById('filter-pay-method').value;
        const type = document.getElementById('filter-pay-type').value;
        const status = document.getElementById('filter-pay-status').value;

        const queryParams = new URLSearchParams({ search, duesFilter, paymentMethod, type, status });

        try {
            const res = await fetch(`/api/payments?${queryParams.toString()}`);
            const result = await res.json();
            if (result.success) {
                renderPaymentsTable(result.data);
            }
        } catch (err) {
            console.error("Error fetching payment ledger:", err);
        }
    }

    // Load Today's Dashboard Events
    async function loadTodayDashboardEvents() {
        const today = getTodayDateString();
        if (document.getElementById('today-date-badge')) {
            document.getElementById('today-date-badge').textContent = today;
        }
        try {
            const res = await fetch(`/api/bookings?date=${today}`);
            const result = await res.json();
            if (result.success) {
                const nonCancelledEvents = (result.data || []).filter(b => b.status !== 'Cancelled' && b.status !== 'Archived');
                renderTodayDashboardEvents(nonCancelledEvents);
            }
        } catch (err) {
            console.error("Error fetching today events:", err);
        }
    }

    // Load Availability
    async function loadHallAvailability() {
        const targetDate = document.getElementById('avail-date-picker').value || getTodayDateString();
        const h1Container = document.getElementById('hall1-slots-container');
        const h2Container = document.getElementById('hall2-slots-container');
        if (h1Container) h1Container.innerHTML = `<div class="text-center py-3 text-muted small"><span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>Loading availability…</div>`;
        if (h2Container) h2Container.innerHTML = `<div class="text-center py-3 text-muted small"><span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>Loading availability…</div>`;
        try {
            const res = await fetch(`/api/availability?date=${targetDate}`);
            const result = await res.json();
            if (result.success) {
                renderAvailability(result.data);
            }
        } catch (err) {
            console.error("Error fetching availability:", err);
        }
    }

    // Load Today's View
    async function loadTodayViewEvents() {
        const today = getTodayDateString();
        const container = document.getElementById('today-view-container');
        if (container) {
            container.innerHTML = `<div class="col-12 text-center py-5 text-muted"><span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Loading today's events…</div>`;
        }
        try {
            const res = await fetch('/api/bookings');
            const result = await res.json();
            const bookings = (result.success && Array.isArray(result.data)) ? result.data : [];
            const todayEvents = bookings.filter(b => b.bookingDate === today);
            renderCardsGrid(todayEvents, 'today-view-container', 'No events scheduled for today.');
        } catch (err) {
            console.error("Error loading today view events:", err);
            renderCardsGrid([], 'today-view-container', 'No events scheduled for today.');
        }
    }

    // Load Upcoming View
    async function loadUpcomingViewEvents() {
        const today = getTodayDateString();
        const container = document.getElementById('upcoming-view-container');
        if (container) {
            container.innerHTML = `<div class="col-12 text-center py-5 text-muted"><span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Loading upcoming events…</div>`;
        }
        try {
            const res = await fetch('/api/bookings');
            const result = await res.json();
            const bookings = (result.success && Array.isArray(result.data)) ? result.data : [];
            const upcoming = bookings.filter(b => b.bookingDate > today && b.status !== 'Cancelled' && b.status !== 'Archived');
            renderCardsGrid(upcoming, 'upcoming-view-container', 'No upcoming events scheduled.');
        } catch (err) {
            console.error("Error loading upcoming view events:", err);
            renderCardsGrid([], 'upcoming-view-container', 'No upcoming events scheduled.');
        }
    }

    // =========================================================================
    // 4. RENDERING FUNCTIONS
    // =========================================================================

    function renderBookingsTable(bookings = []) {
        console.log("DEBUG: renderBookingsTable executed", bookings);
        const tbody = document.getElementById('bookings-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';


        if (bookings.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center py-5 text-muted">
                        <i class="bi bi-inbox fs-2 d-block mb-2"></i>
                        No bookings found
                    </td>
                </tr>`;
            return;
        }

        bookings.forEach(b => {
            const tr = document.createElement('tr');
            const isReadOnly = (currentRole !== 'Admin');
            const isCancelled = b.status === 'Cancelled';
            const isArchived = b.status === 'Archived';

            // STRICT ACTION COLUMN ACCORDING TO REQUIREMENTS:
            // Action column contains ONLY: View Details & Timeline, Edit Booking, Archive Booking, Cancel Booking, Delete Booking
            const archiveOrUnarchiveItemHTML = isArchived ?
                `<li><a class="dropdown-item text-success btn-unarchive" href="#" data-id="${b.id}"><i class="bi bi-arrow-counterclockwise me-2"></i>Unarchive Booking</a></li>` :
                `<li><a class="dropdown-item text-secondary btn-archive" href="#" data-id="${b.id}"><i class="bi bi-archive me-2"></i>Archive Booking</a></li>`;

            const cancelOrRestoreItemHTML = isCancelled ?
                `<li><a class="dropdown-item text-success btn-uncancel" href="#" data-id="${b.id}"><i class="bi bi-arrow-counterclockwise me-2"></i>Revert Cancellation</a></li>` :
                `<li><a class="dropdown-item text-warning btn-cancel ${isArchived ? 'disabled' : ''}" href="#" data-id="${b.id}"><i class="bi bi-x-circle me-2"></i>Cancel Booking</a></li>`;

            const actionButtonsHTML = isReadOnly ? `<span class="badge bg-light text-secondary border">Read-Only</span>` : `
                <div class="dropdown d-inline-block">
                    <button class="btn btn-sm btn-light border dropdown-toggle" type="button" data-bs-toggle="dropdown" data-bs-boundary="viewport">
                        Actions
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end shadow-sm">
                        <li><a class="dropdown-item text-primary btn-view-details" href="#" data-id="${b.id}"><i class="bi bi-eye me-2"></i>View Details & Timeline</a></li>
                        <li><a class="dropdown-item btn-edit ${isArchived || isCancelled ? 'disabled' : ''}" href="#" data-id="${b.id}"><i class="bi bi-pencil me-2"></i>Edit Booking Details</a></li>
                        ${archiveOrUnarchiveItemHTML}
                        <li><a class="dropdown-item text-primary btn-quick-extra-charge" href="#" data-id="${b.id}"><i class="bi bi-plus-circle me-2"></i>Add Extra Charge</a></li>
                        <li><a class="dropdown-item text-success btn-quick-discount" href="#" data-id="${b.id}"><i class="bi bi-percent me-2"></i>Approve Discount</a></li>
                        ${cancelOrRestoreItemHTML}
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item text-danger btn-delete" href="#" data-id="${b.id}"><i class="bi bi-trash me-2"></i>Delete Booking</a></li>
                    </ul>
                </div>
            `;

            const f = b.financial || {};
            const netRent = f.netRent !== undefined ? f.netRent : 0;
            const netRentPaid = f.netRentPaid !== undefined ? f.netRentPaid : 0;
            const remainingRent = f.remainingRent !== undefined ? f.remainingRent : 0;
            const depositHeld = f.effectiveDepositHeld !== undefined ? f.effectiveDepositHeld : 0;

            tr.style.cursor = 'pointer';
            tr.innerHTML = `
                <td class="ps-4">
                    <div class="fw-bold text-primary">${b.id}</div>
                </td>
                <td>
                    <div class="fw-bold">${escapeHtml(b.customerName)}</div>
                    <div class="small text-muted"><i class="bi bi-telephone me-1"></i>${escapeHtml(b.mobileNumber)}</div>
                </td>
                <td>
                    <div class="fw-semibold">${escapeHtml(b.eventName)}</div>
                    <div class="small text-muted"><span class="hall-pill ${(b.hall === 'Small Hall' || b.hall === 'Hall 1') ? 'hall-1' : 'hall-2'} me-1">${b.hall}</span> ${b.bookingDate}</div>
                </td>
                <td>
                    <div class="small fw-semibold text-dark"><i class="bi bi-clock me-1 text-primary"></i>${b.startTime} - ${b.endTime}</div>
                </td>
                <td>
                    <span class="badge-status ${b.status}">${b.status}</span>
                </td>
                <td class="text-end">
                    <div class="small fw-semibold text-dark">₹${netRent.toLocaleString()}</div>
                </td>
                <td class="text-end">
                    <div class="small fw-semibold text-success">₹${netRentPaid.toLocaleString()}</div>
                </td>
                <td class="text-end">
                    <div class="small fw-bold ${remainingRent > 0 ? 'text-danger' : 'text-success'}">₹${remainingRent.toLocaleString()}</div>
                </td>
                <td class="text-end">
                    <div class="small fw-semibold" style="color:#7c3aed;">₹${depositHeld.toLocaleString()}</div>
                </td>
                <td class="text-end pe-4" onclick="event.stopPropagation()">${actionButtonsHTML}</td>
            `;

            tr.addEventListener('click', (e) => {
                if (e.target.closest('button') || e.target.closest('.dropdown-menu') || e.target.closest('select') || e.target.closest('a')) return;
                openViewBookingModal(b.id);
            });

            tbody.appendChild(tr);
        });

        // Action listeners
        if (currentRole === 'Admin') {
            document.querySelectorAll('.btn-view-details').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    openViewBookingModal(btn.getAttribute('data-id'));
                });
            });

            document.querySelectorAll('.btn-edit').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    openEditModal(btn.getAttribute('data-id'));
                });
            });

            document.querySelectorAll('.btn-archive').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    handleArchiveBooking(btn.getAttribute('data-id'));
                });
            });

            document.querySelectorAll('.btn-unarchive').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    handleUnarchiveBooking(btn.getAttribute('data-id'));
                });
            });

            document.querySelectorAll('.btn-quick-extra-charge').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    openQuickExtraChargeModal(btn.getAttribute('data-id'));
                });
            });

            document.querySelectorAll('.btn-quick-discount').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    openQuickDiscountModal(btn.getAttribute('data-id'));
                });
            });

            document.querySelectorAll('.btn-cancel').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    handleCancelBooking(btn.getAttribute('data-id'));
                });
            });

            document.querySelectorAll('.btn-uncancel').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    handleUncancelBooking(btn.getAttribute('data-id'));
                });
            });

            document.querySelectorAll('.btn-delete').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    handleDeleteBooking(btn.getAttribute('data-id'));
                });
            });
        }
    }

    // Load Payments Ledger Table (Customer Account Centric)
    async function loadPaymentsLedger() {
        const search = (document.getElementById('filter-pay-search').value || '').trim().toLowerCase();
        const duesFilter = document.getElementById('filter-pay-dues') ? document.getElementById('filter-pay-dues').value : 'All';
        const paymentMethod = document.getElementById('filter-pay-method') ? document.getElementById('filter-pay-method').value : 'All';

        try {
            const res = await fetch('/api/bookings');
            const result = await res.json();
            if (result.success) {
                let list = result.data;

                // Search by Booking ID, Customer Name, Event Name, Mobile
                if (search) {
                    list = list.filter(b => 
                        b.id.toLowerCase().includes(search) ||
                        b.customerName.toLowerCase().includes(search) ||
                        b.eventName.toLowerCase().includes(search) ||
                        (b.mobileNumber && b.mobileNumber.includes(search))
                    );
                }

                // Dues filter
                if (duesFilter !== 'All') {
                    list = list.filter(b => {
                        const f = b.financial || {};
                        const remRent = f.remainingRent !== undefined ? f.remainingRent : 0;
                        const depHeld = f.effectiveDepositHeld !== undefined ? f.effectiveDepositHeld : 0;
                        const isSettled = f.isFullySettled || (remRent <= 0 && depHeld === 0);

                        if (duesFilter === 'DuesPending') return remRent > 0;
                        if (duesFilter === 'CompletedDuesPending') return b.status === 'Completed' && remRent > 0;
                        if (duesFilter === 'FullySettled') return isSettled;
                        if (duesFilter === 'DepositHeld') return depHeld > 0;
                        return true;
                    });
                }

                // Payment method filter
                if (paymentMethod !== 'All') {
                    list = list.filter(b => {
                        const txns = (b.financial && b.financial.transactions) ? b.financial.transactions : [];
                        return txns.some(t => !t.isVoided && (
                            paymentMethod === 'Card' ? t.paymentMethod.includes('Card') : t.paymentMethod === paymentMethod
                        ));
                    });
                }

                renderPaymentsTable(list);
            }
        } catch (err) {
            console.error("Error fetching payment ledger:", err);
        }
    }

    function renderPaymentsTable(bookings) {
        const tbody = document.getElementById('payments-table-body');
        tbody.innerHTML = '';

        if (bookings.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center py-5 text-muted">
                        <i class="bi bi-journal-x fs-2 d-block mb-2"></i>
                        No customer financial records found.
                    </td>
                </tr>`;
            return;
        }

        bookings.forEach(b => {
            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';

            const f = b.financial || {};
            const netRent = f.netRent !== undefined ? f.netRent : 0;
            const netRentPaid = f.netRentPaid !== undefined ? f.netRentPaid : 0;
            const remainingRent = f.remainingRent !== undefined ? f.remainingRent : 0;
            const overpaidAmount = f.overpaidAmount !== undefined ? f.overpaidAmount : 0;
            const depositHeld = f.effectiveDepositHeld !== undefined ? f.effectiveDepositHeld : 0;

            let rentDueHTML = '';
            if (overpaidAmount > 0) {
                rentDueHTML = `<span class="badge bg-warning text-dark fw-bold">Overpaid ₹${overpaidAmount.toLocaleString()}</span>`;
            } else if (remainingRent > 0) {
                rentDueHTML = `<span class="fw-bold text-danger">₹${remainingRent.toLocaleString()}</span>`;
            } else {
                rentDueHTML = `<span class="fw-semibold text-success">₹0</span>`;
            }

            const payStatusClass = (f.paymentStatus || 'Unpaid').replace(/ /g, '-');
            const depStatusClass = (f.depositStatus || 'N/A').replace(/ /g, '-');

            tr.innerHTML = `
                <td class="ps-4">
                    <a href="#" class="fw-bold text-primary btn-view-customer-ledger" data-id="${b.id}">${b.id}</a>
                </td>
                <td>
                    <div class="fw-bold text-dark">${escapeHtml(b.customerName)}</div>
                    <div class="small text-muted"><i class="bi bi-telephone me-1"></i>${escapeHtml(b.mobileNumber)}</div>
                </td>
                <td>
                    <div class="fw-semibold text-dark">${escapeHtml(b.eventName)}</div>
                    <div class="small text-muted"><span class="hall-pill ${b.hall === 'Hall 1' ? 'hall-1' : 'hall-2'} me-1">${b.hall}</span> ${b.bookingDate}</div>
                </td>
                <td class="text-end fw-semibold text-dark">₹${netRent.toLocaleString()}</td>
                <td class="text-end fw-semibold text-success">₹${netRentPaid.toLocaleString()}</td>
                <td class="text-end">${rentDueHTML}</td>
                <td class="text-end fw-semibold" style="color:#7c3aed;">₹${depositHeld.toLocaleString()}</td>
                <td>
                    <span class="badge-pay ${payStatusClass} mb-1 me-1">${f.paymentStatus || 'Unpaid'}</span>
                    <span class="badge-dep ${depStatusClass}">${f.depositStatus || 'N/A'}</span>
                </td>
                <td class="text-end pe-4" onclick="event.stopPropagation()">
                    <button class="btn btn-sm btn-outline-primary btn-view-customer-ledger py-1 px-2 me-1" data-id="${b.id}" title="View Full Transaction History">
                        <i class="bi bi-journal-text me-1"></i>View History
                    </button>
                </td>
            `;

            tr.addEventListener('click', () => {
                openViewBookingModal(b.id);
            });

            tbody.appendChild(tr);
        });

        document.querySelectorAll('.btn-view-customer-ledger').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openViewBookingModal(btn.getAttribute('data-id'));
            });
        });
    }

    function renderStatusSelectControl(bookingId, currentStatus, isReadonly = false) {
        if (isReadonly) {
            return `<span class="badge-status ${currentStatus}">${currentStatus}</span>`;
        }

        const statuses = ['Confirmed', 'Completed', 'Cancelled', 'Archived', 'Draft'];
        const optionsHTML = statuses.map(s => `
            <option value="${s}" ${s === currentStatus ? 'selected' : ''}>${s}</option>
        `).join('');

        return `
            <select class="status-select-control status-${currentStatus} status-select-trigger" data-id="${bookingId}" title="Change Booking Status">
                ${optionsHTML}
            </select>
        `;
    }

    function renderTodayDashboardEvents(events) {
        const container = document.getElementById('today-events-container');
        container.innerHTML = '';

        if (events.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4 text-muted">
                    <i class="bi bi-check-circle fs-3 text-success d-block mb-1"></i>
                    No events scheduled for today. Halls are <span class="badge bg-success-subtle text-success fw-semibold ms-1">Ready for Booking</span>
                </div>`;
            return;
        }

        events.forEach(b => {
            const isCompleted = b.status === 'Completed';
            const isReadOnly = (currentRole !== 'Admin');
            const div = document.createElement('div');
            div.className = `timeline-slot d-flex justify-content-between align-items-center ${isCompleted ? 'bg-light text-muted opacity-75 border-secondary' : ''}`;
            
            const statusControlHTML = renderStatusSelectControl(b.id, b.status, isReadOnly);

            div.innerHTML = `
                <div>
                    <h6 class="fw-bold mb-1 ${isCompleted ? 'text-decoration-line-through text-muted' : ''}">${escapeHtml(b.eventName)}</h6>
                    <div class="small text-muted">
                        <span class="fw-medium text-dark me-2"><i class="bi bi-person me-1"></i>${escapeHtml(b.customerName)}</span>
                        <span><i class="bi bi-clock me-1"></i>${b.startTime} - ${b.endTime}</span>
                    </div>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <span class="hall-pill ${(b.hall === 'Small Hall' || b.hall === 'Hall 1') ? 'hall-1' : 'hall-2'}">${b.hall}</span>
                    ${statusControlHTML}
                </div>
            `;
            container.appendChild(div);
        });

        if (currentRole === 'Admin') {
            container.querySelectorAll('.status-select-trigger').forEach(select => {
                select.addEventListener('change', (e) => {
                    handleEventStatusChange(select.getAttribute('data-id'), e.target.value);
                });
            });
        }
    }

    function renderRecentActivity(activities) {
        const container = document.getElementById('recent-activity-container');
        container.innerHTML = '';

        if (!activities || activities.length === 0) {
            container.innerHTML = `<div class="text-muted small">No recent activity.</div>`;
            return;
        }

        activities.forEach(b => {
            const item = document.createElement('div');
            item.className = 'd-flex align-items-center gap-3 pb-2 border-bottom';
            item.innerHTML = `
                <div class="rounded-circle bg-light p-2 text-primary">
                    <i class="bi bi-journal-plus"></i>
                </div>
                <div>
                    <div class="small fw-bold">${escapeHtml(b.eventName)}</div>
                    <div class="small text-muted">${b.hall} • ${b.bookingDate} (${b.status})</div>
                </div>
            `;
            container.appendChild(item);
        });
    }

    function renderAvailability(data) {
        const h1Container = document.getElementById('hall1-slots-container');
        const h2Container = document.getElementById('hall2-slots-container');

        const h1Slots = (data['Small Hall'] || data['Hall 1'] || {}).slots || [];
        const h2Slots = (data['Big Hall'] || data['Hall 2'] || {}).slots || [];

        document.getElementById('hall1-count-badge').textContent = `${h1Slots.length} Bookings`;
        document.getElementById('hall2-count-badge').textContent = `${h2Slots.length} Bookings`;

        renderHallSlotList(h1Slots, h1Container);
        renderHallSlotList(h2Slots, h2Container);
    }

    function renderHallSlotList(slots, container) {
        container.innerHTML = '';
        const activeSlots = slots.filter(s => s.status !== 'Cancelled' && s.status !== 'Archived');

        if (activeSlots.length === 0) {
            container.innerHTML = `
                <div class="alert alert-success border-0 py-3 mb-0 text-center">
                    <i class="bi bi-check-circle-fill me-2"></i>Hall is Ready for Booking (Empty/Available).
                </div>`;
            return;
        }

        activeSlots.forEach(s => {
            const isCompleted = s.status === 'Completed';
            const isReadOnly = (currentRole !== 'Admin');
            const slotDiv = document.createElement('div');
            slotDiv.className = `p-3 rounded-3 border-start border-4 ${isCompleted ? 'bg-light border-secondary text-muted opacity-75' : 'bg-light border-primary'}`;
            const statusControlHTML = renderStatusSelectControl(s.id, s.status, isReadOnly);

            slotDiv.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <h6 class="fw-bold mb-0 ${isCompleted ? 'text-decoration-line-through' : ''}">${escapeHtml(s.eventName)}</h6>
                    <div>${statusControlHTML}</div>
                </div>
                <div class="small text-muted mt-1">
                    <i class="bi bi-clock me-1"></i>${s.startTime} - ${s.endTime} | <i class="bi bi-person me-1"></i>${escapeHtml(s.customerName)}
                </div>
            `;
            container.appendChild(slotDiv);
        });

        if (currentRole === 'Admin') {
            container.querySelectorAll('.status-select-trigger').forEach(select => {
                select.addEventListener('change', (e) => {
                    handleEventStatusChange(select.getAttribute('data-id'), e.target.value);
                });
            });
        }
    }

    function renderCardsGrid(list, containerId, emptyMsg) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';

        if (list.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center py-5 text-muted">
                    <i class="bi bi-calendar2-x fs-2 d-block mb-2"></i>
                    ${emptyMsg}
                </div>`;
            return;
        }

        list.forEach(b => {
            const col = document.createElement('div');
            col.className = 'col-12 col-md-6 col-lg-4';
            const isCompleted = b.status === 'Completed';
            const isReadOnly = (currentRole !== 'Admin');
            const statusControlHTML = renderStatusSelectControl(b.id, b.status, isReadOnly);

            col.innerHTML = `
                <div class="card h-100 border-0 shadow-sm rounded-4 p-3 ${isCompleted ? 'bg-light text-muted opacity-75' : ''}">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="hall-pill ${b.hall === 'Hall 1' ? 'hall-1' : 'hall-2'}">${b.hall}</span>
                        <div>${statusControlHTML}</div>
                    </div>
                    <h6 class="fw-bold mb-1 ${isCompleted ? 'text-decoration-line-through' : ''}">${escapeHtml(b.eventName)}</h6>
                    <p class="small text-muted mb-2"><i class="bi bi-person me-1"></i>${escapeHtml(b.customerName)} (${b.mobileNumber})</p>
                    <div class="small text-dark fw-medium mt-auto border-top pt-2 d-flex justify-content-between align-items-center">
                        <div>
                            <i class="bi bi-calendar3 me-1 text-primary"></i>${b.bookingDate} | 
                            <i class="bi bi-clock me-1 text-primary"></i>${b.startTime} - ${b.endTime}
                        </div>
                        <button class="btn btn-sm btn-link text-primary p-0 btn-view-details-card ms-2" data-id="${b.id}" title="View Full Details">
                            <i class="bi bi-eye"></i>
                        </button>
                    </div>
                </div>
            `;
            container.appendChild(col);
        });

        if (currentRole === 'Admin') {
            container.querySelectorAll('.status-select-trigger').forEach(select => {
                select.addEventListener('change', (e) => {
                    handleEventStatusChange(select.getAttribute('data-id'), e.target.value);
                });
            });
        }

        container.querySelectorAll('.btn-view-details-card').forEach(btn => {
            btn.addEventListener('click', () => openViewBookingModal(btn.getAttribute('data-id')));
        });
    }

    // =========================================================================
    // =========================================================================
    // 5. VIEW BOOKING DETAILS & TIMELINE MODAL (5 TABS NAVIGATION)
    // =========================================================================

    async function openViewBookingModal(bookingId) {
        try {
            const bookingRes = await fetch(`/api/bookings/${bookingId}`);
            const bookingResult = await bookingRes.json();

            if (bookingResult.success) {
                const b = bookingResult.data;
                const f = b.financial || {};
                const body = document.getElementById('view-booking-modal-body');

                // Formatted CSS Badges
                const payStatusFormatted = (f.paymentStatus || 'Unpaid').replace(/ /g, '-').replace(/\(/g, '').replace(/\)/g, '');
                const depStatusFormatted = (f.depositStatus || 'Deposit-Pending').replace(/ /g, '-').replace(/\(/g, '').replace(/\)/g, '');

                // Overpayment Banner (visible when Paid > Net Rent)
                const overpayAlertHTML = (f.overpaidAmount > 0) ? `
                    <div class="alert alert-warning border-0 shadow-sm rounded-3 mb-3 d-flex justify-content-between align-items-center p-3" style="background-color: #fffbeb; border: 1px solid #fde68a;">
                        <div>
                            <i class="bi bi-exclamation-triangle-fill text-warning me-2 fs-5"></i>
                            <strong>Overpayment Notice:</strong> Customer has overpaid by <strong class="text-dark">₹${f.overpaidAmount.toLocaleString()}</strong> over the required Net Rent.
                        </div>
                        <button class="btn btn-sm btn-outline-danger fw-semibold px-3 py-1.5 btn-modal-refund-excess" data-id="${b.id}">
                            <i class="bi bi-arrow-counterclockwise me-1"></i>Refund Excess Amount
                        </button>
                    </div>
                ` : '';

                // Archived Notice
                const archivedNoticeHTML = b.status === 'Archived' ? `
                    <div class="alert alert-warning border-0 shadow-sm rounded-3 mb-3 d-flex justify-content-between align-items-center p-3">
                        <div>
                            <i class="bi bi-archive-fill me-2 fs-5 text-warning"></i>
                            <strong>Archived Booking Notice:</strong> Slot is freed for future bookings. Unarchive to restore to Confirmed state.
                        </div>
                        <button class="btn btn-sm btn-success px-3 py-2 btn-modal-unarchive fw-semibold" data-id="${b.id}">
                            <i class="bi bi-arrow-counterclockwise me-1"></i>Unarchive Booking
                        </button>
                    </div>
                ` : '';

                // Cancelled Notice
                const cancelledNoticeHTML = b.status === 'Cancelled' ? `
                    <div class="alert alert-danger border-0 shadow-sm rounded-3 mb-3 d-flex justify-content-between align-items-center p-3" style="background-color: #fef2f2; border: 1px solid #fecaca;">
                        <div>
                            <i class="bi bi-x-circle-fill me-2 fs-5 text-danger"></i>
                            <strong>Cancelled Booking Notice:</strong> Slot was freed upon cancellation. Revert cancellation to restore to Confirmed state.
                        </div>
                        <button class="btn btn-sm btn-success px-3 py-2 btn-modal-uncancel fw-semibold" data-id="${b.id}">
                            <i class="bi bi-arrow-counterclockwise me-1"></i>Revert Cancellation
                        </button>
                    </div>
                ` : '';

                // Completed Event with Dues Notice
                const completedPaymentPendingNoticeHTML = f.isCompletedPaymentPending ? `
                    <div class="alert alert-warning border-0 shadow-sm rounded-3 mb-3 d-flex justify-content-between align-items-center p-3" style="background-color: #fffbeb; border: 1px solid #fde68a;">
                        <div>
                            <i class="bi bi-exclamation-triangle-fill me-2 fs-5 text-warning"></i>
                            <strong>Event Completed – Payment Pending:</strong> Event schedule is completed, but outstanding rent dues (<strong>₹${f.remainingRent.toLocaleString()}</strong>) are pending.
                        </div>
                    </div>
                ` : '';

                body.innerHTML = `
                    <!-- 4-BADGE STATUS SUMMARY CARD -->
                    <div class="card border rounded-3 p-3 mb-3 bg-white shadow-sm">
                        <div class="row text-center g-3 align-items-center">
                            <div class="col-6 col-md-3">
                                <span class="text-muted small fw-semibold d-block mb-2">Booking Lifecycle</span>
                                <span class="badge-status ${b.status} d-inline-block px-3 py-1">${b.status}</span>
                            </div>
                            <div class="col-6 col-md-3">
                                <span class="text-muted small fw-semibold d-block mb-2">Payment Status</span>
                                <span class="badge-pay ${payStatusFormatted} d-inline-block px-3 py-1">${f.paymentStatus || 'Unpaid'}</span>
                            </div>
                            <div class="col-6 col-md-3">
                                <span class="text-muted small fw-semibold d-block mb-2">Security Deposit Status</span>
                                <span class="badge-dep ${depStatusFormatted} d-inline-block px-3 py-1">${f.depositStatus || 'Deposit Pending'}</span>
                            </div>
                            <div class="col-6 col-md-3">
                                <span class="text-muted small fw-semibold d-block mb-2">Hall Availability Slot</span>
                                <span class="badge bg-dark text-white rounded-pill d-inline-block px-3 py-1">${f.hallAvailabilityStatus || 'Slot Occupied'}</span>
                            </div>
                        </div>
                    </div>

                    ${archivedNoticeHTML}
                    ${cancelledNoticeHTML}
                    ${completedPaymentPendingNoticeHTML}
                    ${overpayAlertHTML}

                    <!-- 5 TABS NAVIGATION (EVENT DETAILS, CONTRACT DETAILS, FINANCIAL LEDGER, ACTIVITY TIMELINE, AUDIT TRAIL & GATE STYLE DIFFERENCE) -->
                    <ul class="nav nav-tabs nav-tabs-custom mb-3" id="bookingTab" role="tablist">
                        <li class="nav-item" role="presentation">
                            <button class="nav-link active fw-semibold" id="event-tab" data-bs-toggle="tab" data-bs-target="#tab-event" type="button">
                                <i class="bi bi-file-earmark-person me-2"></i>Event Details
                            </button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link fw-semibold" id="contract-tab" data-bs-toggle="tab" data-bs-target="#tab-contract" type="button">
                                <i class="bi bi-calculator me-2"></i>Contract Details
                            </button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link fw-semibold" id="ledger-tab" data-bs-toggle="tab" data-bs-target="#tab-ledger" type="button">
                                <i class="bi bi-wallet2 me-2"></i>Financial Ledger
                            </button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link fw-semibold" id="timeline-tab" data-bs-toggle="tab" data-bs-target="#tab-timeline" type="button">
                                <i class="bi bi-clock-history me-2"></i>Activity Timeline
                            </button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link fw-semibold" id="audit-tab" data-bs-toggle="tab" data-bs-target="#tab-audit" type="button">
                                <i class="bi bi-shield-check me-2"></i>Audit Trail & Gate Style Difference
                            </button>
                        </li>
                    </ul>

                    <div class="tab-content" id="bookingTabContent">
                        <!-- TAB 1: EVENT DETAILS -->
                        <div class="tab-pane fade show active p-1" id="tab-event">
                            <div class="card border rounded-3 p-4 bg-white shadow-sm mb-3">
                                <div class="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
                                    <h6 class="fw-bold text-primary mb-0"><i class="bi bi-person-badge me-2"></i>Customer & Event Information</h6>
                                    <div class="d-flex gap-2">
                                        ${currentRole === 'Admin' && b.status !== 'Archived' ? `
                                            <button class="btn btn-sm btn-outline-primary btn-modal-edit-booking" data-id="${b.id}">
                                                <i class="bi bi-pencil-square me-1"></i>Edit Booking Details
                                            </button>
                                        ` : ''}
                                    </div>
                                </div>
                                <div class="row g-3">
                                    <div class="col-12 col-md-6">
                                        <div class="p-3 bg-light rounded-3 h-100">
                                            <div class="mb-2"><strong>Booking ID:</strong> <span class="text-primary fw-bold font-monospace">${b.id}</span></div>
                                            <div class="mb-2"><strong>Customer / Organizer:</strong> ${escapeHtml(b.customerName)}</div>
                                            <div class="mb-2"><strong>Mobile Number:</strong> <a href="tel:${escapeHtml(b.mobileNumber)}" class="text-decoration-none"><i class="bi bi-telephone me-1"></i>${escapeHtml(b.mobileNumber)}</a></div>
                                            <div class="mb-0"><strong>Event Purpose / Title:</strong> ${escapeHtml(b.eventName)}</div>
                                        </div>
                                    </div>
                                    <div class="col-12 col-md-6">
                                        <div class="p-3 bg-light rounded-3 h-100">
                                            <div class="mb-2"><strong>Hall Allocated:</strong> <span class="hall-pill ${b.hall === 'Hall 1' ? 'hall-1' : 'hall-2'}">${b.hall}</span></div>
                                            <div class="mb-2"><strong>Event Date:</strong> <i class="bi bi-calendar-event me-1 text-primary"></i>${b.bookingDate}</div>
                                            <div class="mb-2"><strong>Time Slot:</strong> <i class="bi bi-clock me-1 text-primary"></i>${b.startTime} - ${b.endTime}</div>
                                            <div class="mb-0"><strong>Booking Status:</strong> <span class="badge-status ${b.status} px-2 py-0.5">${b.status}</span></div>
                                        </div>
                                    </div>
                                    <div class="col-12">
                                        <div class="p-3 bg-light rounded-3">
                                            <strong>Special Notes / Equipment Requirements:</strong>
                                            <p class="text-muted mb-0 mt-1">${escapeHtml(b.notes || 'No special requirements noted for this booking.')}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- TAB 2: CONTRACT DETAILS -->
                        <div class="tab-pane fade p-1" id="tab-contract">
                            <div class="row g-3 mb-3">
                                <div class="col-12 col-md-7">
                                    <div class="p-3 bg-white border rounded-3 h-100 shadow-sm">
                                        <div class="d-flex justify-content-between align-items-center mb-2 pb-1 border-bottom">
                                            <h6 class="fw-bold text-success mb-0"><i class="bi bi-calculator me-2"></i>Financial Contract Summary</h6>
                                            <div class="d-flex gap-1">
                                                ${f.canProcessFinancials ? `
                                                    <button class="btn btn-sm btn-outline-primary btn-modal-add-charge py-0.5 px-2" data-id="${b.id}"><i class="bi bi-plus-circle me-1"></i>Extra Charge</button>
                                                    <button class="btn btn-sm btn-outline-success btn-modal-approve-discount py-0.5 px-2" data-id="${b.id}"><i class="bi bi-percent me-1"></i>Discount</button>
                                                ` : ''}
                                            </div>
                                        </div>
                                        <div class="d-flex justify-content-between py-1.5 border-bottom"><span>Base Hall Rent:</span> <strong>₹${(f.hallRent || 0).toLocaleString()}</strong></div>
                                        ${f.baseDiscount > 0 ? `
                                            <div class="d-flex justify-content-between py-1.5 border-bottom text-success"><span>Initial Base Discount:</span> <strong>-₹${f.baseDiscount.toLocaleString()}</strong></div>
                                        ` : ''}
                                        ${(f.discountsList || []).map(d => `
                                            <div class="d-flex justify-content-between py-1.5 border-bottom text-success"><span>Approved Discount (${escapeHtml(d.reason)}):</span> <strong>-₹${d.amount.toLocaleString()}</strong></div>
                                        `).join('')}
                                        ${(f.extraChargesList || []).map(c => `
                                            <div class="d-flex justify-content-between py-1.5 border-bottom text-primary"><span>Extra Charge (${escapeHtml(c.category)}):</span> <strong>+₹${c.amount.toLocaleString()}</strong></div>
                                        `).join('')}
                                        <div class="d-flex justify-content-between py-2 border-bottom fw-bold text-dark fs-6 bg-light px-2 rounded"><span>Net Hall Rent:</span> <strong>₹${(f.netRent || 0).toLocaleString()}</strong></div>
                                        ${f.showDepositInContract ? `
                                            <div class="d-flex justify-content-between py-1.5 border-bottom text-purple" style="color:#7c3aed;"><span>Security Deposit Configured:</span> <strong>₹${(f.securityDeposit || 0).toLocaleString()}</strong></div>
                                        ` : ''}
                                        <div class="d-flex justify-content-between py-2 fw-bold text-primary fs-6"><span>Total Contract Amount:</span> <strong>₹${(f.totalContractAmount || 0).toLocaleString()}</strong></div>
                                    </div>
                                </div>

                                <div class="col-12 col-md-5">
                                    <div class="p-3 bg-white border rounded-3 h-100 shadow-sm">
                                        <h6 class="fw-bold mb-2 pb-1 border-bottom text-dark"><i class="bi bi-cash-stack me-2 text-success"></i>Current Account Balances</h6>
                                        <div class="vstack gap-2 mt-2">
                                            <div class="p-2.5 bg-light rounded border d-flex justify-content-between align-items-center">
                                                <div class="text-muted small">Net Rent Paid</div>
                                                <div class="fw-bold text-success fs-6">₹${(f.netRentPaid || 0).toLocaleString()}</div>
                                            </div>
                                            <div class="p-2.5 bg-light rounded border d-flex justify-content-between align-items-center">
                                                <div class="text-muted small">Remaining Rent Due</div>
                                                <div class="fw-bold ${f.overpaidAmount > 0 ? 'text-warning' : ((f.remainingRent || 0) > 0 ? 'text-danger' : 'text-success')} fs-6">
                                                    ${f.overpaidAmount > 0 ? `Overpaid ₹${f.overpaidAmount.toLocaleString()}` : `₹${(f.remainingRent || 0).toLocaleString()}`}
                                                </div>
                                            </div>
                                            <div class="p-2.5 bg-light rounded border d-flex justify-content-between align-items-center">
                                                <div class="text-muted small">Security Deposit Paid</div>
                                                <div class="fw-bold fs-6" style="color:#7c3aed;">₹${(f.depositPaid || 0).toLocaleString()}</div>
                                            </div>
                                            <div class="p-2.5 bg-light rounded border d-flex justify-content-between align-items-center">
                                                <div class="text-muted small">Effective Deposit Held</div>
                                                <div class="fw-bold text-primary fs-6">₹${(f.effectiveDepositHeld || 0).toLocaleString()}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- ITEMIZATION CARDS (Extra Charges & Discounts) -->
                            <div class="row g-3">
                                <div class="col-12 col-md-6">
                                    <div class="card border p-3 rounded-3 bg-white h-100 shadow-sm">
                                        <h6 class="fw-bold text-dark mb-2"><i class="bi bi-receipt-cutoff me-2 text-primary"></i>Itemized Extra Charges</h6>
                                        ${((b.contract && b.contract.extraChargesList) || []).length === 0 ? `
                                            <div class="text-muted small py-2">No extra charges added yet.</div>
                                        ` : `
                                            <div class="vstack gap-2">
                                                ${b.contract.extraChargesList.map(c => `
                                                    <div class="d-flex justify-content-between align-items-center p-2 bg-light rounded border">
                                                        <div>
                                                            <div class="fw-bold text-dark small">${escapeHtml(c.category)}: <span class="text-primary">+₹${c.amount.toLocaleString()}</span></div>
                                                            <div class="text-muted" style="font-size:0.75rem;">${escapeHtml(c.remarks || 'No remarks')} • ${c.date}</div>
                                                        </div>
                                                        ${currentRole === 'Admin' ? `
                                                            <button type="button" class="btn btn-sm btn-outline-danger btn-revert-charge py-0.5 px-2" data-id="${b.id}" data-charge-id="${c.id}">
                                                                <i class="bi bi-arrow-counterclockwise me-1"></i>Revert
                                                            </button>
                                                        ` : ''}
                                                    </div>
                                                `).join('')}
                                            </div>
                                        `}
                                    </div>
                                </div>

                                <div class="col-12 col-md-6">
                                    <div class="card border p-3 rounded-3 bg-white h-100 shadow-sm">
                                        <h6 class="fw-bold text-dark mb-2"><i class="bi bi-tags me-2 text-success"></i>Itemized Approved Discounts</h6>
                                        ${((b.contract && b.contract.baseDiscount > 0) || ((b.contract && b.contract.discountsList) || []).length > 0) ? `
                                            <div class="vstack gap-2">
                                                ${b.contract && b.contract.baseDiscount > 0 ? `
                                                    <div class="d-flex justify-content-between align-items-center p-2 bg-light rounded border">
                                                        <div>
                                                            <div class="fw-bold text-dark small">Base Discount: <span class="text-success">-₹${b.contract.baseDiscount.toLocaleString()}</span></div>
                                                            <div class="text-muted" style="font-size:0.75rem;">Initial Base Discount</div>
                                                        </div>
                                                        ${currentRole === 'Admin' ? `
                                                            <button type="button" class="btn btn-sm btn-outline-danger btn-revert-discount py-0.5 px-2" data-id="${b.id}" data-discount-id="BASE_DISCOUNT">
                                                                <i class="bi bi-arrow-counterclockwise me-1"></i>Revert
                                                            </button>
                                                        ` : ''}
                                                    </div>
                                                ` : ''}
                                                ${(b.contract.discountsList || []).map(d => `
                                                    <div class="d-flex justify-content-between align-items-center p-2 bg-light rounded border">
                                                        <div>
                                                            <div class="fw-bold text-dark small">Discount: <span class="text-success">-₹${d.amount.toLocaleString()}</span></div>
                                                            <div class="text-muted" style="font-size:0.75rem;">Reason: ${escapeHtml(d.reason)} • ${d.date}</div>
                                                        </div>
                                                        ${currentRole === 'Admin' ? `
                                                            <button type="button" class="btn btn-sm btn-outline-danger btn-revert-discount py-0.5 px-2" data-id="${b.id}" data-discount-id="${d.id}">
                                                                <i class="bi bi-arrow-counterclockwise me-1"></i>Revert
                                                            </button>
                                                        ` : ''}
                                                    </div>
                                                `).join('')}
                                            </div>
                                        ` : `
                                            <div class="text-muted small py-2">No discounts approved yet.</div>
                                        `}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- TAB 3: FINANCIAL LEDGER (INDIVIDUAL CUSTOMER LEDGER ONLY) -->
                        <div class="tab-pane fade p-1" id="tab-ledger">
                            <!-- SEARCH & FINANCIAL ACTIONS TOOLBAR -->
                            <div class="p-3 bg-light border rounded-3 mb-3">
                                <div class="row g-2 align-items-center">
                                    <div class="col-12 col-md-5">
                                        <div class="input-group input-group-sm">
                                            <span class="input-group-text bg-white border-end-0"><i class="bi bi-search text-muted"></i></span>
                                            <input type="text" class="form-control border-start-0" id="modal-ledger-search-input" placeholder="Search by Receipt No, Type, Method...">
                                        </div>
                                    </div>
                                    <div class="col-12 col-md-7 text-md-end">
                                        <div class="d-flex flex-wrap gap-2 justify-content-md-end">
                                            <button class="btn btn-sm btn-outline-dark btn-print-full-receipt" data-id="${b.id}">
                                                <i class="bi bi-printer me-1"></i>Print Statement
                                            </button>
                                            ${f.canProcessFinancials ? `
                                                ${(f.remainingRent || 0) > 0 ? `<button class="btn btn-sm btn-success btn-modal-collect-pay" data-id="${b.id}"><i class="bi bi-cash-stack me-1"></i>Collect Payment</button>` : ''}
                                                <button class="btn btn-sm btn-primary btn-modal-manage-dep" data-id="${b.id}">
                                                    <i class="bi bi-shield-check me-1"></i>${(f.effectiveDepositHeld || 0) > 0 ? `Manage Deposit (₹${f.effectiveDepositHeld.toLocaleString()} Held)` : 'Collect / Manage Deposit'}
                                                </button>
                                            ` : `
                                                <span class="badge bg-secondary-subtle text-secondary border py-1.5 px-3">
                                                    <i class="bi bi-archive me-1"></i>Archived — Financial Actions Locked
                                                </span>
                                            `}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- RECORDED RECEIPTS & TRANSACTION HISTORY TABLE -->
                            <div class="card border p-3 rounded-3 bg-white mb-3 shadow-sm">
                                <h6 class="fw-bold mb-2 text-dark"><i class="bi bi-receipt me-2 text-primary"></i>Official Transaction & Receipt History</h6>
                                ${(() => {
                                    const ledgerItems = [
                                        ...(f.transactions || []).map(t => ({
                                            id: t.receiptNumber,
                                            date: `${t.date} ${t.time}`,
                                            type: t.type,
                                            details: `Method: ${t.paymentMethod} (Ref: ${t.referenceNumber || 'N/A'})`,
                                            amount: t.amount,
                                            isNegative: t.type.includes('Return') || t.type.includes('Refund'),
                                            isVoided: t.isVoided,
                                            rawTxn: t
                                        }))
                                    ];

                                    if (ledgerItems.length === 0) {
                                        return `<div class="text-muted small py-3 text-center"><i class="bi bi-journal-x me-1"></i>No payment transactions recorded in ledger for this customer yet.</div>`;
                                    }

                                    return `
                                        <div class="table-responsive">
                                            <table class="table table-sm table-hover table-bordered align-middle mb-0" id="modal-ledger-table">
                                                <thead class="table-light">
                                                    <tr>
                                                        <th>Receipt No</th>
                                                        <th>Category / Type</th>
                                                        <th>Transaction Details</th>
                                                        <th class="text-end">Amount</th>
                                                        <th>Status</th>
                                                        <th class="text-end pe-3">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    ${ledgerItems.map(item => `
                                                        <tr class="ledger-row ${item.isVoided ? 'bg-light text-muted opacity-75' : ''}" data-search-text="${(item.id + ' ' + item.type + ' ' + item.details + ' ' + b.id + ' ' + b.customerName).toLowerCase()}">
                                                            <td class="fw-semibold text-primary font-monospace">${item.id}</td>
                                                            <td><span class="badge-txn-type ${item.type.includes('Deposit') ? 'badge-txn-deposit' : (item.type.includes('Advance') ? 'badge-txn-advance' : (item.type.includes('Refund') ? 'badge-txn-refund' : 'badge-txn-rent'))}">${item.type}</span></td>
                                                            <td class="small text-muted">${item.details}</td>
                                                            <td class="text-end fw-bold ${item.isVoided ? 'text-decoration-line-through text-muted' : (item.isNegative ? 'text-danger' : 'text-dark')}">${item.isNegative ? '-' : '+'}₹${item.amount.toLocaleString()}</td>
                                                            <td>${item.isVoided ? '<span class="badge bg-danger-subtle text-danger border border-danger-subtle">VOIDED</span>' : '<span class="badge bg-success-subtle text-success border border-success-subtle">Active</span>'}</td>
                                                            <td class="text-end pe-3">
                                                                ${item.rawTxn && !item.isVoided ? `
                                                                    <button class="btn btn-sm btn-outline-dark py-0.5 px-2 btn-print-rcpt me-1" data-id="${b.id}" data-rcpt="${item.rawTxn.receiptNumber}" title="Print / Download Receipt">
                                                                        <i class="bi bi-printer me-1"></i>Receipt
                                                                    </button>
                                                                ` : ''}
                                                                ${item.rawTxn && !item.isVoided && currentRole === 'Admin' ? `
                                                                    <button class="btn btn-sm btn-outline-danger py-0.5 px-2 btn-modal-void-rcpt" data-rcpt="${item.rawTxn.receiptNumber}">
                                                                        <i class="bi bi-slash-circle me-1"></i>Void
                                                                    </button>
                                                                ` : ''}
                                                            </td>
                                                        </tr>
                                                    `).join('')}
                                                </tbody>
                                            </table>
                                        </div>
                                    `;
                                })()}
                            </div>
                        </div>

                        <!-- TAB 4: ACTIVITY TIMELINE -->
                        <div class="tab-pane fade p-1" id="tab-timeline">
                            <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                                <span class="fw-bold text-dark"><i class="bi bi-clock-history me-2 text-primary"></i>Activity & Lifecycle Timeline</span>
                            </div>
                            ${(b.timeline || []).length === 0 ? `
                                <div class="text-center py-4 text-muted">
                                    <i class="bi bi-clock-history fs-3 d-block mb-1"></i>
                                    No activity timeline recorded for this booking.
                                </div>
                            ` : `
                                <div class="vstack gap-2">
                                    ${[...(b.timeline || [])].reverse().map(t => {
                                        let catBadge = '<span class="badge bg-primary-subtle text-primary border border-primary-subtle"><i class="bi bi-calendar-event me-1"></i>Booking</span>';
                                        if (t.category === 'Financial') {
                                            catBadge = '<span class="badge bg-success-subtle text-success border border-success-subtle"><i class="bi bi-cash-stack me-1"></i>Financial</span>';
                                        } else if (t.category === 'Lifecycle') {
                                            catBadge = '<span class="badge bg-warning-subtle text-warning border border-warning-subtle"><i class="bi bi-arrow-repeat me-1"></i>Lifecycle</span>';
                                        }

                                        return `
                                            <div class="card border-0 shadow-sm rounded-3 compact-timeline-card bg-white border-start border-4 ${t.category === 'Financial' ? 'border-success' : 'border-primary'}">
                                                <div class="d-flex justify-content-between align-items-start mb-0.5">
                                                    <div class="fw-bold text-dark fs-6">${escapeHtml(t.title)}</div>
                                                    <div class="d-flex align-items-center gap-2">
                                                        ${catBadge}
                                                        <span class="small text-muted"><i class="bi bi-clock me-1"></i>${t.date} ${t.time}</span>
                                                    </div>
                                                </div>
                                                ${t.description ? `<div class="small text-secondary mb-1">${escapeHtml(t.description)}</div>` : ''}
                                                <div class="small text-muted d-flex align-items-center gap-1">
                                                    <i class="bi bi-person-circle me-1"></i>User: <strong>${escapeHtml(t.user || 'Admin')}</strong>
                                                </div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            `}
                        </div>

                        <!-- TAB 5: AUDIT TRAIL & GATE STYLE DIFFERENCE (PERSON-SPECIFIC) -->
                        <div class="tab-pane fade p-1" id="tab-audit">
                            <div class="card border p-3 rounded-3 bg-white shadow-sm">
                                <div class="d-flex flex-wrap justify-content-between align-items-center mb-3 pb-2 border-bottom gap-2">
                                    <div>
                                        <h6 class="fw-bold text-dark mb-0">
                                            <i class="bi bi-shield-check me-2 text-primary"></i>Audit Trail & Gate Style Difference
                                        </h6>
                                        <small class="text-muted">Viewing audit logs & field-level diffs for <strong>${escapeHtml(b.customerName)}</strong> (${b.id})</small>
                                    </div>
                                    <div class="d-flex align-items-center gap-2">
                                        <span class="badge bg-primary-subtle text-primary border border-primary-subtle">${(b.auditLogs || []).length} Person Audit Entries</span>
                                    </div>
                                </div>
                                ${(b.auditLogs || []).length === 0 ? `
                                    <div class="text-muted small py-4 text-center">
                                        <i class="bi bi-journal-x fs-3 d-block mb-2 text-muted"></i>
                                        No audit log records found for ${escapeHtml(b.customerName)} (${b.id}).
                                    </div>
                                ` : `
                                    <div class="mb-3">
                                        <div class="input-group input-group-sm">
                                            <span class="input-group-text bg-white border-end-0"><i class="bi bi-search text-muted"></i></span>
                                            <input type="text" class="form-control border-start-0" id="modal-audit-search-input" placeholder="Filter this person's audit entries by action, module, diff, user...">
                                        </div>
                                    </div>
                                    <div class="table-responsive">
                                        <table class="table table-hover table-sm align-middle mb-0">
                                            <thead class="table-light">
                                                <tr>
                                                    <th>Audit ID</th>
                                                    <th>Module</th>
                                                    <th>Action Performed</th>
                                                    <th style="min-width: 260px;">Gate Style Difference</th>
                                                    <th>Date & Time</th>
                                                    <th>User</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${(b.auditLogs || []).map(a => {
                                                    let modBadge = '<span class="badge bg-primary-subtle text-primary border border-primary-subtle"><i class="bi bi-calendar-event me-1"></i>Booking</span>';
                                                    if (a.module === 'Financial Contract') {
                                                        modBadge = '<span class="badge bg-success-subtle text-success border border-success-subtle"><i class="bi bi-calculator me-1"></i>Contract</span>';
                                                    } else if (a.module === 'Payment Ledger') {
                                                        modBadge = '<span class="badge bg-info-subtle text-info border border-info-subtle"><i class="bi bi-journal-text me-1"></i>Ledger</span>';
                                                    }

                                                    const searchText = `${a.id} ${a.module} ${a.action} ${a.user} ${a.date} ${JSON.stringify(a.changes || {})}`.toLowerCase();

                                                    return `
                                                        <tr class="modal-audit-row" data-search-text="${escapeHtml(searchText)}">
                                                            <td class="fw-bold text-dark font-monospace">${a.id}</td>
                                                            <td>${modBadge}</td>
                                                            <td class="fw-semibold text-dark">${escapeHtml(a.action)}</td>
                                                            <td>${renderDiffCell(a)}</td>
                                                            <td class="small text-muted text-nowrap">${a.date}<br>${a.time}</td>
                                                            <td><span class="badge bg-light text-dark border"><i class="bi bi-person me-1"></i>${escapeHtml(a.user || 'Admin')}</span></td>
                                                        </tr>
                                                    `;
                                                }).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                `}
                            </div>
                        </div>
                    </div>
                `;

                // Search Filter Listener in Ledger Tab
                const ledgerSearchInput = body.querySelector('#modal-ledger-search-input');
                if (ledgerSearchInput) {
                    ledgerSearchInput.addEventListener('input', (e) => {
                        const term = (e.target.value || '').toLowerCase().trim();
                        body.querySelectorAll('.ledger-row').forEach(row => {
                            const text = row.getAttribute('data-search-text') || '';
                            if (!term || text.includes(term)) {
                                row.classList.remove('d-none');
                            } else {
                                row.classList.add('d-none');
                            }
                        });
                    });
                }

                // Search Filter Listener in Person Audit Tab
                const modalAuditSearchInput = body.querySelector('#modal-audit-search-input');
                if (modalAuditSearchInput) {
                    modalAuditSearchInput.addEventListener('input', (e) => {
                        const term = (e.target.value || '').toLowerCase().trim();
                        body.querySelectorAll('.modal-audit-row').forEach(row => {
                            const text = row.getAttribute('data-search-text') || '';
                            if (!term || text.includes(term)) {
                                row.classList.remove('d-none');
                            } else {
                                row.classList.add('d-none');
                            }
                        });
                    });
                }

                // Add Event Listeners for Buttons inside Modal
                body.querySelectorAll('.btn-revert-charge').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const bId = btn.getAttribute('data-id');
                        const cId = btn.getAttribute('data-charge-id');
                        handleRevertExtraCharge(bId, cId);
                    });
                });

                body.querySelectorAll('.btn-revert-discount').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const bId = btn.getAttribute('data-id');
                        const dId = btn.getAttribute('data-discount-id');
                        handleRevertDiscount(bId, dId);
                    });
                });

                body.querySelectorAll('.btn-modal-add-charge').forEach(btn => {
                    btn.addEventListener('click', () => {
                        openQuickExtraChargeModal(bookingId);
                    });
                });

                body.querySelectorAll('.btn-modal-approve-discount').forEach(btn => {
                    btn.addEventListener('click', () => {
                        openQuickDiscountModal(bookingId);
                    });
                });

                const modalEditBookingBtn = body.querySelector('.btn-modal-edit-booking');
                if (modalEditBookingBtn) {
                    modalEditBookingBtn.addEventListener('click', () => {
                        viewBookingModal.hide();
                        openEditModal(bookingId);
                    });
                }

                const modalUnarchiveBtn = body.querySelector('.btn-modal-unarchive');
                if (modalUnarchiveBtn) {
                    modalUnarchiveBtn.addEventListener('click', () => {
                        handleUnarchiveBooking(bookingId);
                    });
                }

                const modalUncancelBtn = body.querySelector('.btn-modal-uncancel');
                if (modalUncancelBtn) {
                    modalUncancelBtn.addEventListener('click', () => {
                        handleUncancelBooking(bookingId);
                    });
                }

                body.querySelectorAll('.btn-modal-collect-pay').forEach(btn => {
                    btn.addEventListener('click', () => {
                        openPaymentModal(btn.getAttribute('data-id'));
                    });
                });

                body.querySelectorAll('.btn-modal-manage-dep').forEach(btn => {
                    btn.addEventListener('click', () => {
                        openDepositActionModal(btn.getAttribute('data-id'));
                    });
                });

                body.querySelectorAll('.btn-modal-refund-excess').forEach(btn => {
                    btn.addEventListener('click', () => {
                        openDepositActionModal(btn.getAttribute('data-id'));
                    });
                });

                body.querySelectorAll('.btn-modal-void-rcpt').forEach(btn => {
                    btn.addEventListener('click', () => {
                        openVoidModal(btn.getAttribute('data-rcpt'));
                    });
                });

                body.querySelectorAll('.btn-print-full-receipt').forEach(btn => {
                    btn.addEventListener('click', () => {
                        printReceipt(bookingId);
                    });
                });

                body.querySelectorAll('.btn-print-rcpt').forEach(btn => {
                    btn.addEventListener('click', () => {
                        openReceiptModal(btn.getAttribute('data-rcpt'));
                    });
                });

                viewBookingModal.show();
            }
        } catch (err) {
            console.error("Error opening view modal:", err);
        }
    }

    async function printReceipt(bookingId, transactionId = null) {
        try {
            const res = await fetch(`/api/bookings/${bookingId}`);
            const result = await res.json();
            if (!result.success) {
                showToast("Failed to fetch booking for receipt.");
                return;
            }
            const b = result.data;
            const f = b.financial || {};
            
            let receiptTitle = "FULL BOOKING RECEIPT";
            let transactionsToPrint = (f.transactions || []).filter(t => !t.isVoided);
            
            if (transactionId) {
                receiptTitle = "TRANSACTION RECEIPT";
                const txn = transactionsToPrint.find(t => t.receiptNumber === transactionId);
                if (txn) {
                    transactionsToPrint = [txn];
                } else {
                    showToast("Transaction not found or is voided.");
                    return;
                }
            }

            if (transactionsToPrint.length === 0) {
                showToast("No active transactions available to print.");
                return;
            }

            const printWindow = window.open('', '_blank', 'width=800,height=600');
            
            const html = `
                <html>
                <head>
                    <title>Receipt - ${bookingId}</title>
                    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                    <style>
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; }
                        .receipt-header { border-bottom: 2px solid #ddd; padding-bottom: 20px; margin-bottom: 20px; }
                        .receipt-footer { border-top: 2px solid #ddd; padding-top: 20px; margin-top: 40px; text-align: center; font-size: 0.9rem; color: #666; }
                        @media print {
                            body { -webkit-print-color-adjust: exact; padding: 0; }
                            .no-print { display: none !important; }
                        }
                    </style>
                </head>
                <body>
                    <div class="container-fluid">
                        <div class="text-end mb-3 no-print">
                            <button onclick="window.print()" class="btn btn-primary">Print Receipt</button>
                        </div>
                        <div class="receipt-header text-center">
                            <h2 class="mb-1 text-primary fw-bold">HALL MANAGEMENT SYSTEM</h2>
                            <h5 class="text-secondary fw-semibold">${receiptTitle}</h5>
                        </div>
                        
                        <div class="row mb-4">
                            <div class="col-6">
                                <h6 class="text-muted mb-1 border-bottom pb-1">Customer Information</h6>
                                <strong>${escapeHtml(b.customerName)}</strong><br>
                                Mobile: ${escapeHtml(b.mobileNumber)}<br>
                            </div>
                            <div class="col-6 text-end">
                                <h6 class="text-muted mb-1 border-bottom pb-1">Booking Details</h6>
                                Booking ID: <strong>${b.id}</strong><br>
                                Event: ${escapeHtml(b.eventName)}<br>
                                Hall: <strong>${b.hall}</strong> | Date: ${b.bookingDate}
                            </div>
                        </div>

                        <h6 class="mb-2 text-dark">Payment Transactions</h6>
                        <table class="table table-bordered align-middle">
                            <thead class="table-light">
                                <tr>
                                    <th>Receipt No / Date</th>
                                    <th>Type / Method</th>
                                    <th>Reference</th>
                                    <th class="text-end">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${transactionsToPrint.map(t => `
                                    <tr>
                                        <td><strong class="text-primary">${t.receiptNumber}</strong><br><small class="text-muted">${t.date} ${t.time}</small></td>
                                        <td>${t.type}<br><small class="text-muted">${t.paymentMethod}</small></td>
                                        <td>${t.referenceNumber || '-'}</td>
                                        <td class="text-end"><strong>₹${t.amount.toLocaleString()}</strong></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                            ${!transactionId ? `
                            <tfoot>
                                <tr>
                                    <th colspan="3" class="text-end text-muted">Total Net Rent Paid</th>
                                    <th class="text-end">₹${(f.netRentPaid || 0).toLocaleString()}</th>
                                </tr>
                                <tr>
                                    <th colspan="3" class="text-end text-muted">Total Security Deposit Paid</th>
                                    <th class="text-end">₹${(f.depositPaid || 0).toLocaleString()}</th>
                                </tr>
                                <tr>
                                    <th colspan="3" class="text-end bg-light">Remaining Rent Due</th>
                                    <th class="text-end bg-light text-danger">₹${(f.remainingRent || 0).toLocaleString()}</th>
                                </tr>
                            </tfoot>
                            ` : ''}
                        </table>
                        
                        <div class="receipt-footer">
                            <p>This is a computer-generated receipt. Thank you for your business!</p>
                        </div>
                    </div>
                    <script>
                        window.onload = function() { window.print(); }
                    </script>
                </body>
                </html>
            `;
            
            printWindow.document.write(html);
            printWindow.document.close();
            
        } catch (err) {
            console.error("Error generating receipt:", err);
            showToast("An error occurred while generating the receipt.");
        }
    }

    // =========================================================================
    // 6. PAYMENTS VIEW INTERACTIVE SELECTOR
    // =========================================================================

    const paySelectBooking = document.getElementById('pay-select-booking');
    if (paySelectBooking) {
        paySelectBooking.addEventListener('change', async (e) => {
            const bookingId = e.target.value;
            const container = document.getElementById('pay-selected-booking-card');
            if (!bookingId) {
                if (container) container.classList.add('d-none');
                return;
            }

        try {
            const res = await fetch(`/api/payments/booking/${bookingId}`);
            const result = await res.json();
            if (result.success) {
                const f = result.data;
                container.classList.remove('d-none');
                const cardActionButtonsHTML = (() => {
                    if (!f.canProcessFinancials) {
                        return `
                            <div class="mt-2 text-end">
                                <span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle px-3 py-2 fs-6">
                                    <i class="bi bi-archive me-1"></i>Archived — Financial actions locked
                                </span>
                            </div>
                        `;
                    }
                    const depositLabel = f.effectiveDepositHeld > 0
                        ? `Manage Deposit (₹${f.effectiveDepositHeld.toLocaleString()} Held)`
                        : (f.securityDeposit > 0 ? 'Manage Deposit' : 'Collect Deposit');
                    return `
                        <div class="d-flex gap-2 mt-2 justify-content-end">
                            ${f.remainingRent > 0 ? `<button class="btn btn-sm btn-success btn-pay-record" data-id="${f.bookingId}"><i class="bi bi-cash-stack me-1"></i>Collect Payment</button>` : ''}
                            <button class="btn btn-sm btn-primary btn-dep-action" data-id="${f.bookingId}"><i class="bi bi-shield-check me-1"></i>${depositLabel}</button>
                        </div>
                    `;
                })();

                const completedCardNotice = f.isCompletedPaymentPending ? `
                    <div class="alert alert-warning border-0 shadow-sm p-2 mb-3 rounded-3 small d-flex align-items-center" style="background-color: #fffbeb; border: 1px solid #fde68a;">
                        <i class="bi bi-exclamation-triangle-fill me-2 text-warning fs-6"></i>
                        <span><strong>Event Completed – Payment Pending:</strong> Event schedule is completed, but outstanding dues (<strong>₹${f.remainingRent.toLocaleString()}</strong>) are pending settlement.</span>
                    </div>
                ` : '';

                container.innerHTML = `
                    ${completedCardNotice}
                    <div class="d-flex flex-wrap justify-content-between align-items-center gap-3">
                        <div>
                            <h6 class="fw-bold text-primary mb-1">${f.bookingId} - ${escapeHtml(f.eventName)}</h6>
                            <div class="small text-muted"><i class="bi bi-person me-1"></i>Customer: ${escapeHtml(f.customerName)} (${f.mobileNumber}) • Hall: ${f.hall} (${f.bookingDate})</div>
                            <div class="mt-2">
                                <span class="badge-status ${f.bookingStatus} me-1">${f.bookingStatus}</span>
                                <span class="badge-pay ${f.paymentStatus.replace(/ /g, '-')} me-1">${f.paymentStatus}</span>
                                <span class="badge-dep ${f.depositStatus.replace(/ /g, '-')}">${f.depositStatus}</span>
                            </div>
                        </div>
                        <div class="text-end">
                            <div class="small text-muted">Net Rent: <strong>₹${f.netRent.toLocaleString()}</strong> | Paid: <strong class="text-success">₹${f.netRentPaid.toLocaleString()}</strong></div>
                            <div class="fw-bold ${f.remainingRent > 0 ? 'text-danger' : 'text-success'} fs-5">Rent Due: ₹${f.remainingRent.toLocaleString()}</div>
                            <div class="small text-purple">Deposit Held: ₹${f.effectiveDepositHeld.toLocaleString()}</div>
                            ${cardActionButtonsHTML}
                        </div>
                    </div>
                `;

                const payRecBtn = container.querySelector('.btn-pay-record');
                if (payRecBtn) payRecBtn.addEventListener('click', () => openPaymentModal(f.bookingId));
                
                const depActBtn = container.querySelector('.btn-dep-action');
                if (depActBtn) depActBtn.addEventListener('click', () => openDepositActionModal(f.bookingId));
            }
        } catch (err) {
            console.error(err);
        }
        });
    }

    // =========================================================================
    // 7. MODAL HANDLERS & ACTIONS
    // =========================================================================

    // Helper to load payment summary inside modal
    async function loadPaymentModalSummary(bookingId) {
        const summaryBox = document.getElementById('pay-modal-booking-summary');
        const bookingIdInput = document.getElementById('pay-input-bookingId');
        const amountInput = document.getElementById('pay-input-amount');
        const settledAlert = document.getElementById('pay-settled-alert');
        const overpaymentSection = document.getElementById('pay-overpayment-section');
        const overpaymentAmountEl = document.getElementById('pay-overpayment-amount');
        const refundExcessBtn = document.getElementById('btn-pay-refund-excess');
        const submitBtn = document.getElementById('paymentForm').querySelector('button[type="submit"]');

        if (!bookingId) {
            summaryBox.classList.add('d-none');
            if (settledAlert) settledAlert.classList.add('d-none');
            if (overpaymentSection) overpaymentSection.classList.add('d-none');
            bookingIdInput.value = '';
            amountInput.value = '';
            amountInput.disabled = false;
            if (submitBtn) submitBtn.disabled = false;
            return;
        }

        try {
            const res = await fetch(`/api/payments/booking/${bookingId}`);
            const result = await res.json();
            if (result.success) {
                const f = result.data;
                document.getElementById('pay-modal-booking-id').textContent = `${f.bookingId} - ${f.eventName}`;
                document.getElementById('pay-modal-customer').textContent = `${f.customerName} (${f.mobileNumber}) • ${f.hall} (${f.bookingDate})`;
                document.getElementById('pay-modal-total').textContent = `₹${f.netRent.toLocaleString()}`;
                document.getElementById('pay-modal-paid').textContent = `₹${f.netRentPaid.toLocaleString()}`;

                bookingIdInput.value = f.bookingId;
                amountInput.value = f.remainingRent > 0 ? f.remainingRent : '';
                summaryBox.classList.remove('d-none');

                if (f.overpaidAmount > 0) {
                    document.getElementById('pay-modal-balance').innerHTML = `<span class="badge bg-warning text-dark fw-bold">Overpaid ₹${f.overpaidAmount.toLocaleString()}</span>`;
                    if (overpaymentSection) {
                        overpaymentSection.classList.remove('d-none');
                        if (overpaymentAmountEl) overpaymentAmountEl.textContent = `₹${f.overpaidAmount.toLocaleString()}`;
                    }
                    if (refundExcessBtn) {
                        refundExcessBtn.onclick = async () => {
                            if (!confirm(`Are you sure you want to refund the excess overpaid amount of ₹${f.overpaidAmount.toLocaleString()} to ${f.customerName}?`)) return;
                            try {
                                const resRefund = await fetch('/api/payments', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        bookingId: f.bookingId,
                                        amount: f.overpaidAmount,
                                        type: 'Refund',
                                        paymentMethod: 'Cash',
                                        remarks: `Refund of excess overpayment to customer (${f.customerName})`
                                    })
                                });
                                const resJson = await resRefund.json();
                                if (resJson.success) {
                                    showToast(resJson.message);
                                    await loadPaymentModalSummary(f.bookingId);
                                    refreshCurrentView();
                                } else {
                                    alert(resJson.message || 'Failed to refund excess amount.');
                                }
                            } catch (err) {
                                console.error('Error processing overpayment refund:', err);
                            }
                        };
                    }
                } else {
                    document.getElementById('pay-modal-balance').textContent = `₹${f.remainingRent.toLocaleString()}`;
                    if (overpaymentSection) {
                        overpaymentSection.classList.add('d-none');
                    }
                }

                if (f.isFullySettled) {
                    if (settledAlert) settledAlert.classList.remove('d-none');
                    amountInput.disabled = true;
                    if (submitBtn) submitBtn.disabled = true;
                } else {
                    if (settledAlert) settledAlert.classList.add('d-none');
                    amountInput.disabled = false;
                    if (submitBtn) submitBtn.disabled = false;
                }
            }
        } catch (err) {
            console.error("Error loading payment modal summary:", err);
        }
    }

    // Open Record Payment Modal
    async function openPaymentModal(targetBookingId = null) {
        try {
            const modalSelect = document.getElementById('pay-modal-booking-select');
            
            // Populate modal dropdown with all bookings
            const resBookings = await fetch('/api/bookings');
            const resultBookings = await resBookings.json();
            if (resultBookings.success) {
                modalSelect.innerHTML = '<option value="">-- Select a Customer / Booking --</option>';
                resultBookings.data.forEach(b => {
                    const opt = document.createElement('option');
                    opt.value = b.id;
                    opt.textContent = `${b.id} - ${b.customerName} (${b.eventName} • ${b.bookingDate})`;
                    modalSelect.appendChild(opt);
                });
            }

            // Determine active booking ID:
            // 1. targetBookingId if explicitly provided
            // 2. Search bar selection (pay-select-booking) if available
            let activeId = targetBookingId;
            if (!activeId) {
                const searchSelect = document.getElementById('pay-select-booking');
                if (searchSelect && searchSelect.value) {
                    activeId = searchSelect.value;
                }
            }

            document.getElementById('pay-input-remarks').value = '';

            if (activeId) {
                modalSelect.value = activeId;
                await loadPaymentModalSummary(activeId);
            } else {
                modalSelect.value = '';
                await loadPaymentModalSummary(null);
            }

            paymentModal.show();
        } catch (err) {
            console.error("Error opening payment modal:", err);
        }
    }

    // Event listener for customer selection inside payment modal
    const payModalBookingSelect = document.getElementById('pay-modal-booking-select');
    if (payModalBookingSelect) {
        payModalBookingSelect.addEventListener('change', (e) => {
            const selectedId = e.target.value;
            loadPaymentModalSummary(selectedId);
            const searchSelect = document.getElementById('pay-select-booking');
            if (searchSelect && selectedId) {
                searchSelect.value = selectedId;
                searchSelect.dispatchEvent(new Event('change'));
            }
        });
    }

    // Open Deposit Action Modal
    async function openDepositActionModal(bookingId) {
        try {
            const res = await fetch(`/api/payments/booking/${bookingId}`);
            const result = await res.json();
            if (result.success) {
                const f = result.data;
                document.getElementById('dep-input-bookingId').value = f.bookingId;
                const actionSelect = document.getElementById('dep-input-action');
                const settledAlert = document.getElementById('dep-settled-alert');
                const submitBtn = document.getElementById('depositForm')?.querySelector('button[type="submit"]');

                // Only Archived bookings fully block financial actions
                if (!f.canProcessFinancials) {
                    if (settledAlert) {
                        settledAlert.classList.remove('d-none');
                        settledAlert.innerHTML = `<i class="bi bi-archive me-2"></i><strong>Archived Booking:</strong> Financial actions are locked for archived bookings.`;
                    }
                    if (document.getElementById('dep-input-amount')) document.getElementById('dep-input-amount').disabled = true;
                    if (actionSelect) actionSelect.disabled = true;
                    if (document.getElementById('dep-input-remarks')) document.getElementById('dep-input-remarks').disabled = true;
                    if (submitBtn) submitBtn.disabled = true;
                    depositActionModal.show();
                    return;
                }

                // Clear any old alert
                if (settledAlert) settledAlert.classList.add('d-none');
                if (document.getElementById('dep-input-amount')) document.getElementById('dep-input-amount').disabled = false;
                if (actionSelect) actionSelect.disabled = false;
                if (document.getElementById('dep-input-remarks')) document.getElementById('dep-input-remarks').disabled = false;
                if (submitBtn) submitBtn.disabled = false;

                // Contextual deposit messaging
                const depInfoBox = document.getElementById('dep-info-message');
                if (depInfoBox) {
                    if (f.effectiveDepositHeld > 0) {
                        depInfoBox.innerHTML = `<div class="alert alert-info border-0 rounded-3 p-2 small mb-2"><i class="bi bi-shield-check me-1 text-info"></i>Deposit Held: <strong>₹${f.effectiveDepositHeld.toLocaleString()}</strong> — available for refund/adjustment.</div>`;
                        depInfoBox.classList.remove('d-none');
                    } else if (f.securityDeposit === 0 && f.depositPaid === 0) {
                        depInfoBox.innerHTML = `<div class="alert alert-secondary border-0 rounded-3 p-2 small mb-2"><i class="bi bi-dash-circle me-1"></i>No deposit available for action. Use <em>Receive Deposit</em> to collect one.</div>`;
                        depInfoBox.classList.remove('d-none');
                    } else {
                        depInfoBox.classList.add('d-none');
                    }
                }

                // Context-aware option enabling
                if (actionSelect) {
                    Array.from(actionSelect.options).forEach(opt => {
                        if (opt.value === 'adjust' || opt.value === 'return' || opt.value === 'forfeit') {
                            opt.disabled = (f.effectiveDepositHeld <= 0);
                        } else if (opt.value === 'receive') {
                            opt.disabled = false; // Always allow receiving deposit even after completion
                        }
                    });

                    if (f.effectiveDepositHeld > 0) {
                        actionSelect.value = f.remainingRent > 0 ? 'adjust' : 'return';
                        if (document.getElementById('dep-input-amount')) document.getElementById('dep-input-amount').value = f.remainingRent > 0 ? Math.min(f.effectiveDepositHeld, f.remainingRent) : f.effectiveDepositHeld;
                    } else {
                        actionSelect.value = 'receive';
                        if (document.getElementById('dep-input-amount')) document.getElementById('dep-input-amount').value = f.remainingDepositDue > 0 ? f.remainingDepositDue : (f.securityDeposit > 0 ? f.securityDeposit : '');
                    }
                    actionSelect.dispatchEvent(new Event('change'));
                }

                depositActionModal.show();
            }
        } catch (err) {
            console.error("Error opening deposit modal:", err);
        }
    }

    // Event listener for action change inside deposit modal
    const depInputAction = document.getElementById('dep-input-action');
    if (depInputAction) {
        depInputAction.addEventListener('change', async (e) => {
            const action = e.target.value;
            const bId = document.getElementById('dep-input-bookingId')?.value;
            if (!bId) return;
            try {
                const res = await fetch(`/api/payments/booking/${bId}`);
                const result = await res.json();
                if (result.success) {
                const f = result.data;
                const amountInput = document.getElementById('dep-input-amount');
                if (action === 'receive' || action === 'collect') {
                    amountInput.value = f.remainingDepositDue > 0 ? f.remainingDepositDue : f.securityDeposit;
                    document.getElementById('dep-input-remarks').value = `Security Deposit received for ${f.customerName}`;
                } else if (action === 'adjust') {
                    amountInput.value = Math.min(f.effectiveDepositHeld, f.remainingRent);
                    document.getElementById('dep-input-remarks').value = `Adjusting held deposit of ₹${Math.min(f.effectiveDepositHeld, f.remainingRent)} into hall rent dues`;
                } else if (action === 'return') {
                    amountInput.value = f.effectiveDepositHeld;
                    document.getElementById('dep-input-remarks').value = `Full deposit refund of ₹${f.effectiveDepositHeld} returned to customer`;
                } else if (action === 'forfeit') {
                    amountInput.value = f.effectiveDepositHeld;
                    document.getElementById('dep-input-remarks').value = `Deposit forfeiture of ₹${f.effectiveDepositHeld} for damages/penalty`;
                }
            }
        } catch (err) {
            console.error(err);
        }
        });
    }

    // Open Void Receipt Modal
    function openVoidModal(receiptNumber) {
        document.getElementById('void-input-rcpt').value = receiptNumber;
        document.getElementById('void-display-rcpt').value = receiptNumber;
        document.getElementById('void-input-reason').value = '';
        voidModal.show();
    }

    // Global active receipt tracker
    let activeReceiptNumber = null;

    // Open Printable Receipt Modal (Clean Modern Layout - No Signatures)
    async function openReceiptModal(receiptNumber) {
        try {
            activeReceiptNumber = receiptNumber;
            const res = await fetch(`/api/payments/receipt/${receiptNumber}`);
            const result = await res.json();
            if (result.success) {
                const { receipt, summary } = result.data;
                const area = document.getElementById('receipt-printable-area');

                const voidWatermarkHTML = receipt.isVoided ? `
                    <div class="receipt-void-watermark">VOIDED RECEIPT</div>
                ` : '';

                area.innerHTML = `
                    <div class="position-relative receipt-box p-4 bg-white rounded-3 border shadow-sm" id="printable-receipt-card">
                        ${voidWatermarkHTML}

                        <!-- Header -->
                        <div class="text-center border-bottom pb-3 mb-3">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <span class="badge bg-primary px-3 py-1.5 fs-6 fw-semibold"><i class="bi bi-building me-1"></i>HALL BOOKING ERP</span>
                                <span class="badge ${receipt.isVoided ? 'bg-danger' : 'bg-success'} px-3 py-1.5 fs-6">${receipt.isVoided ? 'VOIDED' : 'PAID & VERIFIED'}</span>
                            </div>
                            <h4 class="fw-bold text-dark mb-0 mt-1">OFFICIAL PAYMENT RECEIPT</h4>
                            <div class="text-muted small">E-Receipt & Transaction Voucher</div>
                            <div class="badge bg-light text-dark border font-monospace px-3 py-1 mt-2 fs-6">${receipt.receiptNumber}</div>
                        </div>

                        <!-- 2-Column Info Grid -->
                        <div class="row g-2 mb-3 small">
                            <div class="col-6">
                                <div class="p-3 bg-light rounded border h-100">
                                    <div class="text-muted mb-1 fw-bold text-uppercase" style="font-size:0.7rem; letter-spacing: 0.5px;">Customer Details</div>
                                    <div class="fw-bold fs-6 text-dark">${escapeHtml(summary.customerName)}</div>
                                    <div class="text-muted"><i class="bi bi-telephone me-1"></i>${escapeHtml(summary.mobileNumber)}</div>
                                    <div class="mt-1"><strong>Event:</strong> ${escapeHtml(summary.eventName)}</div>
                                    <div><strong>Booking ID:</strong> <span class="font-monospace text-primary fw-bold">${summary.bookingId}</span></div>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="p-3 bg-light rounded border h-100">
                                    <div class="text-muted mb-1 fw-bold text-uppercase" style="font-size:0.7rem; letter-spacing: 0.5px;">Transaction Details</div>
                                    <div><strong>Date & Time:</strong> ${receipt.date} ${receipt.time}</div>
                                    <div><strong>Hall:</strong> <span class="hall-pill ${summary.hall === 'Hall 1' ? 'hall-1' : 'hall-2'} py-0 px-2">${summary.hall}</span></div>
                                    <div><strong>Event Date:</strong> ${summary.bookingDate} (${summary.startTime || ''} - ${summary.endTime || ''})</div>
                                    <div><strong>Payment Mode:</strong> ${receipt.paymentMethod}</div>
                                    <div><strong>Ref / UTR:</strong> ${escapeHtml(receipt.referenceNumber || 'N/A')}</div>
                                </div>
                            </div>
                        </div>

                        <!-- Highlighted Amount Card -->
                        <div class="p-3 rounded-3 border mb-3 text-center ${receipt.isVoided ? 'bg-light' : 'bg-success-subtle border-success-subtle'}">
                            <div class="text-muted small fw-semibold text-uppercase">Amount Received for ${receipt.type}</div>
                            <h2 class="fw-bold mb-1 ${receipt.isVoided ? 'text-decoration-line-through text-muted' : 'text-success'}">₹${receipt.amount.toLocaleString()}</h2>
                            <div class="small text-muted">${escapeHtml(receipt.remarks || 'Payment successfully recorded into the system ledger.')}</div>
                        </div>

                        <!-- Account Summary Bar -->
                        <div class="p-2.5 bg-light rounded-3 border mb-3 small">
                            <div class="row text-center g-2">
                                <div class="col-3 border-end">
                                    <div class="text-muted" style="font-size:0.75rem;">Net Hall Rent</div>
                                    <div class="fw-bold text-dark">₹${summary.netRent.toLocaleString()}</div>
                                </div>
                                <div class="col-3 border-end">
                                    <div class="text-muted" style="font-size:0.75rem;">Total Rent Paid</div>
                                    <div class="fw-bold text-success">₹${summary.netRentPaid.toLocaleString()}</div>
                                </div>
                                <div class="col-3 border-end">
                                    <div class="text-muted" style="font-size:0.75rem;">Rent Due</div>
                                    <div class="fw-bold ${(summary.remainingRent || 0) > 0 ? 'text-danger' : 'text-success'}">₹${(summary.remainingRent || 0).toLocaleString()}</div>
                                </div>
                                <div class="col-3">
                                    <div class="text-muted" style="font-size:0.75rem;">Deposit Held</div>
                                    <div class="fw-bold" style="color:#7c3aed;">₹${(summary.effectiveDepositHeld || 0).toLocaleString()}</div>
                                </div>
                            </div>
                        </div>

                        <!-- Footer (NO SIGNATURES - Computer Generated) -->
                        <div class="text-center pt-2 border-top text-muted small" style="font-size:0.78rem;">
                            <div class="text-dark fw-semibold mb-0.5"><i class="bi bi-check2-circle text-success me-1"></i>Computer-Generated Official Receipt • Valid without physical signatures</div>
                            <div>For any queries or event changes, contact administration office. Thank you!</div>
                        </div>
                    </div>
                `;

                receiptModal.show();
            }
        } catch (err) {
            console.error("Error loading receipt:", err);
        }
    }

    // Download Receipt as PDF (for sharing via WhatsApp)
    async function downloadReceiptPDF(receiptNumber) {
        if (!receiptNumber) {
            showToast("No active receipt selected for download.");
            return;
        }

        const element = document.getElementById('receipt-printable-area');
        if (!element) {
            showToast("Receipt container not found.");
            return;
        }

        if (typeof html2pdf === 'undefined') {
            showToast("PDF generator library loading, please try again in a moment.");
            return;
        }

        const opt = {
            margin:       [10, 10, 10, 10],
            filename:     `Receipt-${receiptNumber}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        try {
            showToast("Generating PDF for WhatsApp sharing...");
            await html2pdf().set(opt).from(element).save();
            showToast("Receipt PDF downloaded successfully!");
        } catch (err) {
            console.error("Error downloading receipt PDF:", err);
            showToast("Failed to generate PDF. You can also use the Print button to Save as PDF.");
        }
    }

    // =========================================================================
    // 8. FORM SUBMISSIONS & EVENT LISTENERS
    // =========================================================================

    // Submit Booking Form (Create / Edit)
    const bookingForm = document.getElementById('bookingForm');
    const conflictAlert = document.getElementById('conflict-alert');
    const conflictAlertMsg = document.getElementById('conflict-alert-msg');

    bookingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        conflictAlert.classList.add('d-none');

        const bookingData = {
            customerName: document.getElementById('input-customerName').value,
            mobileNumber: document.getElementById('input-mobileNumber').value,
            eventName: document.getElementById('input-eventName').value,
            hall: document.getElementById('input-hall').value,
            bookingDate: document.getElementById('input-bookingDate').value,
            status: document.getElementById('input-status').value || 'Confirmed',
            startTime: document.getElementById('input-startTime').value,
            endTime: document.getElementById('input-endTime').value,
            hallRent: document.getElementById('input-hallRent').value,
            discount: document.getElementById('input-discount').value,
            extraCharges: document.getElementById('input-extraCharges').value,
            securityDeposit: document.getElementById('input-securityDeposit').value,
            notes: document.getElementById('input-notes').value
        };

        const isEdit = !!editBookingId;
        const url = isEdit ? `/api/bookings/${editBookingId}` : '/api/bookings';
        const method = isEdit ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookingData)
            });

            const result = await res.json();

            if (res.status === 409 || !result.success) {
                conflictAlertMsg.innerHTML = `<strong>${result.message || "Hall already booked for this time."}</strong>`;
                conflictAlert.classList.remove('d-none');
                return;
            }

            bookingModal.hide();
            bookingForm.reset();
            editBookingId = null;
            showToast(result.message || 'Booking saved successfully!');
            refreshCurrentView();

        } catch (err) {
            console.error("Save error:", err);
            conflictAlertMsg.innerHTML = `<strong>Server communication error.</strong>`;
            conflictAlert.classList.remove('d-none');
        }
    });

    // Reset Booking Modal on Open
    document.getElementById('bookingModal').addEventListener('show.bs.modal', (e) => {
        if (e.relatedTarget === navAddBtn) {
            editBookingId = null;
            bookingForm.reset();
            document.getElementById('bookingModalLabel').innerHTML = `<i class="bi bi-plus-circle-fill text-primary me-2"></i>Create New Booking`;
            document.getElementById('input-bookingDate').value = getTodayDateString();
            document.getElementById('input-status').value = 'Confirmed';
            document.getElementById('input-hallRent').value = '10000';
            document.getElementById('input-discount').value = '0';
            document.getElementById('input-extraCharges').value = '0';
            document.getElementById('input-securityDeposit').value = '0';
            conflictAlert.classList.add('d-none');
        }
    });

    // Submit Record Payment Form
    const paymentForm = document.getElementById('paymentForm');
    paymentForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const data = {
            bookingId: document.getElementById('pay-input-bookingId').value,
            type: document.getElementById('pay-input-category').value,
            amount: document.getElementById('pay-input-amount').value,
            paymentMethod: document.getElementById('pay-input-method').value,
            collectedBy: document.getElementById('pay-input-collector').value,
            referenceNumber: document.getElementById('pay-input-ref').value,
            remarks: document.getElementById('pay-input-remarks').value
        };

        if (!data.bookingId) {
            alert('Please select a customer / booking record first.');
            return;
        }

        try {
            const res = await fetch('/api/payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await res.json();
            if (result.success) {
                paymentModal.hide();
                paymentForm.reset();
                showToast(result.message);
                refreshCurrentView();
                
                const searchSelect = document.getElementById('pay-select-booking');
                if (searchSelect && searchSelect.value === data.bookingId) {
                    searchSelect.dispatchEvent(new Event('change'));
                }

                if (document.getElementById('viewBookingModal').classList.contains('show')) {
                    openViewBookingModal(data.bookingId);
                }

                if (result.data && result.data.transaction) {
                    openReceiptModal(result.data.transaction.receiptNumber);
                }
            } else {
                alert(result.message || 'Payment submission failed.');
            }
        } catch (err) {
            console.error("Payment submission error:", err);
        }
    });

    // Submit Deposit Action Form
    const depositForm = document.getElementById('depositForm');
    depositForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const data = {
            bookingId: document.getElementById('dep-input-bookingId').value,
            action: document.getElementById('dep-input-action').value,
            amount: document.getElementById('dep-input-amount').value,
            remarks: document.getElementById('dep-input-remarks').value
        };

        if (!data.bookingId) {
            alert('Please select a customer / booking record first.');
            return;
        }

        try {
            const res = await fetch('/api/payments/deposit-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await res.json();
            if (result.success) {
                depositActionModal.hide();
                depositForm.reset();
                showToast(result.message);
                refreshCurrentView();

                const searchSelect = document.getElementById('pay-select-booking');
                if (searchSelect && searchSelect.value === data.bookingId) {
                    searchSelect.dispatchEvent(new Event('change'));
                }

                if (document.getElementById('viewBookingModal').classList.contains('show')) {
                    openViewBookingModal(data.bookingId);
                }
            } else {
                alert(result.message || 'Deposit operation failed.');
            }
        } catch (err) {
            console.error("Deposit submission error:", err);
        }
    });

    // Submit Void Form
    const voidForm = document.getElementById('voidForm');
    voidForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const rcpt = document.getElementById('void-input-rcpt').value;
        const voidReason = document.getElementById('void-input-reason').value;
        const voidedBy = document.getElementById('void-input-approver').value;

        try {
            const res = await fetch(`/api/payments/${rcpt}/void`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ voidReason, voidedBy })
            });

            const result = await res.json();
            if (result.success) {
                voidModal.hide();
                voidForm.reset();
                showToast(result.message);
                refreshCurrentView();

                const bId = result.data && result.data.transaction ? result.data.transaction.bookingId : null;
                const searchSelect = document.getElementById('pay-select-booking');
                if (searchSelect && bId && searchSelect.value === bId) {
                    searchSelect.dispatchEvent(new Event('change'));
                }

                if (bId && document.getElementById('viewBookingModal').classList.contains('show')) {
                    openViewBookingModal(bId);
                }
            } else {
                alert(result.message || 'Failed to void receipt.');
            }
        } catch (err) {
            console.error("Void submit error:", err);
        }
    });

    // Open Edit Modal for Booking
    async function openEditModal(id) {
        try {
            const res = await fetch(`/api/bookings/${id}`);
            const result = await res.json();
            if (result.success) {
                const b = result.data;
                editBookingId = b.id;

                document.getElementById('bookingModalLabel').innerHTML = `<i class="bi bi-pencil-square text-primary me-2"></i>Edit Booking Details (${b.id})`;
                document.getElementById('input-customerName').value = b.customerName;
                document.getElementById('input-mobileNumber').value = b.mobileNumber;
                document.getElementById('input-eventName').value = b.eventName;
                document.getElementById('input-hall').value = b.hall;
                document.getElementById('input-bookingDate').value = b.bookingDate;
                document.getElementById('input-status').value = b.status || 'Confirmed';
                document.getElementById('input-startTime').value = b.startTime;
                document.getElementById('input-endTime').value = b.endTime;
                
                const contract = b.contract || {};
                const initialExtraItem = (contract.extraChargesList || []).find(c => c.category === 'Initial Extra Charge');
                const initialExtraVal = initialExtraItem ? Number(initialExtraItem.amount) : 0;
                document.getElementById('input-hallRent').value = contract.hallRent !== undefined ? contract.hallRent : 10000;
                document.getElementById('input-discount').value = contract.baseDiscount !== undefined ? contract.baseDiscount : 0;
                document.getElementById('input-extraCharges').value = initialExtraVal;
                document.getElementById('input-securityDeposit').value = contract.securityDeposit !== undefined ? contract.securityDeposit : 0;
                document.getElementById('input-notes').value = b.notes || '';

                conflictAlert.classList.add('d-none');
                bookingModal.show();
            }
        } catch (err) {
            console.error(err);
        }
    }

    async function handleEventStatusChange(bookingId, newStatus) {
        try {
            const res = await fetch(`/api/bookings/${bookingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus, updatedBy: 'Admin' })
            });
            const result = await res.json();
            if (result.success) {
                showToast(`Booking status updated to ${newStatus}`);
                refreshCurrentView();
                if (document.getElementById('viewBookingModal').classList.contains('show')) {
                    openViewBookingModal(bookingId);
                }
            } else {
                alert(result.message || 'Failed to update status.');
                refreshCurrentView();
            }
        } catch (err) {
            console.error("Status update error:", err);
            refreshCurrentView();
        }
    }

    async function handleArchiveBooking(id) {
        try {
            const res = await fetch(`/api/bookings/${id}/archive`, { method: 'PATCH' });
            const result = await res.json();
            if (result.success) {
                showToast("Booking moved to Archive successfully! Time slot freed.");
                refreshCurrentView();
                if (document.getElementById('viewBookingModal').classList.contains('show')) {
                    openViewBookingModal(id);
                }
            } else {
                alert(result.message || "Failed to archive booking.");
            }
        } catch (err) {
            console.error(err);
        }
    }

    async function handleUnarchiveBooking(id) {
        try {
            const res = await fetch(`/api/bookings/${id}/unarchive`, { method: 'PATCH' });
            const result = await res.json();
            if (result.success) {
                showToast(result.message || "Booking restored from Archive successfully!");
                refreshCurrentView();
                if (document.getElementById('viewBookingModal').classList.contains('show')) {
                    openViewBookingModal(id);
                }
            } else {
                alert(result.message || "Failed to unarchive booking.");
            }
        } catch (err) {
            console.error("Unarchive error:", err);
        }
    }

    async function handleUncancelBooking(id) {
        try {
            const res = await fetch(`/api/bookings/${id}/uncancel`, { method: 'PATCH' });
            const result = await res.json();
            if (result.success) {
                showToast(result.message || "Booking cancellation reverted successfully!");
                refreshCurrentView();
                if (document.getElementById('viewBookingModal').classList.contains('show')) {
                    openViewBookingModal(id);
                }
            } else {
                alert(result.message || "Failed to restore cancelled booking.");
            }
        } catch (err) {
            console.error("Uncancel error:", err);
        }
    }

    async function handleRevertExtraCharge(bookingId, chargeId) {
        try {
            const res = await fetch(`/api/bookings/${bookingId}/extra-charges/${chargeId}`, { method: 'DELETE' });
            const result = await res.json();
            if (result.success) {
                showToast(result.message);
                if (document.getElementById('viewBookingModal').classList.contains('show')) {
                    openViewBookingModal(bookingId);
                }
                refreshCurrentView();
            } else {
                alert(result.message || "Failed to revert extra charge.");
            }
        } catch (err) {
            console.error("Revert extra charge error:", err);
        }
    }

    async function handleRevertDiscount(bookingId, discountId) {
        try {
            const res = await fetch(`/api/bookings/${bookingId}/discounts/${discountId}`, { method: 'DELETE' });
            const result = await res.json();
            if (result.success) {
                showToast(result.message);
                if (document.getElementById('viewBookingModal').classList.contains('show')) {
                    openViewBookingModal(bookingId);
                }
                refreshCurrentView();
            } else {
                alert(result.message || "Failed to revert discount.");
            }
        } catch (err) {
            console.error("Revert discount error:", err);
        }
    }

    function openQuickExtraChargeModal(bookingId) {
        document.getElementById('quick-charge-target-id').value = bookingId;
        document.getElementById('quick-charge-booking-id').textContent = bookingId;
        document.getElementById('quick-charge-amount').value = '';
        document.getElementById('quick-charge-remarks').value = '';
        extraChargeModal.show();
    }

    function openQuickDiscountModal(bookingId) {
        document.getElementById('quick-discount-target-id').value = bookingId;
        document.getElementById('quick-discount-booking-id').textContent = bookingId;
        document.getElementById('quick-discount-amount').value = '';
        document.getElementById('quick-discount-reason').value = '';
        discountModal.show();
    }

    const quickExtraForm = document.getElementById('quick-form-extra-charge');
    if (quickExtraForm) {
        quickExtraForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const bookingId = document.getElementById('quick-charge-target-id').value;
            const category = document.getElementById('quick-charge-category').value;
            const amount = document.getElementById('quick-charge-amount').value;
            const remarks = document.getElementById('quick-charge-remarks').value;

            try {
                const res = await fetch(`/api/bookings/${bookingId}/extra-charges`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ category, amount, remarks })
                });
                const result = await res.json();
                if (result.success) {
                    extraChargeModal.hide();
                    showToast(result.message);
                    refreshCurrentView();
                    if (document.getElementById('viewBookingModal').classList.contains('show')) {
                        openViewBookingModal(bookingId);
                    }
                } else {
                    alert(result.message || 'Failed to add extra charge.');
                }
            } catch (err) {
                console.error("Quick extra charge submit error:", err);
            }
        });
    }

    const quickDiscountForm = document.getElementById('quick-form-discount');
    if (quickDiscountForm) {
        quickDiscountForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const bookingId = document.getElementById('quick-discount-target-id').value;
            const amount = document.getElementById('quick-discount-amount').value;
            const reason = document.getElementById('quick-discount-reason').value;
            const approvedBy = document.getElementById('quick-discount-approvedBy').value;

            try {
                const res = await fetch(`/api/bookings/${bookingId}/discounts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount, reason, approvedBy })
                });
                const result = await res.json();
                if (result.success) {
                    discountModal.hide();
                    showToast(result.message);
                    refreshCurrentView();
                    if (document.getElementById('viewBookingModal').classList.contains('show')) {
                        openViewBookingModal(bookingId);
                    }
                } else {
                    alert(result.message || 'Failed to apply discount.');
                }
            } catch (err) {
                console.error("Quick discount submit error:", err);
            }
        });
    }

    async function handleCancelBooking(id) {
        try {
            const res = await fetch(`/api/bookings/${id}/cancel`, { method: 'PATCH' });
            const result = await res.json();
            if (result.success) {
                showToast("Booking cancelled successfully.");
                refreshCurrentView();
            }
        } catch (err) {
            console.error(err);
        }
    }

    async function quickCompleteBooking(id) {
        try {
            const res = await fetch(`/api/bookings/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'Completed' })
            });
            const result = await res.json();
            if (result.success) {
                showToast(`Event marked as Completed!`);
                refreshCurrentView();
            }
        } catch (err) {
            console.error("Quick complete error:", err);
        }
    }

    // Handle Delete Booking Confirmation Dialog (3 Clear Options: Archive, Hard Delete, Cancel)
    async function handleDeleteBooking(id) {
        document.getElementById('delete-target-id').value = id;
        document.getElementById('delete-modal-title').textContent = `Delete Options for ${id}`;
        document.getElementById('delete-modal-msg').textContent = "Select how you would like to handle this booking deletion:";
        deleteModal.show();
    }

    const archiveDeleteBtn = document.getElementById('btn-action-archive-delete');
    if (archiveDeleteBtn) {
        archiveDeleteBtn.addEventListener('click', () => {
            const id = document.getElementById('delete-target-id').value;
            deleteModal.hide();
            handleArchiveBooking(id);
        });
    }

    const hardDeleteBtn = document.getElementById('btn-confirm-hard-delete');
    if (hardDeleteBtn) {
        hardDeleteBtn.addEventListener('click', async () => {
            const id = document.getElementById('delete-target-id').value;
            try {
                const res = await fetch(`/api/bookings/${id}`, { method: 'DELETE' });
                const result = await res.json();

                if (res.status === 400 && result.isProtected) {
                    alert(result.message || 'This booking contains financial records and cannot be permanently deleted. You can Archive this booking instead.');
                } else if (result.success) {
                    deleteModal.hide();
                    showToast("Booking permanently deleted.");
                    refreshCurrentView();
                } else {
                    alert(result.message || 'Failed to delete booking.');
                }
            } catch (err) {
                console.error("Hard delete error:", err);
            }
        });
    }

    // =========================================================================
    // 9. FILTER & SEARCH EVENT LISTENERS
    // =========================================================================
    function attachFilterListeners() {
        document.getElementById('filter-search')
            ?.addEventListener('input', loadBookingsList);

        document.getElementById('filter-date')
            ?.addEventListener('change', loadBookingsList);

        document.getElementById('filter-hall')
            ?.addEventListener('change', loadBookingsList);

        document.getElementById('filter-status')
            ?.addEventListener('change', loadBookingsList);

        document.getElementById('filter-booking-dues')
            ?.addEventListener('change', loadBookingsList);

        const resetBtn = document.getElementById('btn-reset-filters');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (document.getElementById('filter-search')) document.getElementById('filter-search').value = '';
                if (document.getElementById('filter-date')) document.getElementById('filter-date').value = '';
                if (document.getElementById('filter-hall')) document.getElementById('filter-hall').value = 'All';
                if (document.getElementById('filter-status')) document.getElementById('filter-status').value = 'All';
                if (document.getElementById('filter-booking-dues')) document.getElementById('filter-booking-dues').value = 'All';
                loadBookingsList();
            });
        }
    }

    attachFilterListeners();

    // Dashboard Refresh Button
    const refreshDashBtn = document.getElementById('btn-refresh-dashboard');
    if (refreshDashBtn) {
        refreshDashBtn.addEventListener('click', (e) => {
            e.preventDefault();
            refreshDashboard();
        });
    }

    // Payments Ledger Filters
    const payDuesSelect = document.getElementById('filter-pay-dues');
    if (payDuesSelect) {
        payDuesSelect.addEventListener('change', () => {
            if (currentView === 'payments') loadPaymentsView();
        });
    }

    ['filter-pay-search', 'filter-pay-method', 'filter-pay-type', 'filter-pay-status'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => { if (currentView === 'payments') loadPaymentsLedger(); });
            el.addEventListener('change', () => { if (currentView === 'payments') loadPaymentsLedger(); });
        }
    });

    const resetPayFiltersBtn = document.getElementById('btn-reset-pay-filters');
    if (resetPayFiltersBtn) {
        resetPayFiltersBtn.addEventListener('click', () => {
            if (document.getElementById('filter-pay-search')) document.getElementById('filter-pay-search').value = '';
            if (document.getElementById('filter-pay-dues')) document.getElementById('filter-pay-dues').value = 'All';
            if (document.getElementById('filter-pay-method')) document.getElementById('filter-pay-method').value = 'All';
            if (document.getElementById('filter-pay-type')) document.getElementById('filter-pay-type').value = 'All';
            if (document.getElementById('filter-pay-status')) document.getElementById('filter-pay-status').value = 'Success';
            loadPaymentsView();
        });
    }

    const openPayBtnHeader = document.getElementById('btn-open-payment-modal');
    if (openPayBtnHeader) {
        openPayBtnHeader.addEventListener('click', () => {
            const selectedBookingId = document.getElementById('pay-select-booking')?.value;
            openPaymentModal(selectedBookingId || null);
        });
    }

    function renderDiffCell(a) {
        if (a.changes && Array.isArray(a.changes) && a.changes.length > 0) {
            return `
                <div class="git-diff-card rounded-3 p-2 border bg-white shadow-sm font-monospace" style="max-width: 480px;">
                    <div class="diff-header text-muted border-bottom pb-1 mb-2 d-flex justify-content-between align-items-center" style="font-size: 0.72rem;">
                        <span><i class="bi bi-file-earmark-diff text-primary me-1"></i>Field Modifications (${a.changes.length})</span>
                        <span class="badge bg-light text-secondary border">Git-style Diff</span>
                    </div>
                    ${a.changes.map(c => `
                        <div class="diff-block mb-2">
                            <div class="fw-bold text-dark mb-1" style="font-size: 0.75rem;">
                                <i class="bi bi-caret-right-fill me-1 text-primary"></i>${escapeHtml(c.field)}
                            </div>
                            ${c.oldVal !== null && c.oldVal !== undefined && c.oldVal !== 'N/A' ? `
                                <div class="diff-line diff-del p-1 rounded mb-1 text-danger d-flex align-items-center" style="background-color: #ffebe9; border-left: 3px solid #cf222e; font-size: 0.75rem;">
                                    <span class="fw-bold me-2" style="user-select: none;">-</span>
                                    <span class="text-decoration-line-through">${escapeHtml(c.oldVal)}</span>
                                </div>
                            ` : ''}
                            <div class="diff-line diff-add p-1 rounded text-success d-flex align-items-center" style="background-color: #dafbe1; border-left: 3px solid #1a7f37; font-size: 0.75rem;">
                                <span class="fw-bold me-2" style="user-select: none;">+</span>
                                <span class="fw-semibold">${escapeHtml(c.newVal)}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        return `
            <div class="small">
                ${a.oldValue ? `<span class="badge bg-danger-subtle text-danger border border-danger-subtle me-1"><i class="bi bi-dash-circle me-1"></i>Old: ${escapeHtml(a.oldValue)}</span> <i class="bi bi-arrow-right text-muted mx-1"></i>` : ''}
                <span class="badge bg-success-subtle text-success border border-success-subtle"><i class="bi bi-plus-circle me-1"></i>New: ${escapeHtml(a.newValue || 'N/A')}</span>
            </div>
        `;
    }

    document.getElementById('avail-date-picker')?.addEventListener('change', () => {
        if (currentView === 'availability') loadHallAvailability();
    });

    // =========================================================================
    // 10. OVERALL SUMMARY VIEW & METRICS
    // =========================================================================
    async function loadOverallSummaryView() {
        try {
            const todayStr = getTodayDateString();
            let statsResult = { success: false, data: {} };
            let bookingsResult = { success: false, data: [] };
            let paymentsResult = { success: false, data: [] };

            const [statsRes, bookingsRes, paymentsRes] = await Promise.allSettled([
                fetch('/api/payments/stats').then(r => r.json()),
                fetch('/api/bookings').then(r => r.json()),
                fetch('/api/payments').then(r => r.json())
            ]);

            if (statsRes.status === 'fulfilled' && statsRes.value) statsResult = statsRes.value;
            if (bookingsRes.status === 'fulfilled' && bookingsRes.value) bookingsResult = bookingsRes.value;
            if (paymentsRes.status === 'fulfilled' && paymentsRes.value) paymentsResult = paymentsRes.value;

            const stats = (statsResult.success && statsResult.data) ? statsResult.data : {};
            const bookings = (bookingsResult.success && Array.isArray(bookingsResult.data)) ? bookingsResult.data : [];
            const payments = (paymentsResult.success && Array.isArray(paymentsResult.data)) ? paymentsResult.data : [];

            // 1. Calculate Financial Aggregates
            const activeBookings = bookings.filter(b => b.status !== 'Cancelled' && b.status !== 'Archived');
            let computedPendingDues = 0;
            let computedRentRev = 0;
            let computedDepHeld = 0;

            activeBookings.forEach(b => {
                const f = b.financial || {};
                computedPendingDues += (f.remainingRent !== undefined ? f.remainingRent : 0);
                computedRentRev += (f.netRentPaid !== undefined ? f.netRentPaid : 0);
                computedDepHeld += (f.effectiveDepositHeld !== undefined ? f.effectiveDepositHeld : 0);
            });

            // Today's Payment Transactions
            const todayTxns = payments.filter(t => !t.isVoided && t.status === 'Success' && t.date === todayStr);
            const getMethodTotal = (method) => {
                const sum = todayTxns.reduce((acc, t) => {
                    const matches = (method === 'Card') 
                        ? (t.paymentMethod && t.paymentMethod.includes('Card'))
                        : (t.paymentMethod === method);
                    if (!matches) return acc;
                    if (t.type && (t.type.includes('Return') || t.type.includes('Refund'))) return acc - t.amount;
                    if (t.type && !t.type.includes('Forfeiture') && !t.type.includes('Adjustment')) return acc + t.amount;
                    return acc;
                }, 0);
                return Math.max(0, sum);
            };

            const cashColl = stats.cashCollection !== undefined ? stats.cashCollection : getMethodTotal('Cash');
            const upiColl = stats.upiCollection !== undefined ? stats.upiCollection : getMethodTotal('UPI');
            const cardColl = stats.cardCollection !== undefined ? stats.cardCollection : getMethodTotal('Card');
            const otherColl = stats.otherCollection !== undefined ? stats.otherCollection : Math.max(0, todayTxns.reduce((acc, t) => {
                const isKnown = t.paymentMethod === 'Cash' || t.paymentMethod === 'UPI' || (t.paymentMethod && t.paymentMethod.includes('Card'));
                if (isKnown) return acc;
                if (t.type && (t.type.includes('Return') || t.type.includes('Refund'))) return acc - t.amount;
                if (t.type && !t.type.includes('Forfeiture') && !t.type.includes('Adjustment')) return acc + t.amount;
                return acc;
            }, 0));

            const todayTotalColl = (stats.todayCollections !== undefined) ? stats.todayCollections : Math.max(0, cashColl + upiColl + cardColl + otherColl);
            const totalRentRevenue = (stats.totalRentRevenue !== undefined) ? stats.totalRentRevenue : computedRentRev;
            const pendingRentDues = (stats.pendingRentDues !== undefined) ? stats.pendingRentDues : computedPendingDues;
            const totalDepositHeld = (stats.totalDepositHeld !== undefined) ? stats.totalDepositHeld : computedDepHeld;

            // Update Primary KPI Cards
            const elToday = document.getElementById('overall-stat-today-coll');
            if (elToday) elToday.textContent = `₹${todayTotalColl.toLocaleString()}`;

            const elRev = document.getElementById('overall-stat-total-rev');
            if (elRev) elRev.textContent = `₹${totalRentRevenue.toLocaleString()}`;

            const elDues = document.getElementById('overall-stat-pending-dues');
            if (elDues) elDues.textContent = `₹${pendingRentDues.toLocaleString()}`;

            const elDep = document.getElementById('overall-stat-deposits-held');
            if (elDep) elDep.textContent = `₹${totalDepositHeld.toLocaleString()}`;

            // Update Payment Method Breakdown Cards
            const elCash = document.getElementById('overall-coll-cash');
            if (elCash) elCash.textContent = `₹${cashColl.toLocaleString()}`;

            const elUpi = document.getElementById('overall-coll-upi');
            if (elUpi) elUpi.textContent = `₹${upiColl.toLocaleString()}`;

            const elCard = document.getElementById('overall-coll-card');
            if (elCard) elCard.textContent = `₹${cardColl.toLocaleString()}`;

            const elOther = document.getElementById('overall-coll-other');
            if (elOther) elOther.textContent = `₹${otherColl.toLocaleString()}`;

            // 2. Hall Distribution & Performance
            const hallBreakdownContainer = document.getElementById('overall-hall-breakdown');
            if (hallBreakdownContainer) {
                const totalBookingsCount = bookings.length || 1;
                
                // Identify distinct halls (default to Small Hall & Big Hall if present)
                const hallConfig = [
                    { name: 'Small Hall', subtitle: 'Small Banquet & Seminar Hall', pillClass: 'hall-1', barColor: '#0284c7', badgeBg: 'bg-primary-subtle text-primary' },
                    { name: 'Big Hall', subtitle: 'Main Grand Convention Hall', pillClass: 'hall-2', barColor: '#7c3aed', badgeBg: 'style="background:#f3e8ff; color:#6b21a8;"' }
                ];

                // Check for additional dynamic halls
                const knownHallNames = new Set(hallConfig.map(h => h.name));
                bookings.forEach(b => {
                    if (b.hall && !knownHallNames.has(b.hall)) {
                        knownHallNames.add(b.hall);
                        hallConfig.push({
                            name: b.hall,
                            subtitle: 'Event Venue',
                            pillClass: 'hall-1',
                            barColor: '#059669',
                            badgeBg: 'bg-success-subtle text-success'
                        });
                    }
                });

                hallBreakdownContainer.innerHTML = hallConfig.map(hc => {
                    const hallBookings = bookings.filter(b => b.hall === hc.name);
                    const count = hallBookings.length;
                    const sharePct = bookings.length > 0 ? Math.round((count / totalBookingsCount) * 100) : 0;
                    
                    const activeCount = hallBookings.filter(b => b.status === 'Confirmed' || b.status === 'Booked').length;
                    const completedCount = hallBookings.filter(b => b.status === 'Completed').length;
                    const rev = hallBookings.reduce((sum, b) => {
                        if (b.status === 'Cancelled' || b.status === 'Archived') return sum;
                        return sum + ((b.financial && b.financial.netRentPaid) || 0);
                    }, 0);

                    const isCustomBadge = hc.badgeBg.startsWith('style=');
                    const badgeAttr = isCustomBadge ? `class="badge rounded-pill fw-bold" ${hc.badgeBg}` : `class="badge rounded-pill fw-bold ${hc.badgeBg}"`;

                    return `
                        <div class="p-3 rounded-3 border bg-light-subtle shadow-xs">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <div class="d-flex align-items-center gap-2">
                                    <span class="hall-pill ${hc.pillClass}">${hc.name}</span>
                                    <span class="fw-semibold text-dark small">${hc.subtitle}</span>
                                </div>
                                <span ${badgeAttr}>${count} Bookings (${sharePct}%)</span>
                            </div>
                            <div class="progress mb-2" style="height: 8px; border-radius: 4px; background-color: #e2e8f0;">
                                <div class="progress-bar" role="progressbar" style="width: ${sharePct}%; background-color: ${hc.barColor};" aria-valuenow="${sharePct}" aria-valuemin="0" aria-valuemax="100"></div>
                            </div>
                            <div class="d-flex justify-content-between text-muted small flex-wrap gap-2 pt-1 border-top border-light">
                                <span><i class="bi bi-cash-stack me-1 text-success"></i>Revenue: <strong class="text-dark">₹${rev.toLocaleString()}</strong></span>
                                <span><i class="bi bi-check2-circle me-1 text-primary"></i>Active: <strong class="text-dark">${activeCount}</strong></span>
                                <span><i class="bi bi-clock-history me-1 text-secondary"></i>Completed: <strong class="text-dark">${completedCount}</strong></span>
                            </div>
                        </div>
                    `;
                }).join('');
            }

            // 3. Booking Lifecycle Distribution
            const statusBreakdownContainer = document.getElementById('overall-status-breakdown');
            if (statusBreakdownContainer) {
                const totalBookingsCount = bookings.length || 1;
                const statusList = [
                    { label: 'Confirmed / Active', statusKey: 'Confirmed', count: bookings.filter(b => b.status === 'Confirmed' || b.status === 'Booked').length, badgeClass: 'Confirmed', barBg: 'bg-success' },
                    { label: 'Completed Events', statusKey: 'Completed', count: bookings.filter(b => b.status === 'Completed').length, badgeClass: 'Completed', barBg: 'bg-secondary' },
                    { label: 'Draft Bookings', statusKey: 'Draft', count: bookings.filter(b => b.status === 'Draft').length, badgeClass: 'Draft', barBg: 'bg-warning' },
                    { label: 'Cancelled Bookings', statusKey: 'Cancelled', count: bookings.filter(b => b.status === 'Cancelled').length, badgeClass: 'Cancelled', barBg: 'bg-danger' },
                    { label: 'Archived Records', statusKey: 'Archived', count: bookings.filter(b => b.status === 'Archived').length, badgeClass: 'Archived', barBg: 'bg-dark' }
                ];

                statusBreakdownContainer.innerHTML = statusList.map(st => {
                    const pct = bookings.length > 0 ? Math.round((st.count / totalBookingsCount) * 100) : 0;
                    return `
                        <div class="p-2.5 px-3 rounded-3 border bg-light-subtle d-flex flex-column gap-1 shadow-xs">
                            <div class="d-flex justify-content-between align-items-center">
                                <div class="d-flex align-items-center gap-2">
                                    <span class="badge-status ${st.badgeClass} py-0.5 px-2.5">${st.label}</span>
                                    <span class="text-muted small">${pct}% share</span>
                                </div>
                                <span class="fw-bold text-dark font-monospace">${st.count}</span>
                            </div>
                            <div class="progress" style="height: 6px; border-radius: 3px; background-color: #e2e8f0;">
                                <div class="progress-bar ${st.barBg}" role="progressbar" style="width: ${pct}%;" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"></div>
                            </div>
                        </div>
                    `;
                }).join('');
            }

            // 4. Recent System Transactions Table
            const recentTxBody = document.getElementById('overall-recent-txns-body');
            if (recentTxBody) {
                const recentTxns = payments.slice(0, 10);
                if (recentTxns.length === 0) {
                    recentTxBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted"><i class="bi bi-inbox me-1"></i>No system transactions recorded yet.</td></tr>`;
                } else {
                    recentTxBody.innerHTML = recentTxns.map(t => {
                        const isNegative = t.type && (t.type.includes('Return') || t.type.includes('Refund'));
                        let badgeClass = 'badge-txn-rent';
                        if (t.type && t.type.includes('Deposit')) badgeClass = 'badge-txn-deposit';
                        else if (t.type && t.type.includes('Advance')) badgeClass = 'badge-txn-advance';
                        else if (t.type && (t.type.includes('Refund') || t.type.includes('Return'))) badgeClass = 'badge-txn-refund';

                        const matchedBooking = bookings.find(b => b.id === t.bookingId);
                        const customerDisplayName = (matchedBooking && matchedBooking.customerName) ? matchedBooking.customerName : (t.customerName || 'N/A');

                        return `
                            <tr class="${t.isVoided ? 'bg-light text-muted opacity-75' : ''}">
                                <td class="fw-semibold text-primary font-monospace">${escapeHtml(t.receiptNumber || 'N/A')}</td>
                                <td>
                                    <div class="fw-bold text-dark">${escapeHtml(customerDisplayName)}</div>
                                    <small class="text-muted font-monospace">${escapeHtml(t.bookingId || '')}</small>
                                </td>
                                <td><span class="badge-txn-type ${badgeClass}">${escapeHtml(t.type || 'Payment')}</span></td>
                                <td>
                                    <span class="badge bg-light text-dark border">${escapeHtml(t.paymentMethod || 'Cash')}</span>
                                    ${t.referenceNumber && t.referenceNumber !== 'N/A' ? `<small class="text-muted ms-1">${escapeHtml(t.referenceNumber)}</small>` : ''}
                                </td>
                                <td>
                                    <div class="small fw-medium">${escapeHtml(t.date || '')}</div>
                                    <small class="text-muted">${escapeHtml(t.time || '')}</small>
                                </td>
                                <td><span class="badge bg-secondary-subtle text-secondary">${escapeHtml(t.collectedBy || 'Admin')}</span></td>
                                <td class="text-end fw-bold ${t.isVoided ? 'text-decoration-line-through text-muted' : (isNegative ? 'text-danger' : 'text-success')}">
                                    ${isNegative ? '-' : '+'}₹${Number(t.amount || 0).toLocaleString()}
                                </td>
                                <td class="text-end pe-3">
                                    <button class="btn btn-sm btn-outline-dark py-0.5 px-2 btn-summary-view-rcpt" data-rcpt="${t.receiptNumber}" title="View Receipt">
                                        <i class="bi bi-receipt me-1"></i>Receipt
                                    </button>
                                </td>
                            </tr>
                        `;
                    }).join('');

                    recentTxBody.querySelectorAll('.btn-summary-view-rcpt').forEach(btn => {
                        btn.addEventListener('click', () => {
                            openReceiptModal(btn.getAttribute('data-rcpt'));
                        });
                    });
                }
            }
        } catch (err) {
            console.error("Error loading overall summary view:", err);
        }
    }

    // Refresh Overall Summary Button
    const refreshOverallSummaryBtn = document.getElementById('btn-refresh-overall-summary');
    if (refreshOverallSummaryBtn) {
        refreshOverallSummaryBtn.addEventListener('click', (e) => {
            e.preventDefault();
            loadOverallSummaryView();
        });
    }

    // =========================================================================
    // 11. YEARLY EVENTS & ANALYTICS VIEW
    // =========================================================================
    let yearlyEventsChartInstance = null;
    let yearlyRevenueChartInstance = null;
    let currentYearlyFilter = 'All'; // 'All' | 'YYYY'
    let currentYearlyChartMetric = 'events'; // 'events' | 'revenue'
    let currentYearlyChartType = 'bar'; // 'bar' | 'line'

    async function loadYearlyEventsView() {
        try {
            const url = currentYearlyFilter && currentYearlyFilter !== 'All' 
                ? `/api/stats/yearly?year=${encodeURIComponent(currentYearlyFilter)}` 
                : '/api/stats/yearly';
            
            const res = await fetch(url);
            const json = await res.json();
            if (!json.success || !json.data) {
                console.error("Failed to load yearly stats:", json.message);
                return;
            }

            const data = json.data;
            const availableYears = data.availableYears || [];
            const yearlySummaries = data.yearlySummaries || [];
            const grandTotals = data.grandTotals || {};
            const selectedYearData = data.selectedYearData;

            // 1. Populate/Sync Year Filter Select
            const yearlySelect = document.getElementById('yearly-filter-select');
            if (yearlySelect) {
                const currentVal = currentYearlyFilter;
                let selectHtml = `<option value="All" ${currentVal === 'All' ? 'selected' : ''}>All Years</option>`;
                availableYears.forEach(yr => {
                    selectHtml += `<option value="${escapeHtml(yr)}" ${currentVal === yr ? 'selected' : ''}>${escapeHtml(yr)}</option>`;
                });
                yearlySelect.innerHTML = selectHtml;
                yearlySelect.value = currentVal;
            }

            // 2. Determine Display Metrics based on current filter
            const isAllYears = (currentYearlyFilter === 'All');
            let dispTotalEvents = 0;
            let dispRevenue = 0;
            let dispPendingDues = 0;
            let dispCompleted = 0;
            let dispConfirmed = 0;
            let dispDraft = 0;
            let dispCancelled = 0;
            let dispArchived = 0;
            let dispHall1Count = 0;
            let dispHall1Revenue = 0;
            let dispHall2Count = 0;
            let dispHall2Revenue = 0;
            let activeEventsList = [];
            let monthlyDistData = [];

            if (isAllYears) {
                dispTotalEvents = grandTotals.totalEvents || 0;
                dispRevenue = grandTotals.totalRevenue || 0;
                dispPendingDues = grandTotals.totalPendingDues || 0;

                yearlySummaries.forEach(y => {
                    dispCompleted += y.completedEvents;
                    dispConfirmed += y.activeEvents;
                    dispDraft += y.draftEvents;
                    dispCancelled += y.cancelledEvents;
                    dispArchived += y.archivedEvents;
                    if (Array.isArray(y.events)) {
                        activeEventsList.push(...y.events);
                    }
                });

                const h1 = grandTotals.hallBreakdown && (grandTotals.hallBreakdown['Small Hall'] || grandTotals.hallBreakdown['Hall 1']);
                const h2 = grandTotals.hallBreakdown && (grandTotals.hallBreakdown['Big Hall'] || grandTotals.hallBreakdown['Hall 2']);
                dispHall1Count = h1 ? h1.totalEvents : 0;
                dispHall1Revenue = h1 ? h1.revenue : 0;
                dispHall2Count = h2 ? h2.totalEvents : 0;
                dispHall2Revenue = h2 ? h2.revenue : 0;

                // Aggregate 12 months across all years
                const monthAgg = [
                    { monthIndex: 1, monthName: 'Jan', totalEvents: 0, hall1Events: 0, hall2Events: 0, revenue: 0 },
                    { monthIndex: 2, monthName: 'Feb', totalEvents: 0, hall1Events: 0, hall2Events: 0, revenue: 0 },
                    { monthIndex: 3, monthName: 'Mar', totalEvents: 0, hall1Events: 0, hall2Events: 0, revenue: 0 },
                    { monthIndex: 4, monthName: 'Apr', totalEvents: 0, hall1Events: 0, hall2Events: 0, revenue: 0 },
                    { monthIndex: 5, monthName: 'May', totalEvents: 0, hall1Events: 0, hall2Events: 0, revenue: 0 },
                    { monthIndex: 6, monthName: 'Jun', totalEvents: 0, hall1Events: 0, hall2Events: 0, revenue: 0 },
                    { monthIndex: 7, monthName: 'Jul', totalEvents: 0, hall1Events: 0, hall2Events: 0, revenue: 0 },
                    { monthIndex: 8, monthName: 'Aug', totalEvents: 0, hall1Events: 0, hall2Events: 0, revenue: 0 },
                    { monthIndex: 9, monthName: 'Sep', totalEvents: 0, hall1Events: 0, hall2Events: 0, revenue: 0 },
                    { monthIndex: 10, monthName: 'Oct', totalEvents: 0, hall1Events: 0, hall2Events: 0, revenue: 0 },
                    { monthIndex: 11, monthName: 'Nov', totalEvents: 0, hall1Events: 0, hall2Events: 0, revenue: 0 },
                    { monthIndex: 12, monthName: 'Dec', totalEvents: 0, hall1Events: 0, hall2Events: 0, revenue: 0 }
                ];

                yearlySummaries.forEach(y => {
                    if (Array.isArray(y.monthlyDistribution)) {
                        y.monthlyDistribution.forEach((m, idx) => {
                            if (monthAgg[idx]) {
                                monthAgg[idx].totalEvents += m.totalEvents;
                                monthAgg[idx].hall1Events += m.hall1Events;
                                monthAgg[idx].hall2Events += m.hall2Events;
                                monthAgg[idx].revenue += m.revenue;
                            }
                        });
                    }
                });
                monthlyDistData = monthAgg;

            } else if (selectedYearData) {
                const y = selectedYearData;
                dispTotalEvents = y.totalEvents || 0;
                dispRevenue = y.totalRevenue || 0;
                dispPendingDues = y.pendingDues || 0;
                dispCompleted = y.completedEvents || 0;
                dispConfirmed = y.activeEvents || 0;
                dispDraft = y.draftEvents || 0;
                dispCancelled = y.cancelledEvents || 0;
                dispArchived = y.archivedEvents || 0;

                const h1 = y.hallBreakdown && (y.hallBreakdown['Small Hall'] || y.hallBreakdown['Hall 1']);
                const h2 = y.hallBreakdown && (y.hallBreakdown['Big Hall'] || y.hallBreakdown['Hall 2']);
                dispHall1Count = h1 ? h1.totalEvents : 0;
                dispHall1Revenue = h1 ? h1.revenue : 0;
                dispHall2Count = h2 ? h2.totalEvents : 0;
                dispHall2Revenue = h2 ? h2.revenue : 0;

                activeEventsList = y.events || [];
                monthlyDistData = y.monthlyDistribution || [];
            }

            // 3. Update KPI Header Cards
            const labelEvents = document.getElementById('yearly-label-total-events');
            if (labelEvents) labelEvents.textContent = isAllYears ? 'Total Events (All-Time)' : `Total Events (${currentYearlyFilter})`;

            const subEvents = document.getElementById('yearly-sub-total-events');
            if (subEvents) subEvents.textContent = isAllYears ? 'All recorded years' : `Year ${currentYearlyFilter} events`;

            const statEvents = document.getElementById('yearly-stat-total-events');
            if (statEvents) statEvents.textContent = dispTotalEvents;

            const labelRev = document.getElementById('yearly-label-total-revenue');
            if (labelRev) labelRev.textContent = isAllYears ? 'Revenue Earned (All-Time)' : `Revenue Earned (${currentYearlyFilter})`;

            const subRev = document.getElementById('yearly-sub-total-revenue');
            if (subRev) subRev.textContent = isAllYears ? 'Net rent collected across all years' : `Net rent collected in ${currentYearlyFilter}`;

            const statRev = document.getElementById('yearly-stat-total-revenue');
            if (statRev) statRev.textContent = `₹${dispRevenue.toLocaleString()}`;

            const statH1Count = document.getElementById('yearly-stat-hall1-count');
            if (statH1Count) statH1Count.textContent = `${dispHall1Count} Events`;

            const statH1Rev = document.getElementById('yearly-stat-hall1-revenue');
            if (statH1Rev) statH1Rev.textContent = `Revenue: ₹${dispHall1Revenue.toLocaleString()}`;

            const statH2Count = document.getElementById('yearly-stat-hall2-count');
            if (statH2Count) statH2Count.textContent = `${dispHall2Count} Events`;

            const statH2Rev = document.getElementById('yearly-stat-hall2-revenue');
            if (statH2Rev) statH2Rev.textContent = `Revenue: ₹${dispHall2Revenue.toLocaleString()}`;

            // Secondary Metrics
            const statCompleted = document.getElementById('yearly-stat-completed');
            if (statCompleted) statCompleted.textContent = dispCompleted;

            const statConfirmed = document.getElementById('yearly-stat-confirmed');
            if (statConfirmed) statConfirmed.textContent = dispConfirmed;

            const statDraft = document.getElementById('yearly-stat-draft');
            if (statDraft) statDraft.textContent = dispDraft;

            const statCancelled = document.getElementById('yearly-stat-cancelled');
            if (statCancelled) statCancelled.textContent = dispCancelled;

            const statArchived = document.getElementById('yearly-stat-archived');
            if (statArchived) statArchived.textContent = dispArchived;

            const statDues = document.getElementById('yearly-stat-pending-dues');
            if (statDues) statDues.textContent = `₹${dispPendingDues.toLocaleString()}`;

            // 4. Render Chart.js Visualizations
            if (typeof Chart !== 'undefined') {
                // Sorted chronologically for clean chart progression (e.g. 2024 -> 2027)
                const chronSummaries = [...yearlySummaries].sort((a, b) => a.year.localeCompare(b.year));

                // --- Chart 1: Yearly Events Trend & Hall Breakdown ---
                const chart1Canvas = document.getElementById('yearlyEventsChart');
                const chart1Badge = document.getElementById('yearly-chart1-badge');
                const chart1Title = document.getElementById('yearly-events-chart-title');
                const chart1Subtitle = document.getElementById('yearly-events-chart-subtitle');

                if (chart1Canvas) {
                    if (yearlyEventsChartInstance) {
                        yearlyEventsChartInstance.destroy();
                        yearlyEventsChartInstance = null;
                    }

                    let chart1Labels = [];
                    let chart1Datasets = [];

                    if (isAllYears) {
                        if (chart1Badge) chart1Badge.textContent = 'Multi-Year Comparative';
                        if (chart1Title) chart1Title.innerHTML = '<i class="bi bi-bar-chart-fill text-primary me-2"></i>Yearly Events Trend by Hall';
                        if (chart1Subtitle) chart1Subtitle.textContent = 'Annual event volume comparison across halls';

                        chart1Labels = chronSummaries.map(s => s.year);
                        const hall1Data = chronSummaries.map(s => ((s.hallBreakdown['Small Hall'] || s.hallBreakdown['Hall 1']) ? (s.hallBreakdown['Small Hall'] || s.hallBreakdown['Hall 1']).totalEvents : 0));
                        const hall2Data = chronSummaries.map(s => ((s.hallBreakdown['Big Hall'] || s.hallBreakdown['Hall 2']) ? (s.hallBreakdown['Big Hall'] || s.hallBreakdown['Hall 2']).totalEvents : 0));
                        const totalData = chronSummaries.map(s => s.totalEvents);

                        chart1Datasets = [
                            {
                                label: 'Small Hall',
                                data: hall1Data,
                                backgroundColor: 'rgba(2, 132, 199, 0.85)',
                                borderColor: '#0284c7',
                                borderWidth: 1.5,
                                borderRadius: 6,
                                tension: 0.3
                            },
                            {
                                label: 'Big Hall',
                                data: hall2Data,
                                backgroundColor: 'rgba(124, 58, 237, 0.85)',
                                borderColor: '#7c3aed',
                                borderWidth: 1.5,
                                borderRadius: 6,
                                tension: 0.3
                            },
                            {
                                label: 'Total Events',
                                data: totalData,
                                backgroundColor: 'rgba(16, 185, 129, 0.25)',
                                borderColor: '#10b981',
                                borderWidth: 2,
                                borderRadius: 6,
                                type: currentYearlyChartType === 'bar' ? 'bar' : 'line',
                                tension: 0.3
                            }
                        ];
                    } else {
                        if (chart1Badge) chart1Badge.textContent = `Year ${currentYearlyFilter} Monthly`;
                        if (chart1Title) chart1Title.innerHTML = `<i class="bi bi-bar-chart-fill text-primary me-2"></i>${currentYearlyFilter} Monthly Events by Hall`;
                        if (chart1Subtitle) chart1Subtitle.textContent = `Monthly event distribution across Small Hall & Big Hall in ${currentYearlyFilter}`;

                        chart1Labels = monthlyDistData.map(m => m.monthName);
                        const hall1Data = monthlyDistData.map(m => (m.smallHallEvents !== undefined ? m.smallHallEvents : m.hall1Events || 0));
                        const hall2Data = monthlyDistData.map(m => (m.bigHallEvents !== undefined ? m.bigHallEvents : m.hall2Events || 0));
                        const totalData = monthlyDistData.map(m => m.totalEvents);

                        chart1Datasets = [
                            {
                                label: 'Small Hall',
                                data: hall1Data,
                                backgroundColor: 'rgba(2, 132, 199, 0.85)',
                                borderColor: '#0284c7',
                                borderWidth: 1.5,
                                borderRadius: 4,
                                tension: 0.3
                            },
                            {
                                label: 'Big Hall',
                                data: hall2Data,
                                backgroundColor: 'rgba(124, 58, 237, 0.85)',
                                borderColor: '#7c3aed',
                                borderWidth: 1.5,
                                borderRadius: 4,
                                tension: 0.3
                            },
                            {
                                label: 'Total Events',
                                data: totalData,
                                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                                borderColor: '#10b981',
                                borderWidth: 2,
                                borderRadius: 4,
                                type: currentYearlyChartType === 'bar' ? 'bar' : 'line',
                                tension: 0.3
                            }
                        ];
                    }

                    yearlyEventsChartInstance = new Chart(chart1Canvas, {
                        type: currentYearlyChartType,
                        data: {
                            labels: chart1Labels,
                            datasets: chart1Datasets
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: {
                                    position: 'top',
                                    labels: { boxWidth: 14, font: { family: 'Inter', size: 12, weight: '500' } }
                                },
                                tooltip: {
                                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                    padding: 10,
                                    cornerRadius: 8,
                                    titleFont: { family: 'Inter', weight: 'bold' },
                                    bodyFont: { family: 'Inter' }
                                }
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    ticks: {
                                        stepSize: 1,
                                        font: { family: 'Inter' }
                                    },
                                    grid: { color: 'rgba(226, 232, 240, 0.8)' }
                                },
                                x: {
                                    grid: { display: false },
                                    ticks: { font: { family: 'Inter', weight: '600' } }
                                }
                            }
                        }
                    });
                }

                // --- Chart 2: Annual / Monthly Revenue Performance ---
                const chart2Canvas = document.getElementById('yearlyRevenueChart');
                const chart2Badge = document.getElementById('yearly-chart2-badge');
                const chart2Title = document.getElementById('yearly-revenue-chart-title');
                const chart2Subtitle = document.getElementById('yearly-revenue-chart-subtitle');

                if (chart2Canvas) {
                    if (yearlyRevenueChartInstance) {
                        yearlyRevenueChartInstance.destroy();
                        yearlyRevenueChartInstance = null;
                    }

                    let chart2Labels = [];
                    let chart2Data = [];

                    if (isAllYears) {
                        if (chart2Badge) chart2Badge.textContent = 'Revenue Growth';
                        if (chart2Title) chart2Title.innerHTML = '<i class="bi bi-graph-up-arrow text-success me-2"></i>Yearly Revenue Earnings (₹)';
                        if (chart2Subtitle) chart2Subtitle.textContent = 'Annual net rent earnings over the years';

                        chart2Labels = chronSummaries.map(s => s.year);
                        chart2Data = chronSummaries.map(s => s.totalRevenue);
                    } else {
                        if (chart2Badge) chart2Badge.textContent = `Year ${currentYearlyFilter} Revenue`;
                        if (chart2Title) chart2Title.innerHTML = `<i class="bi bi-graph-up-arrow text-success me-2"></i>${currentYearlyFilter} Monthly Revenue Trend (₹)`;
                        if (chart2Subtitle) chart2Subtitle.textContent = `Monthly rent collection in ${currentYearlyFilter}`;

                        chart2Labels = monthlyDistData.map(m => m.monthName);
                        chart2Data = monthlyDistData.map(m => m.revenue);
                    }

                    yearlyRevenueChartInstance = new Chart(chart2Canvas, {
                        type: currentYearlyChartType === 'line' ? 'line' : 'bar',
                        data: {
                            labels: chart2Labels,
                            datasets: [{
                                label: 'Revenue Earned (₹)',
                                data: chart2Data,
                                backgroundColor: currentYearlyChartType === 'line' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.85)',
                                borderColor: '#10b981',
                                borderWidth: 2,
                                borderRadius: 6,
                                fill: true,
                                tension: 0.35,
                                pointBackgroundColor: '#10b981',
                                pointRadius: 4,
                                pointHoverRadius: 6
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: {
                                    position: 'top',
                                    labels: { boxWidth: 14, font: { family: 'Inter', size: 12, weight: '500' } }
                                },
                                tooltip: {
                                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                    padding: 10,
                                    cornerRadius: 8,
                                    callbacks: {
                                        label: (context) => ` Revenue: ₹${Number(context.raw || 0).toLocaleString()}`
                                    }
                                }
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    ticks: {
                                        callback: (value) => '₹' + Number(value).toLocaleString(),
                                        font: { family: 'Inter' }
                                    },
                                    grid: { color: 'rgba(226, 232, 240, 0.8)' }
                                },
                                x: {
                                    grid: { display: false },
                                    ticks: { font: { family: 'Inter', weight: '600' } }
                                }
                            }
                        }
                    });
                }
            }

            // 5. Render Hall Distribution Breakdown Cards
            const hallContainer = document.getElementById('yearly-hall-breakdown-container');
            const hallBadge = document.getElementById('yearly-hall-count-badge');
            if (hallContainer) {
                const activeHallObj = isAllYears 
                    ? (grandTotals.hallBreakdown || {}) 
                    : ((selectedYearData && selectedYearData.hallBreakdown) || {});

                const hallKeys = Object.keys(activeHallObj);
                if (hallBadge) hallBadge.textContent = `${hallKeys.length} Hall${hallKeys.length === 1 ? '' : 's'} Configured`;

                if (hallKeys.length === 0) {
                    hallContainer.innerHTML = `<div class="p-3 text-center text-muted">No hall events found for this period.</div>`;
                } else {
                    const totalPeriodEvents = dispTotalEvents || 1;
                    hallContainer.innerHTML = hallKeys.map(hName => {
                        const hInfo = activeHallObj[hName];
                        const count = hInfo.totalEvents || 0;
                        const pct = Math.round((count / totalPeriodEvents) * 100);
                        const rev = hInfo.revenue || 0;
                        const dues = hInfo.pendingDues || 0;
                        const isHall1 = hName.includes('1');
                        const barColor = isHall1 ? '#0284c7' : '#7c3aed';
                        const pillClass = isHall1 ? 'hall-1' : 'hall-2';
                        const badgeStyle = isHall1 ? 'bg-primary-subtle text-primary' : 'style="background:#f3e8ff; color:#6b21a8;"';

                        return `
                            <div class="p-3 rounded-3 border bg-light-subtle shadow-xs">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <div class="d-flex align-items-center gap-2">
                                        <span class="hall-pill ${pillClass}">${escapeHtml(hName)}</span>
                                        <span class="fw-semibold text-dark small">${isHall1 ? 'Main Grand Auditorium' : 'Executive Mini Hall'}</span>
                                    </div>
                                    <span class="badge rounded-pill fw-bold ${badgeStyle.startsWith('style') ? '' : badgeStyle}" ${badgeStyle.startsWith('style') ? badgeStyle : ''}>
                                        ${count} Events (${pct}%)
                                    </span>
                                </div>
                                <div class="progress mb-2" style="height: 8px; border-radius: 4px; background-color: #e2e8f0;">
                                    <div class="progress-bar" role="progressbar" style="width: ${pct}%; background-color: ${barColor};" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"></div>
                                </div>
                                <div class="d-flex justify-content-between text-muted small flex-wrap gap-2 pt-1 border-top border-light">
                                    <span><i class="bi bi-cash-stack me-1 text-success"></i>Revenue: <strong class="text-dark">₹${rev.toLocaleString()}</strong></span>
                                    <span><i class="bi bi-hourglass-split me-1 text-warning"></i>Dues: <strong class="text-dark">₹${dues.toLocaleString()}</strong></span>
                                </div>
                            </div>
                        `;
                    }).join('');
                }
            }

            // 6. Render Monthly Distribution Table
            const monthlyBody = document.getElementById('yearly-monthly-table-body');
            const monthlyTitle = document.getElementById('yearly-monthly-table-title');
            if (monthlyBody) {
                if (monthlyTitle) {
                    monthlyTitle.innerHTML = `<i class="bi bi-calendar-month text-primary me-2"></i>${isAllYears ? 'Consolidated Monthly Distribution (Jan - Dec)' : `Year ${currentYearlyFilter} Monthly Distribution (Jan - Dec)`}`;
                }

                monthlyBody.innerHTML = monthlyDistData.map(m => {
                    const hasEvents = m.totalEvents > 0;
                    return `
                        <tr class="${hasEvents ? '' : 'text-muted opacity-75'}">
                            <td class="fw-semibold font-monospace">${escapeHtml(m.monthName)}</td>
                            <td class="text-center font-monospace fw-bold ${hasEvents ? 'text-primary' : 'text-muted'}">${m.totalEvents}</td>
                            <td class="text-center"><span class="badge bg-primary-subtle text-primary">${m.hall1Events}</span></td>
                            <td class="text-center"><span class="badge bg-purple-subtle text-purple" style="background:#f3e8ff; color:#6b21a8;">${m.hall2Events}</span></td>
                            <td class="text-end pe-3 fw-bold ${m.revenue > 0 ? 'text-success' : 'text-muted'}">₹${m.revenue.toLocaleString()}</td>
                        </tr>
                    `;
                }).join('');
            }

            // 7. Render Year-by-Year Comparison Table
            const comparisonBody = document.getElementById('yearly-comparison-table-body');
            const yearCountBadge = document.getElementById('yearly-table-year-count');
            if (comparisonBody) {
                if (yearCountBadge) yearCountBadge.textContent = `${yearlySummaries.length} Years Recorded`;

                if (yearlySummaries.length === 0) {
                    comparisonBody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-muted">No yearly data recorded.</td></tr>`;
                } else {
                    comparisonBody.innerHTML = yearlySummaries.map(y => {
                        const h1 = y.hallBreakdown['Small Hall'] || y.hallBreakdown['Hall 1'] || { totalEvents: 0 };
                        const h2 = y.hallBreakdown['Big Hall'] || y.hallBreakdown['Hall 2'] || { totalEvents: 0 };
                        const isCurrentSelected = (currentYearlyFilter === y.year);

                        return `
                            <tr class="${isCurrentSelected ? 'table-primary-subtle' : ''}">
                                <td class="ps-3">
                                    <span class="badge bg-dark text-white font-monospace fs-6 px-2.5 py-1">${escapeHtml(y.year)}</span>
                                </td>
                                <td class="text-center font-monospace fw-bold fs-6">${y.totalEvents}</td>
                                <td class="text-center">
                                    <span class="badge bg-primary-subtle text-primary font-monospace">${h1.totalEvents} (${y.totalEvents > 0 ? Math.round((h1.totalEvents / y.totalEvents) * 100) : 0}%)</span>
                                </td>
                                <td class="text-center">
                                    <span class="badge bg-purple-subtle text-purple font-monospace" style="background:#f3e8ff; color:#6b21a8;">${h2.totalEvents} (${y.totalEvents > 0 ? Math.round((h2.totalEvents / y.totalEvents) * 100) : 0}%)</span>
                                </td>
                                <td class="text-center"><span class="badge bg-success-subtle text-success">${y.completedEvents}</span></td>
                                <td class="text-center"><span class="badge bg-primary-subtle text-primary">${y.activeEvents}</span></td>
                                <td class="text-center"><span class="badge bg-danger-subtle text-danger">${y.cancelledEvents}</span></td>
                                <td class="text-end fw-bold text-success font-monospace">₹${y.totalRevenue.toLocaleString()}</td>
                                <td class="text-end fw-bold text-warning font-monospace">₹${y.pendingDues.toLocaleString()}</td>
                                <td class="text-end pe-3">
                                    <button class="btn btn-sm btn-primary py-1 px-3 btn-open-year-ledger" data-year="${escapeHtml(y.year)}" title="Open Annual Performance Ledger for Year ${escapeHtml(y.year)}">
                                        <i class="bi bi-journal-text me-1"></i>View Ledger
                                    </button>
                                </td>
                            </tr>
                        `;
                    }).join('');

                    comparisonBody.querySelectorAll('.btn-open-year-ledger').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            e.preventDefault();
                            const chosenYear = btn.getAttribute('data-year');
                            openYearLedgerModal(chosenYear, yearlySummaries);
                        });
                    });
                }
            }

            // 8. Render Filtered Year Events Detail Table
            const eventsBody = document.getElementById('yearly-events-table-body');
            const eventsCountBadge = document.getElementById('yearly-events-count-badge');
            const eventsTitle = document.getElementById('yearly-events-list-title');
            const eventsSubtitle = document.getElementById('yearly-events-list-subtitle');

            if (eventsBody) {
                if (eventsCountBadge) eventsCountBadge.textContent = `${activeEventsList.length} Events`;
                if (eventsTitle) {
                    eventsTitle.innerHTML = `<i class="bi bi-card-checklist text-primary me-2"></i>Events Recorded in ${isAllYears ? 'All Years' : `Year ${currentYearlyFilter}`}`;
                }
                if (eventsSubtitle) {
                    eventsSubtitle.textContent = `Showing all bookings recorded for ${isAllYears ? 'all available years' : `year ${currentYearlyFilter}`}`;
                }

                if (activeEventsList.length === 0) {
                    eventsBody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-muted"><i class="bi bi-calendar-x me-1"></i>No events recorded for this selection.</td></tr>`;
                } else {
                    eventsBody.innerHTML = activeEventsList.map(b => {
                        const f = b.financial || {};
                        const netRent = Number(f.netRent) || (b.contract && b.contract.hallRent) || 0;
                        const paid = Number(f.netRentPaid) || 0;
                        const due = Number(f.remainingRent) || 0;
                        const hallPillClass = (b.hall === 'Hall 1') ? 'hall-1' : 'hall-2';

                        return `
                            <tr>
                                <td class="ps-3">
                                    <span class="fw-bold text-primary font-monospace">${escapeHtml(b.id)}</span>
                                </td>
                                <td>
                                    <div class="fw-bold text-dark">${escapeHtml(b.customerName)}</div>
                                    <small class="text-muted font-monospace"><i class="bi bi-telephone me-1"></i>${escapeHtml(b.mobileNumber || 'N/A')}</small>
                                </td>
                                <td>
                                    <div class="fw-semibold text-dark">${escapeHtml(b.eventName)}</div>
                                    <span class="hall-pill ${hallPillClass}">${escapeHtml(b.hall)}</span>
                                </td>
                                <td>
                                    <div class="fw-medium">${escapeHtml(b.bookingDate)}</div>
                                    <small class="text-muted"><i class="bi bi-clock me-1"></i>${escapeHtml(b.startTime)} - ${escapeHtml(b.endTime)}</small>
                                </td>
                                <td><span class="badge-status ${escapeHtml(b.status)}">${escapeHtml(b.status)}</span></td>
                                <td class="text-end fw-semibold">₹${netRent.toLocaleString()}</td>
                                <td class="text-end fw-bold text-success">₹${paid.toLocaleString()}</td>
                                <td class="text-end fw-bold ${due > 0 ? 'text-warning' : 'text-muted'}">₹${due.toLocaleString()}</td>
                                <td class="text-end pe-3">
                                    <button class="btn btn-sm btn-outline-dark py-0.5 px-2 btn-yearly-view-booking" data-id="${escapeHtml(b.id)}" title="View Booking Details">
                                        <i class="bi bi-eye me-1"></i>View
                                    </button>
                                </td>
                            </tr>
                        `;
                    }).join('');

                    eventsBody.querySelectorAll('.btn-yearly-view-booking').forEach(btn => {
                        btn.addEventListener('click', () => {
                            const bId = btn.getAttribute('data-id');
                            if (typeof openViewBookingModal === 'function') {
                                openViewBookingModal(bId);
                            }
                        });
                    });
                }
            }

        } catch (err) {
            console.error("Error loading yearly events view:", err);
        }
    }

    /**
     * Year-by-Year Performance Ledger Modal Opener
     * Opens detailed breakdown of events, revenue, dues, and hall distribution for any chosen year.
     */
    async function openYearLedgerModal(year, cachedSummaries = null) {
        try {
            let yData = null;
            if (Array.isArray(cachedSummaries)) {
                yData = cachedSummaries.find(y => y.year === year);
            }

            if (!yData) {
                const res = await fetch(`/api/stats/yearly?year=${encodeURIComponent(year)}`);
                const json = await res.json();
                if (json.success && json.data) {
                    yData = json.data.selectedYearData || (json.data.yearlySummaries && json.data.yearlySummaries.find(y => y.year === year));
                }
            }

            if (!yData) {
                showToast(`No performance data found for year ${year}`);
                return;
            }

            // 1. Header & KPI Cards
            const modalYearBadge = document.getElementById('year-ledger-modal-year');
            if (modalYearBadge) modalYearBadge.textContent = year;

            const statEvents = document.getElementById('year-ledger-stat-total-events');
            if (statEvents) statEvents.textContent = yData.totalEvents || 0;

            const subEvents = document.getElementById('year-ledger-sub-total-events');
            if (subEvents) subEvents.textContent = `Year ${year} total events`;

            const statRev = document.getElementById('year-ledger-stat-revenue');
            if (statRev) statRev.textContent = `₹${Number(yData.totalRevenue || 0).toLocaleString()}`;

            const statDues = document.getElementById('year-ledger-stat-dues');
            if (statDues) statDues.textContent = `₹${Number(yData.pendingDues || 0).toLocaleString()}`;

            const statContract = document.getElementById('year-ledger-stat-contract');
            if (statContract) statContract.textContent = `₹${Number(yData.totalContractAmount || 0).toLocaleString()}`;

            // 2. Hall Distribution Breakdown
            const hallContainer = document.getElementById('year-ledger-hall-breakdown');
            if (hallContainer) {
                const hallEntries = Object.keys(yData.hallBreakdown || {});
                const totalYearEvents = yData.totalEvents || 1;

                if (hallEntries.length === 0) {
                    hallContainer.innerHTML = `<div class="text-center py-3 text-muted small">No hall distribution records.</div>`;
                } else {
                    hallContainer.innerHTML = hallEntries.map(hName => {
                        const h = yData.hallBreakdown[hName];
                        const count = h.totalEvents || 0;
                        const pct = Math.round((count / totalYearEvents) * 100);
                        const isH1 = (hName === 'Hall 1');
                        const isH2 = (hName === 'Hall 2');
                        const pillClass = isH1 ? 'hall-1' : (isH2 ? 'hall-2' : 'hall-1');
                        const barColor = isH1 ? '#0284c7' : (isH2 ? '#7c3aed' : '#059669');

                        return `
                            <div class="p-2.5 px-3 rounded-3 border bg-white shadow-xs">
                                <div class="d-flex justify-content-between align-items-center mb-1.5">
                                    <div class="d-flex align-items-center gap-2">
                                        <span class="hall-pill ${pillClass}">${escapeHtml(hName)}</span>
                                        <span class="fw-semibold text-dark small">${isH1 ? 'Grand Main Hall' : (isH2 ? 'Executive Mini Hall' : 'Event Venue')}</span>
                                    </div>
                                    <span class="badge rounded-pill bg-light text-dark border font-monospace">${count} Events (${pct}%)</span>
                                </div>
                                <div class="progress mb-2" style="height: 6px; border-radius: 3px; background-color: #e2e8f0;">
                                    <div class="progress-bar" role="progressbar" style="width: ${pct}%; background-color: ${barColor};" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"></div>
                                </div>
                                <div class="d-flex justify-content-between text-muted small flex-wrap gap-2 pt-1 border-top border-light">
                                    <span><i class="bi bi-cash-stack me-1 text-success"></i>Revenue: <strong class="text-dark">₹${(h.revenue || 0).toLocaleString()}</strong></span>
                                    <span><i class="bi bi-check2-circle me-1 text-primary"></i>Active: <strong class="text-dark">${h.activeEvents || 0}</strong></span>
                                    <span><i class="bi bi-clock-history me-1 text-secondary"></i>Completed: <strong class="text-dark">${h.completedEvents || 0}</strong></span>
                                </div>
                            </div>
                        `;
                    }).join('');
                }
            }

            // 3. Status Lifecycle Breakdown
            const statusContainer = document.getElementById('year-ledger-status-breakdown');
            if (statusContainer) {
                const totalYearEvents = yData.totalEvents || 1;
                const statusList = [
                    { label: 'Completed Events', count: yData.completedEvents || 0, badgeClass: 'Completed', barBg: 'bg-success' },
                    { label: 'Confirmed / Active', count: yData.activeEvents || 0, badgeClass: 'Confirmed', barBg: 'bg-primary' },
                    { label: 'Draft Enquiries', count: yData.draftEvents || 0, badgeClass: 'Draft', barBg: 'bg-warning' },
                    { label: 'Cancelled Bookings', count: yData.cancelledEvents || 0, badgeClass: 'Cancelled', barBg: 'bg-danger' },
                    { label: 'Archived Records', count: yData.archivedEvents || 0, badgeClass: 'Archived', barBg: 'bg-secondary' }
                ];

                statusContainer.innerHTML = statusList.map(st => {
                    const pct = Math.round((st.count / totalYearEvents) * 100);
                    return `
                        <div class="p-2 px-3 rounded-3 border bg-white d-flex flex-column gap-1 shadow-xs">
                            <div class="d-flex justify-content-between align-items-center">
                                <div class="d-flex align-items-center gap-2">
                                    <span class="badge-status ${st.badgeClass} py-0.5 px-2">${st.label}</span>
                                    <span class="text-muted small">${pct}%</span>
                                </div>
                                <span class="fw-bold text-dark font-monospace">${st.count}</span>
                            </div>
                            <div class="progress" style="height: 5px; border-radius: 2.5px; background-color: #e2e8f0;">
                                <div class="progress-bar ${st.barBg}" role="progressbar" style="width: ${pct}%;" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"></div>
                            </div>
                        </div>
                    `;
                }).join('');
            }

            // 4. Monthly Table (Jan - Dec)
            const monthlyBody = document.getElementById('year-ledger-monthly-table-body');
            if (monthlyBody) {
                const months = yData.monthlyDistribution || [];
                monthlyBody.innerHTML = months.map(m => `
                    <tr>
                        <td class="fw-semibold text-dark ps-3">${m.monthName} ${year}</td>
                        <td class="text-center font-monospace fw-bold">${m.totalEvents}</td>
                        <td class="text-center"><span class="badge bg-primary-subtle text-primary">${m.hall1Events || 0}</span></td>
                        <td class="text-center"><span class="badge bg-purple-subtle text-purple" style="background:#f3e8ff; color:#6b21a8;">${m.hall2Events || 0}</span></td>
                        <td class="text-end pe-3 fw-bold ${(m.revenue || 0) > 0 ? 'text-success' : 'text-muted'}">₹${(m.revenue || 0).toLocaleString()}</td>
                    </tr>
                `).join('');
            }

            // 5. Year Events Table
            const eventsBody = document.getElementById('year-ledger-events-table-body');
            const eventsBadge = document.getElementById('year-ledger-events-count-badge');
            const events = yData.events || [];

            if (eventsBadge) eventsBadge.textContent = `${events.length} Events in ${year}`;

            if (eventsBody) {
                if (events.length === 0) {
                    eventsBody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-muted"><i class="bi bi-inbox me-1"></i>No bookings recorded for ${year}.</td></tr>`;
                } else {
                    eventsBody.innerHTML = events.map(b => {
                        const f = b.financial || {};
                        const netRent = Number(f.netRent) || (b.contract && b.contract.hallRent) || 0;
                        const paid = Number(f.netRentPaid) || 0;
                        const due = Number(f.remainingRent) || 0;
                        const hallPillClass = (b.hall === 'Hall 1') ? 'hall-1' : 'hall-2';

                        return `
                            <tr>
                                <td class="ps-3 font-monospace fw-bold text-primary">${escapeHtml(b.id)}</td>
                                <td>
                                    <div class="fw-bold text-dark">${escapeHtml(b.customerName)}</div>
                                    <small class="text-muted"><i class="bi bi-telephone me-1"></i>${escapeHtml(b.mobileNumber || 'N/A')}</small>
                                </td>
                                <td>
                                    <div class="fw-semibold text-dark">${escapeHtml(b.eventName)}</div>
                                    <span class="hall-pill ${hallPillClass}">${escapeHtml(b.hall)}</span>
                                </td>
                                <td>
                                    <div class="fw-medium">${escapeHtml(b.bookingDate)}</div>
                                    <small class="text-muted">${escapeHtml(b.startTime)} - ${escapeHtml(b.endTime)}</small>
                                </td>
                                <td><span class="badge-status ${escapeHtml(b.status)}">${escapeHtml(b.status)}</span></td>
                                <td class="text-end fw-semibold">₹${netRent.toLocaleString()}</td>
                                <td class="text-end fw-bold text-success">₹${paid.toLocaleString()}</td>
                                <td class="text-end fw-bold ${due > 0 ? 'text-warning' : 'text-muted'}">₹${due.toLocaleString()}</td>
                                <td class="text-end pe-3">
                                    <button class="btn btn-sm btn-outline-dark py-0.5 px-2 btn-ledger-view-booking" data-id="${escapeHtml(b.id)}" title="View Booking Details">
                                        <i class="bi bi-eye me-1"></i>View
                                    </button>
                                </td>
                            </tr>
                        `;
                    }).join('');

                    eventsBody.querySelectorAll('.btn-ledger-view-booking').forEach(btn => {
                        btn.addEventListener('click', () => {
                            const bId = btn.getAttribute('data-id');
                            if (typeof openViewBookingModal === 'function') {
                                openViewBookingModal(bId);
                            }
                        });
                    });
                }
            }

            // 6. Action Button Bindings
            const filterDashboardBtn = document.getElementById('btn-filter-dashboard-from-ledger');
            if (filterDashboardBtn) {
                filterDashboardBtn.onclick = () => {
                    currentYearlyFilter = year;
                    yearLedgerModal.hide();
                    loadYearlyEventsView();
                    showToast(`Filtered Yearly Events View to Year ${year}`);
                };
            }

            const printLedgerBtn = document.getElementById('btn-print-year-ledger');
            if (printLedgerBtn) {
                printLedgerBtn.onclick = () => {
                    window.print();
                };
            }

            // Open modal
            yearLedgerModal.show();

        } catch (err) {
            console.error("Error opening year ledger modal:", err);
            showToast("Failed to load year ledger modal.");
        }
    }

    // Attach Yearly Events Interactive Controls & Filter Event Listeners
    const yearlySelectEl = document.getElementById('yearly-filter-select');
    if (yearlySelectEl) {
        yearlySelectEl.addEventListener('change', (e) => {
            currentYearlyFilter = e.target.value;
            loadYearlyEventsView();
        });
    }

    const refreshYearlyBtn = document.getElementById('btn-refresh-yearly-events');
    if (refreshYearlyBtn) {
        refreshYearlyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            loadYearlyEventsView();
        });
    }

    const btnTypeBar = document.getElementById('btn-chart-type-bar');
    const btnTypeLine = document.getElementById('btn-chart-type-line');
    if (btnTypeBar && btnTypeLine) {
        btnTypeBar.addEventListener('click', () => {
            btnTypeBar.classList.add('active');
            btnTypeLine.classList.remove('active');
            currentYearlyChartType = 'bar';
            loadYearlyEventsView();
        });
        btnTypeLine.addEventListener('click', () => {
            btnTypeLine.classList.add('active');
            btnTypeBar.classList.remove('active');
            currentYearlyChartType = 'line';
            loadYearlyEventsView();
        });
    }

    // =========================================================================
    // DAY SLOT EVENTS & TIME-OF-DAY ANALYTICS
    // =========================================================================
    let currentDaySlotsDate = getTodayDateString();
    let currentDaySlotFilter = 'all'; // 'all' | 'morning' | 'afternoon' | 'evening' | 'night'
    let currentDaySlotsChartMetric = 'count'; // 'count' | 'revenue'
    let currentDaySlotsHallFilter = 'All'; // 'All' | 'Hall 1' | 'Hall 2'
    let currentDaySlotsSearch = '';
    let daySlotsChartInstance = null;
    let cachedDaySlotsData = null;

    /**
     * Normalize date string to standard YYYY-MM-DD format
     */
    function normalizeDaySlotsDate(rawDate) {
        if (!rawDate) return getTodayDateString();
        if (typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDate.trim())) {
            return rawDate.trim();
        }
        try {
            const d = new Date(rawDate);
            if (!isNaN(d.getTime())) {
                const yr = d.getFullYear();
                const mo = String(d.getMonth() + 1).padStart(2, '0');
                const da = String(d.getDate()).padStart(2, '0');
                return `${yr}-${mo}-${da}`;
            }
        } catch (_) {}
        return getTodayDateString();
    }

    /**
     * Load and render Day Slot Analytics View
     */
    async function loadDaySlotsView(forceRefresh = false) {
        const refreshBtn = document.getElementById('btn-refresh-day-slots');
        const refreshIcon = refreshBtn?.querySelector('i');
        if (refreshIcon) refreshIcon.classList.add('spin-animation');

        try {
            const dateInput = document.getElementById('day-slots-date-picker');
            let selectedDate = (dateInput && dateInput.value) ? dateInput.value.trim() : '';
            selectedDate = normalizeDaySlotsDate(selectedDate || currentDaySlotsDate);
            currentDaySlotsDate = selectedDate;

            if (dateInput && dateInput.value !== selectedDate) {
                dateInput.value = selectedDate;
            }

            let daySlotsData = null;

            // 1. Fetch live data from MongoDB Atlas backend endpoint
            try {
                const res = await fetch(`/api/stats/day-slots?date=${encodeURIComponent(selectedDate)}`);
                if (res.ok) {
                    const json = await res.json();
                    if (json && json.success && json.data) {
                        daySlotsData = json.data;
                    }
                }
            } catch (fetchErr) {
                console.warn("Backend API fetch notice:", fetchErr.message);
            }

            // 2. Fallback to client dataAdapter only if backend is unreachable
            if (!daySlotsData && typeof window !== 'undefined' && window.dataAdapter && typeof window.dataAdapter.getDaySlots === 'function') {
                try {
                    const adapterResp = window.dataAdapter.getDaySlots(selectedDate);
                    if (adapterResp && adapterResp.data) {
                        daySlotsData = adapterResp.data;
                    }
                } catch (adapterErr) {}
            }

            // 3. Clean empty state fallback if no data
            if (!daySlotsData) {
                daySlotsData = computeDaySlotsFallback(selectedDate);
            }

            cachedDaySlotsData = daySlotsData;
            renderDaySlotsUI(daySlotsData);

            if (forceRefresh) {
                showToast("Day Slot Events refreshed successfully!");
            }
        } catch (err) {
            console.error("Error loading Day Slots View:", err);
            showToast("Failed to load Day Slot Events data.");
        } finally {
            if (refreshIcon) {
                setTimeout(() => refreshIcon.classList.remove('spin-animation'), 400);
            }
        }
    }

    /**
     * Fallback computation engine for standalone / offline frontend simulation
     */
    function computeDaySlotsFallback(targetDate) {
        if (typeof window !== 'undefined' && window.dataAdapter && typeof window.dataAdapter.getDaySlots === 'function') {
            const resp = window.dataAdapter.getDaySlots(targetDate);
            if (resp && resp.data) return resp.data;
        }

        const defaultSlots = {
            morning: { key: 'morning', name: 'Morning', timeRange: '06:00–12:00', icon: 'bi-sunrise', color: '#f59e0b', count: 0, activeCount: 0, completedCount: 0, cancelledCount: 0, draftCount: 0, archivedCount: 0, revenue: 0, contractAmount: 0, pendingDues: 0, hallCounts: { 'Hall 1': 0, 'Hall 2': 0 }, events: [] },
            afternoon: { key: 'afternoon', name: 'Afternoon', timeRange: '12:00–16:00', icon: 'bi-sun', color: '#3b82f6', count: 0, activeCount: 0, completedCount: 0, cancelledCount: 0, draftCount: 0, archivedCount: 0, revenue: 0, contractAmount: 0, pendingDues: 0, hallCounts: { 'Hall 1': 0, 'Hall 2': 0 }, events: [] },
            evening: { key: 'evening', name: 'Evening', timeRange: '16:00–20:00', icon: 'bi-sunset', color: '#8b5cf6', count: 0, activeCount: 0, completedCount: 0, cancelledCount: 0, draftCount: 0, archivedCount: 0, revenue: 0, contractAmount: 0, pendingDues: 0, hallCounts: { 'Hall 1': 0, 'Hall 2': 0 }, events: [] },
            night: { key: 'night', name: 'Night', timeRange: '20:00–00:00', icon: 'bi-moon-stars', color: '#475569', count: 0, activeCount: 0, completedCount: 0, cancelledCount: 0, draftCount: 0, archivedCount: 0, revenue: 0, contractAmount: 0, pendingDues: 0, hallCounts: { 'Hall 1': 0, 'Hall 2': 0 }, events: [] }
        };

        return {
            date: targetDate,
            totalEvents: 0,
            activeEvents: 0,
            totalRevenue: 0,
            totalContractAmount: 0,
            totalPendingDues: 0,
            slots: defaultSlots,
            slotList: [defaultSlots.morning, defaultSlots.afternoon, defaultSlots.evening, defaultSlots.night],
            hallBreakdown: {
                'Hall 1': { hallName: 'Hall 1', totalEvents: 0, morning: 0, afternoon: 0, evening: 0, night: 0, revenue: 0 },
                'Hall 2': { hallName: 'Hall 2', totalEvents: 0, morning: 0, afternoon: 0, evening: 0, night: 0, revenue: 0 }
            }
        };
    }

    /**
     * Defensive UI Renderer for Day Slot Events
     */
    function renderDaySlotsUI(data) {
        if (!data) return;

        try {
            const slots = data.slots || {};
            const morning = slots.morning || {};
            const afternoon = slots.afternoon || {};
            const evening = slots.evening || {};
            const night = slots.night || {};

            // 1. Update Date Picker & Header Badge
            const dateInput = document.getElementById('day-slots-date-picker');
            if (dateInput) dateInput.value = data.date || currentDaySlotsDate;

            const dateBadge = document.getElementById('day-slots-date-badge');
            if (dateBadge) {
                const isToday = (data.date === getTodayDateString());
                dateBadge.textContent = isToday ? 'Today' : (data.date || 'Selected Date');
                dateBadge.className = isToday ? 'badge bg-primary-subtle text-primary border border-primary-subtle' : 'badge bg-light text-muted border';
            }

            // 2. Render 4 Slot KPI Summary Cards
            const updateCard = (key, slotData) => {
                const countEl = document.getElementById(`slot-${key}-count`);
                const revEl = document.getElementById(`slot-${key}-revenue`);
                const actEl = document.getElementById(`slot-${key}-active`);
                const hallsEl = document.getElementById(`slot-${key}-halls`);
                const cardEl = document.getElementById(`card-slot-${key}`);

                if (countEl) countEl.textContent = `${slotData.count || 0} ${slotData.count === 1 ? 'Event' : 'Events'}`;
                if (revEl) revEl.textContent = `₹${(slotData.revenue || 0).toLocaleString('en-IN')}`;
                if (actEl) actEl.textContent = `${slotData.activeCount || 0} Confirmed`;
                if (hallsEl) {
                    const h1 = slotData.hallCounts?.['Hall 1'] || 0;
                    const h2 = slotData.hallCounts?.['Hall 2'] || 0;
                    hallsEl.textContent = `H1: ${h1} | H2: ${h2}`;
                }

                if (cardEl) {
                    cardEl.classList.remove('active-slot-morning', 'active-slot-afternoon', 'active-slot-evening', 'active-slot-night');
                    if (currentDaySlotFilter === key) {
                        cardEl.classList.add(`active-slot-${key}`);
                    }
                }
            };

            updateCard('morning', morning);
            updateCard('afternoon', afternoon);
            updateCard('evening', evening);
            updateCard('night', night);

            // 3. Render Daily Slot Summary Totals & Capacity
            const totalEventsEl = document.getElementById('day-slots-total-events');
            const totalRevEl = document.getElementById('day-slots-total-revenue');
            const totalContractEl = document.getElementById('day-slots-total-contract');

            if (totalEventsEl) totalEventsEl.textContent = `${data.totalEvents || 0} Events`;
            if (totalRevEl) totalRevEl.textContent = `₹${(data.totalRevenue || 0).toLocaleString('en-IN')}`;
            if (totalContractEl) totalContractEl.textContent = `₹${(data.totalContractAmount || 0).toLocaleString('en-IN')}`;

            // Render Capacity Progress Rows
            const breakdownList = document.getElementById('day-slots-breakdown-list');
            if (breakdownList) {
                const slotDefs = [
                    { key: 'morning', name: 'Morning', time: '06:00–12:00', data: morning, color: '#f59e0b', bgClass: 'bg-warning' },
                    { key: 'afternoon', name: 'Afternoon', time: '12:00–16:00', data: afternoon, color: '#3b82f6', bgClass: 'bg-primary' },
                    { key: 'evening', name: 'Evening', time: '16:00–20:00', data: evening, color: '#8b5cf6', bgClass: 'bg-info' },
                    { key: 'night', name: 'Night', time: '20:00–00:00', data: night, color: '#475569', bgClass: 'bg-dark' }
                ];

                let listHtml = '';
                slotDefs.forEach(s => {
                    const count = s.data.count || 0;
                    const rev = s.data.revenue || 0;
                    const h1 = s.data.hallCounts?.['Hall 1'] || 0;
                    const h2 = s.data.hallCounts?.['Hall 2'] || 0;
                    const total = data.totalEvents || 1;
                    const pct = Math.round((count / total) * 100) || 0;

                    listHtml += `
                        <div class="p-2 border rounded-3 bg-white">
                            <div class="d-flex justify-content-between align-items-center mb-1 small">
                                <span class="fw-semibold text-dark">${escapeHtml(s.name)} (${escapeHtml(s.time)})</span>
                                <span class="fw-bold" style="color: ${s.color}">${count} events (₹${rev.toLocaleString('en-IN')})</span>
                            </div>
                            <div class="progress" style="height: 6px;">
                                <div class="progress-bar ${s.bgClass}" role="progressbar" style="width: ${pct}%;" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"></div>
                            </div>
                            <div class="d-flex justify-content-between align-items-center mt-1 text-muted" style="font-size: 0.75rem;">
                                <span>Hall 1: ${h1}</span>
                                <span>Hall 2: ${h2}</span>
                            </div>
                        </div>
                    `;
                });
                breakdownList.innerHTML = listHtml;
            }

            // 4. Render Chart.js Chart
            renderDaySlotsChart(data);

            // 5. Render Events Table
            renderDaySlotsTable(data);
        } catch (uiErr) {
            console.error("Error in renderDaySlotsUI:", uiErr);
        }
    }

    /**
     * Render Chart.js visualization for Day Slots
     */
    function renderDaySlotsChart(data) {
        const canvas = document.getElementById('daySlotsChart');
        if (!canvas) return;

        try {
            if (daySlotsChartInstance) {
                daySlotsChartInstance.destroy();
                daySlotsChartInstance = null;
            }

            const slots = data.slots || {};
            const slotKeys = ['morning', 'afternoon', 'evening', 'night'];
            const labels = ['Morning (06–12)', 'Afternoon (12–16)', 'Evening (16–20)', 'Night (20–00)'];

            let datasets = [];

            if (currentDaySlotsChartMetric === 'revenue') {
                const revData = slotKeys.map(k => slots[k]?.revenue || 0);
                datasets = [{
                    label: 'Rent Revenue (₹)',
                    data: revData,
                    backgroundColor: [
                        'rgba(245, 158, 11, 0.85)',
                        'rgba(59, 130, 246, 0.85)',
                        'rgba(139, 92, 246, 0.85)',
                        'rgba(71, 85, 105, 0.85)'
                    ],
                    borderColor: ['#f59e0b', '#3b82f6', '#8b5cf6', '#475569'],
                    borderWidth: 1.5,
                    borderRadius: 6
                }];
            } else {
                const h1Data = slotKeys.map(k => slots[k]?.hallCounts?.['Small Hall'] || slots[k]?.hallCounts?.['Hall 1'] || 0);
                const h2Data = slotKeys.map(k => slots[k]?.hallCounts?.['Big Hall'] || slots[k]?.hallCounts?.['Hall 2'] || 0);

                datasets = [
                    {
                        label: 'Small Hall Bookings',
                        data: h1Data,
                        backgroundColor: 'rgba(37, 99, 235, 0.85)',
                        borderColor: '#2563eb',
                        borderWidth: 1.5,
                        borderRadius: 6
                    },
                    {
                        label: 'Big Hall Bookings',
                        data: h2Data,
                        backgroundColor: 'rgba(124, 58, 237, 0.85)',
                        borderColor: '#7c3aed',
                        borderWidth: 1.5,
                        borderRadius: 6
                    }
                ];
            }

            daySlotsChartInstance = new Chart(canvas, {
                type: 'bar',
                data: {
                    labels,
                    datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: { boxWidth: 12, font: { family: 'Inter', size: 12, weight: '500' } }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.9)',
                            padding: 10,
                            cornerRadius: 8,
                            titleFont: { family: 'Inter', weight: 'bold' },
                            bodyFont: { family: 'Inter' }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: currentDaySlotsChartMetric === 'revenue' ? undefined : 1,
                                font: { family: 'Inter' }
                            },
                            grid: { color: 'rgba(226, 232, 240, 0.8)' }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { font: { family: 'Inter', weight: '600' } }
                        }
                    }
                }
            });
        } catch (chartErr) {
            console.error("Error rendering Day Slots Chart:", chartErr);
        }
    }

    /**
     * Render the table of events for selected slot
     */
    function renderDaySlotsTable(data) {
        const tableBody = document.getElementById('day-slots-table-body');
        const emptyState = document.getElementById('day-slots-empty-state');
        const tableEl = document.getElementById('day-slots-table');
        const countBadge = document.getElementById('day-slots-count-badge');
        const titleEl = document.getElementById('day-slots-table-title');
        const subtitleEl = document.getElementById('day-slots-table-subtitle');

        if (!tableBody || !data) return;

        try {
            // 1. Gather events for selected slot
            const slots = data.slots || {};
            let events = [];

            if (currentDaySlotFilter === 'all') {
                ['morning', 'afternoon', 'evening', 'night'].forEach(k => {
                    if (slots[k]?.events) {
                        events.push(...slots[k].events);
                    }
                });
            } else if (slots[currentDaySlotFilter]?.events) {
                events = [...slots[currentDaySlotFilter].events];
            }

            // 2. Filter by Hall
            if (currentDaySlotsHallFilter && currentDaySlotsHallFilter !== 'All') {
                events = events.filter(e => e.hall === currentDaySlotsHallFilter);
            }

            // 3. Filter by Search Query
            if (currentDaySlotsSearch && currentDaySlotsSearch.trim()) {
                const q = currentDaySlotsSearch.trim().toLowerCase();
                events = events.filter(e => {
                    const name = (e.eventName || '').toLowerCase();
                    const cust = (e.customerName || '').toLowerCase();
                    const mob = (e.mobileNumber || '').toLowerCase();
                    const hall = (e.hall || '').toLowerCase();
                    const id = (e.id || '').toLowerCase();
                    const status = (e.status || '').toLowerCase();
                    return name.includes(q) || cust.includes(q) || mob.includes(q) || hall.includes(q) || id.includes(q) || status.includes(q);
                });
            }

            // Update table title
            const slotTitleMap = {
                'all': '<i class="bi bi-card-checklist text-primary me-2"></i>All Day Slot Events',
                'morning': '<i class="bi bi-sunrise text-warning me-2"></i>Morning Slot Events (06:00 – 12:00)',
                'afternoon': '<i class="bi bi-sun text-primary me-2"></i>Afternoon Slot Events (12:00 – 16:00)',
                'evening': '<i class="bi bi-sunset text-info me-2"></i>Evening Slot Events (16:00 – 20:00)',
                'night': '<i class="bi bi-moon-stars text-dark me-2"></i>Night Slot Events (20:00 – 00:00)'
            };
            if (titleEl) titleEl.innerHTML = slotTitleMap[currentDaySlotFilter] || slotTitleMap['all'];
            if (subtitleEl) subtitleEl.textContent = `Showing ${events.length} events for ${data.date || currentDaySlotsDate}`;
            if (countBadge) countBadge.textContent = `${events.length} ${events.length === 1 ? 'Event' : 'Events'}`;

            // Sync filter pills active status
            document.querySelectorAll('#day-slot-filter-pills button').forEach(btn => {
                const s = btn.getAttribute('data-slot');
                if (s === currentDaySlotFilter) {
                    btn.className = `btn btn-${s === 'morning' ? 'warning' : s === 'evening' ? 'info' : s === 'night' ? 'dark' : 'primary'} active`;
                } else {
                    btn.className = `btn btn-outline-${s === 'morning' ? 'warning' : s === 'evening' ? 'info' : s === 'night' ? 'dark' : 'primary'}`;
                }
            });

            // 4. Render Table Rows or Empty State
            if (events.length === 0) {
                tableBody.innerHTML = '';
                if (tableEl && tableEl.parentElement) tableEl.parentElement.classList.add('d-none');
                if (emptyState) {
                    emptyState.classList.remove('d-none');
                    const emptyTitle = document.getElementById('day-slots-empty-title');
                    const emptyDesc = document.getElementById('day-slots-empty-desc');
                    const slotName = currentDaySlotFilter === 'all' ? 'any slot' : `${currentDaySlotFilter.toUpperCase()} slot`;
                    if (emptyTitle) emptyTitle.textContent = `No events scheduled in ${slotName}`;
                    if (emptyDesc) emptyDesc.textContent = `There are no bookings recorded for ${data.date || currentDaySlotsDate} in ${slotName}.`;
                }
                return;
            }

            if (emptyState) emptyState.classList.add('d-none');
            if (tableEl && tableEl.parentElement) tableEl.parentElement.classList.remove('d-none');

            let rowsHtml = '';
            events.forEach(e => {
                const slotKey = e.slotKey || 'morning';
                const badgeClass = `slot-badge-${slotKey}`;
                const hallBadgeClass = (e.hall === 'Hall 2') ? 'badge-hall2' : 'badge-hall1';
                const statusClass = `status-${e.status || 'Confirmed'}`;

                const fin = e.financial || {};
                const netRent = fin.netRent !== undefined ? fin.netRent : (e.contract?.hallRent || 0);
                const netRentPaid = fin.netRentPaid !== undefined ? fin.netRentPaid : 0;
                const remainingRent = fin.remainingRent !== undefined ? fin.remainingRent : 0;

                rowsHtml += `
                    <tr>
                        <td class="ps-3">
                            <span class="badge ${badgeClass} px-2.5 py-1 fw-bold rounded-pill mb-1">
                                ${escapeHtml(e.slotName || slotKey)}
                            </span>
                            <div class="fw-semibold text-dark small font-monospace">
                                <i class="bi bi-clock me-1 text-muted"></i>${escapeHtml(e.startTime)} – ${escapeHtml(e.endTime)}
                            </div>
                        </td>
                        <td>
                            <span class="badge ${hallBadgeClass} px-2.5 py-1 fw-semibold">${escapeHtml(e.hall || 'Small Hall')}</span>
                        </td>
                        <td>
                            <div class="fw-bold text-dark">${escapeHtml(e.eventName)}</div>
                            <div class="small text-muted">
                                <i class="bi bi-person me-1"></i>${escapeHtml(e.customerName)} 
                                <span class="text-secondary opacity-75">(${escapeHtml(e.mobileNumber)})</span>
                            </div>
                        </td>
                        <td>
                            <span class="badge ${statusClass} px-2.5 py-1">${escapeHtml(e.status || 'Confirmed')}</span>
                        </td>
                        <td class="text-end fw-semibold text-dark">₹${Number(netRent).toLocaleString('en-IN')}</td>
                        <td class="text-end fw-bold text-success">₹${Number(netRentPaid).toLocaleString('en-IN')}</td>
                        <td class="text-end fw-semibold ${remainingRent > 0 ? 'text-warning' : 'text-muted'}">
                            ₹${Number(remainingRent).toLocaleString('en-IN')}
                        </td>
                        <td class="text-end pe-3">
                            <div class="btn-group btn-group-sm">
                                <button class="btn btn-outline-primary btn-view-booking-day-slot" data-id="${escapeHtml(e.id)}" title="View Booking Details">
                                    <i class="bi bi-eye"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });

            tableBody.innerHTML = rowsHtml;

            // Attach row button actions
            tableBody.querySelectorAll('.btn-view-booking-day-slot').forEach(btn => {
                btn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    const bId = btn.getAttribute('data-id');
                    if (typeof openViewBookingModal === 'function') {
                        openViewBookingModal(bId);
                    }
                });
            });
        } catch (tableErr) {
            console.error("Error rendering Day Slots Table:", tableErr);
        }
    }

    // Attach Day Slots Interactive Controls & Filter Event Listeners
    const daySlotDateInput = document.getElementById('day-slots-date-picker');
    if (daySlotDateInput) {
        daySlotDateInput.addEventListener('change', (e) => {
            currentDaySlotsDate = normalizeDaySlotsDate(e.target.value);
            loadDaySlotsView();
        });
        daySlotDateInput.addEventListener('input', (e) => {
            if (e.target.value && /^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) {
                currentDaySlotsDate = e.target.value;
                loadDaySlotsView();
            }
        });
    }

    const btnPrevDay = document.getElementById('btn-day-slots-prev');
    if (btnPrevDay) {
        btnPrevDay.addEventListener('click', (e) => {
            e.preventDefault();
            const parts = currentDaySlotsDate.split('-').map(Number);
            const d = new Date(parts[0], parts[1] - 1, parts[2]);
            d.setDate(d.getDate() - 1);
            currentDaySlotsDate = normalizeDaySlotsDate(d);
            if (daySlotDateInput) daySlotDateInput.value = currentDaySlotsDate;
            loadDaySlotsView();
        });
    }

    const btnNextDay = document.getElementById('btn-day-slots-next');
    if (btnNextDay) {
        btnNextDay.addEventListener('click', (e) => {
            e.preventDefault();
            const parts = currentDaySlotsDate.split('-').map(Number);
            const d = new Date(parts[0], parts[1] - 1, parts[2]);
            d.setDate(d.getDate() + 1);
            currentDaySlotsDate = normalizeDaySlotsDate(d);
            if (daySlotDateInput) daySlotDateInput.value = currentDaySlotsDate;
            loadDaySlotsView();
        });
    }

    const btnToday = document.getElementById('btn-day-slots-today');
    if (btnToday) {
        btnToday.addEventListener('click', (e) => {
            e.preventDefault();
            currentDaySlotsDate = getTodayDateString();
            if (daySlotDateInput) daySlotDateInput.value = currentDaySlotsDate;
            loadDaySlotsView();
        });
    }

    const refreshDaySlotsBtn = document.getElementById('btn-refresh-day-slots');
    if (refreshDaySlotsBtn) {
        refreshDaySlotsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            loadDaySlotsView(true);
        });
    }

    // Slot Summary Card click bindings
    ['morning', 'afternoon', 'evening', 'night'].forEach(slotKey => {
        const card = document.getElementById(`card-slot-${slotKey}`);
        if (card) {
            card.addEventListener('click', () => {
                if (currentDaySlotFilter === slotKey) {
                    currentDaySlotFilter = 'all';
                } else {
                    currentDaySlotFilter = slotKey;
                }
                if (cachedDaySlotsData) {
                    renderDaySlotsUI(cachedDaySlotsData);
                } else {
                    loadDaySlotsView();
                }
            });
        }
    });

    // Slot Filter Pills
    document.querySelectorAll('#day-slot-filter-pills button').forEach(btn => {
        btn.addEventListener('click', () => {
            currentDaySlotFilter = btn.getAttribute('data-slot') || 'all';
            if (cachedDaySlotsData) {
                renderDaySlotsUI(cachedDaySlotsData);
            } else {
                loadDaySlotsView();
            }
        });
    });

    // Hall Filter
    const hallFilter = document.getElementById('day-slots-hall-filter');
    if (hallFilter) {
        hallFilter.addEventListener('change', (e) => {
            currentDaySlotsHallFilter = e.target.value || 'All';
            if (cachedDaySlotsData) {
                renderDaySlotsTable(cachedDaySlotsData);
            }
        });
    }

    // Instant Search
    const searchInput = document.getElementById('day-slots-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentDaySlotsSearch = e.target.value || '';
            if (cachedDaySlotsData) {
                renderDaySlotsTable(cachedDaySlotsData);
            }
        });
    }

    // Chart Metric Toggles
    const btnChartCount = document.getElementById('btn-day-slot-chart-count');
    const btnChartRevenue = document.getElementById('btn-day-slot-chart-revenue');
    if (btnChartCount && btnChartRevenue) {
        btnChartCount.addEventListener('click', () => {
            btnChartCount.classList.add('active');
            btnChartRevenue.classList.remove('active');
            currentDaySlotsChartMetric = 'count';
            if (cachedDaySlotsData) renderDaySlotsChart(cachedDaySlotsData);
        });
        btnChartRevenue.addEventListener('click', () => {
            btnChartRevenue.classList.add('active');
            btnChartCount.classList.remove('active');
            currentDaySlotsChartMetric = 'revenue';
            if (cachedDaySlotsData) renderDaySlotsChart(cachedDaySlotsData);
        });
    }

    // =========================================================================
    // FACULTY OPERATIONS LOGIC (TODAY'S & UPCOMING TASKS, CHECKLISTS, ACKNOWLEDGMENT)
    // =========================================================================

    let facCurrentShift = 'all';
    let facCurrentHall = 'All';
    let facCurrentStatus = 'All';
    let facCurrentSearch = '';

    async function loadFacultyTodayView() {
        const datePicker = document.getElementById('fac-date-picker');
        const selectedDate = datePicker ? (datePicker.value || getTodayDateString()) : getTodayDateString();

        const container = document.getElementById('faculty-today-cards-container');
        const emptyState = document.getElementById('faculty-today-empty-state');
        if (container) {
            container.innerHTML = `
                <div class="col-12 text-center py-5">
                    <div class="spinner-border text-success" role="status"></div>
                    <div class="small text-muted mt-2">Loading today's event tasks...</div>
                </div>
            `;
        }

        try {
            const query = new URLSearchParams({
                type: 'today',
                date: selectedDate,
                shift: facCurrentShift,
                hall: facCurrentHall,
                status: facCurrentStatus,
                search: facCurrentSearch
            });

            const res = await fetch(`/api/staff/events?${query.toString()}`);
            const result = await res.json();

            if (result.success && Array.isArray(result.data)) {
                renderFacultyTodayCards(result.data, selectedDate);
            } else {
                if (container) container.innerHTML = '';
                if (emptyState) emptyState.classList.remove('d-none');
            }
        } catch (err) {
            console.error("Error loading faculty today tasks:", err);
            if (container) {
                container.innerHTML = `<div class="col-12"><div class="alert alert-danger">Failed to load event tasks.</div></div>`;
            }
        }
    }

    function renderFacultyTodayCards(events = [], selectedDate) {
        const container = document.getElementById('faculty-today-cards-container');
        const emptyState = document.getElementById('faculty-today-empty-state');

        // Update KPI counters
        const totalCount = events.length;
        const readyCount = events.filter(e => (e.requirements && e.requirements.status === 'Ready')).length;
        const progressCount = events.filter(e => (e.requirements && e.requirements.status === 'In Progress')).length;
        const pendingCount = events.filter(e => (!e.requirements || e.requirements.status === 'Pending' || !e.requirements.status)).length;

        if (document.getElementById('fac-kpi-total')) document.getElementById('fac-kpi-total').textContent = totalCount;
        if (document.getElementById('fac-kpi-ready')) document.getElementById('fac-kpi-ready').textContent = readyCount;
        if (document.getElementById('fac-kpi-progress')) document.getElementById('fac-kpi-progress').textContent = progressCount;
        if (document.getElementById('fac-kpi-pending')) document.getElementById('fac-kpi-pending').textContent = pendingCount;

        if (!events || events.length === 0) {
            if (container) container.innerHTML = '';
            if (emptyState) emptyState.classList.remove('d-none');
            return;
        }

        if (emptyState) emptyState.classList.add('d-none');

        let html = '';
        events.forEach(event => {
            const reqs = event.requirements || {};
            const chairs = reqs.chairs || { needed: true, quantity: 100, prepared: false, notes: '' };
            const sound = reqs.sound || { needed: true, type: 'Podium Mic', prepared: false, notes: '' };
            const lighting = reqs.lighting || { needed: true, type: 'Stage Lighting', prepared: false, notes: '' };
            const catering = reqs.catering || { needed: false, type: 'None', prepared: false, notes: '' };

            const isReady = reqs.status === 'Ready';
            const isProgress = reqs.status === 'In Progress';
            const cardClass = isReady ? 'ready-card' : (isProgress ? 'progress-card' : 'pending-card');

            const statusBadge = isReady 
                ? '<span class="badge bg-success text-white px-2.5 py-1 fw-semibold"><i class="bi bi-check-circle me-1"></i>Ready & Prepared</span>'
                : (isProgress 
                    ? '<span class="badge bg-primary text-white px-2.5 py-1 fw-semibold"><i class="bi bi-hourglass-split me-1"></i>Setup In Progress</span>'
                    : '<span class="badge bg-warning text-dark px-2.5 py-1 fw-semibold"><i class="bi bi-exclamation-circle me-1"></i>Setup Pending</span>');

            const shiftBadgeClass = `badge-shift-${(event.shift || 'morning').toLowerCase()}`;
            const hallColorClass = (event.hall === 'Small Hall' || event.hall === 'Hall 1') ? 'text-primary' : 'text-purple';

            html += `
                <div class="col-12 col-xl-6">
                    <div class="card faculty-event-card ${cardClass} p-4 h-100">
                        <!-- Event Card Header -->
                        <div class="d-flex justify-content-between align-items-start mb-3">
                            <div>
                                <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
                                    <span class="badge ${shiftBadgeClass} px-2.5 py-1 fw-bold rounded-pill">
                                        <i class="bi bi-clock me-1"></i>${escapeHtml(event.shift || 'Shift')} (${escapeHtml(event.startTime)} - ${escapeHtml(event.endTime)})
                                    </span>
                                    <span class="badge bg-light text-dark border px-2.5 py-1 fw-semibold">
                                        <i class="bi bi-building me-1 ${hallColorClass}"></i>${escapeHtml(event.hall)}
                                    </span>
                                    <span class="badge bg-secondary-subtle text-secondary px-2 py-0.5 font-monospace small">
                                        ${escapeHtml(event.id)}
                                    </span>
                                </div>
                                <h5 class="fw-bold text-dark mb-1">${escapeHtml(event.eventName)}</h5>
                                <div class="text-muted small">
                                    <i class="bi bi-person me-1"></i>Organizer: <strong>${escapeHtml(event.customerName)}</strong> &bull;
                                    <a href="tel:${escapeHtml(event.mobileNumber)}" class="text-decoration-none text-muted">
                                        <i class="bi bi-telephone me-1"></i>${escapeHtml(event.mobileNumber)}
                                    </a>
                                </div>
                            </div>
                            <div>${statusBadge}</div>
                        </div>

                        ${event.notes ? `
                            <div class="alert alert-light border py-2 px-3 mb-3 small">
                                <i class="bi bi-info-circle text-primary me-1"></i><strong>Organizer Note:</strong> ${escapeHtml(event.notes)}
                            </div>
                        ` : ''}

                        <!-- Requirements Checklist Grid (Chairs, Sound, Lighting, Catering) -->
                        <div class="mb-3">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <span class="small fw-bold text-muted text-uppercase" style="font-size:0.75rem; letter-spacing:0.5px;">
                                    <i class="bi bi-check2-square text-success me-1"></i>Hall Preparation Checklist
                                </span>
                                <small class="text-muted">Click checkbox to toggle item</small>
                            </div>

                            <div class="row g-2">
                                <!-- Chairs Checklist Box -->
                                <div class="col-6">
                                    <div class="req-box ${chairs.prepared ? 'req-prepared' : ''} d-flex align-items-start gap-2">
                                        <input class="form-check-input mt-1 fac-req-toggle" type="checkbox" data-id="${event.id}" data-category="chairs" id="chk-chairs-${event.id}" ${chairs.prepared ? 'checked' : ''}>
                                        <label class="form-check-label w-100 cursor-pointer" for="chk-chairs-${event.id}">
                                            <div class="fw-bold small text-dark d-flex justify-content-between">
                                                <span>🪑 Chairs & Seating</span>
                                                <span class="badge bg-light text-muted border">${chairs.quantity || 0}</span>
                                            </div>
                                            <div class="text-muted" style="font-size: 0.72rem;">${escapeHtml(chairs.notes || 'Auditorium seating')}</div>
                                        </label>
                                    </div>
                                </div>

                                <!-- Sound Checklist Box -->
                                <div class="col-6">
                                    <div class="req-box ${sound.prepared ? 'req-prepared' : ''} d-flex align-items-start gap-2">
                                        <input class="form-check-input mt-1 fac-req-toggle" type="checkbox" data-id="${event.id}" data-category="sound" id="chk-sound-${event.id}" ${sound.prepared ? 'checked' : ''}>
                                        <label class="form-check-label w-100 cursor-pointer" for="chk-sound-${event.id}">
                                            <div class="fw-bold small text-dark">🔊 Sound & Mic</div>
                                            <div class="text-muted text-truncate" style="font-size: 0.72rem;">${escapeHtml(sound.type || 'Podium Mic')}</div>
                                        </label>
                                    </div>
                                </div>

                                <!-- Lighting Checklist Box -->
                                <div class="col-6">
                                    <div class="req-box ${lighting.prepared ? 'req-prepared' : ''} d-flex align-items-start gap-2">
                                        <input class="form-check-input mt-1 fac-req-toggle" type="checkbox" data-id="${event.id}" data-category="lighting" id="chk-lighting-${event.id}" ${lighting.prepared ? 'checked' : ''}>
                                        <label class="form-check-label w-100 cursor-pointer" for="chk-lighting-${event.id}">
                                            <div class="fw-bold small text-dark">💡 Stage Lighting</div>
                                            <div class="text-muted text-truncate" style="font-size: 0.72rem;">${escapeHtml(lighting.type || 'Hall & Stage')}</div>
                                        </label>
                                    </div>
                                </div>

                                <!-- Catering Checklist Box -->
                                <div class="col-6">
                                    <div class="req-box ${catering.prepared ? 'req-prepared' : ''} d-flex align-items-start gap-2">
                                        <input class="form-check-input mt-1 fac-req-toggle" type="checkbox" data-id="${event.id}" data-category="catering" id="chk-catering-${event.id}" ${catering.prepared ? 'checked' : ''} ${!catering.needed ? 'disabled' : ''}>
                                        <label class="form-check-label w-100 cursor-pointer" for="chk-catering-${event.id}">
                                            <div class="fw-bold small text-dark d-flex justify-content-between">
                                                <span>☕ Catering</span>
                                                ${!catering.needed ? '<span class="badge bg-secondary-subtle text-secondary" style="font-size:0.65rem;">N/A</span>' : ''}
                                            </div>
                                            <div class="text-muted text-truncate" style="font-size: 0.72rem;">${catering.needed ? escapeHtml(catering.type || 'Refreshments') : 'Not requested'}</div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Staff Signatures & Acknowledgment Status -->
                        <div class="d-flex justify-content-between align-items-center mt-auto pt-3 border-top flex-wrap gap-2">
                            <div class="small text-muted">
                                ${reqs.acknowledgedBy ? `
                                    <div><i class="bi bi-patch-check-fill text-success me-1"></i>Acknowledged by: <strong>${escapeHtml(reqs.acknowledgedBy)}</strong></div>
                                ` : `
                                    <div><i class="bi bi-circle text-warning me-1"></i>Task not acknowledged yet</div>
                                `}
                                ${reqs.preparedBy ? `
                                    <div><i class="bi bi-check2-all text-primary me-1"></i>Setup ready by: <strong>${escapeHtml(reqs.preparedBy)}</strong></div>
                                ` : ''}
                            </div>

                            <!-- Action Buttons -->
                            <div class="d-flex align-items-center gap-2">
                                <button class="btn btn-sm btn-outline-secondary btn-fac-view-details" data-id="${event.id}" title="View Details">
                                    <i class="bi bi-eye me-1"></i>Details
                                </button>
                                ${!reqs.acknowledgedBy ? `
                                    <button class="btn btn-sm btn-outline-success btn-fac-ack" data-id="${event.id}">
                                        <i class="bi bi-patch-check me-1"></i>Acknowledge
                                    </button>
                                ` : ''}
                                <button class="btn btn-sm ${isReady ? 'btn-success disabled' : 'btn-primary'} btn-fac-mark-ready" data-id="${event.id}" ${isReady ? 'disabled' : ''}>
                                    <i class="bi bi-check2-circle me-1"></i>${isReady ? 'Ready' : 'Mark Prepared'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

        // Attach listeners for interactive checklist checkboxes
        container.querySelectorAll('.fac-req-toggle').forEach(checkbox => {
            checkbox.addEventListener('change', async (e) => {
                const bookingId = e.target.getAttribute('data-id');
                const category = e.target.getAttribute('data-category');
                const isChecked = e.target.checked;
                await updateChecklistItem(bookingId, category, isChecked);
            });
        });

        // Attach listeners for Mark Prepared button
        container.querySelectorAll('.btn-fac-mark-ready').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const bookingId = btn.getAttribute('data-id');
                await facultyMarkPrepared(bookingId);
            });
        });

        // Attach listeners for Acknowledge button
        container.querySelectorAll('.btn-fac-ack').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const bookingId = btn.getAttribute('data-id');
                await facultyAcknowledgeTask(bookingId);
            });
        });

        // Attach listeners for View Details modal
        container.querySelectorAll('.btn-fac-view-details').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const bookingId = btn.getAttribute('data-id');
                openFacultyEventModal(bookingId);
            });
        });
    }

    async function updateChecklistItem(bookingId, category, isChecked) {
        try {
            const payload = {};
            payload[category] = { prepared: isChecked };

            const res = await fetch(`/api/staff/events/${bookingId}/requirements`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();
            if (result.success) {
                showToast(`${category.charAt(0).toUpperCase() + category.slice(1)} marked ${isChecked ? 'ready' : 'pending'}`);
                loadFacultyTodayView();
            } else {
                showToast(`Error: ${result.message}`);
            }
        } catch (err) {
            showToast('Failed to update requirement checklist.');
        }
    }

    async function facultyMarkPrepared(bookingId) {
        try {
            const res = await fetch(`/api/staff/events/${bookingId}/mark-prepared`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes: 'All requirements verified by staff' })
            });
            const result = await res.json();
            if (result.success) {
                showToast('All setup requirements marked ready!');
                loadFacultyTodayView();
                if (facultyEventModal) facultyEventModal.hide();
            } else {
                showToast(`Error: ${result.message}`);
            }
        } catch (err) {
            showToast('Failed to mark event prepared.');
        }
    }

    async function facultyAcknowledgeTask(bookingId) {
        try {
            const res = await fetch(`/api/staff/events/${bookingId}/acknowledge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes: 'Task duty acknowledged' })
            });
            const result = await res.json();
            if (result.success) {
                showToast('Event duty acknowledged!');
                loadFacultyTodayView();
                if (facultyEventModal) facultyEventModal.hide();
            } else {
                showToast(`Error: ${result.message}`);
            }
        } catch (err) {
            showToast('Failed to acknowledge task.');
        }
    }

    async function openFacultyEventModal(bookingId) {
        try {
            const res = await fetch(`/api/staff/events/${bookingId}`);
            const result = await res.json();

            if (result.success && result.data) {
                const event = result.data;
                const reqs = event.requirements || {};
                const modalBody = document.getElementById('faculty-modal-body');

                const isReady = reqs.status === 'Ready';
                const isProgress = reqs.status === 'In Progress';
                const statusBadge = isReady 
                    ? '<span class="badge bg-success text-white px-3 py-1.5 fw-semibold"><i class="bi bi-check-circle me-1"></i>Ready & Prepared</span>'
                    : (isProgress 
                        ? '<span class="badge bg-primary text-white px-3 py-1.5 fw-semibold"><i class="bi bi-hourglass-split me-1"></i>Setup In Progress</span>'
                        : '<span class="badge bg-warning text-dark px-3 py-1.5 fw-semibold"><i class="bi bi-exclamation-circle me-1"></i>Setup Pending</span>');

                const shiftBadgeClass = `badge-shift-${(event.shift || 'morning').toLowerCase()}`;

                modalBody.innerHTML = `
                    <div class="d-flex justify-content-between align-items-start mb-3 pb-3 border-bottom flex-wrap gap-2">
                        <div>
                            <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
                                <span class="badge bg-primary-subtle text-primary border px-2.5 py-1 font-monospace fw-bold">${escapeHtml(event.id)}</span>
                                <span class="badge ${shiftBadgeClass} px-2.5 py-1 fw-bold rounded-pill">${escapeHtml(event.shift || 'Shift')} Shift</span>
                                <span class="badge bg-light text-dark border px-2.5 py-1"><i class="bi bi-building me-1"></i>${escapeHtml(event.hall)}</span>
                                <span class="badge bg-info-subtle text-info border px-2.5 py-1"><i class="bi bi-calendar-event me-1"></i>${escapeHtml(event.bookingDate)}</span>
                            </div>
                            <h4 class="fw-bold text-dark mb-0">${escapeHtml(event.eventName)}</h4>
                        </div>
                        <div>${statusBadge}</div>
                    </div>

                    <!-- Event Details Grid (NO FINANCIALS) -->
                    <div class="row g-3 mb-4">
                        <div class="col-6 col-md-4">
                            <div class="p-3 bg-light rounded-3">
                                <div class="text-muted small mb-1"><i class="bi bi-person me-1"></i>Organizer / Customer</div>
                                <div class="fw-bold text-dark">${escapeHtml(event.customerName)}</div>
                                <div class="small text-muted">${escapeHtml(event.mobileNumber)}</div>
                            </div>
                        </div>
                        <div class="col-6 col-md-4">
                            <div class="p-3 bg-light rounded-3">
                                <div class="text-muted small mb-1"><i class="bi bi-clock me-1"></i>Time Slot</div>
                                <div class="fw-bold text-dark">${escapeHtml(event.startTime)} – ${escapeHtml(event.endTime)}</div>
                                <div class="small text-muted">${escapeHtml(event.hall)}</div>
                            </div>
                        </div>
                        <div class="col-12 col-md-4">
                            <div class="p-3 bg-light rounded-3">
                                <div class="text-muted small mb-1"><i class="bi bi-tag me-1"></i>Booking Status</div>
                                <div class="fw-bold text-primary">${escapeHtml(event.status)}</div>
                                <div class="small text-muted">Operational Duty Active</div>
                            </div>
                        </div>
                    </div>

                    ${event.notes ? `
                        <div class="alert alert-light border p-3 mb-4">
                            <div class="fw-bold small text-dark mb-1"><i class="bi bi-chat-left-text me-1 text-primary"></i>Organizer Notes / Requirements:</div>
                            <p class="mb-0 text-muted small">${escapeHtml(event.notes)}</p>
                        </div>
                    ` : ''}

                    <!-- Requirements Checklist Details -->
                    <div class="card border rounded-3 p-3 mb-4">
                        <h6 class="fw-bold text-dark mb-3"><i class="bi bi-card-checklist text-success me-2"></i>Requirements Checklist Status</h6>
                        <div class="row g-3">
                            <div class="col-6">
                                <div class="p-2.5 rounded-3 border ${reqs.chairs && reqs.chairs.prepared ? 'bg-success-subtle border-success-subtle' : 'bg-light'}">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <span class="fw-bold small">🪑 Chairs (${reqs.chairs ? reqs.chairs.quantity : 0})</span>
                                        <span class="badge ${reqs.chairs && reqs.chairs.prepared ? 'bg-success' : 'bg-secondary'}">${reqs.chairs && reqs.chairs.prepared ? 'Ready' : 'Pending'}</span>
                                    </div>
                                    <small class="text-muted d-block mt-1">${escapeHtml(reqs.chairs ? reqs.chairs.notes : '')}</small>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="p-2.5 rounded-3 border ${reqs.sound && reqs.sound.prepared ? 'bg-success-subtle border-success-subtle' : 'bg-light'}">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <span class="fw-bold small">🔊 Sound System</span>
                                        <span class="badge ${reqs.sound && reqs.sound.prepared ? 'bg-success' : 'bg-secondary'}">${reqs.sound && reqs.sound.prepared ? 'Ready' : 'Pending'}</span>
                                    </div>
                                    <small class="text-muted d-block mt-1">${escapeHtml(reqs.sound ? reqs.sound.type : '')}</small>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="p-2.5 rounded-3 border ${reqs.lighting && reqs.lighting.prepared ? 'bg-success-subtle border-success-subtle' : 'bg-light'}">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <span class="fw-bold small">💡 Lighting Setup</span>
                                        <span class="badge ${reqs.lighting && reqs.lighting.prepared ? 'bg-success' : 'bg-secondary'}">${reqs.lighting && reqs.lighting.prepared ? 'Ready' : 'Pending'}</span>
                                    </div>
                                    <small class="text-muted d-block mt-1">${escapeHtml(reqs.lighting ? reqs.lighting.type : '')}</small>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="p-2.5 rounded-3 border ${reqs.catering && reqs.catering.prepared ? 'bg-success-subtle border-success-subtle' : 'bg-light'}">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <span class="fw-bold small">☕ Catering Setup</span>
                                        <span class="badge ${reqs.catering && reqs.catering.prepared ? 'bg-success' : 'bg-secondary'}">${reqs.catering && reqs.catering.needed ? (reqs.catering.prepared ? 'Ready' : 'Pending') : 'N/A'}</span>
                                    </div>
                                    <small class="text-muted d-block mt-1">${escapeHtml(reqs.catering && reqs.catering.needed ? reqs.catering.type : 'Not requested')}</small>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Duty Acknowledgment Info -->
                    <div class="p-3 bg-light rounded-3 mb-3 small d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <div>
                            <i class="bi bi-patch-check text-success me-1"></i><strong>Task Acknowledgment:</strong>
                            <span>${reqs.acknowledgedBy ? `Acknowledged by ${escapeHtml(reqs.acknowledgedBy)} on ${escapeHtml((reqs.acknowledgedAt || '').split('T')[0])}` : 'Pending acknowledgment'}</span>
                        </div>
                        ${reqs.preparedBy ? `
                            <div>
                                <i class="bi bi-check2-all text-primary me-1"></i><strong>Prepared by:</strong> ${escapeHtml(reqs.preparedBy)}
                            </div>
                        ` : ''}
                    </div>
                `;

                // Configure modal action buttons
                const btnAck = document.getElementById('btn-fac-modal-ack');
                const btnMarkPrep = document.getElementById('btn-fac-modal-mark-prep');

                if (btnAck) {
                    btnAck.onclick = () => facultyAcknowledgeTask(event.id);
                    btnAck.style.display = reqs.acknowledgedBy ? 'none' : 'inline-block';
                }
                if (btnMarkPrep) {
                    btnMarkPrep.onclick = () => facultyMarkPrepared(event.id);
                    btnMarkPrep.disabled = isReady;
                    btnMarkPrep.innerHTML = isReady ? '<i class="bi bi-check-circle me-1"></i>Ready' : '<i class="bi bi-check2-circle me-1"></i>Mark All Prepared';
                }

                if (facultyEventModal) facultyEventModal.show();
            }
        } catch (err) {
            showToast('Error loading event details.');
        }
    }

    async function loadFacultyUpcomingView() {
        const container = document.getElementById('faculty-upcoming-cards-container');
        const emptyState = document.getElementById('faculty-upcoming-empty-state');
        const hallFilter = document.getElementById('fac-upcoming-hall-filter');
        const searchInput = document.getElementById('fac-upcoming-search-input');

        const hall = hallFilter ? hallFilter.value : 'All';
        const search = searchInput ? searchInput.value : '';

        if (container) {
            container.innerHTML = `
                <div class="col-12 text-center py-5">
                    <div class="spinner-border text-primary" role="status"></div>
                    <div class="small text-muted mt-2">Loading upcoming event tasks...</div>
                </div>
            `;
        }

        try {
            const query = new URLSearchParams({
                type: 'upcoming',
                hall: hall,
                search: search
            });

            const res = await fetch(`/api/staff/events?${query.toString()}`);
            const result = await res.json();

            if (result.success && Array.isArray(result.data)) {
                renderFacultyUpcomingCards(result.data);
            } else {
                if (container) container.innerHTML = '';
                if (emptyState) emptyState.classList.remove('d-none');
            }
        } catch (err) {
            console.error("Error loading upcoming faculty tasks:", err);
            if (container) container.innerHTML = `<div class="col-12"><div class="alert alert-danger">Failed to load upcoming tasks.</div></div>`;
        }
    }

    function renderFacultyUpcomingCards(events = []) {
        const container = document.getElementById('faculty-upcoming-cards-container');
        const emptyState = document.getElementById('faculty-upcoming-empty-state');

        if (!events || events.length === 0) {
            if (container) container.innerHTML = '';
            if (emptyState) emptyState.classList.remove('d-none');
            return;
        }

        if (emptyState) emptyState.classList.add('d-none');

        let html = '';
        events.forEach(event => {
            const reqs = event.requirements || {};
            const chairs = reqs.chairs || {};
            const sound = reqs.sound || {};
            const lighting = reqs.lighting || {};

            const isReady = reqs.status === 'Ready';
            const shiftBadgeClass = `badge-shift-${(event.shift || 'morning').toLowerCase()}`;

            html += `
                <div class="col-12 col-md-6 col-xl-4">
                    <div class="card faculty-event-card p-3.5 h-100">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <span class="badge bg-light text-primary border fw-bold px-2.5 py-1">
                                <i class="bi bi-calendar3 me-1"></i>${escapeHtml(event.bookingDate)}
                            </span>
                            <span class="badge ${shiftBadgeClass} px-2 py-1 fw-bold rounded-pill">
                                ${escapeHtml(event.shift || 'Shift')}
                            </span>
                        </div>

                        <h6 class="fw-bold text-dark mb-1">${escapeHtml(event.eventName)}</h6>
                        <div class="small text-muted mb-2">
                            <i class="bi bi-building me-1"></i>${escapeHtml(event.hall)} &bull; ${escapeHtml(event.startTime)} - ${escapeHtml(event.endTime)}
                        </div>
                        <div class="small text-muted mb-3">
                            <i class="bi bi-person me-1"></i>${escapeHtml(event.customerName)} (${escapeHtml(event.mobileNumber)})
                        </div>

                        <!-- Quick Requirements Summary Badges -->
                        <div class="p-2.5 bg-light rounded-3 mb-3 small">
                            <div class="d-flex justify-content-between mb-1">
                                <span>🪑 Seating:</span>
                                <span class="fw-semibold text-dark">${chairs.quantity || 100} Chairs</span>
                            </div>
                            <div class="d-flex justify-content-between mb-1">
                                <span>🔊 Sound:</span>
                                <span class="fw-semibold text-dark text-truncate max-w-150">${escapeHtml(sound.type || 'Standard')}</span>
                            </div>
                            <div class="d-flex justify-content-between">
                                <span>💡 Lighting:</span>
                                <span class="fw-semibold text-dark text-truncate max-w-150">${escapeHtml(lighting.type || 'Standard')}</span>
                            </div>
                        </div>

                        <div class="d-flex justify-content-between align-items-center mt-auto pt-2 border-top">
                            <span class="badge ${isReady ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning'} border">
                                ${isReady ? '✅ Ready' : '⏳ Prep Pending'}
                            </span>
                            <button class="btn btn-sm btn-outline-primary btn-fac-view-details" data-id="${event.id}">
                                <i class="bi bi-eye me-1"></i>View Details
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

        container.querySelectorAll('.btn-fac-view-details').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const bookingId = btn.getAttribute('data-id');
                openFacultyEventModal(bookingId);
            });
        });
    }

    // Attach Event Listeners for Faculty Controls
    const facDatePicker = document.getElementById('fac-date-picker');
    if (facDatePicker) {
        facDatePicker.addEventListener('change', () => loadFacultyTodayView());
    }

    const btnFacPrev = document.getElementById('btn-fac-prev');
    if (btnFacPrev) {
        btnFacPrev.addEventListener('click', () => {
            const picker = document.getElementById('fac-date-picker');
            const currentVal = picker ? picker.value : getTodayDateString();
            const parts = currentVal.split('-').map(Number);
            const d = new Date(parts[0], parts[1] - 1, parts[2]);
            d.setDate(d.getDate() - 1);
            const prevStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            if (picker) picker.value = prevStr;
            loadFacultyTodayView();
        });
    }

    const btnFacNext = document.getElementById('btn-fac-next');
    if (btnFacNext) {
        btnFacNext.addEventListener('click', () => {
            const picker = document.getElementById('fac-date-picker');
            const currentVal = picker ? picker.value : getTodayDateString();
            const parts = currentVal.split('-').map(Number);
            const d = new Date(parts[0], parts[1] - 1, parts[2]);
            d.setDate(d.getDate() + 1);
            const nextStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            if (picker) picker.value = nextStr;
            loadFacultyTodayView();
        });
    }

    const btnFacToday = document.getElementById('btn-fac-today');
    if (btnFacToday) {
        btnFacToday.addEventListener('click', () => {
            const picker = document.getElementById('fac-date-picker');
            if (picker) picker.value = getTodayDateString();
            loadFacultyTodayView();
        });
    }

    const btnRefreshFacToday = document.getElementById('btn-refresh-faculty-today');
    if (btnRefreshFacToday) {
        btnRefreshFacToday.addEventListener('click', () => loadFacultyTodayView());
    }

    const btnRefreshFacUpcoming = document.getElementById('btn-refresh-faculty-upcoming');
    if (btnRefreshFacUpcoming) {
        btnRefreshFacUpcoming.addEventListener('click', () => loadFacultyUpcomingView());
    }

    // Shift filter buttons
    document.querySelectorAll('#fac-shift-pills button').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#fac-shift-pills button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            facCurrentShift = btn.getAttribute('data-shift') || 'all';
            loadFacultyTodayView();
        });
    });

    const facHallFilter = document.getElementById('fac-hall-filter');
    if (facHallFilter) {
        facHallFilter.addEventListener('change', (e) => {
            facCurrentHall = e.target.value;
            loadFacultyTodayView();
        });
    }

    const facStatusFilter = document.getElementById('fac-status-filter');
    if (facStatusFilter) {
        facStatusFilter.addEventListener('change', (e) => {
            facCurrentStatus = e.target.value;
            loadFacultyTodayView();
        });
    }

    const facSearchInput = document.getElementById('fac-search-input');
    if (facSearchInput) {
        facSearchInput.addEventListener('input', (e) => {
            facCurrentSearch = e.target.value;
            loadFacultyTodayView();
        });
    }

    const facUpcomingHallFilter = document.getElementById('fac-upcoming-hall-filter');
    if (facUpcomingHallFilter) {
        facUpcomingHallFilter.addEventListener('change', () => loadFacultyUpcomingView());
    }

    const facUpcomingSearchInput = document.getElementById('fac-upcoming-search-input');
    if (facUpcomingSearchInput) {
        facUpcomingSearchInput.addEventListener('input', () => loadFacultyUpcomingView());
    }

    // HELPER FUNCTIONS
    function showToast(msg) {
        const toastMsgEl = document.getElementById('toast-message');
        if (toastMsgEl) toastMsgEl.textContent = msg;
        liveToast.show();
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    // Initial Authentication Gate & Session Boot
    const storedSession = getStoredSession();
    const portal = getRequestedPortal();

    if (storedSession && storedSession.user) {
        currentUser = storedSession.user;
        isAdminSession = (currentUser.role === 'Admin');

        if (portal === 'Staff') {
            currentRole = 'Staff';
            currentView = 'faculty-today';
        } else {
            if (currentUser.role === 'Admin') {
                currentRole = 'Admin';
                currentView = 'dashboard';
            } else {
                currentRole = 'Staff';
                currentView = 'faculty-today';
            }
        }
        showDashboardApp();
    } else {
        showAuthScreen(portal);
    }
}

// Robust execution whether DOM is loading or already parsed
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}


