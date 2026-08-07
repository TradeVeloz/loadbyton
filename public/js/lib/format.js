export const money = (n) => 'AED ' + Number(n || 0).toLocaleString('en-US');
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function timeAgo(t) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.round(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.round(h / 24) + 'd ago';
}

export function countdown(t) {
  const s = Math.max(0, Math.round((t - Date.now()) / 1000));
  if (s <= 0) return 'closing';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function initials(n) {
  return String(n || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

const PALETTE = ['#0B0E14', '#E85D0C', '#067A46', '#2E5FD9', '#0B3B66', '#7C3AED'];
export function colorFor(s) {
  let h = 0;
  for (const c of String(s || '')) h = c.charCodeAt(0) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export const plural = (n, word, pluralWord = word + 's') => `${n} ${n === 1 ? word : pluralWord}`;

export function fileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}
