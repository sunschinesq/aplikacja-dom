import { useState } from '../vendor/hooks.module.js';
import { html, Icon, Sheet, Seg, Field, Dot, Empty, Page } from '../ui.js';
import { list, put, remove, getMe, person, personF } from '../store.js';
import { zl, zl0, num, today, shortDate, longDate, diffDays, sum, groupBy, time } from '../util.js';

// ---------- Skarbonka: wspólne cele oszczędnościowe ----------
export function Skarbonka() {
  const [edit, setEdit] = useState(null), [dep, setDep] = useState(null);
  const goals = list('goals').sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || (a.ts - b.ts));
  const deps = list('goaldeps');
  return html`<${Page} title="Skarbonka" back="#/wiecej" action=${html`<button class="btn sm" onClick=${() => setEdit({})}>+ Cel</button>`}>
    ${!goals.length && html`<div class="card"><p class="empty">Załóżcie wspólny cel, np. wakacje albo nową kanapę, i wrzucajcie do niego pieniądze. Pokażę, ile już macie i ile odkładać miesięcznie.</p>
      <button class="btn primary" onClick=${() => setEdit({})}><${Icon} n="plus" s=${18} /> Nowy cel</button></div>`}
    <div class="grid2">${goals.map((g) => { const ds = deps.filter((d) => d.goalId === g.id), have = sum(ds, (d) => d.amount), pct = g.target ? Math.min(100, have / g.target * 100) : 0;
      const by = groupBy(ds, (d) => d.who), left = Math.max(0, (g.target || 0) - have);
      const months = g.deadline ? Math.max(1, Math.ceil(diffDays(today(), g.deadline) / 30.4)) : 0;
      return html`<div class="card">
        <div class="ct"><h2 class="click" onClick=${() => setEdit(g)}>${g.name}</h2><span class="muted small">${g.deadline ? 'do ' + shortDate(g.deadline, true) : ''}</span></div>
        <div style="font-size:28px;font-weight:700;font-variant-numeric:tabular-nums">${zl0(have)} <span class="muted" style="font-size:16px;font-weight:500">z ${zl0(g.target)}</span></div>
        <div class="bar" style="background:var(--s2);margin:10px 0 6px"><i style=${`width:${pct}%`} /></div>
        <div class="kv small"><span class="muted">${pct >= 100 ? 'Cel osiągnięty!' : `Brakuje ${zl0(left)}`}</span>
          ${months > 0 && left > 0 && html`<span>odkładać ~<b>${zl0(left / months)}</b>/mies.</span>`}</div>
        <div class="row-wrap small" style="margin:4px 0 8px">${['julia', 'franek'].map((p) => html`<span class="who" style="font-weight:500"><${Dot} p=${p} />${person(p)} ${zl0(sum(by[p] || [], (d) => d.amount))}</span>`)}</div>
        <div class="row-wrap"><button class="btn primary sm" onClick=${() => setDep({ g, sign: 1 })}><${Icon} n="plus" s=${16} /> Wrzuć</button>
          <button class="btn sm ghost" onClick=${() => setDep({ g, sign: -1 })}>Wyjmij</button></div>
        ${ds.length > 0 && html`<details style="margin-top:8px"><summary class="small muted">Historia wpłat (${ds.length})</summary>
          ${[...ds].sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts).map((d) => html`<div class="row small"><${Dot} p=${d.who} /><span class="grow">${shortDate(d.date)}${d.note ? ' · ' + d.note : ''}</span>
            <span class="amt" style=${d.amount < 0 ? 'color:var(--bad)' : ''}>${d.amount > 0 ? '+' : ''}${zl(d.amount)}</span>
            <button class="icon-btn sm" aria-label="Usuń" onClick=${() => remove('goaldeps', d.id)}><${Icon} n="x" s=${14} /></button></div>`)}</details>`}
      </div>`; })}</div>
    ${edit && html`<${GoalForm} g=${edit} onClose=${() => setEdit(null)} />`}
    ${dep && html`<${DepForm} g=${dep.g} sign=${dep.sign} onClose=${() => setDep(null)} />`}
  </${Page}>`;
}

function GoalForm({ g, onClose }) {
  const [f, setF] = useState({ name: g.name || '', target: g.target ? String(g.target) : '', deadline: g.deadline || '' });
  return html`<${Sheet} title=${g.id ? g.name : 'Nowy cel'} onClose=${onClose}><div class="form">
    <${Field} label="Na co odkładamy"><input value=${f.name} onInput=${(e) => setF({ ...f, name: e.target.value })} placeholder="np. Wakacje w Grecji" autofocus=${!g.id} /></${Field}>
    <div class="inline"><${Field} label="Kwota celu (zł)"><input inputmode="decimal" value=${f.target} onInput=${(e) => setF({ ...f, target: e.target.value })} /></${Field}>
      <${Field} label="Do kiedy (opcjonalnie)"><input type="date" value=${f.deadline} onInput=${(e) => setF({ ...f, deadline: e.target.value })} /></${Field}></div>
    <button class="btn primary block" disabled=${!f.name.trim() || !num(f.target)} onClick=${() => { put('goals', { ...g, name: f.name.trim(), target: num(f.target), deadline: f.deadline }); onClose(); }}>Zapisz</button>
    ${g.id && html`<button class="btn ghost block" onClick=${() => { if (confirm('Usunąć ten cel razem z historią wpłat?')) { list('goaldeps').filter((d) => d.goalId === g.id).forEach((d) => remove('goaldeps', d.id, { silent: true })); remove('goals', g.id); onClose(); } }}>Usuń cel</button>`}
  </div></${Sheet}>`;
}

function DepForm({ g, sign, onClose }) {
  const [a, setA] = useState(''), [note, setNote] = useState(''), [who, setWho] = useState(getMe());
  return html`<${Sheet} title=${(sign > 0 ? 'Wrzuć do: ' : 'Wyjmij z: ') + g.name} onClose=${onClose}><div class="form">
    <input class="amount-input" inputmode="decimal" placeholder="0,00 zł" value=${a} onInput=${(e) => setA(e.target.value)} autofocus />
    <${Seg} value=${who} onChange=${setWho} options=${[['julia', person('julia')], ['franek', person('franek')]]} />
    <input value=${note} onInput=${(e) => setNote(e.target.value)} placeholder="Notatka (opcjonalnie)" />
    <button class="btn primary block" disabled=${!num(a)} onClick=${() => { put('goaldeps', { goalId: g.id, amount: sign * Math.abs(num(a)), who, note: note.trim(), date: today() }); onClose(); }}>Zapisz</button>
  </div></${Sheet}>`;
}

// ---------- Historia zmian ----------
const KIND = [['all', 'Wszystko'], ['wydatki', 'Wydatki'], ['zakupy', 'Zakupy'], ['kuchnia', 'Kuchnia'], ['dom', 'Dom']];
export function Historia() {
  const [k, setK] = useState('all'), [who, setWho] = useState('all');
  const logs = list('log').filter((l) => (k === 'all' || l.kind === k) && (who === 'all' || l.who === who)).sort((a, b) => b.at - a.at).slice(0, 300);
  return html`<${Page} title="Historia" back="#/wiecej">
    <div class="scroll-x"><div class="chips">${KIND.map(([v, l]) => html`<button class=${'chip' + (v === k ? ' on' : '')} onClick=${() => setK(v)}>${l}</button>`)}</div></div>
    <${Seg} small value=${who} onChange=${setWho} options=${[['all', 'Oboje'], ['julia', person('julia')], ['franek', person('franek')]]} />
    ${Object.entries(groupBy(logs, (l) => l.day)).map(([day, ls]) => html`<div><h3>${day === today() ? 'Dziś' : longDate(day)}</h3>
      <div class="card" style="padding-top:2px;padding-bottom:2px">${ls.map((l) => html`<div class="row"><${Dot} p=${l.who} />
        <span class="grow"><b style="font-weight:600">${person(l.who)}</b> ${l.text}</span><span class="small muted">${time(l.at)}</span></div>`)}</div></div>`)}
    ${!logs.length && html`<${Empty}>Na razie pusto. Tu pojawi się wszystko, co zmieniacie w aplikacji (bez prywatnych wydatków).</${Empty}>`}
    <p class="small muted">Historia obejmuje ostatnie 60 dni.</p>
  </${Page}>`;
}

// Krótko na Start: ostatnie zmiany drugiej osoby
export function RecentByOther({ other }) {
  const ls = list('log').filter((l) => l.who === other && Date.now() - l.at < 2 * 864e5).sort((a, b) => b.at - a.at).slice(0, 3);
  if (!ls.length) return null;
  return html`<div class="card"><div class="ct"><h2>Co nowego u ${personF(other, 'gen')}</h2><a class="muted" href="#/historia">wszystko →</a></div>
    ${ls.map((l) => html`<div class="row small"><span class="grow">${l.text}</span><span class="muted">${l.day === today() ? time(l.at) : 'wczoraj'}</span></div>`)}</div>`;
}
