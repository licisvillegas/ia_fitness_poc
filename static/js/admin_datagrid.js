/**
 * AdminDataGrid - Componente reutilizable para Tablas de Datos AJAX con Paginación y Búsqueda
 * 
 * Uso:
 * const grid = new AdminDataGrid({
 *   tableId: 'usersTableBody',
 *   paginationId: 'paginationContainer',
 *   searchId: 'userSearchInput',
 *   endpoint: '/api/admin/users_paginated',
 *   columns: [
 *     { key: 'name', label: 'Nombre' },
 *     { key: 'status', render: (row) => `<span class="badge">${row.status}</span>` }
 *   ]
 * });
 * grid.init();
 */

class AdminDataGrid {
    constructor(config) {
        this.config = config;
        this.currentPage = 1;
        this.pageSize = config.pageSize || 20;
        this.currentSearch = "";
        this.filters = {};
        this.searchTimer = null;
        this.abortController = null;
    }

    init() {
        this.loadPage(1);
        this.bindEvents();
    }

    setFilter(key, value) {
        if (value === "" || value === null) {
            delete this.filters[key];
        } else {
            this.filters[key] = value;
        }
        this.loadPage(1);
    }

    bindEvents() {
        const searchInput = document.getElementById(this.config.searchId);
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(this.searchTimer);
                this.searchTimer = setTimeout(() => {
                    this.currentSearch = e.target.value;
                    this.loadPage(1);
                }, 400); // Debounce
            });
        }
    }

    async loadPage(page) {
        this.currentPage = page;
        if (this.abortController) this.abortController.abort();
        this.abortController = new AbortController();

        this.showLoading();

        try {
            const url = new URL(this.config.endpoint, window.location.origin);
            url.searchParams.set('page', page);
            url.searchParams.set('limit', this.pageSize);
            if (this.currentSearch) url.searchParams.set('search', this.currentSearch);

            // Adjuntar filtros extra
            Object.keys(this.filters).forEach(key => {
                url.searchParams.set(key, this.filters[key]);
            });

            const res = await fetch(url, { signal: this.abortController.signal });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();
            this.renderTable(data.items || []);
            this.renderPagination(data);

            if (this.config.onLoad) this.config.onLoad(data);

        } catch (e) {
            if (e.name === 'AbortError') return;
            console.error("Grid Load Error:", e);
            this.showError();
        }
    }

    showLoading() {
        const tbody = document.getElementById(this.config.tableId);
        const spinner = `<div class="text-center py-4 text-secondary"><i class="fas fa-spinner fa-spin me-2"></i> Cargando datos...</div>`;

        if (tbody) {
            const colSpan = this.config.columns.length + 1;
            tbody.innerHTML = `<tr><td colspan="${colSpan}" class="text-center py-4 text-secondary"><i class="fas fa-spinner fa-spin me-2"></i> Cargando datos...</td></tr>`;
        }

        if (this.config.mobileId) {
            const container = document.getElementById(this.config.mobileId);
            if (container) container.innerHTML = spinner;
        }
    }

    showError() {
        const tbody = document.getElementById(this.config.tableId);
        const errorMsg = `<div class="text-center py-4 text-danger"><i class="fas fa-exclamation-triangle me-2"></i> Error al cargar datos.</div>`;

        if (tbody) {
            const colSpan = this.config.columns.length + 1;
            tbody.innerHTML = `<tr><td colspan="${colSpan}" class="text-center py-4 text-danger"><i class="fas fa-exclamation-triangle me-2"></i> Error al cargar datos.</td></tr>`;
        }

        if (this.config.mobileId) {
            const container = document.getElementById(this.config.mobileId);
            if (container) container.innerHTML = errorMsg;
        }
    }

    renderTable(items) {
        const tbody = document.getElementById(this.config.tableId);

        // Render Desktop Table
        if (tbody) {
            tbody.innerHTML = "";
            if (items.length === 0) {
                const colSpan = this.config.columns.length + 1;
                tbody.innerHTML = `<tr><td colspan="${colSpan}" class="text-center py-4 text-secondary">No se encontraron resultados.</td></tr>`;
            } else {
                items.forEach(row => {
                    const tr = document.createElement('tr');

                    this.config.columns.forEach(col => {
                        const td = document.createElement('td');
                        if (col.className) td.className = col.className;

                        if (col.render) {
                            td.innerHTML = col.render(row);
                        } else if (col.key) {
                            td.textContent = row[col.key] || "-";
                        }
                        tr.appendChild(td);
                    });

                    // Columna de Acciones (si está configurada)
                    if (this.config.actions) {
                        const td = document.createElement('td');
                        td.className = "text-end";
                        td.innerHTML = this.config.actions(row);
                        tr.appendChild(td);
                    }

                    tbody.appendChild(tr);
                });
            }
        }

        // Render Mobile List (if configured)
        this.renderMobile(items);
    }

    renderMobile(items) {
        if (!this.config.mobileId) return;
        const container = document.getElementById(this.config.mobileId);
        if (!container) return;

        container.innerHTML = "";

        if (items.length === 0) {
            container.innerHTML = `<div class="text-center py-4 text-secondary">No se encontraron resultados.</div>`;
            return;
        }

        items.forEach(row => {
            const card = document.createElement('div');
            // Use bg-card explicitly to match theme cards. Added mb-3 for spacing between cards.
            card.className = "card bg-card border-secondary border-opacity-25 shadow-sm mb-3";

            let html = `<div class="card-body">`;

            // Loop columns
            this.config.columns.forEach(col => {
                let val = "";
                if (col.render) {
                    val = col.render(row);
                } else if (col.key) {
                    val = row[col.key] || "-";
                }

                html += `
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="text-info opacity-75 fw-bold small text-uppercase" style="font-size: 0.75rem;">${col.label || ''}</span>
                        <div class="text-end ps-3 text-theme" style="max-width: 60%; word-break: break-word;">${val}</div>
                    </div>
                `;
            });

            // Actions
            if (this.config.actions) {
                html += `
                    <div class="d-flex justify-content-end gap-2 mt-3 pt-3 border-top border-secondary border-opacity-25">
                        ${this.config.actions(row)}
                    </div>
                `;
            }

            html += `</div>`;
            card.innerHTML = html;
            container.appendChild(card);
        });
    }

    renderPagination(data) {
        const container = document.getElementById(this.config.paginationId);
        if (!container) return;

        const { page, pages, total } = data;

        let html = `
            <div class="d-flex justify-content-between align-items-center w-100">
                <span class="small text-secondary">Total: ${total} registros</span>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-secondary pagination-prev" ${page <= 1 ? 'disabled' : ''} data-page="${page - 1}">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <span class="btn btn-sm btn-outline-secondary disabled border-secondary">
                        Página ${page} de ${pages || 1}
                    </span>
                    <button class="btn btn-sm btn-outline-secondary pagination-next" ${page >= pages ? 'disabled' : ''} data-page="${page + 1}">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>
        `;

        container.innerHTML = html;

        // Vincular eventos usando querySelector dentro del contenedor
        const prevBtn = container.querySelector('.pagination-prev');
        const nextBtn = container.querySelector('.pagination-next');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.loadPage(page - 1));
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.loadPage(page + 1));
        }
    }
}

// Ayudante para permitir vinculación simple onclick
window.createAdminGrid = (config) => {
    window.gridInstance = new AdminDataGrid(config); // Límite: soporta solo 1 cuadrícula por página por ahora
    window.gridInstance.init();
    return window.gridInstance;
};
