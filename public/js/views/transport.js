import { api } from '../api.js';
import { svg } from '../lib/icons.js';
import { money, esc, timeAgo, countdown, initials, colorFor, fileSize, plural } from '../lib/format.js';
import { toast, openSheet, closeSheet, badge, emptyState, skeletonTiles, skeletonRows, errorBanner, clearPoll, setPoll } from '../shared.js';
import { go, state } from '../app.js';

const el = (id) => document.getElementById(id);
let marketFilter = 'All loads';
let bidReqId = null;
let activeJob = null;

async function visibleRequirements() {
  const { requirements } = await api.requirements();
  return requirements;
}

function transCard(r, myBid) {
  const close = `<span class="tag ${(r.bid_ends_at - Date.now()) < 2 * 3600e3 ? 't-urgent' : 't-open'} dot" data-close="${r.bid_ends_at}">${svg('clock', 12)} ${countdown(r.bid_ends_at)} left</span>`;
  return `<div class="rq">
    <div class="rq-h"><div class="ic">${svg('box', 22)}</div>
      <div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span class="rq-id">${r.id}</span> <span class="tag">${r.container_type}</span> ${r.special !== 'Standard dry' ? `<span class="tag t-transit">${esc(r.special)}</span>` : ''} ${close}</div>
        <div class="rq-sub">${esc(r.container_no)} · posted ${timeAgo(r.created_at)}</div></div></div>
    <div class="rq-route"><div class="pt"><small>Pickup</small><b>Jebel Ali T2</b></div><div class="dots">${svg('arrow', 14)}</div><div class="pt" style="text-align:right"><small>Drop-off</small><b>${esc(r.drop_off)}</b></div></div>
    <div class="rq-meta"><span class="tag">${svg('clock', 13)} Ready ${esc(r.ready_at || '—')}</span><span class="tag">Deadline ${esc(r.deadline || '—')}</span><span class="tag">Budget ~${money(r.budget)}</span></div>
    <div class="rq-f"><span class="bc">${plural(r.bid_count, 'carrier')} bidding</span><span class="sp"></span>
      ${myBid ? `<span class="tag t-open dot">Your bid: ${money(myBid.price)}</span>` : `<button class="btn btn-ink btn-sm" onclick="LB.transport.openBidSheet('${r.id}')">${svg('gavel', 15)} Place bid</button>`}</div>
  </div>`;
}

async function myBidMap() {
  const { bids } = await api.myBids();
  const map = {};
  for (const b of bids) map[b.requirement_id] = b;
  return map;
}

export async function dash(view) {
  clearPoll();
  view.innerHTML = `<div class="head"><div><div class="kicker">Good afternoon</div><h1 class="skel" style="height:32px;width:220px;border-radius:8px"></h1></div></div>${skeletonTiles(4)}${skeletonRows(2)}`;
  try {
    const reqs = await visibleRequirements();
    const open = reqs.filter((r) => r.status === 'open');
    const mine = await myBidMap();
    const wonCount = Object.values(mine).filter((b) => b.status === 'won').length;
    const activeBids = Object.values(mine).filter((b) => b.status === 'submitted').length;
    view.innerHTML = `<div class="head"><div><div class="kicker">Good afternoon</div><h1>${esc(state.user.company_name)}</h1><p>${open.length} open loads near Jebel Ali · ★ ${state.user.rating ?? '—'}</p></div>
      <button class="btn btn-ink" onclick="LB.go('market')">${svg('box', 18)} Browse loads</button></div>
      <div class="tiles">
        <div class="tile"><div class="ic">${svg('box', 18)}</div><div class="v">${open.length}</div><div class="k">Open loads</div><div class="d">${svg('bolt', 12)} Matching fleet</div></div>
        <div class="tile"><div class="ic">${svg('gavel', 18)}</div><div class="v">${activeBids}</div><div class="k">Active bids</div><div class="d">Awaiting award</div></div>
        <div class="tile"><div class="ic">${svg('truck', 18)}</div><div class="v">${wonCount}</div><div class="k">Jobs won</div><div class="d">All time</div></div>
        <div class="tile"><div class="ic">${svg('cash', 18)}</div><div class="v">${state.user.trips || 0}</div><div class="k">Total trips</div><div class="d">${svg('bolt', 12)} Track record</div></div>
      </div>
      <div class="sec"><h2>Fresh loads to bid on</h2><a onclick="LB.go('market')">See all</a></div>
      <div class="list">${open.length ? open.slice(0, 3).map((r) => transCard(r, mine[r.id])).join('') : emptyState('box', 'No open loads right now', 'New requirements appear here the moment shippers post them.')}</div>`;
  } catch (e) { view.innerHTML = errorBanner(e.message); }
}

export async function market(view) {
  clearPoll();
  view.innerHTML = `<div class="head"><div><div class="kicker">Open loads</div><h1>Loading…</h1></div></div>${skeletonRows(3)}`;
  try {
    const reqs = await visibleRequirements();
    let open = reqs.filter((r) => r.status === 'open');
    const f = marketFilter;
    if (f !== 'All loads') open = open.filter((r) => (f === 'Reefer' ? /reefer/i.test(r.container_type + r.special) : f === 'Hazmat' ? /hazmat/i.test(r.special) : r.container_type === f));
    const mine = await myBidMap();
    const filters = ['All loads', '20ft', '40ft HC', 'Reefer', 'Hazmat'];
    view.innerHTML = `<div class="head"><div><div class="kicker">Open loads</div><h1>${open.length} load${open.length !== 1 ? 's' : ''} available</h1><p>Bid on what fits your fleet and schedule.</p></div></div>
    <div class="pills">${filters.map((x) => `<button class="pill ${marketFilter === x ? 'on' : ''}" onclick="LB.transport.setFilter('${x}')">${x}</button>`).join('')}</div>
    ${open.length ? `<div class="list">${open.map((r) => transCard(r, mine[r.id])).join('')}</div>` : emptyState('box', 'No loads match', 'Try a different filter — new loads arrive in real time.')}`;
  } catch (e) { view.innerHTML = errorBanner(e.message); }
}
export function setFilter(f) { marketFilter = f; go('market'); }

export function openBidSheet(reqId) {
  bidReqId = reqId;
  api.requirements().then(({ requirements }) => {
    const r = requirements.find((x) => x.id === reqId);
    api.bids(reqId).then(({ bids }) => {
      const low = bids.length ? Math.min(...bids.map((b) => b.price)) : r.budget;
      openSheet(`<div class="grab"></div><div class="sheet-h"><h3>Place your bid</h3><button class="x" onclick="LB.shared.closeSheet()" aria-label="Close">${svg('x', 16)}</button></div>
      <div class="sheet-b">
        <div id="bid-err"></div>
        <div class="card pad" style="background:var(--bg);border:none;margin-bottom:18px">
          <div class="rq-route" style="padding:0"><div class="pt"><small>Container</small><b>${esc(r.container_no)} · ${r.container_type}</b></div><div class="dots">${svg('arrow', 14)}</div><div class="pt" style="text-align:right"><small>Drop-off</small><b>${esc(r.drop_off)}</b></div></div>
          <div class="rq-meta" style="padding:12px 0 0"><span class="tag">Ready ${esc(r.ready_at || '—')}</span><span class="tag">${esc(r.special)}</span><span class="tag t-accent">${plural(bids.length, 'bid')} · low ${money(low)}</span></div>
        </div>
        <div class="fgrid">
          <div class="f"><label>Your price (AED)</label><input id="b-price" type="number" value="${Math.max(1, low - 40)}"><span class="hint">Current lowest: ${money(low)}</span></div>
          <div class="f"><label>Pickup availability</label><select id="b-eta"><option>1 hr</option><option selected>2 hrs</option><option>4 hrs</option><option>Tomorrow AM</option></select></div>
        </div>
        <div class="f full" style="margin-top:15px"><label>Truck / equipment</label><input id="b-truck" value="40ft chassis, insured"></div>
        <div class="f full" style="margin-top:15px"><label>Note to shipper <span class="hint">optional</span></label><textarea id="b-note" placeholder="Why you're the best fit…"></textarea></div>
      </div>
      <div class="sheet-f"><button class="btn btn-light" onclick="LB.shared.closeSheet()">Cancel</button><button class="btn btn-ink btn-block" id="bid-submit" onclick="LB.transport.submitBid()">Submit bid</button></div>`);
    });
  });
}

export async function submitBid() {
  const btn = el('bid-submit');
  btn.disabled = true;
  el('bid-err').innerHTML = '';
  try {
    const price = Number(el('b-price').value);
    await api.placeBid(bidReqId, { price, eta: el('b-eta').value, truck_desc: el('b-truck').value.trim(), note: el('b-note').value.trim() });
    closeSheet();
    toast(`Bid of ${money(price)} placed`);
    go('mybids');
  } catch (e) {
    el('bid-err').innerHTML = errorBanner(e.message);
    btn.disabled = false;
  }
}

export async function mybids(view) {
  clearPoll();
  view.innerHTML = `<div class="head"><div><div class="kicker">My bids</div><h1>Loading…</h1></div></div>${skeletonRows(3)}`;
  try {
    const { bids } = await api.myBids();
    if (!bids.length) { view.innerHTML = emptyState('gavel', 'No bids yet', 'Browse open loads and place your first bid.'); return; }
    view.innerHTML = `<div class="head"><div><div class="kicker">My bids</div><h1>Bid activity</h1><p>Track what you've quoted and won.</p></div></div>
    ${bids.map((b) => { const r = b.requirement; return `<div class="opt" style="cursor:default">
      <div class="logo" style="background:${colorFor(r.id)}">${svg('box', 18)}</div>
      <div style="flex:1;min-width:0"><div class="nm">${r.id} ${badge(b.status)}</div><div class="mt"><span>${esc(r.container_no)} · ${r.container_type}</span><span>${svg('pin', 12)} ${esc(r.drop_off)}</span></div></div>
      <div class="price"><div class="a">${money(b.price)}</div><div class="s">pickup ${esc(b.eta)}</div></div>
      ${b.status === 'won' ? `<button class="btn btn-ink btn-sm" onclick="LB.go('jobs')">Open</button>` : b.status === 'lost' ? `<span class="tag t-lost">Not selected</span>` : `<span class="tag t-awarded dot">Awaiting</span>`}</div>`; }).join('')}`;
  } catch (e) { view.innerHTML = errorBanner(e.message); }
}

async function myWonJobs() {
  const { bids } = await api.myBids();
  return bids.filter((b) => b.status === 'won').map((b) => ({ r: b.requirement, b }));
}

export async function jobs(view) {
  clearPoll();
  view.innerHTML = `<div class="head"><div><div class="kicker">Won jobs</div><h1>Loading…</h1></div></div>${skeletonRows(2)}`;
  try {
    const rows = await myWonJobs();
    if (!rows.length) { view.innerHTML = emptyState('truck', 'No won jobs yet', 'Awarded jobs and their documents appear here.'); return; }
    if (!activeJob || !rows.find((x) => x.r.id === activeJob)) activeJob = rows[0].r.id;
    await renderJobs(view, rows);
    setPoll(() => renderJobsLive(), 4000);
  } catch (e) { view.innerHTML = errorBanner(e.message); }
}

async function renderJobs(view, rows) {
  const parts = await Promise.all(rows.map(async ({ r, b }) => {
    const { documents: docs } = await api.documents(r.id);
    const { messages: msgs } = await api.messages(r.id);
    return { r, b, docs, msgs };
  }));
  view.innerHTML = `<div class="head"><div><div class="kicker">Won jobs</div><h1>Jobs in progress</h1><p>Collect documents and coordinate delivery.</p></div></div>
  ${parts.map(({ r, b, docs, msgs }) => `<div class="card pad" style="margin-bottom:15px">
      <div class="driver" style="border:none;padding:0;margin-bottom:15px"><div class="av2" style="width:48px;height:48px;font-size:15px;background:var(--navy)">${svg('truck', 22)}</div>
        <div style="flex:1"><div class="nm" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${r.id} ${badge(r.status === 'delivered' ? 'delivered' : r.status === 'transit' ? 'transit' : 'awarded')}</div><div class="mt">${esc(r.container_no)} · ${r.container_type} · to ${esc(r.drop_off)}</div></div>
        <div class="price"><div class="a">${money(b.price)}</div><div class="s">agreed</div></div></div>
      <div style="font-size:13.5px;font-weight:700;color:var(--muted);margin-bottom:9px">Documents from shipper</div>
      <div id="jobdocs-${r.id}">${docs.length ? docs.map((d) => `<div class="doc"><div class="fi">${svg('doc', 18)}</div><div class="m"><b>${esc(d.name)}</b><small>${fileSize(d.size_bytes)} · from shipper</small></div><a class="btn btn-light btn-sm" href="${api.documentDownloadUrl(r.id, d.id)}">${svg('download', 14)}</a></div>`).join('') : '<div style="font-size:13.5px;color:var(--muted-2);font-weight:500">Waiting for customs papers…</div>'}</div>
      <details style="margin-top:14px" ${activeJob === r.id ? 'open' : ''}><summary style="cursor:pointer;font-weight:700;font-size:14px;color:var(--ink)">${svg('chat', 14)} Message shipper ${msgs.length ? `(${msgs.length})` : ''}</summary>
        <div class="card" style="overflow:hidden;margin-top:12px"><div class="chat" style="height:320px">
          <div class="chat-b" id="jobchat-${r.id}">${msgs.length ? msgs.map((m) => m.doc_name ? `<div class="msg doc"><div class="fi">${svg('doc', 16)}</div><div><b style="font-size:13px">${esc(m.doc_name)}</b></div></div>` : `<div class="msg ${m.is_cargo_side ? 'them' : 'me'}">${esc(m.text)}<small>${esc(m.sender_label)} · ${timeAgo(m.created_at)}</small></div>`).join('') : `<div style="margin:auto;text-align:center;color:var(--muted-2);font-size:13px;font-weight:500">Start the conversation.</div>`}</div>
          <div class="chat-i"><input id="jobinput-${r.id}" placeholder="Message the shipper…"><button class="snd" onclick="LB.transport.sendJobMsg('${r.id}')">${svg('send', 18)}</button></div>
        </div></div>
      </details>
    </div>`).join('')}`;
}

export async function sendJobMsg(reqId) {
  const inp = el(`jobinput-${reqId}`);
  const text = inp.value.trim();
  if (!text) return;
  inp.value = '';
  try {
    await api.sendMessage(reqId, text);
    await renderJobsLive();
  } catch (e) { toast(e.message || 'Could not send message', 'err'); }
}

async function renderJobsLive() {
  const view = el('view');
  if (!view) return;
  try {
    const rows = await myWonJobs();
    if (rows.length) await renderJobs(view, rows);
  } catch { /* transient poll failure, ignore */ }
}

export async function help(view) {
  clearPoll();
  const faqs = [
    ['How do I place a bid?', 'Open a load from "Open Loads" and tap "Place bid" — set your price and pickup availability.'],
    ['How do I get paid?', 'Settlement runs through Loadbyton once the delivery is confirmed by the shipper.'],
    ['Can I edit a bid?', 'Not yet — cancel isn’t supported in this MVP. Bid carefully; the shipper sees it immediately.'],
  ];
  view.innerHTML = `<div class="head"><div><div class="kicker">Help centre</div><h1>How can we help?</h1><p>Common questions, or reach the team.</p></div></div>
  <div class="card" style="margin-bottom:16px">${faqs.map(([q, a], i) => `<div style="padding:17px 18px;${i ? 'border-top:1px solid var(--line-2)' : ''}"><b style="font-size:15.5px;display:block;margin-bottom:5px">${q}</b><span style="font-size:14px;color:var(--muted);font-weight:500">${a}</span></div>`).join('')}</div>
  <div class="card pad">
    <div id="ticket-err"></div>
    <div class="f full"><input id="ticket-subject" placeholder="Describe your issue…"></div>
    <button class="btn btn-ink btn-block" style="margin-top:10px" id="ticket-submit">Contact support</button>
  </div>`;
  const btn = el('ticket-submit');
  btn.addEventListener('click', async () => {
    const inp = el('ticket-subject');
    if (!inp.value.trim()) return;
    btn.disabled = true;
    try { await api.openTicket(inp.value.trim()); toast('Support ticket opened'); inp.value = ''; }
    catch (e) { el('ticket-err').innerHTML = errorBanner(e.message); }
    btn.disabled = false;
  });
}

export const actions = { openBidSheet, submitBid, setFilter, sendJobMsg };
