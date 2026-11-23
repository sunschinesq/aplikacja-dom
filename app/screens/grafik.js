import { useState, useEffect } from '../vendor/hooks.module.js';
import { html, Icon, Sheet, Seg, Field, MonthNav, Dot, Page } from '../ui.js';
import { list, put, getMe, person, cfg, setCfg } from '../store.js';
import { today, monthOf, daysInMonth, parse, longDate, hours, hm, fmtH, zl, num, DAYS_SHORT } from '../util.js';
import { CODES } from '../seed.js';
import { callFn } from '../push.js';
import { syncStatus, onStatus } from '../sync.js';

const classes = (p) => list('classes').find((s) => s.id === p)?.days || {};

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
            return html`<span class=${'sh ' + (s.start ? p : 'off')}>${s.start ? `${hm(s.start)}–${hm(s.end)}` : s.code === 'U' ? 'urlop' : s.code === 'L4' ? 'L4' : 'wolne'}</span>`; })}
          ${ppl.map((p) => { const c = classes(p)[d]; return c?.length ? html`<span class="sh zaj">zaj. ${hm(c[0].start)}–${hm(c[c.length - 1].end)}</span>` : null; })}</button>`; })}</div>
    <div class="grid2">${['julia', 'franek'].map((p) => { const s = stats(p);
      return html`<div class="card"><div class="ct"><span class="who"><${Dot} p=${p} />${person(p)}</span><span class="muted small">${s.n} dni pracy</span></div>
        <div class="kv"><span>Przepracowane</span><b>${fmtH(s.h)}</b></div>
        <div class="kv" style="align-items:center"><span>Stawka</span><span class="inline" style="align-items:center;width:140px"><input inputmode="decimal" style="padding:6px 8px;text-align:right" value=${people[p]?.rate || ''} placeholder="0"
          onChange=${(e) => setCfg('people', { ...people, [p]: { ...people[p], rate: num(e.target.value) } })} /> <span class="small">zł/h</span></span></div>
        <div class="kv"><span>Wypłata brutto</span><b>${people[p]?.rate ? zl(s.pay) : '—'}</b></div>
        ${p === 'franek' && html`<button class="btn sm ghost" style="margin-top:6px" onClick=${() => exportIcs(p, days)}><${Icon} n="download" s=${16} /> Do kalendarza (.ics)</button>`}
      </div>`; })}</div>
    <p class="small muted">Stuknij dzień, żeby wpisać lub zmienić godziny.</p>
    <${Feeds} />
    <label class="btn ghost"><${Icon} n="upload" s=${18} /> Wczytaj grafik z pliku<input type="file" accept="application/json,.json" style="display:none" onChange=${importShifts} /></label>
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
    ${classes(p)[d]?.length > 0 && html`<div class="card tint">${classes(p)[d].map((c) => html`<div class="kv small"><span>${c.title}</span><b>${hm(c.start)}–${hm(c.end)}</b></div>`)}</div>`}
    <div class="chips">${PRESETS(p).map(([a, b]) => html`<button class="chip" onClick=${() => save({ start: a, end: b, place: cur.place, manual: true })}>${hm(a)}–${hm(b)}</button>`)}</div>
    <div class="inline"><${Field} label="Od"><input type="time" value=${st} onInput=${(e) => setSt(e.target.value)} /></${Field}><${Field} label="Do"><input type="time" value=${en} onInput=${(e) => setEn(e.target.value)} /></${Field}></div>
    <button class="btn primary block" disabled=${!st || !en} onClick=${() => save({ start: st, end: en, place: cur.place, manual: true })}>Zapisz godziny${st && en ? ` · ${fmtH(hours(st, en))}` : ''}</button>
    <div class="chips">${[['W', 'Wolne'], ['U', 'Urlop'], ['L4', 'L4']].map(([c, l]) => html`<button class="chip" onClick=${() => save({ code: c, manual: true })}>${l}</button>`)}
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

// Wczytanie grafików z pliku (np. nasz-dom-start.json): dopisuje dni, nie rusza innych danych
async function importShifts(e) {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    const src = d.shifts || {}; let n = 0;
    for (const p of ['julia', 'franek']) {
      const days = src[p]?.days; if (!days) continue;
      const cur = list('shifts').find((s) => s.id === p) || { id: p, days: {} };
      put('shifts', { ...cur, days: { ...cur.days, ...days } }); n += Object.keys(days).length;
    }
    alert(n ? `Wczytano ${n} dni grafiku.` : 'W tym pliku nie ma grafiku.');
  } catch { alert('To nie jest poprawny plik.'); }
}

// Automatyczne pobieranie kalendarzy (link .ics): praca → grafik, studia → zajęcia
function Feeds() {
  const me = getMe();
  const [feeds, setFeeds] = useState(null), [edit, setEdit] = useState(null), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const [st, setSt] = useState(syncStatus());
  useEffect(() => onStatus(setSt), []);
  const connected = st === 'połączono';
  const run = async (body) => { setBusy(true); setErr(''); try { const r = await callFn(body); setFeeds(r.feeds || {}); return true; } catch (e) { setErr(e.message || String(e)); return false; } finally { setBusy(false); } };
  useEffect(() => { if (connected) run({ action: 'feed_get' }); }, [connected]);
  if (!connected) return html`<div class="card"><div class="ct"><h2>Automatycznie z kalendarza</h2></div><p class="small muted">Najpierw połącz synchronizację w Ustawieniach.</p></div>`;
  const KINDS = [['praca', 'Praca → grafik'], ['studia', 'Studia → zajęcia']];
  return html`<div class="card"><div class="ct"><h2>Automatycznie z kalendarza · ${person(me)}</h2>
      ${feeds && Object.keys(feeds).length > 0 && html`<button class="btn sm" disabled=${busy} onClick=${() => run({ action: 'feed_sync' })}>${busy ? 'Pobieram…' : 'Odśwież teraz'}</button>`}</div>
    ${KINDS.map(([k, l]) => { const f = feeds?.[k];
      return html`<div class="row"><span class="grow"><span class="t">${l}</span>
        <span class="s">${!feeds ? '…' : f ? `${f.info || 'jeszcze nie pobrano'}${f.last_sync ? ' · ' + new Date(f.last_sync).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}` : 'nie ustawiono'}</span></span>
        <button class="btn sm ghost" onClick=${() => setEdit({ kind: k, url: '', place: f?.place || (k === 'praca' ? '' : '') })}>${f ? 'Zmień' : 'Ustaw'}</button></div>`; })}
    ${err && html`<p class="small" style="color:var(--bad)">${err}</p>`}
    <p class="small muted">Pobieram co 3 godziny. Z kalendarza studiów biorę zajęcia, bez kolokwiów, testów, egzaminów i sesji nauki. Ręcznie poprawionych dni grafiku nie nadpisuję.</p>
    ${edit && html`<${Sheet} title=${edit.kind === 'praca' ? 'Kalendarz z pracy' : 'Kalendarz studiów'} onClose=${() => setEdit(null)}><div class="form">
      <${Field} label="Link do kalendarza (.ics lub webcal://)" hint="Link zostaje tylko na serwerze, telefon go nie przechowuje. Puste pole + Zapisz = wyłącz pobieranie.">
        <input value=${edit.url} onInput=${(e) => setEdit({ ...edit, url: e.target.value.trim() })} placeholder="https://… albo webcal://…" autocapitalize="off" autocorrect="off" /></${Field}>
      ${edit.kind === 'praca' && html`<${Field} label="Nazwa miejsca pracy (pokazuje się na Starcie)"><input value=${edit.place} onInput=${(e) => setEdit({ ...edit, place: e.target.value })} placeholder="np. kawiarnia" /></${Field}>`}
      <button class="btn primary block" disabled=${busy} onClick=${async () => { if (await run({ action: 'feed_set', ...edit })) setEdit(null); }}>${busy ? 'Pobieram…' : 'Zapisz i pobierz'}</button>
      ${err && html`<p class="small" style="color:var(--bad)">${err}</p>`}
    </div></${Sheet}>`}
  </div>`;
}
