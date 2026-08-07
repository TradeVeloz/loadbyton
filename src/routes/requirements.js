const express = require('express');
const { all, get, run } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 10)}`;
const HR = 3600e3;

function withBidSummary(r) {
  const bids = all('SELECT * FROM bids WHERE requirement_id = ?', [r.id]);
  const active = bids.filter((b) => b.status !== 'lost');
  const best = active.slice().sort((a, b) => a.price - b.price)[0];
  return { ...r, bid_count: bids.length, best_price: best ? best.price : null };
}

// cargo sees their own requirements; transport sees open ones (market) + any where they hold a bid; admin sees all
router.get('/', requireAuth, (req, res) => {
  const { role, id } = req.user;
  let rows;
  if (role === 'cargo') {
    rows = all('SELECT * FROM requirements WHERE cargo_user_id = ? ORDER BY created_at DESC', [id]);
  } else if (role === 'admin') {
    rows = all('SELECT * FROM requirements ORDER BY created_at DESC');
  } else {
    rows = all(
      `SELECT DISTINCT r.* FROM requirements r
       LEFT JOIN bids b ON b.requirement_id = r.id AND b.transport_user_id = ?
       WHERE r.status = 'open' OR b.id IS NOT NULL
       ORDER BY r.created_at DESC`,
      [id]
    );
  }
  res.json({ requirements: rows.map(withBidSummary) });
});

function loadAndAuthorize(req, res, next) {
  const r = get('SELECT * FROM requirements WHERE id = ?', [req.params.id]);
  if (!r) return res.status(404).json({ error: 'Requirement not found' });
  const { role, id } = req.user;
  const isOwner = role === 'cargo' && r.cargo_user_id === id;
  const isAdmin = role === 'admin';
  const isWinningCarrier = role === 'transport' && get(
    `SELECT 1 FROM bids WHERE requirement_id = ? AND transport_user_id = ? AND status = 'won'`,
    [r.id, id]
  );
  const isOpenMarket = role === 'transport' && r.status === 'open';
  if (!isOwner && !isAdmin && !isWinningCarrier && !isOpenMarket) return res.status(403).json({ error: 'Not allowed to view this requirement' });
  req.requirement = r;
  req.canWrite = isOwner || isAdmin || isWinningCarrier;
  next();
}

router.get('/:id', requireAuth, loadAndAuthorize, (req, res) => {
  res.json({ requirement: withBidSummary(req.requirement) });
});

router.post('/', requireAuth, requireRole('cargo'), (req, res) => {
  const { container_no, container_type, drop_off, ready_at, deadline, special, budget, notes, bid_window_hours } = req.body || {};
  if (!container_no || !container_type || !drop_off) return res.status(400).json({ error: 'Container number, type and drop-off are required' });
  const id = `LBX-${Math.floor(5000 + Math.random() * 4000)}`;
  const now = Date.now();
  const win = Math.min(24, Math.max(2, Number(bid_window_hours) || 6));
  run(
    `INSERT INTO requirements (id, cargo_user_id, container_no, container_type, pickup, drop_off, ready_at, deadline, special, budget, notes, status, bid_ends_at, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, req.user.id, container_no, container_type, 'Jebel Ali Terminal 2', drop_off, ready_at || 'Today', deadline || 'Tomorrow', special || 'Standard dry', budget || null, notes || null, 'open', now + win * HR, now]
  );
  res.status(201).json({ requirement: withBidSummary(get('SELECT * FROM requirements WHERE id = ?', [id])) });
});

router.post('/:id/transit', requireAuth, requireRole('cargo'), loadAndAuthorize, (req, res) => {
  if (!req.canWrite) return res.status(403).json({ error: 'Not your requirement' });
  if (req.requirement.status !== 'awarded') return res.status(400).json({ error: 'Only awarded requirements can move to transit' });
  run('UPDATE requirements SET status = ? WHERE id = ?', ['transit', req.params.id]);
  res.json({ requirement: withBidSummary(get('SELECT * FROM requirements WHERE id = ?', [req.params.id])) });
});

router.post('/:id/deliver', requireAuth, requireRole('cargo'), loadAndAuthorize, (req, res) => {
  if (!req.canWrite) return res.status(403).json({ error: 'Not your requirement' });
  if (req.requirement.status !== 'transit') return res.status(400).json({ error: 'Only in-transit requirements can be marked delivered' });
  run('UPDATE requirements SET status = ? WHERE id = ?', ['delivered', req.params.id]);
  res.json({ requirement: withBidSummary(get('SELECT * FROM requirements WHERE id = ?', [req.params.id])) });
});

module.exports = { router, loadAndAuthorize };
