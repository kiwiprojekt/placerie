export function debounce(func, timeout = 150) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => func.apply(this, args), timeout);
    };
}

export function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/-/g, "&#8209;");
}

export function generateId(prefix = 'id') {
    return prefix + '_' + Math.random().toString(36).slice(2, 9);
}

export function parseNames(text) {
    if (!text || !text.trim()) return [];
    text = text.normalize('NFC');
    const raw = text.split(/\r?\n/);
    const parsed = [];
    raw.forEach(line => {
        if (line.includes(',')) {
            parsed.push(...line.split(',').map(n => n.trim()).filter(n => n));
        } else {
            let clean = line.trim();
            if (clean.startsWith('"') && clean.endsWith('"'))
                clean = clean.slice(1, -1).trim();
            if (clean) parsed.push(clean);
        }
    });
    return parsed;
}

export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-item ${type}`;

    const textSpan = document.createElement('span');
    textSpan.textContent = message;
    toast.appendChild(textSpan);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close-btn';
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Close notification');
    closeBtn.addEventListener('click', () => {
        toast.style.animation = 'fadeOut 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
        setTimeout(() => toast.remove(), 300);
    });
    toast.appendChild(closeBtn);

    container.appendChild(toast);

    // Auto-remove toast after animation completes
    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.animation = 'fadeOut 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards';
            setTimeout(() => toast.remove(), 350);
        }
    }, 4000);
}

export function showConfirm(title, text, onConfirm) {
    const overlay = document.getElementById('confirm-modal-overlay');
    const titleEl = document.getElementById('confirm-modal-title');
    const textEl = document.getElementById('confirm-modal-text');
    const cancelBtn = document.getElementById('confirm-modal-cancel-btn');
    const confirmBtn = document.getElementById('confirm-modal-confirm-btn');

    if (!overlay || !titleEl || !textEl || !cancelBtn || !confirmBtn) {
        if (window.confirm(`${title}\n\n${text}`)) {
            onConfirm();
        }
        return;
    }

    titleEl.textContent = title;
    textEl.textContent = text;
    overlay.style.display = 'flex';

    const cleanup = () => {
        overlay.style.display = 'none';
        const newCancel = cancelBtn.cloneNode(true);
        const newConfirm = confirmBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
        confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
    };

    document.getElementById('confirm-modal-cancel-btn').addEventListener('click', () => {
        cleanup();
    });

    document.getElementById('confirm-modal-confirm-btn').addEventListener('click', () => {
        cleanup();
        onConfirm();
    });
}
