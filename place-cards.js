import * as guestStore from './guest-store.js';
import { FONT_DATA, WEIGHT_NAMES, PAGE_SIZES, STORAGE_KEYS, RSVP_STATUSES, RSVP_COLORS } from './constants.js';
import { debounce, escapeHtml, showToast, showConfirm } from './utils.js';
import { i18n, translateUI, getLang, t, buildRsvpFilter } from './i18n.js';

const DEFAULT_RSVP_FILTER = ['confirmed', 'maybe', 'pending'];

let namesList = [];
let currentFontStyle = 'normal';
let rsvpFilter = [...DEFAULT_RSVP_FILTER];
let isLoadingData = false;

// ── Elements (scoped to place-cards view) ──────────────────────────────────
const el = {};

function qid(id) { return document.getElementById(id); }

function initElements() {
    el.fontFamily          = qid('pc-font-family');
    el.fontColor           = qid('pc-font-color');
    el.fontSize            = qid('pc-font-size');
    el.weightLabel         = qid('pc-weight-label');
    el.weightControlWrapper= qid('pc-weight-control-wrapper');
    el.styleRegular        = qid('pc-style-regular');
    el.styleItalic         = qid('pc-style-italic');
    el.sizingMode          = qid('pc-sizing-mode');
    el.dimensionsInputs    = qid('pc-dimensions-inputs');
    el.gridInputs          = qid('pc-grid-inputs');
    el.gridCols            = qid('pc-grid-cols');
    el.gridRows            = qid('pc-grid-rows');
    el.cardWidth           = qid('pc-card-width');
    el.cardHeight          = qid('pc-card-height');
    el.cardPadding         = qid('pc-card-padding');
    el.cutGuides           = qid('pc-cut-guides');
    el.pageSize            = qid('pc-page-size');
    el.marginSize          = qid('pc-margin-size');
    el.marginVisibility    = qid('pc-margin-visibility');
    el.previewZoom         = qid('pc-preview-zoom');
    el.previewContainer    = qid('pc-preview-container');
    el.printContainer      = qid('pc-print-container');
    el.printBtn            = qid('pc-print-btn');
    el.previewStats        = qid('pc-preview-stats');
    el.cutMode             = qid('pc-cut-mode');
    el.imageUpload         = qid('pc-image-upload');
    el.imageUploadBtn      = qid('pc-image-upload-btn');
    el.imageRemoveBtn      = qid('pc-image-remove-btn');
    el.imageData           = qid('pc-image-data');
    el.imageFileName       = qid('pc-image-filename');
    el.imageSize           = qid('pc-image-size');
    el.imageSpacing        = qid('pc-image-spacing');
    el.verticalOffset      = qid('pc-vertical-offset');
    el.verticalOffsetVal   = qid('pc-vertical-offset-val');
    el.rsvpFilter          = qid('pc-rsvp-filter');
    el.rsvpCount           = qid('pc-rsvp-count');
}

const debouncedUpdate = debounce(() => updatePreview());

// ── RSVP Filter ───────────────────────────────────────────────────────────
function buildRsvpFilterUI() {
    buildRsvpFilter(el.rsvpFilter, rsvpFilter, refreshNamesFromStore);
}

function refreshNamesFromStore() {
    const guests = guestStore.getAll();
    namesList = guests
        .filter(g => rsvpFilter.includes(g.rsvp))
        .map(g => g.name);
    debouncedUpdate();
}

// ── Persistence ────────────────────────────────────────────────────────────
function getView() { return document.getElementById('view-place-cards'); }

function saveData() {
    if (isLoadingData) return;
    const state = {
        lang: getLang(),
        fontWeight: getCurrentWeight(),
        fontStyle: currentFontStyle,
        rsvpFilter,
    };
    getView().querySelectorAll('[data-state]').forEach(input => {
        const key = input.dataset.state;
        state[key] = input.type === 'checkbox' ? input.checked : input.value;
    });
    try {
        localStorage.setItem(STORAGE_KEYS.placeCards, JSON.stringify(state));
    } catch (e) {
        if (e.name === 'QuotaExceededError') showToast(t('alert-quota-exceeded'), 'error');
        console.error('Save failed:', e);
    }
}

function loadData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.placeCards);
        if (!raw) return false;
        const state = JSON.parse(raw);

        isLoadingData = true;

        getView().querySelectorAll('[data-state]').forEach(input => {
            const key = input.dataset.state;
            if (state[key] !== undefined) {
                if (input.type === 'checkbox') input.checked = state[key];
                else input.value = state[key];
            }
        });

        if (Array.isArray(state.rsvpFilter)) rsvpFilter = state.rsvpFilter;
        if (state.fontStyle) setFontStyle(state.fontStyle);
        if (state.sizingMode) {
            el.dimensionsInputs.style.display = state.sizingMode === 'grid' ? 'none' : 'flex';
            el.gridInputs.style.display       = state.sizingMode === 'grid' ? 'flex' : 'none';
        }

        // Build weight control with saved weight (clamped to font's range)
        const fontData = FONT_DATA[el.fontFamily.value];
        let savedWeight = state.fontWeight ? parseInt(state.fontWeight) : null;
        if (fontData && savedWeight !== null) {
            if (fontData.variable) savedWeight = Math.min(fontData.max, Math.max(fontData.min, savedWeight));
            else if (!fontData.weights.includes(savedWeight)) savedWeight = null;
        }
        buildWeightControl(el.fontFamily.value, savedWeight);
        updateItalicToggle(el.fontFamily.value);
        buildRsvpFilterUI();

        if (state.imageData) {
            el.imageRemoveBtn.disabled = false;
            el.imageUploadBtn.disabled = true;
            if (state.imageFileName) {
                const span = el.imageUploadBtn.querySelector('span');
                span.textContent = truncateFileName(state.imageFileName);
                span.removeAttribute('data-i18n');
            }
        } else {
            el.imageRemoveBtn.disabled = true;
            el.imageUploadBtn.disabled = false;
        }

        if (state.verticalOffset !== undefined) {
            el.verticalOffsetVal.textContent = state.verticalOffset;
        }

        isLoadingData = false;
        return true;
    } catch (e) {
        isLoadingData = false;
        console.error('loadData failed:', e);
        return false;
    }
}

// ── Weight control ─────────────────────────────────────────────────────────
function getCurrentWeight() {
    const slider = el.weightControlWrapper.querySelector('input[type="range"]');
    if (slider) return slider.value;
    const select = el.weightControlWrapper.querySelector('select');
    if (select) return select.value;
    const fixed = el.weightControlWrapper.querySelector('[data-fixed-weight]');
    return fixed ? fixed.dataset.fixedWeight : '400';
}

function buildWeightControl(fontValue, forceWeight = null) {
    const data = FONT_DATA[fontValue];
    if (!data) return;

    const prevWeight = forceWeight !== null ? forceWeight : getCurrentWeight();

    if (data.variable) {
        const w = Math.min(data.max, Math.max(data.min, parseInt(prevWeight) || data.defaultWeight));
        el.weightLabel.textContent = `${t('label-weight')}: ${w}`;
        el.weightControlWrapper.innerHTML = `
            <div class="weight-slider-wrapper">
                <input type="range" id="pc-font-weight" min="${data.min}" max="${data.max}" step="50" value="${w}">
            </div>`;
        el.weightControlWrapper.querySelector('input').addEventListener('input', () => {
            el.weightLabel.textContent = `${t('label-weight')}: ${getCurrentWeight()}`;
            updatePreview();
        });
    } else {
        const best = data.weights.reduce((c, w) =>
            Math.abs(w - prevWeight) < Math.abs(c - prevWeight) ? w : c, data.weights[0]);
        el.weightLabel.textContent = t('label-weight');
        const options = data.weights.map(wt =>
            `<option value="${wt}" ${wt === best ? 'selected' : ''}>${WEIGHT_NAMES[wt] || wt}</option>`
        ).join('');
        el.weightControlWrapper.innerHTML = `<select id="pc-font-weight" ${data.weights.length === 1 ? 'disabled' : ''}>${options}</select>`;
        el.weightControlWrapper.querySelector('select').addEventListener('change', debouncedUpdate);
    }
}

function updateItalicToggle(fontValue) {
    const data = FONT_DATA[fontValue];
    const supports = data ? data.italic : true;
    el.styleItalic.disabled = !supports;
    if (!supports && currentFontStyle === 'italic') setFontStyle('normal');
}

function setFontStyle(value) {
    currentFontStyle = value;
    el.styleRegular.classList.toggle('active', value === 'normal');
    el.styleItalic.classList.toggle('active',  value === 'italic');
}

// ── Custom font select ─────────────────────────────────────────────────────
function initCustomFontSelect() {
    const select = el.fontFamily;
    select.style.display = 'none';

    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select-wrapper';
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);

    const display = document.createElement('div');
    display.className = 'custom-select-display';

    const updateDisplay = () => {
        const opt = select.options[select.selectedIndex];
        if (opt) {
            display.textContent = opt.textContent;
            display.style.fontFamily = opt.style.fontFamily || opt.value;
        }
    };
    updateDisplay();

    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'custom-select-options';

    Array.from(select.options).forEach((opt, i) => {
        const div = document.createElement('div');
        div.className = 'custom-option' + (i === select.selectedIndex ? ' selected' : '');
        div.textContent = opt.textContent;
        div.style.fontFamily = opt.style.fontFamily || opt.value;
        div.addEventListener('click', () => {
            select.selectedIndex = i;
            select.dispatchEvent(new Event('change'));
            optionsContainer.querySelectorAll('.custom-option').forEach(d => d.classList.remove('selected'));
            div.classList.add('selected');
            updateDisplay();
            optionsContainer.classList.remove('open');
        });
        optionsContainer.appendChild(div);
    });

    wrapper.append(display, optionsContainer);

    display.addEventListener('click', e => { e.stopPropagation(); optionsContainer.classList.toggle('open'); });
    document.addEventListener('click', () => optionsContainer.classList.remove('open'));

    select.addEventListener('change', () => {
        updateDisplay();
        optionsContainer.querySelectorAll('.custom-option').forEach((d, i) =>
            d.classList.toggle('selected', i === select.selectedIndex));
    });
}

// ── Preview ────────────────────────────────────────────────────────────────
function updatePreview() {
    const settings = {
        fontFamily:   el.fontFamily.value,
        fontColor:    el.fontColor.value,
        fontSize:     el.fontSize.value + 'pt',
        fontWeight:   getCurrentWeight(),
        fontStyle:    currentFontStyle,
        cardPadding:  Math.max(0, parseFloat(el.cardPadding.value) || 0),
        cutGuides:    el.cutGuides.value,
        pageSize:     el.pageSize.value,
        imageData:    el.imageData.value,
        imageSize:    parseFloat(el.imageSize.value) || 15,
        imageSpacing: parseFloat(el.imageSpacing.value) || 2,
        verticalOffset: parseFloat(el.verticalOffset.value) || 0,
    };

    const pageDims     = PAGE_SIZES[settings.pageSize];
    const margin       = Math.max(0, parseFloat(el.marginSize.value) || 0);
    const printAreaW   = pageDims.width  - margin * 2;
    const printAreaH   = pageDims.height - margin * 2;

    let cardWidth, cardHeight;
    if (el.sizingMode.value === 'grid') {
        const gCols = Math.max(1, parseInt(el.gridCols.value) || 2);
        const gRows = Math.max(1, parseInt(el.gridRows.value) || 5);
        cardWidth  = (printAreaW / gCols) - 0.01;
        cardHeight = (printAreaH / gRows) - 0.01;
    } else {
        cardWidth  = Math.max(10, parseFloat(el.cardWidth.value) || 90);
        cardHeight = Math.max(10, parseFloat(el.cardHeight.value) || 50);
    }
    settings.cardWidth  = cardWidth;
    settings.cardHeight = cardHeight;

    const cols         = Math.floor(printAreaW / cardWidth);
    const rows         = Math.floor(printAreaH / cardHeight);
    const cardsPerPage = Math.max(1, cols * rows);
    const displayNames = namesList.length > 0 ? namesList : ['Guest Name'];
    const totalPages   = Math.ceil(displayNames.length / cardsPerPage);
    const nameCount    = namesList.length;

    el.previewStats.textContent = t('stats', nameCount, totalPages);

    if (el.rsvpCount) {
        el.rsvpCount.textContent = nameCount > 0 ? t('pc-rsvp-count', nameCount) : '';
    }

    const cutMode   = el.cutMode.value;
    const guideClass = settings.cutGuides;
    const marginVis  = el.marginVisibility.value;

    const previewFrag = document.createDocumentFragment();
    const printFrag   = document.createDocumentFragment();

    for (let p = 0; p < totalPages; p++) {
        const simPage   = makePage('sim-page',   pageDims, margin);
        const printPage = makePage('print-page', pageDims, margin);

        const totalBlockW = cols * cardWidth;
        const totalBlockH = rows * cardHeight;

        const addLine = (type, pos) => {
            if (guideClass === 'none') return;
            const blockStart = margin;
            const blockEnd   = type === 'horizontal' ? margin + totalBlockW : margin + totalBlockH;
            const pageMax    = type === 'horizontal' ? pageDims.width : pageDims.height;

            const seg = (start, end) => {
                if (start >= end) return null;
                const line = document.createElement('div');
                line.className = `cut-line ${type} guide-${guideClass}`;
                if (type === 'horizontal') {
                    line.style.top = `${pos}mm`; line.style.left = `${start}mm`; line.style.width = `${end - start}mm`;
                } else {
                    line.style.left = `${pos}mm`; line.style.top = `${start}mm`; line.style.height = `${end - start}mm`;
                }
                return line;
            };

            if (cutMode === 'external') {
                const s1 = seg(0, blockStart);
                if (s1) { simPage.appendChild(s1.cloneNode(true)); printPage.appendChild(s1); }
                const s2 = seg(blockEnd, pageMax);
                if (s2) { simPage.appendChild(s2.cloneNode(true)); printPage.appendChild(s2); }
            } else {
                const s = seg(0, pageMax);
                if (s) { simPage.appendChild(s.cloneNode(true)); printPage.appendChild(s); }
            }
        };

        for (let r = 0; r <= rows; r++) addLine('horizontal', margin + r * cardHeight);
        for (let c = 0; c <= cols; c++) addLine('vertical',   margin + c * cardWidth);

        if (marginVis !== 'none' && margin > 0) {
            const mg = () => {
                const d = document.createElement('div');
                d.style.cssText = `position:absolute;top:${margin}mm;left:${margin}mm;right:${margin}mm;bottom:${margin}mm;border:1px dashed rgba(255,0,0,0.4);pointer-events:none;z-index:10;`;
                return d;
            };
            simPage.appendChild(mg());
            if (marginVis === 'preview_print') printPage.appendChild(mg());
        }

        const start = p * cardsPerPage;
        const end   = Math.min(start + cardsPerPage, displayNames.length);

        for (let i = start; i < end; i++) {
            const name = displayNames[i];
            const contentStyle = `font-family:${settings.fontFamily};color:${settings.fontColor};font-size:${settings.fontSize};font-weight:${settings.fontWeight};font-style:${settings.fontStyle};`;
            const cardStyle    = `width:${cardWidth}mm;height:${cardHeight}mm;padding:${settings.cardPadding}mm;`;
            const imgHtml      = settings.imageData
                ? `<img src="${settings.imageData}" style="height:${settings.imageSize}mm;margin-top:${settings.imageSpacing}mm;display:block;">`
                : '';
            const inner = `<div class="card-content" style="transform:translateY(${settings.verticalOffset}mm);"><span style="${contentStyle}">${escapeHtml(name)}</span>${imgHtml}</div>`;

            const simCard   = document.createElement('div');
            simCard.className   = 'sim-card';
            simCard.style.cssText = cardStyle;
            simCard.innerHTML = inner;
            simPage.appendChild(simCard);

            const printCard = document.createElement('div');
            printCard.className   = 'print-card';
            printCard.style.cssText = cardStyle;
            printCard.innerHTML = inner;
            printPage.appendChild(printCard);
        }

        previewFrag.appendChild(simPage);
        printFrag.appendChild(printPage);
    }

    el.previewContainer.innerHTML = '';
    el.printContainer.innerHTML   = '';
    el.previewContainer.appendChild(previewFrag);
    el.printContainer.appendChild(printFrag);

    updatePageCss(settings.pageSize);
    saveData();
    applyZoom();
}

function makePage(cls, pageDims, margin) {
    const p = document.createElement('div');
    p.className = cls;
    p.style.width   = `${pageDims.width}mm`;
    p.style.height  = `${pageDims.height}mm`;
    p.style.padding = `${margin}mm`;
    return p;
}

// ── Zoom ──────────────────────────────────────────────────────────────────
function applyZoom() {
    const val   = el.previewZoom.value;
    const pages = el.previewContainer.querySelectorAll('.sim-page');
    if (!pages.length) return;

    if (val === 'fit') {
        const containerW = el.previewContainer.clientWidth  - 96;
        const containerH = el.previewContainer.clientHeight - 96;
        pages.forEach(p => p.style.transform = 'none');
        const pw = pages[0].offsetWidth;
        const ph = pages[0].offsetHeight;
        if (!pw || !ph || containerW <= 0 || containerH <= 0) return;
        const scale = Math.max(0.1, Math.min(containerW / pw, containerH / ph, 1));
        pages.forEach(p => {
            p.style.transform       = `scale(${scale})`;
            p.style.transformOrigin = 'top center';
            p.style.marginBottom    = `-${ph * (1 - scale)}px`;
        });
    } else {
        const scale = parseFloat(val);
        const heights = Array.from(pages).map(p => p.offsetHeight);
        pages.forEach((p, i) => {
            p.style.transform       = `scale(${scale})`;
            p.style.transformOrigin = 'top center';
            p.style.marginBottom    = `-${heights[i] * (1 - scale)}px`;
        });
    }
}

function updatePageCss(pageSize) {
    let tag = document.getElementById('pc-dynamic-print-style');
    if (!tag) {
        tag = document.createElement('style');
        tag.id = 'pc-dynamic-print-style';
        document.head.appendChild(tag);
    }
    tag.innerHTML = `@media print { @page { size: ${pageSize === 'A4' ? 'A4' : 'letter'}; margin: 0; } }`;
}

// ── Events ────────────────────────────────────────────────────────────────
function initEvents() {
    el.fontFamily.addEventListener('change', () => {
        buildWeightControl(el.fontFamily.value);
        updateItalicToggle(el.fontFamily.value);
        debouncedUpdate();
    });

    el.styleRegular.addEventListener('click', () => { setFontStyle('normal'); debouncedUpdate(); });
    el.styleItalic.addEventListener('click',  () => {
        if (!el.styleItalic.disabled) { setFontStyle('italic'); debouncedUpdate(); }
    });

    el.sizingMode.addEventListener('change', () => {
        const isGrid = el.sizingMode.value === 'grid';
        el.dimensionsInputs.style.display = isGrid ? 'none' : 'flex';
        el.gridInputs.style.display       = isGrid ? 'flex' : 'none';
    });

    el.previewZoom.addEventListener('change', () => { applyZoom(); saveData(); });
    window.addEventListener('resize', () => { if (el.previewZoom.value === 'fit') applyZoom(); });

    const controlIds = ['fontColor','fontSize','cardWidth','cardHeight','cardPadding',
        'cutGuides','pageSize','sizingMode','gridCols','gridRows',
        'marginSize','marginVisibility','cutMode','imageSize','imageSpacing'];
    controlIds.forEach(id => {
        const input = el[id];
        if (input) {
            input.addEventListener('input',  debouncedUpdate);
            input.addEventListener('change', debouncedUpdate);
        }
    });

    el.verticalOffset.addEventListener('input', () => {
        el.verticalOffsetVal.textContent = el.verticalOffset.value;
        updatePreview();
    });

    // Image decoration
    el.imageUploadBtn.addEventListener('click', () => el.imageUpload.click());
    el.imageUpload.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { showToast(t('alert-image-too-large'), 'error'); e.target.value = ''; return; }
        const reader = new FileReader();
        reader.onload = ev => {
            el.imageData.value     = ev.target.result;
            el.imageFileName.value = file.name;
            const span = el.imageUploadBtn.querySelector('span');
            span.textContent = truncateFileName(file.name);
            span.removeAttribute('data-i18n');
            el.imageRemoveBtn.disabled = false;
            el.imageUploadBtn.disabled = true;
            debouncedUpdate();
        };
        reader.onerror = () => showToast(t('alert-image-too-large'), 'error');
        reader.readAsDataURL(file);
        e.target.value = '';
    });
    el.imageRemoveBtn.addEventListener('click', () => {
        el.imageData.value = '';
        el.imageFileName.value = '';
        const span = el.imageUploadBtn.querySelector('span');
        span.setAttribute('data-i18n', 'label-image-upload');
        span.textContent = t('label-image-upload');
        el.imageRemoveBtn.disabled = true;
        el.imageUploadBtn.disabled = false;
        debouncedUpdate();
    });

    // Print
    el.printBtn.addEventListener('click', () => {
        if (namesList.length === 0) { showToast(t('alert-no-names'), 'warning'); return; }
        window.print();
    });
}

function truncateFileName(name, max = 16) {
    if (name.length <= max) return name;
    return name.substring(0, 10) + '...' + name.substring(name.length - 4);
}

// ── Public init ────────────────────────────────────────────────────────────
export function init() {
    initElements();
    initCustomFontSelect();
    initEvents();
    buildRsvpFilterUI();

    if (!loadData()) {
        buildWeightControl(el.fontFamily.value);
        updateItalicToggle(el.fontFamily.value);
    }

    refreshNamesFromStore();

    // React to guest store changes
    guestStore.subscribe(() => refreshNamesFromStore());
}

export function onViewShow() {
    setTimeout(() => {
        applyZoom();
    }, 50);
}

export function onLangChange(lang) {
    // Update dynamic weight label
    if (el.weightLabel && el.weightLabel.textContent.includes(':')) {
        el.weightLabel.textContent = `${i18n[lang]['label-weight']}: ${getCurrentWeight()}`;
    } else if (el.weightLabel) {
        el.weightLabel.textContent = i18n[lang]['label-weight'];
    }
    buildRsvpFilterUI();
    updatePreview();
}

// ── Data actions (called from global nav bar) ──────────────────────────────

export function importData(file) {
    const reader = new FileReader();
    reader.onload = ev => {
        try {
            JSON.parse(ev.target.result);
            localStorage.setItem(STORAGE_KEYS.placeCards, ev.target.result);
            if (loadData()) {
                refreshNamesFromStore();
                showToast(t('alert-import-success'), 'success');
            }
        } catch { showToast(t('alert-import-error'), 'error'); }
    };
    reader.onerror = () => showToast(t('alert-import-error'), 'error');
    reader.readAsText(file);
}

export function exportData() {
    saveData();
    const raw = localStorage.getItem(STORAGE_KEYS.placeCards);
    if (!raw) return;
    const blob = new Blob([raw], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'place-cards-settings.json'; a.click();
    URL.revokeObjectURL(url);
}

export function clearData() {
    showConfirm(t('confirm-title-clear'), t('alert-clear-confirm'), () => {
        localStorage.removeItem(STORAGE_KEYS.placeCards);
        location.reload();
    });
}

export function reload() {
    loadData();
    refreshNamesFromStore();
}
