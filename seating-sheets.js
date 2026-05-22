import * as guestStore from './guest-store.js';
import { FONT_DATA, WEIGHT_NAMES, PAGE_SIZES, STORAGE_KEYS } from './constants.js';
import { debounce, escapeHtml, showToast } from './utils.js';
import { getLang, t, buildRsvpFilter } from './i18n.js';

const DEFAULT_RSVP_FILTER = ['confirmed', 'maybe', 'pending'];

let seatingMapData = { tables: [], seats: {} };
let currentTableFontStyle = 'normal';
let currentGuestFontStyle = 'normal';
let rsvpFilter = [...DEFAULT_RSVP_FILTER];
let isLoadingData = false;

// ── Elements (scoped to seating-sheets view) ──────────────────────────────
const el = {};

function qid(id) { return document.getElementById(id); }

function initElements() {
    el.tableFontFamily      = qid('ss-table-font-family');
    el.tableFontSize        = qid('ss-table-font-size');
    el.tableWeightLabel     = qid('ss-table-weight-label');
    el.tableWeightWrapper   = qid('ss-table-weight-control-wrapper');
    el.tableStyleRegular    = qid('ss-table-style-regular');
    el.tableStyleItalic     = qid('ss-table-style-italic');
    el.tableFontColor       = qid('ss-table-font-color');

    el.guestFontFamily      = qid('ss-guest-font-family');
    el.guestFontSize        = qid('ss-guest-font-size');
    el.guestWeightLabel     = qid('ss-guest-weight-label');
    el.guestWeightWrapper   = qid('ss-guest-weight-control-wrapper');
    el.guestStyleRegular    = qid('ss-guest-style-regular');
    el.guestStyleItalic     = qid('ss-guest-style-italic');
    el.guestFontColor       = qid('ss-guest-font-color');

    el.imageUploadTop       = qid('ss-image-upload-top');
    el.imageUploadTopBtn    = qid('ss-image-upload-top-btn');
    el.imageRemoveTopBtn    = qid('ss-image-remove-top-btn');
    el.imageDataTop         = qid('ss-image-data-top');
    el.imageFileNameTop     = qid('ss-image-filename-top');
    el.imageSizeTop         = qid('ss-image-size-top');
    el.imageSpacingTop       = qid('ss-image-spacing-top');

    el.imageUploadBottom    = qid('ss-image-upload-bottom');
    el.imageUploadBottomBtn = qid('ss-image-upload-bottom-btn');
    el.imageRemoveBottomBtn = qid('ss-image-remove-bottom-btn');
    el.imageDataBottom      = qid('ss-image-data-bottom');
    el.imageFileNameBottom  = qid('ss-image-filename-bottom');
    el.imageSizeBottom      = qid('ss-image-size-bottom');
    el.imageSpacingBottom    = qid('ss-image-spacing-bottom');

    el.sizingMode           = qid('ss-sizing-mode');
    el.dimensionsInputs     = qid('ss-dimensions-inputs');
    el.gridInputs           = qid('ss-grid-inputs');
    el.gridCols             = qid('ss-grid-cols');
    el.gridRows             = qid('ss-grid-rows');
    el.cardWidth            = qid('ss-card-width');
    el.cardHeight           = qid('ss-card-height');
    el.cardPadding          = qid('ss-card-padding');
    el.verticalOffset       = qid('ss-vertical-offset');
    el.verticalOffsetVal    = qid('ss-vertical-offset-val');
    el.tableHeaderSpacingTop   = qid('ss-table-spacing-top');
    el.tableHeaderSpacingTopVal = qid('ss-table-spacing-top-val');
    el.tableHeaderSpacingBottom   = qid('ss-table-spacing-bottom');
    el.tableHeaderSpacingBottomVal = qid('ss-table-spacing-bottom-val');

    el.pageSize             = qid('ss-page-size');
    el.pageOrientation      = qid('ss-page-orientation');
    el.marginSize           = qid('ss-margin-size');
    el.marginVisibility     = qid('ss-margin-visibility');
    el.cutGuides            = qid('ss-cut-guides');
    el.cutMode              = qid('ss-cut-mode');

    el.previewZoom          = qid('ss-preview-zoom');
    el.previewStats         = qid('ss-preview-stats');
    el.previewContainer     = qid('ss-preview-container');
    el.printContainer       = qid('ss-print-container');
    el.printBtn             = qid('ss-print-btn');
    el.rsvpFilter           = qid('ss-rsvp-filter');
    el.rsvpCount            = qid('ss-rsvp-count');
}

const debouncedUpdate = debounce(() => updatePreview());

// ── RSVP Filter ───────────────────────────────────────────────────────────
function buildRsvpFilterUI() {
    buildRsvpFilter(el.rsvpFilter, rsvpFilter, () => {
        refreshDataFromStore();
    });
}

function refreshDataFromStore() {
    const smRaw = localStorage.getItem(STORAGE_KEYS.seatingMap);
    if (smRaw) {
        try {
            seatingMapData = JSON.parse(smRaw);
        } catch (e) {
            console.error('Failed to parse seating map:', e);
            seatingMapData = { tables: [], seats: {} };
        }
    } else {
        seatingMapData = { tables: [], seats: {} };
    }
    
    // Count guests matching filter seated at tables
    let activeSeatedCount = 0;
    if (seatingMapData.tables && seatingMapData.seats) {
        seatingMapData.tables.forEach(table => {
            const tableSeats = seatingMapData.seats[table.id] || [];
            tableSeats.forEach(guestId => {
                if (guestId) {
                    const guest = guestStore.getById(guestId);
                    if (guest && rsvpFilter.includes(guest.rsvp)) {
                        activeSeatedCount++;
                    }
                }
            });
        });
    }

    if (el.rsvpCount) {
        el.rsvpCount.textContent = activeSeatedCount > 0 ? t('pc-rsvp-count', activeSeatedCount) : '';
    }

    debouncedUpdate();
}

// ── Persistence ────────────────────────────────────────────────────────────
function getView() { return document.getElementById('view-seating-sheets'); }

function saveData() {
    if (isLoadingData) return;
    const state = {
        lang: getLang(),
        tableFontWeight: getCurrentTableWeight(),
        tableFontStyle: currentTableFontStyle,
        guestFontWeight: getCurrentGuestWeight(),
        guestFontStyle: currentGuestFontStyle,
        rsvpFilter,
    };
    getView().querySelectorAll('[data-state]').forEach(input => {
        const key = input.dataset.state;
        state[key] = input.type === 'checkbox' ? input.checked : input.value;
    });
    try {
        localStorage.setItem(STORAGE_KEYS.seatingSheets, JSON.stringify(state));
    } catch (e) {
        if (e.name === 'QuotaExceededError') showToast(t('alert-quota-exceeded'), 'error');
        console.error('Save failed:', e);
    }
}

function loadData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.seatingSheets);
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
        if (state.tableFontStyle) setTableFontStyle(state.tableFontStyle);
        if (state.guestFontStyle) setGuestFontStyle(state.guestFontStyle);
        if (state.sizingMode) {
            el.dimensionsInputs.style.display = state.sizingMode === 'grid' ? 'none' : 'flex';
            el.gridInputs.style.display       = state.sizingMode === 'grid' ? 'flex' : 'none';
        }

        // Table Weight
        const tableFontData = FONT_DATA[el.tableFontFamily.value];
        let savedTableWeight = state.tableFontWeight ? parseInt(state.tableFontWeight) : null;
        if (tableFontData && savedTableWeight !== null) {
            if (tableFontData.variable) savedTableWeight = Math.min(tableFontData.max, Math.max(tableFontData.min, savedTableWeight));
            else if (!tableFontData.weights.includes(savedTableWeight)) savedTableWeight = null;
        }
        buildTableWeightControl(el.tableFontFamily.value, savedTableWeight);
        updateTableItalicToggle(el.tableFontFamily.value);

        // Guest Weight
        const guestFontData = FONT_DATA[el.guestFontFamily.value];
        let savedGuestWeight = state.guestFontWeight ? parseInt(state.guestFontWeight) : null;
        if (guestFontData && savedGuestWeight !== null) {
            if (guestFontData.variable) savedGuestWeight = Math.min(guestFontData.max, Math.max(guestFontData.min, savedGuestWeight));
            else if (!guestFontData.weights.includes(savedGuestWeight)) savedGuestWeight = null;
        }
        buildGuestWeightControl(el.guestFontFamily.value, savedGuestWeight);
        updateGuestItalicToggle(el.guestFontFamily.value);

        buildRsvpFilterUI();

        // Image Decor Buttons (Top)
        if (state.imageDataTop) {
            el.imageRemoveTopBtn.disabled = false;
            el.imageUploadTopBtn.disabled = true;
            if (state.imageFileNameTop) {
                const span = el.imageUploadTopBtn.querySelector('span');
                span.textContent = truncateFileName(state.imageFileNameTop);
                span.removeAttribute('data-i18n');
            }
        } else {
            el.imageRemoveTopBtn.disabled = true;
            el.imageUploadTopBtn.disabled = false;
        }

        // Image Decor Buttons (Bottom)
        if (state.imageDataBottom) {
            el.imageRemoveBottomBtn.disabled = false;
            el.imageUploadBottomBtn.disabled = true;
            if (state.imageFileNameBottom) {
                const span = el.imageUploadBottomBtn.querySelector('span');
                span.textContent = truncateFileName(state.imageFileNameBottom);
                span.removeAttribute('data-i18n');
            }
        } else {
            el.imageRemoveBottomBtn.disabled = true;
            el.imageUploadBottomBtn.disabled = false;
        }

        if (state.verticalOffset !== undefined) {
            el.verticalOffsetVal.textContent = state.verticalOffset;
        }
        if (state.tableHeaderSpacingTop !== undefined) {
            el.tableHeaderSpacingTopVal.textContent = state.tableHeaderSpacingTop;
        } else {
            el.tableHeaderSpacingTopVal.textContent = '0';
        }
        if (state.tableHeaderSpacingBottom !== undefined) {
            el.tableHeaderSpacingBottomVal.textContent = state.tableHeaderSpacingBottom;
        } else {
            el.tableHeaderSpacingBottomVal.textContent = '2';
        }

        isLoadingData = false;
        return true;
    } catch (e) {
        isLoadingData = false;
        console.error('loadData failed:', e);
        return false;
    }
}

// ── Weight control Table ───────────────────────────────────────────────────
function getCurrentTableWeight() {
    const slider = el.tableWeightWrapper.querySelector('input[type="range"]');
    if (slider) return slider.value;
    const select = el.tableWeightWrapper.querySelector('select');
    if (select) return select.value;
    const fixed = el.tableWeightWrapper.querySelector('[data-fixed-weight]');
    return fixed ? fixed.dataset.fixedWeight : '400';
}

function buildTableWeightControl(fontValue, forceWeight = null) {
    const data = FONT_DATA[fontValue];
    if (!data) return;

    const prevWeight = forceWeight !== null ? forceWeight : getCurrentTableWeight();

    if (data.variable) {
        const w = Math.min(data.max, Math.max(data.min, parseInt(prevWeight) || data.defaultWeight));
        el.tableWeightLabel.textContent = `${t('label-weight')}: ${w}`;
        el.tableWeightWrapper.innerHTML = `
            <div class="weight-slider-wrapper">
                <input type="range" id="ss-table-font-weight" min="${data.min}" max="${data.max}" step="50" value="${w}">
            </div>`;
        el.tableWeightWrapper.querySelector('input').addEventListener('input', () => {
            el.tableWeightLabel.textContent = `${t('label-weight')}: ${getCurrentTableWeight()}`;
            updatePreview();
        });
    } else {
        const best = data.weights.reduce((c, w) =>
            Math.abs(w - prevWeight) < Math.abs(c - prevWeight) ? w : c, data.weights[0]);
        el.tableWeightLabel.textContent = t('label-weight');
        const options = data.weights.map(wt =>
            `<option value="${wt}" ${wt === best ? 'selected' : ''}>${WEIGHT_NAMES[wt] || wt}</option>`
        ).join('');
        el.tableWeightWrapper.innerHTML = `<select id="ss-table-font-weight" ${data.weights.length === 1 ? 'disabled' : ''}>${options}</select>`;
        el.tableWeightWrapper.querySelector('select').addEventListener('change', debouncedUpdate);
    }
}

function updateTableItalicToggle(fontValue) {
    const data = FONT_DATA[fontValue];
    const supports = data ? data.italic : true;
    el.tableStyleItalic.disabled = !supports;
    if (!supports && currentTableFontStyle === 'italic') setTableFontStyle('normal');
}

function setTableFontStyle(value) {
    currentTableFontStyle = value;
    el.tableStyleRegular.classList.toggle('active', value === 'normal');
    el.tableStyleItalic.classList.toggle('active',  value === 'italic');
}

// ── Weight control Guest ───────────────────────────────────────────────────
function getCurrentGuestWeight() {
    const slider = el.guestWeightWrapper.querySelector('input[type="range"]');
    if (slider) return slider.value;
    const select = el.guestWeightWrapper.querySelector('select');
    if (select) return select.value;
    const fixed = el.guestWeightWrapper.querySelector('[data-fixed-weight]');
    return fixed ? fixed.dataset.fixedWeight : '400';
}

function buildGuestWeightControl(fontValue, forceWeight = null) {
    const data = FONT_DATA[fontValue];
    if (!data) return;

    const prevWeight = forceWeight !== null ? forceWeight : getCurrentGuestWeight();

    if (data.variable) {
        const w = Math.min(data.max, Math.max(data.min, parseInt(prevWeight) || data.defaultWeight));
        el.guestWeightLabel.textContent = `${t('label-weight')}: ${w}`;
        el.guestWeightWrapper.innerHTML = `
            <div class="weight-slider-wrapper">
                <input type="range" id="ss-guest-font-weight" min="${data.min}" max="${data.max}" step="50" value="${w}">
            </div>`;
        el.guestWeightWrapper.querySelector('input').addEventListener('input', () => {
            el.guestWeightLabel.textContent = `${t('label-weight')}: ${getCurrentGuestWeight()}`;
            updatePreview();
        });
    } else {
        const best = data.weights.reduce((c, w) =>
            Math.abs(w - prevWeight) < Math.abs(c - prevWeight) ? w : c, data.weights[0]);
        el.guestWeightLabel.textContent = t('label-weight');
        const options = data.weights.map(wt =>
            `<option value="${wt}" ${wt === best ? 'selected' : ''}>${WEIGHT_NAMES[wt] || wt}</option>`
        ).join('');
        el.guestWeightWrapper.innerHTML = `<select id="ss-guest-font-weight" ${data.weights.length === 1 ? 'disabled' : ''}>${options}</select>`;
        el.guestWeightWrapper.querySelector('select').addEventListener('change', debouncedUpdate);
    }
}

function updateGuestItalicToggle(fontValue) {
    const data = FONT_DATA[fontValue];
    const supports = data ? data.italic : true;
    el.guestStyleItalic.disabled = !supports;
    if (!supports && currentGuestFontStyle === 'italic') setGuestFontStyle('normal');
}

function setGuestFontStyle(value) {
    currentGuestFontStyle = value;
    el.guestStyleRegular.classList.toggle('active', value === 'normal');
    el.guestStyleItalic.classList.toggle('active',  value === 'italic');
}

// ── Custom Font Dropdown ───────────────────────────────────────────────────
function initCustomFontSelect(select) {
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

// ── Preview & Layout Generator ─────────────────────────────────────────────
function updatePreview() {
    const settings = {
        tableFontFamily:   el.tableFontFamily.value,
        tableFontColor:    el.tableFontColor.value,
        tableFontSize:     el.tableFontSize.value + 'pt',
        tableFontWeight:   getCurrentTableWeight(),
        tableFontStyle:    currentTableFontStyle,
        tableHeaderSpacingTop: isNaN(parseFloat(el.tableHeaderSpacingTop.value)) ? 0 : parseFloat(el.tableHeaderSpacingTop.value),
        tableHeaderSpacingBottom: isNaN(parseFloat(el.tableHeaderSpacingBottom.value)) ? 2 : parseFloat(el.tableHeaderSpacingBottom.value),

        guestFontFamily:   el.guestFontFamily.value,
        guestFontColor:    el.guestFontColor.value,
        guestFontSize:     el.guestFontSize.value + 'pt',
        guestFontWeight:   getCurrentGuestWeight(),
        guestFontStyle:    currentGuestFontStyle,

        cardPadding:       Math.max(0, parseFloat(el.cardPadding.value) || 0),
        cutGuides:         el.cutGuides.value,
        pageSize:          el.pageSize.value,
        pageOrientation:   el.pageOrientation.value,

        imageDataTop:      el.imageDataTop.value,
        imageSizeTop:      parseFloat(el.imageSizeTop.value) || 20,
        imageSpacingTop:   parseFloat(el.imageSpacingTop.value) || 5,

        imageDataBottom:   el.imageDataBottom.value,
        imageSizeBottom:   parseFloat(el.imageSizeBottom.value) || 20,
        imageSpacingBottom: parseFloat(el.imageSpacingBottom.value) || 5,

        verticalOffset:    parseFloat(el.verticalOffset.value) || 0,
        sizingMode:        el.sizingMode.value,
    };

    // Calculate dimensions based on page size and orientation
    const baseDims = PAGE_SIZES[settings.pageSize] || PAGE_SIZES.A4;
    const isLandscape = settings.pageOrientation === 'landscape';
    const pageDims = {
        width: isLandscape ? baseDims.height : baseDims.width,
        height: isLandscape ? baseDims.width : baseDims.height
    };

    const margin       = Math.max(0, parseFloat(el.marginSize.value) || 0);
    const printAreaW   = pageDims.width  - margin * 2;
    const printAreaH   = pageDims.height - margin * 2;

    let cardWidth, cardHeight;
    if (settings.sizingMode === 'grid') {
        const gCols = Math.max(1, parseInt(el.gridCols.value) || 3);
        const gRows = Math.max(1, parseInt(el.gridRows.value) || 2);
        cardWidth  = (printAreaW / gCols) - 0.01;
        cardHeight = (printAreaH / gRows) - 0.01;
    } else {
        cardWidth  = Math.max(10, parseFloat(el.cardWidth.value) || 80);
        cardHeight = Math.max(10, parseFloat(el.cardHeight.value) || 100);
    }
    settings.cardWidth  = cardWidth;
    settings.cardHeight = cardHeight;

    const cols         = Math.floor(printAreaW / cardWidth);
    const rows         = Math.floor(printAreaH / cardHeight);
    const cardsPerPage = Math.max(1, cols * rows);

    // Group active guests by table
    const printableTables = [];
    if (seatingMapData.tables && seatingMapData.seats) {
        seatingMapData.tables.forEach(table => {
            const tableSeats = seatingMapData.seats[table.id] || [];
            const seatNames = [];
            tableSeats.forEach(guestId => {
                if (guestId) {
                    const guest = guestStore.getById(guestId);
                    if (guest && rsvpFilter.includes(guest.rsvp)) {
                        seatNames.push(guest.name);
                    }
                }
            });
            // We include the table if it has at least one matching seated guest
            if (seatNames.length > 0) {
                printableTables.push({
                    name: table.name || `Table ${table.id}`,
                    guests: seatNames
                });
            }
        });
    }

    // Default placeholder if list is empty
    const displayTables = printableTables.length > 0 ? printableTables : [
        { name: 'Table Header', guests: ['Guest 1', 'Guest 2', 'Guest 3', 'Guest 4'] }
    ];

    const totalPages = Math.ceil(displayTables.length / cardsPerPage);
    el.previewStats.textContent = t('ss-stats', displayTables.length, totalPages);

    const cutMode    = el.cutMode.value;
    const guideClass = settings.cutGuides;
    const marginVis  = el.marginVisibility.value;

    const previewFrag = document.createDocumentFragment();
    const printFrag   = document.createDocumentFragment();

    for (let p = 0; p < totalPages; p++) {
        const simPage   = makePage('sim-page',   pageDims, margin);
        const printPage = makePage('print-page', pageDims, margin);

        const totalBlockW = cols * cardWidth;
        const totalBlockH = rows * cardHeight;

        // Draw cut lines
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

        // Draw margins
        if (marginVis !== 'none' && margin > 0) {
            const mg = () => {
                const d = document.createElement('div');
                d.style.cssText = `position:absolute;top:${margin}mm;left:${margin}mm;right:${margin}mm;bottom:${margin}mm;border:1px dashed rgba(255,0,0,0.4);pointer-events:none;z-index:10;`;
                return d;
            };
            simPage.appendChild(mg());
            if (marginVis === 'preview_print') printPage.appendChild(mg());
        }

        // Render card items
        const start = p * cardsPerPage;
        const end   = Math.min(start + cardsPerPage, displayTables.length);

        for (let i = start; i < end; i++) {
            const tableItem = displayTables[i];
            
            const tableStyle = `font-family:${settings.tableFontFamily};color:${settings.tableFontColor};font-size:${settings.tableFontSize};font-weight:${settings.tableFontWeight};font-style:${settings.tableFontStyle};margin-top:${settings.tableHeaderSpacingTop}mm;margin-bottom:${settings.tableHeaderSpacingBottom}mm;`;
            const guestStyle = `font-family:${settings.guestFontFamily};color:${settings.guestFontColor};font-size:${settings.guestFontSize};font-weight:${settings.guestFontWeight};font-style:${settings.guestFontStyle};`;
            const cardStyle  = `width:${cardWidth}mm;height:${cardHeight}mm;padding:${settings.cardPadding}mm;`;
            
            // Build Double Image Decor HTML
            const imgTopHtml = settings.imageDataTop
                ? `<img class="ss-decor-img top" src="${settings.imageDataTop}" style="--ss-image-size-top:${settings.imageSizeTop}mm;--ss-image-spacing-top:${settings.imageSpacingTop}mm;">`
                : '';
            const imgBottomHtml = settings.imageDataBottom
                ? `<img class="ss-decor-img bottom" src="${settings.imageDataBottom}" style="--ss-image-size-bottom:${settings.imageSizeBottom}mm;--ss-image-spacing-bottom:${settings.imageSpacingBottom}mm;">`
                : '';

            const guestsHtml = tableItem.guests.map(g => `<span class="ss-guest-name" style="${guestStyle}">${escapeHtml(g)}</span>`).join('');
            
            const inner = `
                <div class="card-content" style="transform:translateY(${settings.verticalOffset}mm);">
                    ${imgTopHtml}
                    <div class="ss-table-title" style="${tableStyle}">${escapeHtml(tableItem.name)}</div>
                    <div class="ss-guest-list">
                        ${guestsHtml}
                    </div>
                    ${imgBottomHtml}
                </div>`;

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

    updatePageCss(settings.pageSize, settings.pageOrientation);
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

// ── Zoom fit calculation ───────────────────────────────────────────────────
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

function updatePageCss(pageSize, pageOrientation) {
    let tag = document.getElementById('ss-dynamic-print-style');
    if (!tag) {
        tag = document.createElement('style');
        tag.id = 'ss-dynamic-print-style';
        document.head.appendChild(tag);
    }
    const sizeStr = pageSize === 'A4' ? 'A4' : 'letter';
    const orientStr = pageOrientation === 'landscape' ? 'landscape' : 'portrait';
    tag.innerHTML = `@media print { @page { size: ${sizeStr} ${orientStr}; margin: 0; } }`;
}

// ── Event Handlers ──────────────────────────────────────────────────────────
function initEvents() {
    el.tableFontFamily.addEventListener('change', () => {
        buildTableWeightControl(el.tableFontFamily.value);
        updateTableItalicToggle(el.tableFontFamily.value);
        debouncedUpdate();
    });

    el.guestFontFamily.addEventListener('change', () => {
        buildGuestWeightControl(el.guestFontFamily.value);
        updateGuestItalicToggle(el.guestFontFamily.value);
        debouncedUpdate();
    });

    el.tableStyleRegular.addEventListener('click', () => { setTableFontStyle('normal'); debouncedUpdate(); });
    el.tableStyleItalic.addEventListener('click',  () => {
        if (!el.tableStyleItalic.disabled) { setTableFontStyle('italic'); debouncedUpdate(); }
    });

    el.guestStyleRegular.addEventListener('click', () => { setGuestFontStyle('normal'); debouncedUpdate(); });
    el.guestStyleItalic.addEventListener('click',  () => {
        if (!el.guestStyleItalic.disabled) { setGuestFontStyle('italic'); debouncedUpdate(); }
    });

    el.sizingMode.addEventListener('change', () => {
        const isGrid = el.sizingMode.value === 'grid';
        el.dimensionsInputs.style.display = isGrid ? 'none' : 'flex';
        el.gridInputs.style.display       = isGrid ? 'flex' : 'none';
        debouncedUpdate();
    });

    el.previewZoom.addEventListener('change', () => { applyZoom(); saveData(); });
    window.addEventListener('resize', () => { if (el.previewZoom.value === 'fit') applyZoom(); });

    const controlIds = [
        'tableFontSize', 'tableFontColor',
        'guestFontSize', 'guestFontColor',
        'cardWidth', 'cardHeight', 'cardPadding',
        'gridCols', 'gridRows', 'pageSize', 'pageOrientation',
        'marginSize', 'marginVisibility', 'cutGuides', 'cutMode',
        'imageSizeTop', 'imageSpacingTop', 'imageSizeBottom', 'imageSpacingBottom'
    ];
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

    el.tableHeaderSpacingTop.addEventListener('input', () => {
        el.tableHeaderSpacingTopVal.textContent = el.tableHeaderSpacingTop.value;
        updatePreview();
    });

    el.tableHeaderSpacingBottom.addEventListener('input', () => {
        el.tableHeaderSpacingBottomVal.textContent = el.tableHeaderSpacingBottom.value;
        updatePreview();
    });

    // Top Image Decor
    el.imageUploadTopBtn.addEventListener('click', () => el.imageUploadTop.click());
    el.imageUploadTop.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { showToast(t('alert-image-too-large'), 'error'); e.target.value = ''; return; }
        const reader = new FileReader();
        reader.onload = ev => {
            el.imageDataTop.value     = ev.target.result;
            el.imageFileNameTop.value = file.name;
            const span = el.imageUploadTopBtn.querySelector('span');
            span.textContent = truncateFileName(file.name);
            span.removeAttribute('data-i18n');
            el.imageRemoveTopBtn.disabled = false;
            el.imageUploadTopBtn.disabled = true;
            debouncedUpdate();
        };
        reader.readAsDataURL(file);
    });
    el.imageRemoveTopBtn.addEventListener('click', () => {
        el.imageDataTop.value = '';
        el.imageFileNameTop.value = '';
        el.imageUploadTop.value = '';
        const span = el.imageUploadTopBtn.querySelector('span');
        span.textContent = t('label-image-upload-top');
        span.setAttribute('data-i18n', 'label-image-upload-top');
        el.imageRemoveTopBtn.disabled = true;
        el.imageUploadTopBtn.disabled = false;
        debouncedUpdate();
    });

    // Bottom Image Decor
    el.imageUploadBottomBtn.addEventListener('click', () => el.imageUploadBottom.click());
    el.imageUploadBottom.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { showToast(t('alert-image-too-large'), 'error'); e.target.value = ''; return; }
        const reader = new FileReader();
        reader.onload = ev => {
            el.imageDataBottom.value     = ev.target.result;
            el.imageFileNameBottom.value = file.name;
            const span = el.imageUploadBottomBtn.querySelector('span');
            span.textContent = truncateFileName(file.name);
            span.removeAttribute('data-i18n');
            el.imageRemoveBottomBtn.disabled = false;
            el.imageUploadBottomBtn.disabled = true;
            debouncedUpdate();
        };
        reader.readAsDataURL(file);
    });
    el.imageRemoveBottomBtn.addEventListener('click', () => {
        el.imageDataBottom.value = '';
        el.imageFileNameBottom.value = '';
        el.imageUploadBottom.value = '';
        const span = el.imageUploadBottomBtn.querySelector('span');
        span.textContent = t('label-image-upload-bottom');
        span.setAttribute('data-i18n', 'label-image-upload-bottom');
        el.imageRemoveBottomBtn.disabled = true;
        el.imageUploadBottomBtn.disabled = false;
        debouncedUpdate();
    });

    // Print button triggers native print dialog
    el.printBtn.addEventListener('click', () => {
        // Double check if there are seated guests at tables
        let totalCount = 0;
        if (seatingMapData.tables && seatingMapData.seats) {
            seatingMapData.tables.forEach(table => {
                const tableSeats = seatingMapData.seats[table.id] || [];
                tableSeats.forEach(guestId => {
                    if (guestId) totalCount++;
                });
            });
        }
        if (totalCount === 0) {
            showToast(t('alert-no-tables-print'), 'warning');
            return;
        }
        window.print();
    });
}

function truncateFileName(name) {
    if (name.length <= 15) return name;
    const extIdx = name.lastIndexOf('.');
    if (extIdx === -1) return name.slice(0, 12) + '…';
    const ext = name.slice(extIdx);
    return name.slice(0, 10) + '…' + ext;
}

// ── Public Interface ───────────────────────────────────────────────────────
export function init() {
    initElements();
    initCustomFontSelect(el.tableFontFamily);
    initCustomFontSelect(el.guestFontFamily);
    initEvents();

    if (!loadData()) {
        buildTableWeightControl(el.tableFontFamily.value);
        updateTableItalicToggle(el.tableFontFamily.value);
        buildGuestWeightControl(el.guestFontFamily.value);
        updateGuestItalicToggle(el.guestFontFamily.value);
        buildRsvpFilterUI();
    }
}

export function onLangChange(lang) {
    // Re-localize static text labels and rebuild RSVP filters
    buildRsvpFilterUI();
    
    // Correct labels inside upload buttons if no image uploaded
    if (!el.imageDataTop.value) {
        const span = el.imageUploadTopBtn.querySelector('span');
        span.textContent = t('label-image-upload-top');
    }
    if (!el.imageDataBottom.value) {
        const span = el.imageUploadBottomBtn.querySelector('span');
        span.textContent = t('label-image-upload-bottom');
    }

    // Refresh dynamic labels
    const tableFontVal = el.tableFontFamily.value;
    const tableFontData = FONT_DATA[tableFontVal];
    if (tableFontData && tableFontData.variable) {
        el.tableWeightLabel.textContent = `${t('label-weight')}: ${getCurrentTableWeight()}`;
    } else {
        el.tableWeightLabel.textContent = t('label-weight');
    }

    const guestFontVal = el.guestFontFamily.value;
    const guestFontData = FONT_DATA[guestFontVal];
    if (guestFontData && guestFontData.variable) {
        el.guestWeightLabel.textContent = `${t('label-weight')}: ${getCurrentGuestWeight()}`;
    } else {
        el.guestWeightLabel.textContent = t('label-weight');
    }

    debouncedUpdate();
}

export function onViewShow() {
    refreshDataFromStore();
}

export function reload() {
    if (!loadData()) {
        buildTableWeightControl(el.tableFontFamily.value);
        updateTableItalicToggle(el.tableFontFamily.value);
        buildGuestWeightControl(el.guestFontFamily.value);
        updateGuestItalicToggle(el.guestFontFamily.value);
        buildRsvpFilterUI();
    }
    refreshDataFromStore();
}
