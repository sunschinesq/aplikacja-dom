import { useState, useEffect } from '../vendor/hooks.module.js';
import { html, Icon, Seg, Field, Page } from '../ui.js';
import { getMe, person, personF, cfg, setCfg, exportJSON, replaceAll, refresh, wipeDevice } from '../store.js';
import { connect, disconnect, getConf, syncStatus, onStatus } from '../sync.js';
import { today } from '../util.js';
import { pushSupported, needsHomeScreen, pushState, enablePush, disablePush, testPush, callFn } from '../push.js';

export function Ustawienia() {
  const me = getMe();
  const [theme, setTheme] = useState(localStorage.getItem('naszdom:theme') || 'auto');
  const people = cfg('people', {});
  const [st, setSt] = useState(syncStatus());
  useEffect(() => onStatus(setSt), []);
  const c = getConf();
  const [f, setF] = useState({ url: c.url || '', key: c.key || '', code: c.code || '', pin: '' });
  const chTheme = (v) => { setTheme(v); localStorage.setItem('naszdom:theme', v); refresh(); };
  const backup = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([exportJSON()], { type: 'application/json' })); a.download = `nasz-dom-kopia-${today()}.json`; a.click(); };
  const restore = async (e) => { const file = e.target.files[0]; if (!file) return; try { const d = JSON.parse(await file.text()); if (confirm('Zastąpić dane w aplikacji danymi z kopii?')) replaceAll(d); } catch { alert('To nie jest poprawny plik kopii.'); } };
  return html`<${Page} title="Ustawienia" back="#/wiecej"><div class="grid2"><div class="stack">
    <div class="card"><div class="ct"><h2>Ten telefon należy do</h2><span class="who"><i class=${'dot ' + me} />${person(me)}</span></div>
      <p class="small muted">Osoby nie da się zmienić. Jeśli telefon przechodzi do kogoś innego, wyczyść go na dole tej strony.</p></div>
    <div class="card"><div class="ct"><h2>Wygląd</h2></div>
      <${Seg} value=${theme} onChange=${chTheme} options=${[['auto', 'Jak w telefonie'], ['light', 'Jasny'], ['dark', 'Ciemny']]} /></div>
    <div class="card"><div class="ct"><h2>Imiona</h2></div>
      ${['julia', 'franek'].map((p) => html`<div class="inline" style="align-items:center;margin:6px 0"><i class=${'dot ' + p} /><input value=${people[p]?.name || ''}
        onChange=${(e) => setCfg('people', { ...people, [p]: { ...people[p], name: e.target.value.trim() || people[p].name } })} /></div>`)}</div>
    <div class="card"><div class="ct"><h2>Kopia zapasowa</h2></div>
      <p class="small muted">Pobierz plik raz na jakiś czas i trzymaj go np. na Dysku Google. Kopia zawiera wszystko oprócz Twoich ustawień urządzenia.</p>
      <div class="row-wrap" style="margin-top:10px"><button class="btn" onClick=${backup}><${Icon} n="download" s=${18} /> Pobierz kopię</button>
        <label class="btn ghost"><${Icon} n="upload" s=${18} /> Przywróć z pliku<input type="file" accept="application/json,.json" style="display:none" onChange=${restore} /></label></div></div>
  </div><div class="stack">
    <div class="card"><div class="ct"><h2>Synchronizacja z ${personF(me === 'julia' ? 'franek' : 'julia', 'ins')}</h2><span class=${'pill ' + (st === 'połączono' ? 'ok' : st.startsWith('błąd') ? 'warn' : '')}>${st === 'off' ? 'wyłączona' : st}</span></div>
      <p class="small muted">${st === 'połączono' ? 'Zmiany pojawiają się na obu telefonach na żywo.' : 'Bez połączenia dane są tylko na tym telefonie. Instrukcja: plik INSTRUKCJA.md w repozytorium.'}</p>
      <div class="form" style="margin-top:12px">
        <${Field} label="Adres projektu (Project URL)"><input value=${f.url} onInput=${(e) => setF({ ...f, url: e.target.value.trim() })} placeholder="https://xxxx.supabase.co" /></${Field}>
        <${Field} label="Klucz publiczny (anon / publishable key)"><input value=${f.key} onInput=${(e) => setF({ ...f, key: e.target.value.trim() })} /></${Field}>
        <${Field} label="Kod domu" hint="Ten sam na obu telefonach, min. 6 znaków, np. zielony-kubek-47."><input value=${f.code} onInput=${(e) => setF({ ...f, code: e.target.value })} /></${Field}>
        ${st !== 'połączono' && html`<${Field} label=${'PIN ' + personF(me, 'gen')} hint="4–8 cyfr. Przy pierwszym połączeniu go ustawiasz. Potem jest potrzebny tylko na nowym telefonie. Nie mów go nikomu."><input type="password" inputmode="numeric" autocomplete="off" value=${f.pin} onInput=${(e) => setF({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 8) })} /></${Field}>`}
        <button class="btn primary block" disabled=${!f.url || !f.key || f.code.length < 6 || (st !== 'połączono' && f.pin.length < 4)} onClick=${() => connect(f)}>Połącz</button>
        ${c.url && html`<button class="btn ghost block" onClick=${() => { disconnect(); setF({ url: '', key: '', code: '' }); }}>Odłącz ten telefon</button>`}
      </div></div>
    <${Powiadomienia} connected=${st === 'połączono'} />
    <${Skroty} connected=${st === 'połączono'} url=${c.url} />
    <div class="card"><div class="ct"><h2>Wyczyść ten telefon</h2></div>
      <p class="small muted">Usuwa z tego telefonu wszystkie dane i wybór osoby. Dane w chmurze zostają. Żeby potem połączyć się jako ktoś, trzeba znać jego PIN.</p>
      <button class="btn ghost block" style="margin-top:10px;color:var(--bad)" onClick=${() => confirm('Na pewno wyczyścić ten telefon? Jeśli nie ma synchronizacji, dane przepadną.') && wipeDevice()}>Wyczyść telefon</button></div>
  </div></div></${Page}>`;
}

function Powiadomienia({ connected }) {
  const [state, setState] = useState('…'), [busy, setBusy] = useState(false), [msg, setMsg] = useState('');
  const refresh = () => pushState().then(setState).catch(() => setState('off'));
  useEffect(() => { refresh(); }, [connected]);
  const run = (f, ok) => async () => { setBusy(true); setMsg(''); try { await f(); setMsg(ok); } catch (e) { setMsg('Błąd: ' + (e.message || e)); } setBusy(false); refresh(); };
  return html`<div class="card"><div class="ct"><h2>Powiadomienia</h2>${state === 'on' && html`<span class="pill ok">włączone</span>`}</div>
    <p class="small muted">Liścik, nowy wydatek i dopisany produkt od drugiej osoby. O 7:30: Twoje obowiązki na dziś, rachunki, gwarancje i kończące się produkty. O 19:30: przypomnienie o Kicie.</p>
    <div style="margin-top:10px">
    ${!pushSupported() || needsHomeScreen() ? html`<p class="small">Najpierw dodaj aplikację do ekranu głównego: Safari → <b>Udostępnij</b> → <b>Do ekranu początkowego</b>, i otwórz ją z ikonki.</p>`
      : !connected ? html`<p class="small">Najpierw połącz synchronizację powyżej.</p>`
      : state === 'on' ? html`<div class="row-wrap"><button class="btn" disabled=${busy} onClick=${run(testPush, 'Wysłano. Powinno przyjść za chwilę.')}><${Icon} n="bell" s=${18} /> Wyślij próbne</button>
          <button class="btn ghost" disabled=${busy} onClick=${run(disablePush, 'Wyłączono na tym telefonie.')}>Wyłącz</button></div>`
      : html`<button class="btn primary block" disabled=${busy} onClick=${run(enablePush, 'Włączone! Wyślij próbne, żeby sprawdzić.')}><${Icon} n="bell" s=${18} /> Włącz na tym telefonie</button>`}
    ${msg && html`<p class="small" style="margin-top:8px">${msg}</p>`}</div></div>`;
}

// Skróty Siri: osobisty klucz + instrukcja budowy skrótu w aplikacji Skróty
function Skroty({ connected, url }) {
  const [token, setToken] = useState(''), [busy, setBusy] = useState(false), [msg, setMsg] = useState('');
  const fnUrl = (url || '').replace(/\/+$/, '') + '/functions/v1/notify';
  const run = async (action) => { setBusy(true); setMsg(''); try { const r = await callFn({ action }); setToken(r.token || ''); if (!r.token) setMsg('Skróty wyłączone. Stare skróty przestały działać.'); } catch (e) { setMsg('Błąd: ' + e.message); } setBusy(false); };
  const copy = (t) => navigator.clipboard?.writeText(t).then(() => setMsg('Skopiowano ✓'));
  if (!connected) return null;
  return html`<div class="card"><div class="ct"><h2>Siri i skróty</h2></div>
    <p class="small muted">„Hej Siri, dopisz do listy” → „mleko, chleb i masło”. Albo „Hej Siri, wydatek” → „23,50 Żabka” (konto wspólne). Działa nawet bez otwierania aplikacji.</p>
    ${!token ? html`<div class="row-wrap" style="margin-top:10px"><button class="btn primary" disabled=${busy} onClick=${() => run('sc_new')}>${busy ? '…' : 'Utwórz klucz skrótu'}</button>
        <button class="btn ghost sm" disabled=${busy} onClick=${() => confirm('Wyłączyć wszystkie Twoje skróty?') && run('sc_revoke')}>Wyłącz skróty</button></div>
      <p class="small muted" style="margin-top:6px">Nowy klucz unieważnia poprzedni, wtedy podmień go w skrótach.</p>`
    : html`<div class="form" style="margin-top:10px">
      <p class="small"><b>Twój klucz</b> (pokazuję tylko raz, nikomu go nie dawaj):</p>
      <div class="inline"><input readonly value=${token} onFocus=${(e) => e.target.select()} /><button class="btn sm" onClick=${() => copy(token)}>Kopiuj</button></div>
      <p class="small"><b>Adres</b>:</p>
      <div class="inline"><input readonly value=${fnUrl} onFocus=${(e) => e.target.select()} /><button class="btn sm" onClick=${() => copy(fnUrl)}>Kopiuj</button></div>
      <div class="small" style="line-height:1.55">
        <b>Skrót „Dopisz do listy”</b> (aplikacja Skróty → +):
        <ol style="padding-left:20px;margin:4px 0 10px">
          <li><b>Zapytaj o dane wejściowe</b>: Tekst, pytanie „Co dopisać?”.</li>
          <li><b>Pobierz zawartość URL</b>: wklej <i>Adres</i>. Rozwiń → Metoda <b>POST</b>, Treść żądania <b>JSON</b>, dodaj pola (Tekst):
            <code>action</code> = <code>quick</code>, <code>type</code> = <code>list</code>, <code>token</code> = <i>Twój klucz</i>, <code>text</code> = <i>Podane dane</i>.</li>
          <li><b>Pobierz wartość słownika</b> „text” → <b>Pokaż powiadomienie</b> z tą wartością (opcjonalnie).</li>
          <li>Nazwij skrót <b>Dopisz do listy</b>. To jest też komenda dla Siri.</li>
        </ol>
        <b>Skrót „Wydatek”</b>: tak samo, ale pytanie „Ile i gdzie?”, <code>type</code> = <code>expense</code>. Dodaj pole <code>account</code> = <code>moje</code>, jeśli to wydatek z Twojego konta (dzielony po połowie).
      </div>
      <button class="btn ghost sm" onClick=${() => setToken('')}>Gotowe</button></div>`}
    ${msg && html`<p class="small" style="margin-top:6px">${msg}</p>`}</div>`;
}
