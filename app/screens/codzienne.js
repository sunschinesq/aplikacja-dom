import { useState } from '../vendor/hooks.module.js';
import { html, Icon, Sheet, Seg, Field, Dot, Empty, Page } from '../ui.js';
import { list, put, patch, remove, getMe, person, personF, cfg, setCfg, other } from '../store.js';
import { today, addDays, time, shortDate, longDate, relDays, monthOf, groupBy, diffDays } from '../util.js';
import { catLog, choreDue, choreFreq, doneToday } from '../logic.js';
import { NoteSheet } from './start.js';

export const feedCat = (type) => put('catlog', { type, day: today(), at: Date.now(), by: getMe() });

export function markChore(c) {
  if (doneToday(c)) { // cofnij
    const log = list('chorelog').filter((l) => l.choreId === c.id).sort((a, b) => b.at - a.at);
    if (log[0]) remove('chorelog', log[0].id, { silent: true });
    const prev = log[1];
    patch('chores', c.id, { last: prev ? new Date(prev.at).toISOString() : null, lastBy: prev?.by || null, next: c.who === 'rot' ? c.lastBy || c.next : c.next });
    return;
  }
  const by = getMe();
  put('chorelog', { choreId: c.id, name: c.name, by, at: Date.now(), month: monthOf(today()) });
  patch('chores', c.id, { last: today() + 'T' + new Date().toTimeString().slice(0, 5), lastBy: by, next: c.who === 'rot' ? other(by) : c.who, snooze: null });
}

// Zmiana godziny wpisu (np. kliknięte o 12, a karmienie było o 8)
export function CatEntrySheet({ x, onClose }) {
  const d = new Date(x.at), pad = (n) => String(n).padStart(2, '0');
  const [t, setT] = useState(`${pad(d.getHours())}:${pad(d.getMinutes())}`), [type, setType] = useState(x.type);
  const save = () => { const [h, m] = t.split(':').map(Number); const nd = new Date(x.at); nd.setHours(h, m, 0, 0); patch('catlog', x.id, { at: nd.getTime(), type }); onClose(); };
  return html`<${Sheet} title="Zmień wpis" onClose=${onClose}><div class="form">
    <${Seg} value=${type} onChange=${setType} options=${[['jedzenie', 'Posiłek'], ['zabawa', 'Zabawa']]} />
    <${Field} label="O której godzinie"><input type="time" value=${t} onInput=${(e) => setT(e.target.value)} autofocus /></${Field}>
    <div class="chips">${[-3, -2, -1].map((h) => { const nd = new Date(); nd.setHours(nd.getHours() + h); const v = `${pad(nd.getHours())}:${pad(nd.getMinutes())}`;
      return html`<button class="chip" onClick=${() => setT(v)}>${-h} h temu</button>`; })}</div>
    <button class="btn primary block" disabled=${!t} onClick=${save}>Zapisz</button>
    <button class="btn ghost block" onClick=${() => { remove('catlog', x.id); onClose(); }}><${Icon} n="trash" s=${18} /> Usuń wpis</button>
  </div></${Sheet}>`;
}

export function Kita() {
  const [day, setDay] = useState(today());
  const [ed, setEd] = useState(null);
  const log = catLog(day), goal = cfg('catGoal', 3);
  const meals = log.filter((x) => x.type === 'jedzenie');
  const week = [...Array(7)].map((_, i) => addDays(today(), i - 6));
  return html`<${Page} title="Kita" back="#/wiecej">
    <div class="grid2"><div class="stack">
      <div class="hero"><span class="lbl">${day === today() ? 'Dziś' : longDate(day)}</span>
        <div class="big">${meals.length} / ${goal} <span style="font-size:20px;font-weight:600">posiłków</span></div>
        <div class="bar"><i style=${`width:${Math.min(100, meals.length / goal * 100)}%`} /></div></div>
      ${day === today() && html`<div class="row-wrap"><button class="btn primary" style="flex:1" onClick=${() => feedCat('jedzenie')}><${Icon} n="bowl" s=${20} /> Nakarmiona</button>
        <button class="btn" style="flex:1" onClick=${() => feedCat('zabawa')}><${Icon} n="play" s=${20} /> Zabawa</button></div>`}
      <div class="card"><div class="ct"><h2>Dziennik</h2>
        <span class="row-wrap"><button class="icon-btn sm soft" onClick=${() => setDay(addDays(day, -1))} aria-label="Dzień wcześniej"><${Icon} n="left" s=${18} /></button>
          <button class="icon-btn sm soft" disabled=${day >= today()} onClick=${() => setDay(addDays(day, 1))} aria-label="Dzień później"><${Icon} n="right" s=${18} /></button></span></div>
        ${log.map((x) => html`<div class="row click" onClick=${() => setEd(x)}><span class="grow">${x.type === 'jedzenie' ? 'Posiłek' : 'Zabawa'} · ${time(x.at)}</span><span class="who small"><${Dot} p=${x.by} />${person(x.by)}</span>
          <${Icon} n="edit" s=${18} /></div>`)}
        ${!log.length && html`<${Empty}>Brak wpisów.</${Empty}>`}
        ${log.length > 0 && html`<p class="small muted">Stuknij wpis, żeby zmienić godzinę.</p>`}</div></div>
    <div class="stack"><div class="card"><div class="ct"><h2>Ostatnie 7 dni</h2></div>
      <div class="minibars">${week.map((d) => { const n = catLog(d).filter((x) => x.type === 'jedzenie').length;
        return html`<div><span>${n}</span><i style=${`height:${Math.min(100, n / Math.max(goal, 1) * 80)}%;${n < goal ? 'opacity:.4' : ''}`} />${shortDate(d).split(' ')[0]}</div>`; })}</div></div>
      <div class="card"><div class="inline" style="align-items:center"><span style="flex:1">Ile posiłków dziennie</span>
        <input type="number" min="1" max="8" style="width:80px" value=${goal} onChange=${(e) => setCfg('catGoal', +e.target.value || 3)} /></div></div></div></div>
    ${ed && html`<${CatEntrySheet} x=${ed} onClose=${() => setEd(null)} />`}
  </${Page}>`;
}

export function Obowiazki() {
  const [edit, setEdit] = useState(null);
  const cs = list('chores').sort((a, b) => choreDue(a).localeCompare(choreDue(b)));
  const m = monthOf(today());
  const log = list('chorelog').filter((l) => l.month === m);
  const cnt = groupBy(log, (l) => l.by);
  const t = today();
  return html`<${Page} title="Obowiązki" back="#/wiecej" action=${html`<button class="btn sm" onClick=${() => setEdit({})}>+ Dodaj</button>`}>
    <div class="stat">${['julia', 'franek'].map((p) => html`<div class="card"><span class="who small"><${Dot} p=${p} />${person(p)}</span><b>${(cnt[p] || []).length}</b><span class="small muted">zrobionych w tym miesiącu</span></div>`)}</div>
    <div class="card">${cs.map((c) => { const due = choreDue(c), done = doneToday(c), late = !done && due < t;
      return html`<div class="row">
        <button class=${'check ' + (done ? 'on ' + c.lastBy : '')} onClick=${() => markChore(c)} aria-label="Zrobione">${done && html`<${Icon} n="check" s=${16} />`}</button>
        <span class="grow click" onClick=${() => setEdit(c)}><span class=${'t ' + (done ? 'done-txt' : '')}>${c.name}</span>
          <span class="s">${choreFreq(c)} · ${c.who === 'rot' ? 'na zmianę, teraz ' + person(c.next) : person(c.who)}${c.last ? ' · ostatnio ' + (c.last.slice(0, 10) === t ? 'dziś' : shortDate(c.last.slice(0, 10))) : ''}</span></span>
        ${!done && html`<span class=${'pill ' + (late ? 'warn' : due === t ? 'ok' : '')}>${late ? `zaległe ${-diffDays(t, due)} d` : due === t ? 'dziś' : relDays(due)}</span>`}
        <${Dot} p=${done ? c.lastBy : c.next} /></div>`; })}
      ${!cs.length && html`<${Empty}>Dodaj stałe obowiązki domowe.</${Empty}>`}</div>
    <p class="small muted">Stuknij nazwę, żeby zmienić osobę, częstotliwość albo przełożyć zadanie na jutro.</p>
    ${edit && html`<${ChoreForm} c=${edit} onClose=${() => setEdit(null)} />`}
  </${Page}>`;
}

function ChoreForm({ c, onClose }) {
  const [f, setF] = useState({ name: c.name || '', every: c.every || 7, days: c.days || [], mode: c.days?.length ? 'week' : 'every', who: c.who || 'rot', next: c.next || getMe() });
  return html`<${Sheet} title=${c.id ? c.name : 'Nowy obowiązek'} onClose=${onClose}><div class="form">
    <${Field} label="Nazwa"><input value=${f.name} onInput=${(e) => setF({ ...f, name: e.target.value })} autofocus=${!c.id} /></${Field}>
    <${Field} label="Kiedy"><${Seg} small value=${f.mode} onChange=${(v) => setF({ ...f, mode: v })} options=${[['every', 'Co kilka dni'], ['week', 'W wybrane dni']]} /></${Field}>
    ${f.mode === 'every' ? html`<${Field} label="Co ile dni"><input type="number" min="1" value=${f.every} onInput=${(e) => setF({ ...f, every: +e.target.value || 1 })} /></${Field}>`
      : html`<${Field} label="Dni tygodnia" hint="Np. odkurzanie w poniedziałki i czwartki."><div class="chips">${[[1, 'Pn'], [2, 'Wt'], [3, 'Śr'], [4, 'Cz'], [5, 'Pt'], [6, 'Sb'], [0, 'Nd']].map(([d, l]) =>
          html`<button type="button" class=${'chip' + (f.days.includes(d) ? ' on' : '')} style="min-width:46px;justify-content:center" onClick=${() => setF({ ...f, days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d] })}>${l}</button>`)}</div></${Field}>`}
    <${Field} label="Kto"><${Seg} value=${f.who} onChange=${(v) => setF({ ...f, who: v, next: v === 'rot' ? f.next : v })} options=${[['rot', 'Na zmianę'], ['julia', person('julia')], ['franek', person('franek')]]} /></${Field}>
    ${f.who === 'rot' && html`<${Field} label="Teraz kolej"><${Seg} small value=${f.next} onChange=${(v) => setF({ ...f, next: v })} options=${[['julia', person('julia')], ['franek', person('franek')]]} /></${Field}>`}
    <button class="btn primary block" disabled=${!f.name.trim() || (f.mode === 'week' && !f.days.length)} onClick=${() => {
      const { mode, ...rest } = f;
      put('chores', { ...c, ...rest, name: f.name.trim(), days: mode === 'week' ? f.days : [], every: mode === 'week' ? 7 : f.every, snooze: null }); onClose(); }}>Zapisz</button>
    ${c.id && html`<div class="row-wrap">
      <button class="btn ghost" style="flex:1" onClick=${() => { patch('chores', c.id, { next: other(c.next), who: c.who === 'rot' ? 'rot' : other(c.who) }); onClose(); }}><${Icon} n="swap" s=${18} /> Przekaż</button>
      <button class="btn ghost" style="flex:1" onClick=${() => { patch('chores', c.id, { snooze: addDays(today(), 1) }); onClose(); }}>Na jutro</button></div>
      <button class="btn ghost block" onClick=${() => { if (confirm('Usunąć obowiązek?')) { remove('chores', c.id); onClose(); } }}><${Icon} n="trash" s=${18} /> Usuń</button>`}
  </div></${Sheet}>`;
}

export function Liscik() {
  const [w, setW] = useState(false);
  const me = getMe();
  const ns = list('notes').sort((a, b) => b.ts - a.ts);
  return html`<${Page} title="Liściki" back="#/wiecej">
    <button class="btn primary block" onClick=${() => setW(true)}><${Icon} n="mail" s=${20} /> Napisz do ${personF(other(me), 'gen')}</button>
    ${ns.map((n) => html`<div class=${'note from-' + n.from}><span class="lbl">${n.from === me ? 'Ty → ' + person(n.to) : 'Od ' + personF(n.from, 'gen')} · ${shortDate(n.day || today())}${n.read ? ' · przeczytany ♡' : ''}</span><p>${n.text}</p>
      ${n.from === me && html`<button class="btn sm ghost" onClick=${() => confirm('Usunąć liścik?') && remove('notes', n.id)}>Usuń</button>`}
      ${n.to === me && !n.read && html`<button class="btn sm" onClick=${() => patch('notes', n.id, { read: Date.now() })}>Dziękuję</button>`}</div>`)}
    ${!ns.length && html`<${Empty}>Jeszcze żadnych liścików.</${Empty}>`}
    ${w && html`<${NoteSheet} onClose=${() => setW(false)} />`}
  </${Page}>`;
}
