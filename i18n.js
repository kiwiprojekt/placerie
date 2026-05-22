import { RSVP_STATUSES, RSVP_COLORS } from './constants.js';

export const i18n = {
    en: {
        // App nav
        "nav-guests":          "Guests",
        "nav-place-cards":     "Place Cards",
        "nav-seating-map":     "Seating Map",
        "nav-seating-sheets":  "Table Seating Cards",

        // Footer
        "footer-copyright":    "© 2026 Placerie Studio. All rights reserved.",
        "footer-privacy":      "Privacy Policy",
        "footer-terms":        "Terms of Service",
        "footer-license":      "License",

        // Guest manager
        "gm-title":             "Guest List",
        "gm-add-placeholder":   "Guest name…",
        "gm-btn-add":           "Add",
        "gm-bulk-title":        "Bulk Import",
        "gm-bulk-placeholder":  "Paste names, one per line or comma separated…",
        "gm-btn-bulk-import":   "Add Guests",
        "gm-bulk-rsvp-label":  "Add as",
        "gm-sort-name":         "Name",
        "gm-sort-rsvp":         "RSVP",
        "gm-no-guests":         "No guests yet. Add names above or bulk import.",
        "gm-rsvp-confirmed":    "Confirmed",
        "gm-rsvp-declined":     "Declined",
        "gm-rsvp-pending":      "Pending",
        "gm-rsvp-maybe":        "Maybe",
        "btn-clear-all":        "Clear All",
        "gm-sort-label":        "Sort:",
        "gm-filter-empty":      "No guests match the filter.",
        "gm-edit-name":         "Edit name",
        "gm-delete":            "Delete",
        "gm-stats": (confirmed, declined, pending) =>
            `${confirmed} confirmed · ${declined} declined · ${pending} pending`,

        // Shared
        "section-rsvp-filter": "Guest Filter",
        "rsvp-filter-label":   "Include:",
        "btn-import":  "Import",
        "btn-export":  "Export",
        "btn-clear":   "Clear",
        "btn-print":   "Print",
        "btn-sponsor": "Sponsor",
        "btn-sponsor-title": "Sponsor on GitHub",
        "btn-coffee": "Buy Coffee",
        "btn-coffee-title": "Buy me a coffee",
        "alert-quota-exceeded": "Local storage quota exceeded. Try using a smaller image.",
        "alert-import-error":   "Failed to parse file. Make sure it is a valid JSON file.",
        "alert-import-success": "Imported successfully!",
        "alert-clear-confirm":  "Clear all data and reset to defaults?",
        "confirm-title-clear":  "Clear All Data",
        "confirm-title-delete": "Delete Guest",

        // Place cards
        "section-typography":   "Typography",
        "label-font-family":    "Font Family",
        "label-color":          "Color",
        "label-size":           "Size (pt)",
        "label-weight":         "Weight",
        "label-style":          "Style",
        "style-regular":        "Regular",
        "style-italic":         "Italic",
        "section-card":         "Card Settings",
        "label-sizing-mode":    "Sizing Mode",
        "opt-dimensions":       "Specific Dimensions",
        "opt-grid":             "Grid (Rows/Cols)",
        "label-width":          "Width (mm)",
        "label-height":         "Height (mm)",
        "label-cols":           "Columns",
        "label-rows":           "Rows",
        "label-padding":        "Inside Margin (mm)",
        "label-cut-guides":     "Cut Guides Style",
        "label-cut-mode":       "Cut Mode",
        "opt-full":             "Full Page",
        "opt-external":         "External Only",
        "opt-none":             "None",
        "opt-dashed-light":     "Light Dashed",
        "opt-dashed":           "Dashed",
        "opt-solid":            "Solid",
        "section-page":         "Page Layout",
        "label-page-size":      "Page Size",
        "label-margin":         "Margin (mm)",
        "label-margin-visibility": "Margin Line",
        "opt-preview":          "Preview Only",
        "opt-preview-print":    "Preview & Print",
        "heading-preview":      "Preview",
        "opt-fit":              "Fit",
        "label-vertical-offset": "Vertical Offset",
        "section-decoration":   "Graphics",
        "label-image-upload":   "Upload File",
        "label-image-size":     "Height (mm)",
        "label-image-spacing":  "Spacing (mm)",
        "btn-remove-image":     "Remove",
        "alert-no-names":       "No guests match the current filter.",
        "alert-image-too-large": "Image too large. Use an image smaller than 2MB.",
        "pc-rsvp-count": (count) => `${count} guest${count !== 1 ? 's' : ''}`,
        "stats": (cards, pages) => `${cards} Card${cards !== 1 ? 's' : ''} · ${pages} Page${pages !== 1 ? 's' : ''}`,

        // Seating map
        "section-tables":       "Tables",
        "label-table-name":     "Table Name",
        "label-table-shape":    "Shape",
        "label-table-capacity": "Seats",
        "opt-rectangle":        "Rectangle",
        "opt-round":            "Round",
        "opt-head":             "Head Table",
        "btn-add-table":        "Add Table",
        "heading-map":          "Room Map",
        "heading-list":         "Seating List",
        "view-map":             "Map",
        "view-list":            "List",
        "btn-unassign":         "Unassign",
        "sm-unseated":          "Unseated",
        "sm-search-no-matches": "No matches",
        "sm-delete-table":      "Delete table",
        "sm-edit-table":        "Edit table",
        "sm-shape-rectangle":   "Rectangle",
        "sm-shape-round":       "Round",
        "sm-shape-head":        "Head Table",
        "stats-guests": (assigned, total) => `${assigned} of ${total} seated`,
        "all-assigned":         "All guests seated!",
        "hint-add-tables":      "Add tables using the sidebar to get started",
        "alert-no-tables":      "Add at least one table before printing.",
        "alert-clear-confirm-sm": "Clear all tables and seating assignments?",
        
        // Seating sheets
        "section-typography-table":  "Table Title Typography",
        "label-table-header-spacing-top": "Top Spacing",
        "label-table-header-spacing-bottom": "Bottom Spacing",
        "section-typography-guest":  "Guest List Typography",
        "section-decoration-top":     "Top Image (Header)",
        "section-decoration-bottom":  "Bottom Image (Footer)",
        "label-image-upload-top":     "Upload Header",
        "label-image-upload-bottom":  "Upload Footer",
        "alert-no-tables-print":      "Create tables with seated guests before printing arrangement sheets.",
        "ss-stats": (tables, pages) => `${tables} Table${tables !== 1 ? 's' : ''} · ${pages} Page${pages !== 1 ? 's' : ''}`,
    },
    pl: {
        // App nav
        "nav-guests":          "Goście",
        "nav-place-cards":     "Winietki",
        "nav-seating-map":     "Mapa Miejsc",
        "nav-seating-sheets":  "Karty Stołów",

        // Footer
        "footer-copyright":    "© 2026 Placerie Studio. Wszelkie prawa zastrzeżone.",
        "footer-privacy":      "Polityka Prywatności",
        "footer-terms":        "Regulamin",
        "footer-license":      "Licencja",

        // Guest manager
        "gm-title":             "Lista Gości",
        "gm-add-placeholder":   "Imię i nazwisko…",
        "gm-btn-add":           "Dodaj",
        "gm-bulk-title":        "Importuj zbiorowo",
        "gm-bulk-placeholder":  "Wklej imiona, jedno w linii lub oddzielone przecinkami…",
        "gm-btn-bulk-import":   "Dodaj gości",
        "gm-bulk-rsvp-label":  "Dodaj jako",
        "gm-sort-name":         "Imię",
        "gm-sort-rsvp":         "RSVP",
        "gm-no-guests":         "Brak gości. Dodaj imiona powyżej lub zaimportuj.",
        "gm-rsvp-confirmed":    "Potwierdzone",
        "gm-rsvp-declined":     "Odmówione",
        "gm-rsvp-pending":      "Oczekujące",
        "gm-rsvp-maybe":        "Może",
        "btn-clear-all":        "Wyczyść wszystko",
        "gm-sort-label":        "Sortuj:",
        "gm-filter-empty":      "Brak gości spełniających kryteria.",
        "gm-edit-name":         "Edytuj nazwę",
        "gm-delete":            "Usuń",
        "gm-stats": (confirmed, declined, pending) =>
            `${confirmed} potwierdzonych · ${declined} odmów · ${pending} oczekujących`,

        // Shared
        "section-rsvp-filter": "Filtr Gości",
        "rsvp-filter-label":   "Uwzględnij:",
        "btn-import":  "Import",
        "btn-export":  "Eksport",
        "btn-clear":   "Wyczyść",
        "btn-print":   "Drukuj",
        "btn-sponsor": "Wesprzyj",
        "btn-sponsor-title": "Wesprzyj na GitHubie",
        "btn-coffee": "Kup Kawę",
        "btn-coffee-title": "Postaw mi kawę",
        "alert-quota-exceeded": "Przekroczono limit pamięci. Użyj mniejszego obrazu.",
        "alert-import-error":   "Nie udało się wczytać pliku.",
        "alert-import-success": "Zaimportowano pomyślnie!",
        "alert-clear-confirm":  "Wyczyścić wszystkie dane i przywrócić ustawienia domyślne?",
        "confirm-title-clear":  "Wyczyść Wszystkie Dane",
        "confirm-title-delete": "Usuń Gościa",

        // Place cards
        "section-typography":   "Typografia",
        "label-font-family":    "Krój Czcionki",
        "label-color":          "Kolor",
        "label-size":           "Rozmiar (pt)",
        "label-weight":         "Grubość",
        "label-style":          "Styl",
        "style-regular":        "Normalny",
        "style-italic":         "Kursywa",
        "section-card":         "Ustawienia Winietki",
        "label-sizing-mode":    "Tryb Rozmiaru",
        "opt-dimensions":       "Własne Wymiary",
        "opt-grid":             "Siatka (Wiersze/Kolumny)",
        "label-width":          "Szerokość (mm)",
        "label-height":         "Wysokość (mm)",
        "label-cols":           "Kolumny",
        "label-rows":           "Wiersze",
        "label-padding":        "Margines Wewnętrzny (mm)",
        "label-cut-guides":     "Styl Linii Cięcia",
        "label-cut-mode":       "Tryb Cięcia",
        "opt-full":             "Przez Całą Stronę",
        "opt-external":         "Tylko Zewnętrzne",
        "opt-none":             "Brak",
        "opt-dashed-light":     "Jasne Przerywane",
        "opt-dashed":           "Przerywane",
        "opt-solid":            "Ciągłe",
        "section-page":         "Układ Strony",
        "label-page-size":      "Rozmiar Strony",
        "label-margin":         "Margines (mm)",
        "label-margin-visibility": "Linia Marginesu",
        "opt-preview":          "Tylko Podgląd",
        "opt-preview-print":    "Podgląd i Druk",
        "heading-preview":      "Podgląd",
        "opt-fit":              "Dopasuj",
        "label-vertical-offset": "Przesunięcie Pionowe",
        "section-decoration":   "Grafika",
        "label-image-upload":   "Wgraj Plik",
        "label-image-size":     "Wysokość (mm)",
        "label-image-spacing":  "Odstęp (mm)",
        "btn-remove-image":     "Usuń",
        "alert-no-names":       "Brak gości spełniających kryteria filtru.",
        "alert-image-too-large": "Obraz za duży. Użyj pliku mniejszego niż 2MB.",
        "pc-rsvp-count": (count) => {
            if (count === 1) return '1 gość';
            if ([2,3,4].includes(count % 10) && ![12,13,14].includes(count % 100)) return `${count} gości`;
            return `${count} gości`;
        },
        "stats": (cards, pages) => {
            const getWinietki = (n) => {
                if (n === 1) return 'Winietka';
                if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return 'Winietki';
                return 'Winietek';
            };
            const getStrony = (n) => {
                if (n === 1) return 'Strona';
                if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return 'Strony';
                return 'Stron';
            };
            return `${cards} ${getWinietki(cards)} · ${pages} ${getStrony(pages)}`;
        },

        // Seating map
        "section-tables":       "Stoły",
        "label-table-name":     "Nazwa Stołu",
        "label-table-shape":    "Kształt",
        "label-table-capacity": "Miejsca",
        "opt-rectangle":        "Prostokąt",
        "opt-round":            "Okrągły",
        "opt-head":             "Stół Honorowy",
        "btn-add-table":        "Dodaj Stół",
        "heading-map":          "Mapa Sali",
        "heading-list":         "Lista Miejsc",
        "view-map":             "Mapa",
        "view-list":            "Lista",
        "btn-unassign":         "Odpisz",
        "sm-unseated":          "Nieprzypisani",
        "sm-search-no-matches": "Brak wyników",
        "sm-delete-table":      "Usuń stół",
        "sm-edit-table":        "Edytuj stół",
        "sm-shape-rectangle":   "Prostokąt",
        "sm-shape-round":       "Okrągły",
        "sm-shape-head":        "Stół Honorowy",
        "stats-guests": (assigned, total) => {
            const suffix = (n) => n === 1 ? 'gość przypisany' : 'gości przypisanych';
            return `${assigned} z ${total} ${suffix(assigned)}`;
        },
        "all-assigned":         "Wszyscy goście przypisani!",
        "hint-add-tables":      "Dodaj stoły za pomocą panelu bocznego",
        "alert-no-tables":      "Dodaj przynajmniej jeden stół przed drukowaniem.",
        "alert-clear-confirm-sm": "Wyczyścić wszystkie stoły i przypisania?",

        // Seating sheets
        "section-typography-table":  "Typografia Nagłówka Stołu",
        "label-table-header-spacing-top": "Odstęp nad nagłówkiem",
        "label-table-header-spacing-bottom": "Odstęp pod nagłówkiem",
        "section-typography-guest":  "Typografia Listy Gości",
        "section-decoration-top":     "Górna Grafika (Nagłówek)",
        "section-decoration-bottom":  "Dolna Grafika (Stopka)",
        "label-image-upload-top":     "Wgraj Nagłówek",
        "label-image-upload-bottom":  "Wgraj Stopkę",
        "alert-no-tables-print":      "Dodaj stoły z gośćmi przed wydrukiem kart stołów.",
        "ss-stats": (tables, pages) => `${tables} ${tables === 1 ? 'Stół' : [2,3,4].includes(tables % 10) && ![12,13,14].includes(tables % 100) ? 'Stoły' : 'Stołów'} · ${pages} ${pages === 1 ? 'Strona' : [2,3,4].includes(pages % 10) && ![12,13,14].includes(pages % 100) ? 'Strony' : 'Stron'}`,
    }
};

export function translateUI(lang) {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        const val = i18n[lang][key];
        if (val && typeof val === 'string') el.textContent = val;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.dataset.i18nPlaceholder;
        const val = i18n[lang][key];
        if (val) el.placeholder = val;
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.dataset.i18nTitle;
        const val = i18n[lang][key];
        if (val) el.title = val;
    });
}

// ── Shared helpers ──────────────────────────────────────────────────────────

/** Get current language from document. */
export function getLang() {
    return document.documentElement.lang || 'en';
}

/** Translate a key, passing optional args to function-type values. */
export function t(key, ...args) {
    const lang = getLang();
    const val = i18n[lang][key];
    return typeof val === 'function' ? val(...args) : (val ?? key);
}

/** Build a shared filter pill row. Each pill toggles its value.
 *  `items`: array of `{ value, label, color }`.
 *  `activeSet`: Set of active values (mutated in place).
 *  `onChange` called after toggle. */
export function buildFilterPills(container, items, activeSet, onChange) {
    container.innerHTML = '';
    container.className = (container.className || '') + ' filter-pill-row';
    items.forEach(({ value, label, color }) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        const active = activeSet.has(value);
        btn.className = 'filter-pill' + (active ? ' filter-pill--on' : '');
        if (active) btn.style.setProperty('--pill-color', color);

        const dot = document.createElement('span');
        dot.className = 'filter-pill-dot';
        dot.style.background = color;

        const text = document.createElement('span');
        text.textContent = label;

        btn.append(dot, text);
        btn.addEventListener('click', () => {
            if (activeSet.has(value)) activeSet.delete(value);
            else activeSet.add(value);
            onChange();
        });
        container.appendChild(btn);
    });
}

/** Build RSVP filter pills. Wraps buildFilterPills for RSVP statuses.
 *  `rsvpFilter` is an array (mutated); converted to/from Set internally. */
export function buildRsvpFilter(container, rsvpFilter, onChange) {
    const activeSet = new Set(rsvpFilter);
    const items = RSVP_STATUSES.map(s => ({
        value: s,
        label: t('gm-rsvp-' + s),
        color: RSVP_COLORS[s],
    }));
    const wrap = (val) => {
        rsvpFilter.length = 0;
        [...activeSet].forEach(v => rsvpFilter.push(v));
        onChange();
    };
    buildFilterPills(container, items, activeSet, wrap);
}
