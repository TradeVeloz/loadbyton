const bcrypt = require('bcryptjs');
const { run } = require('./db');

const HR = 3600e3;
const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 10)}`;

function seed() {
  const now = Date.now();
  const pass = bcrypt.hashSync('demo1234', 10);

  const users = [
    { id: 'u_admin', role: 'admin', company_name: 'Loadbyton Ops', contact_name: 'Ops Team', email: 'ops@loadbyton.com', trn: null, fleet_desc: null, rating: null, trips: 0 },
    { id: 'u_cargo1', role: 'cargo', company_name: 'BluePort Shipping', contact_name: 'Rakesh M.', email: 'cargo@blueport.com', trn: '100223344001', fleet_desc: null, rating: null, trips: 0 },
    { id: 'u_cargo2', role: 'cargo', company_name: 'Horizon Imports', contact_name: 'Fatima A.', email: 'ops@horizonimports.ae', trn: '100223344002', fleet_desc: null, rating: null, trips: 0 },
    { id: 'c1', role: 'transport', company_name: 'Al Manar Transport', contact_name: 'Yusuf K.', email: 'dispatch@almanar.ae', trn: '100557799011', fleet_desc: '40 flatbeds', rating: 4.8, trips: 1240 },
    { id: 'c2', role: 'transport', company_name: 'Gulf Haul Logistics', contact_name: 'Priya S.', email: 'ops@gulfhaul.ae', trn: '100557799022', fleet_desc: '22 trailers', rating: 4.6, trips: 860 },
    { id: 'c3', role: 'transport', company_name: 'Desert Line Freight', contact_name: 'Imran H.', email: 'dispatch@desertline.ae', trn: '100557799033', fleet_desc: '55 units', rating: 4.9, trips: 2010 },
    { id: 'c4', role: 'transport', company_name: 'Emirates Container Co.', contact_name: 'Noura T.', email: 'ops@emiratescontainer.ae', trn: '100557799044', fleet_desc: '18 trucks', rating: 4.4, trips: 520 },
  ];
  for (const u of users) {
    run(
      `INSERT INTO users (id, role, company_name, contact_name, email, password_hash, trn, fleet_desc, status, rating, trips, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [u.id, u.role, u.company_name, u.contact_name, u.email, pass, u.trn, u.fleet_desc, 'active', u.rating, u.trips, now - 60 * 24 * HR]
    );
  }

  const pending = [
    { id: uid('u'), role: 'transport', company_name: 'Falcon Freight LLC', contact_name: 'Sara N.', email: 'sara@falconfreight.ae', trn: '100xxxxxxxxx03', fleet_desc: '12 trailers' },
    { id: uid('u'), role: 'cargo', company_name: 'BluePort Shipping — Sharjah Branch', contact_name: 'Rakesh M.', email: 'sharjah@blueport.com', trn: '100xxxxxxxxx77', fleet_desc: null },
    { id: uid('u'), role: 'transport', company_name: 'RoadStar Movers', contact_name: 'Omar H.', email: 'omar@roadstar.ae', trn: '100xxxxxxxxx21', fleet_desc: '30 flatbeds' },
  ];
  const pendingAges = [2 * HR, 5 * HR, 9 * HR];
  pending.forEach((u, i) => {
    run(
      `INSERT INTO users (id, role, company_name, contact_name, email, password_hash, trn, fleet_desc, status, rating, trips, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [u.id, u.role, u.company_name, u.contact_name, u.email, pass, u.trn, u.fleet_desc, 'pending', null, 0, now - pendingAges[i]]
    );
  });

  const warehouses = ['JAFZA South Warehouse', 'Al Quoz Industrial 3', 'Dubai Investment Park 2', 'National Industries Park', 'Ras Al Khor DC', 'DAFZA Logistics Hub'];
  const mkReq = (id, cont, type, drop, ready, deadline, special, status, winHrs, createdAgoHrs) => ({
    id, cargo_user_id: 'u_cargo1', container_no: cont, container_type: type, pickup: 'Jebel Ali Terminal 2', drop_off: drop,
    ready_at: ready, deadline, special, budget: type === '40ft HC' ? 1600 : 1200, notes: null, status,
    bid_ends_at: now + winHrs * HR, created_at: now - createdAgoHrs * HR,
  });
  const requirements = [
    mkReq('LBX-4821', 'MSKU 728 4419', '40ft HC', warehouses[0], 'Today, 14:00', 'Tomorrow', 'Standard dry', 'open', 5, 3),
    mkReq('LBX-4809', 'TCLU 553 1902', '20ft', warehouses[1], 'Tomorrow, 09:00', '+2 days', 'Standard dry', 'open', 11, 8),
    mkReq('LBX-4787', 'HLCU 220 7781', '40ft HC', warehouses[2], 'Today, 18:00', 'Tomorrow', 'Reefer -18°C', 'awarded', 2, 20),
    mkReq('LBX-4750', 'CMAU 118 3345', '20ft', warehouses[3], 'Yesterday', 'Delivered', 'Hazmat Cl.3', 'delivered', 1, 40),
  ];
  for (const r of requirements) {
    run(
      `INSERT INTO requirements (id, cargo_user_id, container_no, container_type, pickup, drop_off, ready_at, deadline, special, budget, notes, status, bid_ends_at, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [r.id, r.cargo_user_id, r.container_no, r.container_type, r.pickup, r.drop_off, r.ready_at, r.deadline, r.special, r.budget, r.notes, r.status, r.bid_ends_at, r.created_at]
    );
  }

  const mkBid = (reqId, carrierId, price, eta, note, status, agoHrs) => ({ id: uid('bid'), requirement_id: reqId, transport_user_id: carrierId, price, eta, truck_desc: null, note, status, created_at: now - agoHrs * HR });
  const bids = [
    mkBid('LBX-4821', 'c1', 1450, '2 hrs', '2 flatbeds free at JAFZA now', 'submitted', 2),
    mkBid('LBX-4821', 'c3', 1390, '3 hrs', 'Best rate this week, insured', 'submitted', 1.5),
    mkBid('LBX-4821', 'c2', 1550, '90 min', 'Immediate pickup available', 'submitted', 1),
    mkBid('LBX-4809', 'c4', 980, '4 hrs', '20ft chassis ready', 'submitted', 3),
    mkBid('LBX-4809', 'c3', 1050, '2 hrs', '', 'submitted', 2),
    mkBid('LBX-4787', 'c3', 1720, '1 hr', 'Reefer genset certified', 'won', 19),
    mkBid('LBX-4787', 'c1', 1810, '3 hrs', '', 'lost', 19),
  ];
  for (const b of bids) {
    run(
      `INSERT INTO bids (id, requirement_id, transport_user_id, price, eta, truck_desc, note, status, created_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [b.id, b.requirement_id, b.transport_user_id, b.price, b.eta, b.truck_desc, b.note, b.status, b.created_at]
    );
  }

  const msgs = [
    { req: 'LBX-4787', from: 'them', label: 'Desert Line Freight', text: 'Bid accepted — thank you. Please share the customs clearance papers and the collection receipt.', ago: 40 * 60e3 },
    { req: 'LBX-4787', from: 'me', label: 'BluePort Shipping', text: 'Sending both now. Container is at T2, block C. Reefer set to -18°C, keep genset running.', ago: 36 * 60e3 },
    { req: 'LBX-4787', from: 'them', label: 'Desert Line Freight', text: 'Received. Driver Imran (Truck DXB-4471) heading to gate. ETA pickup 1 hr.', ago: 12 * 60e3 },
  ];
  for (const m of msgs) {
    run(
      `INSERT INTO messages (id, requirement_id, sender_user_id, sender_label, is_cargo_side, text, doc_name, created_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [uid('msg'), m.req, null, m.label, m.from === 'me' ? 1 : 0, m.text, null, now - m.ago]
    );
  }

  const docs = [
    { req: 'LBX-4787', name: 'Customs_Bill_of_Entry_4787.pdf', size: 218 * 1024, ago: 38 * 60e3 },
    { req: 'LBX-4787', name: 'Container_Collection_Receipt.pdf', size: 96 * 1024, ago: 38 * 60e3 },
  ];
  for (const d of docs) {
    run(
      `INSERT INTO documents (id, requirement_id, uploaded_by, name, size_bytes, stored_path, created_at)
       VALUES (?,?,?,?,?,?,?)`,
      [uid('doc'), d.req, 'BluePort Shipping', d.name, d.size, '', now - d.ago]
    );
  }

  const tickets = [
    { from: 'Gulf Haul Logistics', role: 'Transport', subj: 'Payout not received for LBX-4712', ago: 90 * 60e3, status: 'open' },
    { from: 'BluePort Shipping', role: 'Cargo', subj: 'How do I edit a requirement after posting?', ago: 4 * HR, status: 'open' },
    { from: 'Al Manar Transport', role: 'Transport', subj: 'Reefer certification upload failed', ago: 26 * HR, status: 'resolved' },
  ];
  for (const t of tickets) {
    run(
      `INSERT INTO tickets (id, user_id, from_label, role_label, subject, status, created_at)
       VALUES (?,?,?,?,?,?,?)`,
      [uid('tk'), null, t.from, t.role, t.subj, t.status, now - t.ago]
    );
  }
}

module.exports = { seed };
