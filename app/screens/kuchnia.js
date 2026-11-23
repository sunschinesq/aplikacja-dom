import { useState } from '../vendor/hooks.module.js';
import { html, Icon, Sheet, Seg, Chips, Field, Empty, Page } from '../ui.js';
import { list, put, patch, remove, get, getMe } from '../store.js';
import { today, addDays, parse, iso, longDate, shortDate, norm, num, hm } from '../util.js';
import { CODES } from '../seed.js';
import { parseIng, ingLine, findPantry, toBase, fmtQty, shiftOf } from '../logic.js';
import { addToList, useWakeLock } from './zakupy.js';

const MEALS = ['Śniadanie', 'Obiad', 'Kolacja'];
const TAGS = ['śniadanie', 'obiad', 'kolacja', 'szybkie', 'wege', 'do pudełka', 'na słodko'];
const monday = (d) => { const x = parse(d); const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); return iso(x); };

export function Kuchnia({ args }) {
  const [tab, setTab] = useState(args[0] || 'menu');
  return html`<div class="page"><header class="ph"><h1>Kuchnia</h1></header>
    <${Seg} value=${tab} onChange=${setTab} options=${[['menu', 'Menu'], ['przepisy', 'Przepisy']]} />
    ${tab === 'menu' ? html`<${Menu} />` : html`<${Przepisy} />`}</div>`;
}

const shiftTag = (p, d) => { const s = shiftOf(p, d); if (!s) return null;
  return html`<span class="pill" style=${`background:color-mix(in srgb, var(--${p}) 18%, transparent);color:var(--ink)`}>${p === 'julia' ? 'J' : 'F'}: ${s.start ? `${hm(s.start)}–${hm(s.end)}` : (s.code === 'U' ? 'urlop' : 'wolne')}</span>`; };

function Menu() {
  const [wk, setWk] = useState(monday(today()));
  const [add, setAdd] = useState(null), [shop, setShop] = useState(false);
  const days = [...Array(7)].map((_, i) => addDays(wk, i));
  const menu = list('menu');
  const recipe = (id) => get('recipes', id);
  return html`<div class="stack">
    <div class="monthnav"><button class="icon-btn soft" onClick=${() => setWk(addDays(wk, -7))} aria-label="Poprzedni tydzień"><${Icon} n="left" /></button>
      <b>${shortDate(days[0])} – ${shortDate(days[6])}</b><button class="icon-btn soft" onClick=${() => setWk(addDays(wk, 7))} aria-label="Następny tydzień"><${Icon} n="right" /></button></div>
    <button class="btn block" onClick=${() => setShop(true)}><${Icon} n="cart" s=${20} /> Składniki z tygodnia do listy</button>
    <div class="grid2">${days.map((d) => { const its = menu.filter((m) => m.day === d).sort((a, b) => MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal));
      return html`<div class=${'card' + (d === today() ? ' tint' : '')}>
        <div class="ct"><h2>${longDate(d).replace(/ \d{4}$/, '')}</h2><button class="icon-btn sm soft" onClick=${() => setAdd(d)} aria-label="Dodaj posiłek"><${Icon} n="plus" s=${18} /></button></div>
        <div class="row-wrap">${shiftTag('julia', d)}${shiftTag('franek', d)}</div>
        ${its.map((m) => { const r = m.recipeId && recipe(m.recipeId);
          return html`<div class="row"><span class="muted small" style="width:76px">${m.meal}</span>
            ${r ? html`<a class="grow" href=${'#/przepis/' + r.id} style="color:var(--acc);font-weight:600">${r.name}</a>` : html`<span class="grow">${m.text}</span>`}
            ${m.portions && r ? html`<span class="small muted">${m.portions} porc.</span>` : ''}
            <button class="icon-btn sm" aria-label="Usuń" onClick=${() => remove('menu', m.id)}><${Icon} n="x" s=${16} /></button></div>`; })}
      </div>`; })}</div>
    ${add && html`<${AddMeal} day=${add} onClose=${() => setAdd(null)} />`}
    ${shop && html`<${ToListSheet} title="Składniki z tygodnia" items=${weekIngredients(days, menu)} onClose=${() => setShop(false)} />`}
  </div>`;
}

function weekIngredients(days, menu) {
  const out = [];
  for (const m of menu.filter((x) => days.includes(x.day) && x.recipeId)) {
    const r = get('recipes', m.recipeId); if (!r) continue;
    const f = (m.portions || r.portions || 2) / (r.portions || 2);
    for (const i of r.ingredients || []) {
      const ex = out.find((o) => norm(o.name) === norm(i.name) && toBase(1, o.unit)[1] === toBase(1, i.unit)[1]);
      if (ex) { const [a, u] = toBase(ex.qty, ex.unit), [b] = toBase(i.qty * f, i.unit); ex.qty = a + b; ex.unit = u; }
      else out.push({ ...i, qty: i.qty * f });
    }
  }
  return out;
}

export function AddMeal({ day, recipeId, onClose }) {
  const recs = list('recipes').sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || a.name.localeCompare(b.name));
  const [f, setF] = useState({ day: day || today(), meal: 'Obiad', recipeId: recipeId || '', text: '', portions: get('recipes', recipeId)?.portions || 2 });
  return html`<${Sheet} title="Dodaj do menu" onClose=${onClose}><div class="form">
    <${Field} label="Dzień"><input type="date" value=${f.day} onInput=${(e) => setF({ ...f, day: e.target.value })} /></${Field}>
    <${Seg} value=${f.meal} onChange=${(v) => setF({ ...f, meal: v })} options=${MEALS.map((m) => [m, m])} />
    ${!recipeId && html`<${Field} label="Przepis"><select value=${f.recipeId} onChange=${(e) => setF({ ...f, recipeId: e.target.value })}>
      <option value="">— bez przepisu (wpiszę sam/a) —</option>${recs.map((r) => html`<option value=${r.id}>${r.fav ? '★ ' : ''}${r.name}</option>`)}</select></${Field}>`}
    ${!f.recipeId ? html`<${Field} label="Co jemy?"><input value=${f.text} onInput=${(e) => setF({ ...f, text: e.target.value })} placeholder="np. Pierogi z mrożonki" /></${Field}>`
      : html`<${Field} label="Porcje"><input type="number" min="1" value=${f.portions} onInput=${(e) => setF({ ...f, portions: +e.target.value || 1 })} /></${Field}>`}
    <button class="btn primary block" disabled=${!f.recipeId && !f.text.trim()} onClick=${() => { put('menu', { ...f, text: f.text.trim() }); onClose(); }}>Dodaj</button></div></${Sheet}>`;
}

// Arkusz porównujący składniki ze spiżarnią
export function ToListSheet({ title, items, onClose }) {
  const [rows, setRows] = useState(items.map((i) => {
    const inP = findPantry(i.name);
    const [need, u] = toBase(i.qty, i.unit);
    const have = inP.filter((p) => toBase(1, p.unit)[1] === u).reduce((s, p) => s + toBase(p.qty, p.unit)[0], 0);
    let on = true, note = '';
    if (inP.length) {
      if (need && have >= need) { on = false; note = `W spiżarni: ${inP.map((p) => fmtQty(p.qty, p.unit) || 'jest').join(', ')}. Sprawdź, czy na pewno wystarczy.`; }
      else if (need && have) note = `W spiżarni tylko ${fmtQty(have, u)}, potrzeba ${fmtQty(need, u)}.`;
      else { on = false; note = `W spiżarni: ${inP.map((p) => `${p.name} ${fmtQty(p.qty, p.unit)}`.trim()).join(', ')}. Sprawdź ilość.`; }
    }
    const missing = need && have && have < need ? need - have : need;
    return { i, on, note, qty: missing, unit: need ? u : i.unit };
  }));
  const go = () => { rows.filter((r) => r.on).forEach((r) => { const [q, u] = r.unit === 'g' && r.qty >= 1000 ? [r.qty / 1000, 'kg'] : r.unit === 'ml' && r.qty >= 1000 ? [r.qty / 1000, 'l'] : [r.qty, r.unit]; addToList(r.i.name, Math.round(q * 100) / 100, u || 'szt'); }); onClose(); };
  return html`<${Sheet} title=${title} onClose=${onClose}><div class="form">
    ${!rows.length && html`<${Empty}>Brak składników. Dodaj do menu dania z przepisów.</${Empty}>`}
    ${rows.map((r, k) => html`<div class="card" style="padding:10px 12px">
      <label class="toggle"><input type="checkbox" checked=${r.on} onChange=${(e) => setRows(rows.map((x, j) => (j === k ? { ...x, on: e.target.checked } : x)))} />
        <span>${r.i.name} <span class="muted small">${fmtQty(r.qty, r.unit)}</span></span></label>
      ${r.note && html`<p class="small" style="margin:6px 0 0 32px;color:var(--warn)">${r.note}</p>`}</div>`)}
    ${rows.length > 0 && html`<button class="btn primary block" onClick=${go}>Dodaj zaznaczone do listy Ogólnej</button>`}</div></${Sheet}>`;
}

function Przepisy() {
  const [q, setQ] = useState(''), [tag, setTag] = useState(''), [edit, setEdit] = useState(null);
  const rs = list('recipes').filter((r) => (!q || norm(r.name).includes(norm(q))) && (!tag || (tag === 'ulubione' ? r.fav : r.tags?.includes(tag))))
    .sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || a.name.localeCompare(b.name));
  return html`<div class="stack">
    <button class="btn primary block" onClick=${() => setEdit({})}><${Icon} n="plus" s=${20} /> Nowy przepis</button>
    <input placeholder="Szukaj przepisu" value=${q} onInput=${(e) => setQ(e.target.value)} />
    <div class="scroll-x"><${Chips} value=${tag} onChange=${(v) => setTag(v === tag ? '' : v)} options=${[['ulubione', '★ ulubione'], ...TAGS.map((t) => [t, t])]} /></div>
    <div class="card">${rs.map((r) => html`<a class="row" href=${'#/przepis/' + r.id}>
      <span class="grow"><span class="t">${r.fav ? '★ ' : ''}${r.name}</span><span class="s">${[r.time && r.time + ' min', ...(r.tags || [])].filter(Boolean).join(' · ')}</span></span><${Icon} n="right" s=${18} /></a>`)}
      ${!rs.length && html`<${Empty}>${list('recipes').length ? 'Nic nie pasuje.' : 'Książka jest pusta. Dodaj pierwszy przepis: wpisz go albo wklej link.'}</${Empty}>`}</div>
    ${edit && html`<${RecipeForm} r=${edit} onClose=${() => setEdit(null)} />`}</div>`;
}

function RecipeForm({ r, onClose }) {
  const [f, setF] = useState({ name: r.name || '', link: r.link || '', time: r.time || '', portions: r.portions || 2, tags: r.tags || [],
    ing: (r.ingredients || []).map((i) => ingLine(i)).join('\n'), steps: (r.steps || []).join('\n') });
  const s = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = () => {
    const o = put('recipes', { ...r, name: f.name.trim(), link: f.link.trim(), time: num(f.time) || '', portions: +f.portions || 2, tags: f.tags,
      ingredients: f.ing.split('\n').map((l) => l.trim()).filter(Boolean).map(parseIng), steps: f.steps.split('\n').map((l) => l.replace(/^\d+[.)]\s*/, '').trim()).filter(Boolean) });
    onClose(); location.hash = '#/przepis/' + o.id;
  };
  return html`<${Sheet} title=${r.id ? 'Edytuj przepis' : 'Nowy przepis'} onClose=${onClose} wide><div class="form">
    <${Field} label="Nazwa"><input value=${f.name} onInput=${s('name')} autofocus /></${Field}>
    <${Field} label="Link (opcjonalnie)" hint="Np. z Instagrama, TikToka albo strony z przepisami."><input type="url" value=${f.link} onInput=${s('link')} placeholder="https://" /></${Field}>
    <div class="inline"><${Field} label="Czas (min)"><input inputmode="numeric" value=${f.time} onInput=${s('time')} /></${Field}>
      <${Field} label="Porcje"><input type="number" min="1" value=${f.portions} onInput=${s('portions')} /></${Field}></div>
    <${Field} label="Tagi"><${Chips} multi value=${f.tags} onChange=${(v) => setF({ ...f, tags: v })} options=${TAGS.map((t) => [t, t])} /></${Field}>
    <${Field} label="Składniki" hint="Jeden w linii, np. „200 g jogurtu greckiego”, „2 papryki”, „sól, pieprz”."><textarea rows="7" value=${f.ing} onInput=${s('ing')} /></${Field}>
    <${Field} label="Przygotowanie" hint="Jeden krok w linii."><textarea rows="6" value=${f.steps} onInput=${s('steps')} /></${Field}>
    <button class="btn primary block" disabled=${!f.name.trim()} onClick=${save}>Zapisz</button>
    ${r.id && html`<button class="btn ghost block" onClick=${() => { if (confirm('Usunąć przepis?')) { remove('recipes', r.id); onClose(); location.hash = '#/kuchnia/przepisy'; } }}>Usuń</button>`}</div></${Sheet}>`;
}

export function PrzepisPage({ args }) {
  const r = get('recipes', args[0]);
  const [por, setPor] = useState(r?.portions || 2), [edit, setEdit] = useState(false), [toList, setToList] = useState(false), [menu, setMenu] = useState(false);
  useWakeLock();
  if (!r) return html`<${Page} title="Przepis" back="#/kuchnia/przepisy"><${Empty}>Nie ma takiego przepisu.</${Empty}></${Page}>`;
  const f = por / (r.portions || 2);
  return html`<${Page} title=${r.name} back="#/kuchnia/przepisy" action=${html`<button class=${'icon-btn ' + (r.fav ? 'on' : 'soft')} aria-label="Ulubiony" onClick=${() => patch('recipes', r.id, { fav: !r.fav })}><${Icon} n="star" /></button>`}>
    <p class="muted">${[r.time && r.time + ' min', ...(r.tags || [])].filter(Boolean).join(' · ')}</p>
    ${r.link && html`<a class="btn ghost" href=${r.link} target="_blank" rel="noopener"><${Icon} n="link" s=${18} /> Otwórz oryginał</a>`}
    <div class="grid2"><div class="card"><div class="ct"><h2>Składniki</h2>
      <span class="row-wrap"><button class="icon-btn sm soft" onClick=${() => setPor(Math.max(1, por - 1))} aria-label="Mniej porcji">−</button><b>${por} porc.</b><button class="icon-btn sm soft" onClick=${() => setPor(por + 1)} aria-label="Więcej porcji">+</button></span></div>
      <ul style="padding-left:20px;line-height:1.9">${(r.ingredients || []).map((i) => html`<li>${ingLine(i, f)}</li>`)}</ul>
      <button class="btn" style="margin-top:10px" onClick=${() => setToList(true)}><${Icon} n="cart" s=${18} /> Dodaj składniki do listy</button></div>
    ${r.steps?.length > 0 && html`<div class="card"><div class="ct"><h2>Przygotowanie</h2></div>
      <ol style="padding-left:22px;line-height:1.6">${r.steps.map((s) => html`<li style="margin:6px 0">${s}</li>`)}</ol></div>`}</div>
    <div class="row-wrap" style="justify-content:space-between"><button class="btn ghost" onClick=${() => setEdit(true)}>Edytuj</button>
      <button class="btn primary" onClick=${() => setMenu(true)}><${Icon} n="cal" s=${18} /> Do menu</button></div>
    <p class="small muted" style="text-align:center">Ekran nie zgaśnie, dopóki przepis jest otwarty.</p>
    ${edit && html`<${RecipeForm} r=${r} onClose=${() => setEdit(false)} />`}
    ${toList && html`<${ToListSheet} title="Składniki do listy" items=${(r.ingredients || []).filter((i) => !/sól|pieprz/i.test(i.name) || i.qty).map((i) => ({ ...i, qty: i.qty * f }))} onClose=${() => setToList(false)} />`}
    ${menu && html`<${AddMeal} recipeId=${r.id} onClose=${() => setMenu(false)} />`}
  </${Page}>`;
}
