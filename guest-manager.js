import * as guestStore from './guest-store.js';
import * as tagStore from './tag-store.js';
import { parseNames, showToast, showConfirm } from './utils.js';
import { i18n, translateUI, getLang, t, buildRsvpFilter, buildFilterPills } from './i18n.js';
import { RSVP_STATUSES, RSVP_COLORS, GROUP_COLORS } from './constants.js';

let container;
let sortKey = 'name'; // 'name' | 'rsvp' | 'tag'
let sortDir = 'asc';  // 'asc' | 'desc'
let editingId = null;
let searchQuery = '';
let rsvpFilter = null; // null = all; initialized on first render
let tagFilter = null;  // null = all; Set of tagId | '__none__'

export function init(el) {
    container = el;
    guestStore.subscribe(() => render());
    tagStore.subscribe(() => render());
    render();
}

function render() {
    if (rsvpFilter === null) rsvpFilter = [...RSVP_STATUSES];
    container.innerHTML = '';
    container.appendChild(buildView());
}

function buildView() {
    const main = document.createElement('main');

    // ── Sidebar ────────────────────────────────────────────────────────────
    const sidebar = document.createElement('aside');
    sidebar.className = 'sidebar';

    const sidebarHeader = document.createElement('div');
    sidebarHeader.className = 'sidebar-header';
    sidebarHeader.dataset.i18n = 'gm-title';
    sidebarHeader.textContent = t('gm-title');

    const sidebarContent = document.createElement('div');
    sidebarContent.className = 'sidebar-content';
    sidebarContent.append(buildBulkSection(), buildGroupsSection());

    const sidebarFooter = document.createElement('div');
    sidebarFooter.className = 'sidebar-footer';
    sidebarFooter.appendChild(buildStats());
    sidebar.append(sidebarHeader, sidebarContent, sidebarFooter);

    // ── Main Panel ─────────────────────────────────────────────────────────
    const section = document.createElement('section');
    section.className = 'preview-area';

    const header = document.createElement('div');
    header.className = 'preview-header';

    const heading = document.createElement('h2');
    heading.dataset.i18n = 'gm-title';
    heading.textContent = t('gm-title');

    header.appendChild(heading);
    section.appendChild(header);

    const listBody = document.createElement('div');
    listBody.className = 'gm-list-body';

    const toolbar = document.createElement('div');
    toolbar.className = 'gm-table-toolbar';
    toolbar.append(buildFilterSection());
    listBody.appendChild(toolbar);

    listBody.appendChild(buildGuestList());
    section.appendChild(listBody);

    main.append(sidebar, section);
    return main;
}

function makeSection(titleText, content, open = true) {
    const details = document.createElement('details');
    details.className = 'control-group';
    if (open) details.open = true;
    const summary = document.createElement('summary');
    const h2 = document.createElement('h2');
    h2.textContent = titleText;
    summary.appendChild(h2);
    details.append(summary, content);
    return details;
}

function buildBulkSection() {
    const wrap = document.createElement('div');
    wrap.className = 'gm-bulk-wrap';

    const rsvpRow = document.createElement('div');
    rsvpRow.className = 'gm-bulk-rsvp-row';

    const rsvpLabel = document.createElement('label');
    rsvpLabel.className = 'gm-bulk-rsvp-label';
    rsvpLabel.textContent = t('gm-bulk-rsvp-label');
    rsvpLabel.htmlFor = 'gm-bulk-rsvp-select';

    const rsvpSelect = document.createElement('select');
    rsvpSelect.id = 'gm-bulk-rsvp-select';
    rsvpSelect.className = 'gm-bulk-rsvp-select';
    ['confirmed', 'pending'].forEach(status => {
        const opt = document.createElement('option');
        opt.value = status;
        opt.textContent = t('gm-rsvp-' + status);
        if (status === 'pending') opt.selected = true;
        rsvpSelect.appendChild(opt);
    });
    rsvpRow.append(rsvpLabel, rsvpSelect);

    const textarea = document.createElement('textarea');
    textarea.className = 'gm-bulk-textarea';
    textarea.dataset.i18nPlaceholder = 'gm-bulk-placeholder';
    textarea.placeholder = t('gm-bulk-placeholder');
    textarea.rows = 7;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'primary-btn full-width-btn gm-bulk-btn';
    btn.dataset.i18n = 'gm-btn-bulk-import';
    btn.textContent = t('gm-btn-bulk-import');
    btn.addEventListener('click', () => {
        const names = parseNames(textarea.value);
        if (names.length) { guestStore.addBulk(names, rsvpSelect.value); textarea.value = ''; }
    });

    wrap.append(rsvpRow, textarea, btn);
    return makeSection(t('gm-btn-bulk-import'), wrap, true);
}

function buildGroupsSection() {
    const wrap = document.createElement('div');
    wrap.className = 'gm-tag-manager';

    const list = document.createElement('div');
    list.className = 'gm-tag-list';
    tagStore.getAll().forEach(tag => list.appendChild(buildGroupRow(tag)));
    wrap.appendChild(list);
    wrap.appendChild(buildAddGroupForm());

    return makeSection('Groups', wrap, true);
}

let newGroupColor = GROUP_COLORS[4]; // default green

function buildAddGroupForm() {
    const form = document.createElement('div');
    form.className = 'gm-add-group-form';

    const colorBtn = document.createElement('button');
    colorBtn.type = 'button';
    colorBtn.className = 'gm-tag-color-swatch gm-add-group-swatch';
    colorBtn.style.background = newGroupColor;
    colorBtn.title = 'Pick color';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'gm-add-group-input';
    nameInput.placeholder = 'Group name…';

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'gm-tag-add-btn gm-add-group-btn';
    addBtn.textContent = 'Add';
    addBtn.addEventListener('click', () => {
        const name = nameInput.value.trim();
        if (!name) { nameInput.focus(); return; }
        tagStore.add(name, newGroupColor);
        nameInput.value = '';
    });

    nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') addBtn.click(); });

    colorBtn.addEventListener('click', e => {
        e.stopPropagation();
        showColorPalette(colorBtn, newGroupColor, color => {
            newGroupColor = color;
            colorBtn.style.background = color;
        });
    });

    form.append(colorBtn, nameInput, addBtn);
    return form;
}

function buildGroupRow(tag) {
    const row = document.createElement('div');
    row.className = 'gm-tag-row';

    const colorBtn = document.createElement('button');
    colorBtn.type = 'button';
    colorBtn.className = 'gm-tag-color-swatch';
    colorBtn.style.background = tag.color;
    colorBtn.title = 'Change color';
    colorBtn.addEventListener('click', e => {
        e.stopPropagation();
        showColorPalette(colorBtn, tag.color, color => {
            colorBtn.style.background = color;
            tagStore.update(tag.id, { color });
        });
    });

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'gm-tag-name-input';
    nameInput.value = tag.name;
    nameInput.addEventListener('change', () => {
        const v = nameInput.value.trim();
        if (v) tagStore.update(tag.id, { name: v });
        else nameInput.value = tag.name;
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'gm-tag-del-btn';
    delBtn.textContent = '×';
    delBtn.title = 'Delete group';
    delBtn.addEventListener('click', () => {
        guestStore.getAll().filter(g => g.tag === tag.id).forEach(g => guestStore.update(g.id, { tag: null }));
        tagStore.remove(tag.id);
    });

    row.append(colorBtn, nameInput, delBtn);
    return row;
}

let activePalette = null;
function showColorPalette(anchor, currentColor, onSelect) {
    if (activePalette) { activePalette.remove(); activePalette = null; }
    const palette = document.createElement('div');
    palette.className = 'gm-color-palette';
    GROUP_COLORS.forEach(color => {
        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = 'gm-palette-swatch' + (color === currentColor ? ' selected' : '');
        swatch.style.background = color;
        swatch.addEventListener('click', e => {
            e.stopPropagation();
            onSelect(color);
            palette.remove();
            activePalette = null;
        });
        palette.appendChild(swatch);
    });
    document.body.appendChild(palette);
    activePalette = palette;
    const rect = anchor.getBoundingClientRect();
    palette.style.left = rect.left + 'px';
    palette.style.top  = (rect.bottom + 4) + 'px';
    const close = e => { if (!palette.contains(e.target)) { palette.remove(); activePalette = null; document.removeEventListener('click', close, true); } };
    setTimeout(() => document.addEventListener('click', close, true), 0);
}

function buildFilterSection() {
    const wrap = document.createElement('div');
    wrap.className = 'gm-filter-section';

    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.className = 'gm-search-input';
    searchInput.placeholder = 'Search…';
    searchInput.value = searchQuery;
    searchInput.addEventListener('input', () => { searchQuery = searchInput.value; render(); });

    const filterRow = document.createElement('div');
    buildRsvpFilter(filterRow, rsvpFilter, () => render());

    const allTags = tagStore.getAll();
    if (allTags.length > 0) {
        if (tagFilter === null) tagFilter = new Set([...allTags.map(g => g.id), '__none__']);
        const tagFilterRow = document.createElement('div');
        const tagItems = [
            ...allTags.map(g => ({ value: g.id, label: g.name, color: g.color })),
            { value: '__none__', label: 'No group', color: '#aaa' },
        ];
        buildFilterPills(tagFilterRow, tagItems, tagFilter, () => render());
        wrap.append(searchInput, filterRow, tagFilterRow);
    } else {
        wrap.append(searchInput, filterRow);
    }

    return wrap;
}

function buildStats() {
    const guests = guestStore.getAll();
    const counts = { confirmed: 0, declined: 0, pending: 0 };
    guests.forEach(g => { if (counts[g.rsvp] !== undefined) counts[g.rsvp]++; });

    if (guests.length === 0) {
        const empty = document.createElement('span');
        empty.className = 'gm-stats-text';
        return empty;
    }

    const text = document.createElement('span');
    text.className = 'gm-stats-text';
    text.textContent = t('gm-stats', counts.confirmed, counts.declined, counts.pending);
    return text;
}

function buildActions() {
    const wrap = document.createElement('div');
    wrap.className = 'data-actions';

    const importFileInput = document.createElement('input');
    importFileInput.type = 'file';
    importFileInput.accept = '.json';
    importFileInput.style.display = 'none';

    const importBtn = makeBtn('btn-import', 'secondary-btn', () => importFileInput.click());
    const exportBtn = makeBtn('btn-export', 'secondary-btn', handleExport);
    const clearBtn  = makeBtn('btn-clear-all', 'secondary-btn danger-btn', handleClear);

    importFileInput.addEventListener('change', handleImportFile);
    wrap.append(importBtn, exportBtn, clearBtn, importFileInput);
    return wrap;
}

function buildSortRow() {
    const row = document.createElement('div');
    row.className = 'gm-sort-row';

    const label = document.createElement('span');
    label.className = 'gm-sort-label';
    label.textContent = t('gm-sort-label');
    row.appendChild(label);

    ['name', 'rsvp'].forEach(key => {
        const btn = document.createElement('button');
        btn.className = 'gm-sort-btn' + (sortKey === key ? ' active' : '');
        btn.dataset.i18n = key === 'name' ? 'gm-sort-name' : 'gm-sort-rsvp';
        btn.textContent = t(key === 'name' ? 'gm-sort-name' : 'gm-sort-rsvp');
        btn.addEventListener('click', () => { sortKey = key; render(); });
        row.appendChild(btn);
    });

    return row;
}

function buildGuestList() {
    const allGuests = guestStore.getAll();

    if (allGuests.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'gm-empty';
        empty.dataset.i18n = 'gm-no-guests';
        empty.textContent = t('gm-no-guests');
        return empty;
    }

    const q = searchQuery.trim().toLowerCase();
    const allTags = tagStore.getAll();
    const useTagFilter = tagFilter !== null && allTags.length > 0;
    const guests = allGuests.filter(g =>
        rsvpFilter.includes(g.rsvp) &&
        (!q || g.name.toLowerCase().includes(q)) &&
        (!useTagFilter || tagFilter.has(g.tag ?? '__none__'))
    );

    if (guests.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'gm-empty';
        empty.textContent = t('gm-filter-empty');
        return empty;
    }

    const RSVP_ORDER = { confirmed: 0, pending: 1, declined: 2 };
    const dir = sortDir === 'asc' ? 1 : -1;
    const tagNameOf = g => tagStore.getById(g.tag)?.name ?? '￿'; // no tag sorts last
    const sorted = [...guests].sort((a, b) => {
        if (sortKey === 'rsvp') {
            const diff = (RSVP_ORDER[a.rsvp] - RSVP_ORDER[b.rsvp]) * dir;
            if (diff !== 0) return diff;
        }
        if (sortKey === 'tag') {
            const diff = tagNameOf(a).localeCompare(tagNameOf(b)) * dir;
            if (diff !== 0) return diff;
        }
        return a.name.localeCompare(b.name) * dir;
    });

    const list = document.createElement('div');
    list.className = 'gm-list';

    // ── Header row (clickable for sorting) ─────────────────────────────
    const headerRow = document.createElement('div');
    headerRow.className = 'gm-row gm-header-row';

    const dotSpacer = document.createElement('span');
    dotSpacer.className = 'rsvp-dot';
    dotSpacer.style.visibility = 'hidden';

    const dirIcon = sortDir === 'asc' ? ' ↑' : ' ↓';

    const nameHeader = document.createElement('span');
    nameHeader.className = 'gm-col-header' + (sortKey === 'name' ? ' active' : '');
    nameHeader.textContent = t('gm-sort-name') + (sortKey === 'name' ? dirIcon : '');
    nameHeader.addEventListener('click', () => {
        if (sortKey === 'name') sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        else { sortKey = 'name'; sortDir = 'asc'; }
        render();
    });

    const rsvpHeader = document.createElement('span');
    rsvpHeader.className = 'gm-col-header gm-col-header-rsvp' + (sortKey === 'rsvp' ? ' active' : '');
    rsvpHeader.textContent = t('gm-sort-rsvp') + (sortKey === 'rsvp' ? dirIcon : '');
    rsvpHeader.addEventListener('click', () => {
        if (sortKey === 'rsvp') sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        else { sortKey = 'rsvp'; sortDir = 'asc'; }
        render();
    });

    const tagHeader = document.createElement('span');
    tagHeader.className = 'gm-col-header gm-col-header-tag' + (sortKey === 'tag' ? ' active' : '');
    tagHeader.textContent = 'Group' + (sortKey === 'tag' ? dirIcon : '');
    tagHeader.addEventListener('click', () => {
        if (sortKey === 'tag') sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        else { sortKey = 'tag'; sortDir = 'asc'; }
        render();
    });

    const actionsHeader = document.createElement('span');
    actionsHeader.className = 'gm-col-header-actions';

    headerRow.append(dotSpacer, nameHeader, tagHeader, rsvpHeader, actionsHeader);
    list.appendChild(headerRow);

    sorted.forEach(guest => {
        list.appendChild(editingId === guest.id ? buildEditRow(guest) : buildGuestRow(guest));
    });
    return list;
}

function buildGuestRow(guest) {
    const row = document.createElement('div');
    row.className = 'gm-row';

    const dot = document.createElement('span');
    dot.className = 'rsvp-dot';
    dot.style.background = RSVP_COLORS[guest.rsvp];

    const name = document.createElement('span');
    name.className = 'gm-row-name';
    name.textContent = guest.name;

    const tagSelect = document.createElement('select');
    tagSelect.className = 'gm-tag-select';
    const noTagOpt = document.createElement('option');
    noTagOpt.value = '';
    noTagOpt.textContent = '—';
    tagSelect.appendChild(noTagOpt);
    tagStore.getAll().forEach(tag => {
        const opt = document.createElement('option');
        opt.value = tag.id;
        opt.textContent = tag.name;
        opt.selected = tag.id === guest.tag;
        tagSelect.appendChild(opt);
    });
    tagSelect.value = guest.tag ?? '';
    tagSelect.addEventListener('change', () => {
        guestStore.update(guest.id, { tag: tagSelect.value || null });
    });
    const currentTag = tagStore.getById(guest.tag);
    if (currentTag) {
        tagSelect.style.borderColor = currentTag.color;
        tagSelect.style.background = currentTag.color + '33';
        row.style.background = currentTag.color + '18';
    }

    const rsvpSelect = document.createElement('select');
    rsvpSelect.className = 'gm-rsvp-select';
    rsvpSelect.style.setProperty('--rsvp-color', RSVP_COLORS[guest.rsvp]);
    RSVP_STATUSES.forEach(status => {
        const opt = document.createElement('option');
        opt.value = status;
        opt.textContent = t('gm-rsvp-' + status);
        opt.selected = status === guest.rsvp;
        rsvpSelect.appendChild(opt);
    });
    rsvpSelect.addEventListener('change', () => {
        guestStore.update(guest.id, { rsvp: rsvpSelect.value });
    });

    const editBtn = document.createElement('button');
    editBtn.className = 'gm-row-btn';
    editBtn.title = t('gm-edit-name');
    editBtn.textContent = t('gm-edit-name');
    editBtn.addEventListener('click', () => { editingId = guest.id; render(); });

    const delBtn = document.createElement('button');
    delBtn.className = 'gm-row-btn gm-del-btn';
    delBtn.title = t('gm-delete');
    delBtn.textContent = t('gm-delete');
    delBtn.addEventListener('click', () => {
        showConfirm(t('confirm-title-delete'), `${t('gm-delete')} ${guest.name}?`, () => {
            guestStore.remove(guest.id);
            showToast(`${guest.name} ${t('gm-delete').toLowerCase()}d`, 'info');
        });
    });

    const actions = document.createElement('div');
    actions.className = 'gm-row-actions';
    actions.append(editBtn, delBtn);

    row.append(dot, name, tagSelect, rsvpSelect, actions);
    return row;
}

function buildEditRow(guest) {
    const row = document.createElement('div');
    row.className = 'gm-row gm-row--editing';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'gm-edit-input';
    input.value = guest.name;

    const save = () => {
        const name = input.value.trim();
        if (name) guestStore.update(guest.id, { name });
        editingId = null;
        render();
    };
    const cancel = () => { editingId = null; render(); };

    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') cancel();
    });

    const saveBtn = document.createElement('button');
    saveBtn.className = 'gm-icon-btn gm-save-btn';
    saveBtn.textContent = '✓';
    saveBtn.addEventListener('click', save);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'gm-icon-btn gm-cancel-btn';
    cancelBtn.innerHTML = '&times;';
    cancelBtn.addEventListener('click', cancel);

    row.append(input, saveBtn, cancelBtn);
    setTimeout(() => { input.focus(); input.select(); }, 0);
    return row;
}

// ── Data actions (called from global nav bar) ──────────────────────────────

export function importData(file) {
    const reader = new FileReader();
    reader.onload = ev => {
        try {
            const parsed = JSON.parse(ev.target.result);
            if (Array.isArray(parsed)) {
                guestStore.replaceAll(parsed);
                showToast(t('alert-import-success'), 'success');
            } else if (parsed && typeof parsed === 'object') {
                if (parsed.tags) tagStore.replaceAll(parsed.tags);
                if (parsed.guests) guestStore.replaceAll(parsed.guests);
                showToast(t('alert-import-success'), 'success');
            } else {
                throw new Error('Invalid format');
            }
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
        guests: guestStore.getAll(),
        tags: tagStore.getAll()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'guests-and-groups.json';
    a.click();
    URL.revokeObjectURL(url);
}

export function clearData() {
    showConfirm(t('confirm-title-clear'), t('alert-clear-confirm'), () => {
        guestStore.clear();
        showToast(t('alert-import-success'), 'info');
    });
}
