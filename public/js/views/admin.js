import { api } from '../api.js';
import { svg } from '../lib/icons.js';
import { money, esc, timeAgo, initials, colorFor } from '../lib/format.js';
import { toast, badge, emptyState, skeletonTiles, skeletonRows, errorBanner, clearPoll } from '../shared.js';
import { go } from '../app.js';

function regRow(reg) {
  return `<div class="row"><div class="av" style="width:44px;height:44px;font-size:15px;background:${colorFor(reg.company_name)}">${initials(reg.company_name)}</div>
    <div class="m"><b>${esc(reg.company_name)}</b><small>${reg.role === 'cargo' ? 'Cargo / Shipper' : 'Transport Company'} · ${esc(reg.contact_name)} · TRN ${esc(reg.trn || '—')}${reg.fleet_desc ? ' · ' + esc(reg.fleet_desc) : ''}</small><small style="color:var(--muted-2)">Applied ${timeAgo(reg.created_at)}</small></div>
    <div style="display:flex;gap:8px"><button class="btn btn-green btn-sm" onclick="LB.admin.approve('${reg.id}')">${svg('check', 14)} Approve</button><button class="btn btn-light btn-sm" onclick="LB.admin.reject('${reg.id}')">Reject</button></div></div>`;
}
function tkRow(t) {
  return `<div class="row"><div class="av" style="width:42px;height:42px;font-size:14px;background:${colorFor(t.from_label)}">${initials(t.from_label)}</div>
    <div class="m"><b style="font-size:14.5px">${esc(t.subject)}</b><small>${esc(t.from_label)} · ${t.role_label} · ${timeAgo(t.created_at)}</small></div>
    ${t.status === 'open' ? `<button class="btn btn-ink btn-sm" onclick="LB.admin.resolve('${t.id}')">Resolve</button>` : badge('resolved')}</div>`;
}

export async function dash(view) {
  clearPoll();
  view.innerHTML = `<div class="head"><div><div class="kicker">Operations</div><h1>Control room</h1></div></div>${skeletonTiles(4)}${skeletonRows(2)}`;
  try {
    const [{ members, pending, openReq, gmv }, { registrations }, { tickets }] = await Promise.all([api.adminOverview(), api.adminRegistrations(), api.adminTickets()]);
    const openTickets = tickets.filter((t) => t.status === 'open');
    view.innerHTML = `<div class="head"><div><div class="kicker">Operations</div><h1>Control room</h1><p>Marketplace health at a glance.</p></div></div>
    <div class="tiles">
      <div class="tile"><div class="ic">${svg('users', 18)}</div><div class="v">${members}</div><div class="k">Active members</div><div class="d">${svg('bolt', 12)} verified</div></div>
      <div class="tile"><div class="ic">${svg('shield', 18)}</div><div class="v">${pending}</div><div class="k">Pending approvals</div><div class="d">Needs review</div></div>
      <div class="tile"><div class="ic">${svg('box', 18)}</div><div class="v">${openReq}</div><div class="k">Live requirements</div><div class="d">Receiving bids</div></div>
      <div class="tile"><div class="ic">${svg('cash', 18)}</div><div class="v">${money(gmv)}</div><div class="k">GMV (awarded)</div><div class="d">${svg('bolt', 12)} lifetime</div></div>
    </div>
    <div class="sec"><h2>Pending approvals</h2><a onclick="LB.go('approvals')">Review all</a></div>
    ${registrations.slice(0, 2).map(regRow).join('') || '<p style="color:var(--muted)">All caught up.</p>'}
    <div class="sec"><h2>Open support tickets</h2><a onclick="LB.go('support')">Support</a></div>
    ${openTickets.length ? openTickets.map(tkRow).join('') : '<p style="color:var(--muted)">No open tickets.</p>'}`;
  } catch (e) { view.innerHTML = errorBanner(e.message); }
}

export async function approvals(view) {
  clearPoll();
  view.innerHTML = `<div class="head"><div><div class="kicker">Approvals</div><h1>New registrations</h1></div></div>${skeletonRows(3)}`;
  try {
    const { registrations } = await api.adminRegistrations();
    view.innerHTML = `<div class="head"><div><div class="kicker">Approvals</div><h1>New registrations</h1><p>Verify TRN &amp; fleet before granting access.</p></div></div>
    ${registrations.length ? registrations.map(regRow).join('') : emptyState('shield', 'No pending approvals', 'New applications show up here for review.')}`;
  } catch (e) { view.innerHTML = errorBanner(e.message); }
}
export async function approve(id) {
  try { await api.approveRegistration(id); toast('Member approved'); go('approvals'); }
  catch (e) { toast(e.message || 'Could not approve', 'err'); }
}
export async function reject(id) {
  try { await api.rejectRegistration(id); toast('Application rejected'); go('approvals'); }
  catch (e) { toast(e.message || 'Could not reject', 'err'); }
}

export async function members(view) {
  clearPoll();
  view.innerHTML = `<div class="head"><div><div class="kicker">Members</div><h1>Loading…</h1></div></div>${skeletonRows(3)}`;
  try {
    const { members: rows } = await api.adminMembers();
    view.innerHTML = `<div class="head"><div><div class="kicker">Members</div><h1>${rows.length} verified members</h1><p>Shippers and carriers on Loadbyton.</p></div></div>
    ${rows.length ? rows.map((m) => `<div class="row"><div class="av" style="width:44px;height:44px;font-size:15px;background:${colorFor(m.company_name)}">${initials(m.company_name)}</div><div class="m"><b>${esc(m.company_name)}</b><small>${m.role === 'cargo' ? 'Cargo / Shipper' : 'Transport Company'}${m.rating ? ` · ★ ${m.rating} · ${m.trips} trips` : ''}${m.fleet_desc ? ' · ' + esc(m.fleet_desc) : ''}</small></div><span class="tag t-live dot">Active</span></div>`).join('') : emptyState('users', 'No members yet', 'Approved companies appear here.')}`;
  } catch (e) { view.innerHTML = errorBanner(e.message); }
}

export async function support(view) {
  clearPoll();
  view.innerHTML = `<div class="head"><div><div class="kicker">Support</div><h1>Loading…</h1></div></div>${skeletonRows(3)}`;
  try {
    const { tickets } = await api.adminTickets();
    const open = tickets.filter((t) => t.status === 'open'), closed = tickets.filter((t) => t.status !== 'open');
    view.innerHTML = `<div class="head"><div><div class="kicker">Support</div><h1>Help &amp; support</h1><p>Respond to shippers and carriers.</p></div></div>
    <div class="sec"><h2>Open (${open.length})</h2></div>${open.map(tkRow).join('') || '<p style="color:var(--muted)">No open tickets.</p>'}
    <div class="sec"><h2>Resolved</h2></div>${closed.map(tkRow).join('') || '<p style="color:var(--muted)">Nothing resolved yet.</p>'}`;
  } catch (e) { view.innerHTML = errorBanner(e.message); }
}
export async function resolve(id) {
  try { await api.resolveTicket(id); toast('Ticket resolved'); go('support'); }
  catch (e) { toast(e.message || 'Could not resolve', 'err'); }
}

export const actions = { approve, reject, resolve };
