import * as guestStore from './guest-store.js';
import * as tagStore from './tag-store.js';
import { init as initGuestManager } from './guest-manager.js';
import { init as initPlaceCards, onLangChange as pcLangChange, onViewShow as pcOnViewShow, reload as pcReload } from './place-cards.js';
import { init as initSeatingMap, onLangChange as smLangChange, reload as smReload } from './seating-map.js';
import { init as initSeatingSheets, onLangChange as ssLangChange, onViewShow as ssOnViewShow, reload as ssReload } from './seating-sheets.js';
import { translateUI, t } from './i18n.js';
import { STORAGE_KEYS } from './constants.js';
import { showToast, showConfirm } from './utils.js';

// ── Lang ───────────────────────────────────────────────────────────────────
function loadLang() {
    return localStorage.getItem(STORAGE_KEYS.lang) || 'en';
}

function applyLang(lang) {
    document.documentElement.lang = lang;
    translateUI(lang);

    const flags = { en: '🇬🇧', pl: '🇵🇱' };
    const btn = document.getElementById('lang-dropdown-btn');
    if (btn) btn.textContent = flags[lang] || lang;

    document.querySelectorAll('.lang-option').forEach(opt =>
        opt.classList.toggle('active', opt.dataset.lang === lang)
    );
}

function setLang(lang) {
    localStorage.setItem(STORAGE_KEYS.lang, lang);
    applyLang(lang);
    pcLangChange(lang);
    smLangChange();
    ssLangChange(lang);
}

function initLangDropdown() {
    const btn  = document.getElementById('lang-dropdown-btn');
    const menu = document.getElementById('lang-dropdown-menu');

    btn.addEventListener('click', e => {
        e.stopPropagation();
        const open = menu.classList.toggle('open');
        btn.setAttribute('aria-expanded', open);
    });

    document.addEventListener('click', () => {
        menu.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
    });

    document.querySelectorAll('.lang-option').forEach(opt => {
        opt.addEventListener('click', () => {
            setLang(opt.dataset.lang);
            menu.classList.remove('open');
            btn.setAttribute('aria-expanded', 'false');
        });
    });
}

// ── View switching ─────────────────────────────────────────────────────────
const VIEWS = ['guests', 'place-cards', 'seating-map', 'seating-sheets'];
let activeView = 'guests';

function switchView(viewId) {
    activeView = viewId;
    VIEWS.forEach(id => {
        const el = document.getElementById(`view-${id}`);
        if (el) el.classList.toggle('app-view--active', id === viewId);
    });
    document.querySelectorAll('.nav-tab').forEach(tab =>
        tab.classList.toggle('active', tab.dataset.view === viewId)
    );

    if (viewId === 'place-cards') pcOnViewShow();
    if (viewId === 'seating-sheets') ssOnViewShow();

    // Print containers: only active print containers are enabled when on that view
    const pcPrint = document.getElementById('pc-print-container');
    const smMap   = document.getElementById('sm-print-map');
    const smList  = document.getElementById('sm-print-list');
    const ssPrint = document.getElementById('ss-print-container');
    if (pcPrint) pcPrint.dataset.activePrint = viewId === 'place-cards' ? '1' : '0';
    if (smMap)   smMap.dataset.activePrint   = viewId === 'seating-map' ? '1' : '0';
    if (smList)  smList.dataset.activePrint  = viewId === 'seating-map' ? '1' : '0';
    if (ssPrint) ssPrint.dataset.activePrint = viewId === 'seating-sheets' ? '1' : '0';
}

function initNavTabs() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => switchView(tab.dataset.view));
    });
}

// ── Global actions (Import / Export / Clear) ───────────────────────────────
function handleGlobalImport(file) {
    const reader = new FileReader();
    reader.onload = ev => {
        try {
            const parsed = JSON.parse(ev.target.result);
            let importedSomething = false;

            // 1. Tags
            if (parsed && typeof parsed === 'object' && parsed.tags) {
                tagStore.replaceAll(parsed.tags);
                importedSomething = true;
            }

            // 2. Guests
            if (Array.isArray(parsed)) {
                guestStore.replaceAll(parsed);
                importedSomething = true;
            } else if (parsed && typeof parsed === 'object' && parsed.guests) {
                guestStore.replaceAll(parsed.guests);
                importedSomething = true;
            }

            // 3. Seating Map
            if (parsed && typeof parsed === 'object' && (parsed.tables || parsed.seats)) {
                const smData = {
                    tables: parsed.tables || [],
                    seats: parsed.seats || {},
                    rsvpFilter: parsed.rsvpFilter,
                    viewMode: parsed.viewMode || 'map',
                    panelPos: parsed.panelPos || { x: 1, y: 1 }
                };
                localStorage.setItem(STORAGE_KEYS.seatingMap, JSON.stringify(smData));
                importedSomething = true;
            }

            // 4. Place Cards settings
            if (parsed && typeof parsed === 'object') {
                const pcKeys = ['fontFamily', 'fontSize', 'fontWeight', 'fontColor', 'fontStyle', 'sizingMode', 'imageData', 'imageFileName', 'imageSize', 'imageSpacing', 'verticalOffset'];
                const hasPCKeys = pcKeys.some(k => parsed[k] !== undefined);
                if (hasPCKeys || parsed.placeCards) {
                    const pcData = parsed.placeCards || parsed;
                    localStorage.setItem(STORAGE_KEYS.placeCards, typeof pcData === 'object' ? JSON.stringify(pcData) : pcData);
                    importedSomething = true;
                }
            }

            // 5. Seating Sheets settings
            if (parsed && typeof parsed === 'object') {
                if (parsed.seatingSheets) {
                    localStorage.setItem(STORAGE_KEYS.seatingSheets, typeof parsed.seatingSheets === 'object' ? JSON.stringify(parsed.seatingSheets) : parsed.seatingSheets);
                    importedSomething = true;
                }
            }

            if (importedSomething) {
                pcReload();
                smReload();
                ssReload();
                showToast(t('alert-import-success'), 'success');
            } else {
                throw new Error('Invalid format');
            }
        } catch (err) {
            console.error('Import failed:', err);
            showToast(t('alert-import-error'), 'error');
        }
    };
    reader.onerror = () => showToast(t('alert-import-error'), 'error');
    reader.readAsText(file);
}

function handleGlobalExport() {
    const guests = guestStore.getAll();
    const tags = tagStore.getAll();

    let seatingMap = null;
    try {
        const rawSM = localStorage.getItem(STORAGE_KEYS.seatingMap);
        if (rawSM) seatingMap = JSON.parse(rawSM);
    } catch (e) {
        console.error('Failed to read seating map state:', e);
    }

    let placeCards = null;
    try {
        const rawPC = localStorage.getItem(STORAGE_KEYS.placeCards);
        if (rawPC) placeCards = JSON.parse(rawPC);
    } catch (e) {
        console.error('Failed to read place cards state:', e);
    }

    let seatingSheets = null;
    try {
        const rawSS = localStorage.getItem(STORAGE_KEYS.seatingSheets);
        if (rawSS) seatingSheets = JSON.parse(rawSS);
    } catch (e) {
        console.error('Failed to read seating sheets state:', e);
    }

    const data = {
        version: 1,
        guests,
        tags,
        ...(seatingMap || {}),
        placeCards,
        seatingSheets
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'party-tools-workspace.json';
    a.click();
    URL.revokeObjectURL(url);
}

function handleGlobalClear() {
    showConfirm(t('confirm-title-clear'), t('alert-clear-confirm'), () => {
        guestStore.clear();
        tagStore.clear();
        localStorage.removeItem(STORAGE_KEYS.seatingMap);
        localStorage.removeItem(STORAGE_KEYS.placeCards);
        localStorage.removeItem(STORAGE_KEYS.seatingSheets);

        pcReload();
        smReload();
        ssReload();

        const lang = localStorage.getItem(STORAGE_KEYS.lang) || 'en';
        const msg = lang === 'pl' ? 'Wszystkie dane zostały wyczyszczone.' : 'All data has been cleared.';
        showToast(msg, 'info');
    });
}

function initGlobalActions() {
    const fileInput = document.getElementById('global-import-file');

    document.getElementById('global-import-btn').addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        handleGlobalImport(file);
        e.target.value = '';
    });

    document.getElementById('global-export-btn').addEventListener('click', () => {
        handleGlobalExport();
    });

    document.getElementById('global-clear-btn').addEventListener('click', () => {
        handleGlobalClear();
    });
}

// ── Theme (Dark Mode) ──────────────────────────────────────────────────────
function initTheme() {
    const btn = document.getElementById('theme-toggle-btn');
    if (!btn) return;

    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = savedTheme === 'dark' || (!savedTheme && prefersDark);

    if (isDark) {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }

    btn.addEventListener('click', () => {
        const dark = document.body.classList.toggle('dark-theme');
        localStorage.setItem('theme', dark ? 'dark' : 'light');
    });
}

// ── Bootstrap ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    tagStore.load();
    guestStore.load();

    const lang = loadLang();
    applyLang(lang);

    initTheme();
    initLangDropdown();
    initNavTabs();
    initGlobalActions();

    initGuestManager(document.getElementById('view-guests'));
    initPlaceCards();
    initSeatingMap();
    initSeatingSheets();

    switchView('guests');
});
