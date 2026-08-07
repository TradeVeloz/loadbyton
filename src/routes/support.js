const express = require('express');
const { run, all } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 10)}`;

router.post('/tickets', requireAuth, (req, res) => {
  const { subject } = req.body || {};
  if (!subject || !String(subject).trim()) return res.status(400).json({ error: 'Please describe your issue' });
  const roleLabel = req.user.role === 'cargo' ? 'Cargo' : req.user.role === 'transport' ? 'Transport' : 'Admin';
  const id = uid('tk');
  run(
    `INSERT INTO tickets (id, user_id, from_label, role_label, subject, status, created_at)
     VALUES (?,?,?,?,?,?,?)`,
    [id, req.user.id, req.user.company_name, roleLabel, String(subject).trim(), 'open', Date.now()]
  );
  res.status(201).json({ ticket: all('SELECT * FROM tickets WHERE id = ?', [id])[0] });
});

module.exports = { router };
