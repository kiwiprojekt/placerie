import { generateId } from './utils.js';
import { STORAGE_KEYS, RSVP_STATUSES } from './constants.js';

let guests = [];
const subscribers = new Set();

function notify() {
    const snapshot = [...guests];
    subscribers.forEach(fn => fn(snapshot));
}

function save() {
    try {
        localStorage.setItem(STORAGE_KEYS.guests, JSON.stringify(guests));
    } catch (e) {
        if (e.name === 'QuotaExceededError') throw e;
        console.error('Failed to save guests:', e);
    }
}

export function load() {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.guests);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        guests = Array.isArray(parsed) ? parsed.filter(g => g.id && g.name != null && g.name !== '').map(g => ({
            id:   g.id,
            name: g.name,
            rsvp: RSVP_STATUSES.includes(g.rsvp) ? g.rsvp : 'pending',
            tag:  g.tag ?? null,
        })) : [];
    } catch (e) {
        console.error('Failed to load guests:', e);
        guests = [];
    }
}

export function subscribe(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
}

export function getAll() {
    return [...guests];
}

export function getById(id) {
    return guests.find(g => g.id === id) ?? null;
}

export function add(name) {
    const trimmed = name.trim();
    if (trimmed === '' || guests.some(g => g.name === trimmed)) return null;
    const g = { id: generateId('g'), name: trimmed, rsvp: 'pending', tag: null };
    guests.push(g);
    save();
    notify();
    return g;
}

export function addBulk(names, rsvp = 'pending') {
    const added = [];
    names.forEach(name => {
        const trimmed = name.trim();
        if (trimmed === '' || guests.some(g => g.name === trimmed)) return;
        const g = { id: generateId('g'), name: trimmed, rsvp, tag: null };
        guests.push(g);
        added.push(g);
    });
    if (added.length) { save(); notify(); }
    return added;
}

export function update(id, changes) {
    const g = guests.find(g => g.id === id);
    if (!g) return;
    if (changes.name !== undefined) changes.name = changes.name.trim();
    Object.assign(g, changes);
    save();
    notify();
}

export function remove(id) {
    guests = guests.filter(g => g.id !== id);
    save();
    notify();
}

export function clear() {
    guests = [];
    save();
    notify();
}

export function replaceAll(newGuests) {
    guests = newGuests
        .filter(g => g.id && g.name != null && g.name !== '')
        .map(g => ({
            id:   g.id,
            name: String(g.name).trim(),
            rsvp: RSVP_STATUSES.includes(g.rsvp) ? g.rsvp : 'pending',
            tag:  g.tag ?? null,
        }));
    save();
    notify();
}

export function exportJSON() {
    return JSON.stringify(guests, null, 2);
}
