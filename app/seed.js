// Dane startowe: kategorie, sklepy, obowiązki i grafiki na listopad/grudzień 2026.
export const PEOPLE = ['julia', 'franek'];

export const CATS = [
  { id: 'spoz', name: 'Spożywcze', c: '#F4A6C1' },
  { id: 'chemia', name: 'Chemia i dom', c: '#B9D7EA' },
  { id: 'mieszk', name: 'Mieszkanie i rachunki', c: '#E8C5E5' },
  { id: 'prad', name: 'Prąd', c: '#F9E1A8' },
  { id: 'transport', name: 'Transport', c: '#C9DDB8' },
  { id: 'miasto', name: 'Jedzenie na mieście', c: '#FFD9C9' },
  { id: 'zdrowie', name: 'Zdrowie i apteka', c: '#F7B7C3' },
  { id: 'ubrania', name: 'Ubrania', c: '#D8CCF0' },
  { id: 'rozrywka', name: 'Rozrywka', c: '#BFE3DA' },
  { id: 'prezenty', name: 'Prezenty', c: '#F2C9A0' },
  { id: 'kita', name: 'Kita', c: '#E6D3B8' },
  { id: 'studia', name: 'Studia', c: '#C7D2F0' },
  { id: 'inne', name: 'Inne', c: '#DDD5D9' },
];

// Szybkie przyciski sklepów + domyślna kategoria
export const SHOPS = [
  { name: 'Biedronka', cat: 'spoz' }, { name: 'Lidl', cat: 'spoz' }, { name: 'Żabka', cat: 'spoz' },
  { name: 'Rossmann', cat: 'chemia' }, { name: 'Action', cat: 'chemia' }, { name: 'Pepco', cat: 'chemia' },
  { name: 'Allegro', cat: 'inne' },
];

export const LISTS = ['Ogólna', 'Biedronka', 'Lidl', 'Rossmann', 'Żabka', 'Action', 'Pepco', 'Allegro'];

export const CARD_COLORS = { Biedronka: '#C8312B', Lidl: '#1F5FA8', Rossmann: '#C8164F', Żabka: '#2E7D32', Action: '#1C5BA8', Pepco: '#1A1A1A', 'IKEA Family': '#E8B500', Orlen: '#C8102E' };

export const PLACES = ['Lodówka', 'Zamrażarka', 'Szafka', 'Chemia'];

export const CODES = {
  W: 'Wolne', DW5: 'Wolne (DW5)', 'NŚ': 'Wolna niedziela / święto', DWN: 'Wolne za niedzielę', U: 'Urlop', L4: 'L4',
};
export const isWork = (s) => s && s.start;

export function seed() {
  const now = Date.now();
  const o = {};
  const add = (c, item) => { item.ts = now; (o[c] ||= {})[item.id] = item; };
  add('cfg', { id: 'people', v: { julia: { name: 'Julia', rate: 0 }, franek: { name: 'Franek', rate: 0 } } });
  add('cfg', { id: 'budget', v: { limit: 4000, cats: {} } });
  add('cfg', { id: 'catGoal', v: 3 });
  LISTS.forEach((name, i) => add('lists', { id: 'l' + i, name, order: i }));
  ['Biedronka', 'Lidl', 'Rossmann'].forEach((store, i) => add('cards', { id: 'c' + i, store, number: '', color: CARD_COLORS[store] }));
  [
    ['Wynieść śmieci', 2, 'franek'], ['Kuweta Kity', 1, 'rot'], ['Zmywarka', 1, 'rot'],
    ['Odkurzanie', 7, 'julia'], ['Łazienka', 7, 'franek'], ['Pranie', 4, 'julia'], ['Zmiana pościeli', 14, 'rot'],
  ].forEach(([name, every, who], i) => {
    // rozłóż pierwsze terminy w czasie, żeby na start nie było wszystkiego naraz
    const d = new Date(); d.setDate(d.getDate() - every + (every > 1 ? 1 + (i % every) : 0));
    const last = d.toISOString().slice(0, 10) + 'T12:00';
    add('chores', { id: 'ch' + i, name, every, who, next: who === 'rot' ? 'julia' : who, last, lastBy: who === 'rot' ? 'franek' : who });
  });
  add('shifts', { id: 'julia', days: {} });
  add('shifts', { id: 'franek', days: {} });
  return o;
}
