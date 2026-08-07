const express = require('express');
const { all, get, run } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { publicUser } = require('./auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/overview', (req, res) => {
  const members = get(`SELECT COUNT(*) as n FROM users WHERE status = 'active' AND role != 'admin'`).n;
  const pending = get(`SELECT COUNT(*) as n FROM users WHERE status = 'pending'`).n;
  const openReq = get(`SELECT COUNT(*) as n FROM requirements WHERE status = 'open'`).n;
  const gmv = get(`SELECT COALESCE(SUM(price),0) as total FROM bids WHERE status = 'won'`).total;
  res.json({ members, pending, openReq, gmv });
});

router.get('/registrations', (req, res) => {
  const rows = all(`SELECT * FROM users WHERE status = 'pending' ORDER BY created_at ASC`).map(publicUser);
  res.json({ registrations: rows });
});

router.post('/registrations/:id/approve', (req, res) => {
  const u = get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!u) return res.status(404).json({ error: 'Registration not found' });
  run('UPDATE users SET status = ?, rating = COALESCE(rating, 4.5) WHERE id = ?', ['active', req.params.id]);
  res.json({ user: publicUser(get('SELECT * FROM users WHERE id = ?', [req.params.id])) });
});

router.post('/registrations/:id/reject', (req, res) => {
  const u = get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!u) return res.status(404).json({ error: 'Registration not found' });
  run('UPDATE users SET status = ? WHERE id = ?', ['rejected', req.params.id]);
  res.json({ ok: true });
});

router.get('/members', (req, res) => {
  const rows = all(`SELECT * FROM users WHERE status = 'active' AND role != 'admin' ORDER BY company_name ASC`).map(publicUser);
  res.json({ members: rows });
});

router.get('/tickets', (req, res) => {
  res.json({ tickets: all('SELECT * FROM tickets ORDER BY created_at DESC') });
});

router.post('/tickets/:id/resolve', (req, res) => {
  run('UPDATE tickets SET status = ? WHERE id = ?', ['resolved', req.params.id]);
  res.json({ ok: true });
});

module.exports = { router };
