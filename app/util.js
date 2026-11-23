// Drobne narzędzia: kwoty, daty, identyfikatory.
const zlFmt = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const zl = (n) => zlFmt.format(Math.round((+n || 0) * 100) / 100).replace(/ /g, ' ') + ' zł';
export const zl0 = (n) => Math.round(+n || 0).toLocaleString('pl-PL').replace(/ /g, ' ') + ' zł';
export const num = (s) => { const v = parseFloat(String(s ?? '').replace(/\s/g, '').replace(',', '.')); return isNaN(v) ? 0 : v; };
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const pad = (n) => String(n).padStart(2, '0');
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => iso(new Date());
export const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d || 1); };
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
export const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
export const monthOf = (s) => s.slice(0, 7);
export const addMonths = (m, n) => { const d = parse(m + '-01'); d.setMonth(d.getMonth() + n); return iso(d).slice(0, 7); };
export const daysInMonth = (m) => { const d = parse(m + '-01'); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); };

export const MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
const MONTHS_GEN = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
const MON_SHORT = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
export const DAYS = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
export const DAYS_SHORT = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);
export { cap };
export const monthLabel = (m) => { const d = parse(m + '-01'); return cap(MONTHS[d.getMonth()]) + ' ' + d.getFullYear(); };
export const longDate = (s) => { const d = parse(s); return `${cap(DAYS[d.getDay()])}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`; };
export const shortDate = (s, withYear) => { const d = parse(s); return `${d.getDate()} ${MON_SHORT[d.getMonth()]}` + (withYear || d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''); };
export const time = (ts) => { const d = new Date(ts); return `${d.getHours()}:${pad(d.getMinutes())}`; };

export const relDays = (s) => {
  const n = diffDays(today(), s);
  if (n < 0) return n === -1 ? 'wczoraj' : `${-n} dni temu`;
  if (n === 0) return 'dziś';
  if (n === 1) return 'jutro';
  if (n < 7) return `za ${n} dni`;
  return 'do ' + shortDate(s);
};

// Godziny pracy między "13:00" a "17:30" (obsługuje zmianę przez północ).
export const hours = (a, b) => {
  if (!a || !b) return 0;
  const m = (t) => { const [h, mi] = t.split(':').map(Number); return h * 60 + (mi || 0); };
  let d = m(b) - m(a); if (d <= 0) d += 1440; return d / 60;
};
export const hm = (t) => (t || '').replace(/^0(\d)/, '$1').replace(/:00$/, '');
export const fmtH = (h) => (Math.round(h * 100) / 100).toLocaleString('pl-PL') + ' h';

export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const sum = (arr, f = (x) => x) => arr.reduce((s, x) => s + (+f(x) || 0), 0);
export const groupBy = (arr, f) => arr.reduce((o, x) => ((o[f(x)] ||= []).push(x), o), {});
export const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').trim();
