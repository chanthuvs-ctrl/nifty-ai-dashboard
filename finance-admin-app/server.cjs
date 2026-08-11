const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5050;

const AUTH_CONFIG = {
  username: "chanthuvs",
  password: "Gango4@ntm",
  token: "token_chanthuvs_admin"
};

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

const SMS_FILE = path.join(__dirname, 'sms_log.json');

function loadSMSLog() {
  if (fs.existsSync(SMS_FILE)) {
    try { return JSON.parse(fs.readFileSync(SMS_FILE, 'utf8')); } catch (e) {}
  }
  return [];
}

function saveSMSLog(log) {
  fs.writeFileSync(SMS_FILE, JSON.stringify(log, null, 2));
}

// Ingest SMS Webhook
app.post('/api/sms/ingest', (req, res) => {
  let smsText = req.body.smsText || req.body.message || req.body.body || (typeof req.body === 'string' ? req.body : null);
  if (!smsText && req.body.text) smsText = req.body.text;

  if (!smsText) {
    return res.status(400).json({ success: false, message: "Missing smsText field" });
  }

  const raw = smsText.trim();
  let amount = 0;
  const amtMatch = raw.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i) || raw.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:rs\.?|inr|₹)/i);
  if (amtMatch) amount = parseFloat(amtMatch[1].replace(/,/g, ''));

  const parsed = {
    id: 'sms_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    rawText: raw,
    amount: amount || 0,
    type: /credited|received/i.test(raw) ? 'credit' : 'debit',
    bank: /hdfc/i.test(raw) ? 'HDFC Bank' : (/sbi/i.test(raw) ? 'SBI' : 'Bank SMS'),
    merchant: 'Bank Transaction',
    category: 'Auto Captured',
    timestamp: new Date().toISOString(),
    reconciled: true
  };

  const logs = loadSMSLog();
  logs.unshift(parsed);
  saveSMSLog(logs);

  res.json({ success: true, parsed, message: `SMS parsed and logged to admin dashboard!` });
});

// Single Page App fallback routing to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`De Natura Admin Finance Dashboard running at http://localhost:${PORT}`);
});
