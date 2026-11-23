import { useState, useEffect } from '../vendor/hooks.module.js';
import { html, Icon, Seg, Field, Page } from '../ui.js';
import { getMe, setMe, person, personF, cfg, setCfg, exportJSON, replaceAll } from '../store.js';
import { connect, disconnect, getConf, syncStatus, onStatus } from '../sync.js';
import { today } from '../util.js';

export function Ustawienia() {
  const me = getMe();
  const [theme, setTheme] = useState(localStorage.getItem('naszdom:theme') || 'auto');
  const people = cfg('people', {});
  const [st, setSt] = useState(syncStatus());
  useEffect(() => onStatus(setSt), []);
  const c = getConf();
  const [f, setF] = useState({ url: c.url || '', key: c.key || '', code: c.code || '' });
  const chTheme = (v) => { setTheme(v); localStorage.setItem('naszdom:theme', v); setMe(me); };
  const backup = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([exportJSON()], { type: 'application/json' })); a.download = `nasz-dom-kopia-${today()}.json`; a.click(); };
  const restore = async (e) => { const file = e.target.files[0]; if (!file) return; try { const d = JSON.parse(await file.text()); if (confirm('Zastąpić dane w aplikacji danymi z kopii?')) replaceAll(d); } catch { alert('To nie jest poprawny plik kopii.'); } };
  return html`<${Page} title="Ustawienia" back="#/wiecej"><div class="grid2"><div class="stack">
    <div class="card"><div class="ct"><h2>Kto korzysta z tego telefonu</h2></div>
      <${Seg} value=${me} onChange=${setMe} options=${[['julia', person('julia')], ['franek', person('franek')]]} />
      <p class="small muted" style="margin-top:8px">Julia ma różowy wygląd, Franek niebieski.</p></div>
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
      <p class="small muted">Dane są teraz tylko na tym telefonie. Żeby widzieć wszystko na obu telefonach na żywo, podłącz bazę Supabase (instrukcja w pliku INSTRUKCJA.md w repozytorium).</p>
      <div class="form" style="margin-top:12px">
        <${Field} label="Adres projektu (Project URL)"><input value=${f.url} onInput=${(e) => setF({ ...f, url: e.target.value.trim() })} placeholder="https://xxxx.supabase.co" /></${Field}>
        <${Field} label="Klucz publiczny (anon / publishable key)"><input value=${f.key} onInput=${(e) => setF({ ...f, key: e.target.value.trim() })} /></${Field}>
        <${Field} label="Kod domu" hint="Ten sam na obu telefonach. Im dłuższy, tym bezpieczniej, np. zielony-kubek-47."><input value=${f.code} onInput=${(e) => setF({ ...f, code: e.target.value })} /></${Field}>
        <button class="btn primary block" disabled=${!f.url || !f.key || f.code.length < 4} onClick=${() => connect(f)}>Połącz</button>
        ${c.url && html`<button class="btn ghost block" onClick=${() => { disconnect(); setF({ url: '', key: '', code: '' }); }}>Odłącz ten telefon</button>`}
      </div></div>
    <div class="card"><div class="ct"><h2>Powiadomienia</h2></div>
      <p class="small muted">Powiadomienia na iPhonie działają, gdy aplikacja jest dodana do ekranu głównego (Safari → Udostępnij → Do ekranu początkowego). Włączę je w kolejnym kroku, po podłączeniu synchronizacji.</p></div>
  </div></div></${Page}>`;
}
