import { useState } from '../vendor/hooks.module.js';
import { html, Icon, Sheet, Field, Empty, Page } from '../ui.js';
import { list, put, remove, getMe } from '../store.js';
import { zl, num, today, shortDate, diffDays, relDays, parse, iso, norm } from '../util.js';

export function Prad() {
  const [edit, setEdit] = useState(null);
  const bills = list('power').sort((a, b) => b.to.localeCompare(a.to));
  const last = bills[0], prev = bills[1];
  const perMonth = (b) => b.amount / Math.max(1, diffDays(b.from, b.to) / 30.4);
  const maxK = Math.max(1, ...bills.map((b) => b.kwh));
  return html`<${Page} title="Prąd" back="#/wiecej" action=${html`<button class="btn sm" onClick=${() => setEdit({})}>+ Rachunek</button>`}>
    ${last ? html`<div class="grid2"><div class="hero"><span class="lbl">Ostatni rachunek · ${shortDate(last.from)} – ${shortDate(last.to)}</span>
        <div class="big">${zl(last.amount)}</div>
        <span class="lbl">${last.kwh} kWh · ${zl(last.amount / Math.max(1, last.kwh))}/kWh · ~${zl(perMonth(last))} miesięcznie</span></div>
      <div class="card">${prev ? html`<div class="kv"><span>Zmiana kWh vs poprzedni</span><b>${last.kwh - prev.kwh > 0 ? '+' : ''}${last.kwh - prev.kwh} kWh</b></div>
        <div class="kv"><span>Zmiana kwoty</span><b style=${last.amount > prev.amount ? 'color:var(--bad)' : 'color:var(--ok)'}>${last.amount > prev.amount ? '+' : ''}${zl(last.amount - prev.amount)}</b></div>` : html`<p class="empty">Po drugim rachunku pokażę porównanie.</p>`}
        <div class="kv"><span>Średnio za rachunek</span><b>${zl(bills.reduce((s, b) => s + b.amount, 0) / bills.length)}</b></div></div></div>
      <div class="card"><div class="ct"><h2>Zużycie (kWh)</h2></div><div class="minibars">${[...bills].reverse().slice(-8).map((b) => html`<div><span>${b.kwh}</span><i style=${`height:${b.kwh / maxK * 80}%`} />${shortDate(b.to).replace(/ \d{4}$/, '')}</div>`)}</div></div>`
    : html`<div class="card"><p class="empty">Co dwa miesiące dostajesz maila z kwotą i zużyciem w kWh. Wpisz je tutaj, a pokażę historię i cenę za kWh.</p></div>`}
    <div class="card">${bills.map((b) => html`<div class="row click" onClick=${() => setEdit(b)}><span class="grow"><span class="t">${shortDate(b.from)} – ${shortDate(b.to)}</span><span class="s">${b.kwh} kWh</span></span><span class="amt">${zl(b.amount)}</span></div>`)}</div>
    ${edit && html`<${PowerForm} b=${edit} last=${last} onClose=${() => setEdit(null)} />`}
  </${Page}>`;
}

function PowerForm({ b, last, onClose }) {
  const t = today();
  const [f, setF] = useState({ from: b.from || (last ? last.to : iso(new Date(parse(t).setMonth(parse(t).getMonth() - 2)))), to: b.to || t, kwh: b.kwh || '', amount: b.amount ? String(b.amount).replace('.', ',') : '', asExpense: !b.id });
  const s = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = () => {
    const o = put('power', { ...b, from: f.from, to: f.to, kwh: num(f.kwh), amount: num(f.amount) });
    if (f.asExpense) put('expenses', { amount: o.amount, desc: 'Prąd', date: t, cat: 'prad', account: 'wspolne', by: getMe() });
    onClose();
  };
  return html`<${Sheet} title=${b.id ? 'Rachunek za prąd' : 'Nowy rachunek za prąd'} onClose=${onClose}><div class="form">
    <div class="inline"><${Field} label="Okres od"><input type="date" value=${f.from} onInput=${s('from')} /></${Field}><${Field} label="do"><input type="date" value=${f.to} onInput=${s('to')} /></${Field}></div>
    <div class="inline"><${Field} label="Zużycie (kWh)"><input inputmode="decimal" value=${f.kwh} onInput=${s('kwh')} /></${Field}><${Field} label="Kwota (zł)"><input inputmode="decimal" value=${f.amount} onInput=${s('amount')} /></${Field}></div>
    ${!b.id && html`<label class="toggle"><input type="checkbox" checked=${f.asExpense} onChange=${(e) => setF({ ...f, asExpense: e.target.checked })} /> Dodaj też jako wydatek z konta wspólnego</label>`}
    <button class="btn primary block" disabled=${!num(f.amount)} onClick=${save}>Zapisz</button>
    ${b.id && html`<button class="btn ghost block" onClick=${() => { if (confirm('Usunąć?')) { remove('power', b.id); onClose(); } }}>Usuń</button>`}</div></${Sheet}>`;
}

const addMonthsDate = (d, n) => { const x = parse(d); x.setMonth(x.getMonth() + n); return iso(x); };

export function Gwarancje() {
  const [edit, setEdit] = useState(null), [q, setQ] = useState('');
  const ws = list('warranties').filter((w) => !q || norm(w.name + ' ' + w.shop).includes(norm(q))).sort((a, b) => a.until.localeCompare(b.until));
  const pill = (w) => { const n = diffDays(today(), w.until);
    return html`<span class=${'pill ' + (n < 0 ? '' : n <= 7 ? 'warn' : n <= 60 ? '' : 'ok')}>${n < 0 ? 'skończona' : n <= 60 ? `kończy się ${relDays(w.until).replace('do ', '')}` : 'do ' + shortDate(w.until, true)}</span>`; };
  return html`<${Page} title="Gwarancje" back="#/wiecej">
    <button class="btn primary block" onClick=${() => setEdit({})}><${Icon} n="plus" s=${20} /> Dodaj gwarancję</button>
    <input placeholder="Szukaj: pralka, telefon, sklep…" value=${q} onInput=${(e) => setQ(e.target.value)} />
    <div class="card">${ws.map((w) => html`<div class="row click" onClick=${() => setEdit(w)}><span class="icon-btn soft"><${Icon} n="shield" s=${20} /></span>
      <span class="grow"><span class="t">${w.name}</span><span class="s">${[w.shop, 'kupione ' + shortDate(w.bought, true)].filter(Boolean).join(' · ')}${w.photo ? ' · paragon' : ''}</span></span>${pill(w)}</div>`)}
      ${!ws.length && html`<${Empty}>${q ? 'Nic nie znaleziono.' : 'Brak gwarancji. Ostrzegę na ekranie Start tydzień przed końcem.'}</${Empty}>`}</div>
    ${edit && html`<${WarrantyForm} w=${edit} onClose=${() => setEdit(null)} />`}
  </${Page}>`;
}

async function shrink(file) {
  const img = await createImageBitmap(file);
  const k = Math.min(1, 1100 / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = img.width * k; c.height = img.height * k;
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.72);
}

function WarrantyForm({ w, onClose }) {
  const [f, setF] = useState({ name: w.name || '', shop: w.shop || '', bought: w.bought || today(), months: w.months || 24, photo: w.photo || '' });
  const s = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const [big, setBig] = useState(false);
  return html`<${Sheet} title=${w.id ? w.name : 'Nowa gwarancja'} onClose=${onClose}><div class="form">
    <${Field} label="Produkt"><input value=${f.name} onInput=${s('name')} placeholder="np. Pralka Bosch" /></${Field}>
    <${Field} label="Sklep"><input value=${f.shop} onInput=${s('shop')} placeholder="np. Media Expert" /></${Field}>
    <div class="inline"><${Field} label="Data zakupu"><input type="date" value=${f.bought} onInput=${s('bought')} /></${Field}>
      <${Field} label="Gwarancja (mies.)"><input type="number" min="1" value=${f.months} onInput=${s('months')} /></${Field}></div>
    <p class="small muted">Ważna do ${shortDate(addMonthsDate(f.bought, +f.months || 24), true)}</p>
    <${Field} label="Zdjęcie paragonu">
      ${f.photo ? html`<img class="photo" src=${f.photo} alt="Paragon" onClick=${() => setBig(true)} />` : ''}
      <label class="btn ghost"><${Icon} n="camera" s=${18} /> ${f.photo ? 'Zmień zdjęcie' : 'Zrób lub wybierz zdjęcie'}
        <input type="file" accept="image/*" style="display:none" onChange=${async (e) => e.target.files[0] && setF({ ...f, photo: await shrink(e.target.files[0]) })} /></label></${Field}>
    <button class="btn primary block" disabled=${!f.name.trim()} onClick=${() => { put('warranties', { ...w, ...f, name: f.name.trim(), months: +f.months || 24, until: addMonthsDate(f.bought, +f.months || 24) }); onClose(); }}>Zapisz</button>
    ${w.id && html`<button class="btn ghost block" onClick=${() => { if (confirm('Usunąć?')) { remove('warranties', w.id); onClose(); } }}>Usuń</button>`}
    ${big && html`<div class="sheet-bg" style="align-items:center;padding:16px" onClick=${() => setBig(false)}><img src=${f.photo} style="max-width:100%;max-height:90dvh;border-radius:12px" /></div>`}
  </div></${Sheet}>`;
}
