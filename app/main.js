import { render } from './vendor/preact.module.js';
import { useState, useEffect } from './vendor/hooks.module.js';
import { html, Icon } from './ui.js';
import { useDB, getMe, setMe, cfg, subscribe } from './store.js';
import { pendingShopping } from './logic.js';
import { autoConnect } from './sync.js';
import { Start } from './screens/start.js';
import { Wydatki } from './screens/wydatki.js';
import { Zakupy, KartaPage } from './screens/zakupy.js';
import { Kuchnia, PrzepisPage } from './screens/kuchnia.js';
import { Wiecej } from './screens/wiecej.js';
import { Grafik } from './screens/grafik.js';
import { Kita, Obowiazki, Liscik } from './screens/codzienne.js';
import { Prad, Gwarancje } from './screens/dom.js';
import { Ustawienia } from './screens/ustawienia.js';

const applyTheme = () => {
  const r = document.documentElement;
  r.dataset.me = getMe() || 'julia';
  const t = localStorage.getItem('naszdom:theme') || 'auto';
  if (t === 'auto') delete r.dataset.theme; else r.dataset.theme = t;
  const bg = getComputedStyle(r).getPropertyValue('--bg').trim();
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', bg);
};
subscribe(applyTheme); applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

const TABS = [['', 'home', 'Start'], ['wydatki', 'wallet', 'Wydatki'], ['zakupy', 'cart', 'Zakupy'], ['kuchnia', 'fork', 'Kuchnia'], ['wiecej', 'more', 'Więcej']];
const MORE = ['wiecej', 'grafik', 'kita', 'obowiazki', 'liscik', 'prad', 'gwarancje', 'ustawienia'];

function useRoute() {
  const get = () => location.hash.replace(/^#\/?/, '').split('/');
  const [r, set] = useState(get());
  useEffect(() => { const f = () => { set(get()); window.scrollTo(0, 0); }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return r;
}

function Onboard() {
  return html`<div class="onboard">
    <p class="date">Witaj w aplikacji</p>
    <h1>Nasz dom</h1>
    <p class="muted">Kto korzysta z tego telefonu? Od tego zależą kolory i to, co widzisz jako „moje”.</p>
    ${['julia', 'franek'].map((p) => html`<button class="whobtn" onClick=${() => setMe(p)}><i class=${'dot ' + p} />${cfg('people', {})[p]?.name}</button>`)}
  </div>`;
}

function App() {
  useDB();
  const [page, ...rest] = useRoute();
  if (!getMe()) return html`<${Onboard} />`;
  const n = pendingShopping();
  const screens = {
    '': Start, wydatki: Wydatki, zakupy: Zakupy, kuchnia: Kuchnia, wiecej: Wiecej, grafik: Grafik, kita: Kita,
    obowiazki: Obowiazki, liscik: Liscik, prad: Prad, gwarancje: Gwarancje, ustawienia: Ustawienia, karta: KartaPage, przepis: PrzepisPage,
  };
  const S = screens[page] || Start;
  const active = MORE.includes(page) ? 'wiecej' : page === 'karta' ? 'zakupy' : page === 'przepis' ? 'kuchnia' : page;
  return html`<div class="app">
    <nav class="tabs" aria-label="Główne menu">
      <div class="brand">Nasz <i>dom</i></div>
      ${TABS.map(([h, i, l]) => html`<a href=${'#/' + h} class=${active === h ? 'on' : ''}>
        <span class="pillbg"><${Icon} n=${i} /><span class="lbl">${l}</span>${h === 'zakupy' && n > 0 && html`<span class="badge">${n}</span>`}</span>
        <span class="lbl-m">${l}</span></a>`)}
    </nav>
    <main><${S} args=${rest} /></main>
  </div>`;
}

render(html`<${App} />`, document.getElementById('app'));
autoConnect();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js');
