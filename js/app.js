/**
 * PrintEditor — App Module
 * Точка входа: инициализация, горячие клавиши, зум, общие утилиты
 */

const App = (function () {
    'use strict';

    let zoomLevel = 100;
    const ZOOM_STEP = 10;
    const ZOOM_MIN = 50;
    const ZOOM_MAX = 200;

    /** Текущая тема: 'dark' | 'light' */
    let currentTheme = 'light';

    /** Состояние холстов для сторон (JSON) */
    let sideStates = {
        front: null,
        back: null
    };

    /**
     * Инициализация всего приложения
     */
    async function init() {
        // 0. Тема (до остальных модулей, чтобы не мигало)
        _initTheme();

        // 1. Управление одеждой
        await GarmentManager.init();

        // 2. Инициализация canvas (после того как GarmentManager разметил область)
        setTimeout(() => {
            CanvasManager.init();

            // 3. Инструменты (после canvas)
            ToolsManager.init();

            // 4. Горячие клавиши
            _bindKeyboardShortcuts();

            // 5. Зум
            _bindZoomControls();

            // 6. Toolbar кнопки
            _bindToolbarButtons();

            // 7. Drag-and-drop на всю область
            _bindGlobalDragDrop();

            // 8. Авторизация и модальные окна
            _initAuthAndModals();

            // 9. Начальное обновление цены
            updatePrice();

            console.log('%c PrintEditor загружен ', 'background:#6c5ce7; color:#fff; padding:4px 12px; border-radius:4px; font-weight:bold;');
        }, 100);
    }

    /**
     * Инициализация темы из localStorage и привязка кнопки переключения
     */
    function _initTheme() {
        // Загружаем сохранённую тему
        const saved = localStorage.getItem('pe-theme');
        if (saved === 'light' || saved === 'dark') {
            currentTheme = saved;
        }
        _applyTheme();

        // Привязка кнопки
        const toggleBtn = document.getElementById('btn-theme-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', toggleTheme);
        }
    }

    /**
     * Переключение темы
     */
    function toggleTheme() {
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        _applyTheme();
        localStorage.setItem('pe-theme', currentTheme);
    }

    /**
     * Применение текущей темы к DOM
     */
    function _applyTheme() {
        const html = document.documentElement;
        const icon = document.getElementById('theme-icon');

        if (currentTheme === 'light') {
            html.setAttribute('data-theme', 'light');
            if (icon) {
                icon.className = 'ri-moon-line';
            }
        } else {
            html.removeAttribute('data-theme');
            if (icon) {
                icon.className = 'ri-sun-line';
            }
        }
    }

    /**
     * Горячие клавиши
     */
    function _bindKeyboardShortcuts() {
        document.addEventListener('keydown', function (e) {
            const canvas = CanvasManager.getCanvas();
            if (!canvas) return;

            // Проверяем, что не находимся в текстовом поле
            const tag = e.target.tagName.toLowerCase();
            const isEditing = tag === 'input' || tag === 'textarea' || tag === 'select';

            // Проверяем, не редактируется ли текст на canvas
            const activeObj = canvas.getActiveObject();
            const isTextEditing = activeObj && activeObj.isEditing;

            if (isEditing || isTextEditing) return;

            // Ctrl+Z — Undo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                CanvasManager.undo();
            }

            // Ctrl+Y or Ctrl+Shift+Z — Redo
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                CanvasManager.redo();
            }

            // Delete / Backspace — удалить объект
            if (e.key === 'Delete' || e.key === 'Backspace') {
                const obj = canvas.getActiveObject();
                if (obj) {
                    e.preventDefault();
                    canvas.remove(obj);
                    canvas.discardActiveObject();
                    canvas.renderAll();
                    showToast('Объект удалён', 'success');
                }
            }

            // Ctrl+D — Дублировать
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault();
                const obj = canvas.getActiveObject();
                if (obj) {
                    obj.clone(function (cloned) {
                        cloned.set({
                            left: (obj.left || 0) + 20,
                            top: (obj.top || 0) + 20
                        });
                        canvas.add(cloned);
                        canvas.setActiveObject(cloned);
                        canvas.renderAll();
                    });
                }
            }

            // Escape — снять выделение
            if (e.key === 'Escape') {
                canvas.discardActiveObject();
                canvas.renderAll();
                ToolsManager.setTool('select');
            }

            // V — выбор
            if (e.key === 'v' || e.key === 'V') {
                ToolsManager.setTool('select');
            }

            // T — текст
            if (e.key === 't' || e.key === 'T') {
                ToolsManager.setTool('text');
            }

            // B — кисть
            if (e.key === 'b' || e.key === 'B') {
                ToolsManager.setTool('brush');
            }

            // + / - — зум
            if (e.key === '+' || e.key === '=') {
                e.preventDefault();
                _zoomIn();
            }
            if (e.key === '-') {
                e.preventDefault();
                _zoomOut();
            }
        });
    }

    /**
     * Зум
     */
    function _bindZoomControls() {
        document.getElementById('btn-zoom-in').addEventListener('click', _zoomIn);
        document.getElementById('btn-zoom-out').addEventListener('click', _zoomOut);
        document.getElementById('btn-zoom-reset').addEventListener('click', _zoomReset);

        // Зум колёсиком мыши в области canvas
        document.getElementById('canvas-area').addEventListener('wheel', function (e) {
            e.preventDefault();
            if (e.deltaY < 0) {
                _zoomIn();
            } else {
                _zoomOut();
            }
        }, { passive: false });
    }

    function _zoomIn() {
        if (zoomLevel >= ZOOM_MAX) return;
        zoomLevel += ZOOM_STEP;
        _applyZoom();
    }

    function _zoomOut() {
        if (zoomLevel <= ZOOM_MIN) return;
        zoomLevel -= ZOOM_STEP;
        _applyZoom();
    }

    function _zoomReset() {
        zoomLevel = 100;
        _applyZoom();
    }

    function _applyZoom() {
        const workspace = document.getElementById('workspace');
        const scale = zoomLevel / 100;
        workspace.style.transform = 'scale(' + scale + ')';
        document.getElementById('zoom-value').textContent = zoomLevel + '%';
    }

    /**
     * Toolbar кнопки
     */
    function _bindToolbarButtons() {
        // Undo / Redo
        document.getElementById('btn-undo').addEventListener('click', () => CanvasManager.undo());
        document.getElementById('btn-redo').addEventListener('click', () => CanvasManager.redo());

        // Очистить canvas
        document.getElementById('btn-clear-canvas').addEventListener('click', function () {
            if (CanvasManager.getCanvas().getObjects().length === 0) {
                showToast('Холст уже пуст', 'info');
                return;
            }
            CanvasManager.clearCanvas();
            showToast('Холст очищен', 'success');
        });

        // Экспорт мокапа (одежда + дизайн)
        document.getElementById('btn-export').addEventListener('click', () => {
            ExportManager.exportAsPNG();
        });

        // Сохранить дизайн
        document.getElementById('btn-save-design').addEventListener('click', async () => {
            const btn = document.getElementById('btn-save-design');
            btn.disabled = true;
            btn.innerHTML = '<i class="ri-loader-4-line pe-spin"></i> Сохраняем...';

            try {
                const canvas = CanvasManager.getCanvas();
                const config = GarmentManager.getConfig();

                // Сохраняем текущую сторону в sideStates перед экспортом
                sideStates[config.side] = JSON.stringify(canvas.toJSON());

                const previewDataUrl = await ExportManager.generateMockupDataURL();

                // Генерируем превью для другой стороны, если там есть объекты
                let previewDataUrlBack = null;
                const otherSide = config.side === 'front' ? 'back' : 'front';
                if (sideStates[otherSide]) {
                    const parsedOther = JSON.parse(sideStates[otherSide]);
                    if (parsedOther.objects && parsedOther.objects.length > 0) {
                        // Для честности нужно было бы переключить канвас и сделать экспорт, 
                        // но для экономии времени пока сохраним только основное превью или пустую заглушку
                        // В идеале: свитч -> экспорт -> свитч обратно
                    }
                }

                const isDoubleSided = (sideStates.front && JSON.parse(sideStates.front).objects.length > 0) &&
                    (sideStates.back && JSON.parse(sideStates.back).objects.length > 0);

                const res = await ApiClient.saveDesign({
                    garmentType: config.garment,
                    garmentColor: config.color,
                    canvasJson: sideStates.front,
                    canvasJsonBack: sideStates.back,
                    svgData: canvas.toSVG(), // SVG для текущей стороны (упрощение)
                    highresDataUrl: canvas.toDataURL({ format: 'png', multiplier: 4 }),
                    previewDataUrl: previewDataUrl,
                    isDoubleSided: isDoubleSided,
                    printArea: config.config.printArea,
                    title: 'Дизайн ' + new Date().toLocaleString()
                });

                if (res && res.success) {
                    showToast('Дизайн сохранён!', 'success');
                    // Сохраняем ID последнего дизайна в data-атрибут кнопки "В корзину" (опционально)
                    document.getElementById('btn-add-cart').dataset.designId = res.data.design_id;
                } else {
                    showToast(res?.message || 'Ошибка сохранения', 'error');
                }
            } catch (err) {
                console.error(err);
                showToast('Ошибка сохранения', 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="ri-save-line"></i> Сохранить';
            }
        });

        // В корзину (главная кнопка - сохранить текущий)
        document.getElementById('btn-add-cart').addEventListener('click', async () => {
            const modal = document.getElementById('modal-add-options');
            modal.dataset.designId = ''; // Признак того, что нужно сначала сохранить текущий холст
            modal.style.display = 'flex';
        });

        // Подтверждение добавления в корзину из модалки
        document.getElementById('btn-confirm-add-cart').addEventListener('click', async () => {
            const btn = document.getElementById('btn-confirm-add-cart');
            const modal = document.getElementById('modal-add-options');
            const designIdFromDataset = modal.dataset.designId;
            const size = document.getElementById('add-size-select').value;
            const quantity = parseInt(document.getElementById('add-quantity-input').value) || 1;

            btn.disabled = true;
            btn.innerHTML = '<i class="ri-loader-4-line pe-spin"></i> Добавляем...';

            try {
                let designId = designIdFromDataset;

                // Если ID не передан, значит сохраняем текущий холст
                if (!designId) {
                    const canvas = CanvasManager.getCanvas();
                    const config = GarmentManager.getConfig();

                    // Сохраняем текущее состояние холста перед экспортом
                    sideStates[config.side] = JSON.stringify(canvas.toJSON());

                    const previewDataUrl = await ExportManager.generateMockupDataURL();
                    const isDoubleSided = (config.variant === 'both');

                    const resDesign = await ApiClient.saveDesign({
                        garmentType: config.garment,
                        garmentColor: config.color,
                        canvasJson: sideStates.front,
                        canvasJsonBack: sideStates.back,
                        highresDataUrl: canvas.toDataURL({ format: 'png', multiplier: 4 }),
                        previewDataUrl: previewDataUrl,
                        isDoubleSided: isDoubleSided,
                        printArea: config.config.printArea,
                        title: 'Дизайн для корзины'
                    });

                    if (resDesign && resDesign.success) {
                        designId = resDesign.data.design_id;
                    } else {
                        showToast('Ошибка при подготовке дизайна', 'error');
                        return;
                    }
                }

                if (designId) {
                    const resCart = await ApiClient.addToCart(designId, size, quantity);

                    if (resCart && resCart.success) {
                        showToast('Добавлено в корзину!', 'success');
                        modal.style.display = 'none';
                    } else {
                        showToast(resCart?.message || 'Ошибка корзины', 'error');
                    }
                }
            } catch (err) {
                console.error(err);
                showToast('Ошибка добавления', 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = 'Добавить в корзину';
            }
        });
    }

    /**
     * Глобальный drag-and-drop изображений на область canvas
     */
    function _bindGlobalDragDrop() {
        const canvasArea = document.getElementById('canvas-area');

        canvasArea.addEventListener('dragover', function (e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        canvasArea.addEventListener('drop', function (e) {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = function (ev) {
                    const canvas = CanvasManager.getCanvas();
                    fabric.Image.fromURL(ev.target.result, function (img) {
                        const size = CanvasManager.getSize();
                        const maxW = size.width * 0.8;
                        const maxH = size.height * 0.8;
                        const scale = Math.min(maxW / img.width, maxH / img.height, 1);

                        img.set({
                            left: size.width / 2,
                            top: size.height / 2,
                            originX: 'center',
                            originY: 'center',
                            scaleX: scale,
                            scaleY: scale
                        });

                        canvas.add(img);
                        canvas.setActiveObject(img);
                        canvas.renderAll();
                        showToast('Изображение добавлено', 'success');
                    });
                };
                reader.readAsDataURL(file);
            }
        });
    }

    /**
     * Авторизация (вход по email) и модалки
     */
    function _initAuthAndModals() {
        const modalLogin = document.getElementById('modal-login');
        const userAreaGuest = document.getElementById('user-area-guest');
        const userAreaLogged = document.getElementById('user-area-logged');
        const userNameDisplay = document.getElementById('user-name-display');
        const userEmailDisplay = document.getElementById('user-email-display');

        const btnLoginOpen = document.getElementById('btn-login-open');
        const btnRegisterOpen = document.getElementById('btn-register-open');

        const loginForm = document.getElementById('auth-form-login');
        const registerForm = document.getElementById('auth-form-register');
        const linkShowRegister = document.getElementById('link-show-register');
        const linkShowLogin = document.getElementById('link-show-login');

        const btnDoLogin = document.getElementById('btn-do-login');
        const btnDoRegister = document.getElementById('btn-do-register');

        const loginEmailInput = document.getElementById('login-email-input');
        const registerEmailInput = document.getElementById('register-email-input');
        const registerNameInput = document.getElementById('register-name-input');

        const btnUserDropdown = document.getElementById('btn-user-dropdown');
        const dropdownMenu = btnUserDropdown.parentElement;

        const btnMyDesigns = document.getElementById('btn-my-designs');
        const modalDesigns = document.getElementById('modal-designs');
        const btnViewCart = document.getElementById('btn-view-cart');
        const modalCart = document.getElementById('modal-cart');

        const btnMyOrders = document.getElementById('btn-my-orders');
        const btnLogout = document.getElementById('btn-logout');

        // Инициализация из localStorage
        const savedEmail = localStorage.getItem('pe_user_email');
        const savedName = localStorage.getItem('pe_user_name');
        if (savedEmail) {
            _updateAuthUI(savedEmail, savedName);
        }

        function _updateAuthUI(email, name) {
            if (email) {
                userAreaGuest.style.display = 'none';
                userAreaLogged.style.display = 'flex';
                userNameDisplay.textContent = name || 'Пользователь';
                userEmailDisplay.textContent = email;
            } else {
                userAreaGuest.style.display = 'flex';
                userAreaLogged.style.display = 'none';
            }
        }

        // Dropdown toggle
        btnUserDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenu.classList.toggle('pe-dropdown--open');
        });

        document.addEventListener('click', () => {
            dropdownMenu.classList.remove('pe-dropdown--open');
        });

        const authModalTitle = document.getElementById('auth-modal-title');

        // Toggle between Login and Register forms
        linkShowRegister.addEventListener('click', (e) => {
            e.preventDefault();
            loginForm.style.display = 'none';
            registerForm.style.display = 'block';
            authModalTitle.textContent = 'Регистрация';
        });

        linkShowLogin.addEventListener('click', (e) => {
            e.preventDefault();
            registerForm.style.display = 'none';
            loginForm.style.display = 'block';
            authModalTitle.textContent = 'Вход в аккаунт';
        });

        btnLoginOpen.addEventListener('click', () => {
            modalLogin.style.display = 'flex';
            loginForm.style.display = 'block';
            registerForm.style.display = 'none';
            authModalTitle.textContent = 'Вход в аккаунт';
        });

        btnRegisterOpen.addEventListener('click', () => {
            modalLogin.style.display = 'flex';
            loginForm.style.display = 'none';
            registerForm.style.display = 'block';
            authModalTitle.textContent = 'Регистрация';
        });

        // Login
        btnDoLogin.addEventListener('click', async () => {
            const email = loginEmailInput.value.trim();
            if (!email || !email.includes('@')) {
                showToast('Введите корректный email', 'error');
                return;
            }
            try {
                btnDoLogin.disabled = true;
                const res = await ApiClient.createUser(email);
                if (res && res.success) {
                    localStorage.setItem('pe_user_email', res.data.email);
                    localStorage.setItem('pe_user_name', res.data.name || '');
                    _updateAuthUI(res.data.email, res.data.name);
                    modalLogin.style.display = 'none';
                    showToast('С возвращением!', 'success');
                } else {
                    showToast(res?.message || 'Ошибка входа', 'error');
                }
            } catch (error) {
                showToast('Ошибка сети', 'error');
            } finally {
                btnDoLogin.disabled = false;
            }
        });

        // Register
        btnDoRegister.addEventListener('click', async () => {
            const email = registerEmailInput.value.trim();
            const name = registerNameInput.value.trim();
            if (!email || !email.includes('@')) {
                showToast('Введите корректный email', 'error');
                return;
            }
            if (!name) {
                showToast('Введите ваше имя', 'error');
                return;
            }
            try {
                btnDoRegister.disabled = true;
                const res = await ApiClient.createUser(email, name);
                if (res && res.success) {
                    localStorage.setItem('pe_user_email', res.data.email);
                    localStorage.setItem('pe_user_name', res.data.name);
                    _updateAuthUI(res.data.email, res.data.name);
                    modalLogin.style.display = 'none';
                    showToast('Аккаунт создан!', 'success');
                } else {
                    showToast(res?.message || 'Ошибка регистрации', 'error');
                }
            } catch (error) {
                showToast('Ошибка сети', 'error');
            } finally {
                btnDoRegister.disabled = false;
            }
        });

        // Logout
        btnLogout.addEventListener('click', (e) => {
            e.stopPropagation();
            localStorage.removeItem('pe_user_email');
            localStorage.removeItem('pe_user_name');
            _updateAuthUI(null, null);
            showToast('Вы вышли из системы', 'info');
        });

        // My Designs
        btnMyDesigns.addEventListener('click', async () => {
            if (!localStorage.getItem('pe_user_email')) {
                modalLogin.style.display = 'flex';
                showToast('Войдите, чтобы увидеть свои дизайны', 'info');
                return;
            }
            modalDesigns.style.display = 'flex';
            const grid = document.getElementById('designs-grid');
            grid.innerHTML = 'Загрузка...';

            try {
                const res = await ApiClient.listDesigns();
                if (res.success && res.data.length > 0) {
                    grid.innerHTML = res.data.map(d => `
                        <div style="border:1px solid var(--border); border-radius:8px; padding:12px; background:var(--bg-secondary); position:relative; overflow:hidden;">
                            <button class="pe-btn--icon btn-delete-design" data-id="${d.id}" style="position:absolute; top:4px; right:4px; border:none; background:rgba(0,0,0,0.5); color:#fff; border-radius:4px; cursor:pointer; width:28px; height:28px; padding:0; z-index:10;"><i class="ri-delete-bin-line" style="font-size:14px;"></i></button>
                            <img src="${d.preview_path}" alt="Мокап" style="width:100%; height:auto; border-radius:4px; margin-bottom:8px; background: var(--bg-tertiary);">
                            <div style="font-weight:500; margin-bottom:4px; max-width:140px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${d.title || 'Без названия'}">${d.title || 'Без названия'}</div>
                            <div style="font-size:12px; color:var(--text-muted); margin-bottom:12px;">${d.garment_type}</div>
                            
                            <div style="display:flex; gap:8px;">
                                <button class="pe-btn pe-btn--sm pe-btn--primary btn-load-design" style="flex:1;" data-id="${d.id}">Загрузить</button>
                                <button class="pe-btn pe-btn--sm pe-btn--success btn-add-cart-from-design" style="flex:1;" data-id="${d.id}"><i class="ri-shopping-cart-2-line"></i></button>
                            </div>
                        </div>
                    `).join('');

                    modalDesigns._loadedDesigns = res.data;

                    // Привязка событий кнопок
                    grid.querySelectorAll('.btn-load-design').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            const id = e.currentTarget.dataset.id;
                            const data = modalDesigns._loadedDesigns.find(x => x.id == id);
                            if (!data) return;

                            if (GarmentManager.setGarment) {
                                // При смене дизайна или одежды — сбрасываем локальные состояния сторон
                                sideStates.front = null;
                                sideStates.back = null;
                                GarmentManager.setGarment(data.garment_type);
                            }
                            if (GarmentManager.setColor) GarmentManager.setColor(data.garment_color);
                            setTimeout(() => {
                                const canvas = CanvasManager.getCanvas();
                                let canvasData = data.canvas_json;
                                if (!canvasData) {
                                    showToast('Дизайн пуст', 'info');
                                    modalDesigns.style.display = 'none';
                                    return;
                                }
                                canvas.loadFromJSON(canvasData, () => {
                                    canvas.renderAll();
                                    CanvasManager.saveState && CanvasManager.saveState();
                                    modalDesigns.style.display = 'none';
                                    showToast('Дизайн загружен!', 'success');
                                });
                            }, 400); // Дадим время загрузить одежду
                        });
                    });

                    grid.querySelectorAll('.btn-add-cart-from-design').forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                            const id = e.currentTarget.dataset.id;
                            const modal = document.getElementById('modal-add-options');
                            modal.dataset.designId = id;
                            modal.style.display = 'flex';
                        });
                    });

                    grid.querySelectorAll('.btn-delete-design').forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                            const curBtn = e.currentTarget;
                            const id = curBtn.dataset.id;
                            const confirmed = await DialogService.confirm('Удаление дизайна', 'Вы уверены, что хотите удалить этот дизайн?', 'Удалить', 'Отмена', true);
                            if (!confirmed) return;
                            curBtn.disabled = true;
                            try {
                                const res = await ApiClient.deleteDesign(id);
                                if (res.success) {
                                    showToast('Дизайн удален!', 'info');
                                    // Refresh designs list
                                    btnMyDesigns.click();
                                } else {
                                    showToast(res.message || 'Ошибка удаления', 'error');
                                    e.currentTarget.disabled = false;
                                }
                            } catch (err) {
                                showToast('Сетевая ошибка', 'error');
                                e.currentTarget.disabled = false;
                            }
                        });
                    });

                } else {
                    grid.innerHTML = 'У вас пока нет сохранённых дизайнов.';
                }
            } catch (err) {
                grid.innerHTML = 'Ошибка загрузки дизайнов.';
            }
        });

        const modalOrders = document.getElementById('modal-orders');
        btnMyOrders.addEventListener('click', async () => {
            const email = localStorage.getItem('pe_user_email');
            if (!email) {
                modalLogin.style.display = 'flex';
                showToast('Войдите, чтобы увидеть свои заказы', 'info');
                return;
            }
            modalOrders.style.display = 'flex';
            const list = document.getElementById('orders-list');
            list.innerHTML = 'Загрузка...';
            try {
                const res = await ApiClient.listMyOrders(email);
                if (res.success && res.data.length > 0) {
                    const statusMap = {
                        new: { label: 'Новый', color: '#7c5ce0' },
                        confirmed: { label: 'Подтверждён', color: '#27ae60' },
                        processing: { label: 'В обработке', color: '#3498db' },
                        printing: { label: 'Печать', color: '#e67e22' },
                        ready: { label: 'Готов', color: '#16a085' },
                        shipped: { label: 'Отправлен', color: '#2980b9' },
                        done: { label: 'Завершён', color: '#2ecc71' },
                        cancelled: { label: 'Отменён', color: '#e74c3c' },
                    };
                    list.innerHTML = res.data.map(o => {
                        const status = statusMap[o.status] || { label: o.status, color: '#888' };
                        const itemsHtml = (o.items || []).map(i => `
                            <div style="width:60px; height:60px; background:var(--bg-tertiary); border-radius:8px; border:1px solid var(--border); overflow:hidden; display:flex; align-items:center; justify-content:center; padding:4px;">
                                <img src="/${i.preview_path}" style="max-width:100%; max-height:100%; object-fit:contain;" title="${i.title || i.garment_type}">
                            </div>
                        `).join('');

                        return `
                            <div style="border:1px solid var(--border); border-radius:16px; padding:20px; background:var(--bg-secondary); margin-bottom:16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); position:relative;">
                                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; border-bottom:1px solid var(--border); padding-bottom:12px;">
                                    <div>
                                        <div style="font-weight:700; font-size:16px; margin-bottom:4px; color:var(--text-primary);">Заказ #${o.order_number}</div>
                                        <div style="font-size:12px; color:var(--text-muted); display:flex; align-items:center; gap:4px;">
                                            <i class="ri-calendar-line"></i> ${new Date(o.created_at).toLocaleString('ru-RU')}
                                        </div>
                                    </div>
                                    <span style="font-size:11px; font-weight:700; text-transform:uppercase; color:#fff; background:${status.color}; padding:6px 12px; border-radius:30px; letter-spacing:0.8px; box-shadow: 0 4px 10px ${status.color}44;">
                                        ${status.label}
                                    </span>
                                </div>
                                <div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:16px;">
                                    ${itemsHtml}
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px; color:var(--text-muted);">
                                    <span style="background:var(--bg-tertiary); padding:4px 10px; border-radius:8px;">Позиций: <strong>${o.total_items}</strong></span>
                                </div>
                            </div>
                        `;
                    }).join('');
                } else {
                    list.innerHTML = 'У вас пока нет заказов.';
                }
            } catch (e) {
                list.innerHTML = 'Ошибка загрузки заказов.';
            }
        });


        // Cart
        btnViewCart.addEventListener('click', loadCartData);

        async function loadCartData() {
            if (!localStorage.getItem('pe_user_email')) {
                modalLogin.style.display = 'flex';
                showToast('Войдите, чтобы открыть корзину', 'info');
                return;
            }
            modalCart.style.display = 'flex';
            const body = document.getElementById('cart-body');
            const clearBtn = document.getElementById('btn-clear-cart');
            const totalDisplay = document.getElementById('cart-total-price');
            body.innerHTML = 'Загрузка...';

            try {
                const res = await ApiClient.getCart();
                if (res.success && res.data.items && res.data.items.length > 0) {
                    clearBtn.style.display = 'block';
                    const checkoutBtn = document.getElementById('btn-checkout');
                    if (checkoutBtn) checkoutBtn.disabled = false;
                    let totalPrice = 0;

                    body.innerHTML = res.data.items.map(i => {
                        const itemTotal = (i.price || 0) * (i.quantity || 1);
                        totalPrice += itemTotal;

                        return `
                        <div class="cart-item" style="display:flex; align-items:center; gap:20px; border-bottom:1px solid var(--color-border); padding:24px 0;" data-id="${i.id}">
                            <div style="position:relative; width:110px; height:110px; background:var(--color-bg-tertiary); border-radius:12px; border:1px solid var(--color-border); display:flex; align-items:center; justify-content:center; padding:8px;">
                                <img src="/${i.preview_path}" style="max-width:100%; max-height:100%; object-fit:contain;">
                                ${i.is_double_sided ? '<div style="position:absolute; bottom:-8px; right:-8px; background:var(--color-primary); color:#fff; font-size:9px; font-weight:800; padding:4px 8px; border-radius:20px; border:2px solid var(--color-bg-secondary);">2 СТОРОНЫ</div>' : ''}
                            </div>
                            <div style="flex:1; display:flex; flex-direction:column; gap:12px;">
                                <div style="font-weight:700; font-size:16px;">${i.title || 'Пользовательский дизайн'}</div>
                                
                                <div style="display:flex; gap:24px; align-items:center;">
                                    <div style="display:flex; flex-direction:column; gap:4px;">
                                        <span style="font-size:11px; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:0.02em; font-weight:600;">Размер</span>
                                        <select class="pe-select pe-select--sm cart-item-size" style="width:80px; height:32px; padding:0 8px; font-size:13px; background:var(--color-bg-tertiary);">
                                            ${['XS', 'S', 'M', 'L', 'XL', 'XXL'].map(s => `<option value="${s}" ${i.size === s ? 'selected' : ''}>${s}</option>`).join('')}
                                        </select>
                                    </div>
                                    <div style="display:flex; flex-direction:column; gap:4px;">
                                        <span style="font-size:11px; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:0.02em; font-weight:600;">Количество</span>
                                        <input type="number" class="pe-input pe-input--sm cart-item-qty" value="${i.quantity}" min="1" max="99" style="width:70px; height:32px; text-align:center; font-size:13px; background:var(--color-bg-tertiary);">
                                    </div>
                                    <div style="flex:1; text-align:right; align-self:flex-end;">
                                        <div style="font-size:12px; color:var(--color-text-muted); margin-bottom:2px;">Цена: ${i.price.toLocaleString()} ֏</div>
                                        <div style="font-weight:800; font-size:20px; color:var(--color-primary);">${itemTotal.toLocaleString()} ֏</div>
                                    </div>
                                </div>
                            </div>
                            <button class="pe-btn pe-btn--danger pe-btn--icon pe-btn--sm btn-remove-cart-item" data-id="${i.id}" style="border-radius:10px; align-self: flex-start;">
                                <i class="ri-delete-bin-line" style="font-size:18px;"></i>
                            </button>
                        </div>
                    `;
                    }).join('');

                    if (totalDisplay) totalDisplay.textContent = `${totalPrice.toLocaleString()} ֏`;

                    // События для изменения размера
                    body.querySelectorAll('.cart-item-size').forEach(select => {
                        select.addEventListener('change', async (e) => {
                            const itemId = e.target.closest('.cart-item').dataset.id;
                            const newSize = e.target.value;
                            await ApiClient.updateCartItem(itemId, { size: newSize });
                            showToast('Размер обновлен', 'success');
                            loadCartData();
                        });
                    });

                    // События для изменения количества
                    body.querySelectorAll('.cart-item-qty').forEach(input => {
                        input.addEventListener('change', async (e) => {
                            const itemId = e.target.closest('.cart-item').dataset.id;
                            const newQty = parseInt(e.target.value) || 1;
                            await ApiClient.updateCartItem(itemId, { quantity: newQty });
                            showToast('Количество обновлено', 'success');
                            loadCartData();
                        });
                    });

                    body.querySelectorAll('.btn-remove-cart-item').forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                            const curBtn = e.currentTarget;
                            const id = curBtn.dataset.id;
                            const confirmed = await DialogService.confirm('Удаление', 'Точно удалить этот товар из корзины?', 'Удалить', 'Отмена', true);
                            if (!confirmed) return;
                            curBtn.disabled = true;
                            await ApiClient.removeFromCart(id);
                            loadCartData();
                            showToast('Товар удалён', 'info');
                        });
                    });

                } else {
                    body.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">Корзина пока пуста.</div>';
                    clearBtn.style.display = 'none';
                    const checkoutBtn = document.getElementById('btn-checkout');
                    if (checkoutBtn) checkoutBtn.disabled = true;
                    if (totalDisplay) totalDisplay.textContent = '0 ֏';
                }
            } catch (err) {
                body.innerHTML = 'Ошибка загрузки корзины.';
                clearBtn.style.display = 'none';
            }
        }

        // Очистить корзину
        document.getElementById('btn-clear-cart').addEventListener('click', async () => {
            const confirmed = await DialogService.confirm('Очистка корзины', 'Вы действительно хотите удалить все товары?', 'Очистить', 'Отмена', true);
            if (!confirmed) return;
            await ApiClient.clearCart();
            loadCartData();
            showToast('Корзина очищена', 'info');
        });

        // Оформить заказ
        document.getElementById('btn-checkout').addEventListener('click', async () => {
            const btnCheckout = document.getElementById('btn-checkout');
            btnCheckout.disabled = true;
            btnCheckout.textContent = 'Оформление...';
            try {
                // Вызываем API для создания заказа. Берем email из localStorage.
                const userEmail = localStorage.getItem('pe_user_email');
                const userName = localStorage.getItem('pe_user_name') || 'Пользователь PrintEditor';
                const res = await ApiClient.createOrder({
                    name: userName,
                    email: userEmail,
                    phone: '',
                    address: '',
                    notes: 'Оформлено из веб-корзины'
                });

                if (res && res.success) {
                    showToast('Заказ успешно оформлен!', 'success');
                    modalCart.style.display = 'none';
                    // Очищаем корзину визуально, так как сервер уже её очистил
                    const body = document.getElementById('cart-body');
                    body.innerHTML = 'Корзина пуста.';
                } else {
                    showToast(res?.message || 'Ошибка оформления заказа', 'error');
                }
            } catch (err) {
                showToast('Ошибка оформления заказа', 'error');
            }
            btnCheckout.disabled = false;
            btnCheckout.textContent = 'Оформить заказ';
        });
    }

    /**
     * Показать toast-уведомление
     * @param {string} message — текст
     * @param {string} type — 'success' | 'error' | 'info'
     */
    function showToast(message, type) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = 'pe-toast';
        if (type) {
            toast.classList.add('pe-toast--' + type);
        }
        toast.classList.add('pe-toast--visible');

        setTimeout(() => {
            toast.classList.remove('pe-toast--visible');
        }, 2000);
    }

    /**
     * Вызывается при смене стороны (перед/зад)
     */
    async function onSideChange(oldSide, newSide) {
        const canvas = CanvasManager.getCanvas();
        if (!canvas) return;

        // 1. Сохраняем текущее состояние в хранилище
        sideStates[oldSide] = JSON.stringify(canvas.toJSON());

        // 2. Очищаем холст
        canvas.clear();
        canvas.backgroundColor = 'transparent';

        // 3. Загружаем сохранённое состояние для новой стороны
        if (sideStates[newSide]) {
            return new Promise(resolve => {
                canvas.loadFromJSON(sideStates[newSide], () => {
                    canvas.renderAll();
                    updatePrice();
                    resolve();
                });
            });
        } else {
            updatePrice();
        }
    }

    /**
     * Алиас для совместимости
     */
    function updateStatus() {
        updatePrice();
    }

    /**
     * Расчёт и обновление цены
     */
    function updatePrice() {
        const config = GarmentManager.getConfig();
        if (!config || !config.config) return;

        const price = config.config.price || { oneSide: 1500, twoSides: 2500 };

        let finalPrice = price.oneSide;

        // РАСЧЁТ ЦЕНЫ:
        // Если выбран 'both', то цена суммируется (Front + Back)
        if (config.variant === 'both') {
            finalPrice = price.oneSide + price.twoSides;
        } else {
            // Иначе — цена за одну сторону
            finalPrice = price.oneSide;
        }

        const priceDisplay = document.getElementById('current-price-display');
        if (priceDisplay) {
            priceDisplay.textContent = `${finalPrice} ֏`;
            // Анимация при смене цены (только если цена изменилась)
            if (priceDisplay.dataset.lastPrice != finalPrice) {
                priceDisplay.style.transform = 'scale(1.1)';
                setTimeout(() => priceDisplay.style.transform = 'scale(1)', 100);
                priceDisplay.dataset.lastPrice = finalPrice;
            }
        }
    }

    function resetSideStates() {
        sideStates.front = null;
        sideStates.back = null;
        if (CanvasManager.getCanvas()) {
            CanvasManager.clearCanvas();
        }
        updatePrice();
    }

    // Запуск при загрузке DOM
    document.addEventListener('DOMContentLoaded', init);

    // Public API
    return {
        showToast,
        updateStatus,
        toggleTheme,
        onSideChange,
        updatePrice,
        resetSideStates
    };

})();
