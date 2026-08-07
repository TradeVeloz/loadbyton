const express = require('express');
const { all, get, run } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { publicUser } = require('./auth');

const router = express.Router({ mergeParams: true });
const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 10)}`;

function withCarrier(b) {
  const carrier = get('SELECT * FROM users WHERE id = ?', [b.transport_user_id]);
  return { ...b, carrier: publicUser(carrier) };
}

// GET /api/requirements/:id/bids — cargo owner or admin see all bids; transport sees only their own bid on it
router.get('/', requireAuth, (req, res) => {
  const r = get('SELECT * FROM requirements WHERE id = ?', [req.params.id]);
  if (!r) return res.status(404).json({ error: 'Requirement not found' });
  const { role, id } = req.user;
  let rows;
  if (role === 'admin' || (role === 'cargo' && r.cargo_user_id === id)) {
    rows = all('SELECT * FROM bids WHERE requirement_id = ? ORDER BY price ASC', [r.id]);
  } else if (role === 'transport') {
    rows = all('SELECT * FROM bids WHERE requirement_id = ? AND transport_user_id = ?', [r.id, id]);
  } else {
    return res.status(403).json({ error: 'Not allowed' });
  }
  res.json({ bids: rows.map(withCarrier) });
});

router.post('/', requireAuth, requireRole('transport'), (req, res) => {
  const r = get('SELECT * FROM requirements WHERE id = ?', [req.params.id]);
  if (!r) return res.status(404).json({ error: 'Requirement not found' });
  if (r.status !== 'open') return res.status(400).json({ error: 'Bidding has closed on this requirement' });
  if (r.bid_ends_at < Date.now()) return res.status(400).json({ error: 'Bidding window has ended' });
  const existing = get('SELECT id FROM bids WHERE requirement_id = ? AND transport_user_id = ?', [r.id, req.user.id]);
  if (existing) return res.status(409).json({ error: 'You already placed a bid on this load' });
  const { price, eta, truck_desc, note } = req.body || {};
  if (!price || !eta) return res.status(400).json({ error: 'Price and pickup availability are required' });
  const id = uid('bid');
  run(
    `INSERT INTO bids (id, requirement_id, transport_user_id, price, eta, truck_desc, note, status, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [id, r.id, req.user.id, Number(price), eta, truck_desc || null, note || null, 'submitted', Date.now()]
  );
  res.status(201).json({ bid: withCarrier(get('SELECT * FROM bids WHERE id = ?', [id])) });
});

// mounted separately at /api/bids
const awardRouter = express.Router();

// GET /api/bids/mine — every bid the signed-in transport company has placed, with its requirement embedded
awardRouter.get('/mine', requireAuth, requireRole('transport'), (req, res) => {
  const rows = all('SELECT * FROM bids WHERE transport_user_id = ? ORDER BY created_at DESC', [req.user.id]);
  const withRequirement = rows.map((b) => ({ ...b, requirement: get('SELECT * FROM requirements WHERE id = ?', [b.requirement_id]) }));
  res.json({ bids: withRequirement });
});

awardRouter.post('/:bidId/award', requireAuth, requireRole('cargo'), (req, res) => {
  const bid = get('SELECT * FROM bids WHERE id = ?', [req.params.bidId]);
  if (!bid) return res.status(404).json({ error: 'Bid not found' });
  const r = get('SELECT * FROM requirements WHERE id = ?', [bid.requirement_id]);
  if (!r || r.cargo_user_id !== req.user.id) return res.status(403).json({ error: 'Not your requirement' });
  if (r.status !== 'open') return res.status(400).json({ error: 'This requirement has already been awarded' });

  const all_bids = all('SELECT id FROM bids WHERE requirement_id = ?', [r.id]);
  for (const b of all_bids) {
    run('UPDATE bids SET status = ? WHERE id = ?', [b.id === bid.id ? 'won' : 'lost', b.id]);
  }
  run('UPDATE requirements SET status = ? WHERE id = ?', ['awarded', r.id]);

  const carrier = get('SELECT * FROM users WHERE id = ?', [bid.transport_user_id]);
  run(
    `INSERT INTO messages (id, requirement_id, sender_user_id, sender_label, is_cargo_side, text, doc_name, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [uid('msg'), r.id, carrier.id, carrier.company_name, 0, 'Thanks for awarding us this job! Please share the customs clearance papers and collection receipt so we can dispatch a driver.', null, Date.now()]
  );

  res.json({ requirement: get('SELECT * FROM requirements WHERE id = ?', [r.id]) });
});

module.exports = { router, awardRouter };
