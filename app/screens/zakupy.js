import { useState, useEffect, useRef } from '../vendor/hooks.module.js';
import { html, Icon, Sheet, Seg, Chips, Field, Dot, Empty, Page } from '../ui.js';
import { list, put, patch, remove, getMe, get } from '../store.js';
import { num, today, relDays, diffDays, groupBy, norm } from '../util.js';
import { PLACES, CARD_COLORS } from '../seed.js';
import { sectionOf, SECTION_ORDER, placeOf, fmtQty } from '../logic.js';

const UNITS = ['szt', 'kg', 'g', 'dag', 'l', 'ml', 'op.'];
const blix = (name) => `https://blix.pl/szukaj/?szukaj=${encodeURIComponent(name)}`;

export function addToList(name, qty, unit, listId) {
  const lid = listId || list('lists').find((l) => l.name === 'Ogólna')?.id;
  const ex = list('shopping').find((s) => !s.done && norm(s.name) === norm(name) && s.listId === lid);
  if (ex) { if (qty && ex.unit === unit) patch('shopping', ex.id, { qty: num(ex.qty) + num(qty) }); return; }
  put('shopping', { name, qty: num(qty) || 0, unit: unit || 'szt', listId: lid, section: sectionOf(name), done: false, by: getMe() });
}

export function Zakupy({ args }) {
  const [tab, setTab] = useState(args[0] || 'lista');
  return html`<div class="page">
    <header class="ph"><h1>Zakupy</h1></header>
    <${Seg} value=${tab} onChange=${(v) => { setTab(v); history.replaceState(null, '', '#/zakupy/' + v); }} options=${[['lista', 'Lista'], ['spizarnia', 'Spiżarnia'], ['karty', 'Karty']]} />
    ${tab === 'lista' && html`<${Lista} />`}${tab === 'spizarnia' && html`<${Spizarnia} />`}${tab === 'karty' && html`<${Karty} />`}
  </div>`;
}

function Lista() {
  const lists = list('lists').sort((a, b) => a.order - b.order);
  const items = list('shopping');
  const [sel, setSel] = useState('all');
  const [f, setF] = useState({ name: '', qty: '', unit: 'szt' });
  const [edit, setEdit] = useState(null), [finish, setFinish] = useState(false), [newList, setNewList] = useState(false);
  const shown = items.filter((i) => sel === 'all' || i.listId === sel);
  const todo = shown.filter((i) => !i.done), done = shown.filter((i) => i.done);
  const target = sel === 'all' ? lists.find((l) => l.name === 'Ogólna')?.id : sel;
  const add = (e) => { e.preventDefault(); if (!f.name.trim()) return; addToList(f.name.trim(), f.qty, f.unit, target); setF({ name: '', qty: '', unit: f.unit }); };
  const lname = (id) => lists.find((l) => l.id === id)?.name;
  const opts = [['all', `Wszystkie ${items.filter((i) => !i.done).length}`], ...lists.map((l) => [l.id, `${l.name} ${items.filter((i) => i.listId === l.id && !i.done).length || ''}`.trim()])];
  return html`<div class="stack">
    <div class="scroll-x"><div class="chips">${opts.map(([v, l]) => html`<button class=${'chip' + (v === sel ? ' on' : '')} onClick=${() => setSel(v)}>${l}</button>`)}
      <button class="chip" onClick=${() => setNewList(true)}>+ lista</button></div></div>
    <form class="addrow" onSubmit=${add}>
      <input placeholder=${'Dodaj do: ' + (lname(target) || '')} value=${f.name} onInput=${(e) => setF({ ...f, name: e.target.value })} />
      <input placeholder="ile" inputmode="decimal" value=${f.qty} onInput=${(e) => setF({ ...f, qty: e.target.value })} />
      <select value=${f.unit} onChange=${(e) => setF({ ...f, unit: e.target.value })}>${UNITS.map((u) => html`<option>${u}</option>`)}</select>
      <button class="btn" aria-label="Dodaj"><${Icon} n="plus" /></button>
    </form>
    ${SECTION_ORDER.map((sec) => { const its = todo.filter((i) => (i.section || 'Inne') === sec); if (!its.length) return null;
      return html`<div><h3>${sec}</h3><div class="card" style="padding-top:2px;padding-bottom:2px">${its.map((i) => html`<${ShopRow} i=${i} lname=${sel === 'all' && lname(i.listId)} onEdit=${() => setEdit(i)} />`)}</div></div>`; })}
    ${!todo.length && html`<${Empty}>${done.length ? 'Wszystko w koszyku!' : 'Lista jest pusta.'}</${Empty}>`}
    ${done.length > 0 && html`<div><h3>W koszyku · ${done.length}</h3><div class="card" style="padding-top:2px;padding-bottom:2px">${done.map((i) => html`<${ShopRow} i=${i} onEdit=${() => setEdit(i)} />`)}</div>
      <button class="btn primary block" style="margin-top:10px" onClick=${() => setFinish(true)}><${Icon} n="check" s=${20} /> Zakończ zakupy</button></div>`}
    ${edit && html`<${ItemForm} i=${edit} lists=${lists} onClose=${() => setEdit(null)} />`}
    ${finish && html`<${FinishSheet} items=${done} onClose=${() => setFinish(false)} />`}
    ${newList && html`<${ListsSheet} lists=${lists} onClose=${() => setNewList(false)} />`}
  </div>`;
}

function ShopRow({ i, lname, onEdit }) {
  return html`<div class="row">
    <button class=${'check ' + (i.done ? 'on' : '')} onClick=${() => patch('shopping', i.id, { done: !i.done })} aria-label="Kupione">${i.done && html`<${Icon} n="check" s=${16} />`}</button>
    <span class=${'grow ' + (i.done ? 'done-txt' : '')} onClick=${() => patch('shopping', i.id, { done: !i.done })}>
      <span class="t">${i.name} <span class="small muted">${fmtQty(i.qty, i.unit)}</span></span>${lname && html`<span class="s">${lname}</span>`}</span>
    <${Dot} p=${i.by} />
    ${!i.done && html`<a class="icon-btn sm" href=${blix(i.name)} target="_blank" rel="noopener" title="Sprawdź promocje w Blix" aria-label="Sprawdź w Blix"><${Icon} n="tag" s=${18} /></a>`}
    <button class="icon-btn sm" onClick=${onEdit} aria-label="Edytuj"><${Icon} n="edit" s=${18} /></button></div>`;
}

function ItemForm({ i, lists, onClose }) {
  const [f, setF] = useState({ name: i.name, qty: i.qty ? String(i.qty).replace('.', ',') : '', unit: i.unit, listId: i.listId });
  return html`<${Sheet} title="Produkt" onClose=${onClose}><div class="form">
    <${Field} label="Nazwa"><input value=${f.name} onInput=${(e) => setF({ ...f, name: e.target.value })} /></${Field}>
    <div class="inline"><${Field} label="Ilość"><input inputmode="decimal" value=${f.qty} onInput=${(e) => setF({ ...f, qty: e.target.value })} /></${Field}>
      <${Field} label="Jednostka"><select value=${f.unit} onChange=${(e) => setF({ ...f, unit: e.target.value })}>${UNITS.map((u) => html`<option>${u}</option>`)}</select></${Field}></div>
    <${Field} label="Lista"><${Chips} value=${f.listId} onChange=${(v) => setF({ ...f, listId: v })} options=${lists.map((l) => [l.id, l.name])} /></${Field}>
    <button class="btn primary block" onClick=${() => { patch('shopping', i.id, { name: f.name.trim(), qty: num(f.qty), unit: f.unit, listId: f.listId, section: sectionOf(f.name) }); onClose(); }}>Zapisz</button>
    <button class="btn ghost block" onClick=${() => { remove('shopping', i.id); onClose(); }}><${Icon} n="trash" s=${18} /> Usuń z listy</button>
  </div></${Sheet}>`;
}

function FinishSheet({ items, onClose }) {
  const [rows, setRows] = useState(items.map((i) => ({ i, on: !['Chemia i higiena'].includes(i.section) || true, place: placeOf(i.name), exp: '' })));
  const upd = (k, p) => setRows(rows.map((r, j) => (j === k ? { ...r, ...p } : r)));
  const go = () => {
    for (const r of rows) {
      if (r.on) {
        const ex = list('pantry').find((p) => norm(p.name) === norm(r.i.name) && p.unit === r.i.unit && p.place === r.place);
        if (ex) patch('pantry', ex.id, { qty: num(ex.qty) + num(r.i.qty), expires: r.exp || ex.expires });
        else put('pantry', { name: r.i.name, qty: r.i.qty, unit: r.i.unit, place: r.place, expires: r.exp || '' });
      }
      remove('shopping', r.i.id);
    }
    onClose();
  };
  return html`<${Sheet} title="Do spiżarni" onClose=${onClose}><div class="form">
    <p class="muted">Zaznaczone produkty trafią do spiżarni. Możesz od razu wpisać datę ważności.</p>
    ${rows.map((r, k) => html`<div class="card" style="padding:10px 12px">
      <label class="toggle"><input type="checkbox" checked=${r.on} onChange=${(e) => upd(k, { on: e.target.checked })} />${r.i.name} <span class="muted small">${fmtQty(r.i.qty, r.i.unit)}</span></label>
      ${r.on && html`<div class="inline" style="margin-top:8px"><select value=${r.place} onChange=${(e) => upd(k, { place: e.target.value })}>${PLACES.map((p) => html`<option>${p}</option>`)}</select>
        <input type="date" value=${r.exp} onInput=${(e) => upd(k, { exp: e.target.value })} aria-label="Data ważności" /></div>`}</div>`)}
    <button class="btn primary block" onClick=${go}>Gotowe</button></div></${Sheet}>`;
}

function ListsSheet({ lists, onClose }) {
  const [n, setN] = useState('');
  return html`<${Sheet} title="Listy zakupów" onClose=${onClose}><div class="form">
    <form class="inline" onSubmit=${(e) => { e.preventDefault(); if (n.trim()) { put('lists', { name: n.trim(), order: lists.length }); setN(''); } }}>
      <input placeholder="Nazwa nowej listy, np. IKEA" value=${n} onInput=${(e) => setN(e.target.value)} /><button class="btn primary">Dodaj</button></form>
    <div class="card">${lists.map((l) => html`<div class="row"><span class="grow">${l.name}</span>
      ${l.name !== 'Ogólna' && html`<button class="icon-btn sm" aria-label="Usuń listę" onClick=${() => { if (confirm(`Usunąć listę ${l.name}? Produkty z niej trafią do Ogólnej.`)) {
        const og = lists.find((x) => x.name === 'Ogólna'); list('shopping').filter((s) => s.listId === l.id).forEach((s) => patch('shopping', s.id, { listId: og.id })); remove('lists', l.id); } }}><${Icon} n="trash" s=${18} /></button>`}</div>`)}</div>
  </div></${Sheet}>`;
}

function expPill(d) {
  if (!d) return null;
  const n = diffDays(today(), d);
  return html`<span class=${'pill ' + (n < 0 ? 'bad' : n <= 2 ? 'warn' : '')}>${n < 0 ? 'po terminie' : relDays(d)}</span>`;
}

function Spizarnia() {
  const items = list('pantry');
  const [f, setF] = useState({ name: '', qty: '', unit: 'szt', place: 'Lodówka' });
  const [edit, setEdit] = useState(null);
  const add = (e) => { e.preventDefault(); if (!f.name.trim()) return; put('pantry', { ...f, name: f.name.trim(), qty: num(f.qty), expires: '' }); setF({ ...f, name: '', qty: '' }); };
  return html`<div class="stack">
    <form class="addrow" style="grid-template-columns:1fr 60px 104px 46px" onSubmit=${add}>
      <input placeholder="Dodaj do spiżarni" value=${f.name} onInput=${(e) => setF({ ...f, name: e.target.value, place: placeOf(e.target.value) === 'Szafka' ? f.place : placeOf(e.target.value) })} />
      <input placeholder="ile" inputmode="decimal" value=${f.qty} onInput=${(e) => setF({ ...f, qty: e.target.value })} />
      <select value=${f.place} onChange=${(e) => setF({ ...f, place: e.target.value })}>${PLACES.map((p) => html`<option>${p}</option>`)}</select>
      <button class="btn" aria-label="Dodaj"><${Icon} n="plus" /></button></form>
    <div class="grid2">${PLACES.map((pl) => { const its = items.filter((i) => i.place === pl).sort((a, b) => (a.expires || '9').localeCompare(b.expires || '9'));
      return html`<div><h3>${pl}</h3><div class="card" style="padding-top:2px;padding-bottom:2px">
        ${its.map((i) => html`<div class="row"><span class="grow click" onClick=${() => setEdit(i)}><span class="t">${i.name} <span class="small muted">${fmtQty(i.qty, i.unit)}</span></span></span>
          ${expPill(i.expires)}
          <button class="icon-btn sm soft" title="Dopisz do listy" aria-label="Dopisz do listy" onClick=${() => addToList(i.name, 0, i.unit)}><${Icon} n="cart" s=${18} /></button>
          <button class="icon-btn sm soft" title="Zużyte" aria-label="Zużyte" onClick=${() => remove('pantry', i.id)}><${Icon} n="check" s=${18} /></button></div>`)}
        ${!its.length && html`<${Empty}>Pusto.</${Empty}>`}</div></div>`; })}</div>
    <p class="small muted">✓ zużyte (usuń) · koszyk: dopisz do listy zakupów. Gdy dodajesz składniki z przepisu, sprawdzam, co już jest w spiżarni.</p>
    ${edit && html`<${PantryForm} i=${edit} onClose=${() => setEdit(null)} />`}
  </div>`;
}

function PantryForm({ i, onClose }) {
  const [f, setF] = useState({ ...i, qty: i.qty ? String(i.qty).replace('.', ',') : '' });
  const s = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return html`<${Sheet} title=${i.name} onClose=${onClose}><div class="form">
    <${Field} label="Nazwa"><input value=${f.name} onInput=${s('name')} /></${Field}>
    <div class="inline"><${Field} label="Ilość"><input inputmode="decimal" value=${f.qty} onInput=${s('qty')} /></${Field}>
      <${Field} label="Jednostka"><select value=${f.unit} onChange=${s('unit')}>${UNITS.map((u) => html`<option>${u}</option>`)}</select></${Field}></div>
    <${Field} label="Miejsce"><${Chips} value=${f.place} onChange=${(v) => setF({ ...f, place: v })} options=${PLACES.map((p) => [p, p])} /></${Field}>
    <${Field} label="Ważne do"><input type="date" value=${f.expires} onInput=${s('expires')} /></${Field}>
    <button class="btn primary block" onClick=${() => { put('pantry', { ...f, qty: num(f.qty) }); onClose(); }}>Zapisz</button>
    <button class="btn ghost block" onClick=${() => { remove('pantry', i.id); onClose(); }}>Zużyte / usuń</button></div></${Sheet}>`;
}

function Karty() {
  const cards = list('cards');
  const [edit, setEdit] = useState(null);
  return html`<div class="stack"><div class="lcards">
    ${cards.map((c) => html`<a class="lcard" style=${`background:${c.color || '#888'}`} href=${c.number ? '#/karta/' + c.id : undefined} onClick=${(e) => { if (!c.number) { e.preventDefault(); setEdit(c); } }}>
      ${c.store}<small>${c.number ? '•••• ' + c.number.slice(-4) : 'dodaj numer'}</small></a>`)}
    <button class="lcard add" onClick=${() => setEdit({})}><${Icon} n="plus" /> Dodaj kartę</button></div>
    <p class="small muted">Karty widzicie oboje. Przy kasie otwórz kartę i pokaż kod.</p>
    ${edit && html`<${CardForm} c=${edit} onClose=${() => setEdit(null)} />`}</div>`;
}

function CardForm({ c, onClose }) {
  const [f, setF] = useState({ store: c.store || '', number: c.number || '', color: c.color || '' });
  const color = f.color || CARD_COLORS[f.store] || '#8A5A70';
  return html`<${Sheet} title=${c.id ? 'Karta ' + c.store : 'Nowa karta'} onClose=${onClose}><div class="form">
    <${Field} label="Sklep"><input value=${f.store} onInput=${(e) => setF({ ...f, store: e.target.value })} placeholder="np. Rossmann" /></${Field}>
    <${Field} label="Numer karty" hint="Przepisz cyfry spod kodu kreskowego na karcie (bez spacji)."><input inputmode="numeric" value=${f.number} onInput=${(e) => setF({ ...f, number: e.target.value.replace(/\s/g, '') })} /></${Field}>
    ${f.number && html`<${Barcode} value=${f.number} />`}
    <${Field} label="Kolor"><input type="color" value=${color} onInput=${(e) => setF({ ...f, color: e.target.value })} style="height:48px;padding:4px" /></${Field}>
    <button class="btn primary block" disabled=${!f.store.trim()} onClick=${() => { put('cards', { ...c, store: f.store.trim(), number: f.number, color }); onClose(); }}>Zapisz</button>
    ${c.id && html`<button class="btn ghost block" onClick=${() => { if (confirm('Usunąć kartę?')) { remove('cards', c.id); onClose(); } }}>Usuń</button>`}</div></${Sheet}>`;
}

const ean13ok = (s) => /^\d{13}$/.test(s) && (10 - [...s.slice(0, 12)].reduce((a, d, i) => a + d * (i % 2 ? 3 : 1), 0) % 10) % 10 === +s[12];
const ean8ok = (s) => /^\d{8}$/.test(s) && (10 - [...s.slice(0, 7)].reduce((a, d, i) => a + d * (i % 2 ? 1 : 3), 0) % 10) % 10 === +s[7];
export function Barcode({ value }) {
  const ref = useRef();
  useEffect(() => {
    if (!window.JsBarcode || !ref.current) return;
    const format = ean13ok(value) ? 'EAN13' : ean8ok(value) ? 'EAN8' : 'CODE128';
    try { window.JsBarcode(ref.current, value, { format, displayValue: true, fontSize: 18, height: 110, width: format === 'CODE128' ? 2 : 2.6, margin: 6, background: '#ffffff' }); } catch { }
  }, [value]);
  return html`<div class="barcode"><svg ref=${ref} /></div>`;
}

export function useWakeLock() {
  useEffect(() => {
    let lock; const get = async () => { try { lock = await navigator.wakeLock?.request('screen'); } catch { } };
    get(); const v = () => document.visibilityState === 'visible' && get();
    document.addEventListener('visibilitychange', v);
    return () => { document.removeEventListener('visibilitychange', v); lock?.release?.(); };
  }, []);
}

export function KartaPage({ args }) {
  const c = get('cards', args[0]); const [edit, setEdit] = useState(false);
  useWakeLock();
  if (!c) return html`<${Page} title="Karta" back="#/zakupy/karty"><${Empty}>Nie ma takiej karty.</${Empty}></${Page}>`;
  return html`<${Page} title=${c.store} back="#/zakupy/karty" action=${html`<button class="btn sm" onClick=${() => setEdit(true)}>Edytuj</button>`}>
    <div class="card" style="background:${c.color};border:none;padding:18px"><${Barcode} value=${c.number} /></div>
    <p class="muted" style="text-align:center">Ekran nie zgaśnie, dopóki karta jest otwarta. Jeśli kasa nie czyta kodu, podgłośnij jasność.</p>
    ${edit && html`<${CardForm} c=${c} onClose=${() => setEdit(false)} />`}</${Page}>`;
}
