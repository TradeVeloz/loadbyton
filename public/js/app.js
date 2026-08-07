import { api, getToken, setToken, ApiError } from './api.js';
import { svg } from './lib/icons.js';
import { initials } from './lib/format.js';
import { toast, closeSheet } from './shared.js';
import * as cargo from './views/cargo.js';
import * as transport from './views/transport.js';
import * as admin from './views/admin.js';

const el = (id) => document.getElementById(id);

export const state = { user: null, tab: null };

const ROLES = {
  cargo: {
    label: 'Cargo / Shipper', color: 'var(--ink)',
    nav: [['dash', 'Home', 'dash'], ['posts', 'Requirements', 'box'], ['bids', 'Compare Bids', 'gavel'], ['ship', 'Shipment', 'truck'], ['help', 'Help', 'help']],
    tab: [['dash', 'Home', 'dash'], ['posts', 'Loads', 'box'], ['post', '', 'post'], ['ship', 'Shipment', 'truck'], ['help', 'Help', 'help']],
    view: cargo,
  },
  transport: {
    label: 'Transport Company', color: 'var(--navy)',
    nav: [['dash', 'Home', 'dash'], ['market', 'Open Loads', 'box'], ['mybids', 'My Bids', 'gavel'], ['jobs', 'Won Jobs', 'truck'], ['help', 'Help', 'help']],
    tab: [['dash', 'Home', 'dash'], ['market', 'Loads', 'box'], ['mybids', 'Bids', 'gavel'], ['jobs', 'Jobs', 'truck'], ['help', 'Help', 'help']],
    view: transport,
  },
  admin: {
    label: 'Admin / Operations', color: 'var(--green)',
    nav: [['dash', 'Overview', 'dash'], ['approvals', 'Approvals', 'shield'], ['members', 'Members', 'users'], ['support', 'Support', 'help']],
    tab: [['dash', 'Home', 'dash'], ['approvals', 'Approvals', 'shield'], ['members', 'Members', 'users'], ['support', 'Support', 'help']],
    view: admin,
  },
};

function navCount(id) {
  const role = state.user.role;
  if (role === 'cargo' && id === 'bids') return state.badges.newBids || 0;
  if (role === 'transport' && id === 'market') return state.badges.openLoads || 0;
  if (role === 'admin' && id === 'approvals') return state.badges.pending || 0;
  return 0;
}

function buildNav() {
  const r = ROLES[state.user.role];
  el('rail').innerHTML = `<div class="lbl">${r.label}</div>` +
    r.nav.map(([id, lbl, ic]) => {
      const n = navCount(id);
      return `<button class="nav ${state.tab === id ? 'on' : ''}" onclick="LB.go('${id}')">${svg(ic)}<span>${lbl}</span>${n ? `<span class="ct">${n}</span>` : ''}</button>`;
    }).join('') +
    (state.user.role === 'cargo' ? `<div class="rail-cta"><button class="btn btn-accent btn-block" onclick="LB.go('post')">${svg('post', 18)} Post requirement</button></div>` : '') +
    `<div class="rail-cta"><button class="btn btn-light btn-block btn-sm" onclick="LB.logout()">${svg('logout', 16)} Switch role</button></div>`;
  el('tabbar').innerHTML = r.tab.map(([id, lbl, ic]) => {
    if (ic === 'post') return `<button onclick="LB.go('post')" aria-label="Post"><span class="fab">${svg('post', 22)}</span></button>`;
    const n = navCount(id);
    return `<button class="${state.tab === id ? 'on' : ''}" onclick="LB.go('${id}')">${n ? `<span class="bd">${n}</span>` : ''}${svg(ic, 22)}<span>${lbl}</span></button>`;
  }).join('');
}

async function refreshBadges() {
  state.badges = state.badges || {};
  try {
    if (state.user.role === 'cargo') {
      const { requirements } = await api.requirements();
      state.badges.newBids = requirements.filter((r) => r.status === 'open').reduce((n, r) => n + r.bid_count, 0);
    } else if (state.user.role === 'transport') {
      const { requirements } = await api.requirements();
      state.badges.openLoads = requirements.filter((r) => r.status === 'open').length;
    } else if (state.user.role === 'admin') {
      const { registrations } = await api.adminRegistrations();
      state.badges.pending = registrations.length;
    }
    buildNav();
  } catch { /* badges are best-effort */ }
}

export async function go(tab) {
  hideAwardBar();
  if (tab === 'post' && state.user.role === 'cargo') {
    state.tab = 'posts';
    buildNav();
    await render();
    cargo.actions.openPostSheet();
    return;
  }
  state.tab = tab;
  buildNav();
  await render();
  el('view').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function render() {
  const role = ROLES[state.user.role];
  const view = el('view');
  view.className = 'main enter';
  const handler = role.view[state.tab] || role.view.dash;
  await handler(view);
}

export function hideAwardBar() {
  el('awardbar').classList.remove('show');
  el('tabbar').classList.remove('hide');
}
export function showAwardBar(title, sub, onConfirm) {
  el('awb-title').textContent = title;
  el('awb-sub').textContent = sub;
  const btn = el('awb-btn');
  btn.disabled = false;
  btn.onclick = onConfirm;
  el('awardbar').classList.add('show');
  el('tabbar').classList.add('hide');
}

export async function loginAs(role, email) {
  try {
    const { token, user } = await api.login({ email, password: 'demo1234' });
    setToken(token);
    await enterApp(user);
  } catch (e) {
    toast(e.message || 'Could not sign in', 'err');
  }
}

async function enterApp(user) {
  state.user = user;
  state.badges = {};
  const r = ROLES[user.role];
  state.tab = r.nav[0][0];
  el('landing').classList.add('hidden');
  el('app').classList.remove('hidden');
  el('rp-name').textContent = user.company_name.split(' ')[0];
  el('rp-role').textContent = r.label;
  const av = el('rp-av');
  av.textContent = initials(user.company_name);
  av.style.background = r.color;
  buildNav();
  window.scrollTo(0, 0);
  await render();
  refreshBadges();
  setInterval(() => { if (state.user) refreshBadges(); }, 20000);
}

export function logout() {
  setToken(null);
  state.user = null;
  hideAwardBar();
  el('app').classList.add('hidden');
  el('landing').classList.remove('hidden');
  renderLanding();
}

/* ---------- Landing ---------- */
function renderLanding() {
  el('landing-root').innerHTML = `
    <div class="lt">
      <div class="brand"><span class="mk">${svg('box', 18)}</span>Loadbyton</div>
      <span class="tag t-live dot">Live in Dubai</span>
    </div>
    <div class="lwrap">
      <div class="lhero">
        <div class="eyebrow">Freight bid marketplace</div>
        <h1>Container haulage, <span class="u">on demand.</span></h1>
        <p>Post a requirement once. Vetted carriers compete on price and pickup time. Award in a tap, share your customs papers, and track to the warehouse — all in one app.</p>
        <div class="lstats">
          <div><b>20,000+</b><small>containers cleared daily in Dubai</small></div>
          <div><b>&minus;18%</b><small>vs. phone quotes</small></div>
          <div><b>&lt;30 min</b><small>to first bid</small></div>
        </div>
      </div>
      <div class="lcard">
        <div id="lcard-body"></div>
      </div>
    </div>
    <div class="strip"><div class="in">
      <div><div class="n">01</div><b>Post</b><small>List container, route and deadline in under a minute.</small></div>
      <div><div class="n">02</div><b>Bid</b><small>Vetted carriers quote price and pickup time.</small></div>
      <div><div class="n">03</div><b>Award</b><small>Compare side by side and award the best fit.</small></div>
      <div><div class="n">04</div><b>Deliver</b><small>Share papers, chat, track to the warehouse.</small></div>
    </div></div>`;
  renderLandingDemo();
}

function renderLandingDemo() {
  el('lcard-body').innerHTML = `
    <h2>Get started</h2>
    <p class="sub">Pick how you want to explore the demo — every account below runs on a live backend.</p>
    <button class="roleopt" onclick="LB.loginAs('cargo','cargo@blueport.com')"><span class="ri" style="background:var(--ink)">${svg('box', 23)}</span><span class="rt"><b>Cargo / Shipper</b><small>Post requirements, compare bids, share docs</small></span><span class="ar">${svg('arrow', 18)}</span></button>
    <button class="roleopt" onclick="LB.loginAs('transport','dispatch@desertline.ae')"><span class="ri" style="background:var(--navy)">${svg('truck', 23)}</span><span class="rt"><b>Transport Company</b><small>Browse loads, place bids, win jobs</small></span><span class="ar">${svg('arrow', 18)}</span></button>
    <button class="roleopt" onclick="LB.loginAs('admin','ops@loadbyton.com')"><span class="ri" style="background:var(--green)">${svg('shield', 23)}</span><span class="rt"><b>Admin / Operations</b><small>Approve members, resolve support</small></span><span class="ar">${svg('arrow', 18)}</span></button>
    <div class="demo-note">${svg('clock', 13)} New here? <a onclick="LB.showRegister()" style="color:var(--ink);font-weight:700;cursor:pointer;text-decoration:underline">Register a company</a> instead — password for demo logins: <code>demo1234</code></div>`;
}

export function showRegister() {
  el('lcard-body').innerHTML = `
    <h2>Register your company</h2>
    <p class="sub">Ops verifies your trade licence and TRN before you can sign in.</p>
    <div id="register-err"></div>
    <div class="chips" style="margin-bottom:15px" id="reg-role">
      <button class="on" data-role="cargo" onclick="LB.setRegRole('cargo')">Cargo / Shipper</button>
      <button data-role="transport" onclick="LB.setRegRole('transport')">Transport Company</button>
    </div>
    <form id="register-form" class="f full" style="gap:12px">
      <div class="f"><label>Company name</label><input id="r-company" required></div>
      <div class="f"><label>Contact name</label><input id="r-contact" required></div>
      <div class="f"><label>Work email</label><input id="r-email" type="email" required></div>
      <div class="f"><label>Password</label><input id="r-password" type="password" minlength="6" required></div>
      <div class="f"><label>Trade licence / TRN</label><input id="r-trn" placeholder="100xxxxxxxxx00"></div>
      <div class="f" id="r-fleet-wrap"><label>Fleet</label><input id="r-fleet" placeholder="e.g. 12 trailers"></div>
      <button class="btn btn-accent btn-block" type="submit" id="r-submit">Submit for approval</button>
      <button class="btn btn-light btn-block btn-sm" type="button" onclick="LB.renderLandingDemo()">Back to demo logins</button>
    </form>`;
  el('register-form').addEventListener('submit', submitRegister);
  setRegRole('cargo');
}

let regRole = 'cargo';
export function setRegRole(role) {
  regRole = role;
  document.querySelectorAll('#reg-role button').forEach((b) => b.classList.toggle('on', b.dataset.role === role));
  el('r-fleet-wrap').style.display = role === 'transport' ? '' : 'none';
}

async function submitRegister(e) {
  e.preventDefault();
  const btn = el('r-submit');
  btn.disabled = true;
  el('register-err').innerHTML = '';
  try {
    const { message } = await api.register({
      role: regRole,
      company_name: el('r-company').value.trim(),
      contact_name: el('r-contact').value.trim(),
      email: el('r-email').value.trim(),
      password: el('r-password').value,
      trn: el('r-trn').value.trim(),
      fleet_desc: regRole === 'transport' ? el('r-fleet').value.trim() : null,
    });
    toast(message);
    renderLandingDemo();
  } catch (err) {
    el('register-err').innerHTML = `<div class="banner banner-err" style="margin-bottom:14px">${err.message}</div>`;
    btn.disabled = false;
  }
}

/* ---------- Boot ---------- */
window.LB = {
  go, loginAs, logout, showRegister, setRegRole, renderLandingDemo, hideAwardBar, showAwardBar,
  shared: { closeSheet, toast },
  cargo: cargo.actions,
  transport: transport.actions,
  admin: admin.actions,
};
window.addEventListener('DOMContentLoaded', async () => {
  renderLanding();
  const token = getToken();
  if (!token) return;
  try {
    const { user } = await api.me();
    await enterApp(user);
  } catch (e) {
    if (e instanceof ApiError) setToken(null);
  }
});

export { ROLES };
