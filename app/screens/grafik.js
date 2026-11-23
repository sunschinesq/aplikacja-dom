import { useState } from '../vendor/hooks.module.js';
import { html, Icon, Sheet, Seg, Field, MonthNav, Dot, Page } from '../ui.js';
import { list, put, getMe, person, cfg, setCfg } from '../store.js';
import { today, monthOf, daysInMonth, parse, longDate, hours, hm, fmtH, zl, num, DAYS_SHORT } from '../util.js';
import { CODES } from '../seed.js';

const shifts = (p) => list('shifts').find((s) => s.id === p)?.days || {};
// Szybkie godziny: najczęstsze zmiany danej osoby z jej grafiku
const PRESETS = (p) => { const c = {}; Object.values(shifts(p)).forEach((s) => s.start && (c[s.start + '-' + s.end] = (c[s.start + '-' + s.end] || 0) + 1));
  return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => k.split('-')); };

export function Grafik() {
  const [m, setM] = useState(monthOf(today()));
  const [who, setWho] = useState('both');
  const [edit, setEdit] = useState(null);
  const ppl = who === 'both' ? ['julia', 'franek'] : [who];
  const first = (parse(m + '-01').getDay() + 6) % 7, n = daysInMonth(m);
  const days = [...Array(n)].map((_, i) => `${m}-${String(i + 1).padStart(2, '0')}`);
  const people = cfg('people', {});
  const stats = (p) => { const s = shifts(p); const ds = days.filter((d) => s[d]?.start); const h = ds.reduce((a, d) => a + hours(s[d].start, s[d].end), 0); return { n: ds.length, h, pay: h * (people[p]?.rate || 0) }; };
  return html`<${Page} title="Grafik" back="#/wiecej">
    <${Seg} value=${who} onChange=${setWho} options=${[['both', 'Oboje'], ['julia', person('julia')], ['franek', person('franek')]]} />
    <${MonthNav} m=${m} set=${setM} />
    <div class="cal">${['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'].map((d) => html`<div class="hd">${d}</div>`)}
      ${[...Array(first)].map(() => html`<div />`)}
      ${days.map((d) => { const wd = parse(d).getDay();
        return html`<button class=${'d' + (d === today() ? ' today' : '') + (wd === 0 || wd === 6 ? ' weekend' : '')} onClick=${() => setEdit(d)}>
          <span class="n">${+d.slice(8)}</span>
          ${ppl.map((p) => { const s = shifts(p)[d]; if (!s) return null;
            return html`<span class=${'sh ' + (s.start ? p : 'off')}>${s.start ? `${hm(s.start)}–${hm(s.end)}` : s.code === 'U' ? 'urlop' : s.code === 'L4' ? 'L4' : 'wolne'}</span>`; })}</button>`; })}</div>
    <div class="grid2">${['julia', 'franek'].map((p) => { const s = stats(p);
      return html`<div class="card"><div class="ct"><span class="who"><${Dot} p=${p} />${person(p)}</span><span class="muted small">${s.n} dni pracy</span></div>
        <div class="kv"><span>Przepracowane</span><b>${fmtH(s.h)}</b></div>
        <div class="kv" style="align-items:center"><span>Stawka</span><span class="inline" style="align-items:center;width:140px"><input inputmode="decimal" style="padding:6px 8px;text-align:right" value=${people[p]?.rate || ''} placeholder="0"
          onChange=${(e) => setCfg('people', { ...people, [p]: { ...people[p], rate: num(e.target.value) } })} /> <span class="small">zł/h</span></span></div>
        <div class="kv"><span>Wypłata brutto</span><b>${people[p]?.rate ? zl(s.pay) : '—'}</b></div>
        ${p === 'franek' && html`<button class="btn sm ghost" style="margin-top:6px" onClick=${() => exportIcs(p, days)}><${Icon} n="download" s=${16} /> Do kalendarza (.ics)</button>`}
      </div>`; })}</div>
    <p class="small muted">Stuknij dzień, żeby wpisać lub zmienić godziny.</p>
    ${edit && html`<${DaySheet} d=${edit} ppl=${ppl} onClose=${() => setEdit(null)} />`}
  </${Page}>`;
}

function DaySheet({ d, ppl, onClose }) {
  const [p, setP] = useState(ppl.length === 1 ? ppl[0] : getMe());
  const cur = shifts(p)[d] || {};
  const [st, setSt] = useState(cur.start || ''), [en, setEn] = useState(cur.end || '');
  const save = (v) => { const all = list('shifts').find((s) => s.id === p) || { id: p, days: {} }; const days = { ...all.days }; if (v) days[d] = v; else delete days[d]; put('shifts', { ...all, days }); onClose(); };
  return html`<${Sheet} title=${longDate(d)} onClose=${onClose}><div class="form">
    <${Seg} value=${p} onChange=${(v) => { setP(v); const c = shifts(v)[d] || {}; setSt(c.start || ''); setEn(c.end || ''); }} options=${[['julia', person('julia')], ['franek', person('franek')]]} />
    <div class="chips">${PRESETS(p).map(([a, b]) => html`<button class="chip" onClick=${() => save({ start: a, end: b })}>${hm(a)}–${hm(b)}</button>`)}</div>
    <div class="inline"><${Field} label="Od"><input type="time" value=${st} onInput=${(e) => setSt(e.target.value)} /></${Field}><${Field} label="Do"><input type="time" value=${en} onInput=${(e) => setEn(e.target.value)} /></${Field}></div>
    <button class="btn primary block" disabled=${!st || !en} onClick=${() => save({ start: st, end: en, src: cur.src })}>Zapisz godziny${st && en ? ` · ${fmtH(hours(st, en))}` : ''}</button>
    <div class="chips">${[['W', 'Wolne'], ['U', 'Urlop'], ['L4', 'L4']].map(([c, l]) => html`<button class="chip" onClick=${() => save({ code: c })}>${l}</button>`)}
      <button class="chip" onClick=${() => save(null)}>Wyczyść</button></div>
  </div></${Sheet}>`;
}

function exportIcs(p, days) {
  const s = shifts(p), stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const ev = days.filter((d) => s[d]?.start).map((d) => { const D = d.replace(/-/g, ''), a = s[d].start.replace(':', ''), b = s[d].end.replace(':', '');
    return ['BEGIN:VEVENT', `UID:${p}-${D}@naszdom`, `DTSTAMP:${stamp}`, `DTSTART;TZID=Europe/Warsaw:${D}T${a}00`, `DTEND;TZID=Europe/Warsaw:${D}T${b}00`, `SUMMARY:Praca ${person(p)}`, 'END:VEVENT'].join('\r\n'); });
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Nasz dom//PL', ...ev, 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = `grafik-${person(p).toLowerCase()}-${days[0].slice(0, 7)}.ics`; a.click();
}
