# Placerie Studio — Architecture

## Overview

Single-page app (SPA) with three views: **Guest Manager**, **Place Cards**, **Seating Map**.  
Vanilla JS ES modules, no framework. CSS custom properties.  
LocalStorage persistence. Print via `@media print`.

```
index.html          → Single entry point, nav bar, view containers, print containers
app.js              → App bootstrap: lang, nav, view switching
guest-store.js      → Central guest data (pub/sub, localStorage)
guest-manager.js    → Guest list CRUD, RSVP, bulk import, search, filter
place-cards.js      → Place card layout, typography, print generation
seating-map.js      → Table management, drag-drop seating, room canvas
i18n.js             → Translations (en/pl), shared helpers, RSVP filter builder
constants.js        → Font data, page sizes, RSVP/weight enums, storage keys
utils.js            → debounce, escapeHtml, generateId, parseNames
style.css           → Global styles, layout, nav, inputs, buttons, print
guest-manager.css   → Guest list specific styles
place-cards.css     → Place card preview & print styles
seating-map.css     → Canvas, tables, chips, list view styles
serve.py            → Dev HTTP server (no-cache, error-only logging)
```

## Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                    guest-store.js                        │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────┐   │
│  │  guests[] │◄──│  save()  │◄──│ localStorage      │   │
│  │  (memory) │    │  load()  │    │ 'party-tools-    │   │
│  └────┬─────┘    └──────────┘    │  guests'         │   │
│       │ notify()                 └──────────────────┘   │
│       │ subscribers.forEach(fn)                         │
└───────┼─────────────────────────────────────────────────┘
        │
   ┌────┴────────────────────────────┐
   │                                  │
   ▼                                  ▼
guest-manager.js              place-cards.js          seating-map.js
  • add/edit/delete             • filter by RSVP        • filter by RSVP
  • search                      • typography controls   • table CRUD
  • RSVP status                 • card layout           • drag-drop seats
  • bulk import                 • print pages           • room canvas
  • export JSON                 • own state in          • own state in
                                  localStorage            localStorage
                                  'party-tools-           'party-tools-
                                   place-cards'            seating-map'
```

**Guest store is the single source of truth for guest data.**  
Place Cards and Seating Map subscribe to changes and reactively update.  
Each view persists its own UI state (typography, tables, positions) separately.

## Module Contracts

### `guest-store.js`
| Export | Signature | Notes |
|--------|-----------|-------|
| `load()` | `() => void` | Loads guests from localStorage, validates |
| `subscribe(fn)` | `(fn: (guests) => void) => unsubscribe` | Pub/sub on guest changes |
| `getAll()` | `() => Guest[]` | Returns shallow copy |
| `getById(id)` | `(string) => Guest \| null` | |
| `add(name)` | `(string) => Guest \| null` | Returns null if duplicate/empty |
| `addBulk(names)` | `(string[]) => Guest[]` | |
| `update(id, changes)` | `(string, Partial<Guest>) => void` | |
| `remove(id)` | `(string) => void` | |
| `clear()` | `() => void` | |
| `replaceAll(guests)` | `(Guest[]) => void` | Validates structure |
| `exportJSON()` | `() => string` | JSON string |

### `i18n.js`
| Export | Signature |
|--------|-----------|
| `i18n` | `{ en: {...}, pl: {...} }` — translation dictionary |
| `translateUI(lang)` | `(string) => void` — walks DOM for `data-i18n`, `data-i18n-placeholder`, `data-i18n-title` |
| `getLang()` | `() => string` — reads `document.documentElement.lang` |
| `t(key, ...args)` | `(string, ...any) => string` — translate key, passes args to function-type values |
| `buildRsvpFilter(container, filterArr, onChange)` | `(Element, string[], () => void) => void` — shared RSVP filter UI |

### `place-cards.js`
| Export | Signature |
|--------|-----------|
| `init()` | `() => void` |
| `onViewShow()` | `() => void` — re-applies zoom on tab switch |
| `onLangChange(lang)` | `(string) => void` — rebuilds filter, updates preview |

### `seating-map.js`
| Export | Signature |
|--------|-----------|
| `init()` | `() => void` |
| `onLangChange()` | `() => void` — rebuilds filter, re-renders |

## State & Persistence

Three separate localStorage keys:

| Key | Module | Contents |
|-----|--------|----------|
| `party-tools-guests` | guest-store | `Guest[]` — id, name, rsvp |
| `party-tools-place-cards` | place-cards | `{ fontFamily, fontSize, fontWeight, fontStyle, fontColor, cardWidth, cardHeight, sizingMode, gridCols, gridRows, cardPadding, cutGuides, cutMode, pageSize, marginSize, marginVisibility, previewZoom, imageData, imageFileName, imageSize, imageSpacing, verticalOffset, rsvpFilter, lang }` |
| `party-tools-seating-map` | seating-map | `{ tables, seats, rsvpFilter, viewMode, panelPos }` |
| `party-tools-lang` | app.js | `"en"` or `"pl"` |

Note: `party-tools-place-cards` duplicates `lang` — this is a known redundancy. The authoritative lang key is `party-tools-lang` managed by `app.js`.

## View Switching

`app.js` manages three `<div class="app-view">` containers:
- `#view-guests` — populated by `guest-manager.js` `init(container)`
- `#view-place-cards` — static HTML in `index.html`, initialized by `place-cards.js`
- `#view-seating-map` — static HTML in `index.html`, initialized by `seating-map.js`

Active view toggled via `.app-view--active` CSS class.  
Print containers (`#pc-print-container`, `#sm-print-map`, `#sm-print-list`) are separate divs outside `.app-views`, shown/hidden via `data-active-print` attribute during `@media print`.

## Print Architecture

Each view renders its print output into a standalone container:

1. **Place Cards**: `place-cards.js` builds `.print-page` divs into `#pc-print-container`  
2. **Seating Map**: `seating-map.js` builds `.print-map-canvas` or `.print-list-grid` into `#sm-print-map` / `#sm-print-list`

During `@media print`:
- All `.no-print` elements hidden
- Only the active print container (with `data-active-print="1"`) is displayed
- Print containers use `position: absolute` to fill the page
- Dynamic `@page { size: ... }` CSS injected via `<style>` tag

## Font System

Font data in `constants.js` (`FONT_DATA`) describes:
- `variable`: boolean — whether the font is a variable font (supports continuous weight via slider)
- `italic`: boolean — whether italic is available
- `weights`: array — discrete weights for non-variable fonts
- `min`/`max`: range for variable fonts
- `defaultWeight`: default weight

`buildWeightControl()` in `place-cards.js` renders either a range slider (variable) or a `<select>` (discrete weights). The custom font select replaces the native `<select>` with a styled dropdown that shows each option in its own font.

## Drag & Drop (Seating Map)

Two drag systems coexist:

1. **Table repositioning**: Mouse events (`mousedown`/`mousemove`/`mouseup`) on `.table-card-header`. Updates `table.x`/`table.y` as percentages of canvas. Panel uses same system via `tableId === '__panel__'`.

2. **Guest assignment**: HTML5 Drag & Drop API. Guest chips are `draggable`. Drop targets: seat slots, table bodies, unassigned panel, list view items. Custom drag ghost created from chip clone.

## Styling Conventions

- CSS custom properties in `:root` (`style.css`)
- BEM-ish naming: `.gm-row`, `.table-card-body`, `.seat-slot`
- Utility classes: `.mt-2`, `.mt-3`, `.full-width-btn`
- Print styles in each component's CSS file (not a separate print stylesheet)
- Mobile responsive: single `@media (max-width: 768px)` breakpoint, stack layout

## Dev Server

`serve.py` — Python 3 HTTP server:
- No-cache headers for development
- Only logs 4xx/5xx errors (not 2xx requests)
- Default port: 7823, configurable via CLI arg
- Usage: `python serve.py [port]`

## Adding a New Feature

1. If it's a new tool: add a nav tab in `index.html`, a view `<div>`, a JS module, a CSS file
2. Register view in `app.js` `VIEWS` array and `switchView()`
3. If it needs guest data: import from `guest-store.js`, subscribe to changes
4. If it has UI state: use a new `STORAGE_KEYS` entry
5. Add i18n keys to `i18n.js` for both `en` and `pl`
6. Use `getLang()`/`t()` from `i18n.js` for translations
7. For RSVP filtering: use `buildRsvpFilter()` from `i18n.js`
