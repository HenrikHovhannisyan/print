/**
 * PrintEditor — Export Module
 * Экспорт дизайна: одежда (без фона) + принт в одном PNG
 */

const ExportManager = (function () {
    'use strict';

    /**
     * Экспорт мокапа: одежда без фона + дизайн поверх
     * Основной метод экспорта — формирует полное изображение:
     * 1. Прозрачный фон
     * 2. Одежда (с удалённым зелёным фоном)
     * 3. Цветовой оверлей (если цвет не белый)
     * 4. Принт поверх в области печати
     */
    function exportAsPNG() {
        generateMockupDataURL()
            .then(dataURL => {
                const config = GarmentManager.getConfig();
                const link = document.createElement('a');
                link.download = 'print-' + config.garment + '-' + _getTimestamp() + '.png';
                link.href = dataURL;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                App.showToast('Мокап экспортирован!', 'success');
            })
            .catch(err => {
                console.error('Ошибка экспорта:', err);
                const canvas = CanvasManager.getCanvas();
                if (canvas) _exportCanvasOnly(canvas);
            });
    }

    /**
     * Генерация dataURL мокапа (одежда + дизайн)
     * Возвращает Promise resolving to string (DataURL)
     */
    function generateMockupDataURL() {
        return new Promise((resolve, reject) => {
            const canvas = CanvasManager.getCanvas();
            if (!canvas) return reject('No canvas');

            canvas.discardActiveObject();
            canvas.renderAll();

            const config = GarmentManager.getConfig();
            const garmentConfig = config.config;

            GarmentManager.getProcessedGarmentImage()
                .then(garmentImg => {
                    _composeAndExport(garmentImg, canvas, config, garmentConfig, resolve);
                })
                .catch(reject);
        });
    }

    /**
     * Компоновка
     */
    function _composeAndExport(garmentImg, fabricCanvas, config, garmentConfig, resolve) {
        // Создаём offscreen canvas для сборки
        const exportCanvas = document.createElement('canvas');
        const ctx = exportCanvas.getContext('2d');

        // Размеры = натуральный размер изображения одежды
        const natW = garmentImg.naturalWidth;
        const natH = garmentImg.naturalHeight;
        exportCanvas.width = natW;
        exportCanvas.height = natH;

        // --- Шаг 1: Прозрачный фон (по умолчанию для canvas) ---
        ctx.clearRect(0, 0, natW, natH);

        // --- Шаг 2: Рисуем одежду ---
        ctx.drawImage(garmentImg, 0, 0, natW, natH);

        // --- Шаг 3: Цветовой оверлей (если цвет не белый) ---
        if (config.color !== '#ffffff') {
            // Используем multiply для реалистичного наложения цвета
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = config.color;
            ctx.fillRect(0, 0, natW, natH);

            // Восстанавливаем прозрачность — только там, где одежда непрозрачна
            // Используем destination-in чтобы сохранить маску одежды
            ctx.globalCompositeOperation = 'destination-in';
            ctx.drawImage(garmentImg, 0, 0, natW, natH);

            // Возвращаем нормальный режим
            ctx.globalCompositeOperation = 'source-over';
        }

        // --- Шаг 4: Размещаем принт в области печати ---
        const pa = garmentConfig.printArea;
        const printX = (pa.left / 100) * natW;
        const printY = (pa.top / 100) * natH;
        const printW = (pa.width / 100) * natW;
        const printH = (pa.height / 100) * natH;

        // Получаем дизайн с canvas
        const designDataURL = fabricCanvas.toDataURL({
            format: 'png',
            quality: 1
        });

        const designImg = new Image();
        designImg.onload = function () {
            // Рисуем дизайн в области печати
            ctx.drawImage(designImg, printX, printY, printW, printH);
            // Возвращаем результат
            resolve(exportCanvas.toDataURL('image/png'));
        };

        designImg.onerror = function () {
            // Если ошибка (например пустой canvas), возвращаем хотя бы одежду
            resolve(exportCanvas.toDataURL('image/png'));
        };

        // Если canvas пустой / без дизайна
        if (!designDataURL || designDataURL === 'data:,') {
            resolve(exportCanvas.toDataURL('image/png'));
            return;
        }

        designImg.src = designDataURL;
    }

    /**
     * Фолбэк: экспорт только canvas (без одежды)
     * @param {fabric.Canvas} fabricCanvas
     */
    function _exportCanvasOnly(fabricCanvas) {
        const dataURL = fabricCanvas.toDataURL({
            format: 'png',
            quality: 1,
            multiplier: 2
        });

        const link = document.createElement('a');
        link.download = 'design-' + _getTimestamp() + '.png';
        link.href = dataURL;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        App.showToast('Дизайн экспортирован (без одежды)', 'success');
    }

    /**
     * Экспорт только области печати (canvas) — без одежды
     * Доступен как отдельная опция
     */
    function exportDesignOnly() {
        const canvas = CanvasManager.getCanvas();
        if (!canvas) return;

        canvas.discardActiveObject();
        canvas.renderAll();

        _exportCanvasOnly(canvas);
    }

    /**
     * Генерация timestamp для имени файла
     */
    function _getTimestamp() {
        const d = new Date();
        return d.getFullYear() +
            String(d.getMonth() + 1).padStart(2, '0') +
            String(d.getDate()).padStart(2, '0') + '_' +
            String(d.getHours()).padStart(2, '0') +
            String(d.getMinutes()).padStart(2, '0');
    }

    // Public API
    return {
        exportAsPNG,
        generateMockupDataURL,
        exportDesignOnly
    };

})();
