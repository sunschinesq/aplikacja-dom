import { useState } from '../vendor/hooks.module.js';
import { html, Icon, Sheet, Seg, Chips, MonthNav, Field, Fab, Dot, Empty } from '../ui.js';
import { list, put, patch, remove, getMe, person, personF, cfg, setCfg, other } from '../store.js';
import { zl, zl0, num, today, monthOf, addMonths, longDate, shortDate, sum, groupBy, daysInMonth, monthLabel, diffDays } from '../util.js';
import { CATS, SHOPS } from '../seed.js';
import { expensesIn, sharedSpent, forecast, debt, dueDate } from '../logic.js';

const cat = (id) => CATS.find((c) => c.id === id) || CATS[CATS.length - 1];
const accLabel = (a) => (a === 'wspolne' ? 'konto wspólne' : a === getMe() ? 'moje konto' : 'konto ' + person(a));

export function payRecurring(r, m) {
  const date = monthOf(today()) === m ? today() : dueDate(r, m);
  const e = put('expenses', { amount: r.amount, desc: r.name, date, cat: r.cat, account: r.account, recurring: r.id, by: getMe() });
  patch('recurring', r.id, { paid: { ...(r.paid || {}), [m]: e.id } });
}

export function Wydatki({ args }) {
  const [tab, setTab] = useState(args[0] || 'lista');
  const [m, setM] = useState(monthOf(today()));
  const [edit, setEdit] = useState(null);
  return html`<div class="page">
    <header class="ph"><h1>Wydatki</h1></header>
    <${Seg} value=${tab} onChange=${setTab} options=${[['lista', 'Lista'], ['budzet', 'Budżet'], ['raport', 'Raport'], ['cykliczne', 'Cykliczne']]} />
    ${tab !== 'cykliczne' && html`<${MonthNav} m=${m} set=${setM} />`}
    ${tab === 'lista' && html`<${Lista} m=${m} onEdit=${setEdit} />`}
    ${tab === 'budzet' && html`<${Budzet} m=${m} />`}
    ${tab === 'raport' && html`<${Raport} m=${m} />`}
    ${tab === 'cykliczne' && html`<${Cykliczne} />`}
    ${tab !== 'cykliczne' && html`<${Fab} onClick=${() => setEdit({})}>Wydatek</${Fab}>`}
    ${edit && html`<${ExpenseForm} e=${edit} onClose=${() => setEdit(null)} />`}
  </div>`;
}

function Hero({ m }) {
  const spent = sharedSpent(m), limit = cfg('budget', {}).limit || 0, fc = forecast(m, spent);
  return html`<div class="hero"><span class="lbl">Konto wspólne · ${monthLabel(m)}</span>
    <div class="big">${zl(spent)}</div>
    <div class=${'bar' + (limit && spent > limit ? ' over' : '')}><i style=${`width:${limit ? Math.min(100, spent / limit * 100) : 0}%`} />${limit && fc > spent && html`<b style=${`left:${Math.min(99, fc / limit * 100)}%`} />`}</div>
    <div class="mrow"><span>z ${zl0(limit)} limitu</span>${monthOf(today()) === m && html`<span>prognoza <b>${zl0(fc)}</b></span>`}</div></div>`;
}

function Lista({ m, onEdit }) {
  const [q, setQ] = useState('');
  let ex = expensesIn(m);
  if (q) ex = list('expenses').filter((e) => (e.desc || '').toLowerCase().includes(q.toLowerCase()));
  ex.sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts);
  const all = expensesIn(m), total = sum(all, (e) => e.amount);
  const byCat = Object.entries(groupBy(all, (e) => e.cat)).map(([k, v]) => [k, sum(v, (e) => e.amount)]).sort((a, b) => b[1] - a[1]);
  const max = byCat[0]?.[1] || 1;
  const d = debt();
  return html`<div class="grid2">
    <div class="stack">
      <${Hero} m=${m} />
      <div class="card"><div class="ct"><h2>Razem</h2><b>${zl(total)}</b></div>
        <div class="kv small muted"><span>w tym z konta wspólnego</span><span>${zl(sharedSpent(m))}</span></div>
        ${byCat.map(([k, v]) => html`<div class="catbar" style=${`--c:${cat(k).c}`}><i style=${`width:${v / max * 100}%`} /><span>${cat(k).name}</span><span>${zl(v)}</span></div>`)}
        ${!byCat.length && html`<${Empty}>Brak wydatków w tym miesiącu.</${Empty}>`}
      </div>
      <${Saldo} d=${d} />
    </div>
    <div class="stack">
      <label class="inline" style="position:relative"><input placeholder="Szukaj wydatków" value=${q} onInput=${(e) => setQ(e.target.value)} style="padding-left:40px" />
        <span style="position:absolute;left:12px;top:11px;color:var(--muted)"><${Icon} n="search" s=${20} /></span></label>
      ${Object.entries(groupBy(ex, (e) => e.date)).map(([day, items]) => html`<div>
        <h3>${longDate(day)}</h3>
        <div class="card" style="padding-top:4px;padding-bottom:4px">${items.map((e) => html`<${ExpRow} e=${e} onClick=${() => onEdit(e)} />`)}</div></div>`)}
      ${!ex.length && html`<${Empty}>${q ? 'Nic nie znaleziono.' : 'Dodaj pierwszy wydatek przyciskiem na dole.'}</${Empty}>`}
    </div>
  </div>`;
}

function ExpRow({ e, onClick }) {
  const c = cat(e.cat);
  const me = getMe(), part = (p) => e.amount * ((e.split || { julia: .5, franek: .5 })[p] ?? 0);
  const sub = e.account === 'wspolne' ? 'konto wspólne' : e.private ? 'prywatne' :
    e.account === me ? `płacę ja · ${person(other(me))} oddaje ${zl(part(other(me)))}` : `płaci ${person(e.account)} · oddaję ${zl(part(me))}`;
  return html`<div class="row click" onClick=${onClick}>
    <span class="cdot" style=${`--c:${c.c}`}>${(e.desc || c.name)[0].toUpperCase()}</span>
    <span class="grow"><span class="t">${e.desc || c.name}</span><span class="s">${sub}</span></span>
    <span class="amt">${zl(e.amount)}</span></div>`;
}

function Saldo({ d }) {
  return html`<div class="card"><div class="ct"><h2>Saldo między wami</h2>
    ${d && html`<button class="btn sm" onClick=${() => confirm(`${person(d.from)} oddaje ${person(d.to)} ${zl(d.amount)}?`) && put('settlements', { from: d.from, to: d.to, amount: d.amount, date: today() })}>Rozlicz</button>`}</div>
    ${d ? html`<div class="row"><span class="grow">${person(d.from)} → ${person(d.to)}</span><span class="amt">${zl(d.amount)}</span></div>`
      : html`<p class="empty">Jesteście kwita.</p>`}
    <p class="small muted">Liczą się wydatki z prywatnych kont, które dzielicie. Konto wspólne nie wpływa na saldo.</p></div>`;
}

export function ExpenseForm({ e, onClose }) {
  const me = getMe();
  const [f, setF] = useState({ amount: e.amount ? String(e.amount).replace('.', ',') : '', desc: e.desc || '', date: e.date || today(), cat: e.cat || 'spoz',
    account: e.account || 'wspolne', mode: e.private ? 'prywatne' : e.split && Math.abs((e.split[me] ?? .5) - .5) > .001 ? 'inaczej' : 'pol',
    otherPart: e.split ? String(Math.round(e.amount * (e.split[e.account === me ? other(me) : me] || 0) * 100) / 100).replace('.', ',') : '' });
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v?.target ? v.target.value : v }));
  const amount = num(f.amount);
  const payer = f.account, debtor = payer === 'julia' ? 'franek' : 'julia';
  const save = () => {
    if (!amount) return;
    const o = { ...e, amount, desc: f.desc.trim(), date: f.date, cat: f.cat, account: f.account, by: e.by || me, private: false, owner: undefined, split: undefined };
    if (f.account !== 'wspolne') {
      if (f.mode === 'prywatne') { o.private = true; o.owner = f.account; }
      else if (f.mode === 'inaczej') { const part = Math.min(amount, num(f.otherPart)); o.split = { [debtor]: part / amount, [payer]: 1 - part / amount }; }
      else o.split = { julia: .5, franek: .5 };
    }
    put('expenses', o); onClose();
  };
  return html`<${Sheet} title=${e.id ? 'Wydatek' : 'Nowy wydatek'} onClose=${onClose}><div class="form">
    <input class="amount-input" inputmode="decimal" placeholder="0,00 zł" value=${f.amount} onInput=${set('amount')} autofocus=${!e.id} />
    <${Field} label="Sklep / opis"><input value=${f.desc} onInput=${set('desc')} placeholder="np. Biedronka" /></${Field}>
    <${Chips} value=${f.desc} options=${SHOPS.map((s) => [s.name, s.name])} onChange=${(v) => setF((x) => ({ ...x, desc: v, cat: SHOPS.find((s) => s.name === v)?.cat || x.cat }))} />
    <${Field} label="Data"><input type="date" value=${f.date} onInput=${set('date')} /></${Field}>
    <${Field} label="Kategoria"><${Chips} value=${f.cat} onChange=${set('cat')} options=${CATS.map((c) => [c.id, c.name, c.c])} /></${Field}>
    <${Field} label="Z jakiego konta"><${Seg} value=${f.account} onChange=${set('account')} options=${[['wspolne', 'Wspólne'], [me, 'Moje'], [other(me), person(other(me))]]} /></${Field}>
    ${f.account !== 'wspolne' && html`<${Field} label="Podział">
      <${Seg} value=${f.mode} onChange=${set('mode')} options=${[['pol', 'Po połowie'], ['inaczej', 'Inaczej'], ...(f.account === me ? [['prywatne', 'Tylko moje']] : [])]} />
      ${f.mode === 'inaczej' && html`<div class="inline" style="align-items:center;margin-top:6px"><span style="flex:1;color:var(--ink);font-weight:500">Część ${personF(debtor, 'gen')}</span>
        <input style="width:130px" inputmode="decimal" value=${f.otherPart} onInput=${set('otherPart')} placeholder="0,00" /></div>`}
      <small>${f.mode === 'prywatne' ? 'Widzisz go tylko Ty. Nie wpływa na saldo.' : f.mode === 'pol' ? `${person(debtor)} odda ${zl(amount / 2)}.` : `${person(debtor)} odda ${zl(Math.min(amount, num(f.otherPart)))}.`}</small>
    </${Field}>`}
    <button class="btn primary block" onClick=${save} disabled=${!amount}>Zapisz</button>
    ${e.id && html`<button class="btn ghost block" onClick=${() => { if (confirm('Usunąć ten wydatek?')) { remove('expenses', e.id); onClose(); } }}><${Icon} n="trash" s=${18} /> Usuń</button>`}
  </div></${Sheet}>`;
}

function Budzet({ m }) {
  const b = cfg('budget', { limit: 0, cats: {} });
  const [dep, setDep] = useState(false);
  const shared = expensesIn(m).filter((e) => e.account === 'wspolne');
  const deps = list('deposits').filter((d) => monthOf(d.date) === m).sort((a, c) => c.date.localeCompare(a.date));
  const depSum = sum(deps, (d) => d.amount), spent = sum(shared, (e) => e.amount);
  const setLimit = (v) => setCfg('budget', { ...b, limit: num(v) });
  const setCat = (id, v) => setCfg('budget', { ...b, cats: { ...b.cats, [id]: num(v) || undefined } });
  return html`<div class="grid2"><div class="stack">
    <${Hero} m=${m} />
    <div class="card"><div class="ct"><h2>Limit miesięczny</h2></div>
      <div class="inline" style="align-items:center"><span style="flex:1">Konto wspólne</span>
        <input style="width:140px;text-align:right" inputmode="decimal" value=${b.limit || ''} onChange=${(e) => setLimit(e.target.value)} /> <span>zł</span></div></div>
    <div class="card"><div class="ct"><h2>Bilans konta wspólnego</h2><button class="btn sm" onClick=${() => setDep(true)}>+ Wpłata</button></div>
      <div class="kv"><span>Wpłaty</span><b>${zl(depSum)}</b></div><div class="kv"><span>Wydatki</span><b>${zl(spent)}</b></div>
      <div class="kv"><span>Zostało</span><b style=${depSum - spent < 0 ? 'color:var(--bad)' : ''}>${zl(depSum - spent)}</b></div>
      ${deps.map((d) => html`<div class="row"><${Dot} p=${d.who} /><span class="grow">${person(d.who)}<span class="s">${shortDate(d.date)}</span></span><span class="amt">${zl(d.amount)}</span>
        <button class="icon-btn sm" onClick=${() => confirm('Usunąć wpłatę?') && remove('deposits', d.id)} aria-label="Usuń"><${Icon} n="x" s=${16} /></button></div>`)}
    </div></div>
    <div class="card"><div class="ct"><h2>Limity kategorii</h2><span class="muted">opcjonalnie</span></div>
      ${CATS.map((c) => { const v = sum(shared.filter((e) => e.cat === c.id), (e) => e.amount), l = b.cats?.[c.id];
        return html`<div style="padding:8px 0;border-top:1px solid var(--line)"><div class="inline" style="align-items:center">
          <span class="cdot" style=${`--c:${c.c};width:12px;height:12px;border-radius:4px`} /><span style="flex:1">${c.name}<span class="s small muted"> · ${zl0(v)}</span></span>
          <input style="width:100px;text-align:right;padding:7px 10px" inputmode="decimal" placeholder="—" value=${l || ''} onChange=${(e) => setCat(c.id, e.target.value)} /></div>
          ${l > 0 && html`<div class=${'bar' + (v > l ? ' over' : '')} style="margin-top:6px;height:6px;background:var(--s2)"><i style=${`width:${Math.min(100, v / l * 100)}%`} /></div>`}</div>`; })}
    </div>
    ${dep && html`<${DepositForm} onClose=${() => setDep(false)} />`}
  </div>`;
}

function DepositForm({ onClose }) {
  const [a, setA] = useState(''), [who, setWho] = useState(getMe()), [date, setDate] = useState(today());
  return html`<${Sheet} title="Wpłata na konto wspólne" onClose=${onClose}><div class="form">
    <input class="amount-input" inputmode="decimal" placeholder="0,00 zł" value=${a} onInput=${(e) => setA(e.target.value)} autofocus />
    <${Seg} value=${who} onChange=${setWho} options=${[['julia', person('julia')], ['franek', person('franek')]]} />
    <input type="date" value=${date} onInput=${(e) => setDate(e.target.value)} />
    <button class="btn primary block" disabled=${!num(a)} onClick=${() => { put('deposits', { amount: num(a), who, date }); onClose(); }}>Zapisz</button></div></${Sheet}>`;
}

function Raport({ m }) {
  const [only, setOnly] = useState('all');
  const filt = (arr) => (only === 'all' ? arr : arr.filter((e) => e.account === 'wspolne'));
  const ex = filt(expensesIn(m)), prev = filt(expensesIn(addMonths(m, -1)));
  const total = sum(ex, (e) => e.amount), ptotal = sum(prev, (e) => e.amount);
  const isNow = monthOf(today()) === m, days = isNow ? +today().slice(8) : daysInMonth(m);
  const fc = isNow ? forecast(m, total) : total;
  const byCat = Object.entries(groupBy(ex, (e) => e.cat)).map(([k, v]) => [k, sum(v, (e) => e.amount)]).sort((a, b) => b[1] - a[1]);
  const byDay = Object.entries(groupBy(ex, (e) => e.date)).map(([k, v]) => [k, sum(v, (e) => e.amount)]).sort((a, b) => b[1] - a[1]);
  const big = [...ex].sort((a, b) => b.amount - a.amount)[0];
  const shops = Object.entries(groupBy(ex.filter((e) => e.desc), (e) => e.desc)).sort((a, b) => b[1].length - a[1].length)[0];
  const pc = groupBy(prev, (e) => e.cat);
  const facts = [
    byCat[0] && ['tag', `Najwięcej poszło na ${cat(byCat[0][0]).name}: ${zl0(byCat[0][1])} (${Math.round(byCat[0][1] / total * 100)}%).`],
    byDay[0] && ['cal', `Najdroższy dzień: ${longDate(byDay[0][0]).toLowerCase()}, ${zl0(byDay[0][1])}.`],
    big && ['wallet', `Największy wydatek: ${big.desc || cat(big.cat).name}, ${zl0(big.amount)}.`],
    shops && shops[1].length > 1 && ['cart', `Najczęściej: ${shops[0]}, ${shops[1].length} razy, razem ${zl0(sum(shops[1], (e) => e.amount))}.`],
    ptotal > 0 && ['swap', `${total > ptotal ? 'Więcej' : 'Mniej'} niż w poprzednim miesiącu o ${zl0(Math.abs(total - ptotal))}${isNow ? ' (do dziś)' : ''}.`],
  ].filter(Boolean);
  return html`<div class="stack">
    <${Seg} small value=${only} onChange=${setOnly} options=${[['all', 'Wszystkie wydatki'], ['shared', 'Konto wspólne']]} />
    <div class="grid2"><div class="stack">
      <div class="hero"><span class="lbl">Wydatki</span><div class="big">${zl0(total)}</div>
        <span class="lbl">${ex.length} wydatków${isNow ? ` · prognoza na koniec miesiąca ~${zl0(fc)}` : ''}</span></div>
      <div class="stat"><div class="card"><span class="small muted">Dziennie średnio</span><b>${zl0(total / Math.max(1, days))}</b></div>
        <div class="card"><span class="small muted">Poprzedni miesiąc</span><b>${zl0(ptotal)}</b></div></div>
      ${facts.length > 0 && html`<div class="card">${facts.map(([i, t]) => html`<div class="row"><${Icon} n=${i} s=${20} /><span class="grow">${t}</span></div>`)}</div>`}
    </div>
    <div class="card"><div class="ct"><h2>Kategorie vs poprzedni miesiąc</h2></div>
      ${byCat.map(([k, v]) => { const p = sum(pc[k] || [], (e) => e.amount), dlt = v - p;
        return html`<div class="row"><span class="cdot" style=${`--c:${cat(k).c};width:12px;height:12px;border-radius:4px`} /><span class="grow">${cat(k).name}</span>
          <span class="amt">${zl0(v)}</span><span class=${'pill ' + (dlt > 0 ? 'warn' : 'ok')} style="min-width:74px;text-align:center">${dlt > 0 ? '+' : ''}${zl0(dlt)}</span></div>`; })}
      ${!byCat.length && html`<${Empty}>Brak danych.</${Empty}>`}
    </div></div></div>`;
}

function Cykliczne() {
  const [edit, setEdit] = useState(null);
  const rs = list('recurring').sort((a, b) => a.day - b.day), m = monthOf(today());
  return html`<div class="stack">
    <button class="btn primary block" onClick=${() => setEdit({})}><${Icon} n="plus" s=${20} /> Nowy wydatek cykliczny</button>
    ${rs.length > 0 && html`<p class="muted">Razem ${zl(sum(rs, (r) => r.amount))} miesięcznie.</p>`}
    <div class="card">${rs.map((r) => { const paid = r.paid?.[m], due = dueDate(r, m), late = !paid && diffDays(today(), due) < 0;
      return html`<div class="row">
        <span class="cdot" style=${`--c:${cat(r.cat).c}`}>${r.name[0]}</span>
        <span class="grow click" onClick=${() => setEdit(r)}><span class="t">${r.name}</span><span class="s">${r.day}. dnia · ${accLabel(r.account)}</span></span>
        <span style="text-align:right"><span class="amt">${zl(r.amount)}</span><br/>
          ${paid ? html`<span class="small" style="color:var(--ok)">✓ zapłacone</span>` : html`<button class=${'btn sm ' + (late ? 'primary' : '')} style="margin-top:4px" onClick=${() => payRecurring(r, m)}>${late ? 'Po terminie · zapłać' : 'Zapłacone'}</button>`}</span></div>`; })}
      ${!rs.length && html`<${Empty}>Dodaj czynsz, internet, Netflix, telefon… Przypomnę na ekranie Start na tydzień przed terminem.</${Empty}>`}</div>
    ${edit && html`<${RecForm} r=${edit} onClose=${() => setEdit(null)} />`}
  </div>`;
}

function RecForm({ r, onClose }) {
  const [f, setF] = useState({ name: r.name || '', amount: r.amount ? String(r.amount).replace('.', ',') : '', day: r.day || 10, cat: r.cat || 'mieszk', account: r.account || 'wspolne' });
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v?.target ? v.target.value : v }));
  const ok = f.name.trim() && num(f.amount);
  return html`<${Sheet} title=${r.id ? 'Wydatek cykliczny' : 'Nowy wydatek cykliczny'} onClose=${onClose}><div class="form">
    <${Field} label="Nazwa"><input value=${f.name} onInput=${set('name')} placeholder="np. Czynsz" autofocus /></${Field}>
    <div class="inline"><${Field} label="Kwota"><input inputmode="decimal" value=${f.amount} onInput=${set('amount')} /></${Field}>
      <${Field} label="Dzień miesiąca"><input type="number" min="1" max="31" value=${f.day} onInput=${set('day')} /></${Field}></div>
    <${Field} label="Kategoria"><${Chips} value=${f.cat} onChange=${set('cat')} options=${CATS.map((c) => [c.id, c.name, c.c])} /></${Field}>
    <${Field} label="Konto"><${Seg} value=${f.account} onChange=${set('account')} options=${[['wspolne', 'Wspólne'], ['julia', person('julia')], ['franek', person('franek')]]} /></${Field}>
    <button class="btn primary block" disabled=${!ok} onClick=${() => { put('recurring', { ...r, name: f.name.trim(), amount: num(f.amount), day: Math.max(1, Math.min(31, +f.day || 1)), cat: f.cat, account: f.account }); onClose(); }}>Zapisz</button>
    ${r.id && html`<button class="btn ghost block" onClick=${() => { if (confirm('Usunąć?')) { remove('recurring', r.id); onClose(); } }}>Usuń</button>`}
  </div></${Sheet}>`;
}
