export const WEIGHT_NAMES = {
    100: 'Thin', 200: 'Extra Light', 300: 'Light', 400: 'Regular',
    500: 'Medium', 600: 'Semi-Bold', 700: 'Bold', 800: 'Extra Bold', 900: 'Black'
};

export const FONT_DATA = {
    "'Spectral', serif":          { variable: false, italic: true,  weights: [200,300,400,500,600,700,800], defaultWeight: 400 },
    "'Cormorant Infant', serif":  { variable: false, italic: true,  weights: [300,400,500,600,700],         defaultWeight: 400 },
    "'Waterfall', cursive":       { variable: false, italic: false, weights: [400],                        defaultWeight: 400 },
    "'Inter', sans-serif":        { variable: true,  italic: true,  min: 100, max: 900,                    defaultWeight: 400 },
    "'Roboto', sans-serif":       { variable: true,  italic: true,  min: 100, max: 900,                    defaultWeight: 400 },
    "'Montserrat', sans-serif":   { variable: true,  italic: true,  min: 100, max: 900,                    defaultWeight: 400 },
    "'Playfair Display', serif":  { variable: true,  italic: true,  min: 400, max: 900,                    defaultWeight: 400 },
    "'Caveat', cursive":          { variable: true,  italic: false, min: 400, max: 700,                    defaultWeight: 400 },
    "'Dancing Script', cursive":  { variable: true,  italic: false, min: 400, max: 700,                    defaultWeight: 400 },
    "'Great Vibes', cursive":     { variable: false, italic: false, weights: [400],                        defaultWeight: 400 },
};

export const PAGE_SIZES = {
    'A4':     { width: 210,   height: 297   },
    'Letter': { width: 215.9, height: 279.4 }
};

export const RSVP_STATUSES = ['confirmed', 'declined', 'pending'];

export const GROUP_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308',
    '#84cc16', '#22c55e', '#10b981', '#14b8a6',
    '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
    '#a855f7', '#ec4899', '#f43f5e', '#64748b',
];

export const RSVP_COLORS = {
    confirmed: '#22c55e',
    declined:  '#ef4444',
    pending:   '#f59e0b',
    maybe:     '#8b5cf6',
};

export const STORAGE_KEYS = {
    guests:        'party-tools-guests',
    tags:          'party-tools-tags',
    placeCards:    'party-tools-place-cards',
    seatingMap:    'party-tools-seating-map',
    seatingSheets: 'party-tools-seating-sheets',
    lang:          'party-tools-lang',
};
