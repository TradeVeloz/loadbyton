const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const multer = require('multer');
const { all, run } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { loadAndAuthorize } = require('./requirements');

const router = express.Router({ mergeParams: true });
const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 10)}`;

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'data', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = path.join(UPLOAD_DIR, req.params.id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`),
});
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

router.get('/', requireAuth, loadAndAuthorize, (req, res) => {
  const rows = all('SELECT id, requirement_id, uploaded_by, name, size_bytes, created_at FROM documents WHERE requirement_id = ? ORDER BY created_at ASC', [req.params.id]);
  res.json({ documents: rows });
});

router.post('/', requireAuth, loadAndAuthorize, upload.single('file'), (req, res) => {
  if (!req.canWrite) return res.status(403).json({ error: 'Not allowed to share documents on this requirement' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const id = uid('doc');
  const relPath = path.join(req.params.id, req.file.filename);
  run(
    `INSERT INTO documents (id, requirement_id, uploaded_by, name, size_bytes, stored_path, created_at)
     VALUES (?,?,?,?,?,?,?)`,
    [id, req.params.id, req.user.company_name, req.file.originalname, req.file.size, relPath, Date.now()]
  );
  run(
    `INSERT INTO messages (id, requirement_id, sender_user_id, sender_label, is_cargo_side, text, doc_name, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [uid('msg'), req.params.id, req.user.id, req.user.company_name, req.user.role === 'cargo' ? 1 : 0, null, req.file.originalname, Date.now()]
  );
  res.status(201).json({ document: all('SELECT id, requirement_id, uploaded_by, name, size_bytes, created_at FROM documents WHERE id = ?', [id])[0] });
});

router.get('/:docId/download', requireAuth, loadAndAuthorize, (req, res) => {
  const doc = all('SELECT * FROM documents WHERE id = ? AND requirement_id = ?', [req.params.docId, req.params.id])[0];
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  const filePath = path.join(UPLOAD_DIR, doc.stored_path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File no longer available' });
  res.download(filePath, doc.name);
});

module.exports = { router };
