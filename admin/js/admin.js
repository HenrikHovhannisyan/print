/**
 * PrintEditor — Admin Panel JavaScript
 * 
 * Логика: авторизация, загрузка статистики, CRUD заказов,
 * просмотр деталей, скачивание файлов.
 */

const AdminApp = (function () {
    'use strict';

    // --- Состояние ---
    const state = {
        token: localStorage.getItem('pe_admin_token') || null,
        username: localStorage.getItem('pe_admin_user') || '',
        currentPage: 'dashboard',
        ordersPage: 1,
        ordersFilter: '',
        currentOrderItems: [],
    };

    // --- API ---
    const API_BASE = '/api';

    /**
     * Универсальный fetch-обёртка
     */
    async function apiFetch(endpoint, options = {}) {
        const url = API_BASE + endpoint;
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        };

        if (state.token) {
            headers['Authorization'] = 'Bearer ' + state.token;
        }

        try {
            const res = await fetch(url, {
                ...options,
                headers,
            });

            const data = await res.json();

            if (res.status === 401 && endpoint !== '/admin/login') {
                logout();
                return null;
            }

            return data;
        } catch (err) {
            console.error('API Error:', err);
            return { success: false, message: 'Ошибка сети' };
        }
    }


    // =============================================
    //  Авторизация
    // =============================================

    function initLogin() {
        const form = document.getElementById('login-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value;
            const errorEl = document.getElementById('login-error');

            errorEl.textContent = '';

            const result = await apiFetch('/admin/login', {
                method: 'POST',
                body: JSON.stringify({ username, password }),
            });

            if (result && result.success) {
                state.token = result.data.token;
                state.username = result.data.username;
                localStorage.setItem('pe_admin_token', state.token);
                localStorage.setItem('pe_admin_user', state.username);
                showApp();
            } else {
                errorEl.textContent = result?.message || 'Ошибка входа';
            }
        });
    }

    function logout() {
        state.token = null;
        state.username = '';
        localStorage.removeItem('pe_admin_token');
        localStorage.removeItem('pe_admin_user');
        showLogin();
    }

    function showLogin() {
        document.getElementById('login-screen').style.display = '';
        document.getElementById('app-screen').style.display = 'none';
    }

    function showApp() {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-screen').style.display = '';
        document.getElementById('admin-username').textContent = state.username;
        loadDashboard();
    }


    // =============================================
    //  Навигация
    // =============================================

    function initNavigation() {
        document.querySelectorAll('.pe-admin-nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                navigateTo(btn.dataset.page);
            });
        });

        document.getElementById('btn-logout').addEventListener('click', logout);
    }

    function navigateTo(page) {
        state.currentPage = page;

        // Обновляем активную кнопку
        document.querySelectorAll('.pe-admin-nav-btn').forEach(btn => {
            btn.classList.toggle('pe-admin-nav-btn--active', btn.dataset.page === page);
        });

        // Показываем нужную страницу
        document.getElementById('page-dashboard').style.display = page === 'dashboard' ? '' : 'none';
        document.getElementById('page-orders').style.display = page === 'orders' ? '' : 'none';
        document.getElementById('page-garments').style.display = page === 'garments' ? '' : 'none';
        document.getElementById('page-users').style.display = page === 'users' ? '' : 'none';

        if (page === 'dashboard') loadDashboard();
        if (page === 'orders') loadOrders();
        if (page === 'garments') loadGarments();
        if (page === 'users') loadUsers();
    }


    // =============================================
    //  Пользователи
    // =============================================

    async function loadUsers() {
        const tbody = document.getElementById('users-body');
        tbody.innerHTML = `<tr><td colspan="5" class="pe-admin-table__empty">Загрузка...</td></tr>`;
        const result = await apiFetch(`/admin/users`);

        if (!result || !result.success) {
            tbody.innerHTML = `<tr><td colspan="5" class="pe-admin-table__empty">Ошибка загрузки</td></tr>`;
            return;
        }

        const users = result.data.users || [];

        if (users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="pe-admin-table__empty">Нет пользователей</td></tr>`;
            return;
        }

        tbody.innerHTML = users.map(u => `
            <tr>
                <td>#${u.id}</td>
                <td><a href="mailto:${u.email}">${u.email}</a></td>
                <td>
                    <span style="font-weight:600;">${u.total_orders}</span> / 
                    <span style="color:var(--admin-primary); font-weight:600;">${u.active_orders}</span>
                </td>
                <td>${formatDate(u.created_at)}</td>
                <td>
                    <button class="pe-admin-btn pe-admin-btn--ghost pe-admin-btn--sm"
                            onclick="AdminApp.viewUser(${u.id})">
                        История заказов
                    </button>
                </td>
            </tr>
        `).join('');
    }

    async function viewUser(userId) {
        const modal = document.getElementById('user-modal');
        const listBody = document.getElementById('user-orders-body');
        const detailsDiv = document.getElementById('user-details-content');

        modal.style.display = 'flex';
        listBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">Загрузка...</td></tr>';
        detailsDiv.innerHTML = '...';

        const result = await apiFetch(`/admin/users/${userId}`);
        if (!result || !result.success) {
            showToast('Ошибка загрузки данных пользователя');
            return;
        }

        const user = result.data;
        const orders = user.orders || [];

        detailsDiv.innerHTML = `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:24px; padding:16px; background:var(--admin-bg-secondary); border-radius:12px;">
                <div>
                    <label style="display:block; font-size:12px; color:var(--admin-text-muted); margin-bottom:4px;">Email</label>
                    <div style="font-weight:600;">${user.email}</div>
                </div>
                <div>
                    <label style="display:block; font-size:12px; color:var(--admin-text-muted); margin-bottom:4px;">Дата регистрации</label>
                    <div style="font-weight:600;">${formatDate(user.created_at)}</div>
                </div>
                <div>
                    <label style="display:block; font-size:12px; color:var(--admin-text-muted); margin-bottom:4px;">Всего заказов</label>
                    <div style="font-weight:600;">${user.total_orders}</div>
                </div>
                <div>
                    <label style="display:block; font-size:12px; color:var(--admin-text-muted); margin-bottom:4px;">Активных заказов</label>
                    <div style="font-weight:600; color:var(--admin-primary);">${user.active_orders}</div>
                </div>
            </div>
        `;

        if (orders.length === 0) {
            listBody.innerHTML = '<tr><td colspan="5" class="pe-admin-table__empty">Заказов пока нет</td></tr>';
        } else {
            listBody.innerHTML = orders.map(o => `
                <tr>
                    <td><strong>${o.order_number}</strong></td>
                    <td>${renderBadge(o.status)}</td>
                    <td>${o.total_items} шт.</td>
                    <td>${formatDate(o.created_at)}</td>
                    <td>
                        <button class="pe-admin-btn pe-admin-btn--ghost pe-admin-btn--sm" 
                                onclick="document.getElementById('user-modal').style.display='none', AdminApp.viewOrder(${o.id})">
                            Открыть
                        </button>
                    </td>
                </tr>
            `).join('');
        }
    }

    // =============================================
    //  Dashboard
    // =============================================

    async function loadDashboard() {
        const result = await apiFetch('/admin/stats');

        if (!result || !result.success) return;

        const d = result.data;

        setStatValue('stat-total', d.total_orders);
        setStatValue('stat-new', d.new_orders);
        setStatValue('stat-processing', d.processing_orders);
        setStatValue('stat-done', d.done_orders);
        setStatValue('stat-designs', d.total_designs);

        renderRecentOrders(d.recent_orders || []);
    }

    function setStatValue(id, value) {
        const card = document.getElementById(id);
        if (card) {
            card.querySelector('.pe-admin-stat-card__value').textContent = value;
        }
    }

    function renderRecentOrders(orders) {
        const tbody = document.getElementById('recent-orders-body');

        if (!orders.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="pe-admin-table__empty">Заказов пока нет</td></tr>';
            return;
        }

        tbody.innerHTML = orders.map(order => `
            <tr>
                <td><strong>${escHtml(order.order_number)}</strong></td>
                <td>${escHtml(order.customer_name || '—')}</td>
                <td>${escHtml(order.customer_phone || '—')}</td>
                <td>${renderBadge(order.status)}</td>
                <td>${order.total_items}</td>
                <td>${formatDate(order.created_at)}</td>
                <td>
                    <button class="pe-admin-btn pe-admin-btn--ghost pe-admin-btn--sm"
                            onclick="AdminApp.viewOrder(${order.id})">
                        Открыть
                    </button>
                </td>
            </tr>
        `).join('');
    }


    // =============================================
    //  Orders Page
    // =============================================

    function initOrdersPage() {
        document.getElementById('filter-status').addEventListener('change', (e) => {
            state.ordersFilter = e.target.value;
            state.ordersPage = 1;
            loadOrders();
        });
    }

    async function loadOrders() {
        let endpoint = `/admin/orders?page=${state.ordersPage}&limit=20`;
        if (state.ordersFilter) {
            endpoint += `&status=${state.ordersFilter}`;
        }

        const result = await apiFetch(endpoint);
        if (!result || !result.success) return;

        const { orders, total, page, total_pages } = result.data;
        renderOrdersTable(orders);
        renderPagination(page, total_pages);
    }

    function renderOrdersTable(orders) {
        const tbody = document.getElementById('orders-body');

        if (!orders.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="pe-admin-table__empty">Заказов не найдено</td></tr>';
            return;
        }

        tbody.innerHTML = orders.map(order => `
            <tr>
                <td><strong>${escHtml(order.order_number)}</strong></td>
                <td>${escHtml(order.customer_name || '—')}</td>
                <td>${escHtml(order.customer_email || '—')}</td>
                <td>${escHtml(order.customer_phone || '—')}</td>
                <td>${renderBadge(order.status)}</td>
                <td>${order.total_items}</td>
                <td>${formatDate(order.created_at)}</td>
                <td>
                    <button class="pe-admin-btn pe-admin-btn--ghost pe-admin-btn--sm"
                            onclick="AdminApp.viewOrder(${order.id})">
                        Открыть
                    </button>
                    <button class="pe-admin-btn pe-admin-btn--danger pe-admin-btn--sm"
                            onclick="AdminApp.deleteOrder(${order.id})">
                        Удалить
                    </button>
                </td>
            </tr>
        `).join('');
    }

    function renderPagination(currentPage, totalPages) {
        const container = document.getElementById('orders-pagination');

        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = '';
        for (let i = 1; i <= totalPages; i++) {
            html += `<button class="${i === currentPage ? 'active' : ''}" 
                             onclick="AdminApp.goToPage(${i})">${i}</button>`;
        }

        container.innerHTML = html;
    }

    function goToPage(page) {
        state.ordersPage = page;
        loadOrders();
    }


    // =============================================
    //  Order Detail Modal
    // =============================================

    async function viewOrder(orderId) {
        const result = await apiFetch(`/admin/orders/${orderId}`);
        if (!result || !result.success) return;

        const order = result.data;

        document.getElementById('modal-order-title').textContent =
            `Заказ ${order.order_number}`;

        const statusOptions = [
            'new', 'confirmed', 'processing', 'printing',
            'ready', 'shipped', 'done', 'cancelled'
        ];
        const statusLabels = {
            new: 'Новый', confirmed: 'Подтверждён', processing: 'В обработке',
            printing: 'Печать', ready: 'Готов', shipped: 'Отправлен',
            done: 'Завершён', cancelled: 'Отменён',
        };

        const garmentLabels = {
            tshirt: 'Футболка', hoodie: 'Худи', sweatshirt: 'Свитшот',
            polo: 'Поло', tank: 'Майка',
        };

        let itemsHtml = '';
        if (order.items && order.items.length) {
            itemsHtml = `
                <h4 style="margin-top:20px; margin-bottom: 12px; font-size: 14px; 
                           color: var(--admin-text-muted); text-transform: uppercase; 
                           letter-spacing: 0.5px;">
                    Позиции заказа
                </h4>
                <div class="pe-admin-order-items">
                    ${order.items.map((item, index) => `
                        <div class="pe-admin-order-item">
                            ${item.preview_path
                    ? `<img class="pe-admin-order-item__preview" 
                                        src="/${item.preview_path}" 
                                        alt="Превью">`
                    : `<div class="pe-admin-order-item__preview" 
                                        style="display:flex;align-items:center;justify-content:center;
                                               color:var(--admin-text-muted);font-size:12px;">
                                        Нет превью
                                   </div>`
                }
                            <div class="pe-admin-order-item__info">
                                <p>Тип: <span>${garmentLabels[item.garment_type] || item.garment_type}</span></p>
                                <p>Цвет: <span>
                                    <span style="display:inline-block;width:12px;height:12px;
                                                 border-radius:50%;background:${item.garment_color};
                                                 vertical-align:middle;margin-right:4px;
                                                 border:1px solid rgba(255,255,255,0.2);"></span>
                                    ${item.garment_color}
                                </span></p>
                                <p>Размер: <span>${item.size}</span></p>
                                <p>Кол-во: <span>${item.quantity}</span></p>
                            </div>
                            <div class="pe-admin-order-item__actions">
                                ${item.highres_path
                    ? `<a href="/${item.highres_path}" download 
                                          class="pe-admin-btn pe-admin-btn--ghost pe-admin-btn--sm">
                                          PNG
                                       </a>`
                    : ''}
                                ${item.has_svg
                    ? `<button class="pe-admin-btn pe-admin-btn--ghost pe-admin-btn--sm"
                                               onclick="AdminApp.downloadOrderItemData(${index}, 'svg')">
                                          SVG
                                       </button>`
                    : ''}
                                ${item.has_canvas
                    ? `<button class="pe-admin-btn pe-admin-btn--ghost pe-admin-btn--sm"
                                               onclick="AdminApp.downloadOrderItemData(${index}, 'json')">
                                          JSON
                                       </button>`
                    : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            state.currentOrderItems = order.items;
        }

        const body = document.getElementById('modal-order-body');
        body.innerHTML = `
            <div class="pe-admin-order-info">
                <div class="pe-admin-order-info__item">
                    <span class="pe-admin-order-info__label">Клиент</span>
                    <span class="pe-admin-order-info__value">${escHtml(order.customer_name || '—')}</span>
                </div>
                <div class="pe-admin-order-info__item">
                    <span class="pe-admin-order-info__label">Email</span>
                    <span class="pe-admin-order-info__value">${escHtml(order.customer_email || '—')}</span>
                </div>
                <div class="pe-admin-order-info__item">
                    <span class="pe-admin-order-info__label">Телефон</span>
                    <span class="pe-admin-order-info__value">${escHtml(order.customer_phone || '—')}</span>
                </div>
                <div class="pe-admin-order-info__item">
                    <span class="pe-admin-order-info__label">Адрес</span>
                    <span class="pe-admin-order-info__value">${escHtml(order.customer_address || '—')}</span>
                </div>
                <div class="pe-admin-order-info__item">
                    <span class="pe-admin-order-info__label">Дата создания</span>
                    <span class="pe-admin-order-info__value">${formatDate(order.created_at)}</span>
                </div>
                <div class="pe-admin-order-info__item">
                    <span class="pe-admin-order-info__label">Примечание клиента</span>
                    <span class="pe-admin-order-info__value">${escHtml(order.notes || '—')}</span>
                </div>
            </div >

            <div class="pe-admin-status-editor">
                <label>Статус:</label>
                <select class="pe-admin-select" id="modal-status-select">
                    ${statusOptions.map(s =>
            `<option value="${s}" ${s === order.status ? 'selected' : ''}>
                            ${statusLabels[s]}
                         </option>`
        ).join('')}
                </select>
                <button class="pe-admin-btn pe-admin-btn--primary pe-admin-btn--sm" 
                        onclick="AdminApp.updateOrderStatus(${order.id})">
                    Сохранить
                </button>
            </div>

            <div class="pe-admin-notes-editor">
                <label class="pe-admin-field" style="margin-bottom:6px;display:block;">
                    <span style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;
                                 color:var(--admin-text-muted);">
                        Заметки администратора
                    </span>
                </label>
                <textarea id="modal-admin-notes" placeholder="Внутренние заметки...">${escHtml(order.admin_notes || '')}</textarea>
                <button class="pe-admin-btn pe-admin-btn--ghost pe-admin-btn--sm" 
                        style="margin-top:8px;"
                        onclick="AdminApp.saveAdminNotes(${order.id})">
                    Сохранить заметки
                </button>
            </div>

            ${itemsHtml}
`;

        document.getElementById('order-modal').style.display = '';
    }

    async function updateOrderStatus(orderId) {
        const select = document.getElementById('modal-status-select');
        const newStatus = select.value;

        const result = await apiFetch(`/admin/orders/${orderId}`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus }),
        });

        if (result && result.success) {
            // Обновляем таблицы
            if (state.currentPage === 'dashboard') loadDashboard();
            if (state.currentPage === 'orders') loadOrders();

            showToast('Статус обновлён');
        }
    }

    async function saveAdminNotes(orderId) {
        const notes = document.getElementById('modal-admin-notes').value;

        const result = await apiFetch(`/admin/orders/${orderId}`, {
            method: 'PUT',
            body: JSON.stringify({ admin_notes: notes }),
        });

        if (result && result.success) {
            showToast('Заметки сохранены');
        }
    }

    async function deleteOrder(orderId) {
        const confirmed = await DialogService.confirm('Удаление', 'Удалить заказ? Это действие нельзя отменить.', 'Удалить', 'Отмена', true);
        if (!confirmed) return;

        const result = await apiFetch(`/admin/orders/${orderId}`, {
            method: 'DELETE',
        });

        if (result && result.success) {
            if (state.currentPage === 'dashboard') loadDashboard();
            if (state.currentPage === 'orders') loadOrders();
            showToast('Заказ удалён');
        }
    }

    async function downloadDesign(designId, type) {
        const result = await apiFetch(`/admin/designs/${designId}`);
        if (!result || !result.success) return;

        const design = result.data;

        if (type === 'svg' && design.svg_data) {
            downloadBlob(design.svg_data, `design_${designId}.svg`, 'image/svg+xml');
        } else if (type === 'json' && design.canvas_json) {
            const jsonStr = typeof design.canvas_json === 'string'
                ? design.canvas_json
                : JSON.stringify(design.canvas_json, null, 2);
            downloadBlob(jsonStr, `design_${designId}.json`, 'application/json');
        }
    }

    function downloadOrderItemData(itemIndex, type) {
        const item = state.currentOrderItems[itemIndex];
        if (!item) return;

        if (type === 'svg' && item.svg_data) {
            downloadBlob(item.svg_data, `order_item_${item.id}.svg`, 'image/svg+xml');
        } else if (type === 'json' && item.canvas_json) {
            const jsonStr = typeof item.canvas_json === 'string'
                ? item.canvas_json
                : JSON.stringify(item.canvas_json, null, 2);
            downloadBlob(jsonStr, `order_item_${item.id}.json`, 'application/json');
        }
    }

    function downloadBlob(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }


    // =============================================
    //  Garments Page
    // =============================================

    let editingGarmentId = null;
    let editingActiveSide = 'front'; // 'front' or 'back'

    async function loadGarments() {
        const result = await apiFetch('/admin/garments');
        if (!result || !result.success) return;

        renderGarmentsGrid(result.data);
    }

    function renderGarmentsGrid(garments) {
        const grid = document.getElementById('garments-grid');

        if (!garments.length) {
            grid.innerHTML = '<p style="color:var(--admin-text-muted);font-style:italic;">Типов одежды нет. Добавьте первый.</p>';
            return;
        }

        grid.innerHTML = garments.map(g => {
            const inactiveClass = g.is_active ? '' : 'pe-admin-garment-card--inactive';
            const priceHtml = g.price_one_side ? `
                <div style="font-size:12px; margin-top:4px; color:var(--admin-primary); font-weight:600;">
                    ${g.price_one_side} ֏ / ${g.price_two_sides} ֏
                </div>
            ` : '';
            return `
    <div class="pe-admin-garment-card ${inactiveClass}">
                    <div class="pe-admin-garment-card__img-wrap">
                        <img src="/${g.image_path}" alt="${escHtml(g.name)}">
                        <div class="pe-admin-garment-card__area-indicator" style="
                            top: ${g.print_area_top}%;
                            left: ${g.print_area_left}%;
                            width: ${g.print_area_width}%;
                            height: ${g.print_area_height}%;
                        "></div>
                    </div>
                    <div class="pe-admin-garment-card__body">
                        <div class="pe-admin-garment-card__name">${escHtml(g.name)}</div>
                        <div class="pe-admin-garment-card__slug">${escHtml(g.slug)}</div>
                        ${priceHtml}
                        <div class="pe-admin-garment-card__actions">
                            <button class="pe-admin-btn pe-admin-btn--ghost pe-admin-btn--sm"
                                    onclick="AdminApp.editGarment(${g.id})">
                                Редактировать
                            </button>
                            <button class="pe-admin-btn pe-admin-btn--danger pe-admin-btn--sm"
                                    onclick="AdminApp.deleteGarment(${g.id})">
                                Удалить
                            </button>
                        </div>
                    </div>
                </div >
    `;
        }).join('');
    }

    function initGarmentsPage() {
        document.getElementById('btn-add-garment').addEventListener('click', () => {
            openGarmentModal(null);
        });

        // Garment modal close
        const gModal = document.getElementById('garment-modal');
        document.getElementById('garment-modal-close').addEventListener('click', () => {
            gModal.style.display = 'none';
        });
        gModal.addEventListener('click', (e) => {
            if (e.target === gModal) gModal.style.display = 'none';
        });
        document.getElementById('ge-cancel').addEventListener('click', () => {
            gModal.style.display = 'none';
        });

        // Save button
        document.getElementById('ge-save').addEventListener('click', saveGarment);

        // Tabs Logic
        document.querySelectorAll('.pe-admin-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const side = btn.dataset.tab;
                switchEditorTab(side);
            });
        });

        // Image preview on file select
        document.getElementById('ge-image').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    if (editingActiveSide === 'front') {
                        document.getElementById('ge-preview-img').src = ev.target.result;
                    }
                    updatePreviewArea();
                };
                reader.readAsDataURL(file);
            }
        });
        document.getElementById('ge-image-back').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    if (editingActiveSide === 'back') {
                        document.getElementById('ge-preview-img').src = ev.target.result;
                    }
                    updatePreviewArea();
                };
                reader.readAsDataURL(file);
            }
        });

        // Live update preview area on input change
        const areaInputs = ['ge-pa-top', 'ge-pa-left', 'ge-pa-width', 'ge-pa-height',
            'ge-pa-back-top', 'ge-pa-back-left', 'ge-pa-back-width', 'ge-pa-back-height'];

        areaInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', updatePreviewArea);
        });

        // Drag support for preview area
        initPreviewAreaDrag();
    }

    function switchEditorTab(side) {
        editingActiveSide = side;

        // Buttons
        document.querySelectorAll('.pe-admin-tab-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.tab === side);
        });

        // Panes
        document.querySelectorAll('.pe-admin-tab-pane').forEach(p => {
            p.classList.toggle('active', p.id === 'tab-' + side);
        });

        // Preview Image
        const previewImg = document.getElementById('ge-preview-img');
        if (side === 'front') {
            const fileInput = document.getElementById('ge-image');
            if (fileInput.files.length > 0) {
                const reader = new FileReader();
                reader.onload = (e) => previewImg.src = e.target.result;
                reader.readAsDataURL(fileInput.files[0]);
            } else {
                const path = document.getElementById('ge-image-path').value;
                previewImg.src = path ? '/' + path : '';
            }
        } else {
            const fileInputBack = document.getElementById('ge-image-back');
            if (fileInputBack.files.length > 0) {
                const reader = new FileReader();
                reader.onload = (e) => previewImg.src = e.target.result;
                reader.readAsDataURL(fileInputBack.files[0]);
            } else {
                const path = document.getElementById('ge-image-back-path').value;
                previewImg.src = path ? '/' + path : '';
            }
        }

        setTimeout(updatePreviewArea, 50);
    }

    function openGarmentModal(garment) {
        editingGarmentId = garment ? garment.id : null;
        editingActiveSide = 'front';

        document.getElementById('garment-modal-title').textContent =
            garment ? 'Редактировать: ' + garment.name : 'Новый тип одежды';

        document.getElementById('ge-name').value = garment ? garment.name : '';
        document.getElementById('ge-slug').value = garment ? garment.slug : '';

        document.getElementById('ge-pa-top').value = garment ? garment.print_area_top : 30;
        document.getElementById('ge-pa-left').value = garment ? garment.print_area_left : 35;
        document.getElementById('ge-pa-width').value = garment ? garment.print_area_width : 30;
        document.getElementById('ge-pa-height').value = garment ? garment.print_area_height : 30;

        document.getElementById('ge-pa-back-top').value = garment ? (garment.print_area_back_top || 30) : 30;
        document.getElementById('ge-pa-back-left').value = garment ? (garment.print_area_back_left || 35) : 35;
        document.getElementById('ge-pa-back-width').value = garment ? (garment.print_area_back_width || 30) : 30;
        document.getElementById('ge-pa-back-height').value = garment ? (garment.print_area_back_height || 30) : 30;

        document.getElementById('ge-price-one').value = garment ? (garment.price_one_side || 0) : 0;
        document.getElementById('ge-price-two').value = garment ? (garment.price_two_sides || 0) : 0;

        document.getElementById('ge-sort').value = garment ? garment.sort_order : 0;
        document.getElementById('ge-active').checked = garment ? !!garment.is_active : true;

        document.getElementById('ge-image-path').value = garment ? garment.image_path : '';
        document.getElementById('ge-image-back-path').value = garment ? (garment.image_back_path || '') : '';
        document.getElementById('ge-image').value = '';
        document.getElementById('ge-image-back').value = '';

        // Tabs
        switchEditorTab('front');

        document.getElementById('garment-modal').style.display = 'flex';
    }

    async function editGarment(garmentId) {
        const result = await apiFetch(`/admin/garments/${garmentId}`);
        if (!result || !result.success) return;
        openGarmentModal(result.data);
    }

    async function saveGarment() {
        const name = document.getElementById('ge-name').value.trim();
        const slug = document.getElementById('ge-slug').value.trim();

        if (!name || !slug) {
            showToast('Название и slug обязательны');
            return;
        }

        const fileInput = document.getElementById('ge-image');
        const fileInputBack = document.getElementById('ge-image-back');
        const hasNewFile = fileInput.files.length > 0;
        const hasNewFileBack = fileInputBack.files.length > 0;
        const existingPath = document.getElementById('ge-image-path').value;

        if (!hasNewFile && !existingPath && !editingGarmentId) {
            showToast('Загрузите изображение одежды');
            return;
        }

        // Если есть файл — используем FormData
        if (hasNewFile || hasNewFileBack) {
            const formData = new FormData();
            if (hasNewFile) formData.append('image', fileInput.files[0]);
            if (hasNewFileBack) formData.append('image_back', fileInputBack.files[0]);

            formData.append('name', name);
            formData.append('slug', slug);
            formData.append('print_area_top', document.getElementById('ge-pa-top').value);
            formData.append('print_area_left', document.getElementById('ge-pa-left').value);
            formData.append('print_area_width', document.getElementById('ge-pa-width').value);
            formData.append('print_area_height', document.getElementById('ge-pa-height').value);

            formData.append('print_area_back_top', document.getElementById('ge-pa-back-top').value);
            formData.append('print_area_back_left', document.getElementById('ge-pa-back-left').value);
            formData.append('print_area_back_width', document.getElementById('ge-pa-back-width').value);
            formData.append('print_area_back_height', document.getElementById('ge-pa-back-height').value);

            formData.append('price_one_side', document.getElementById('ge-price-one').value);
            formData.append('price_two_sides', document.getElementById('ge-price-two').value);

            formData.append('sort_order', document.getElementById('ge-sort').value);
            formData.append('is_active', document.getElementById('ge-active').checked ? 1 : 0);

            const endpoint = editingGarmentId
                ? `/admin/garments/${editingGarmentId}`
                : '/admin/garments';
            // Для FormData с картинками используем POST даже для обновления (Legacy compatibility/PHP quirks)
            // Но мы можем попробовать PUT если бэкенд поймет multipart/form-data
            const method = editingGarmentId ? 'POST' : 'POST';
            if (editingGarmentId) formData.append('_method', 'PUT'); // Эмуляция PUT

            try {
                const res = await fetch('/api' + endpoint, {
                    method,
                    headers: {
                        'Authorization': 'Bearer ' + state.token,
                    },
                    body: formData,
                });
                const result = await res.json();
                if (result.success) {
                    document.getElementById('garment-modal').style.display = 'none';
                    loadGarments();
                    showToast(editingGarmentId ? 'Тип обновлён' : 'Тип создан');
                } else {
                    showToast(result.message || 'Ошибка');
                }
            } catch (e) {
                showToast('Ошибка сети');
            }
        } else {
            // JSON request (без файла)
            const data = {
                name,
                slug,
                image_path: existingPath,
                image_back_path: document.getElementById('ge-image-back-path').value,
                print_area_top: parseFloat(document.getElementById('ge-pa-top').value),
                print_area_left: parseFloat(document.getElementById('ge-pa-left').value),
                print_area_width: parseFloat(document.getElementById('ge-pa-width').value),
                print_area_height: parseFloat(document.getElementById('ge-pa-height').value),
                print_area_back_top: parseFloat(document.getElementById('ge-pa-back-top').value),
                print_area_back_left: parseFloat(document.getElementById('ge-pa-back-left').value),
                print_area_back_width: parseFloat(document.getElementById('ge-pa-back-width').value),
                print_area_back_height: parseFloat(document.getElementById('ge-pa-back-height').value),
                price_one_side: parseInt(document.getElementById('ge-price-one').value),
                price_two_sides: parseInt(document.getElementById('ge-price-two').value),
                sort_order: parseInt(document.getElementById('ge-sort').value),
                is_active: document.getElementById('ge-active').checked ? 1 : 0,
            };

            const endpoint = editingGarmentId
                ? `/admin/garments/${editingGarmentId}`
                : '/admin/garments';
            const method = editingGarmentId ? 'PUT' : 'POST';

            const result = await apiFetch(endpoint, {
                method,
                body: JSON.stringify(data),
            });

            if (result && result.success) {
                document.getElementById('garment-modal').style.display = 'none';
                loadGarments();
                showToast(editingGarmentId ? 'Тип обновлён' : 'Тип создан');
            } else {
                showToast(result?.message || 'Ошибка');
            }
        }
    }

    async function deleteGarment(garmentId) {
        const confirmed = await DialogService.confirm('Удаление', 'Удалить этот тип одежды?', 'Удалить', 'Отмена', true);
        if (!confirmed) return;

        const result = await apiFetch(`/admin/garments/${garmentId}`, {
            method: 'DELETE',
        });

        if (result && result.success) {
            loadGarments();
            showToast('Тип удалён');
        }
    }

    /**
     * Обновить визуальное отображение printArea на превью
     */
    function updatePreviewArea() {
        const area = document.getElementById('ge-preview-area');
        const prefix = editingActiveSide === 'back' ? 'ge-pa-back-' : 'ge-pa-';

        const top = parseFloat(document.getElementById(prefix + 'top').value) || 0;
        const left = parseFloat(document.getElementById(prefix + 'left').value) || 0;
        const width = parseFloat(document.getElementById(prefix + 'width').value) || 0;
        const height = parseFloat(document.getElementById(prefix + 'height').value) || 0;

        area.style.top = top + '%';
        area.style.left = left + '%';
        area.style.width = width + '%';
        area.style.height = height + '%';
    }

    /**
     * Drag для перемещения области печати на превью
     */
    function initPreviewAreaDrag() {
        const area = document.getElementById('ge-preview-area');
        const wrap = document.getElementById('ge-preview-wrap');
        let isDragging = false;
        let startX, startY, startLeft, startTop;

        area.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isDragging = true;
            const prefix = editingActiveSide === 'back' ? 'ge-pa-back-' : 'ge-pa-';

            startX = e.clientX;
            startY = e.clientY;
            startLeft = parseFloat(document.getElementById(prefix + 'left').value);
            startTop = parseFloat(document.getElementById(prefix + 'top').value);
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const wrapRect = wrap.getBoundingClientRect();
            const prefix = editingActiveSide === 'back' ? 'ge-pa-back-' : 'ge-pa-';

            const dx = ((e.clientX - startX) / wrapRect.width) * 100;
            const dy = ((e.clientY - startY) / wrapRect.height) * 100;

            const widthVal = parseFloat(document.getElementById(prefix + 'width').value);
            const heightVal = parseFloat(document.getElementById(prefix + 'height').value);

            const newLeft = Math.max(0, Math.min(100 - widthVal, startLeft + dx));
            const newTop = Math.max(0, Math.min(100 - heightVal, startTop + dy));

            document.getElementById(prefix + 'left').value = newLeft.toFixed(1);
            document.getElementById(prefix + 'top').value = newTop.toFixed(1);
            updatePreviewArea();
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }


    // =============================================
    //  Modal Control
    // =============================================

    function initModal() {
        const modal = document.getElementById('order-modal');
        const closeBtn = document.getElementById('modal-close');

        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.getElementById('order-modal').style.display = 'none';
                document.getElementById('garment-modal').style.display = 'none';
            }
        });
    }


    // =============================================
    //  Utilities
    // =============================================

    const STATUS_LABELS = {
        new: 'Новый', confirmed: 'Подтверждён', processing: 'В обработке',
        printing: 'Печать', ready: 'Готов', shipped: 'Отправлен',
        done: 'Завершён', cancelled: 'Отменён',
    };

    function renderBadge(status) {
        const label = STATUS_LABELS[status] || status;
        return `<span class="pe-admin-badge pe-admin-badge--${status}"> ${label}</span> `;
    }

    function escHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return d.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    function showToast(message) {
        let toast = document.querySelector('.pe-admin-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'pe-admin-toast';
            toast.style.cssText = `
position: fixed; bottom: 24px; left: 50 %; transform: translateX(-50 %);
padding: 10px 24px; background: var(--admin - primary); color: #fff;
border - radius: 8px; font - size: 13px; font - family: var(--admin - font);
box - shadow: 0 4px 20px rgba(0, 0, 0, 0.3); z - index: 9999;
transition: opacity 0.3s ease;
`;
            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.style.opacity = '1';

        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(() => {
            toast.style.opacity = '0';
        }, 2500);
    }


    // =============================================
    //  Init
    // =============================================

    function init() {
        initLogin();
        initNavigation();
        initOrdersPage();
        initGarmentsPage();
        initModal();

        // Если есть сохранённый токен — пробуем войти
        if (state.token) {
            showApp();
        } else {
            showLogin();
        }
    }

    // Запуск при загрузке DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Public API (для onclick в HTML)
    return {
        viewOrder,
        deleteOrder,
        updateOrderStatus,
        saveAdminNotes,
        downloadDesign,
        goToPage,
        editGarment,
        deleteGarment,
        viewUser,
        downloadOrderItemData,
    };

})();
