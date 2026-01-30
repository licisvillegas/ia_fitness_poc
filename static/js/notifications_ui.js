/**
 * notifications_ui.js
 * Handles polling and UI rendering for in-app notifications.
 */

(function () {
    const NOTIFICATION_POLL_INTERVAL = 60000; // 60 seconds
    let unreadCount = 0;

    // Selectors match the injected HTML in sidebar.html
    const badgeEl = document.getElementById('notifications-badge');
    const profileBadgeEl = document.getElementById('profile-notification-badge');
    const userIconContainer = document.querySelector('.user-icon-container');
    const dropdownEl = document.getElementById('notifications-dropdown');
    const listEl = document.getElementById('notifications-list');
    const parentContainer = document.getElementById('notifications-menu-item'); // Li container
    const markAllBtn = document.getElementById('notifications-mark-all');

    if (!parentContainer) return; // Exit if sidebar item doesn't exist

    /**
     * Poll for pending notifications
     */
    async function checkNotifications() {
        try {
            const res = await fetch('/api/notifications/pending');
            if (!res.ok) return; // Silent fail
            const data = await res.json();

            unreadCount = data.count || 0;
            updateBadge();

            // If dropdown is open, re-render list? Or just update count?
            // Usually re-rendering live is nice but might be disruptive.
            // For now, update badge. If dropdown open, maybe simpler to let user refresh by reopen.
            // But if we want live updates in list:
            if (dropdownEl && dropdownEl.classList.contains('show')) {
                renderList(data.notifications || []);
            }
        } catch (e) {
            console.warn('Notifications poll failed', e);
        }
    }

    function updateBadge() {
        const userCollapse = document.getElementById('user-collapse');
        const isMenuOpen = userCollapse && userCollapse.classList.contains('show');

        // Logic: 
        // If unread > 0:
        //   If Menu Closed -> Show Profile Badge (red dot/number) on photo.
        //   If Menu Open   -> Show Normal Badge on list item.

        if (unreadCount > 0) {
            if (!isMenuOpen) {
                // Menu Closed: Highlight Profile Photo
                if (badgeEl) badgeEl.classList.add('d-none'); // Hide normal

                if (profileBadgeEl) {
                    profileBadgeEl.textContent = unreadCount > 99 ? '99+' : unreadCount;
                    profileBadgeEl.classList.remove('d-none');
                }
                if (userIconContainer) userIconContainer.classList.add('has-notifications');

            } else {
                // Menu Open: Highlight List Item
                if (profileBadgeEl) profileBadgeEl.classList.add('d-none');
                if (userIconContainer) userIconContainer.classList.remove('has-notifications');

                if (badgeEl) {
                    badgeEl.textContent = unreadCount > 99 ? '99+' : unreadCount;
                    badgeEl.classList.remove('d-none');
                }
            }
        } else {
            // No notifications: Hide all
            if (badgeEl) badgeEl.classList.add('d-none');
            if (profileBadgeEl) profileBadgeEl.classList.add('d-none');
            if (userIconContainer) userIconContainer.classList.remove('has-notifications');
        }
    }

    // Listen for User Menu Toggle to update badge position instantly
    const userCollapse = document.getElementById('user-collapse');
    if (userCollapse) {
        userCollapse.addEventListener('shown.bs.collapse', updateBadge);
        userCollapse.addEventListener('hidden.bs.collapse', updateBadge);
        // Also listen to start events for responsiveness
        userCollapse.addEventListener('show.bs.collapse', () => setTimeout(updateBadge, 10));
        userCollapse.addEventListener('hide.bs.collapse', () => setTimeout(updateBadge, 10));
    }

    // Keep listener on sidebar toggle just in case
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            setTimeout(updateBadge, 50);
        });
    }

    function renderList(notifications) {
        if (!listEl) return;
        listEl.innerHTML = '';

        if (notifications.length === 0) {
            listEl.innerHTML = '<div class="notifications-empty">No tienes notificaciones nuevas.</div>';
            return;
        }

        notifications.forEach(n => {
            const item = document.createElement('div');
            const typeClass = n.type ? `type-${n.type}` : 'type-info';
            item.className = `notification-item ${unreadCount > 0 ? 'unread' : ''} ${typeClass}`;
            // Actually, API /pending returns unread. So all are unread.

            const timeStr = new Date(n.created_at).toLocaleString('es-ES', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            // Icon Selection
            let iconClass = 'fa-info-circle';
            if (n.type === 'success') iconClass = 'fa-check-circle';
            else if (n.type === 'warning') iconClass = 'fa-exclamation-triangle';
            else if (n.type === 'error') iconClass = 'fa-times-circle';

            item.innerHTML = `
                <div class="notification-icon">
                    <i class="fas ${iconClass}"></i>
                </div>
                <div class="notification-content">
                    <div class="notification-title">${n.title}</div>
                    <div class="notification-message">${n.message}</div>
                    <small class="notification-time">${timeStr}</small>
                </div>
            `;

            item.onclick = (e) => {
                e.stopPropagation();
                handleNotificationClick(n);
            };

            listEl.appendChild(item);
        });
    }

    async function handleNotificationClick(notification) {
        // 1. Mark as read
        try {
            await fetch('/api/notifications/mark-read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notification_id: notification.id })
            });

            // 2. Navigate if link
            if (notification.link) {
                window.location.href = notification.link;
            } else {
                // If no link, just fetch updated list and remove item visually
                checkNotifications();
            }
        } catch (e) {
            console.error('Error handling notification click', e);
        }
    }

    async function markAllRead() {
        try {
            await fetch('/api/notifications/mark-read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ all: true })
            });
            checkNotifications(); // Refresh (should be 0)
        } catch (e) {
            console.error('Error marking all read', e);
        }
    }

    // Toggle Logic
    const toggleLink = parentContainer.querySelector('a');
    if (toggleLink) {
        toggleLink.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const isShown = dropdownEl.classList.contains('show');
            if (isShown) {
                dropdownEl.classList.remove('show');
            } else {
                // Fetch latest before showing
                const res = await fetch('/api/notifications/pending');
                if (res.ok) {
                    const data = await res.json();
                    unreadCount = data.count;
                    updateBadge();
                    renderList(data.notifications);
                }

                // --- Dynamic Positioning Logic ---
                const rect = toggleLink.getBoundingClientRect();
                const dropdownWidth = 300; // Match CSS width in notifications.css

                // Position to the right of the button by default (Expanded Sidebar)
                let left = rect.right + 10;
                let top = rect.top;

                // Adjust vertical if it overflows bottom
                // (Optional refinement: if (top + height > window.innerHeight) ...)

                // Check horizontal overflow (Mobile or small screens)
                if (left + dropdownWidth > window.innerWidth) {
                    // Try to left align (e.g. for right sidebar or mobile overlap)
                    // Or center?
                    // Safe fallback: minimal right margin
                    left = window.innerWidth - dropdownWidth - 10;
                }

                // Apply styles
                dropdownEl.style.top = `${top}px`;
                dropdownEl.style.left = `${left}px`;

                dropdownEl.classList.add('show');
            }
        });

        // Close on Resize/Scroll to prevent floating detachment
        window.addEventListener('resize', () => {
            if (dropdownEl.classList.contains('show')) dropdownEl.classList.remove('show');
        });
        window.addEventListener('scroll', () => {
            // Optional: Close on scroll, or update position? Closing is safer/easier.
            if (dropdownEl.classList.contains('show')) dropdownEl.classList.remove('show');
        }, true); // Capture phase to catch scrolling of any container
    }

    // Mark All Handler
    if (markAllBtn) {
        markAllBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            markAllRead();
        });
    }

    // Close on click outside
    document.addEventListener('click', (e) => {
        if (dropdownEl && dropdownEl.classList.contains('show')) {
            if (!dropdownEl.contains(e.target) && !parentContainer.contains(e.target)) {
                dropdownEl.classList.remove('show');
            }
        }
    });

    // Initial Poll
    checkNotifications();
    // Start Interval
    setInterval(checkNotifications, NOTIFICATION_POLL_INTERVAL);

})();
