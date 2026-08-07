const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { get, run } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 10)}`;

function publicUser(u) {
  if (!u) return null;
  const { password_hash, ...rest } = u;
  return rest;
}

function signToken(u) {
  return jwt.sign({ id: u.id, role: u.role, company_name: u.company_name }, process.env.JWT_SECRET, { expiresIn: '12h' });
}

router.post('/register', (req, res) => {
  const { role, company_name, contact_name, email, password, trn, fleet_desc } = req.body || {};
  if (!['cargo', 'transport'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (!company_name || !contact_name || !email || !password) return res.status(400).json({ error: 'All fields are required' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (get('SELECT id FROM users WHERE email = ?', [String(email).toLowerCase()])) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }
  const id = uid('u');
  const hash = bcrypt.hashSync(password, 10);
  run(
    `INSERT INTO users (id, role, company_name, contact_name, email, password_hash, trn, fleet_desc, status, rating, trips, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, role, company_name, contact_name, String(email).toLowerCase(), hash, trn || null, fleet_desc || null, 'pending', null, 0, Date.now()]
  );
  res.status(201).json({ message: 'Registration submitted. An admin will review your trade licence and TRN before you can sign in.' });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const u = get('SELECT * FROM users WHERE email = ?', [String(email || '').toLowerCase()]);
  if (!u || !bcrypt.compareSync(password || '', u.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }
  if (u.status === 'pending') return res.status(403).json({ error: 'Your registration is still pending admin approval' });
  if (u.status === 'rejected') return res.status(403).json({ error: 'This account was not approved. Contact support.' });
  res.json({ token: signToken(u), user: publicUser(u) });
});

router.get('/me', requireAuth, (req, res) => {
  const u = get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!u) return res.status(404).json({ error: 'Account not found' });
  res.json({ user: publicUser(u) });
});

module.exports = { router, publicUser };
