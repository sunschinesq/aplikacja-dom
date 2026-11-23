import { h } from './vendor/preact.module.js';
import { useEffect, useRef } from './vendor/hooks.module.js';
import htm from './vendor/htm.module.js';
import { monthLabel, addMonths } from './util.js';
import { person } from './store.js';
export const html = htm.bind(h);

const P = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 15h2"/>',
  cart: '<path d="M3 4h2l2.4 11h10.2L20 8H6.2"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
  fork: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 3c-2 2-2 6 0 8v10"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  left: '<path d="M15 5l-7 7 7 7"/>', right: '<path d="M9 5l7 7-7 7"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  cat: '<path d="M5 20c0-6 1-9 2-11L6 4l4 3h4l4-3-1 5c1 2 2 5 2 11z"/><circle cx="10" cy="13" r=".6"/><circle cx="14" cy="13" r=".6"/>',
  broom: '<path d="M14 3l-4 9M7 12h7l3 9H4z"/>', heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
  bolt: '<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>', shield: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9.5h18"/>', box: '<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8" r="1.2"/>', camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  play: '<circle cx="12" cy="12" r="8"/><path d="M10 9l5 3-5 3z"/>', bowl: '<path d="M3 11h18a9 9 0 0 1-18 0zM8 7c0-1 1-1 1-2M12 7c0-1 1-1 1-2M16 7c0-1 1-1 1-2"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20h4"/>', mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  swap: '<path d="M7 7h11l-3-3M17 17H6l3 3"/>', clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
};
export const Icon = ({ n, s = 22 }) => html`<svg class="ic" width=${s} height=${s} viewBox="0 0 24 24" dangerouslySetInnerHTML=${{ __html: P[n] || '' }} />`;

export function Sheet({ title, onClose, children, wide }) {
  const ref = useRef();
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k); document.body.classList.add('locked');
    return () => { removeEventListener('keydown', k); document.body.classList.remove('locked'); };
  }, []);
  return html`<div class="sheet-bg" onClick=${(e) => e.target === e.currentTarget && onClose()}>
    <div class=${'sheet' + (wide ? ' wide' : '')} ref=${ref} role="dialog" aria-label=${title}>
      <div class="sheet-head"><h2>${title}</h2><button class="icon-btn" onClick=${onClose} aria-label="Zamknij"><${Icon} n="x" /></button></div>
      <div class="sheet-body">${children}</div>
    </div></div>`;
}

export const Seg = ({ options, value, onChange, small }) => html`<div class=${'seg' + (small ? ' small' : '')} role="tablist">
  ${options.map(([v, l]) => html`<button role="tab" aria-selected=${v === value} class=${v === value ? 'on' : ''} onClick=${() => onChange(v)}>${l}</button>`)}</div>`;

export const Chips = ({ options, value, onChange, multi }) => html`<div class="chips">
  ${options.map(([v, l, c]) => { const on = multi ? value.includes(v) : v === value;
    return html`<button type="button" class=${'chip' + (on ? ' on' : '')} style=${c ? `--chip:${c}` : ''} onClick=${() => onChange(multi ? (on ? value.filter((x) => x !== v) : [...value, v]) : v)}>${c && html`<i class="sw" />`}${l}</button>`; })}</div>`;

export const MonthNav = ({ m, set }) => html`<div class="monthnav">
  <button class="icon-btn soft" onClick=${() => set(addMonths(m, -1))} aria-label="Poprzedni miesiąc"><${Icon} n="left" /></button>
  <b>${monthLabel(m)}</b>
  <button class="icon-btn soft" onClick=${() => set(addMonths(m, 1))} aria-label="Następny miesiąc"><${Icon} n="right" /></button></div>`;

export const Dot = ({ p }) => html`<i class=${'dot ' + p} title=${person(p)} />`;
export const Who = ({ p }) => html`<span class="who"><${Dot} p=${p} />${person(p)}</span>`;
export const Empty = ({ children }) => html`<p class="empty">${children}</p>`;
export const Field = ({ label, children, hint }) => html`<label class="field"><span>${label}</span>${children}${hint && html`<small>${hint}</small>`}</label>`;
export const Page = ({ title, back, children, action }) => html`<div class="page">
  <header class="ph">${back && html`<a class="icon-btn" href=${back} aria-label="Wstecz"><${Icon} n="left" /></a>`}<h1>${title}</h1>${action}</header>${children}</div>`;
export const Fab = ({ onClick, children }) => html`<button class="fab" onClick=${onClick}><${Icon} n="plus" />${children}</button>`;
