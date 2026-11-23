// Magazyn danych: kolekcje {id: element}. Każda zmiana ma znacznik czasu (ts),
// dzięki czemu można ją zsynchronizować z drugim telefonem (wygrywa nowsza).
import { useState, useEffect } from './vendor/hooks.module.js';
import { uid } from './util.js';
import { seed } from './seed.js';

const KEY = 'naszdom:v1';
const ME = 'naszdom:me';
const subs = new Set();
let pushHook = null;

const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
export let db = load() || seed();

let saveT;
const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { console.warn(e); } }, 150); };
const emit = () => subs.forEach((f) => f());

export const getMe = () => { try { return localStorage.getItem(ME); } catch { return null; } };
export const other = (p) => (p === 'julia' ? 'franek' : 'julia');
export function setMe(p) { try { localStorage.setItem(ME, p); } catch {} emit(); }

const visible = (x) => !x.del && (!x.owner || x.owner === getMe());
export const list = (c) => Object.values(db[c] || {}).filter(visible);
export const get = (c, id) => { const x = db[c]?.[id]; return x && visible(x) ? x : undefined; };

export function put(c, item) {
  const it = { ...item, id: item.id || uid(), ts: Date.now() };
  (db[c] ||= {})[it.id] = it;
  save(); emit(); pushHook?.(c, it);
  return it;
}
export const patch = (c, id, p) => put(c, { ...(db[c]?.[id] || { id }), ...p });
export const remove = (c, id) => put(c, { id, del: true, owner: db[c]?.[id]?.owner });

export const cfg = (k, def) => db.cfg?.[k]?.v ?? def;
export const setCfg = (k, v) => put('cfg', { id: k, v });
export const person = (p) => cfg('people', {})[p]?.name || (p === 'julia' ? 'Julia' : 'Franek');
// odmiana: gen = dopełniacz (dla Franka), ins = narzędnik (z Frankiem)
const FORMS = { Julia: { gen: 'Julii', ins: 'Julią' }, Franek: { gen: 'Franka', ins: 'Frankiem' } };
export const personF = (p, c) => { const n = person(p); return FORMS[n]?.[c] || n; };

// Zdalne zmiany z synchronizacji
export function merge(c, it) {
  const cur = db[c]?.[it.id];
  if (cur && cur.ts >= it.ts) return false;
  (db[c] ||= {})[it.id] = it; return true;
}
export function mergeMany(rows) { let ch = false; for (const r of rows) ch = merge(r.coll, r.data) || ch; if (ch) { save(); emit(); } }
export const onPush = (f) => { pushHook = f; };
export const allItems = () => Object.entries(db).flatMap(([c, o]) => Object.values(o).map((data) => ({ coll: c, data })));

export function replaceAll(data) {
  // przywrócenie kopii: nowe znaczniki czasu, żeby wygrały i trafiły na drugi telefon
  const now = Date.now(); db = data;
  for (const [c, o] of Object.entries(db)) for (const it of Object.values(o)) { it.ts = now; pushHook?.(c, it); }
  save(); emit();
}
export const exportJSON = () => JSON.stringify(db);

export function useDB() {
  const [, f] = useState(0);
  useEffect(() => { const s = () => f((x) => x + 1); subs.add(s); return () => subs.delete(s); }, []);
  return db;
}
export const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
