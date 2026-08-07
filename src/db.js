const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'loadbyton.db'));
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK(role IN ('cargo','transport','admin')),
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  trn TEXT,
  fleet_desc TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('pending','active','rejected')),
  rating REAL,
  trips INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS requirements (
  id TEXT PRIMARY KEY,
  cargo_user_id TEXT NOT NULL REFERENCES users(id),
  container_no TEXT NOT NULL,
  container_type TEXT NOT NULL,
  pickup TEXT NOT NULL DEFAULT 'Jebel Ali Terminal 2',
  drop_off TEXT NOT NULL,
  ready_at TEXT,
  deadline TEXT,
  special TEXT NOT NULL DEFAULT 'Standard dry',
  budget INTEGER,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','awarded','transit','delivered')),
  bid_ends_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bids (
  id TEXT PRIMARY KEY,
  requirement_id TEXT NOT NULL REFERENCES requirements(id),
  transport_user_id TEXT NOT NULL REFERENCES users(id),
  price INTEGER NOT NULL,
  eta TEXT NOT NULL,
  truck_desc TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','won','lost')),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  requirement_id TEXT NOT NULL REFERENCES requirements(id),
  sender_user_id TEXT REFERENCES users(id),
  sender_label TEXT NOT NULL,
  is_cargo_side INTEGER NOT NULL,
  text TEXT,
  doc_name TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  requirement_id TEXT NOT NULL REFERENCES requirements(id),
  uploaded_by TEXT NOT NULL,
  name TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  stored_path TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  from_label TEXT NOT NULL,
  role_label TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_requirements_cargo ON requirements(cargo_user_id);
CREATE INDEX IF NOT EXISTS idx_requirements_status ON requirements(status);
CREATE INDEX IF NOT EXISTS idx_bids_requirement ON bids(requirement_id);
CREATE INDEX IF NOT EXISTS idx_bids_transport ON bids(transport_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_requirement ON messages(requirement_id);
CREATE INDEX IF NOT EXISTS idx_documents_requirement ON documents(requirement_id);
`);

function all(sql, params = []) {
  return db.prepare(sql).all(...params);
}
function get(sql, params = []) {
  return db.prepare(sql).get(...params);
}
function run(sql, params = []) {
  return db.prepare(sql).run(...params);
}
function isEmpty() {
  return get('SELECT COUNT(*) as n FROM users').n === 0;
}

module.exports = { db, all, get, run, isEmpty, DATA_DIR };
