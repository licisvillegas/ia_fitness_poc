/**
 * notifications_ui.js
 * Maneja el sondeo y el renderizado de la interfaz de usuario para las notificaciones en la aplicación.
 */

(function () {
    const NOTIFICATION_POLL_INTERVAL = 60000; // 60 segundos
    let unreadCount = 0;

    // Los selectores coinciden con el HTML inyectado en sidebar.html
    const badgeEl = document.getElementById('notifications-badge');
    const profileBadgeEl = document.getElementById('profile-notification-badge');
    const userIconContainer = document.querySelector('.user-icon-container');
    const dropdownEl = document.getElementById('notifications-dropdown');
    const listEl = document.getElementById('notifications-list');
    const parentContainer = document.getElementById('notifications-menu-item'); // Li container
    const markAllBtn = document.getElementById('notifications-mark-all');

    if (!parentContainer) return; // Salir si el elemento de la barra lateral no existe

    /**
     * Sondear notificaciones pendientes
     */
    async function checkNotifications() {
        try {
            const res = await fetch('/api/notifications/pending');
            if (!res.ok) return; // Fallo silencioso
            const data = await res.json();

            unreadCount = data.count || 0;
            updateBadge();

            // Si el desplegable está abierto, ¿volver a renderizar la lista? ¿O simplemente actualizar el contador?
            // Generalmente renderizar en vivo es agradable pero puede ser disruptivo.
            // Por ahora, actualizar la insignia. Si el desplegable está abierto, tal vez sea más simple dejar que el usuario actualice al volver a abrir.
            // Pero si queremos actualizaciones en vivo en la lista:
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

        // Lógica: 
        // Si no leídos > 0:
        //   Si Menú Cerrado -> Mostrar Insignia de Perfil (punto rojo/número) en la foto.
        //   Si Menú Abierto   -> Mostrar Insignia Normal en el elemento de la lista.

        if (unreadCount > 0) {
            if (!isMenuOpen) {
                // Menú Cerrado: Resaltar Foto de Perfil
                if (badgeEl) badgeEl.classList.add('d-none'); // Ocultar normal

                if (profileBadgeEl) {
                    profileBadgeEl.textContent = unreadCount > 99 ? '99+' : unreadCount;
                    profileBadgeEl.classList.remove('d-none');
                }
                if (userIconContainer) userIconContainer.classList.add('has-notifications');

            } else {
                // Menú Abierto: Resaltar Elemento de la Lista
                if (profileBadgeEl) profileBadgeEl.classList.add('d-none');
                if (userIconContainer) userIconContainer.classList.remove('has-notifications');

                if (badgeEl) {
                    badgeEl.textContent = unreadCount > 99 ? '99+' : unreadCount;
                    badgeEl.classList.remove('d-none');
                }
            }
        } else {
            // Sin notificaciones: Ocultar todo
            if (badgeEl) badgeEl.classList.add('d-none');
            if (profileBadgeEl) profileBadgeEl.classList.add('d-none');
            if (userIconContainer) userIconContainer.classList.remove('has-notifications');
        }
    }

    // Escuchar el cambio del menú de usuario para actualizar la insignia instantáneamente
    const userCollapse = document.getElementById('user-collapse');
    if (userCollapse) {
        userCollapse.addEventListener('shown.bs.collapse', updateBadge);
        userCollapse.addEventListener('hidden.bs.collapse', updateBadge);
        // También escuchar eventos de inicio para capacidad de respuesta
        userCollapse.addEventListener('show.bs.collapse', () => setTimeout(updateBadge, 10));
        userCollapse.addEventListener('hide.bs.collapse', () => setTimeout(updateBadge, 10));
    }

    // Mantener el listener en el toggle de la sidebar por si acaso
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
            // De hecho, la API /pending devuelve no leídos. Así que todos son no leídos.

            const timeStr = new Date(n.created_at).toLocaleString('es-ES', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            // Selección de Icono
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
        // 1. Marcar como leído
        try {
            await fetch('/api/notifications/mark-read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notification_id: notification.id })
            });

            // 2. Navegar si hay enlace
            if (notification.link) {
                window.location.href = notification.link;
            } else {
                // Si no hay enlace, solo obtener la lista actualizada y eliminar el elemento visualmente
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
            checkNotifications(); // Refrescar (debería ser 0)
        } catch (e) {
            console.error('Error marking all read', e);
        }
    }

    // Lógica de Alternancia
    const toggleLink = parentContainer.querySelector('a');
    if (toggleLink) {
        toggleLink.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const isShown = dropdownEl.classList.contains('show');
            if (isShown) {
                dropdownEl.classList.remove('show');
            } else {
                // Obtener lo último antes de mostrar
                const res = await fetch('/api/notifications/pending');
                if (res.ok) {
                    const data = await res.json();
                    unreadCount = data.count;
                    updateBadge();
                    renderList(data.notifications);
                }

                // --- Lógica de Posicionamiento Dinámico ---
                const rect = toggleLink.getBoundingClientRect();
                const dropdownWidth = 300; // Coincidir con el ancho de CSS en notifications.css

                // Posicionar a la derecha del botón por defecto (Barra lateral expandida)
                let left = rect.right + 10;
                let top = rect.top;

                // Ajustar vertical si se desborda por abajo
                // (Refinamiento opcional: if (top + height > window.innerHeight) ...)

                // Verificar desbordamiento horizontal (Móvil o pantallas pequeñas)
                if (left + dropdownWidth > window.innerWidth) {
                    // Intentar alinear a la izquierda (ej. para barra lateral derecha o solapamiento móvil)
                    // ¿O centrar?
                    // Retorno seguro: margen derecho mínimo
                    left = window.innerWidth - dropdownWidth - 10;
                }

                // Aplicar estilos
                dropdownEl.style.top = `${top}px`;
                dropdownEl.style.left = `${left}px`;

                dropdownEl.classList.add('show');
            }
        });

        // Cerrar al redimensionar/desplazar para evitar separación flotante
        window.addEventListener('resize', () => {
            if (dropdownEl.classList.contains('show')) dropdownEl.classList.remove('show');
        });
        window.addEventListener('scroll', () => {
            // Opcional: Cerrar al desplazar, ¿o actualizar posición? Cerrar es más seguro/fácil.
            if (dropdownEl.classList.contains('show')) dropdownEl.classList.remove('show');
        }, true); // Fase de captura para detectar el desplazamiento de cualquier contenedor
    }

    // Manejador de Marcar Todo
    if (markAllBtn) {
        markAllBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            markAllRead();
        });
    }

    // Cerrar al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (dropdownEl && dropdownEl.classList.contains('show')) {
            if (!dropdownEl.contains(e.target) && !parentContainer.contains(e.target)) {
                dropdownEl.classList.remove('show');
            }
        }
    });

    // Sondeo Inicial
    checkNotifications();
    // Iniciar Intervalo
    setInterval(checkNotifications, NOTIFICATION_POLL_INTERVAL);

})();
