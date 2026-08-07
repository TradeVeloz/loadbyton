import { api, ApiError } from '../api.js';
import { svg } from '../lib/icons.js';
import { money, esc, timeAgo, countdown, initials, colorFor, fileSize, plural } from '../lib/format.js';
import { toast, openSheet, closeSheet, badge, emptyState, skeletonTiles, skeletonRows, errorBanner, clearPoll, setPoll } from '../shared.js';
import { showAwardBar, hideAwardBar, go, state } from '../app.js';

const el = (id) => document.getElementById(id);
let selReq = null;
let bidSort = 'price';
let selBid = null;
let activeShip = null;
let postForm = { type: '40ft HC', special: 'Standard dry' };

function rqCard(r) {
  let action = '';
  if (r.status === 'open') action = `<button class="btn btn-ink btn-sm" onclick="LB.cargo.openBids('${r.id}')">Compare ${r.bid_count} ${svg('arrow', 15)}</button>`;
  else if (r.status === 'awarded' || r.status === 'transit') action = `<button class="btn btn-accent btn-sm" onclick="LB.cargo.openShip('${r.id}')">Track ${svg('arrow', 15)}</button>`;
  else action = `<button class="btn btn-light btn-sm" onclick="LB.cargo.openShip('${r.id}')">View</button>`;
  const close = r.status === 'open' ? `<span class="tag ${(r.bid_ends_at - Date.now()) < 2 * 3600e3 ? 't-urgent' : 't-open'} dot" data-close="${r.bid_ends_at}">${svg('clock', 12)} closes in ${countdown(r.bid_ends_at)}</span>` : '';
  return `<div class="rq">
    <div class="rq-h"><div class="ic">${svg('box', 22)}</div>
      <div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span class="rq-id">${r.id}</span> ${badge(r.status)} ${close}</div>
        <div class="rq-sub">${esc(r.container_no)} · ${r.container_type}</div></div></div>
    <div class="rq-route"><div class="pt"><small>Pickup</small><b>Jebel Ali T2</b></div><div class="dots">${svg('arrow', 14)}</div><div class="pt" style="text-align:right"><small>Drop-off</small><b>${esc(r.drop_off)}</b></div></div>
    <div class="rq-meta"><span class="tag">${svg('clock', 13)} Ready ${esc(r.ready_at || '—')}</span><span class="tag">Deadline ${esc(r.deadline || '—')}</span><span class="tag">${esc(r.special)}</span></div>
    <div class="rq-f"><span class="bc">${r.bid_count ? `${plural(r.bid_count, 'bid')} · from <b>${r.best_price ? money(r.best_price) : '—'}</b>` : 'No bids yet'}</span><span class="sp"></span>${action}</div>
  </div>`;
}

async function loadRequirements() {
  const { requirements } = await api.requirements();
  return requirements;
}

export async function dash(view) {
  clearPoll();
  view.innerHTML = `<div class="head"><div><div class="kicker">Good afternoon</div><h1 class="skel" style="height:32px;width:220px;border-radius:8px"></h1></div></div>${skeletonTiles(4)}${skeletonRows(2)}`;
  try {
    const reqs = await loadRequirements();
    const open = reqs.filter((r) => r.status === 'open');
    const transit = reqs.filter((r) => r.status === 'transit' || r.status === 'awarded');
    const newBids = open.reduce((n, r) => n + r.bid_count, 0);
    view.innerHTML = `<div class="head"><div><div class="kicker">Good afternoon</div><h1>${esc(state.user.company_name)}</h1><p>${newBids} new bids waiting · ${transit.length} shipment${transit.length === 1 ? '' : 's'} on the move.</p></div>
      <button class="btn btn-accent" onclick="LB.go('post')">${svg('post', 18)} Post requirement</button></div>
      <div class="tiles">
        <div class="tile"><div class="ic">${svg('box', 18)}</div><div class="v">${open.length}</div><div class="k">Open requirements</div><div class="d">${svg('bolt', 12)} Receiving bids</div></div>
        <div class="tile"><div class="ic">${svg('gavel', 18)}</div><div class="v">${newBids}</div><div class="k">New bids</div><div class="d">Ready to compare</div></div>
        <div class="tile"><div class="ic">${svg('truck', 18)}</div><div class="v">${transit.length}</div><div class="k">In progress</div><div class="d">${transit[0] ? transit[0].id : '—'}</div></div>
        <div class="tile"><div class="ic">${svg('cash', 18)}</div><div class="v">${reqs.filter((r) => r.status === 'delivered').length}</div><div class="k">Delivered</div><div class="d">All time</div></div>
      </div>
      <div class="sec"><h2>Needs your attention</h2><a onclick="LB.go('posts')">See all</a></div>
      <div class="list">${open.length ? open.map(rqCard).join('') : emptyState('box', 'No open requirements', 'Post a container and start receiving competitive bids within minutes.')}</div>`;
  } catch (e) { view.innerHTML = errorBanner(e.message); }
}

export async function posts(view) {
  clearPoll();
  view.innerHTML = `<div class="head"><div><div class="kicker">Your loads</div><h1>Requirements</h1></div></div>${skeletonRows(3)}`;
  try {
    const reqs = await loadRequirements();
    view.innerHTML = `<div class="head"><div><div class="kicker">Your loads</div><h1>Requirements</h1><p>Every container you've posted, with live bids.</p></div>
      <button class="btn btn-accent" onclick="LB.go('post')">${svg('post', 18)} New</button></div>
      <div class="list">${reqs.length ? reqs.map(rqCard).join('') : emptyState('box', 'No requirements yet', 'Post your first container to start receiving bids.')}</div>`;
  } catch (e) { view.innerHTML = errorBanner(e.message); }
}

export async function bids(view) {
  clearPoll();
  view.innerHTML = `<div class="head"><div><div class="kicker">Compare bids</div><h1>Loading…</h1></div></div>${skeletonRows(3)}`;
  try {
    const reqs = (await loadRequirements()).filter((r) => r.status === 'open');
    if (!selReq || !reqs.find((r) => r.id === selReq)) selReq = reqs[0]?.id;
    if (!selReq) { view.innerHTML = emptyState('gavel', 'No open requirements', 'Post a requirement to start receiving competitive bids.'); return; }
    const r = reqs.find((x) => x.id === selReq);
    const { bids: list } = await api.bids(selReq);
    renderBidsView(view, r, reqs, list);
  } catch (e) { view.innerHTML = errorBanner(e.message); }
}

function renderBidsView(view, r, openReqs, list) {
  const active = list.filter((b) => b.status !== 'lost');
  const cheap = [...active].sort((a, b) => a.price - b.price)[0];
  const fast = [...active].sort((a, b) => parseFloat(a.eta) - parseFloat(b.eta))[0];
  const maxP = Math.max(1, ...active.map((b) => b.price));
  let sorted = active;
  if (bidSort === 'price') sorted = [...active].sort((a, b) => a.price - b.price);
  if (bidSort === 'eta') sorted = [...active].sort((a, b) => parseFloat(a.eta) - parseFloat(b.eta));
  if (bidSort === 'rating') sorted = [...active].sort((a, b) => (b.carrier.rating || 0) - (a.carrier.rating || 0));
  const sb = (k, l) => `<button class="pill ${bidSort === k ? 'on' : ''}" onclick="LB.cargo.setBidSort('${k}')">${l}</button>`;

  view.innerHTML = `<div class="head"><div><div class="kicker">Compare bids</div><h1>${active.length} carrier${active.length === 1 ? '' : 's'} competing</h1><p>Tap a carrier, then confirm to award.</p></div></div>
  <div class="f" style="max-width:460px;margin-bottom:16px"><label>Requirement</label>
    <select onchange="LB.cargo.selectReq(this.value)">${openReqs.map((o) => `<option value="${o.id}" ${o.id === selReq ? 'selected' : ''}>${o.id} · ${esc(o.container_no)} → ${esc(o.drop_off)}</option>`).join('')}</select></div>
  <div class="card pad" style="margin-bottom:18px">
    <div class="rq-route" style="padding:0"><div class="pt"><small>Container</small><b>${esc(r.container_no)} · ${r.container_type}</b></div><div class="dots">${svg('arrow', 14)}</div><div class="pt" style="text-align:right"><small>Drop-off</small><b>${esc(r.drop_off)}</b></div></div>
    <div class="rq-meta" style="padding:12px 0 0"><span class="tag">${svg('clock', 13)} Ready ${esc(r.ready_at || '—')}</span><span class="tag">Budget ${money(r.budget)}</span><span class="tag t-open dot" data-close="${r.bid_ends_at}">closes in ${countdown(r.bid_ends_at)}</span></div>
  </div>
  ${active.length ? `<div class="pills">${sb('price', 'Lowest price')}${sb('eta', 'Fastest pickup')}${sb('rating', 'Top rated')}</div>` : ''}
  ${active.length ? sorted.map((b) => {
    const isCheap = cheap && b.id === cheap.id, isFast = fast && b.id === fast.id && !isCheap, w = Math.round((b.price / maxP) * 100);
    return `<div class="opt ${selBid === b.id ? 'sel' : ''}" data-bid="${b.id}" onclick="LB.cargo.pickBid('${b.id}')">
      <div class="logo" style="background:${colorFor(b.carrier.company_name)}">${initials(b.carrier.company_name)}</div>
      <div style="flex:1;min-width:0">
        <div class="nm">${esc(b.carrier.company_name)} ${isCheap ? '<span class="tag t-accent" style="height:22px;font-size:11px">Best price</span>' : ''} ${isFast ? '<span class="tag t-open" style="height:22px;font-size:11px">Fastest</span>' : ''}</div>
        <div class="mt"><span class="stars">★ ${b.carrier.rating ?? '—'}</span><span>${b.carrier.trips || 0} trips</span><span>${svg('clock', 12)} ${esc(b.eta)}</span>${b.note ? `<span>“${esc(b.note)}”</span>` : ''}</div>
        <div class="pbar ${isCheap ? 'best' : ''}"><i style="width:${w}%"></i></div>
      </div>
      <div class="price"><div class="a">${money(b.price)}</div><div class="s">${r.budget && b.price < r.budget ? money(r.budget - b.price) + ' under' : 'all-in'}</div></div>
      <div class="radio"></div>
    </div>`;
  }).join('') : emptyState('gavel', 'No bids yet', 'Carriers are reviewing this load — bids usually arrive within minutes.')}
  <div style="height:20px"></div>`;

  if (selBid && active.find((b) => b.id === selBid)) {
    const b = active.find((x) => x.id === selBid);
    showAwardBar(`Award to ${b.carrier.company_name}`, `${money(b.price)} · pickup ${b.eta} · ★ ${b.carrier.rating ?? '—'}`, () => confirmAward());
  }
}

export function selectReq(id) { selReq = id; selBid = null; go('bids'); }
export function setBidSort(k) { bidSort = k; go('bids'); }
export function openBids(reqId) { selReq = reqId; selBid = null; go('bids'); }

export function pickBid(id) {
  selBid = id;
  document.querySelectorAll('.opt[data-bid]').forEach((o) => o.classList.toggle('sel', o.getAttribute('data-bid') === id));
  go('bids');
}

async function confirmAward() {
  if (!selBid) return;
  const btn = el('awb-btn');
  btn.disabled = true;
  try {
    await api.awardBid(selBid);
    hideAwardBar();
    toast('Bid awarded — carrier notified');
    selBid = null;
    activeShip = selReq;
    go('ship');
  } catch (e) {
    toast(e.message || 'Could not award this bid', 'err');
    btn.disabled = false;
  }
}

export function openShip(reqId) { activeShip = reqId; go('ship'); }

export async function ship(view) {
  clearPoll();
  view.innerHTML = `<div class="head"><div><div class="kicker">Live shipment</div><h1>Loading…</h1></div></div>${skeletonRows(2)}`;
  try {
    const reqs = (await loadRequirements()).filter((r) => ['awarded', 'transit', 'delivered'].includes(r.status));
    if (!activeShip || !reqs.find((r) => r.id === activeShip)) activeShip = reqs[0]?.id;
    if (!activeShip) { view.innerHTML = emptyState('truck', 'No active shipments', 'Award a bid and you can track it here.'); return; }
    await renderShip(view, reqs);
    setPoll(() => renderShipLive(), 4000);
  } catch (e) { view.innerHTML = errorBanner(e.message); }
}

async function renderShip(view, reqs) {
  const r = reqs.find((x) => x.id === activeShip);
  const { bids: list } = await api.bids(r.id);
  const won = list.find((b) => b.status === 'won');
  const co = won ? won.carrier.company_name : 'Assigned carrier';
  const { documents: docs } = await api.documents(r.id);
  const { messages: msgs } = await api.messages(r.id);
  const hasDocs = docs.length > 0;
  const steps = [
    ['Bid awarded', true],
    ['Documents shared', hasDocs],
    ['Driver dispatched', r.status !== 'awarded' || hasDocs],
    ['Picked up at T2', r.status === 'transit' || r.status === 'delivered'],
    ['Delivered to warehouse', r.status === 'delivered'],
  ];
  let now = steps.findIndex((s) => !s[1]);
  if (now === -1) now = steps.length;

  view.innerHTML = `<div class="head"><div><div class="kicker">Live shipment</div><h1>${r.id}</h1><p>${esc(r.container_no)} · ${r.container_type} → ${esc(r.drop_off)}</p></div>
    ${reqs.length > 1 ? `<select onchange="LB.cargo.selectShip(this.value)" style="height:44px;padding:0 14px;border:1.5px solid var(--line);border-radius:13px;background:var(--paper);font-weight:700">${reqs.map((j) => `<option value="${j.id}" ${j.id === activeShip ? 'selected' : ''}>${j.id}</option>`).join('')}</select>` : ''}</div>
  <div class="track">
    <div>
      <div class="driver" style="margin-bottom:16px"><div class="av2" style="background:${colorFor(co)}">${initials(co)}</div>
        <div style="min-width:0"><div class="nm">${esc(co)}</div><div class="mt">${svg('truck', 12)} ${won ? 'Truck assigned · pickup ' + esc(won.eta) : 'Assigned transporter'}</div></div>
        <div class="acts"><button class="rnd light" onclick="LB.shared.toast('Calling dispatcher…')">${svg('phone', 18)}</button><button class="rnd ink" onclick="document.getElementById('chatInput')?.focus()">${svg('chat', 18)}</button></div></div>
      <div class="card pad" style="margin-bottom:16px">
        <h3 style="font-size:16px;margin-bottom:15px">Progress</h3>
        <div class="steps">${steps.map((s, i) => `<div class="s ${s[1] ? 'done' : i === now ? 'now' : ''}"><b>${s[0]}</b><small>${s[1] ? 'Completed' : i === now ? 'In progress' : 'Pending'}</small></div>`).join('')}</div>
        ${r.status === 'awarded' ? `<button class="btn btn-ink btn-block" style="margin-top:8px" onclick="LB.cargo.markTransit('${r.id}')">Confirm pickup complete</button>` : ''}
        ${r.status === 'transit' ? `<button class="btn btn-ink btn-block" style="margin-top:8px" onclick="LB.cargo.markDelivered('${r.id}')">Confirm delivered</button>` : ''}
      </div>
      <div class="card pad">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px"><h3 style="font-size:16px">Documents for driver</h3><span class="tag" id="docCount">${plural(docs.length, 'file')}</span></div>
        <p style="font-size:13.5px;color:var(--muted);margin:0 0 13px;font-weight:500">Share customs clearance papers &amp; the collection receipt. Only ${esc(co)} can see them.</p>
        <div id="docList">${docListHtml(docs, r.id)}</div>
        <div class="drop" id="dropZone" tabindex="0">${svg('up', 22)}<b>Upload document</b><small>Bill of Entry · Collection Receipt · Delivery Order</small><input type="file" id="fileInput" class="hidden"></div>
      </div>
    </div>
    <div class="card" style="overflow:hidden">
      <div class="chat">
        <div class="chat-h"><div class="av" style="width:40px;height:40px;background:${colorFor(co)}">${initials(co)}</div>
          <div style="flex:1"><b style="font-weight:800">${esc(co)}</b><div style="font-size:12.5px;color:var(--muted);font-weight:600">${svg('truck', 12)} Assigned transporter</div></div>
          <span class="tag t-live dot">Online</span></div>
        <div class="chat-b" id="chatBody">${chatHtml(msgs, r.id)}</div>
        <div class="chat-i"><input id="chatInput" placeholder="Message the driver…" aria-label="Message"><button class="snd" id="chatSend" aria-label="Send">${svg('send', 18)}</button></div>
      </div>
    </div>
  </div>`;

  wireShipInteractions(r.id);
  const cb = el('chatBody'); if (cb) cb.scrollTop = cb.scrollHeight;
}

function wireShipInteractions(reqId) {
  const zone = el('dropZone');
  const input = el('fileInput');
  if (zone && input) {
    zone.addEventListener('click', () => input.click());
    zone.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.click(); });
    ['dragover', 'dragleave', 'drop'].forEach((evt) => zone.addEventListener(evt, (e) => { e.preventDefault(); zone.classList.toggle('drag', evt === 'dragover'); }));
    zone.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) uploadDocFile(reqId, f); });
    input.addEventListener('change', () => { const f = input.files[0]; if (f) uploadDocFile(reqId, f); input.value = ''; });
  }
  const send = el('chatSend'), inp = el('chatInput');
  if (send && inp) {
    const doSend = () => sendMsg(reqId, inp);
    send.addEventListener('click', doSend);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSend(); });
  }
}

function docListHtml(docs, reqId) {
  if (!docs.length) return `<div style="font-size:13.5px;color:var(--muted-2);padding:6px 0 14px;font-weight:500">No documents shared yet.</div>`;
  return docs.map((x) => `<div class="doc"><div class="fi">${svg('doc', 18)}</div><div class="m"><b>${esc(x.name)}</b><small>${fileSize(x.size_bytes)} · shared by ${esc(x.uploaded_by)} · ${timeAgo(x.created_at)}</small></div><a class="btn btn-light btn-sm" href="${api.documentDownloadUrl(reqId, x.id)}">${svg('download', 14)}</a></div>`).join('');
}

function chatHtml(msgs, reqId) {
  if (!msgs.length) return `<div style="margin:auto;text-align:center;color:var(--muted-2);font-size:13px;font-weight:500">Start the conversation with your carrier.</div>`;
  return msgs.map((m) => {
    if (m.doc_name) return `<div class="msg doc"><div class="fi">${svg('doc', 16)}</div><div><b style="font-size:13px">${esc(m.doc_name)}</b><small style="display:block;font-size:11px;color:var(--muted);font-weight:600">Document · ${timeAgo(m.created_at)}</small></div></div>`;
    return `<div class="msg ${m.is_cargo_side ? 'me' : 'them'}">${esc(m.text)}<small>${esc(m.sender_label)} · ${timeAgo(m.created_at)}</small></div>`;
  }).join('');
}

async function sendMsg(reqId, inputEl) {
  const text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = '';
  try {
    await api.sendMessage(reqId, text);
    await renderShipLive();
  } catch (e) { toast(e.message || 'Could not send message', 'err'); }
}

async function uploadDocFile(reqId, file) {
  try {
    await api.uploadDocument(reqId, file);
    toast(`${file.name} shared`);
    await renderShipLive();
  } catch (e) { toast(e.message || 'Upload failed', 'err'); }
}

async function renderShipLive() {
  const view = el('view');
  if (!activeShip || !view || !el('chatBody')) return;
  try {
    const reqs = (await loadRequirements()).filter((x) => ['awarded', 'transit', 'delivered'].includes(x.status));
    if (!reqs.find((x) => x.id === activeShip)) return;
    const cbBefore = el('chatBody');
    const wasAtBottom = cbBefore.scrollHeight - cbBefore.scrollTop - cbBefore.clientHeight < 60;
    await renderShip(view, reqs);
    if (wasAtBottom) { const cb = el('chatBody'); if (cb) cb.scrollTop = cb.scrollHeight; }
  } catch { /* transient poll failure, ignore */ }
}

export function selectShip(id) { activeShip = id; go('ship'); }
export async function markTransit(id) {
  try { await api.markTransit(id); toast('Pickup confirmed — in transit'); go('ship'); }
  catch (e) { toast(e.message || 'Could not update status', 'err'); }
}
export async function markDelivered(id) {
  try { await api.markDelivered(id); toast('Marked as delivered'); go('ship'); }
  catch (e) { toast(e.message || 'Could not update status', 'err'); }
}

/* ---------- Post sheet ---------- */
export function openPostSheet() {
  postForm = { type: '40ft HC', special: 'Standard dry' };
  openSheet(`<div class="grab"></div><div class="sheet-h"><h3>Post requirement</h3><button class="x" onclick="LB.shared.closeSheet()" aria-label="Close">${svg('x', 16)}</button></div>
  <div class="sheet-b">
    <div id="post-err"></div>
    <div class="f full" style="margin-bottom:15px"><label>Container number</label><input id="f-cont" placeholder="e.g. MSKU 728 4419"></div>
    <div class="f full" style="margin-bottom:15px"><label>Container type</label><div class="chips" id="segType">${['20ft', '40ft', '40ft HC', 'Reefer'].map((t) => `<button class="${postForm.type === t ? 'on' : ''}" onclick="LB.cargo.syncSeg('segType','${t}')">${t}</button>`).join('')}</div></div>
    <div class="fgrid">
      <div class="f"><label>Pickup</label><input value="Jebel Ali Terminal 2" disabled></div>
      <div class="f"><label>Drop-off</label><select id="f-drop">${['JAFZA South Warehouse', 'Al Quoz Industrial 3', 'Dubai Investment Park 2', 'National Industries Park', 'Ras Al Khor DC', 'DAFZA Logistics Hub'].map((w) => `<option>${w}</option>`).join('')}</select></div>
      <div class="f"><label>Ready for pickup</label><input id="f-ready" placeholder="Today, 14:00"></div>
      <div class="f"><label>Deadline</label><input id="f-dl" placeholder="Tomorrow 18:00"></div>
    </div>
    <div class="f full" style="margin:15px 0"><label>Special requirements</label><div class="chips" id="segSpec">${['Standard dry', 'Reefer -18°C', 'Hazmat', 'Over-height'].map((t) => `<button class="${postForm.special === t ? 'on' : ''}" onclick="LB.cargo.syncSeg('segSpec','${t}')">${t}</button>`).join('')}</div></div>
    <div class="fgrid">
      <div class="f"><label>Target budget <span class="hint">optional</span></label><input id="f-budget" type="number" placeholder="1400"></div>
      <div class="f"><label>Bidding window</label><select id="f-win"><option value="2">2 hours (urgent)</option><option value="6" selected>6 hours</option><option value="12">12 hours</option><option value="24">24 hours</option></select></div>
    </div>
    <div class="f full" style="margin-top:15px"><label>Notes for carriers <span class="hint">optional</span></label><textarea id="f-notes" placeholder="Access, appointment times, genset…"></textarea></div>
  </div>
  <div class="sheet-f"><button class="btn btn-light" onclick="LB.shared.closeSheet()">Cancel</button><button class="btn btn-accent btn-block" id="post-submit" onclick="LB.cargo.submitPost()">Post &amp; get bids</button></div>`);
}
export function syncSeg(seg, val) {
  if (seg === 'segType') postForm.type = val; else postForm.special = val;
  document.querySelectorAll('#' + seg + ' button').forEach((b) => b.classList.toggle('on', b.textContent.trim() === val));
}
export async function submitPost() {
  const btn = el('post-submit');
  btn.disabled = true;
  el('post-err').innerHTML = '';
  try {
    const { requirement } = await api.postRequirement({
      container_no: el('f-cont').value.trim(),
      container_type: postForm.type,
      drop_off: el('f-drop').value,
      ready_at: el('f-ready').value.trim() || 'Today',
      deadline: el('f-dl').value.trim() || 'Tomorrow',
      special: postForm.special,
      budget: Number(el('f-budget').value) || null,
      notes: el('f-notes').value.trim() || null,
      bid_window_hours: Number(el('f-win').value) || 6,
    });
    closeSheet();
    toast(`${requirement.id} posted — notifying carriers`);
    go('posts');
  } catch (e) {
    el('post-err').innerHTML = errorBanner(e.message);
    btn.disabled = false;
  }
}

export async function help(view) {
  clearPoll();
  const faqs = [
    ['How do I post a requirement?', 'Tap “Post requirement”, enter the container, route and deadline, then set a bidding window. Carriers are notified instantly.'],
    ['How are carriers vetted?', 'Every transport company submits their trade licence and TRN. Ops verifies fleet and insurance before they can bid.'],
    ['When do I share customs papers?', 'After you award a bid — upload them in the shipment view. Only the assigned carrier can see them.'],
    ['How is payment handled?', 'Agree the price in-bid; settlement runs through Loadbyton with escrow release on proof of delivery.'],
  ];
  view.innerHTML = helpHtml(faqs);
  wireHelpForm();
}

function helpHtml(faqs) {
  return `<div class="head"><div><div class="kicker">Help centre</div><h1>How can we help?</h1><p>Common questions, or reach the team.</p></div></div>
  <div class="card" style="margin-bottom:16px">${faqs.map(([q, a], i) => `<div style="padding:17px 18px;${i ? 'border-top:1px solid var(--line-2)' : ''}"><b style="font-size:15.5px;display:block;margin-bottom:5px">${q}</b><span style="font-size:14px;color:var(--muted);font-weight:500">${a}</span></div>`).join('')}</div>
  <div class="card pad">
    <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:14px"><div style="width:46px;height:46px;border-radius:13px;background:var(--accent-soft);color:var(--accent-2);display:grid;place-items:center">${svg('chat', 20)}</div>
    <div style="flex:1;min-width:180px"><b style="font-size:15.5px">Still need help?</b><div style="font-size:13.5px;color:var(--muted);font-weight:500">Dubai ops replies within 15 min, 7am–11pm GST.</div></div></div>
    <div id="ticket-err"></div>
    <div class="f full"><input id="ticket-subject" placeholder="Describe your issue…"></div>
    <button class="btn btn-ink btn-block" style="margin-top:10px" id="ticket-submit">Contact support</button>
  </div>`;
}
function wireHelpForm() {
  const btn = el('ticket-submit');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const inp = el('ticket-subject');
    if (!inp.value.trim()) return;
    btn.disabled = true;
    try {
      await api.openTicket(inp.value.trim());
      toast('Support ticket opened — we’ll reply shortly');
      inp.value = '';
    } catch (e) { el('ticket-err').innerHTML = errorBanner(e.message); }
    btn.disabled = false;
  });
}

export const actions = {
  openPostSheet, syncSeg, submitPost, selectReq, setBidSort, openBids, pickBid, openShip, selectShip, markTransit, markDelivered,
};
