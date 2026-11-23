// Obliczenia współdzielone przez ekrany.
import { list, getMe, cfg, other } from './store.js';
import { sum, monthOf, today, daysInMonth, diffDays, addDays, parse, norm, num } from './util.js';
import { PEOPLE } from './seed.js';

export const expensesIn = (m) => list('expenses').filter((e) => monthOf(e.date) === m);
export const sharedSpent = (m) => sum(expensesIn(m).filter((e) => e.account === 'wspolne'), (e) => e.amount);

export function forecast(m, spent) {
  const t = today();
  if (monthOf(t) !== m) return spent;
  const d = +t.slice(8, 10), n = daysInMonth(m);
  // wydatki cykliczne, które jeszcze przyjdą w tym miesiącu
  const pending = sum(list('recurring').filter((r) => r.account === 'wspolne' && !r.paid?.[m] && r.day > d), (r) => r.amount);
  const recurringPaid = sum(expensesIn(m).filter((e) => e.account === 'wspolne' && e.recurring), (e) => e.amount);
  const variable = spent - recurringPaid;
  return recurringPaid + pending + (variable / d) * n;
}

// Saldo między wami (wydatki z kont prywatnych dzielone między osoby + rozliczenia)
export function balances() {
  const b = { julia: 0, franek: 0 };
  for (const e of list('expenses')) {
    if (e.account === 'wspolne' || e.private || !PEOPLE.includes(e.account)) continue;
    const split = e.split || { julia: 0.5, franek: 0.5 };
    b[e.account] += e.amount;
    for (const p of PEOPLE) b[p] -= e.amount * (split[p] ?? 0);
  }
  for (const s of list('settlements')) { b[s.from] += s.amount; b[s.to] -= s.amount; }
  return b;
}
export function debt() {
  const b = balances();
  const v = Math.round(b.julia * 100) / 100;
  if (Math.abs(v) < 0.01) return null;
  return v > 0 ? { from: 'franek', to: 'julia', amount: v } : { from: 'julia', to: 'franek', amount: -v };
}

export const myShare = (e) => (e.account === 'wspolne' ? 0 : e.private ? e.amount : e.amount * ((e.split || { julia: .5, franek: .5 })[getMe()] ?? 0));

// Cykliczne: następny termin
export function dueDate(r, m) { const n = daysInMonth(m); return `${m}-${String(Math.min(r.day, n)).padStart(2, '0')}`; }
export function upcomingBills(days = 7) {
  const t = today(), m = monthOf(t), out = [];
  for (const r of list('recurring')) {
    for (const mm of [m, monthOf(addDays(t, days))]) {
      const d = dueDate(r, mm);
      if (!r.paid?.[mm] && diffDays(t, d) <= days && diffDays(t, d) >= -10 && !out.find((x) => x.r.id === r.id)) out.push({ r, m: mm, date: d });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// Obowiązki
export function choreDue(c) { if (!c.last) return today(); return c.snooze && c.snooze > c.last ? c.snooze : addDays(c.last.slice(0, 10), c.every); }
export const choresToday = () => list('chores').filter((c) => choreDue(c) <= today() || (c.last && c.last.slice(0, 10) === today()));
export const doneToday = (c) => c.last && c.last.slice(0, 10) === today();

// Kot
export const catLog = (day) => list('catlog').filter((x) => x.day === day).sort((a, b) => a.at - b.at);

// Zmiany
export const shiftOf = (p, d) => list('shifts').find((s) => s.id === p)?.days?.[d];
export const classesOf = (p, d) => list('classes').find((s) => s.id === p)?.days?.[d] || [];

// Spiżarnia i jednostki
const UNITS = { g: ['g', 1], dag: ['g', 10], kg: ['g', 1000], ml: ['ml', 1], l: ['ml', 1000] };
export const toBase = (q, u) => { const k = UNITS[(u || '').toLowerCase()]; return k ? [num(q) * k[1], k[0]] : [num(q), (u || 'szt').toLowerCase()]; };
export const fmtQty = (q, u) => (q ? `${String(Math.round(q * 100) / 100).replace('.', ',')} ${u || ''}`.trim() : '');
export const findPantry = (name) => { const n = norm(name); return list('pantry').filter((p) => { const pn = norm(p.name); return pn === n || pn.includes(n) || n.includes(pn); }); };

const ING_RE = /^\s*(\d+(?:[.,]\d+)?|\d+\/\d+)?\s*(g|kg|dag|ml|l|szt\.?|op\.?|łyżk[aiy]?|łyżeczk[aiy]?|szklank[aiy]?|puszk[aiy]?|ząb(?:ki|ek)?|pęczek|garść)?\.?\s+(.+)$/i;
export function parseIng(line) {
  const m = line.match(ING_RE);
  if (!m || (!m[1] && !m[2])) return { name: line.trim(), qty: 0, unit: '' };
  let q = m[1] || ''; if (q.includes('/')) { const [a, b] = q.split('/'); q = a / b; }
  return { name: m[3].trim(), qty: num(q), unit: (m[2] || (m[1] ? 'szt' : '')).replace(/\.$/, '') };
}
export const ingLine = (i, f = 1) => [i.qty ? fmtQty(i.qty * f, i.unit === 'szt' ? '' : i.unit) : '', i.name].filter(Boolean).join(' ');

// Działy sklepowe
const SECTIONS = [
  ['Warzywa i owoce', 'pomidor ogór sałat ziemniak cebul czosn marchew papryk cukini jabł banan cytryn mandaryn pomarańcz owoc warzyw brokuł kapust pieczark awokado szpinak rzodkiew winogr gruszk'],
  ['Pieczywo', 'chleb bułk bagiet tortill pieczyw rogal'],
  ['Nabiał i jajka', 'mleko jogurt ser masło śmietan twaróg jaj kefir maślank mozzarell skyr'],
  ['Mięso i ryby', 'kurczak filet mięso wołow wieprz szynk kiełbas boczek ryb łosoś tuńczyk indyk mielon parów'],
  ['Mrożonki', 'mrożon lody pierogi frytki'],
  ['Suche i przyprawy', 'makaron ryż kasz mąk cukier sól pieprz przypraw olej oliw ocet kaw herbat płatki musli passat koncentrat puszk fasol ciecierzyc sos'],
  ['Słodycze i przekąski', 'czekolad chips ciastk baton orzech wafel żelk'],
  ['Napoje', 'woda sok napój piwo wino cola'],
  ['Chemia i higiena', 'płyn proszek papier ręcznik mydło szampon pasta szczotecz gąbk worki domestos tabletki kapsułki dezodorant podpask chusteczk'],
  ['Dla Kity', 'karma żwirek kot przysmak'],
];
export function sectionOf(name) {
  const n = norm(name);
  for (const [s, words] of SECTIONS) if (words.split(' ').some((w) => n.includes(norm(w)))) return s;
  return 'Inne';
}
export const SECTION_ORDER = [...SECTIONS.map((s) => s[0]), 'Inne'];
export function placeOf(name) {
  const s = sectionOf(name);
  if (s === 'Mrożonki') return 'Zamrażarka';
  if (['Nabiał i jajka', 'Mięso i ryby'].includes(s)) return 'Lodówka';
  if (s === 'Chemia i higiena') return 'Chemia';
  return 'Szafka';
}

// Uwaga: kończące się produkty i gwarancje
export function alerts() {
  const t = today(), out = [];
  for (const p of list('pantry')) if (p.expires && diffDays(t, p.expires) <= 2) out.push({ kind: 'pantry', name: p.name, date: p.expires });
  for (const w of list('warranties')) { const d = diffDays(t, w.until); if (d >= -3 && d <= 7) out.push({ kind: 'warranty', name: w.name, date: w.until, days: d }); }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export const pendingShopping = () => list('shopping').filter((s) => !s.done).length;
export const unreadNotes = () => list('notes').filter((n) => n.to === getMe() && !n.read).sort((a, b) => b.ts - a.ts);
export const notMe = () => other(getMe());
