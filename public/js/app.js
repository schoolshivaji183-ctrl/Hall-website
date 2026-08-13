/**
 * Client Application Logic - Hall Booking Management System (Commercial ERP Core)
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Application State ---
    let currentRole = 'Admin'; // 'Admin' | 'Faculty'
    let currentView = 'dashboard';
    let editBookingId = null;

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
    const liveToast = new bootstrap.Toast(document.getElementById('liveToast'));

    // DOM Elements
    const sidebarWrapper = document.getElementById('sidebar-wrapper');
    const menuToggle = document.getElementById('menu-toggle');
    const roleDropdownLabel = document.getElementById('current-role-label');
    const facultyBanner = document.getElementById('faculty-notice-banner');
    const navAddBtn = document.getElementById('btn-add-booking-nav');

    // Default Date Helpers (Local YYYY-MM-DD string)
    const getTodayDateString = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Set Initial Date in Filter input
    if (document.getElementById('avail-date-picker')) {
        document.getElementById('avail-date-picker').value = getTodayDateString();
    }

    // =========================================================================
    // 1. NAVIGATION & VIEW SWITCHING
    // =========================================================================
    menuToggle.addEventListener('click', (e) => {
        e.preventDefault();
        sidebarWrapper.classList.toggle('toggled');
    });

    const navItems = document.querySelectorAll('#sidebar-wrapper .list-group-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const viewTarget = item.getAttribute('data-view');
            switchView(viewTarget);
            
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
        });
    });

    function switchView(viewName) {
        currentView = viewName;
        document.querySelectorAll('.content-view').forEach(el => el.classList.add('d-none'));

        const targetEl = document.getElementById(`view-${viewName}`);
        if (targetEl) targetEl.classList.remove('d-none');

        // Update Page Title
        const titleMap = {
            'dashboard': 'Dashboard Overview',
            'bookings': 'Booking Management List',
            'availability': 'Hall Schedule Availability',
            'upcoming': 'Upcoming Events Schedule'
        };
        document.getElementById('page-title').textContent = titleMap[viewName] || 'Dashboard';

        // Each view owns its refresh. Opening a tab always reads current server data.
        if (viewName === 'dashboard') {
            loadDashboardData();
        } else if (viewName === 'bookings') {
            loadBookingsList();
        } else if (viewName === 'availability') {
            loadHallAvailability();
        } else if (viewName === 'upcoming') {
            loadUpcomingViewEvents();
        }
    }

    function refreshCurrentView(forceRefresh = true) {
        if (currentView === 'dashboard') {
            refreshDashboard();
        } else if (currentView === 'bookings') {
            loadBookingsList();
        } else if (currentView === 'availability') {
            loadHallAvailability();
        } else if (currentView === 'upcoming') {
            loadUpcomingViewEvents();
        }
    }

    // =========================================================================
    // 2. ROLE SWITCHING (ADMIN VS FACULTY)
    // =========================================================================
    document.querySelectorAll('.role-option').forEach(option => {
        option.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.role-option').forEach(o => o.classList.remove('active'));
            option.classList.add('active');

            currentRole = option.getAttribute('data-role');
            applyRolePermissions();
            showToast(`Switched to ${currentRole} Mode`);
        });
    });

    function applyRolePermissions() {
        roleDropdownLabel.textContent = `Role: ${currentRole}`;

        if (currentRole === 'Faculty') {
            facultyBanner.classList.remove('d-none');
            facultyBanner.classList.add('d-flex');
            navAddBtn.classList.add('d-none');
        } else {
            facultyBanner.classList.add('d-none');
            facultyBanner.classList.remove('d-flex');
            navAddBtn.classList.remove('d-none');
        }

        refreshCurrentView();
    }

    // =========================================================================
    // 3. API SERVICE CALLS & DASHBOARD REFRESH LOGIC
    // =========================================================================

    /**
     * Dedicated Dashboard Data Refresh - Fetches directly from /api/bookings & /api/payments.
     * Operates completely independent of cached state from other views.
     */
    async function loadDashboardData() {
        const today = getTodayDateString();
        setDashboardRefreshing(true);
        if (document.getElementById('today-date-badge')) {
            document.getElementById('today-date-badge').textContent = today;
        }

        try {
            // Direct API calls with no dependence on cached state
            const [bookingsRes, paymentsRes] = await Promise.all([
                fetch('/api/bookings'),
                fetch('/api/payments')
            ]);

            const bookingsResult = await bookingsRes.json();
            const paymentsResult = await paymentsRes.json();

            if (!bookingsResult.success || !paymentsResult.success) {
                renderDashboardNoData("No data available");
                return;
            }

            const bookings = bookingsResult.data || [];
            const payments = paymentsResult.data || [];

            // Safeguard: If no data returned from server
            if (bookings.length === 0 && payments.length === 0) {
                renderDashboardNoData("No data available");
                return;
            }

            // 1. Compute Operational Metrics directly from /api/bookings
            const totalBookings = bookings.length;
            const activeBookings = bookings.filter(b => b.status !== 'Cancelled' && b.status !== 'Archived');
            const todayEvents = bookings.filter(b => b.bookingDate === today && b.status !== 'Cancelled' && b.status !== 'Archived');

            const isHall1BookedToday = todayEvents.some(b => b.hall === 'Hall 1');
            const isHall2BookedToday = todayEvents.some(b => b.hall === 'Hall 2');

            if (document.getElementById('stat-total')) {
                document.getElementById('stat-total').textContent = totalBookings;
            }
            if (document.getElementById('stat-today-count')) {
                document.getElementById('stat-today-count').textContent = todayEvents.length;
            }
            if (document.getElementById('stat-hall1')) {
                const h1El = document.getElementById('stat-hall1');
                h1El.textContent = isHall1BookedToday ? 'Booked Today' : 'Ready for Booking';
                h1El.className = `fw-bold mb-0 text-truncate ${isHall1BookedToday ? 'text-primary' : 'text-success'}`;
            }
            if (document.getElementById('stat-hall2')) {
                const h2El = document.getElementById('stat-hall2');
                h2El.textContent = isHall2BookedToday ? 'Booked Today' : 'Ready for Booking';
                h2El.className = `fw-bold mb-0 text-truncate ${isHall2BookedToday ? 'text-purple' : 'text-success'}`;
            }

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
                if (t.type.includes('Return') || t.type.includes('Refund')) {
                    return acc - t.amount;
                } else if (!t.type.includes('Forfeiture') && !t.type.includes('Adjustment')) {
                    return acc + t.amount;
                }
                return acc;
            }, 0));

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

            // 3. Render Today's Event Schedule & Recent Activity Feed
            renderTodayDashboardEvents(todayEvents);
            renderRecentActivity(bookings.slice(-5).reverse());

        } catch (err) {
            console.error("Error loading dashboard data directly from API:", err);
            renderDashboardNoData("No data available");
        } finally {
            setDashboardRefreshing(false);
        }
    }

    function setDashboardRefreshing(isRefreshing) {
        const status = document.getElementById('dashboard-refresh-status');
        if (!status) return;
        status.classList.toggle('d-none', !isRefreshing);
    }

    function refreshDashboard() {
        return loadDashboardData();
    }

    /**
     * Clean error/fallback safeguard UI rendering
     */
    function renderDashboardNoData(message = "No data available") {
        if (document.getElementById('stat-total')) document.getElementById('stat-total').textContent = '0';
        if (document.getElementById('stat-today-count')) document.getElementById('stat-today-count').textContent = '0';
        if (document.getElementById('stat-hall1')) {
            document.getElementById('stat-hall1').textContent = 'N/A';
            document.getElementById('stat-hall1').className = 'fw-bold mb-0 text-truncate text-muted';
        }
        if (document.getElementById('stat-hall2')) {
            document.getElementById('stat-hall2').textContent = 'N/A';
            document.getElementById('stat-hall2').className = 'fw-bold mb-0 text-truncate text-muted';
        }
        if (document.getElementById('stat-today-collection')) document.getElementById('stat-today-collection').textContent = '₹0';
        if (document.getElementById('stat-pending-payments')) document.getElementById('stat-pending-payments').textContent = '₹0';
        if (document.getElementById('stat-total-revenue')) document.getElementById('stat-total-revenue').textContent = '₹0';
        if (document.getElementById('stat-deposits-held')) document.getElementById('stat-deposits-held').textContent = '₹0';

        const eventsContainer = document.getElementById('today-events-container');
        if (eventsContainer) {
            eventsContainer.innerHTML = `
                <div class="text-center py-4 text-muted">
                    <i class="bi bi-inbox fs-3 text-secondary d-block mb-1"></i>
                    ${message}
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
            if (requestId !== bookingsListRequestId) return;

            const fetchedData = (result.success && Array.isArray(result.data)) ? result.data : [];
            const filteredBookings = applyBookingsFiltersAndRender(fetchedData);
            renderBookingsTable(filteredBookings);
        } catch (err) {
            if (requestId !== bookingsListRequestId) return;
            console.error("Error loading filtered bookings:", err);
            renderBookingsTable([]);
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

    function applyBookingsFiltersAndRender(fetchedData) {
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

    function renderBookingsTable(bookings) {
        const tbody = document.getElementById('bookings-table-body');
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
            const isFaculty = currentRole === 'Faculty';
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

            const actionButtonsHTML = isFaculty ? `<span class="badge bg-light text-secondary border">Read-Only</span>` : `
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
                    <div class="small text-muted"><span class="hall-pill ${b.hall === 'Hall 1' ? 'hall-1' : 'hall-2'} me-1">${b.hall}</span> ${b.bookingDate}</div>
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
            const isFaculty = currentRole === 'Faculty';
            const div = document.createElement('div');
            div.className = `timeline-slot d-flex justify-content-between align-items-center ${isCompleted ? 'bg-light text-muted opacity-75 border-secondary' : ''}`;
            
            const statusControlHTML = renderStatusSelectControl(b.id, b.status, isFaculty);

            div.innerHTML = `
                <div>
                    <h6 class="fw-bold mb-1 ${isCompleted ? 'text-decoration-line-through text-muted' : ''}">${escapeHtml(b.eventName)}</h6>
                    <div class="small text-muted">
                        <span class="fw-medium text-dark me-2"><i class="bi bi-person me-1"></i>${escapeHtml(b.customerName)}</span>
                        <span><i class="bi bi-clock me-1"></i>${b.startTime} - ${b.endTime}</span>
                    </div>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <span class="hall-pill ${b.hall === 'Hall 1' ? 'hall-1' : 'hall-2'}">${b.hall}</span>
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

        const h1Slots = data['Hall 1'].slots;
        const h2Slots = data['Hall 2'].slots;

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
            const isFaculty = currentRole === 'Faculty';
            const slotDiv = document.createElement('div');
            slotDiv.className = `p-3 rounded-3 border-start border-4 ${isCompleted ? 'bg-light border-secondary text-muted opacity-75' : 'bg-light border-primary'}`;
            const statusControlHTML = renderStatusSelectControl(s.id, s.status, isFaculty);

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
            const isFaculty = currentRole === 'Faculty';
            const statusControlHTML = renderStatusSelectControl(b.id, b.status, isFaculty);

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
    // 5. VIEW BOOKING DETAILS & TIMELINE MODAL (4-BADGE STATUS SUMMARY)
    // =========================================================================

    async function openViewBookingModal(bookingId) {
        try {
            const [bookingRes, statsRes] = await Promise.all([
                fetch(`/api/bookings/${bookingId}`),
                fetch('/api/payments/stats')
            ]);

            const bookingResult = await bookingRes.json();
            const statsResult = await statsRes.json();

            if (bookingResult.success) {
                const b = bookingResult.data;
                const f = b.financial || {};
                const stats = (statsResult.success && statsResult.data) ? statsResult.data : {};
                const body = document.getElementById('view-booking-modal-body');

                // Collection Stats (all >= 0)
                const cashColl = Math.max(0, stats.cashCollection || 0);
                const upiColl = Math.max(0, stats.upiCollection || 0);
                const cardColl = Math.max(0, stats.cardCollection || 0);
                const otherColl = Math.max(0, stats.otherCollection || 0);

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

                    <!-- 3 TABS NAVIGATION -->
                    <ul class="nav nav-tabs nav-tabs-custom mb-3" id="bookingTab" role="tablist">
                        <li class="nav-item" role="presentation">
                            <button class="nav-link active fw-semibold" id="contract-tab" data-bs-toggle="tab" data-bs-target="#tab-contract" type="button">
                                <i class="bi bi-file-earmark-text me-2"></i>Event & Contract Details
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
                    </ul>

                    <div class="tab-content" id="bookingTabContent">
                        <!-- TAB 1: EVENT & CONTRACT DETAILS -->
                        <div class="tab-pane fade show active p-1" id="tab-contract">
                            <div class="row g-3 mb-3">
                                <div class="col-12 col-md-6">
                                    <div class="p-3 bg-white border rounded-3 h-100 shadow-sm">
                                        <h6 class="fw-bold text-primary mb-2"><i class="bi bi-person-badge me-2"></i>Customer & Event Information</h6>
                                        <div class="mb-1.5"><strong>Booking ID:</strong> <span class="text-primary fw-bold">${b.id}</span></div>
                                        <div class="mb-1.5"><strong>Customer Name:</strong> ${escapeHtml(b.customerName)}</div>
                                        <div class="mb-1.5"><strong>Mobile Number:</strong> ${escapeHtml(b.mobileNumber)}</div>
                                        <div class="mb-1.5"><strong>Event Name / Purpose:</strong> ${escapeHtml(b.eventName)}</div>
                                        <div class="mb-1.5"><strong>Hall Allocated:</strong> <span class="hall-pill ${b.hall === 'Hall 1' ? 'hall-1' : 'hall-2'}">${b.hall}</span></div>
                                        <div class="mb-1.5"><strong>Booking Date & Slot:</strong> ${b.bookingDate} (${b.startTime} - ${b.endTime})</div>
                                        <div class="mt-2 text-muted small"><strong>Notes:</strong> ${escapeHtml(b.notes || 'None')}</div>
                                    </div>
                                </div>
                                <div class="col-12 col-md-6">
                                    <div class="p-3 bg-white border rounded-3 h-100 shadow-sm">
                                        <h6 class="fw-bold text-success mb-2"><i class="bi bi-calculator me-2"></i>Financial Contract Summary</h6>
                                        <div class="d-flex justify-content-between py-1 border-bottom"><span>Base Hall Rent:</span> <strong>₹${(f.hallRent || 0).toLocaleString()}</strong></div>
                                        ${f.baseDiscount > 0 ? `
                                            <div class="d-flex justify-content-between py-1 border-bottom text-success"><span>Initial Base Discount:</span> <strong>-₹${f.baseDiscount.toLocaleString()}</strong></div>
                                        ` : ''}
                                        ${(f.discountsList || []).map(d => `
                                            <div class="d-flex justify-content-between py-1 border-bottom text-success"><span>Approved Discount (${escapeHtml(d.reason)}):</span> <strong>-₹${d.amount.toLocaleString()}</strong></div>
                                        `).join('')}
                                        ${(f.extraChargesList || []).map(c => `
                                            <div class="d-flex justify-content-between py-1 border-bottom text-primary"><span>Extra Charge (${escapeHtml(c.category)}):</span> <strong>+₹${c.amount.toLocaleString()}</strong></div>
                                        `).join('')}
                                        <div class="d-flex justify-content-between py-1 border-bottom fw-bold text-dark fs-6"><span>Net Hall Rent:</span> <strong>₹${(f.netRent || 0).toLocaleString()}</strong></div>
                                        ${f.showDepositInContract ? `
                                            <div class="d-flex justify-content-between py-1 border-bottom text-purple"><span>Security Deposit Held:</span> <strong>₹${(f.effectiveDepositHeld || 0).toLocaleString()}</strong></div>
                                        ` : ''}
                                        <div class="d-flex justify-content-between py-2 fw-bold text-primary fs-6"><span>Total Contract Amount:</span> <strong>₹${(f.totalContractAmount || 0).toLocaleString()}</strong></div>
                                    </div>
                                </div>
                            </div>

                            <div class="p-3 bg-white border rounded-3 shadow-sm">
                                <h6 class="fw-bold mb-2"><i class="bi bi-cash-stack me-2 text-success"></i>Current Account Balance Summary</h6>
                                <div class="row text-center g-2 small">
                                    <div class="col-6 col-md-3">
                                        <div class="p-2 bg-light rounded border">
                                            <div class="text-muted">Net Rent Money Paid</div>
                                            <div class="fw-bold text-success fs-6">₹${(f.netRentPaid || 0).toLocaleString()}</div>
                                        </div>
                                    </div>
                                    <div class="col-6 col-md-3">
                                        <div class="p-2 bg-light rounded border">
                                            <div class="text-muted">Remaining Rent Due</div>
                                            <div class="fw-bold ${f.overpaidAmount > 0 ? 'text-warning' : ((f.remainingRent || 0) > 0 ? 'text-danger' : 'text-success')} fs-6">
                                                ${f.overpaidAmount > 0 ? `Overpaid ₹${f.overpaidAmount.toLocaleString()}` : `₹${(f.remainingRent || 0).toLocaleString()}`}
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-6 col-md-3">
                                        <div class="p-2 bg-light rounded border">
                                            <div class="text-muted">Security Deposit Paid</div>
                                            <div class="fw-bold style-purple fs-6" style="color:#7c3aed;">₹${(f.depositPaid || 0).toLocaleString()}</div>
                                        </div>
                                    </div>
                                    <div class="col-6 col-md-3">
                                        <div class="p-2 bg-light rounded border">
                                            <div class="text-muted">Effective Deposit Held</div>
                                            <div class="fw-bold text-primary fs-6">₹${(f.effectiveDepositHeld || 0).toLocaleString()}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- TAB 2: FINANCIAL LEDGER -->
                        <div class="tab-pane fade p-1" id="tab-ledger">
                            <!-- COMPACT SUMMARY BANNER -->
                            <div class="compact-summary-banner mb-3">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <span class="fw-bold text-dark small"><i class="bi bi-graph-up-arrow me-1 text-primary"></i>Collection Stats & Overall Metrics Summary</span>
                                    <span class="badge bg-light text-muted border">System Collections (All ≥ ₹0)</span>
                                </div>
                                <div class="row g-2 text-center">
                                    <div class="col-6 col-sm-3">
                                        <div class="compact-stat-box">
                                            <span class="text-muted d-block small">Cash Collection</span>
                                            <strong class="text-success fs-6">₹${cashColl.toLocaleString()}</strong>
                                        </div>
                                    </div>
                                    <div class="col-6 col-sm-3">
                                        <div class="compact-stat-box">
                                            <span class="text-muted d-block small">UPI Collection</span>
                                            <strong class="fs-6" style="color:#7c3aed;">₹${upiColl.toLocaleString()}</strong>
                                        </div>
                                    </div>
                                    <div class="col-6 col-sm-3">
                                        <div class="compact-stat-box">
                                            <span class="text-muted d-block small">Card Collection</span>
                                            <strong class="text-primary fs-6">₹${cardColl.toLocaleString()}</strong>
                                        </div>
                                    </div>
                                    <div class="col-6 col-sm-3">
                                        <div class="compact-stat-box">
                                            <span class="text-muted d-block small">Other Methods</span>
                                            <strong class="text-amber fs-6" style="color:#d97706;">₹${otherColl.toLocaleString()}</strong>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- SEARCH & FINANCIAL ACTIONS TOOLBAR -->
                            <div class="p-3 bg-light border rounded-3 mb-3">
                                <div class="row g-2 align-items-center">
                                    <div class="col-12 col-md-5">
                                        <div class="input-group input-group-sm">
                                            <span class="input-group-text bg-white border-end-0"><i class="bi bi-search text-muted"></i></span>
                                            <input type="text" class="form-control border-start-0" id="modal-ledger-search-input" placeholder="Search by Booking ID, Customer Name, Receipt No...">
                                        </div>
                                    </div>
                                    <div class="col-12 col-md-7 text-md-end">
                                        <div class="d-flex flex-wrap gap-2 justify-content-md-end">
                                            <button class="btn btn-sm btn-outline-dark btn-print-full-receipt" data-id="${b.id}">
                                                <i class="bi bi-printer me-1"></i>Print Full Receipt
                                            </button>
                                            ${f.canProcessFinancials ? `
                                                ${(f.remainingRent || 0) > 0 ? `<button class="btn btn-sm btn-success btn-modal-collect-pay" data-id="${b.id}"><i class="bi bi-cash-stack me-1"></i>Collect Payment</button>` : ''}
                                                <button class="btn btn-sm btn-primary btn-modal-manage-dep" data-id="${b.id}">
                                                    <i class="bi bi-shield-check me-1"></i>${(f.effectiveDepositHeld || 0) > 0 ? `Manage Deposit (₹${f.effectiveDepositHeld.toLocaleString()} Held)` : 'Collect / Manage Deposit'}
                                                </button>
                                                <button class="btn btn-sm btn-outline-primary btn-modal-add-charge" data-id="${b.id}">
                                                    <i class="bi bi-plus-circle me-1"></i>Extra Charge
                                                </button>
                                                <button class="btn btn-sm btn-outline-success btn-modal-approve-discount" data-id="${b.id}">
                                                    <i class="bi bi-percent me-1"></i>Approve Discount
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
                                        })),
                                        ...(f.discountsList || []).map(d => ({
                                            id: d.id,
                                            date: `${d.date}`,
                                            type: 'Discount Approved',
                                            details: `Reason: ${escapeHtml(d.reason)} (Approved By: ${escapeHtml(d.approvedBy || 'Admin')})`,
                                            amount: d.amount,
                                            isNegative: true,
                                            isVoided: false,
                                            rawDiscount: d
                                        })),
                                        ...(f.extraChargesList || []).map(c => ({
                                            id: c.id,
                                            date: `${c.date}`,
                                            type: `Extra Charge (${escapeHtml(c.category)})`,
                                            details: `Remarks: ${escapeHtml(c.remarks || 'No remarks')} (Added By: ${escapeHtml(c.addedBy || 'Admin')})`,
                                            amount: c.amount,
                                            isNegative: false,
                                            isVoided: false,
                                            rawCharge: c
                                        }))
                                    ];

                                    if (ledgerItems.length === 0) {
                                        return `<div class="text-muted small py-3 text-center"><i class="bi bi-journal-x me-1"></i>No payment, charge, or discount records in ledger yet.</div>`;
                                    }

                                    return `
                                        <div class="table-responsive">
                                            <table class="table table-sm table-hover table-bordered align-middle mb-0" id="modal-ledger-table">
                                                <thead class="table-light">
                                                    <tr>
                                                        <th>Ref / Receipt No</th>
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
                                                            <td class="fw-semibold text-primary">${item.id}</td>
                                                            <td><span class="badge ${item.type.includes('Discount') ? 'bg-success-subtle text-success border border-success-subtle' : (item.type.includes('Extra Charge') ? 'bg-primary-subtle text-primary border border-primary-subtle' : 'bg-light text-dark border')}">${item.type}</span></td>
                                                            <td class="small text-muted">${item.details}</td>
                                                            <td class="text-end fw-bold ${item.isVoided ? 'text-decoration-line-through text-muted' : (item.isNegative ? 'text-danger' : 'text-dark')}">${item.isNegative ? '-' : '+'}₹${item.amount.toLocaleString()}</td>
                                                            <td>${item.isVoided ? '<span class="badge bg-danger-subtle text-danger border border-danger-subtle">VOIDED</span>' : '<span class="badge bg-success-subtle text-success border border-success-subtle">Active</span>'}</td>
                                                            <td class="text-end pe-3">
                                                                ${item.rawTxn && !item.isVoided ? `
                                                                    <button class="btn btn-sm btn-outline-dark py-0 px-2 btn-print-rcpt me-1" data-id="${b.id}" data-rcpt="${item.rawTxn.receiptNumber}" title="Print Receipt">
                                                                        <i class="bi bi-printer"></i>
                                                                    </button>
                                                                ` : ''}
                                                                ${item.rawTxn && !item.isVoided && currentRole === 'Admin' ? `
                                                                    <button class="btn btn-sm btn-outline-danger py-0 px-2 btn-modal-void-rcpt" data-rcpt="${item.rawTxn.receiptNumber}">
                                                                        <i class="bi bi-slash-circle me-1"></i>Void
                                                                    </button>
                                                                ` : (item.rawCharge && currentRole === 'Admin' ? `
                                                                    <button class="btn btn-sm btn-outline-danger py-0 px-2 btn-revert-charge" data-id="${b.id}" data-charge-id="${item.rawCharge.id}">
                                                                        <i class="bi bi-arrow-counterclockwise me-1"></i>Revert
                                                                    </button>
                                                                ` : (item.rawDiscount && currentRole === 'Admin' ? `
                                                                    <button class="btn btn-sm btn-outline-danger py-0 px-2 btn-revert-discount" data-id="${b.id}" data-discount-id="${item.rawDiscount.id}">
                                                                        <i class="bi bi-arrow-counterclockwise me-1"></i>Revert
                                                                    </button>
                                                                ` : '-'))}
                                                            </td>
                                                        </tr>
                                                    `).join('')}
                                                </tbody>
                                            </table>
                                        </div>
                                    `;
                                })()}
                            </div>

                            <!-- DISCOUNTS & EXTRA CHARGES ITEMIZATION -->
                            <div class="row g-3 mb-3">
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

                            <!-- EMBEDDED AUDIT HISTORY WITH GIT-STYLE DIFFS -->
                            <div class="card border p-3 rounded-3 bg-white shadow-sm">
                                <h6 class="fw-bold text-dark mb-2"><i class="bi bi-shield-check me-2 text-primary"></i>System Audit Trail & Git-Style Diffs</h6>
                                ${(b.auditLogs || []).length === 0 ? `
                                    <div class="text-muted small py-2 text-center">No audit log records for this booking.</div>
                                ` : `
                                    <div class="table-responsive">
                                        <table class="table table-hover table-sm align-middle mb-0">
                                            <thead class="table-light">
                                                <tr>
                                                    <th>Audit ID</th>
                                                    <th>Module</th>
                                                    <th>Action Performed</th>
                                                    <th>Value Change Details</th>
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

                                                    return `
                                                        <tr class="audit-row" data-search-text="${(a.id + ' ' + a.module + ' ' + a.action + ' ' + a.user + ' ' + b.id + ' ' + b.customerName).toLowerCase()}">
                                                            <td class="fw-bold text-dark">${a.id}</td>
                                                            <td>${modBadge}</td>
                                                            <td class="fw-semibold text-dark">${escapeHtml(a.action)}</td>
                                                            <td>${renderDiffCell(a)}</td>
                                                            <td class="small text-muted">${a.date} ${a.time}</td>
                                                            <td><span class="badge bg-light text-dark border"><i class="bi bi-person me-1"></i>${escapeHtml(a.user)}</span></td>
                                                        </tr>
                                                    `;
                                                }).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                `}
                            </div>
                        </div>

                        <!-- TAB 3: ACTIVITY TIMELINE -->
                        <div class="tab-pane fade p-1" id="tab-timeline">
                            <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                                <span class="fw-bold text-dark"><i class="bi bi-clock-history me-2 text-primary"></i>Activity & Lifecycle Timeline</span>
                                <div class="d-flex gap-2">
                                    <button class="btn btn-sm btn-outline-primary btn-modal-add-charge" data-id="${b.id}">
                                        <i class="bi bi-plus-circle me-1"></i>Add Extra Charge
                                    </button>
                                    <button class="btn btn-sm btn-outline-success btn-modal-approve-discount" data-id="${b.id}">
                                        <i class="bi bi-percent me-1"></i>Approve Discount
                                    </button>
                                </div>
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
                    </div>
                `;

                // Search Filter Listener in Ledger Tab
                const ledgerSearchInput = body.querySelector('#modal-ledger-search-input');
                if (ledgerSearchInput) {
                    ledgerSearchInput.addEventListener('input', (e) => {
                        const term = (e.target.value || '').toLowerCase().trim();
                        body.querySelectorAll('.ledger-row, .audit-row').forEach(row => {
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
                        printReceipt(bookingId, btn.getAttribute('data-rcpt'));
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

    document.getElementById('pay-select-booking').addEventListener('change', async (e) => {
        const bookingId = e.target.value;
        const container = document.getElementById('pay-selected-booking-card');
        if (!bookingId) {
            container.classList.add('d-none');
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
    document.getElementById('pay-modal-booking-select').addEventListener('change', (e) => {
        const selectedId = e.target.value;
        loadPaymentModalSummary(selectedId);
        const searchSelect = document.getElementById('pay-select-booking');
        if (searchSelect && selectedId) {
            searchSelect.value = selectedId;
            searchSelect.dispatchEvent(new Event('change'));
        }
    });

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
                const submitBtn = document.getElementById('depositForm').querySelector('button[type="submit"]');

                // Only Archived bookings fully block financial actions
                if (!f.canProcessFinancials) {
                    if (settledAlert) {
                        settledAlert.classList.remove('d-none');
                        settledAlert.innerHTML = `<i class="bi bi-archive me-2"></i><strong>Archived Booking:</strong> Financial actions are locked for archived bookings.`;
                    }
                    document.getElementById('dep-input-amount').disabled = true;
                    actionSelect.disabled = true;
                    document.getElementById('dep-input-remarks').disabled = true;
                    if (submitBtn) submitBtn.disabled = true;
                    depositActionModal.show();
                    return;
                }

                // Clear any old alert
                if (settledAlert) settledAlert.classList.add('d-none');
                document.getElementById('dep-input-amount').disabled = false;
                actionSelect.disabled = false;
                document.getElementById('dep-input-remarks').disabled = false;
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
                Array.from(actionSelect.options).forEach(opt => {
                    if (opt.value === 'adjust' || opt.value === 'return' || opt.value === 'forfeit') {
                        opt.disabled = (f.effectiveDepositHeld <= 0);
                    } else if (opt.value === 'receive') {
                        opt.disabled = false; // Always allow receiving deposit even after completion
                    }
                });

                if (f.effectiveDepositHeld > 0) {
                    actionSelect.value = f.remainingRent > 0 ? 'adjust' : 'return';
                    document.getElementById('dep-input-amount').value = f.remainingRent > 0 ? Math.min(f.effectiveDepositHeld, f.remainingRent) : f.effectiveDepositHeld;
                } else {
                    actionSelect.value = 'receive';
                    document.getElementById('dep-input-amount').value = f.remainingDepositDue > 0 ? f.remainingDepositDue : (f.securityDeposit > 0 ? f.securityDeposit : '');
                }
                actionSelect.dispatchEvent(new Event('change'));

                depositActionModal.show();
            }
        } catch (err) {
            console.error("Error opening deposit modal:", err);
        }
    }

    // Event listener for action change inside deposit modal
    document.getElementById('dep-input-action').addEventListener('change', async (e) => {
        const action = e.target.value;
        const bId = document.getElementById('dep-input-bookingId').value;
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

    // Open Void Receipt Modal
    function openVoidModal(receiptNumber) {
        document.getElementById('void-input-rcpt').value = receiptNumber;
        document.getElementById('void-display-rcpt').value = receiptNumber;
        document.getElementById('void-input-reason').value = '';
        voidModal.show();
    }

    // Open Printable Receipt Modal (HBR Format)
    async function openReceiptModal(receiptNumber) {
        try {
            const res = await fetch(`/api/payments/receipt/${receiptNumber}`);
            const result = await res.json();
            if (result.success) {
                const { receipt, summary } = result.data;
                const area = document.getElementById('receipt-printable-area');

                const voidWatermarkHTML = receipt.isVoided ? `
                    <div class="receipt-void-watermark">VOIDED RECEIPT</div>
                ` : '';

                area.innerHTML = `
                    <div class="position-relative">
                        ${voidWatermarkHTML}

                        <div class="receipt-header text-center border-bottom pb-3 mb-3">
                            <h4 class="fw-bold text-primary mb-1"><i class="bi bi-building-gear me-2"></i>HALL BOOKING MANAGEMENT SYSTEM</h4>
                            <div class="small text-muted">Official Payment Receipt / Transaction Voucher</div>
                            <div class="badge bg-dark text-white px-3 py-1 mt-2 fs-6">${receipt.receiptNumber}</div>
                        </div>

                        <div class="row mb-3 small">
                            <div class="col-6">
                                <div><strong>Booking ID:</strong> ${summary.bookingId}</div>
                                <div><strong>Customer Name:</strong> ${escapeHtml(summary.customerName)}</div>
                                <div><strong>Mobile Number:</strong> ${escapeHtml(summary.mobileNumber)}</div>
                                <div><strong>Event Purpose:</strong> ${escapeHtml(summary.eventName)}</div>
                            </div>
                            <div class="col-6 text-end">
                                <div><strong>Receipt Date:</strong> ${receipt.date} ${receipt.time}</div>
                                <div><strong>Transaction ID:</strong> ${receipt.id}</div>
                                <div><strong>Hall Allocated:</strong> ${summary.hall}</div>
                                <div><strong>Event Date:</strong> ${summary.bookingDate}</div>
                            </div>
                        </div>

                        <div class="table-responsive mb-3">
                            <table class="table table-bordered table-sm mb-0 align-middle">
                                <thead class="bg-light">
                                    <tr>
                                        <th>Category</th>
                                        <th>Method & Reference</th>
                                        <th>Collector</th>
                                        <th class="text-end">Amount Paid</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>
                                            <div class="fw-bold">${receipt.type}</div>
                                            <div class="small text-muted">${escapeHtml(receipt.remarks || 'Standard Transaction')}</div>
                                        </td>
                                        <td>
                                            <div><strong>${receipt.paymentMethod}</strong></div>
                                            <div class="small text-muted">Ref: ${escapeHtml(receipt.referenceNumber)}</div>
                                        </td>
                                        <td><span class="small">${escapeHtml(receipt.collectedBy)}</span></td>
                                        <td class="text-end fw-bold fs-5 ${receipt.isVoided ? 'text-decoration-line-through text-muted' : 'text-success'}">₹${receipt.amount.toLocaleString()}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        ${receipt.isVoided ? `
                            <div class="alert alert-danger p-2 small mb-3">
                                <strong>Void Information:</strong> This receipt was voided on ${receipt.voidedAt} by ${receipt.voidedBy}. Reason: ${escapeHtml(receipt.voidReason)}
                            </div>
                        ` : ''}

                        <div class="p-3 bg-light rounded-3 mb-4 small">
                            <div class="row">
                                <div class="col-6">
                                    <div>Net Hall Rent: <strong>₹${summary.netRent.toLocaleString()}</strong></div>
                                    <div>Total Rent Paid: <strong class="text-success">₹${summary.netRentPaid.toLocaleString()} (${summary.paymentPercentage}%)</strong></div>
                                </div>
                                <div class="col-6 text-end">
                                    <div>Remaining Rent Due: <strong class="text-danger">₹${summary.remainingRent.toLocaleString()}</strong></div>
                                    <div>Deposit Held: <strong>₹${summary.effectiveDepositHeld.toLocaleString()} (${summary.depositStatus})</strong></div>
                                </div>
                            </div>
                        </div>

                        <div class="row pt-4 mt-4 border-top text-center small">
                            <div class="col-6">
                                <div class="text-muted mb-4">Collected By</div>
                                <div class="fw-bold border-top d-inline-block pt-1 px-4">${escapeHtml(receipt.collectedBy || 'Authorized Staff')}</div>
                            </div>
                            <div class="col-6">
                                <div class="text-muted mb-4">Authorized Signature</div>
                                <div class="fw-bold border-top d-inline-block pt-1 px-4">Management Office Stamp</div>
                            </div>
                        </div>
                    </div>
                `;

                receiptModal.show();
            }
        } catch (err) {
            console.error("Error loading receipt:", err);
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
                document.getElementById('input-securityDeposit').value = contract.securityDeposit !== undefined ? contract.securityDeposit : 2000;
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
    ['filter-search', 'filter-date', 'filter-hall', 'filter-status', 'filter-booking-dues'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                syncCurrentFilters();
                loadBookingsList();
            });
            el.addEventListener('change', () => {
                syncCurrentFilters();
                loadBookingsList();
            });
        }
    });

    const resetBtn = document.getElementById('btn-reset-filters');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (document.getElementById('filter-search')) document.getElementById('filter-search').value = '';
            if (document.getElementById('filter-date')) document.getElementById('filter-date').value = '';
            if (document.getElementById('filter-hall')) document.getElementById('filter-hall').value = 'All';
            if (document.getElementById('filter-status')) document.getElementById('filter-status').value = 'All';
            if (document.getElementById('filter-booking-dues')) document.getElementById('filter-booking-dues').value = 'All';
            syncCurrentFilters();
            loadBookingsList();
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

    document.getElementById('btn-reset-pay-filters').addEventListener('click', () => {
        document.getElementById('filter-pay-search').value = '';
        if (document.getElementById('filter-pay-dues')) document.getElementById('filter-pay-dues').value = 'All';
        document.getElementById('filter-pay-method').value = 'All';
        document.getElementById('filter-pay-type').value = 'All';
        document.getElementById('filter-pay-status').value = 'Success';
        loadPaymentsView();
    });

    const openPayBtnHeader = document.getElementById('btn-open-payment-modal');
    if (openPayBtnHeader) {
        openPayBtnHeader.addEventListener('click', () => {
            const selectedBookingId = document.getElementById('pay-select-booking').value;
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

    document.getElementById('avail-date-picker').addEventListener('change', () => {
        if (currentView === 'availability') loadHallAvailability();
    });



    // HELPER FUNCTIONS
    function showToast(msg) {
        document.getElementById('toast-message').textContent = msg;
        liveToast.show();
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    // Initialize Initial View
    switchView('dashboard');
});
