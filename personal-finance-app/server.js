const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5050;

// Configured Credentials
const AUTH_CONFIG = {
  username: "chanthuvs",
  password: "Gango4@ntm",
  token: "token_chanthuvs_finpulse_9981"
};

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Baseline Data directly from User Screenshot ("July Baseline")
const DEFAULT_BASELINE = {
  month: "July 2026",
  salary: 116000,
  denatura: 0,
  currency: "₹",
  items: [
    { id: "gold_loan", name: "Gold loan", amount: 3600, dueDate: "1st", type: "loan", category: "Loans & EMIs", status: "pending", notes: "Monthly interest" },
    { id: "cred", name: "CRED Card Bill", amount: 3555, dueDate: "3rd", type: "credit_card", category: "Credit Cards", status: "pending", notes: "CRED bill payment" },
    { id: "ksfe_vatti_1", name: "KSFE Vatti #1", amount: 4552, dueDate: "7th", type: "ksfe", category: "KSFE Chitty", status: "pending", notes: "Chit fund vatti instalment" },
    { id: "ksfe_vatti_2", name: "KSFE Vatti #2", amount: 4552, dueDate: "7th", type: "ksfe", category: "KSFE Chitty", status: "pending", notes: "Chit fund vatti instalment" },
    { id: "ksfe_vatti_3", name: "KSFE Vatti #3", amount: 4552, dueDate: "7th", type: "ksfe", category: "KSFE Chitty", status: "pending", notes: "Chit fund vatti instalment" },
    { id: "ksfe_vatti_4", name: "KSFE Vatti #4", amount: 4552, dueDate: "7th", type: "ksfe", category: "KSFE Chitty", status: "pending", notes: "Chit fund vatti instalment" },
    { id: "lic_2", name: "LIC Policy 2", amount: 2500, dueDate: "7th", type: "lic", category: "Insurance", status: "pending", notes: "Life Insurance policy #2" },
    { id: "credit_card", name: "Credit Card (Primary)", amount: 5324, dueDate: "10th", type: "credit_card", category: "Credit Cards", status: "pending", notes: "Bank Credit Card statement" },
    { id: "credit_card_amma", name: "Credit Card (Amma)", amount: 3756, dueDate: "10th", type: "credit_card", category: "Credit Cards", status: "pending", notes: "Amma credit card bill" },
    { id: "lic_1", name: "LIC Policy 1", amount: 3008, dueDate: "15th", type: "lic", category: "Insurance", status: "pending", notes: "Life Insurance policy #1" },
    { id: "ksfe_chala", name: "KSFE Chala", amount: 18750, dueDate: "17th", type: "ksfe", category: "KSFE Chitty", status: "pending", notes: "Chitty instalment payment" },
    { id: "ksfe_vatti_new_1", name: "KSFE Vatti New #1", amount: 7750, dueDate: "24th", type: "ksfe", category: "KSFE Chitty", status: "pending", notes: "New chitty vatti" },
    { id: "ksfe_vatti_new_2", name: "KSFE Vatti New #2", amount: 7750, dueDate: "24th", type: "ksfe", category: "KSFE Chitty", status: "pending", notes: "New chitty vatti" },
    { id: "lic_3", name: "LIC Policy 3", amount: 1000, dueDate: "28th", type: "lic", category: "Insurance", status: "pending", notes: "Life Insurance policy #3" },
    { id: "homeloan", name: "Home Loan EMI", amount: 22579, dueDate: "Flexible", type: "loan", category: "Loans & EMIs", status: "pending", notes: "Housing Loan EMI" },
    { id: "personal_loan", name: "Personal Loan EMI", amount: 21034, dueDate: "Flexible", type: "loan", category: "Loans & EMIs", status: "pending", notes: "Bank Personal Loan EMI" },
    { id: "misc", name: "Misc / Untagged Buffer", amount: 2814, dueDate: "Ongoing", type: "misc", category: "Variable & Misc", status: "pending", notes: "Unallocated balance reserve" }
  ]
};

const DATA_FILE = path.join(__dirname, 'finance_data.json');
const SMS_FILE = path.join(__dirname, 'sms_log.json');

function loadBudgetData() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
      console.error("Error reading data:", e);
    }
  }
  return DEFAULT_BASELINE;
}

function saveBudgetData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function loadSMSLog() {
  if (fs.existsSync(SMS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(SMS_FILE, 'utf8'));
    } catch (e) {
      console.error("Error reading SMS log:", e);
    }
  }
  return [];
}

function saveSMSLog(log) {
  fs.writeFileSync(SMS_FILE, JSON.stringify(log, null, 2));
}

// Authentication Middleware
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace('Bearer ', '').trim() || req.headers['x-api-key'] || req.query.token;

  if (token === AUTH_CONFIG.token) {
    return next();
  }
  return res.status(401).json({ success: false, message: "Unauthorized. Please log in with valid credentials." });
}

// SMS Regex Parser
function parseSMS(text) {
  if (!text) return null;
  const raw = text.trim();
  let amount = null;
  let type = "debit";
  let merchant = "Unknown Merchant";
  let bank = "Bank SMS";
  let account = "";
  let category = "General";

  const amtMatch = raw.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i) || 
                   raw.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:rs\.?|inr|₹)/i) ||
                   raw.match(/(?:debited|credited|paid|spent)\s+(?:by|for|of)?\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  
  if (amtMatch) {
    amount = parseFloat(amtMatch[1].replace(/,/g, ''));
  }

  if (/credited|received|added|refund/i.test(raw)) {
    type = "credit";
  } else if (/debited|spent|paid|transferred|withdrawn|charged/i.test(raw)) {
    type = "debit";
  }

  if (/hdfc/i.test(raw)) bank = "HDFC Bank";
  else if (/sbi|state bank/i.test(raw)) bank = "SBI";
  else if (/icici/i.test(raw)) bank = "ICICI Bank";
  else if (/axis/i.test(raw)) bank = "Axis Bank";
  else if (/kvb|karur/i.test(raw)) bank = "KVB";
  else if (/federal/i.test(raw)) bank = "Federal Bank";
  else if (/south indian|sib/i.test(raw)) bank = "South Indian Bank";
  else if (/cred/i.test(raw)) bank = "CRED App";
  else if (/gpay|google pay/i.test(raw)) bank = "Google Pay";
  else if (/phonepe/i.test(raw)) bank = "PhonePe";
  else if (/paytm/i.test(raw)) bank = "Paytm";

  const accMatch = raw.match(/(?:a\/c|account|card|vpa|ending with|ending in)\s*([x\*\d]{4,})/i);
  if (accMatch) account = accMatch[1];

  if (/swiggy|zomato|eats|restaurant|food/i.test(raw)) {
    merchant = raw.match(/swiggy|zomato|restaurant/i)?.[0] || "Food & Dining";
    category = "Food & Dining";
  } else if (/ksfe|chala|vatti|chitty/i.test(raw)) {
    merchant = "KSFE Chitty / Vatti";
    category = "KSFE Chitty";
  } else if (/home loan|housing loan|loan emi/i.test(raw)) {
    merchant = "Home Loan EMI";
    category = "Loans & EMIs";
  } else if (/personal loan/i.test(raw)) {
    merchant = "Personal Loan EMI";
    category = "Loans & EMIs";
  } else if (/lic|insurance|premium/i.test(raw)) {
    merchant = "LIC Policy Premium";
    category = "Insurance";
  } else if (/cred|credit card/i.test(raw)) {
    merchant = "Credit Card Bill";
    category = "Credit Cards";
  } else if (/gold loan/i.test(raw)) {
    merchant = "Gold Loan Interest";
    category = "Loans & EMIs";
  } else if (/amazon|flipkart|myntra|shopping/i.test(raw)) {
    merchant = "Shopping / E-Commerce";
    category = "Shopping";
  } else if (/uber|ola|rapido|petrol|fuel|hpcl|bpcl|iocl/i.test(raw)) {
    merchant = "Transport / Fuel";
    category = "Transport";
  } else {
    const vpaMatch = raw.match(/(?:to|vpa|at|info:)\s*([a-zA-Z0-9\.\-_@]+)/i);
    if (vpaMatch && !/debited|credited|account|a\/c/i.test(vpaMatch[1])) {
      merchant = vpaMatch[1];
    }
  }

  return {
    rawText: raw,
    amount: amount || 0,
    type,
    bank,
    account,
    merchant,
    category,
    timestamp: new Date().toISOString(),
    parsedSuccessfully: amount !== null
  };
}

// PUBLIC ROUTES

// Login Endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === AUTH_CONFIG.username && password === AUTH_CONFIG.password) {
    return res.json({
      success: true,
      user: username,
      token: AUTH_CONFIG.token,
      message: "Authentication successful"
    });
  }
  return res.status(401).json({ success: false, message: "Invalid username or password" });
});

// PROTECTED ROUTES

// Get Budget Baseline
app.get('/api/budget', requireAuth, (req, res) => {
  const budget = loadBudgetData();
  res.json(budget);
});

// Update Budget Item Status
app.post('/api/budget/update', requireAuth, (req, res) => {
  const { itemId, status, amount, name, dueDate } = req.body;
  const budget = loadBudgetData();
  
  const item = budget.items.find(i => i.id === itemId);
  if (item) {
    if (status !== undefined) item.status = status;
    if (amount !== undefined) item.amount = parseFloat(amount);
    if (name !== undefined) item.name = name;
    if (dueDate !== undefined) item.dueDate = dueDate;
    saveBudgetData(budget);
    return res.json({ success: true, item, budget });
  }
  
  res.status(404).json({ success: false, message: "Item not found" });
});

// Reset Budget to Screenshot Baseline
app.post('/api/budget/reset', requireAuth, (req, res) => {
  saveBudgetData(DEFAULT_BASELINE);
  res.json({ success: true, budget: DEFAULT_BASELINE });
});

// GET SMS Logs
app.get('/api/sms', requireAuth, (req, res) => {
  const logs = loadSMSLog();
  res.json(logs);
});

// Ingest Incoming SMS Webhook (Allows token or open auto-capture for phone webhooks)
app.post('/api/sms/ingest', (req, res) => {
  let smsText = req.body.smsText || req.body.message || req.body.body || (typeof req.body === 'string' ? req.body : null);
  if (!smsText && req.body.text) smsText = req.body.text;

  if (!smsText) {
    return res.status(400).json({ success: false, message: "Missing smsText field in payload" });
  }

  const parsed = parseSMS(smsText);
  parsed.id = 'sms_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
  parsed.source = req.body.source || "Auto-Capture Ingest";

  const smsLogs = loadSMSLog();
  smsLogs.unshift(parsed);
  saveSMSLog(smsLogs);

  const budget = loadBudgetData();
  let matchedItem = null;

  if (parsed.amount > 0 && parsed.type === "debit") {
    matchedItem = budget.items.find(item => {
      if (item.status === 'paid') return false;
      const amtMatches = Math.abs(item.amount - parsed.amount) < 2;
      const nameKeywordMatches = item.name.toLowerCase().includes(parsed.merchant.toLowerCase()) ||
                                parsed.merchant.toLowerCase().includes(item.category.toLowerCase()) ||
                                (parsed.category === item.category);
      return amtMatches || (nameKeywordMatches && Math.abs(item.amount - parsed.amount) < 50);
    });

    if (matchedItem) {
      matchedItem.status = 'paid';
      matchedItem.matchedSmsId = parsed.id;
      matchedItem.paidTimestamp = new Date().toISOString();
      saveBudgetData(budget);
    }
  }

  res.json({
    success: true,
    parsed,
    reconciled: !!matchedItem,
    matchedItem: matchedItem || null,
    message: matchedItem ? `SMS parsed & automatically matched to ${matchedItem.name} (Marked as PAID!)` : "SMS parsed & added to live expense log."
  });
});

app.listen(PORT, () => {
  console.log(`Authenticated Personal Finance Assistant running on http://localhost:${PORT}`);
});
