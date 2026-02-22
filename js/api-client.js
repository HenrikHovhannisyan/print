/**
 * PrintEditor — API Client Module
 * 
 * Клиент для взаимодействия с PHP-бэкендом.
 * Сохранение дизайнов, управление корзиной, оформление заказов.
 */

const ApiClient = (function () {
    'use strict';

    const API_BASE = '/api';

    /**
     * Уникальный ID сессии браузера или Email
     */
    function getSessionId() {
        let loggedInEmail = localStorage.getItem('pe_user_email');
        if (loggedInEmail) {
            return loggedInEmail;
        }

        let sid = localStorage.getItem('pe_session_id');
        if (!sid) {
            sid = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
            localStorage.setItem('pe_session_id', sid);
        }
        return sid;
    }

    /**
     * Универсальный fetch-обёртка
     */
    async function request(endpoint, options = {}) {
        const url = API_BASE + endpoint;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                'X-Session-ID': getSessionId(),
                ...(options.headers || {}),
            },
            ...options,
        };

        try {
            const res = await fetch(url, config);
            return await res.json();
        } catch (err) {
            console.error('[ApiClient] Ошибка:', err);
            return { success: false, message: 'Ошибка соединения с сервером' };
        }
    }

    /**
     * Загрузка файла (multipart/form-data)
     */
    async function uploadFile(endpoint, file) {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(API_BASE + endpoint, {
                method: 'POST',
                headers: { 'X-Session-ID': getSessionId() },
                body: formData,
            });
            return await res.json();
        } catch (err) {
            console.error('[ApiClient] Upload error:', err);
            return { success: false, message: 'Ошибка загрузки файла' };
        }
    }


    // =============================================
    //  Одежда
    // =============================================

    /**
     * Получить активные типы одежды (для фронтенда)
     */
    async function listActiveGarments() {
        return request('/garments');
    }

    // =============================================
    //  Пользователи
    // =============================================

    /**
     * Создать пользователя по email
     */
    async function createUser(email, name = '') {
        return request('/users', {
            method: 'POST',
            body: JSON.stringify({ email, name })
        });
    }

    // =============================================
    //  Дизайны
    // =============================================

    /**
     * Сохранить текущий дизайн
     * 
     * @param {Object} params
     * @param {string} params.garmentType — тип одежды
     * @param {string} params.garmentColor — HEX цвет
     * @param {Object} params.canvasJson — canvas.toJSON()
     * @param {string} params.svgData — canvas.toSVG()
     * @param {string} params.highresDataUrl — canvas.toDataURL({multiplier:4})
     * @param {string} params.previewDataUrl — мокап dataURL
     * @param {Object} params.printArea — {top, left, width, height}
     * @param {string} [params.title] — название
     * @param {number} [params.designId] — ID для обновления
     */
    async function saveDesign(params) {
        return request('/designs', {
            method: 'POST',
            body: JSON.stringify({
                session_id: getSessionId(),
                garment_type: params.garmentType,
                garment_color: params.garmentColor,
                canvas_json: params.canvasJson,
                svg_data: params.svgData,
                highres_data: params.highresDataUrl,
                preview_data: params.previewDataUrl,
                print_area: params.printArea,
                title: params.title || '',
                design_id: params.designId || null,
            }),
        });
    }

    /**
     * Получить дизайн по ID
     */
    async function getDesign(designId) {
        return request(`/designs/${designId}`);
    }

    /**
     * Список моих дизайнов
     */
    async function listDesigns() {
        return request(`/designs?session_id=${getSessionId()}`);
    }

    /**
     * Удалить дизайн
     */
    async function deleteDesign(designId) {
        return request(`/designs/${designId}?session_id=${getSessionId()}`, {
            method: 'DELETE',
        });
    }

    /**
     * Загрузить оригинал изображения к дизайну
     */
    async function uploadDesignAsset(designId, file) {
        return uploadFile(`/designs/${designId}/upload`, file);
    }


    // =============================================
    //  Корзина
    // =============================================

    /**
     * Добавить в корзину
     */
    async function addToCart(designId, size = 'M', quantity = 1, notes = '') {
        return request('/cart', {
            method: 'POST',
            body: JSON.stringify({
                session_id: getSessionId(),
                design_id: designId,
                size: size,
                quantity: quantity,
                notes: notes,
            }),
        });
    }

    /**
     * Получить корзину
     */
    async function getCart() {
        return request(`/cart?session_id=${getSessionId()}`);
    }

    /**
     * Обновить позицию корзины
     */
    async function updateCartItem(itemId, data) {
        return request(`/cart/${itemId}`, {
            method: 'PUT',
            body: JSON.stringify({
                session_id: getSessionId(),
                ...data,
            }),
        });
    }

    /**
     * Удалить из корзины
     */
    async function removeFromCart(itemId) {
        return request(`/cart/${itemId}?session_id=${getSessionId()}`, {
            method: 'DELETE',
        });
    }

    /**
     * Очистить корзину
     */
    async function clearCart() {
        return request(`/cart?session_id=${getSessionId()}`, {
            method: 'DELETE',
        });
    }


    // =============================================
    //  Заказы
    // =============================================

    /**
     * Оформить заказ
     */
    async function createOrder(customerInfo) {
        return request('/orders', {
            method: 'POST',
            body: JSON.stringify({
                session_id: getSessionId(),
                customer_name: customerInfo.name,
                customer_email: customerInfo.email,
                customer_phone: customerInfo.phone,
                customer_address: customerInfo.address,
                notes: customerInfo.notes || '',
            }),
        });
    }

    /**
     * Получить заказ по ID
     */
    async function getOrder(orderId) {
        return request(`/orders/${orderId}`);
    }

    /**
     * Найти заказ по номеру
     */
    async function findOrder(orderNumber) {
        return request(`/orders/by-number/${orderNumber}`);
    }

    /**
     * Мои заказы (по email)
     */
    async function listMyOrders(email) {
        return request(`/orders?email=${encodeURIComponent(email)}`);
    }

    // =============================================
    //  Public API
    // =============================================
    return {
        getSessionId,

        // Пользователи
        createUser,

        // Одежда
        listActiveGarments,

        // Дизайны
        saveDesign,
        getDesign,
        listDesigns,
        deleteDesign,
        uploadDesignAsset,

        // Корзина
        addToCart,
        getCart,
        updateCartItem,
        removeFromCart,
        clearCart,

        // Заказы
        createOrder,
        getOrder,
        findOrder,
        listMyOrders,
    };

})();
