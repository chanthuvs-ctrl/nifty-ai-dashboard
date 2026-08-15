const express = require('express');
const cors = require('cors');
const path = require('path');
const engine = require('./engine/automationEngine');

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes

// Campaigns
app.get('/api/campaigns', (req, res) => {
  res.json({ success: true, campaigns: engine.getCampaigns() });
});

app.post('/api/campaigns', (req, res) => {
  const newCmp = engine.createCampaign(req.body);
  res.status(201).json({ success: true, campaign: newCmp });
});

app.patch('/api/campaigns/:id/status', (req, res) => {
  const { status } = req.body;
  const updated = engine.updateCampaignStatus(req.params.id, status);
  if (!updated) {
    return res.status(404).json({ success: false, message: "Campaign not found" });
  }
  res.json({ success: true, campaign: updated });
});

// Offline Clinic Payments & Revenue Attribution
app.get('/api/clinic/payments', (req, res) => {
  res.json({ success: true, payments: engine.getClinicPayments() });
});

app.post('/api/clinic/payments', (req, res) => {
  const newPay = engine.recordClinicPayment(req.body);
  res.status(201).json({ success: true, payment: newPay });
});

// Automation Rules
app.get('/api/rules', (req, res) => {
  res.json({ success: true, rules: engine.getRules() });
});

app.post('/api/rules', (req, res) => {
  const newRule = engine.addRule(req.body);
  res.status(201).json({ success: true, rule: newRule });
});

app.post('/api/rules/:id/toggle', (req, res) => {
  const rule = engine.toggleRule(req.params.id);
  if (!rule) {
    return res.status(404).json({ success: false, message: "Rule not found" });
  }
  res.json({ success: true, rule });
});

app.post('/api/rules/evaluate', (req, res) => {
  const result = engine.evaluateRules();
  res.json({ success: true, result });
});

// AI Copy Generator
app.post('/api/ai/generate-ad-copy', (req, res) => {
  const { prompt, businessType } = req.body;
  const copy = engine.generateAdCopy(prompt, businessType);
  res.json({ success: true, adCopy: copy });
});

// Search Terms & Negatives
app.get('/api/keywords/search-terms', (req, res) => {
  res.json({ success: true, searchTerms: engine.searchTerms });
});

app.get('/api/keywords/negatives', (req, res) => {
  res.json({ success: true, negatives: engine.negativeKeywords });
});

app.post('/api/keywords/harvest-negatives', (req, res) => {
  const result = engine.harvestNegatives();
  res.json({ success: true, result });
});

// Performance Analytics
app.get('/api/analytics', (req, res) => {
  res.json({ success: true, analytics: engine.getAnalytics() });
});

// Execution Logs
app.get('/api/logs', (req, res) => {
  res.json({ success: true, logs: engine.executionLogs });
});

// Config & Mode Settings
app.get('/api/config', (req, res) => {
  res.json({ success: true, config: engine.configSettings });
});

app.post('/api/config', (req, res) => {
  Object.assign(engine.configSettings, req.body);
  res.json({ success: true, config: engine.configSettings });
});

// Setup Guide
app.get('/api/google-ads/setup-guide', (req, res) => {
  res.json({
    success: true,
    steps: [
      { step: 1, title: "Google Ads Account & Customer ID", desc: "Log into your Google Ads Manager / Account and copy your 10-digit Customer ID (e.g. 123-456-7890)." },
      { step: 2, title: "Enable Google Ads API & Developer Token", desc: "Create a Google Cloud Project, enable the Google Ads API, and generate a Developer Token from Tools & Settings -> API Center in Google Ads." },
      { step: 3, title: "Generate OAuth Credentials", desc: "Create OAuth 2.0 Web Client ID & Client Secret in Google Cloud Console. Obtain a Refresh Token using the OAuth Playground." },
      { step: 4, title: "Alternative: Google Ads Script Sync", desc: "If you don't have a developer token yet, paste our 1-click Google Ads Script into your account (Tools -> Scripts) to push campaign costs & fetch search terms automatically into this dashboard." }
    ]
  });
});


// AUTHENTICATION & LOGIN
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = engine.authenticateUser(username, password);
  if (!user) {
    return res.status(401).json({ success: false, message: "Invalid username or password" });
  }
  res.json({
    success: true,
    user,
    token: `token_${user.username}_${Date.now()}`
  });
});

// DAILY PERFORMANCE TRACKER API
app.get('/api/daily-performance', (req, res) => {
  res.json({ success: true, logs: engine.getDailyPerformanceLogs() });
});

app.post('/api/daily-performance', (req, res) => {
  const newLog = engine.addDailyPerformanceLog(req.body);
  res.status(201).json({ success: true, log: newLog });
});

app.get('/api/daily-performance/summary', (req, res) => {
  res.json({ success: true, summary: engine.getDailySummary() });
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 De Natura Aesthetics Google Ads Automation Dashboard`);
  console.log(`⚡ Running on http://localhost:${PORT}`);
  console.log(`💰 Currency: INR (₹)`);
  console.log(`====================================================`);
});
