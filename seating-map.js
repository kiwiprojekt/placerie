import * as guestStore from './guest-store.js';
import * as tagStore from './tag-store.js';
import { STORAGE_KEYS, RSVP_STATUSES, RSVP_COLORS } from './constants.js';
import { debounce, escapeHtml, generateId, showToast, showConfirm } from './utils.js';
import { i18n, translateUI, getLang, t, buildRsvpFilter, buildFilterPills } from './i18n.js';

const DEFAULT_RSVP_FILTER = ['confirmed', 'pending'];

// ── State ──────────────────────────────────────────────────────────────────
let state = {
    tables:   [],   // { id, name, shape, capacity, x, y }[]
    seats:    {},   // { [tableId]: (guestId | null)[] }
    rsvpFilter: [...DEFAULT_RSVP_FILTER],
    tagFilter: [],  // [] = all groups shown
    viewMode: 'map',
    panelPos: { x: 1, y: 1 },
};

let tableDrag    = null;
let panelSearch  = '';
let guestDrag    = null;
let editingTableId = null;
let activeTooltip = null;

function showTooltip(text, anchorEl) {
    if (activeTooltip) { activeTooltip.remove(); activeTooltip = null; }
    const tt = document.createElement('div');
    tt.className = 'chip-tooltip';
    tt.textContent = text;
    document.body.appendChild(tt);
    const rect = anchorEl.getBoundingClientRect();
    tt.style.left = (rect.left + rect.width / 2 - tt.offsetWidth / 2) + 'px';
    tt.style.top  = (rect.top - tt.offsetHeight - 6) + 'px';
    activeTooltip = tt;
}

function hideTooltip() {
    if (activeTooltip) { activeTooltip.remove(); activeTooltip = null; }
}

// ── DOM refs ───────────────────────────────────────────────────────────────
const el = {};

function initElements() {
    el.addTableBtn        = document.getElementById('sm-add-table-btn');
    el.tablesSidebarList  = document.getElementById('sm-tables-list');
    el.mapView            = document.getElementById('sm-map-view');
    el.listView           = document.getElementById('sm-list-view');
    el.mapStats           = document.getElementById('sm-map-stats');
    el.listStats          = document.getElementById('sm-list-stats');
    el.roomCanvas         = document.getElementById('sm-room-canvas');
    el.listViewContainer  = document.getElementById('sm-list-view-container');
    el.printBtn           = document.getElementById('sm-print-btn');
    el.printMap           = document.getElementById('sm-print-map');
    el.printList          = document.getElementById('sm-print-list');
}

// ── RSVP Filter ───────────────────────────────────────────────────────────
// RSVP filter is rendered inline in the unseated panel (map + list views)
// via buildRsvpFilter() calls in renderUnassignedPanel() and renderUnseatedBlock()

// ── Guest helpers ──────────────────────────────────────────────────────────
function getFilteredGuests() {
    return guestStore.getAll().filter(g => state.rsvpFilter.includes(g.rsvp));
}

function buildGroupFilter(container) {
    const tags = tagStore.getAll();
    if (!tags.length) { container.innerHTML = ''; return; }
    const allIds = [...tags.map(tag => tag.id), '__none__'];
    const activeSet = new Set(state.tagFilter.length ? state.tagFilter : allIds);
    const items = [
        ...tags.map(tag => ({ value: tag.id, label: tag.name, color: tag.color })),
        { value: '__none__', label: 'No group', color: '#aaa' },
    ];
    buildFilterPills(container, items, activeSet, () => {
        const active = [...activeSet];
        state.tagFilter = active.length === allIds.length ? [] : active;
        saveState();
        render();
    });
}

function getUnassignedGuests() {
    const assigned = new Set();
    state.tables.forEach(t => {
        (state.seats[t.id] || []).forEach(id => { if (id) assigned.add(id); });
    });
    return getFilteredGuests().filter(g => {
        if (assigned.has(g.id)) return false;
        if (state.tagFilter.length) {
            return state.tagFilter.includes(g.tag ?? '__none__');
        }
        return true;
    });
}

function guestName(id) {
    return guestStore.getById(id)?.name ?? '?';
}

// ── State helpers ──────────────────────────────────────────────────────────
function syncSeatsOnGuestChange(guests) {
    const allIds = new Set(guests.map(g => g.id));
    state.tables.forEach(t => {
        state.seats[t.id] = (state.seats[t.id] || []).map(id =>
            (id !== null && !allIds.has(id)) ? null : id
        );
    });
    saveState();
    render();
}

function findFreePosition() {
    const wrapper = el.roomCanvas ? el.roomCanvas.parentElement : null;
    if (!wrapper || !el.roomCanvas) {
        const n = state.tables.length;
        return { x: (n * 5) % 80, y: 3 + Math.floor(n / 30) * 15 };
    }

    const scrollLeft = wrapper.scrollLeft;
    const scrollTop = wrapper.scrollTop;
    const clientWidth = wrapper.clientWidth;
    const clientHeight = wrapper.clientHeight;

    const canvasWidth = el.roomCanvas.offsetWidth || 2000;
    const canvasHeight = el.roomCanvas.offsetHeight || 1400;

    // Convert visible viewport to percentage coordinates on the canvas
    // Clamp to [0, 93] so that the table top-left fits cleanly inside the canvas boundaries
    const minX = Math.max(0, (scrollLeft / canvasWidth) * 100);
    const maxX = Math.min(93, ((scrollLeft + clientWidth) / canvasWidth) * 100);
    const minY = Math.max(0, (scrollTop / canvasHeight) * 100);
    const maxY = Math.min(93, ((scrollTop + clientHeight) / canvasHeight) * 100);

    // Calculate center of the visible viewport in canvas percentages
    const centerX = ((scrollLeft + clientWidth / 2) / canvasWidth) * 100;
    const centerY = ((scrollTop + clientHeight / 2) / canvasHeight) * 100;

    // Ideal coordinates for the top-left of the centered table
    // A standard table is roughly 12% wide and 10% high, so center it by subtracting half
    const centerTableX = Math.max(0, Math.min(93, centerX - 6));
    const centerTableY = Math.max(0, Math.min(93, centerY - 5));

    // Occupied check function
    const isOccupied = (x, y) => {
        // Overlap with other tables
        const tableOccupied = state.tables.some(t =>
            Math.abs(t.x - x) < 14 && Math.abs(t.y - y) < 13
        );
        // Overlap with unassigned panel (if it exists)
        const hasPanel = guestStore.getAll().length > 0;
        const px = state.panelPos.x, py = state.panelPos.y;
        const panelOccupied = hasPanel && (x >= px - 12 && x <= px + 12 && y >= py - 12 && y <= py + 24);
        return tableOccupied || panelOccupied;
    };

    // If the center spot is unoccupied, use it
    if (!isOccupied(centerTableX, centerTableY)) {
        return { x: centerTableX, y: centerTableY };
    }

    // Otherwise, search for an unoccupied spot in the visible area.
    // Generate a grid of candidate points inside the visible boundaries.
    const candidates = [];
    const gridXCount = 8;
    const gridYCount = 8;

    for (let i = 0; i < gridXCount; i++) {
        for (let j = 0; j < gridYCount; j++) {
            const x = minX + (i / (gridXCount - 1)) * (maxX - minX);
            const y = minY + (j / (gridYCount - 1)) * (maxY - minY);
            candidates.push({ x, y });
        }
    }

    // Sort candidates by distance to the ideal center of the visible area
    candidates.sort((a, b) => {
        const distA = Math.pow(a.x - centerTableX, 2) + Math.pow(a.y - centerTableY, 2);
        const distB = Math.pow(b.x - centerTableX, 2) + Math.pow(b.y - centerTableY, 2);
        return distA - distB;
    });

    // Find the first candidate that is not occupied
    for (const cand of candidates) {
        if (!isOccupied(cand.x, cand.y)) {
            return cand;
        }
    }

    // Fallback: if all visible spots are occupied, place it in the center of the visible viewport
    return { x: centerTableX, y: centerTableY };
}


function addTable(name, shape, capacity) {
    const id     = generateId('tbl');
    const { x, y } = findFreePosition();
    state.tables.push({ id, name, shape, capacity, x, y });
    state.seats[id] = Array(capacity).fill(null);
    saveState();
    render();
}

function deleteTable(id) {
    if (editingTableId === id) editingTableId = null;
    delete state.seats[id];
    state.tables = state.tables.filter(t => t.id !== id);
    saveState();
    render();
}

function updateTable(id, name, shape, capacity) {
    const t = state.tables.find(t => t.id === id);
    if (!t) return;
    t.name = name;
    t.shape = shape;
    const newCap = Math.max(1, capacity);
    if (newCap !== t.capacity) {
        const seats = state.seats[id] || [];
        state.seats[id] = newCap > t.capacity
            ? [...seats, ...Array(newCap - t.capacity).fill(null)]
            : seats.slice(0, newCap);
        t.capacity = newCap;
    }
    editingTableId = null;
    saveState();
    render();
}

function assignGuest(guestId, tableId, slotIndex) {
    let fromTableId = null, fromSlotIdx = null;
    for (const t of state.tables) {
        const idx = (state.seats[t.id] || []).indexOf(guestId);
        if (idx !== -1) { fromTableId = t.id; fromSlotIdx = idx; break; }
    }
    const displaced = (state.seats[tableId] || [])[slotIndex] || null;
    state.tables.forEach(t => {
        state.seats[t.id] = state.seats[t.id].map(id => id === guestId ? null : id);
    });
    if (state.seats[tableId]) state.seats[tableId][slotIndex] = guestId;
    if (displaced && displaced !== guestId && fromTableId !== null) {
        state.tables.forEach(t => {
            state.seats[t.id] = state.seats[t.id].map(id => id === displaced ? null : id);
        });
        if (state.seats[fromTableId]) state.seats[fromTableId][fromSlotIdx] = displaced;
    }
    saveState();
    render();
}

function unassignGuest(guestId) {
    state.tables.forEach(t => {
        state.seats[t.id] = state.seats[t.id].map(id => id === guestId ? null : id);
    });
    saveState();
    render();
}

// ── Persistence ────────────────────────────────────────────────────────────
function saveState() {
    try {
        localStorage.setItem(STORAGE_KEYS.seatingMap, JSON.stringify({
            tables:     state.tables,
            seats:      state.seats,
            rsvpFilter: state.rsvpFilter,
            tagFilter:  state.tagFilter,
            viewMode:   state.viewMode,
            panelPos:   state.panelPos,
        }));
    } catch (e) {
        if (e.name === 'QuotaExceededError') showToast(t('alert-quota-exceeded'), 'error');
        console.error('saveState failed:', e);
    }
}

function applyStateData(data) {
    state.tables     = Array.isArray(data.tables) ? data.tables : [];
    state.seats      = (data.seats && typeof data.seats === 'object') ? data.seats : {};
    state.rsvpFilter = Array.isArray(data.rsvpFilter) ? data.rsvpFilter : [...DEFAULT_RSVP_FILTER];
    state.tagFilter  = Array.isArray(data.tagFilter)  ? data.tagFilter  : [];
    state.viewMode   = ['map','list'].includes(data.viewMode) ? data.viewMode : 'map';
    state.panelPos   = (data.panelPos && typeof data.panelPos.x === 'number') ? data.panelPos : { x: 1, y: 1 };

    state.tables.forEach(t => {
        if (!Array.isArray(state.seats[t.id])) state.seats[t.id] = Array(t.capacity).fill(null);
        if (state.seats[t.id].length !== t.capacity) {
            const fixed = Array(t.capacity).fill(null);
            state.seats[t.id].forEach((v, i) => { if (i < t.capacity) fixed[i] = v; });
            state.seats[t.id] = fixed;
        }
    });
}

function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.seatingMap);
        if (!raw) return false;
        applyStateData(JSON.parse(raw));
        return true;
    } catch (e) {
        console.error('loadState failed:', e);
        return false;
    }
}

// ── Render helpers ─────────────────────────────────────────────────────────
function getInitials(name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function renderChip(guestId, showRemove, mapView = false, fromTableId = null, fromSlotIdx = null) {
    const name = guestName(guestId);
    const chip = document.createElement('div');
    chip.className = 'guest-chip';
    chip.draggable = true;
    chip.title = name;

    const guest = guestStore.getById(guestId);
    const tag = guest?.tag ? tagStore.getById(guest.tag) : null;
    if (tag) {
        chip.style.borderColor = tag.color;
        chip.style.background  = tag.color + '33';
    }

    const nameSpan = document.createElement('span');
    const initials = mapView ? getInitials(name) : name;
    nameSpan.textContent = initials;
    chip.appendChild(nameSpan);

    if (showRemove) {
        const btn = document.createElement('button');
        btn.className = 'chip-remove';
        btn.innerHTML = '&times;';
        btn.title = t('btn-unassign');
        btn.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); unassignGuest(guestId); });
        chip.appendChild(btn);
    }

    if (mapView) {
        chip.addEventListener('mouseenter', () => showTooltip(name, chip));
        chip.addEventListener('mouseleave', hideTooltip);
        chip.addEventListener('dragstart', hideTooltip);
    }

    if (fromTableId !== null) {
        chip.addEventListener('dragover', e => {
            if (tableDrag) return;
            e.preventDefault(); e.stopPropagation();
            chip.classList.add('drag-over');
        });
        chip.addEventListener('dragleave', () => chip.classList.remove('drag-over'));
        chip.addEventListener('drop', e => {
            if (tableDrag) return;
            e.preventDefault(); e.stopPropagation();
            chip.classList.remove('drag-over');
            const id = e.dataTransfer.getData('text/plain');
            if (id) assignGuest(id, fromTableId, fromSlotIdx);
        });
    }

    chip.addEventListener('dragstart', e => {
        guestDrag = { guestId };
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', guestId);
        const bg    = window.getComputedStyle(chip).backgroundColor;
        const ghost = chip.cloneNode(false);
        ghost.style.cssText = `position:fixed;top:-200px;left:-200px;pointer-events:none;background:${bg};`;
        const gs = document.createElement('span');
        gs.textContent = name;
        ghost.appendChild(gs);
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, Math.round(ghost.offsetWidth / 2), Math.round(ghost.offsetHeight / 2));
        setTimeout(() => ghost.remove(), 0);
        setTimeout(() => chip.classList.add('dragging'), 0);
    });

    chip.addEventListener('dragend', () => {
        guestDrag = null;
        chip.classList.remove('dragging');
        document.querySelectorAll('.drag-over').forEach(e => e.classList.remove('drag-over'));
    });

    return chip;
}

function makeTableDropZone(cardEl, tableId) {
    cardEl.addEventListener('dragover', e => {
        if (tableDrag) return;
        e.preventDefault(); e.dataTransfer.dropEffect = 'move';
        cardEl.classList.add('drag-over');
    });
    cardEl.addEventListener('dragleave', e => {
        if (!cardEl.contains(e.relatedTarget)) cardEl.classList.remove('drag-over');
    });
    cardEl.addEventListener('drop', e => {
        if (tableDrag) return;
        e.preventDefault(); e.stopPropagation();
        cardEl.classList.remove('drag-over');
        const id = e.dataTransfer.getData('text/plain');
        if (!id || !state.seats[tableId]) return;
        const firstEmpty = state.seats[tableId].indexOf(null);
        if (firstEmpty === -1) return;
        assignGuest(id, tableId, firstEmpty);
    });
}

function makeSeatSlot(table, slotIdx, card, printMode) {
    const slot = document.createElement('div');
    slot.className = 'seat-slot';
    if (printMode) return slot;
    slot.textContent = slotIdx + 1;
    slot.addEventListener('dragover', e => {
        if (tableDrag) return;
        e.preventDefault(); e.stopPropagation();
        slot.classList.add('drag-over');
        if (card) card.classList.remove('drag-over');
    });
    slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
    slot.addEventListener('drop', e => {
        if (tableDrag) return;
        e.preventDefault(); e.stopPropagation();
        slot.classList.remove('drag-over');
        const id = e.dataTransfer.getData('text/plain');
        if (id) assignGuest(id, table.id, slotIdx);
    });
    return slot;
}

function seatEl(table, guestId, slotIdx, card, printMode) {
    if (guestId) {
        return printMode
            ? renderChip(guestId, false, false)
            : renderChip(guestId, false, true, table.id, slotIdx);
    }
    return makeSeatSlot(table, slotIdx, card, printMode);
}

function buildHeadBody(table, seats, card, printMode) {
    const body = document.createElement('div');
    body.className = 'table-card-body';
    seats.forEach((id, i) => body.appendChild(seatEl(table, id, i, card, printMode)));
    return body;
}

function buildRectangleBody(table, seats, card, printMode) {
    const body   = document.createElement('div');
    body.className = 'table-card-body two-sided';
    const half   = Math.ceil(seats.length / 2);
    const topRow = document.createElement('div');
    topRow.className = 'seat-row top-row';
    const botRow = document.createElement('div');
    botRow.className = 'seat-row bottom-row';
    seats.forEach((id, i) => (i < half ? topRow : botRow).appendChild(seatEl(table, id, i, card, printMode)));
    body.append(topRow, botRow);
    return body;
}

function buildRoundBody(table, seats, card, printMode) {
    const body = document.createElement('div');
    body.className = 'table-card-body round-body';
    const size = Math.max(160, table.capacity * 15);
    body.style.width = body.style.height = `${size}px`;
    const N = seats.length;
    seats.forEach((id, i) => {
        const angle = (i / N) * 2 * Math.PI - Math.PI / 2;
        const r = 38;
        const e = seatEl(table, id, i, card, printMode);
        e.style.cssText += `position:absolute;left:${50 + r * Math.cos(angle)}%;top:${50 + r * Math.sin(angle)}%;transform:translate(-50%,-50%)`;
        body.appendChild(e);
    });
    return body;
}

function renderTableCard(table, printMode = false) {
    const card = document.createElement('div');
    card.className     = `table-card shape-${table.shape}`;
    card.dataset.tableId = table.id;
    card.style.left    = table.x + '%';
    card.style.top     = table.y + '%';

    if (table.shape === 'round') {
        card.style.width = `${Math.max(160, table.capacity * 15)}px`;
    }

    const header = document.createElement('div');
    header.className = 'table-card-header';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'table-card-title';
    titleSpan.textContent = table.name;
    header.appendChild(titleSpan);

    const used = (state.seats[table.id] || []).filter(Boolean).length;
    const capSpan = document.createElement('span');
    capSpan.className = 'table-card-capacity';
    capSpan.textContent = `${used}/${table.capacity}`;
    header.appendChild(capSpan);

    if (!printMode) {
        const delBtn = document.createElement('button');
        delBtn.className = 'delete-table-btn';
        delBtn.innerHTML = '&times;';
        delBtn.title = t('sm-delete-table');
        delBtn.addEventListener('click', e => { e.stopPropagation(); deleteTable(table.id); });
        header.appendChild(delBtn);

        header.addEventListener('mousedown', e => {
            if (e.button !== 0 || e.target.tagName === 'BUTTON') return;
            e.preventDefault();
            const t = state.tables.find(t => t.id === table.id);
            if (!t) return;
            tableDrag = {
                tableId: table.id,
                startX: e.clientX, startY: e.clientY,
                origX: t.x, origY: t.y,
                canvasRect: el.roomCanvas.getBoundingClientRect(),
            };
            document.body.style.cursor = 'grabbing';
        });
    }

    card.appendChild(header);

    const seats = state.seats[table.id] || [];
    let body;
    if      (table.shape === 'round')     body = buildRoundBody(table, seats, card, printMode);
    else if (table.shape === 'rectangle') body = buildRectangleBody(table, seats, card, printMode);
    else                                  body = buildHeadBody(table, seats, card, printMode);

    card.appendChild(body);
    if (!printMode) makeTableDropZone(card, table.id);
    return card;
}

function createListTableBlock(table, interactive = false) {
    const block = document.createElement('div');
    block.className = 'list-table-block';

    const h3 = document.createElement('h3');
    h3.textContent = table.name;
    block.appendChild(h3);

    const ul = document.createElement('ul');
    (state.seats[table.id] || []).forEach((guestId, idx) => {
        const li = document.createElement('li');
        li.className = 'list-seat-item';

        const num = document.createElement('span');
        num.className = 'seat-num';
        num.textContent = `${idx + 1}.`;
        li.appendChild(num);

        if (guestId) {
            if (interactive) {
                li.appendChild(renderChip(guestId, true));
            } else {
                const span = document.createElement('span');
                span.textContent = guestName(guestId);
                li.appendChild(span);
            }
        } else {
            const dash = document.createElement('span');
            dash.className = 'empty-seat';
            dash.textContent = '—';
            li.appendChild(dash);

            if (interactive) {
                li.addEventListener('dragover', e => {
                    if (tableDrag) return;
                    e.preventDefault(); e.stopPropagation();
                    li.classList.add('drag-over');
                    block.classList.remove('drag-over');
                });
                li.addEventListener('dragleave', () => li.classList.remove('drag-over'));
                li.addEventListener('drop', e => {
                    if (tableDrag) return;
                    e.preventDefault(); e.stopPropagation();
                    li.classList.remove('drag-over');
                    const id = e.dataTransfer.getData('text/plain');
                    if (id) assignGuest(id, table.id, idx);
                });
            }
        }
        ul.appendChild(li);
    });
    block.appendChild(ul);
    if (interactive) makeTableDropZone(block, table.id);
    return block;
}

// ── Render ─────────────────────────────────────────────────────────────────
function render() {
    renderTablesSidebar();
    renderRoomCanvas();
    if (state.viewMode === 'list') renderListView();
    updateStats();
    updateViewDisplay();
}

function refreshPanelList(listDiv) {
    listDiv.innerHTML = '';
    const query = panelSearch.toLowerCase();
    const filtered = getUnassignedGuests()
        .filter(g => !query || g.name.toLowerCase().includes(query));
    filtered.forEach(g => listDiv.appendChild(renderChip(g.id, false)));
    if (filtered.length === 0 && guestStore.getAll().length > 0) {
        const msg = document.createElement('span');
        msg.className = 'all-assigned-msg';
        msg.textContent = query ? t('sm-search-no-matches') : t('all-assigned');
        listDiv.appendChild(msg);
    }
}

function renderUnassignedPanel() {
    const panel = document.createElement('div');
    panel.className = 'table-card unassigned-panel';
    panel.style.left = state.panelPos.x + '%';
    panel.style.top  = state.panelPos.y + '%';

    const header = document.createElement('div');
    header.className = 'table-card-header';
    const titleSpan = document.createElement('span');
    titleSpan.className = 'table-card-title';
    titleSpan.textContent = `${t('sm-unseated')} (${getUnassignedGuests().length})`;
    header.appendChild(titleSpan);
    header.addEventListener('mousedown', e => {
        if (e.button !== 0 || e.target.tagName === 'INPUT') return;
        e.preventDefault();
        tableDrag = {
            tableId: '__panel__',
            startX: e.clientX, startY: e.clientY,
            origX: state.panelPos.x, origY: state.panelPos.y,
            canvasRect: el.roomCanvas.getBoundingClientRect(),
        };
        document.body.style.cursor = 'grabbing';
    });
    panel.appendChild(header);

    // Body wrapper to hold filters, search, and list with uniform border and shadow
    const body = document.createElement('div');
    body.className = 'unassigned-panel-body';

    // ── Filters ────────────────────────────────────────────────────────
    const filterWrap = document.createElement('div');
    filterWrap.className = 'panel-filter-wrap';
    const filterRow = document.createElement('div');
    filterRow.className = 'rsvp-filter-row';
    buildRsvpFilter(filterRow, state.rsvpFilter, () => { saveState(); render(); });
    filterWrap.appendChild(filterRow);
    const groupFilterRow = document.createElement('div');
    buildGroupFilter(groupFilterRow);
    if (groupFilterRow.children.length) filterWrap.appendChild(groupFilterRow);
    body.appendChild(filterWrap);

    const searchWrap  = document.createElement('div');
    searchWrap.className = 'panel-search-wrap';
    const searchInput = document.createElement('input');
    searchInput.type  = 'search';
    searchInput.className = 'panel-search';
    searchInput.placeholder = 'Search…';
    searchInput.value = panelSearch;
    searchInput.addEventListener('mousedown', e => e.stopPropagation());
    searchInput.addEventListener('input', () => {
        panelSearch = searchInput.value;
        refreshPanelList(listDiv);
    });
    searchWrap.appendChild(searchInput);
    body.appendChild(searchWrap);

    const listDiv = document.createElement('div');
    listDiv.className = 'panel-guest-list';
    refreshPanelList(listDiv);
    body.appendChild(listDiv);

    panel.appendChild(body);

    panel.addEventListener('dragover', e => {
        if (tableDrag) return;
        e.preventDefault(); e.stopPropagation();
        panel.classList.add('drag-over');
    });
    panel.addEventListener('dragleave', e => {
        if (!panel.contains(e.relatedTarget)) panel.classList.remove('drag-over');
    });
    panel.addEventListener('drop', e => {
        if (tableDrag) return;
        e.preventDefault(); e.stopPropagation();
        panel.classList.remove('drag-over');
        const id = e.dataTransfer.getData('text/plain');
        if (id) unassignGuest(id);
    });

    return panel;
}

function renderTablesSidebar() {
    el.tablesSidebarList.innerHTML = '';
    state.tables.forEach(t => {
        el.tablesSidebarList.appendChild(
            t.id === editingTableId ? buildEditRow(t) : buildTableRow(t)
        );
    });
}

function buildTableRow(table) {
    const row = document.createElement('div');
    row.className = 'table-sidebar-row';

    const nameSpan  = document.createElement('span');
    nameSpan.className = 'table-sidebar-name';
    nameSpan.textContent = table.name;

    const shapeBadge = document.createElement('span');
    shapeBadge.className = 'shape-badge';
    shapeBadge.textContent = t('sm-shape-' + table.shape);

    const used = state.seats[table.id] ? state.seats[table.id].filter(Boolean).length : 0;
    const capBadge = document.createElement('span');
    capBadge.className = 'capacity-badge';
    capBadge.textContent = `${used}/${table.capacity}`;

    const editBtn = document.createElement('button');
    editBtn.className = 'edit-table-btn';
    editBtn.textContent = '✎';
    editBtn.title = t('sm-edit-table');
    editBtn.addEventListener('click', () => { editingTableId = table.id; renderTablesSidebar(); });

    const delBtn = document.createElement('button');
    delBtn.className = 'delete-table-btn';
    delBtn.innerHTML = '&times;';
    delBtn.title = t('sm-delete-table');
    delBtn.addEventListener('click', () => deleteTable(table.id));

    row.append(nameSpan, shapeBadge, capBadge, editBtn, delBtn);
    return row;
}

function buildEditRow(table) {
    const wrap = document.createElement('div');
    wrap.className = 'sm-edit-table-wrap';

    const row1 = document.createElement('div');
    row1.className = 'input-row';

    const col1 = document.createElement('div');
    col1.className = 'input-col';
    const nameLabel = document.createElement('label');
    nameLabel.dataset.i18n = 'label-table-name';
    nameLabel.textContent = t('label-table-name');
    const nameInput = document.createElement('input');
    nameInput.type = 'text'; nameInput.value = table.name;
    nameInput.className = 'edit-table-input'; nameInput.placeholder = 'Table Name';
    col1.append(nameLabel, nameInput);

    row1.appendChild(col1);

    const row2 = document.createElement('div');
    row2.className = 'input-row';

    const col2 = document.createElement('div');
    col2.className = 'input-col';
    const shapeLabel = document.createElement('label');
    shapeLabel.dataset.i18n = 'label-table-shape';
    shapeLabel.textContent = t('label-table-shape');
    const shapeSelect = document.createElement('select');
    shapeSelect.className = 'edit-table-input';
    ['rectangle','round','head'].forEach(shape => {
        const opt = document.createElement('option');
        opt.value = shape;
        opt.textContent = t(`opt-${shape}`);
        opt.selected = shape === table.shape;
        shapeSelect.appendChild(opt);
    });
    col2.append(shapeLabel, shapeSelect);

    const col3 = document.createElement('div');
    col3.className = 'input-col';
    const capLabel = document.createElement('label');
    capLabel.dataset.i18n = 'label-table-capacity';
    capLabel.textContent = t('label-table-capacity');
    const capInput = document.createElement('input');
    capInput.type = 'number'; capInput.value = table.capacity; capInput.min = 1; capInput.max = 50;
    capInput.className = 'edit-table-input';
    col3.append(capLabel, capInput);

    row2.append(col2, col3);

    const btnRow = document.createElement('div');
    btnRow.className = 'sm-edit-btn-row';

    const delBtn = document.createElement('button');
    delBtn.className = 'secondary-btn danger-btn';
    delBtn.textContent = 'Delete';
    delBtn.title = t('sm-delete-table');
    delBtn.addEventListener('click', () => deleteTable(table.id));

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'secondary-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => { editingTableId = null; renderTablesSidebar(); });

    const saveBtn = document.createElement('button');
    saveBtn.className = 'primary-btn';
    saveBtn.textContent = 'Save';
    saveBtn.title = 'Save';

    const doSave   = () => updateTable(table.id, nameInput.value.trim() || table.name, shapeSelect.value, Math.max(1, parseInt(capInput.value) || table.capacity));
    const doCancel = () => { editingTableId = null; renderTablesSidebar(); };

    saveBtn.addEventListener('click', doSave);
    cancelBtn.addEventListener('click', doCancel);
    [nameInput, shapeSelect, capInput].forEach(inp => {
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') doSave(); if (e.key === 'Escape') doCancel(); });
    });

    btnRow.append(delBtn, cancelBtn, saveBtn);
    wrap.append(row1, row2, btnRow);
    setTimeout(() => nameInput.focus(), 0);
    return wrap;
}

function renderRoomCanvas() {
    el.roomCanvas.innerHTML = '';

    if (state.tables.length === 0) {
        const hint = document.createElement('div');
        hint.className = 'canvas-hint';
        hint.textContent = t('hint-add-tables');
        el.roomCanvas.appendChild(hint);
    }

    state.tables.forEach(t => el.roomCanvas.appendChild(renderTableCard(t)));

    if (guestStore.getAll().length > 0) {
        el.roomCanvas.appendChild(renderUnassignedPanel());
    }
}

function renderUnseatedBlock() {
    const unassigned = getUnassignedGuests();
    const block = document.createElement('div');
    block.className = 'list-table-block list-unseated-block';

    const h3 = document.createElement('h3');
    h3.textContent = `${t('sm-unseated')} (${unassigned.length})`;
    block.appendChild(h3);

    // ── Filters ────────────────────────────────────────────────────────
    const filterRow = document.createElement('div');
    filterRow.className = 'rsvp-filter-row';
    filterRow.style.cssText = 'margin-bottom:0.25rem;';
    buildRsvpFilter(filterRow, state.rsvpFilter, () => { saveState(); render(); });
    block.appendChild(filterRow);
    const groupFilterRow = document.createElement('div');
    groupFilterRow.style.cssText = 'margin-bottom:0.5rem;';
    buildGroupFilter(groupFilterRow);
    if (groupFilterRow.children.length) block.appendChild(groupFilterRow);

    if (unassigned.length === 0) {
        const msg = document.createElement('span');
        msg.className = 'empty-seat';
        msg.textContent = t('all-assigned');
        block.appendChild(msg);
    } else {
        const chips = document.createElement('div');
        chips.className = 'list-unseated-chips';
        unassigned.forEach(g => chips.appendChild(renderChip(g.id, false)));
        block.appendChild(chips);
    }

    block.addEventListener('dragover', e => {
        if (tableDrag) return;
        e.preventDefault();
        block.classList.add('drag-over');
    });
    block.addEventListener('dragleave', e => {
        if (!block.contains(e.relatedTarget)) block.classList.remove('drag-over');
    });
    block.addEventListener('drop', e => {
        if (tableDrag) return;
        e.preventDefault();
        block.classList.remove('drag-over');
        const id = e.dataTransfer.getData('text/plain');
        if (id) unassignGuest(id);
    });

    return block;
}

function renderListView() {
    el.listViewContainer.innerHTML = '';
    if (state.tables.length === 0) {
        const hint = document.createElement('div');
        hint.className = 'canvas-hint';
        hint.style.cssText = 'position:static;transform:none;padding:3rem;color:var(--text-muted)';
        hint.textContent = t('hint-add-tables');
        el.listViewContainer.appendChild(hint);
        return;
    }
    state.tables.forEach(t => el.listViewContainer.appendChild(createListTableBlock(t, true)));
    if (guestStore.getAll().length > 0) {
        el.listViewContainer.appendChild(renderUnseatedBlock());
    }
}

function updateStats() {
    const filtered  = getFilteredGuests();
    const total     = filtered.length;
    const assigned  = state.tables.reduce(
        (sum, t) => sum + (state.seats[t.id] || []).filter(Boolean).length, 0
    );
    const text = total > 0 ? t('stats-guests', assigned, total) : '';
    el.mapStats.textContent  = text;
    el.listStats.textContent = text;
}

function updateViewDisplay() {
    el.mapView.style.display  = state.viewMode === 'map'  ? 'flex' : 'none';
    el.listView.style.display = state.viewMode === 'list' ? 'flex' : 'none';
    document.querySelectorAll('.tab-btn[data-view]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === state.viewMode);
    });
}

// ── Print ──────────────────────────────────────────────────────────────────
function updatePrintPageCss(mode) {
    let tag = document.getElementById('sm-dynamic-print-style');
    if (!tag) {
        tag = document.createElement('style');
        tag.id = 'sm-dynamic-print-style';
        document.head.appendChild(tag);
    }
    tag.textContent = mode === 'map'
        ? `@media print { @page { size: landscape; margin: 1cm; } }`
        : `@media print { @page { size: portrait; margin: 1.5cm; } }`;
}

function renderPrintMap() {
    el.printMap.innerHTML = '';
    const canvas = document.createElement('div');
    canvas.className = 'print-map-canvas';
    state.tables.forEach(t => canvas.appendChild(renderTableCard(t, true)));
    el.printMap.appendChild(canvas);
}

function renderPrintList() {
    el.printList.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'print-list-grid';
    state.tables.forEach(t => grid.appendChild(createListTableBlock(t)));
    el.printList.appendChild(grid);
}

// ── Init: event wiring ─────────────────────────────────────────────────────
function initTableForm() {
    el.addTableBtn.addEventListener('click', () => {
        const n = state.tables.length + 1;
        const id = generateId('tbl');
        const { x, y } = findFreePosition();
        state.tables.push({ id, name: `Table ${n}`, shape: 'rectangle', capacity: 8, x, y });
        state.seats[id] = Array(8).fill(null);
        editingTableId = id;
        saveState();
        render();
    });
}

function initViewToggle() {
    document.querySelectorAll('.tab-btn[data-view]').forEach(btn => {
        btn.addEventListener('click', () => {
            state.viewMode = btn.dataset.view;
            if (state.viewMode === 'list') renderListView();
            updateViewDisplay();
            saveState();
        });
    });
}

// ── Data actions (called from global nav bar) ──────────────────────────────

export function importData(file) {
    const reader = new FileReader();
    reader.onload = ev => {
        try {
            const data = JSON.parse(ev.target.result);
            if (data.tags) tagStore.replaceAll(data.tags);
            if (data.guests) guestStore.replaceAll(data.guests);
            applyStateData(data);
            saveState();
            translateUI(getLang());
            render();
            showToast(t('alert-import-success'), 'success');
        } catch {
            showToast(t('alert-import-error'), 'error');
        }
    };
    reader.onerror = () => showToast(t('alert-import-error'), 'error');
    reader.readAsText(file);
}

export function exportData() {
    const data = {
        version: 1,
        guests:  guestStore.getAll(),
        tags:    tagStore.getAll(),
        tables:  state.tables,
        seats:   state.seats,
        rsvpFilter: state.rsvpFilter,
        viewMode:   state.viewMode,
        panelPos:   state.panelPos,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'seating-map.json'; a.click();
    URL.revokeObjectURL(url);
}

export function clearData() {
    showConfirm(t('confirm-title-clear'), t('alert-clear-confirm-sm'), () => {
        localStorage.removeItem(STORAGE_KEYS.seatingMap);
        state.tables   = [];
        state.seats    = {};
        state.viewMode = 'map';
        state.panelPos = { x: 1, y: 1 };
        render();
        showToast(t('alert-import-success'), 'info');
    });
}

function initPrintButton() {
    if (!el.printBtn) return;
    el.printBtn.addEventListener('click', () => {
        if (state.tables.length === 0) { showToast(t('alert-no-tables'), 'warning'); return; }
        const mode = state.viewMode;
        updatePrintPageCss(mode);
        if (mode === 'map') renderPrintMap();
        else renderPrintList();
        document.body.classList.add(`print-mode-${mode}`);
        window.print();
    });
    window.addEventListener('afterprint', () => {
        document.body.classList.remove('print-mode-map', 'print-mode-list');
    });
}

function initCanvasFloorDrop() {
    el.roomCanvas.addEventListener('dragover', e => {
        if (tableDrag) return;
        e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    });
    el.roomCanvas.addEventListener('drop', e => {
        if (tableDrag) return;
        e.preventDefault();
        const id = e.dataTransfer.getData('text/plain');
        if (id) unassignGuest(id);
    });
}

function initDocumentMouseEvents() {
    document.addEventListener('mousemove', e => {
        if (!tableDrag) return;
        const rect = tableDrag.canvasRect;
        const dx   = (e.clientX - tableDrag.startX) / rect.width  * 100;
        const dy   = (e.clientY - tableDrag.startY) / rect.height * 100;

        if (tableDrag.tableId === '__panel__') {
            state.panelPos.x = Math.max(0, Math.min(93, tableDrag.origX + dx));
            state.panelPos.y = Math.max(0, Math.min(93, tableDrag.origY + dy));
            const panelEl = el.roomCanvas.querySelector('.unassigned-panel');
            if (panelEl) { panelEl.style.left = state.panelPos.x + '%'; panelEl.style.top = state.panelPos.y + '%'; }
            return;
        }

        const tbl = state.tables.find(t => t.id === tableDrag.tableId);
        if (!tbl) return;
        tbl.x = Math.max(0, Math.min(93, tableDrag.origX + dx));
        tbl.y = Math.max(0, Math.min(93, tableDrag.origY + dy));
        const cardEl = el.roomCanvas.querySelector(`[data-table-id="${tableDrag.tableId}"]`);
        if (cardEl) { cardEl.style.left = tbl.x + '%'; cardEl.style.top = tbl.y + '%'; }
    });

    document.addEventListener('mouseup', () => {
        if (!tableDrag) return;
        document.body.style.cursor = '';
        tableDrag = null;
        saveState();
    });
}

// ── Public init ────────────────────────────────────────────────────────────
export function init() {
    initElements();
    loadState();
    initTableForm();
    initViewToggle();
    initPrintButton();
    initCanvasFloorDrop();
    initDocumentMouseEvents();
    // RSVP filter is built inline in renderUnassignedPanel / renderUnseatedBlock

    // React to guest store changes (remove orphaned seat assignments)
    guestStore.subscribe(guests => syncSeatsOnGuestChange(guests));

    translateUI(getLang());
    render();
}

export function onLangChange() {
    render();
}

export function reload() {
    loadState();
    translateUI(getLang());
    render();
}
