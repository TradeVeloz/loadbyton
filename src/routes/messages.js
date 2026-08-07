const express = require('express');
const { all, run } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { loadAndAuthorize } = require('./requirements');

const router = express.Router({ mergeParams: true });
const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 10)}`;

router.get('/', requireAuth, loadAndAuthorize, (req, res) => {
  const rows = all('SELECT * FROM messages WHERE requirement_id = ? ORDER BY created_at ASC', [req.params.id]);
  res.json({ messages: rows });
});

router.post('/', requireAuth, loadAndAuthorize, (req, res) => {
  if (!req.canWrite) return res.status(403).json({ error: 'Not allowed to message on this requirement' });
  const { text } = req.body || {};
  if (!text || !String(text).trim()) return res.status(400).json({ error: 'Message text is required' });
  const isCargoSide = req.user.role === 'cargo' || req.user.role === 'admin';
  const id = uid('msg');
  run(
    `INSERT INTO messages (id, requirement_id, sender_user_id, sender_label, is_cargo_side, text, doc_name, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [id, req.params.id, req.user.id, req.user.company_name, isCargoSide ? 1 : 0, String(text).trim(), null, Date.now()]
  );
  res.status(201).json({ message: all('SELECT * FROM messages WHERE id = ?', [id])[0] });
});

module.exports = { router };
