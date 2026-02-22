/**
 * PrintEditor — Tools Module
 * Инструменты: текст, кисть, фигуры, загрузка изображений
 */

const ToolsManager = (function () {
    'use strict';

    let currentTool = 'select';
    let canvas = null;

    // DOM-элементы
    const toolBtns = () => document.querySelectorAll('.pe-tool-btn');
    const brushSettings = () => document.getElementById('brush-settings');
    const imageUploadSection = () => document.getElementById('image-upload-section');

    /**
     * Инициализация модуля
     */
    function init() {
        canvas = CanvasManager.getCanvas();

        _bindToolButtons();
        _bindBrushSettings();
        _bindImageUpload();
        _bindPropertyInputs();
        _bindActionButtons();
        _bindContextMenu();
    }

    /**
     * Привязка кнопок инструментов
     */
    function _bindToolButtons() {
        toolBtns().forEach(btn => {
            btn.addEventListener('click', function () {
                const tool = this.dataset.tool;
                setTool(tool);
            });
        });
    }

    /**
     * Установка активного инструмента
     * @param {string} tool — название инструмента
     */
    function setTool(tool) {
        currentTool = tool;

        // Обновляем активную кнопку
        toolBtns().forEach(btn => {
            btn.classList.toggle('pe-tool-btn--active', btn.dataset.tool === tool);
        });

        // Скрываем/показываем доп. настройки
        brushSettings().style.display = (tool === 'brush') ? 'block' : 'none';
        imageUploadSection().style.display = (tool === 'image') ? 'block' : 'none';

        // Режимы canvas
        canvas.isDrawingMode = (tool === 'brush');

        // Если не режим выделения, снимаем выделение
        if (tool !== 'select') {
            canvas.discardActiveObject();
            canvas.renderAll();
        }

        // Курсор
        const canvasArea = document.getElementById('canvas-area');
        canvasArea.classList.toggle('pe-canvas-area--drawing', tool === 'brush');

        // Для фигур и текста — добавляем при клике на инструмент
        if (tool === 'text') {
            _addText();
            setTool('select');
            return;
        }
        if (tool === 'rect') {
            _addRect();
            setTool('select');
            return;
        }
        if (tool === 'circle') {
            _addCircle();
            setTool('select');
            return;
        }
        if (tool === 'triangle') {
            _addTriangle();
            setTool('select');
            return;
        }
        if (tool === 'line') {
            _addLine();
            setTool('select');
            return;
        }

        // Настройки кисти
        if (tool === 'brush') {
            _applyBrushSettings();
        }

        // Обновляем статус
        const toolNames = {
            select: 'Выбор',
            text: 'Текст',
            brush: 'Кисть',
            image: 'Картинка',
            rect: 'Прямоугольник',
            circle: 'Круг',
            triangle: 'Треугольник',
            line: 'Линия'
        };
        document.getElementById('status-tool').innerHTML =
            '<i class="ri-tools-line"></i> ' + (toolNames[tool] || tool);
    }

    // ==========================================
    //  Инструменты — добавление объектов
    // ==========================================

    /**
     * Добавить текст
     */
    function _addText() {
        const size = CanvasManager.getSize();
        const text = new fabric.IText('Ваш текст', {
            left: size.width / 2,
            top: size.height / 2,
            originX: 'center',
            originY: 'center',
            fontFamily: 'Inter',
            fontSize: 28,
            fill: '#ffffff',
            textAlign: 'center',
            fontWeight: 'normal',
            fontStyle: 'normal',
            underline: false,
            shadow: new fabric.Shadow({
                color: 'rgba(0,0,0,0.3)',
                blur: 4,
                offsetX: 1,
                offsetY: 1
            })
        });

        canvas.add(text);
        canvas.setActiveObject(text);
        canvas.renderAll();
        App.showToast('Текст добавлен', 'success');
    }

    /**
     * Добавить прямоугольник
     */
    function _addRect() {
        const size = CanvasManager.getSize();
        const rect = new fabric.Rect({
            left: size.width / 2,
            top: size.height / 2,
            originX: 'center',
            originY: 'center',
            width: 100,
            height: 80,
            fill: '#6c5ce7',
            rx: 8,
            ry: 8,
            strokeWidth: 0,
            stroke: '#000000'
        });

        canvas.add(rect);
        canvas.setActiveObject(rect);
        canvas.renderAll();
        App.showToast('Прямоугольник добавлен', 'success');
    }

    /**
     * Добавить круг
     */
    function _addCircle() {
        const size = CanvasManager.getSize();
        const circle = new fabric.Circle({
            left: size.width / 2,
            top: size.height / 2,
            originX: 'center',
            originY: 'center',
            radius: 50,
            fill: '#a855f7',
            strokeWidth: 0,
            stroke: '#000000'
        });

        canvas.add(circle);
        canvas.setActiveObject(circle);
        canvas.renderAll();
        App.showToast('Круг добавлен', 'success');
    }

    /**
     * Добавить треугольник
     */
    function _addTriangle() {
        const size = CanvasManager.getSize();
        const triangle = new fabric.Triangle({
            left: size.width / 2,
            top: size.height / 2,
            originX: 'center',
            originY: 'center',
            width: 100,
            height: 90,
            fill: '#00d68f',
            strokeWidth: 0,
            stroke: '#000000'
        });

        canvas.add(triangle);
        canvas.setActiveObject(triangle);
        canvas.renderAll();
        App.showToast('Треугольник добавлен', 'success');
    }

    /**
     * Добавить линию
     */
    function _addLine() {
        const size = CanvasManager.getSize();
        const line = new fabric.Line(
            [size.width / 2 - 60, size.height / 2, size.width / 2 + 60, size.height / 2],
            {
                stroke: '#ffffff',
                strokeWidth: 3,
                strokeLineCap: 'round'
            }
        );

        canvas.add(line);
        canvas.setActiveObject(line);
        canvas.renderAll();
        App.showToast('Линия добавлена', 'success');
    }


    // ==========================================
    //  Настройки кисти
    // ==========================================

    function _bindBrushSettings() {
        const sizeInput = document.getElementById('brush-size');
        const sizeValue = document.getElementById('brush-size-value');
        const colorInput = document.getElementById('brush-color');
        const colorLabel = document.getElementById('brush-color-label');

        sizeInput.addEventListener('input', function () {
            sizeValue.textContent = this.value;
            _applyBrushSettings();
        });

        colorInput.addEventListener('input', function () {
            colorLabel.textContent = this.value.toUpperCase();
            _applyBrushSettings();
        });
    }

    function _applyBrushSettings() {
        const size = parseInt(document.getElementById('brush-size').value, 10);
        const color = document.getElementById('brush-color').value;

        canvas.freeDrawingBrush.width = size;
        canvas.freeDrawingBrush.color = color;
        canvas.freeDrawingBrush.shadow = new fabric.Shadow({
            blur: Math.max(1, size / 3),
            offsetX: 0,
            offsetY: 0,
            color: color
        });
    }


    // ==========================================
    //  Загрузка изображений
    // ==========================================

    function _bindImageUpload() {
        const dropzone = document.getElementById('image-dropzone');
        const fileInput = document.getElementById('image-file-input');

        // Клик на дропзону
        dropzone.addEventListener('click', () => fileInput.click());

        // Drag & drop
        dropzone.addEventListener('dragover', function (e) {
            e.preventDefault();
            this.classList.add('pe-dropzone--active');
        });

        dropzone.addEventListener('dragleave', function () {
            this.classList.remove('pe-dropzone--active');
        });

        dropzone.addEventListener('drop', function (e) {
            e.preventDefault();
            this.classList.remove('pe-dropzone--active');
            const file = e.dataTransfer.files[0];
            if (file) _handleImageFile(file);
        });

        // Выбор файла
        fileInput.addEventListener('change', function () {
            if (this.files[0]) {
                _handleImageFile(this.files[0]);
                this.value = '';
            }
        });
    }

    /**
     * Обработка загруженного файла изображения
     * @param {File} file
     */
    function _handleImageFile(file) {
        if (!file.type.startsWith('image/')) {
            App.showToast('Поддерживаются только изображения', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            fabric.Image.fromURL(e.target.result, function (img) {
                const size = CanvasManager.getSize();
                // Масштабируем изображение, чтобы помещалось на холст
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

                App.showToast('Изображение добавлено', 'success');
                setTool('select');
            });
        };
        reader.readAsDataURL(file);
    }


    // ==========================================
    //  Привязка инпутов панели свойств
    // ==========================================

    function _bindPropertyInputs() {
        // Позиция / размер
        _bindNumericProp('prop-left', 'left');
        _bindNumericProp('prop-top', 'top');
        _bindAngleProp();
        _bindSizeProp();
        _bindFillProp();
        _bindOpacityProp();
        _bindStrokeProp();
        _bindStrokeWidthProp();
        _bindTextProps();
    }

    function _bindNumericProp(inputId, prop) {
        const input = document.getElementById(inputId);
        input.addEventListener('change', function () {
            const obj = canvas.getActiveObject();
            if (!obj) return;
            obj.set(prop, parseFloat(this.value));
            obj.setCoords();
            canvas.renderAll();
            CanvasManager.saveState();
        });
    }

    function _bindAngleProp() {
        const input = document.getElementById('prop-angle');
        const label = document.getElementById('prop-angle-value');

        input.addEventListener('input', function () {
            label.textContent = this.value + '°';
            const obj = canvas.getActiveObject();
            if (!obj) return;
            obj.set('angle', parseFloat(this.value));
            obj.setCoords();
            canvas.renderAll();
        });

        input.addEventListener('change', function () {
            CanvasManager.saveState();
        });
    }

    function _bindSizeProp() {
        document.getElementById('prop-width').addEventListener('change', function () {
            const obj = canvas.getActiveObject();
            if (!obj) return;
            const newW = parseFloat(this.value);
            obj.set('scaleX', newW / (obj.width || 1));
            obj.setCoords();
            canvas.renderAll();
            CanvasManager.saveState();
        });

        document.getElementById('prop-height').addEventListener('change', function () {
            const obj = canvas.getActiveObject();
            if (!obj) return;
            const newH = parseFloat(this.value);
            obj.set('scaleY', newH / (obj.height || 1));
            obj.setCoords();
            canvas.renderAll();
            CanvasManager.saveState();
        });
    }

    function _bindFillProp() {
        const input = document.getElementById('prop-fill');
        const label = document.getElementById('prop-fill-label');

        input.addEventListener('input', function () {
            label.textContent = this.value.toUpperCase();
            const obj = canvas.getActiveObject();
            if (!obj) return;
            obj.set('fill', this.value);
            canvas.renderAll();
        });

        input.addEventListener('change', function () {
            CanvasManager.saveState();
        });
    }

    function _bindOpacityProp() {
        const input = document.getElementById('prop-opacity');
        const label = document.getElementById('prop-opacity-value');

        input.addEventListener('input', function () {
            label.textContent = this.value + '%';
            const obj = canvas.getActiveObject();
            if (!obj) return;
            obj.set('opacity', parseInt(this.value, 10) / 100);
            canvas.renderAll();
        });

        input.addEventListener('change', function () {
            CanvasManager.saveState();
        });
    }

    function _bindStrokeProp() {
        const input = document.getElementById('prop-stroke');
        const label = document.getElementById('prop-stroke-label');

        input.addEventListener('input', function () {
            label.textContent = this.value.toUpperCase();
            const obj = canvas.getActiveObject();
            if (!obj) return;
            obj.set('stroke', this.value);
            canvas.renderAll();
        });

        input.addEventListener('change', function () {
            CanvasManager.saveState();
        });
    }

    function _bindStrokeWidthProp() {
        const input = document.getElementById('prop-stroke-width');
        const label = document.getElementById('prop-stroke-width-value');

        input.addEventListener('input', function () {
            label.textContent = this.value;
            const obj = canvas.getActiveObject();
            if (!obj) return;
            obj.set('strokeWidth', parseInt(this.value, 10));
            canvas.renderAll();
        });

        input.addEventListener('change', function () {
            CanvasManager.saveState();
        });
    }

    function _bindTextProps() {
        // Текстовое содержание
        const textContent = document.getElementById('prop-text-content');
        textContent.addEventListener('input', function () {
            const obj = canvas.getActiveObject();
            if (!obj || !obj.set) return;
            obj.set('text', this.value);
            canvas.renderAll();
        });
        textContent.addEventListener('change', () => CanvasManager.saveState());

        // Шрифт
        document.getElementById('prop-font-family').addEventListener('change', function () {
            const obj = canvas.getActiveObject();
            if (!obj) return;
            obj.set('fontFamily', this.value);
            canvas.renderAll();
            CanvasManager.saveState();
        });

        // Размер шрифта
        document.getElementById('prop-font-size').addEventListener('change', function () {
            const obj = canvas.getActiveObject();
            if (!obj) return;
            obj.set('fontSize', parseInt(this.value, 10));
            canvas.renderAll();
            CanvasManager.saveState();
        });

        // Bold
        document.getElementById('prop-bold').addEventListener('click', function () {
            const obj = canvas.getActiveObject();
            if (!obj) return;
            const isBold = obj.fontWeight === 'bold';
            obj.set('fontWeight', isBold ? 'normal' : 'bold');
            this.classList.toggle('pe-btn--active');
            canvas.renderAll();
            CanvasManager.saveState();
        });

        // Italic
        document.getElementById('prop-italic').addEventListener('click', function () {
            const obj = canvas.getActiveObject();
            if (!obj) return;
            const isItalic = obj.fontStyle === 'italic';
            obj.set('fontStyle', isItalic ? 'normal' : 'italic');
            this.classList.toggle('pe-btn--active');
            canvas.renderAll();
            CanvasManager.saveState();
        });

        // Underline
        document.getElementById('prop-underline').addEventListener('click', function () {
            const obj = canvas.getActiveObject();
            if (!obj) return;
            obj.set('underline', !obj.underline);
            this.classList.toggle('pe-btn--active');
            canvas.renderAll();
            CanvasManager.saveState();
        });

        // Text Align
        ['left', 'center', 'right'].forEach(align => {
            document.getElementById('prop-align-' + align).addEventListener('click', function () {
                const obj = canvas.getActiveObject();
                if (!obj) return;
                obj.set('textAlign', align);
                // Обновляем кнопки
                document.getElementById('prop-align-left').classList.remove('pe-btn--active');
                document.getElementById('prop-align-center').classList.remove('pe-btn--active');
                document.getElementById('prop-align-right').classList.remove('pe-btn--active');
                this.classList.add('pe-btn--active');
                canvas.renderAll();
                CanvasManager.saveState();
            });
        });
    }


    // ==========================================
    //  Кнопки действий с объектом
    // ==========================================

    function _bindActionButtons() {
        // На передний план
        document.getElementById('prop-bring-front').addEventListener('click', function () {
            const obj = canvas.getActiveObject();
            if (obj) {
                canvas.bringToFront(obj);
                canvas.renderAll();
                CanvasManager.saveState();
            }
        });

        // На задний план
        document.getElementById('prop-send-back').addEventListener('click', function () {
            const obj = canvas.getActiveObject();
            if (obj) {
                canvas.sendToBack(obj);
                canvas.renderAll();
                CanvasManager.saveState();
            }
        });

        // Дублировать
        document.getElementById('prop-duplicate').addEventListener('click', _duplicateObject);

        // Удалить
        document.getElementById('prop-delete').addEventListener('click', _deleteObject);
    }

    /**
     * Дублирование выделенного объекта
     */
    function _duplicateObject() {
        const obj = canvas.getActiveObject();
        if (!obj) return;

        obj.clone(function (cloned) {
            cloned.set({
                left: (obj.left || 0) + 20,
                top: (obj.top || 0) + 20
            });
            canvas.add(cloned);
            canvas.setActiveObject(cloned);
            canvas.renderAll();
            App.showToast('Объект дублирован', 'success');
        });
    }

    /**
     * Удаление выделенного объекта
     */
    function _deleteObject() {
        const obj = canvas.getActiveObject();
        if (!obj) return;

        canvas.remove(obj);
        canvas.discardActiveObject();
        canvas.renderAll();
        App.showToast('Объект удалён', 'success');
    }

    /**
     * Привязка контекстного меню
     */
    function _bindContextMenu() {
        document.querySelectorAll('#context-menu .pe-context-menu__item').forEach(item => {
            item.addEventListener('click', function () {
                const action = this.dataset.action;
                switch (action) {
                    case 'duplicate':
                        _duplicateObject();
                        break;
                    case 'bring-front':
                        const obj1 = canvas.getActiveObject();
                        if (obj1) { canvas.bringToFront(obj1); canvas.renderAll(); CanvasManager.saveState(); }
                        break;
                    case 'send-back':
                        const obj2 = canvas.getActiveObject();
                        if (obj2) { canvas.sendToBack(obj2); canvas.renderAll(); CanvasManager.saveState(); }
                        break;
                    case 'delete':
                        _deleteObject();
                        break;
                }
            });
        });
    }

    /**
     * Получить текущий инструмент
     */
    function getTool() {
        return currentTool;
    }

    // Public API
    return {
        init,
        setTool,
        getTool
    };

})();
