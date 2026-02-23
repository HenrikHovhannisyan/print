/**
 * PrintEditor — Garment Module
 * Управление типом одежды, цветом и позицией области печати
 */

const GarmentManager = (function () {
    'use strict';

    // Конфигурация типов одежды: загружается с сервера
    let GARMENT_CONFIG = {};

    // Предустановленные цвета одежды
    const GARMENT_COLORS = [
        '#ffffff', '#111111', '#1a1a2e', '#c0392b',
        '#2980b9', '#27ae60', '#f39c12', '#8e44ad',
        '#e8d5b7', '#7f8c8d', '#e91e63', '#00bcd4'
    ];

    let currentGarment = null;
    let currentColor = '#ffffff';
    let currentSide = 'front'; // 'front' | 'back'
    let currentVariant = null; // 'front' | 'back' | 'both'
    let pendingGarment = null;

    // DOM-элементы
    let garmentImage = null;
    let garmentOverlay = null;
    let canvasWrap = null;
    let selectorCards = null;
    let colorSwatches = null;
    let btnSideFront = null;
    let btnSideBack = null;
    let priceDisplay = null;

    /**
     * Инициализация модуля (асинхронная)
     */
    async function init() {
        garmentImage = document.getElementById('garment-image');
        garmentOverlay = document.getElementById('garment-overlay');
        canvasWrap = document.getElementById('canvas-wrap');
        btnSideFront = document.getElementById('btn-side-front');
        btnSideBack = document.getElementById('btn-side-back');
        priceDisplay = document.getElementById('current-price-display');

        try {
            const apiRes = await ApiClient.listActiveGarments();
            if (apiRes && apiRes.success) {
                GARMENT_CONFIG = apiRes.data;
            } else {
                console.error('Failed to load garments from API', apiRes?.message);
            }
        } catch (e) {
            console.error('API Error loading garments:', e);
        }

        if (Object.keys(GARMENT_CONFIG).length === 0) {
            console.warn('No garments loaded, falling back to empty config');
        }

        // Прячем рабочую область до выбора одежды
        const workspace = document.getElementById('workspace');
        if (workspace) workspace.style.opacity = '0';

        // Динамическая генерация карточек одежды
        _buildGarmentCards();

        selectorCards = document.querySelectorAll('.pe-garment-card');
        colorSwatches = document.querySelectorAll('#garment-colors .pe-swatch');

        _bindEvents();

        // Не выбираем ничего автоматически. Пользователь должен кликнуть сам.

        // Предзагрузка и удаление фона у всех шаблонов одежды (и фронт, и бэк)
        _preloadAndProcessGarments();
    }

    /**
     * Динамическое создание карточек одежды из GARMENT_CONFIG
     */
    function _buildGarmentCards() {
        const selector = document.getElementById('garment-selector');
        if (!selector) return;

        // Очищаем статичные карточки
        selector.innerHTML = '';

        // Генерируем карточки из конфига
        Object.keys(GARMENT_CONFIG).forEach(key => {
            const config = GARMENT_CONFIG[key];
            const card = document.createElement('div');
            card.className = 'pe-garment-card' + (key === currentGarment ? ' pe-garment-card--active' : '');
            card.dataset.garment = key;

            const img = document.createElement('img');
            img.src = config.image;
            img.alt = config.name;
            img.id = 'garment-thumb-' + key;

            const span = document.createElement('span');
            span.textContent = config.name;

            card.appendChild(img);
            card.appendChild(span);
            selector.appendChild(card);
        });
    }

    /**
     * Предзагрузка всех изображений одежды и удаление зелёного фона.
     * После обработки — обновляем и превью-карточки, и основное изображение.
     */
    function _preloadAndProcessGarments() {
        Object.keys(GARMENT_CONFIG).forEach(key => {
            const config = GARMENT_CONFIG[key];

            // Обрабатываем перед
            BgRemover.removeBackground(config.image)
                .then(processedUrl => {
                    const thumb = document.getElementById('garment-thumb-' + key);
                    if (thumb) thumb.src = processedUrl;
                    if (key === currentGarment && currentSide === 'front') {
                        garmentImage.src = processedUrl;
                        _updatePrintArea();
                    }
                })
                .catch(err => console.warn('Ошибка обработки фона (перед ' + key + '):', err));

            // Обрабатываем зад
            if (config.imageBack) {
                BgRemover.removeBackground(config.imageBack)
                    .then(processedUrl => {
                        if (key === currentGarment && currentSide === 'back') {
                            garmentImage.src = processedUrl;
                            _updatePrintArea();
                        }
                    })
                    .catch(err => console.warn('Ошибка обработки фона (зад ' + key + '):', err));
            }
        });
    }

    /**
     * Привязка событий
     */
    function _bindEvents() {
        // Выбор типа одежды
        selectorCards.forEach(card => {
            card.addEventListener('click', function () {
                const garmentType = this.dataset.garment;
                setGarment(garmentType);
            });
        });

        // Выбор цвета одежды
        colorSwatches.forEach(swatch => {
            swatch.addEventListener('click', function () {
                const color = this.dataset.color;
                setColor(color);
            });
        });

        // Выбор стороны
        if (btnSideFront) {
            btnSideFront.addEventListener('click', () => setSide('front'));
        }
        if (btnSideBack) {
            btnSideBack.addEventListener('click', () => setSide('back'));
        }

        // Обновление позиции области печати при ресайзе
        window.addEventListener('resize', _updatePrintArea);

        // Ожидание загрузки изображения
        garmentImage.addEventListener('load', _updatePrintArea);
    }

    /**
     * Обновление состояния кнопок выбора стороны
     */
    function _updateSideButtons() {
        if (btnSideFront) btnSideFront.classList.toggle('pe-btn--active', currentSide === 'front');
        if (btnSideBack) btnSideBack.classList.toggle('pe-btn--active', currentSide === 'back');
    }

    /**
     * Установка типа одежды
     * @param {string} type — ключ из GARMENT_CONFIG
     */
    function setGarment(type) {
        if (!GARMENT_CONFIG[type]) return;
        pendingGarment = type;

        // Показываем модальное окно выбора стороны
        const modal = document.getElementById('side-selection-modal');
        if (modal) {
            modal.style.display = 'flex';

            const config = GARMENT_CONFIG[type];
            const p1 = config.price ? config.price.oneSide : 1500;
            const p2 = config.price ? config.price.twoSides : 2500;

            document.getElementById('variant-price-front').textContent = p1 + ' ֏';
            document.getElementById('variant-price-back').textContent = p1 + ' ֏';
            document.getElementById('variant-price-both').textContent = (p1 + p2) + ' ֏';

            // Проверяем наличие задней стороны для скрытия опций
            const hasBack = !!config.imageBack;
            const optBack = document.getElementById('variant-option-back');
            const optBoth = document.getElementById('variant-option-both');

            if (optBack) optBack.style.display = hasBack ? 'block' : 'none';
            if (optBoth) optBoth.style.display = hasBack ? 'block' : 'none';
        } else {
            // Если модалки нет — просто ставим вариант по умолчанию
            setVariant('both');
        }
    }

    /**
     * Закрыть модалку выбора стороны
     */
    function closeVariantModal() {
        const modal = document.getElementById('side-selection-modal');
        if (modal) modal.style.display = 'none';
        pendingGarment = null;
    }

    /**
     * Выбор варианта печати (Фронт / Бэк / Оба)
     */
    function setVariant(variant) {
        if (!pendingGarment && !currentGarment) return;

        const type = pendingGarment || currentGarment;
        currentVariant = variant;

        if (currentGarment !== type) {
            currentGarment = type;
            if (typeof App !== 'undefined' && App.resetSideStates) {
                App.resetSideStates();
            }
        }

        const config = GARMENT_CONFIG[type];
        closeVariantModal();

        // Показываем рабочую область
        const workspace = document.getElementById('workspace');
        const placeholder = document.getElementById('workspace-placeholder');
        if (workspace) {
            workspace.style.opacity = '1';
            workspace.style.pointerEvents = 'auto';
        }
        if (placeholder) {
            placeholder.style.display = 'none';
        }

        const priceTag = document.getElementById('price-tag-container');
        if (priceTag) priceTag.style.display = 'flex';

        // Включаем кнопки действий
        ['btn-export', 'btn-save-design', 'btn-add-cart', 'btn-clear-canvas'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.disabled = false;
        });

        // Устанавливаем сторону по умолчанию для этого варианта
        if (variant === 'back') {
            currentSide = 'back';
        } else {
            currentSide = 'front';
        }

        _updateSideButtons();
        _updateToggleVisibility(config);

        const sideImg = (currentSide === 'back' && config.imageBack) ? config.imageBack : config.image;

        const cached = BgRemover.getCached(sideImg);
        if (cached) {
            garmentImage.src = cached;
        } else {
            garmentImage.src = sideImg;
            BgRemover.removeBackground(sideImg)
                .then(processedUrl => {
                    if (currentGarment === type) {
                        garmentImage.src = processedUrl;
                    }
                });
        }
        garmentImage.alt = config.name;

        // Обновляем активную карточку
        selectorCards.forEach(card => {
            card.classList.toggle('pe-garment-card--active', card.dataset.garment === type);
        });

        // Пересчитываем область печати
        _updatePrintArea();

        // Применяем текущий цвет к новой одежде
        if (currentColor !== '#ffffff') {
            garmentImage.addEventListener('load', function onLoad() {
                garmentImage.removeEventListener('load', onLoad);
                _applyColorToGarment();
            });
        }

        // Обновляем статус
        if (typeof App !== 'undefined' && App.updateStatus) {
            App.updateStatus();
        }
    }

    /**
     * Обновление видимости переключателя стороны в зависимости от выбранного варианта
     * @param {object} config - Конфигурация текущей одежды
     */
    function _updateToggleVisibility(config) {
        if (!config) return;

        const toggleContainer = document.getElementById('side-toggle-container');
        if (!toggleContainer) return;

        // Если выбран вариант "Обе стороны", показываем переключатель
        if (currentVariant === 'both') {
            toggleContainer.style.display = 'flex';
        } else {
            // Если выбран только Фронт или только Бэк — скрываем переключатель
            toggleContainer.style.display = 'none';
        }
    }

    /**
     * Установка стороны (перед/зад)
     */
    async function setSide(side) {
        if (currentSide === side) return;

        // Если выбран вариант "только перед" или "только зад", не позволяем переключать
        if (currentVariant === 'front' && side === 'back') return;
        if (currentVariant === 'back' && side === 'front') return;

        const oldSide = currentSide;
        currentSide = side;

        // Оповещаем App, чтобы сохранить состояние холста
        if (typeof App !== 'undefined' && App.onSideChange) {
            await App.onSideChange(oldSide, side);
        }

        _updateSideButtons();

        // Обновляем картинку и область печати
        const config = GARMENT_CONFIG[currentGarment];
        if (!config) return;

        const sideImg = (currentSide === 'back' && config.imageBack) ? config.imageBack : config.image;

        // Показываем лоадер (понижаем прозрачность)
        garmentImage.style.opacity = '0.5';

        try {
            const processedUrl = await BgRemover.removeBackground(sideImg);
            // Проверяем, не переключил ли пользователь сторону пока мы обрабатывали
            if (currentSide === side) {
                garmentImage.src = processedUrl;
                _applyColorToGarment();
            }
        } catch (err) {
            console.error('Ошибка при смене стороны:', err);
            if (currentSide === side) {
                garmentImage.src = sideImg;
                _applyColorToGarment();
            }
        } finally {
            if (currentSide === side) {
                garmentImage.style.opacity = '1';
                _updatePrintArea();
                if (typeof App !== 'undefined' && App.updateStatus) {
                    App.updateStatus();
                }
            }
        }
    }

    /**
     * Установка цвета одежды
     * Колоризация через offscreen canvas (multiply + destination-in)
     * для сохранения прозрачной маски одежды
     * @param {string} color — hex-цвет
     */
    function setColor(color) {
        currentColor = color;

        // Обновляем активный swatch
        colorSwatches.forEach(swatch => {
            swatch.classList.toggle('pe-swatch--active', swatch.dataset.color === color);
        });

        // Перерисовываем одежду с новым цветом
        _applyColorToGarment();
    }

    /**
     * Применение цвета к изображению одежды через offscreen canvas
     * Алгоритм:
     * 1. Берём оригинальное (без фона) изображение из кэша BgRemover
     * 2. Если цвет белый — показываем оригинал
     * 3. Иначе: multiply-наложение цвета + маска прозрачности (destination-in)
     */
    function _applyColorToGarment() {
        const config = GARMENT_CONFIG[currentGarment];
        const sideImg = (currentSide === 'back' && config.imageBack) ? config.imageBack : config.image;
        const cachedUrl = BgRemover.getCached(sideImg);
        const srcUrl = cachedUrl || sideImg;

        // Если цвет белый — просто показываем оригинал
        if (currentColor === '#ffffff') {
            garmentImage.src = srcUrl;
            return;
        }

        // Загружаем оригинальное изображение для обработки
        const tempImg = new Image();
        tempImg.onload = function () {
            const offCanvas = document.createElement('canvas');
            const ctx = offCanvas.getContext('2d');
            offCanvas.width = tempImg.naturalWidth;
            offCanvas.height = tempImg.naturalHeight;

            // Шаг 1: Рисуем исходное изображение
            ctx.drawImage(tempImg, 0, 0);

            // Шаг 2: Multiply-наложение цвета
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = currentColor;
            ctx.fillRect(0, 0, offCanvas.width, offCanvas.height);

            // Шаг 3: Восстанавливаем прозрачность по маске оригинала
            ctx.globalCompositeOperation = 'destination-in';
            ctx.drawImage(tempImg, 0, 0);

            // Шаг 4: Возвращаем нормальный режим
            ctx.globalCompositeOperation = 'source-over';

            // Обновляем <img> на странице
            garmentImage.src = offCanvas.toDataURL('image/png');
        };
        tempImg.src = srcUrl;
    }

    /**
     * Пересчёт позиции и размера области печати на холсте
     * Вызывается при смене одежды, ресайзе окна, загрузке изображения
     */
    function _updatePrintArea() {
        const config = GARMENT_CONFIG[currentGarment];
        if (!config || !garmentImage) return;

        // Используем requestAnimationFrame для точных размеров после рендера
        requestAnimationFrame(() => {
            const imgRect = garmentImage.getBoundingClientRect();
            // canvas-wrap позиционируется absolute от #workspace
            const workspace = document.getElementById('workspace');
            if (!workspace) return;
            const workspaceRect = workspace.getBoundingClientRect();

            // Получаем реальный коэффициент масштабирования DOM-дерева:
            const scale = (imgRect.width / garmentImage.offsetWidth) || 1;

            const pa = currentSide === 'back' ? config.printAreaBack : config.printArea;

            // Вычисляем реальные, неискаженные зумом координаты:
            const unscaledTop = (imgRect.top - workspaceRect.top) / scale;
            const unscaledLeft = (imgRect.left - workspaceRect.left) / scale;
            const unscaledImgW = garmentImage.offsetWidth;
            const unscaledImgH = garmentImage.offsetHeight;

            const top = unscaledTop + (pa.top / 100) * unscaledImgH;
            const left = unscaledLeft + (pa.left / 100) * unscaledImgW;
            const width = (pa.width / 100) * unscaledImgW;
            const height = (pa.height / 100) * unscaledImgH;

            canvasWrap.style.top = top + 'px';
            canvasWrap.style.left = left + 'px';
            canvasWrap.style.width = Math.round(width) + 'px';
            canvasWrap.style.height = Math.round(height) + 'px';

            // Уведомляем CanvasManager о новом размере
            if (typeof CanvasManager !== 'undefined' && CanvasManager.resize) {
                CanvasManager.resize(Math.round(width), Math.round(height));
            }
        });
    }

    /**
     * Получить текущую конфигурацию
     */
    function getConfig() {
        return {
            garment: currentGarment,
            color: currentColor,
            side: currentSide,
            variant: currentVariant,
            config: GARMENT_CONFIG[currentGarment]
        };
    }

    /**
     * Получить размер области печати в пикселях
     */
    function getPrintAreaSize() {
        return {
            width: canvasWrap.offsetWidth,
            height: canvasWrap.offsetHeight
        };
    }

    /**
     * Получить обработанное (без фона) изображение текущей одежды как Image
     * @returns {Promise<HTMLImageElement>}
     */
    function getProcessedGarmentImage() {
        return new Promise((resolve, reject) => {
            const config = GARMENT_CONFIG[currentGarment];
            if (!config) return reject('No garment config');

            const sideImg = (currentSide === 'back' && config.imageBack) ? config.imageBack : config.image;
            const cached = BgRemover.getCached(sideImg);
            const src = cached || sideImg;

            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Не удалось загрузить изображение'));
            img.src = src;
        });
    }



    // Public API
    return {
        init,
        setGarment,
        setVariant,
        closeVariantModal,
        setSide,
        setColor,
        getConfig,
        getPrintAreaSize,
        getProcessedGarmentImage,
        GARMENT_CONFIG,
        GARMENT_COLORS
    };

})();
