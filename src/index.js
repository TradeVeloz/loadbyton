require('dotenv').config();
const crypto = require('node:crypto');
const path = require('node:path');
const express = require('express');
const cors = require('cors');

if (!process.env.JWT_SECRET) process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');

const { isEmpty } = require('./db');
const { seed } = require('./seed');
if (isEmpty()) seed();

const { router: authRouter } = require('./routes/auth');
const { router: requirementsRouter } = require('./routes/requirements');
const { router: bidsRouter, awardRouter } = require('./routes/bids');
const { router: messagesRouter } = require('./routes/messages');
const { router: documentsRouter } = require('./routes/documents');
const { router: adminRouter } = require('./routes/admin');
const { router: supportRouter } = require('./routes/support');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRouter);
app.use('/api/requirements', requirementsRouter);
app.use('/api/requirements/:id/bids', bidsRouter);
app.use('/api/requirements/:id/messages', messagesRouter);
app.use('/api/requirements/:id/documents', documentsRouter);
app.use('/api/bids', awardRouter);
app.use('/api/admin', adminRouter);
app.use('/api/support', supportRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

const PORT = process.env.PORT || 4100;
app.listen(PORT, () => console.log(`Loadbyton API running on http://localhost:${PORT}`));
