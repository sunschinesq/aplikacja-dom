import { html, Icon } from '../ui.js';
import { list, getMe } from '../store.js';
import { today, diffDays } from '../util.js';
import { catLog } from '../logic.js';

export function Wiecej() {
  const meals = catLog(today()).filter((x) => x.type === 'jedzenie').length;
  const unread = list('notes').filter((n) => n.to === getMe() && !n.read).length;
  const w = list('warranties').filter((x) => { const d = diffDays(today(), x.until); return d >= 0 && d <= 7; }).length;
  const mods = [
    ['grafik', 'cal', 'Grafik', 'zmiany, godziny, wypłata'], ['kita', 'cat', 'Kita', `${meals} posiłków dziś`],
    ['obowiazki', 'broom', 'Obowiązki', 'kto co i kiedy'], ['liscik', 'heart', 'Liściki', unread ? `${unread} nowy` : 'miłe słowo'],
    ['skarbonka', 'star', 'Skarbonka', 'wspólne cele'], ['historia', 'clock', 'Historia', 'kto co zmienił'],
    ['prad', 'bolt', 'Prąd', 'rachunki co 2 miesiące'], ['gwarancje', 'shield', 'Gwarancje', w ? `${w} kończy się wkrótce` : 'paragony i terminy'],
    ['ustawienia', 'gear', 'Ustawienia', 'wygląd, synchronizacja, kopia'],
  ];
  return html`<div class="page"><header class="ph"><h1>Więcej</h1></header>
    <div class="modgrid">${mods.map(([h, i, t, s]) => html`<a class="mod" href=${'#/' + h}><${Icon} n=${i} s=${26} /><span><b>${t}</b><br/><small>${s}</small></span></a>`)}</div></div>`;
}
