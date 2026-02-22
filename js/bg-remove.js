/**
 * PrintEditor — Background Removal Module
 * Удаление зелёного хромакей-фона из изображений одежды
 * 
 * Алгоритм: анализируем каждый пиксель, если он "достаточно зелёный"
 * (высокий G-канал, низкие R и B) — делаем его прозрачным.
 * Также обрабатываем полупрозрачные края для плавного перехода.
 */

const BgRemover = (function () {
    'use strict';

    /**
     * Кэш обработанных изображений — чтобы не пересчитывать каждый раз
     * Ключ: URL изображения, Значение: dataURL обработанного изображения
     */
    const cache = {};

    /**
     * Порог определения "зелёного" пикселя.
     * Чем выше значение, тем агрессивнее удаление.
     * Диапазон: 0-255
     */
    const GREEN_THRESHOLD = 100;

    /**
     * Минимальное соотношение G/(R+B) для определения зелёного
     */
    const GREEN_RATIO = 1.2;

    /**
     * Удалить хромакей-фон из изображения
     * @param {string} imageUrl — путь к изображению
     * @returns {Promise<string>} — dataURL обработанного изображения (PNG с прозрачностью)
     */
    function removeBackground(imageUrl) {
        return new Promise((resolve, reject) => {
            // Проверяем кэш
            if (cache[imageUrl]) {
                resolve(cache[imageUrl]);
                return;
            }

            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = function () {
                try {
                    const result = _processImage(img);
                    cache[imageUrl] = result;
                    resolve(result);
                } catch (err) {
                    reject(err);
                }
            };

            img.onerror = function () {
                reject(new Error('Не удалось загрузить изображение: ' + imageUrl));
            };

            img.src = imageUrl;
        });
    }

    /**
     * Обработка изображения: удаление зелёных пикселей
     * @param {HTMLImageElement} img
     * @returns {string} dataURL
     */
    function _processImage(img) {
        // Создаём offscreen canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        // Рисуем изображение
        ctx.drawImage(img, 0, 0);

        // Получаем данные пикселей
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data; // Uint8ClampedArray [R, G, B, A, R, G, B, A, ...]

        // Обрабатываем каждый пиксель
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];     // Red
            const g = data[i + 1]; // Green
            const b = data[i + 2]; // Blue
            // data[i + 3] = Alpha

            // Определяем, является ли пиксель "зелёным" (хромакей)
            if (_isGreenPixel(r, g, b)) {
                // Полностью прозрачный
                data[i + 3] = 0;
            } else if (_isNearGreenPixel(r, g, b)) {
                // Полупрозрачный — для плавных краёв (anti-aliasing)
                const greenness = _calculateGreenness(r, g, b);
                // Чем "зеленее" пиксель, тем прозрачнее он становится
                data[i + 3] = Math.round(255 * (1 - greenness));

                // Также корректируем цвет, убирая зелёный оттенок
                // чтобы края не были зеленоватыми
                data[i + 1] = Math.round(g * (1 - greenness * 0.5));
            }
        }

        // Записываем обработанные данные обратно
        ctx.putImageData(imageData, 0, 0);

        return canvas.toDataURL('image/png');
    }

    /**
     * Проверка: является ли пиксель ярко-зелёным (хромакей)
     * @param {number} r — красный канал (0-255)
     * @param {number} g — зелёный канал (0-255)
     * @param {number} b — синий канал (0-255)
     * @returns {boolean}
     */
    function _isGreenPixel(r, g, b) {
        // Условия для чистого хромакей-зелёного:
        // 1. Зелёный канал значительно преобладает
        // 2. Красный и синий каналы низкие
        return (
            g > GREEN_THRESHOLD &&
            g > r * GREEN_RATIO &&
            g > b * GREEN_RATIO &&
            r < 180 &&
            b < 180
        );
    }

    /**
     * Проверка: пиксель на границе (полупрозрачная зона)
     * Более мягкие условия для anti-aliasing краёв
     */
    function _isNearGreenPixel(r, g, b) {
        return (
            g > 80 &&
            g > r * 1.0 &&
            g > b * 1.0 &&
            r < 200 &&
            b < 200 &&
            // Не чисто серый/белый/чёрный
            !(r > 200 && g > 200 && b > 200) && // не белый
            !(r < 40 && g < 40 && b < 40)        // не чёрный
        );
    }

    /**
     * Вычисление степени "зелёности" пикселя (0 = не зелёный, 1 = чисто зелёный)
     * Используется для плавного сглаживания краёв
     */
    function _calculateGreenness(r, g, b) {
        if (g === 0) return 0;
        const avgRB = (r + b) / 2;
        const ratio = g / (avgRB + 1); // +1 для избежания деления на 0

        // Нормализуем: ratio > 2 = очень зелёный
        return Math.min(1, Math.max(0, (ratio - 1) / 2));
    }

    /**
     * Предзагрузка и обработка всех шаблонов одежды
     * @param {Object} garmentConfig — конфигурация из GarmentManager
     * @returns {Promise<void>}
     */
    function preloadAll(garmentConfig) {
        const promises = Object.values(garmentConfig).map(config => {
            return removeBackground(config.image);
        });
        return Promise.all(promises);
    }

    /**
     * Получить обработанное изображение из кэша
     * @param {string} imageUrl
     * @returns {string|null} dataURL или null если не обработано
     */
    function getCached(imageUrl) {
        return cache[imageUrl] || null;
    }

    /**
     * Очистить кэш
     */
    function clearCache() {
        Object.keys(cache).forEach(key => delete cache[key]);
    }

    // Public API
    return {
        removeBackground,
        preloadAll,
        getCached,
        clearCache
    };

})();
