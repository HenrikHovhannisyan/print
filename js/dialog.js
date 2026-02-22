const DialogService = (function () {
    'use strict';

    function _createOverlay() {
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
        overlay.style.backdropFilter = 'blur(4px)';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.zIndex = '99999';
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.2s ease';
        return overlay;
    }

    function _createModal() {
        const modal = document.createElement('div');
        modal.style.background = 'var(--color-bg-panel, #fff)';
        modal.style.padding = '24px';
        modal.style.borderRadius = '16px';
        modal.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)';
        modal.style.maxWidth = '400px';
        modal.style.width = '90%';
        modal.style.transform = 'scale(0.95)';
        modal.style.transition = 'transform 0.2s ease';
        modal.style.color = 'var(--color-text-primary, #1a1a2e)';
        modal.style.fontFamily = 'var(--font-family, Inter, sans-serif)';
        return modal;
    }

    function _close(overlay, modal, result, resolve) {
        overlay.style.opacity = '0';
        modal.style.transform = 'scale(0.95)';
        setTimeout(() => {
            if (document.body.contains(overlay)) {
                document.body.removeChild(overlay);
            }
            if (resolve) resolve(result);
        }, 200);
    }

    function confirm(title, message, confirmText = 'ОК', cancelText = 'Отмена', danger = false) {
        return new Promise((resolve) => {
            const overlay = _createOverlay();
            const modal = _createModal();

            const confirmBtnStyle = danger
                ? 'padding:10px 16px; border-radius:8px; border:none; background:#ff6b6b; color:#fff; font-weight:600; cursor:pointer;'
                : 'padding:10px 16px; border-radius:8px; border:none; background:var(--color-accent, #6c5ce7); color:#fff; font-weight:600; cursor:pointer;';

            modal.innerHTML = `
                <h3 style="margin-top:0; font-size:18px; margin-bottom:8px;">${title}</h3>
                <p style="margin-top:0; color:var(--color-text-secondary, #555570); font-size:14px; margin-bottom:24px; line-height:1.5;">${message}</p>
                <div style="display:flex; justify-content:flex-end; gap:12px;">
                    <button id="dia-cancel" style="padding:10px 16px; border-radius:8px; border:1px solid var(--color-border, #cdcdd9); background:var(--color-bg-secondary, #e6e6ee); color:var(--color-text-primary, #1a1a2e); font-weight:500; cursor:pointer;">${cancelText}</button>
                    <button id="dia-ok" style="${confirmBtnStyle}">${confirmText}</button>
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            requestAnimationFrame(() => {
                overlay.style.opacity = '1';
                modal.style.transform = 'scale(1)';
            });

            modal.querySelector('#dia-cancel').addEventListener('click', () => _close(overlay, modal, false, resolve));
            modal.querySelector('#dia-ok').addEventListener('click', () => _close(overlay, modal, true, resolve));
        });
    }

    function alert(title, message) {
        return new Promise((resolve) => {
            const overlay = _createOverlay();
            const modal = _createModal();

            modal.innerHTML = `
                <h3 style="margin-top:0; font-size:18px; margin-bottom:8px;">${title}</h3>
                <p style="margin-top:0; color:var(--color-text-secondary, #555570); font-size:14px; margin-bottom:24px; line-height:1.5;">${message}</p>
                <div style="display:flex; justify-content:flex-end;">
                    <button id="dia-ok" style="padding:10px 16px; border-radius:8px; border:none; background:var(--color-accent, #6c5ce7); color:#fff; font-weight:600; cursor:pointer;">ОК</button>
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            requestAnimationFrame(() => {
                overlay.style.opacity = '1';
                modal.style.transform = 'scale(1)';
            });

            modal.querySelector('#dia-ok').addEventListener('click', () => _close(overlay, modal, true, resolve));
        });
    }

    return {
        confirm,
        alert
    };
})();
