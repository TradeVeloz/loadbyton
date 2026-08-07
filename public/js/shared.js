import { svg } from './lib/icons.js';
import { esc } from './lib/format.js';

const el = (id) => document.getElementById(id);

export function toast(msg, kind = 'ok') {
  const w = el('toasts');
  const t = document.createElement('div');
  t.className = 'toast' + (kind === 'err' ? ' err' : '');
  t.innerHTML = `<span class="k">${svg(kind === 'err' ? 'x' : 'check', 14)}</span>${esc(msg)}`;
  w.appendChild(t);
  setTimeout(() => {
    t.style.transition = '.3s';
    t.style.opacity = '0';
    t.style.transform = 'translateY(10px)';
    setTimeout(() => t.remove(), 300);
  }, 3200);
}

let lastFocus = null;
export function openSheet(html) {
  lastFocus = document.activeElement;
  const o = el('ov');
  o.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  o.classList.add('show');
  document.body.style.overflow = 'hidden';
  const f = o.querySelector('input,select,textarea,button');
  if (f) setTimeout(() => f.focus(), 60);
}
export function closeSheet() {
  const o = el('ov');
  o.classList.remove('show');
  o.innerHTML = '';
  document.body.style.overflow = '';
  if (lastFocus) lastFocus.focus();
}
el('ov')?.addEventListener('click', (e) => { if (e.target === el('ov')) closeSheet(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && el('ov').classList.contains('show')) closeSheet(); });

const BADGES = {
  open: ['t-open', 'Open for bids'],
  awarded: ['t-awarded', 'Awarded'],
  transit: ['t-transit', 'In transit'],
  delivered: ['t-delivered', 'Delivered'],
  submitted: ['t-open', 'Submitted'],
  won: ['t-won', 'Won'],
  lost: ['t-lost', 'Not selected'],
  pending: ['t-pending', 'Pending review'],
  active: ['t-live', 'Active'],
  rejected: ['t-rejected', 'Rejected'],
  resolved: ['t-delivered', 'Resolved'],
};
export function badge(status) {
  const [cls, label] = BADGES[status] || ['tag', status];
  return `<span class="tag ${cls} dot">${label}</span>`;
}

export function emptyState(icon, title, text) {
  return `<div class="empty"><div class="ei">${svg(icon, 28)}</div><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`;
}

export function skeletonTiles(n = 4) {
  return `<div class="tiles">${Array.from({ length: n }).map(() => '<div class="skel skel-tile"></div>').join('')}</div>`;
}
export function skeletonRows(n = 3) {
  return `<div class="list">${Array.from({ length: n }).map(() => '<div class="skel skel-row"></div>').join('')}</div>`;
}

export function errorBanner(message) {
  return `<div class="banner banner-err">${svg('x', 16)}<span>${esc(message)}</span></div>`;
}

let activePoll = null;
export function clearPoll() { if (activePoll) clearInterval(activePoll); activePoll = null; }
export function setPoll(fn, ms) { clearPoll(); activePoll = setInterval(fn, ms); }
