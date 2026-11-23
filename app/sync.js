// Synchronizacja na żywo przez Supabase (tabela "rows").
// Każdy telefon loguje się anonimowo i dołącza do domu kodem.
import { onPush, mergeMany, allItems, getMe } from './store.js';

const CONF = 'naszdom:sync';
let client = null, house = null, queue = [], status = 'off', listeners = new Set();
const setStatus = (s) => { status = s; listeners.forEach((f) => f(s)); };
export const syncStatus = () => status;
export const getClient = () => client;
export const getHouse = () => house;
export const onStatus = (f) => { listeners.add(f); return () => listeners.delete(f); };
export const getConf = () => { try { return JSON.parse(localStorage.getItem(CONF)) || {}; } catch { return {}; } };

const row = (c, it) => ({ house, coll: c, id: it.id, data: it, ts: it.ts, owner: it.owner || null });

async function flush() {
  if (!client || !house || !queue.length) return;
  const batch = queue.splice(0, 200);
  const { error } = await client.from('rows').upsert(batch.map(([c, it]) => row(c, it)));
  if (error) { queue.unshift(...batch); setStatus('błąd: ' + error.message); setTimeout(flush, 5000); }
  else { setStatus('połączono'); if (queue.length) flush(); }
}

onPush((c, it) => { queue.push([c, it]); if (client) flush(); });

export const loadScript = (src) => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); });

export async function connect(conf) {
  if (!conf?.url || !conf?.key || !conf?.code) return;
  // tolerancja na wklejony adres z końcówką /rest/v1/ albo spacjami
  conf = { ...conf, url: conf.url.trim().replace(/\/(rest|auth)\/v1\/?.*$/, '').replace(/\/+$/, ''), key: conf.key.trim() };
  if (!window.supabase) await loadScript('./app/vendor/supabase.js');
  setStatus('łączenie…');
  try {
    client = window.supabase.createClient(conf.url, conf.key, { auth: { persistSession: true, storageKey: 'naszdom:auth' } });
    let { data: { session } } = await client.auth.getSession();
    if (!session) { const r = await client.auth.signInAnonymously(); if (r.error) throw r.error; }
    const { data: r, error } = await client.rpc('join_house', { p_code: conf.code, p_person: getMe(), p_pin: conf.pin || null });
    if (error) throw error;
    if (r?.error) throw new Error(r.error);
    house = r.house;
    const { pin, ...keep } = conf;  // PIN-u nie zapisujemy w telefonie
    localStorage.setItem(CONF, JSON.stringify(keep));
    // pobierz wszystko z serwera
    let from = 0; const all = [];
    for (;;) {
      const { data, error: e } = await client.from('rows').select('coll,data').eq('house', house).range(from, from + 999);
      if (e) throw e; all.push(...data); if (data.length < 1000) break; from += 1000;
    }
    const remote = new Map(all.map((r) => [r.coll + '/' + r.data.id, r.data.ts]));
    mergeMany(all);
    // wyślij to, czego serwer nie ma albo ma starsze
    for (const { coll, data } of allItems()) { const t = remote.get(coll + '/' + data.id); if (!t || t < data.ts) queue.push([coll, data]); }
    await flush();
    client.channel('dom').on('postgres_changes', { event: '*', schema: 'public', table: 'rows', filter: `house=eq.${house}` },
      (p) => p.new?.data && mergeMany([{ coll: p.new.coll, data: p.new.data }])).subscribe();
    setStatus('połączono');
  } catch (e) { setStatus('błąd: ' + (e.message || e)); client = null; }
}

export async function disconnect() { try { await client?.removeAllChannels(); await client?.auth.signOut(); } catch {} localStorage.removeItem(CONF); client = null; house = null; setStatus('off'); }
export const autoConnect = () => { const c = getConf(); if (c.url) connect(c); };
