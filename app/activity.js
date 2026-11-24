// Historia zmian: automatyczne wpisy „kto co zrobił” (bez rzeczy prywatnych).
import { onLog, onUndo, put, list, remove, getMe, person, get } from './store.js';
import { zl, shortDate, today, addDays, longDate } from './util.js';

const F = { julia: true, franek: false };
const v = (f, m) => (F[getMe()] ? f : m);

export function logText(text, kind = 'dom') { put('log', { who: getMe(), text, kind, at: Date.now(), day: today() }); }

function describe(c, it, prev) {
  if (it.owner || prev?.owner || it.private) return null; // prywatne – nie do historii
  const added = !prev || prev.del, deleted = it.del && prev && !prev.del;
  const x = deleted ? prev : it;
  switch (c) {
    case 'expenses': return [`${added ? v('dodała', 'dodał') : deleted ? v('usunęła', 'usunął') : v('zmieniła', 'zmienił')} wydatek: ${x.desc || 'bez opisu'} ${zl(x.amount)}`, 'wydatki'];
    case 'settlements': return added && [`${v('rozliczyła', 'rozliczył')} saldo: ${zl(x.amount)}`, 'wydatki'];
    case 'deposits': return added && [`${v('wpłaciła', 'wpłacił')} na konto wspólne ${zl(x.amount)}`, 'wydatki'];
    case 'recurring': return added ? [`${v('dodała', 'dodał')} opłatę cykliczną: ${x.name}`, 'wydatki'] : deleted && [`${v('usunęła', 'usunął')} opłatę cykliczną: ${x.name}`, 'wydatki'];
    case 'shopping':
      if (added) return [`${v('dopisała', 'dopisał')} do listy: ${x.name}`, 'zakupy'];
      if (!deleted && it.done && !prev?.done) return [`${v('kupiła', 'kupił')}: ${x.name}`, 'zakupy'];
      return deleted && [`${v('usunęła', 'usunął')} z listy: ${x.name}`, 'zakupy'];
    case 'pantry': return added ? [`${v('dodała', 'dodał')} do spiżarni: ${x.name}`, 'zakupy'] : deleted && [`${v('zużyła', 'zużył')}: ${x.name}`, 'zakupy'];
    case 'cards': return added && [`${v('dodała', 'dodał')} kartę: ${x.store}`, 'zakupy'];
    case 'catlog': return added ? [x.type === 'zabawa' ? `${v('bawiła', 'bawił')} się z Kitą` : `${v('nakarmiła', 'nakarmił')} Kitę`, 'dom'] : deleted && [`${v('usunęła', 'usunął')} wpis Kity`, 'dom'];
    case 'chorelog': return added && [`${v('zrobiła', 'zrobił')}: ${x.name}`, 'dom'];
    case 'chores': return added && [`${v('dodała', 'dodał')} obowiązek: ${x.name}`, 'dom'];
    case 'notes': return added && [`${v('zostawiła', 'zostawił')} liścik`, 'dom'];
    case 'recipes': return added && [`${v('dodała', 'dodał')} przepis: ${x.name}`, 'kuchnia'];
    case 'menu': { const r = x.recipeId && get('recipes', x.recipeId); const what = r?.name || x.text;
      return added ? [`${v('zaplanowała', 'zaplanował')} ${what} (${longDate(x.day).split(',')[0].toLowerCase()})`, 'kuchnia'] : deleted && [`${v('usunęła', 'usunął')} z menu: ${what}`, 'kuchnia']; }
    case 'warranties': return added && [`${v('dodała', 'dodał')} gwarancję: ${x.name}`, 'dom'];
    case 'power': return added && [`${v('wpisała', 'wpisał')} rachunek za prąd: ${zl(x.amount)}`, 'wydatki'];
    case 'goals': return added ? [`${v('założyła', 'założył')} skarbonkę: ${x.name}`, 'wydatki'] : deleted && [`${v('usunęła', 'usunął')} skarbonkę: ${x.name}`, 'wydatki'];
    case 'goaldeps': { const g = get('goals', x.goalId);
      return added && [`${x.amount >= 0 ? v('wrzuciła', 'wrzucił') + ' do skarbonki' : v('wyjęła', 'wyjął') + ' ze skarbonki'} „${g?.name || ''}”: ${zl(Math.abs(x.amount))}`, 'wydatki']; }
    case 'shifts': return !added && !deleted && [`${v('zmieniła', 'zmienił')} grafik (${person(it.id)})`, 'dom'];
    default: return null;
  }
}

onLog((c, it, prev) => { const d = describe(c, it, prev); if (d) put('log', { who: getMe(), text: d[0], kind: d[1], at: Date.now(), day: today() }); });

// „Cofnij”: usuń z historii wpis o usunięciu (zrobiony przed chwilą)
onUndo(() => { const l = list('log').filter((x) => x.who === getMe() && Date.now() - x.at < 15000).sort((a, b) => b.at - a.at)[0]; if (l) remove('log', l.id, { silent: true }); });

// porządki: własne wpisy starsze niż 60 dni
export function pruneLog() {
  const limit = addDays(today(), -60), me = getMe();
  for (const l of list('log')) if (l.who === me && l.day < limit) remove('log', l.id, { silent: true });
}
