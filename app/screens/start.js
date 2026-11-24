import { useState } from '../vendor/hooks.module.js';
import { html, Icon, Dot, Sheet } from '../ui.js';
import { getMe, person, personF, patch, put, cfg, list, other } from '../store.js';
import { today, addDays, longDate, zl, zl0, hm, relDays, time, shortDate, monthOf, monthLabel } from '../util.js';
import { CODES } from '../seed.js';
import { sharedSpent, forecast, upcomingBills, choresToday, doneToday, catLog, shiftOf, classesOf, alerts, unreadNotes, debt } from '../logic.js';
import { markChore, feedCat, CatEntrySheet } from './codzienne.js';
import { payRecurring } from './wydatki.js';
import { RecentByOther } from './skarbonka.js';

const shiftTxt = (s) => (!s ? 'wolne' : s.start ? `${s.place ? s.place + ' ' : ''}${hm(s.start)}–${hm(s.end)}` : (CODES[s.code] || s.code).replace(/ \(.*\)/, ''));

export function Start() {
  const me = getMe(), t = today(), m = monthOf(t);
  const [note, setNote] = useState(false), [catEd, setCatEd] = useState(null);
  const notes = unreadNotes();
  const spent = sharedSpent(m), limit = cfg('budget', {}).limit || 0, fc = forecast(m, spent);
  const bills = upcomingBills(7), al = alerts(), chores = choresToday(), log = catLog(t);
  const meals = log.filter((x) => x.type === 'jedzenie'), plays = log.filter((x) => x.type === 'zabawa');
  const goal = cfg('catGoal', 3), d = debt();

  const left = html`<div class="stack">
    ${notes.map((n) => html`<div class=${'note from-' + n.from}>
      <span class="lbl">Liścik od ${personF(n.from, 'gen')} · ${relDays(n.day || t)}</span><p>${n.text}</p>
      <button class="btn sm" onClick=${() => patch('notes', n.id, { read: Date.now() })}><${Icon} n="heart" s=${16} /> Dziękuję</button></div>`)}

    <div class="card"><div class="ct"><h2>Zmiany</h2><a class="muted" href="#/grafik">grafik →</a></div>
      ${['julia', 'franek'].map((p) => html`<div class="row"><span class="grow"><span class="who"><${Dot} p=${p} />${person(p)}</span></span>
        <span class="small" style="text-align:right"><b>${shiftTxt(shiftOf(p, t))}</b>
          ${classesOf(p, t).length > 0 && html`<br/><span>zajęcia ${classesOf(p, t).map((c) => `${hm(c.start)}–${hm(c.end)}`).join(', ')}</span>`}
          <br/><span class="muted">jutro ${shiftTxt(shiftOf(p, addDays(t, 1)))}${classesOf(p, addDays(t, 1)).length ? ' · zajęcia' : ''}</span></span></div>`)}
    </div>

    <div class="card"><div class="ct"><h2>Kita</h2><span class="muted">${meals.length} z ${goal} posiłków${plays.length ? ` · zabawa ×${plays.length}` : ''}</span></div>
      ${log.length === 0 && html`<p class="empty">Dziś jeszcze nikt jej nie karmił.</p>`}
      ${log.map((x) => html`<div class="row click" onClick=${() => setCatEd(x)}><span class="grow">${x.type === 'jedzenie' ? 'Posiłek' : 'Zabawa'} · ${time(x.at)}</span><span class="who small"><${Dot} p=${x.by} />${person(x.by)}</span><span class="muted"><${Icon} n="edit" s=${16} /></span></div>`)}
      ${log.length > 0 && html`<p class="small muted">Inna godzina? Stuknij wpis.</p>`}
      <div class="row-wrap" style="margin-top:8px">
        <button class="btn ${meals.length < goal ? 'primary' : ''}" onClick=${() => feedCat('jedzenie')}><${Icon} n="bowl" s=${18} /> Nakarmiona</button>
        <button class="btn" onClick=${() => feedCat('zabawa')}><${Icon} n="play" s=${18} /> Zabawa</button>
      </div>
    </div>

    <div class="card"><div class="ct"><h2>Obowiązki na dziś</h2><a class="muted" href="#/obowiazki">${chores.filter(doneToday).length} / ${chores.length} →</a></div>
      ${chores.length === 0 && html`<p class="empty">Na dziś nic. Odpoczywajcie.</p>`}
      ${chores.map((c) => { const done = doneToday(c); const who = done ? c.lastBy : c.next;
        return html`<div class="row click" onClick=${() => markChore(c)}>
          <span class=${'check ' + (done ? 'on ' + who : '')}>${done && html`<${Icon} n="check" s=${16} />`}</span>
          <span class=${'grow ' + (done ? 'done-txt' : '')}>${c.name}</span><${Dot} p=${who} /></div>`; })}
    </div>
  </div>`;

  const right = html`<div class="stack">
    <a class="hero" href="#/wydatki" style="display:block">
      <span class="lbl">Konto wspólne · ${monthLabel(m)}</span>
      <div class="big">${zl(spent)}</div>
      <div class=${'bar' + (limit && spent > limit ? ' over' : '')}><i style=${`width:${limit ? Math.min(100, spent / limit * 100) : 0}%`} /></div>
      <div class="mrow"><span>z ${zl0(limit)} limitu</span><span>prognoza <b>${zl0(fc)}</b></span></div>
    </a>
    ${d && html`<div class="card"><div class="row"><span class="grow">Saldo między wami<span class="s">${person(d.from)} → ${person(d.to)}</span></span><span class="amt">${zl(d.amount)}</span></div></div>`}
    ${bills.length > 0 && html`<div class="card"><div class="ct"><h2>Do zapłacenia</h2></div>
      ${bills.map(({ r, m: mm, date }) => html`<div class="row"><span class="grow"><span class="t">${r.name}</span><span class="s">${shortDate(date)} · ${relDays(date)}</span></span>
        <span class="amt">${zl(r.amount)}</span><button class="btn sm" onClick=${() => payRecurring(r, mm)}>Zapłacone</button></div>`)}</div>`}
    ${al.length > 0 && html`<div class="card"><div class="ct"><h2>Uwaga</h2></div>
      ${al.map((a) => html`<a class="row" href=${a.kind === 'pantry' ? '#/zakupy/spizarnia' : '#/gwarancje'}><${Icon} n=${a.kind === 'pantry' ? 'box' : 'shield'} s=${20} />
        <span class="grow">${a.name}</span><span class="pill warn">${a.kind === 'warranty' ? (a.days < 0 ? 'skończyła się' : `gwarancja ${relDays(a.date)}`) : relDays(a.date)}</span></a>`)}</div>`}
    <${RecentByOther} other=${other(me)} />
    <button class="card row" style="text-align:left;cursor:pointer" onClick=${() => setNote(true)}><${Icon} n="mail" /><span class="grow">Zostaw liścik dla ${personF(other(me), 'gen')}</span><${Icon} n="right" s=${18} /></button>
  </div>`;

  return html`<div class="page">
    <div style="margin-bottom:6px"><div class="date">${longDate(t)}</div><h1>${greet()}, <span class="me-name">${person(me)}</span></h1></div>
    <div class="grid2">${left}${right}</div>
    ${note && html`<${NoteSheet} onClose=${() => setNote(false)} />`}
    ${catEd && html`<${CatEntrySheet} x=${catEd} onClose=${() => setCatEd(null)} />`}
  </div>`;
}

const greet = () => { const h = new Date().getHours(); return h < 5 ? 'Dobranoc' : h < 18 ? 'Dzień dobry' : 'Dobry wieczór'; };

export function NoteSheet({ onClose }) {
  const me = getMe(); const [txt, setTxt] = useState('');
  const send = () => { if (!txt.trim()) return; put('notes', { from: me, to: other(me), text: txt.trim(), day: today() }); onClose(); };
  return html`<${Sheet} title=${'Liścik dla ' + personF(other(me), 'gen')} onClose=${onClose}>
    <div class="form"><textarea autofocus placeholder="Np. Mandarynki są w lodówce. Miłego dnia!" value=${txt} onInput=${(e) => setTxt(e.target.value)} />
    <button class="btn primary block" onClick=${send} disabled=${!txt.trim()}>Wyślij</button>
    <p class="small muted">Pojawi się na ekranie Start, dopóki ${person(other(me))} nie kliknie „Dziękuję”.</p></div></${Sheet}>`;
}
