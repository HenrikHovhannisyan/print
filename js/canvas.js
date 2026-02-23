/**
 * PrintEditor — Canvas Module
 * Инициализация и управление Fabric.js canvas
 */

const CanvasManager = (function () {
    'use strict';

    let canvas = null;
    let canvasWidth = 300;
    let canvasHeight = 400;

    // История для undo/redo
    let undoStack = [];
    let redoStack = [];
    let isUndoRedoAction = false;
    const MAX_HISTORY = 50;

    /**
     * Инициализация Fabric.js canvas
     */
    function init() {
        canvas = new fabric.Canvas('fabric-canvas', {
            width: canvasWidth,
            height: canvasHeight,
            backgroundColor: 'transparent',
            selection: true,
            preserveObjectStacking: true,
            controlsAboveOverlay: true,
            allowTouchScrolling: false
        });

        // Кастомизация контролов Fabric.js
        _customizeControls();

        // Привязка событий canvas
        _bindCanvasEvents();

        // Сохраняем начальное состояние в историю
        _saveState();
        _updateUndoRedoButtons();
        _updateObjectCount();

        return canvas;
    }

    /**
     * Кастомизация внешнего вида контролов выделения
     */
    function _customizeControls() {
        // Глобальные настройки контролов
        fabric.Object.prototype.set({
            transparentCorners: false,
            cornerColor: '#6c5ce7',
            cornerStrokeColor: '#6c5ce7',
            borderColor: '#6c5ce7',
            cornerSize: 10,
            cornerStyle: 'circle',
            borderDashArray: [4, 4],
            padding: 6
        });

        // Стиль контрола поворота
        fabric.Object.prototype.controls.mtr.offsetY = -30;
    }

    /**
     * Привязка событий canvas
     */
    function _bindCanvasEvents() {
        // Выделение объекта
        canvas.on('selection:created', _onSelectionChanged);
        canvas.on('selection:updated', _onSelectionChanged);
        canvas.on('selection:cleared', _onSelectionCleared);

        // Модификация объекта
        canvas.on('object:modified', function () {
            _saveState();
            _updatePropertiesPanel();
        });

        // Перемещение объекта — обновляем координаты в панели
        canvas.on('object:moving', _updatePropertiesPanel);
        canvas.on('object:scaling', _updatePropertiesPanel);
        canvas.on('object:rotating', _updatePropertiesPanel);

        // Добавление/удаление объектов
        canvas.on('object:added', function () {
            if (!isUndoRedoAction) {
                _saveState();
            }
            _updateObjectCount();
            if (typeof App !== 'undefined' && App.updatePrice) {
                App.updatePrice();
            }
        });

        canvas.on('object:removed', function () {
            if (!isUndoRedoAction) {
                _saveState();
            }
            _updateObjectCount();
            if (typeof App !== 'undefined' && App.updatePrice) {
                App.updatePrice();
            }
        });

        // Контекстное меню (правый клик)
        canvas.on('mouse:down', function (opt) {
            if (opt.e.button === 2) {
                opt.e.preventDefault();
                _showContextMenu(opt.e);
            }
        });

        // Скрытие контекстного меню при клике
        document.addEventListener('click', _hideContextMenu);
        document.addEventListener('contextmenu', function (e) {
            const canvasArea = document.getElementById('canvas-area');
            if (canvasArea.contains(e.target)) {
                e.preventDefault();
            }
        });
    }

    /**
     * Обработчик выделения объекта
     */
    function _onSelectionChanged() {
        const obj = canvas.getActiveObject();
        if (!obj) return;

        // Показываем панель свойств
        document.getElementById('properties-empty').style.display = 'none';
        document.getElementById('properties-content').style.display = 'block';

        const panel = document.getElementById('properties-panel');
        if (panel) {
            panel.classList.remove('is-empty');
            panel.classList.add('is-active');
        }

        // Показываем/скрываем свойства текста
        const isText = obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox';
        document.getElementById('text-properties').style.display = isText ? 'block' : 'none';

        _updatePropertiesPanel();
        _updateSelectionStatus(obj);
    }

    /**
     * Обработчик снятия выделения
     */
    function _onSelectionCleared() {
        document.getElementById('properties-empty').style.display = 'flex';
        document.getElementById('properties-content').style.display = 'none';

        const panel = document.getElementById('properties-panel');
        if (panel) {
            panel.classList.add('is-empty');
            panel.classList.remove('is-active');
        }

        _updateSelectionStatus(null);
    }

    /**
     * Обновление панели свойств текущего объекта
     */
    function _updatePropertiesPanel() {
        const obj = canvas.getActiveObject();
        if (!obj) return;

        // Позиция и размер
        document.getElementById('prop-left').value = Math.round(obj.left || 0);
        document.getElementById('prop-top').value = Math.round(obj.top || 0);
        document.getElementById('prop-width').value = Math.round(obj.getScaledWidth());
        document.getElementById('prop-height').value = Math.round(obj.getScaledHeight());
        document.getElementById('prop-angle').value = Math.round(obj.angle || 0);
        document.getElementById('prop-angle-value').textContent = Math.round(obj.angle || 0) + '°';

        // Цвет заливки
        const fill = obj.fill || '#ffffff';
        if (typeof fill === 'string' && fill.startsWith('#')) {
            document.getElementById('prop-fill').value = fill;
            document.getElementById('prop-fill-label').textContent = fill.toUpperCase();
        }

        // Прозрачность
        const opacity = Math.round((obj.opacity || 1) * 100);
        document.getElementById('prop-opacity').value = opacity;
        document.getElementById('prop-opacity-value').textContent = opacity + '%';

        // Обводка
        const stroke = obj.stroke || '#000000';
        if (typeof stroke === 'string' && stroke.startsWith('#')) {
            document.getElementById('prop-stroke').value = stroke;
            document.getElementById('prop-stroke-label').textContent = stroke.toUpperCase();
        }
        const sw = obj.strokeWidth || 0;
        document.getElementById('prop-stroke-width').value = sw;
        document.getElementById('prop-stroke-width-value').textContent = sw;

        // Свойства текста
        const isText = obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox';
        if (isText) {
            document.getElementById('prop-text-content').value = obj.text || '';
            document.getElementById('prop-font-family').value = obj.fontFamily || 'Inter';
            document.getElementById('prop-font-size').value = obj.fontSize || 24;

            // Bold/Italic/Underline состояния
            _toggleBtnActive('prop-bold', obj.fontWeight === 'bold');
            _toggleBtnActive('prop-italic', obj.fontStyle === 'italic');
            _toggleBtnActive('prop-underline', obj.underline === true);

            // Выравнивание
            _toggleBtnActive('prop-align-left', obj.textAlign === 'left');
            _toggleBtnActive('prop-align-center', obj.textAlign === 'center');
            _toggleBtnActive('prop-align-right', obj.textAlign === 'right');
        }
    }

    /**
     * Переключение активного состояния кнопки
     */
    function _toggleBtnActive(id, isActive) {
        const btn = document.getElementById(id);
        if (btn) {
            btn.classList.toggle('pe-btn--active', isActive);
        }
    }

    /**
     * Обновление счётчика объектов
     */
    function _updateObjectCount() {
        const count = canvas.getObjects().length;
        document.getElementById('status-objects').innerHTML =
            '<i class="ri-stack-line"></i> Объектов: ' + count;

        const btnClear = document.getElementById('btn-clear-canvas');
        if (btnClear) {
            btnClear.disabled = count === 0;
        }
    }

    /**
     * Обновление статуса выделения
     */
    function _updateSelectionStatus(obj) {
        const el = document.getElementById('status-selection');
        if (obj) {
            let typeName = 'Объект';
            switch (obj.type) {
                case 'i-text':
                case 'textbox':
                case 'text':
                    typeName = 'Текст'; break;
                case 'rect': typeName = 'Прямоугольник'; break;
                case 'circle': typeName = 'Круг'; break;
                case 'triangle': typeName = 'Треугольник'; break;
                case 'line': typeName = 'Линия'; break;
                case 'image': typeName = 'Изображение'; break;
                case 'path': typeName = 'Рисунок'; break;
            }
            el.innerHTML = '<i class="ri-cursor-line"></i> Выделено: ' + typeName;
        } else {
            el.innerHTML = '<i class="ri-cursor-line"></i> Нет выделения';
        }
    }

    /**
     * Обновление состояния кнопок Undo/Redo
     */
    function _updateUndoRedoButtons() {
        const btnUndo = document.getElementById('btn-undo');
        const btnRedo = document.getElementById('btn-redo');
        if (btnUndo) {
            btnUndo.disabled = undoStack.length <= 1;
        }
        if (btnRedo) {
            btnRedo.disabled = redoStack.length === 0;
        }
    }

    /**
     * Контекстное меню
     */
    function _showContextMenu(e) {
        const obj = canvas.getActiveObject();
        if (!obj) return;

        const menu = document.getElementById('context-menu');
        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';
        menu.classList.add('pe-context-menu--visible');
    }

    function _hideContextMenu() {
        const menu = document.getElementById('context-menu');
        menu.classList.remove('pe-context-menu--visible');
    }

    /**
     * Изменение размера canvas
     * @param {number} width
     * @param {number} height
     */
    function resize(width, height) {
        if (!canvas) return;
        canvasWidth = width;
        canvasHeight = height;
        canvas.setDimensions({ width, height });
        canvas.renderAll();

        // Обновляем статус
        document.getElementById('status-canvas-size').innerHTML =
            '<i class="ri-artboard-line"></i> ' + width + ' x ' + height;
    }

    /**
     * Сохранение состояния в историю (для undo/redo)
     */
    function _saveState() {
        if (isUndoRedoAction) return;

        const json = JSON.stringify(canvas.toJSON());
        undoStack.push(json);

        // Ограничиваем размер истории
        if (undoStack.length > MAX_HISTORY) {
            undoStack.shift();
        }

        // Очищаем redo при новом действии
        redoStack = [];

        _updateUndoRedoButtons();
    }

    /**
     * Отмена действия
     */
    function undo() {
        if (undoStack.length <= 1) return;

        isUndoRedoAction = true;
        const currentState = undoStack.pop();
        redoStack.push(currentState);

        const previousState = undoStack[undoStack.length - 1];
        canvas.loadFromJSON(previousState, function () {
            canvas.renderAll();
            isUndoRedoAction = false;
            _updateObjectCount();
            _onSelectionCleared();
            _updateUndoRedoButtons();
        });
    }

    /**
     * Повтор действия
     */
    function redo() {
        if (redoStack.length === 0) return;

        isUndoRedoAction = true;
        const nextState = redoStack.pop();
        undoStack.push(nextState);

        canvas.loadFromJSON(nextState, function () {
            canvas.renderAll();
            isUndoRedoAction = false;
            _updateObjectCount();
            _onSelectionCleared();
            _updateUndoRedoButtons();
        });
    }

    /**
     * Очистка холста
     */
    function clearCanvas() {
        canvas.clear();
        canvas.backgroundColor = 'transparent';
        canvas.renderAll();
        _saveState();
        _onSelectionCleared();
    }

    /**
     * Загрузить состояние из JSON (возвращает Promise)
     * @param {string|Object} json
     */
    function loadState(json) {
        return new Promise((resolve) => {
            if (!json) {
                clearCanvas();
                resolve();
                return;
            }
            canvas.loadFromJSON(json, () => {
                canvas.renderAll();
                _updateObjectCount();
                _onSelectionCleared();
                _updateUndoRedoButtons();
                resolve();
            });
        });
    }

    /**
     * Получить экземпляр Fabric canvas
     */
    function getCanvas() {
        return canvas;
    }

    /**
     * Получить размеры canvas
     */
    function getSize() {
        return { width: canvasWidth, height: canvasHeight };
    }

    // Public API
    return {
        init,
        resize,
        undo,
        redo,
        clearCanvas,
        loadState,
        getCanvas,
        getSize,
        saveState: _saveState
    };

})();
