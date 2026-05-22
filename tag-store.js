import { generateId } from './utils.js';
import { STORAGE_KEYS } from './constants.js';

const DEFAULT_TAGS = [
    { id: 'tag-family',  name: 'Family',  color: '#ef4444' },
    { id: 'tag-friends', name: 'Friends', color: '#3b82f6' },
    { id: 'tag-work',    name: 'Work',    color: '#10b981' },
];

let tags = [];
const subscribers = new Set();

function notify() {
    const snapshot = [...tags];
    subscribers.forEach(fn => fn(snapshot));
}

function save() {
    try {
        localStorage.setItem(STORAGE_KEYS.tags, JSON.stringify(tags));
    } catch (e) {
        console.error('Failed to save tags:', e);
    }
}

export function load() {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.tags);
        if (raw) {
            const parsed = JSON.parse(raw);
            tags = Array.isArray(parsed) ? parsed.filter(t => t.id && t.name) : [];
        } else {
            tags = DEFAULT_TAGS.map(t => ({ ...t }));
            save();
        }
    } catch (e) {
        tags = DEFAULT_TAGS.map(t => ({ ...t }));
    }
}

export function subscribe(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
}

export function getAll() { return [...tags]; }
export function getById(id) { return tags.find(t => t.id === id) ?? null; }

export function add(name, color = '#6366f1') {
    const tag = { id: generateId('tag'), name: name.trim(), color };
    tags.push(tag);
    save();
    notify();
    return tag;
}

export function update(id, changes) {
    const tag = tags.find(t => t.id === id);
    if (!tag) return;
    Object.assign(tag, changes);
    save();
    notify();
}

export function remove(id) {
    tags = tags.filter(t => t.id !== id);
    save();
    notify();
}

export function replaceAll(newTags) {
    if (Array.isArray(newTags)) {
        tags = newTags.filter(t => t && t.id && t.name).map(t => ({
            id: t.id,
            name: t.name.trim(),
            color: t.color || '#6366f1'
        }));
        save();
        notify();
    }
}
