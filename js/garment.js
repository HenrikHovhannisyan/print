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

    let currentGarment = 'tshirt';
    let currentColor = '#ffffff';

    // DOM-элементы
    let garmentImage = null;
    let garmentOverlay = null;
    let canvasWrap = null;
    let selectorCards = null;
    let colorSwatches = null;

    /**
     * Инициализация модуля (асинхронная)
     */
    async function init() {
        garmentImage = document.getElementById('garment-image');
        garmentOverlay = document.getElementById('garment-overlay');
        canvasWrap = document.getElementById('canvas-wrap');

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
        } else {
            // Установка первого элемента по умолчанию
            currentGarment = Object.keys(GARMENT_CONFIG)[0];
        }

        // Динамическая генерация карточек одежды
        _buildGarmentCards();

        selectorCards = document.querySelectorAll('.pe-garment-card');
        colorSwatches = document.querySelectorAll('#garment-colors .pe-swatch');

        _bindEvents();

        // Предзагрузка и удаление фона у всех шаблонов одежды
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

            BgRemover.removeBackground(config.image)
                .then(processedUrl => {
                    // Обновляем превью-карточку (убираем зелёный фон)
                    const thumb = document.getElementById('garment-thumb-' + key);
                    if (thumb) {
                        thumb.src = processedUrl;
                    }

                    // Если это текущая одежда — обновляем и основное изображение
                    if (key === currentGarment) {
                        garmentImage.src = processedUrl;
                        _updatePrintArea();
                    }
                })
                .catch(err => console.warn('Ошибка обработки фона (' + key + '):', err));
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

        // Обновление позиции области печати при ресайзе
        window.addEventListener('resize', _updatePrintArea);

        // Ожидание загрузки изображения
        garmentImage.addEventListener('load', _updatePrintArea);
    }

    /**
     * Установка типа одежды
     * @param {string} type — ключ из GARMENT_CONFIG
     */
    function setGarment(type) {
        if (!GARMENT_CONFIG[type]) return;

        currentGarment = type;
        const config = GARMENT_CONFIG[type];

        // Используем обработанное изображение (без фона) из кэша,
        // или обрабатываем на лету если кэша нет
        const cached = BgRemover.getCached(config.image);
        if (cached) {
            garmentImage.src = cached;
        } else {
            // Пока загружаем оригинал, параллельно обрабатываем фон
            garmentImage.src = config.image;
            BgRemover.removeBackground(config.image)
                .then(processedUrl => {
                    // Проверяем, что одежда всё ещё та же
                    if (currentGarment === type) {
                        garmentImage.src = processedUrl;
                    }
                })
                .catch(err => console.warn('Ошибка обработки фона:', err));
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
            // Задержка, чтобы изображение успело загрузиться
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
        const cachedUrl = BgRemover.getCached(config.image);
        const srcUrl = cachedUrl || config.image;

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

            const pa = config.printArea;

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
            const cached = BgRemover.getCached(config.image);
            const src = cached || config.image;

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
        setColor,
        getConfig,
        getPrintAreaSize,
        getProcessedGarmentImage,
        GARMENT_CONFIG,
        GARMENT_COLORS
    };

})();
