/**
 * De Natura Aesthetics - Hair Care Google Ads & Landing Page Suite Client JS
 */

let revenueSpendChartInstance = null;
let roasChartInstance = null;
let currentAdCopyData = null;
let loadedCampaignsList = [];

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initModals();
  initForms();
  initChartContainers();
  loadAllDashboardData();
});

/* Tab Switching */
function initTabs() {
  const navItems = document.querySelectorAll('.nav-item');
  const panels = document.querySelectorAll('.tab-panel');
  const pageTitle = document.getElementById('pageTitle');
  const pageSubtitle = document.getElementById('pageSubtitle');

  const headers = {
    
    'daily-tracker': { title: "Daily Performance Tracker & Leads Audit", sub: "Alchemy Ads agency daily performance logs, lead breakdowns, ad spend, and realized clinic revenue for De Natura Aesthetics." },
    overview: { title: "Executive Overview", sub: "De Natura Aesthetics Trivandrum hair transplant & GFC Google Ads performance, in-clinic revenue attribution, and ROAS optimization." },
    revenue: { title: "In-Clinic Revenue & Patient Attribution", sub: "Log verified in-person clinic receipts to attribute real revenue (₹) back to Google Ads campaigns." },
    campaigns: { title: "Campaign Studio", sub: "Manage, create, and monitor automated Google Ads campaigns across channels." },
    landingpages: { title: "Service Landing Pages Suite", sub: "High-converting, surgeon & GFC landing pages optimized for Trivandrum Google Ads conversions." },
    rules: { title: "Automation Rules", sub: "Configure IF/THEN rules for automatic bidding, budget scaling, and campaign pausing." },
    keywords: { title: "Negative Harvester", sub: "Identify non-converting search terms and harvest negative keywords automatically." },
    logs: { title: "Execution Logs", sub: "Live stream of automated decisions executed by De Natura AI engine." },
    settings: { title: "Google Ads Connect", sub: "Configure Google Ads Customer ID, developer tokens, or 1-click script sync." }
  };

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.getAttribute('data-tab');
      navItems.forEach(n => n.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));

      item.classList.add('active');
      document.getElementById(`tab-${target}`).classList.add('active');

      if (headers[target]) {
        pageTitle.innerText = headers[target].title;
        pageSubtitle.innerText = headers[target].sub;
      }
    });
  });

  document.getElementById('refreshBtn').addEventListener('click', loadAllDashboardData);
  document.getElementById('runRulesBtn').addEventListener('click', runAutomationRules);
  document.getElementById('quickEvalBtn').addEventListener('click', runAutomationRules);
  document.getElementById('triggerRulesBtn').addEventListener('click', runAutomationRules);
  document.getElementById('quickHarvestBtn').addEventListener('click', runNegativeHarvester);
  document.getElementById('harvestBtn').addEventListener('click', runNegativeHarvester);
}

/* Modals */
function initModals() {
  const modal = document.getElementById('campaignModal');
  const openBtn = document.getElementById('openNewCampaignBtn');
  const closeBtn = document.getElementById('closeModalBtn');
  const cancelBtn = document.getElementById('cancelModalBtn');

  openBtn.addEventListener('click', () => modal.classList.add('active'));
  closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  cancelBtn.addEventListener('click', () => modal.classList.remove('active'));
}

/* Forms Initialization */
function initForms() {
  document.getElementById('payDate').value = new Date().toISOString().split('T')[0];

  const campaignForm = document.getElementById('campaignModalForm');
  campaignForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('newCmpName').value,
      channel: document.getElementById('newCmpChannel').value,
      dailyBudget: document.getElementById('newCmpBudget').value,
      adCopy: currentAdCopyData
    };

    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        document.getElementById('campaignModal').classList.remove('active');
        campaignForm.reset();
        currentAdCopyData = null;
        document.getElementById('aiCopyResult').classList.add('hidden');
        loadCampaigns();
        loadAnalytics();
      }
    } catch (err) {
      console.error("Error creating campaign:", err);
    }
  });

  const recordPaymentForm = document.getElementById('recordPaymentForm');
  recordPaymentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      patientName: document.getElementById('payPatientName').value,
      treatment: document.getElementById('payTreatment').value,
      amount: document.getElementById('payAmount').value,
      paymentDate: document.getElementById('payDate').value,
      campaignId: document.getElementById('payCampaignId').value
    };

    try {
      const res = await fetch('/api/clinic/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ In-Clinic Payment Recorded!\nPatient: ${data.payment.patientName}\nAmount: ₹${parseFloat(data.payment.amount).toLocaleString('en-IN')}\nAttributed ROAS recalculated successfully.`);
        recordPaymentForm.reset();
        document.getElementById('payDate').value = new Date().toISOString().split('T')[0];
        loadPayments();
        loadAnalytics();
        loadCampaigns();
      }
    } catch (err) {
      console.error("Error recording payment:", err);
    }
  });

  document.getElementById('generateAiCopyBtn').addEventListener('click', async () => {
    const brand = document.getElementById('aiBrandInput').value || "De Natura Aesthetics Hair Clinic Trivandrum";
    const channel = document.getElementById('newCmpChannel').value;

    try {
      const res = await fetch('/api/ai/generate-ad-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: brand, businessType: channel })
      });
      const data = await res.json();
      if (data.success) {
        currentAdCopyData = data.adCopy;
        renderAiCopyPreview(data.adCopy);
      }
    } catch (err) {
      console.error("Error generating AI copy:", err);
    }
  });

  document.getElementById('createRuleForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('ruleName').value,
      conditionMetric: document.getElementById('ruleMetric').value,
      operator: document.getElementById('ruleOperator').value,
      threshold: document.getElementById('ruleThreshold').value,
      action: document.getElementById('ruleAction').value,
      actionValue: document.getElementById('ruleActionVal').value
    };

    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        document.getElementById('createRuleForm').reset();
        loadRules();
      }
    } catch (err) {
      console.error("Error creating rule:", err);
    }
  });

  document.getElementById('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      mode: document.getElementById('configMode').value,
      customerId: document.getElementById('configCustomerId').value,
      developerToken: document.getElementById('configDevToken').value,
      clientId: document.getElementById('configClientId').value,
      clientSecret: document.getElementById('configClientSecret').value,
      refreshToken: document.getElementById('configRefreshToken').value
    };

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        alert("Account configuration & credentials updated successfully!");
        updateModeText(data.config.mode);
      }
    } catch (err) {
      console.error("Error saving config:", err);
    }
  });
}

function renderAiCopyPreview(copy) {
  const resultContainer = document.getElementById('aiCopyResult');
  resultContainer.classList.remove('hidden');

  const headlinesTags = document.getElementById('aiHeadlinesTags');
  headlinesTags.innerHTML = copy.headlines.map(h => `<span class="tag-item">${h}</span>`).join('');

  document.getElementById('aiDescPreview').innerText = copy.descriptions[0];

  if (copy.landingPageUrl) {
    document.getElementById('aiLandingPreview').innerText = copy.landingPageUrl;
  }

  const keywordsTags = document.getElementById('aiKeywordsTags');
  keywordsTags.innerHTML = copy.keywords.map(k => `<span class="tag-item" style="background: rgba(16, 185, 129, 0.15); color: #10b981;">${k.term} (${k.intentScore})</span>`).join('');

  if (copy.targetLocations) {
    const locTags = document.getElementById('aiLocationsTags');
    locTags.innerHTML = copy.targetLocations.map(l => `<span class="tag-item" style="background: rgba(99, 102, 241, 0.15); color: #6366f1;"><i class="fa-solid fa-location-dot"></i> ${l}</span>`).join('');
  }
}

/* Load All Data */
function loadAllDashboardData() {
  loadAnalytics();
  loadCampaigns();
  loadPayments();
  loadRules();
  loadKeywords();
  loadLogs();
  loadConfig();
}

async function loadAnalytics() {
  try {
    const res = await fetch('/api/analytics');
    const data = await res.json();
    if (data.success) {
      const s = data.analytics.summary;
      document.getElementById('kpiSpend').innerText = `₹${s.totalSpend.toLocaleString('en-IN')}`;
      document.getElementById('kpiRevenue').innerText = `₹${s.totalRevenue.toLocaleString('en-IN')}`;
      document.getElementById('kpiRoas').innerText = `${s.roas}x`;
      document.getElementById('kpiCpa').innerText = `₹${s.cpa.toLocaleString('en-IN', {maximumFractionDigits: 0})}`;

      renderCharts(data.analytics.trends);
    }
  } catch (err) {
    console.error("Error loading analytics:", err);
  }
}

async function loadCampaigns() {
  try {
    const res = await fetch('/api/campaigns');
    const data = await res.json();
    if (data.success) {
      loadedCampaignsList = data.campaigns;
      renderCampaignsTable(data.campaigns);
      populateCampaignSelectOptions(data.campaigns);
    }
  } catch (err) {
    console.error("Error loading campaigns:", err);
  }
}

function populateCampaignSelectOptions(campaigns) {
  const select = document.getElementById('payCampaignId');
  select.innerHTML = campaigns.map(c => `
    <option value="${c.id}">${c.name} (${c.channel})</option>
  `).join('');
}

function renderCampaignsTable(campaigns) {
  const tbody = document.getElementById('campaignsTableBody');
  tbody.innerHTML = campaigns.map(cmp => {
    const statusBadge = cmp.status === "ENABLED" 
      ? `<span class="badge badge-emerald">Active</span>`
      : `<span class="badge badge-amber">Paused</span>`;

    const channelBadge = cmp.channel === "SEARCH" 
      ? `<span class="tag-item">Search</span>`
      : `<span class="tag-item" style="color:#a855f7;">PMax</span>`;

    const landingPath = cmp.landingPageUrl ? cmp.landingPageUrl.replace("https://www.denaturaaesthetics.com", "") : "/landing/hair-transplant.html";

    return `
      <tr>
        <td>${statusBadge}</td>
        <td><strong>${cmp.name}</strong></td>
        <td>${channelBadge}</td>
        <td>₹${cmp.dailyBudget.toLocaleString('en-IN')}/day</td>
        <td>₹${cmp.targetCpa.toLocaleString('en-IN')}</td>
        <td>₹${cmp.cost.toLocaleString('en-IN')}</td>
        <td><strong style="color:#10b981;">₹${cmp.revenue.toLocaleString('en-IN')}</strong></td>
        <td>
          <a href="${landingPath}" target="_blank" style="color:#6366f1; font-weight:600; text-decoration:none;">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> Preview
          </a>
        </td>
        <td>
          <button onclick="toggleCampaignStatus('${cmp.id}', '${cmp.status === 'ENABLED' ? 'PAUSED' : 'ENABLED'}')" class="btn-secondary" style="padding:4px 10px; font-size:12px;">
            ${cmp.status === 'ENABLED' ? '<i class="fa-solid fa-pause"></i> Pause' : '<i class="fa-solid fa-play"></i> Enable'}
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

async function toggleCampaignStatus(id, newStatus) {
  try {
    const res = await fetch(`/api/campaigns/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (data.success) {
      loadCampaigns();
      loadAnalytics();
    }
  } catch (err) {
    console.error("Error toggling campaign status:", err);
  }
}

async function loadPayments() {
  try {
    const res = await fetch('/api/clinic/payments');
    const data = await res.json();
    if (data.success) {
      renderPaymentsTable(data.payments);
    }
  } catch (err) {
    console.error("Error loading payments:", err);
  }
}

function renderPaymentsTable(payments) {
  const tbody = document.getElementById('paymentsTableBody');
  tbody.innerHTML = payments.map(p => {
    const matchedCmp = loadedCampaignsList.find(c => c.id === p.campaignId);
    const cmpName = matchedCmp ? matchedCmp.name : p.campaignId;

    return `
      <tr>
        <td>${p.paymentDate}</td>
        <td><strong>${p.patientName}</strong></td>
        <td>${p.treatment}</td>
        <td><strong style="color:#10b981;">₹${parseFloat(p.amount).toLocaleString('en-IN')}</strong></td>
        <td><span class="tag-item">${cmpName}</span></td>
        <td><span class="badge badge-emerald">Verified</span></td>
      </tr>
    `;
  }).join('');
}

async function loadRules() {
  try {
    const res = await fetch('/api/rules');
    const data = await res.json();
    if (data.success) {
      renderRulesList(data.rules);
    }
  } catch (err) {
    console.error("Error loading rules:", err);
  }
}

function renderRulesList(rules) {
  const container = document.getElementById('rulesListContainer');
  container.innerHTML = rules.map(r => `
    <div class="rule-item">
      <div>
        <div class="rule-title">${r.name}</div>
        <div class="rule-desc">IF <strong>${r.conditionMetric}</strong> ${r.operator} <strong>${r.threshold}</strong> THEN <strong>${r.action}</strong> (${r.actionValue}%)</div>
      </div>
      <div>
        <button onclick="toggleRuleActive('${r.id}')" class="${r.enabled ? 'btn-primary' : 'btn-secondary'}" style="padding:6px 12px; font-size:12px;">
          ${r.enabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>
    </div>
  `).join('');
}

async function toggleRuleActive(id) {
  try {
    const res = await fetch(`/api/rules/${id}/toggle`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      loadRules();
    }
  } catch (err) {
    console.error("Error toggling rule:", err);
  }
}

async function runAutomationRules() {
  try {
    const res = await fetch('/api/rules/evaluate', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      alert(`⚡ Automation Evaluated!\nExecuted ${data.result.actionsExecuted} automated budget & bid adjustments.`);
      loadAllDashboardData();
    }
  } catch (err) {
    console.error("Error running rules:", err);
  }
}

async function loadKeywords() {
  try {
    const resTerms = await fetch('/api/keywords/search-terms');
    const dataTerms = await resTerms.json();

    const resNegs = await fetch('/api/keywords/negatives');
    const dataNegs = await resNegs.json();

    if (dataTerms.success) {
      renderSearchTerms(dataTerms.searchTerms);
    }
    if (dataNegs.success) {
      renderNegatives(dataNegs.negatives);
    }
  } catch (err) {
    console.error("Error loading keywords:", err);
  }
}

function renderSearchTerms(terms) {
  const tbody = document.getElementById('searchTermsTableBody');
  tbody.innerHTML = terms.map(t => {
    const statusBadge = t.status === "FLAGGED_WASTE"
      ? `<span class="badge badge-crimson">Flagged Waste</span>`
      : t.status === "ADDED_TO_NEGATIVES"
      ? `<span class="badge badge-amber">Harvested</span>`
      : `<span class="badge badge-emerald">Converting</span>`;

    return `
      <tr>
        <td><strong>${t.query}</strong></td>
        <td>${t.impressions}</td>
        <td>${t.clicks}</td>
        <td>₹${t.cost.toLocaleString('en-IN')}</td>
        <td>${t.conversions}</td>
        <td>${statusBadge}</td>
      </tr>
    `;
  }).join('');
}

function renderNegatives(negs) {
  const cloud = document.getElementById('negativesCloud');
  cloud.innerHTML = negs.map(n => `
    <span class="tag-item tag-negative">
      <i class="fa-solid fa-ban"></i> ${n.keyword} [${n.matchType}]
    </span>
  `).join('');
}

async function runNegativeHarvester() {
  try {
    const res = await fetch('/api/keywords/harvest-negatives', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      alert(`🧹 Negative Harvester Complete!\nAuto-added ${data.result.harvestedCount} new phrase-match negative keywords.`);
      loadKeywords();
      loadLogs();
    }
  } catch (err) {
    console.error("Error harvesting negatives:", err);
  }
}

async function loadLogs() {
  try {
    const res = await fetch('/api/logs');
    const data = await res.json();
    if (data.success) {
      const feed = document.getElementById('logsFeed');
      feed.innerHTML = data.logs.map(l => `
        <div class="log-entry">
          <span class="log-time">[${new Date(l.timestamp).toLocaleTimeString()}]</span>
          <span class="log-rule">${l.ruleName}</span> &rarr; 
          <span>${l.actionTaken}</span> (Campaign: <em>${l.campaign}</em>)
        </div>
      `).join('');
    }
  } catch (err) {
    console.error("Error loading logs:", err);
  }
}

async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    if (data.success) {
      const cfg = data.config;
      document.getElementById('configMode').value = cfg.mode;
      document.getElementById('configCustomerId').value = cfg.customerId;
      document.getElementById('configDevToken').value = cfg.developerToken;
      document.getElementById('configClientId').value = cfg.clientId;
      document.getElementById('configClientSecret').value = cfg.clientSecret;
      document.getElementById('configRefreshToken').value = cfg.refreshToken;

      updateModeText(cfg.mode);
    }
  } catch (err) {
    console.error("Error loading config:", err);
  }
}

function updateModeText(mode) {
  document.getElementById('modeStatusText').innerText = mode === "SIMULATOR" ? "SIMULATOR MODE (INR ₹)" : "LIVE GOOGLE ADS API (₹)";
}

/* Chart Initialization */
function initChartContainers() {
  Chart.defaults.color = '#9ca3af';
  Chart.defaults.font.family = 'Outfit, sans-serif';
}

function renderCharts(trends) {
  const ctx1 = document.getElementById('revenueSpendChart').getContext('2d');
  if (revenueSpendChartInstance) revenueSpendChartInstance.destroy();

  revenueSpendChartInstance = new Chart(ctx1, {
    type: 'line',
    data: {
      labels: trends.days,
      datasets: [
        {
          label: 'Clinic Revenue (₹)',
          data: trends.revenue,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4
        },
        {
          label: 'Ad Spend (₹)',
          data: trends.spend,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          fill: true,
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: {
        y: { grid: { color: 'rgba(255,255,255,0.05)' } },
        x: { grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });

  const ctx2 = document.getElementById('roasChart').getContext('2d');
  if (roasChartInstance) roasChartInstance.destroy();

  roasChartInstance = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: trends.days,
      datasets: [
        {
          label: 'Offline ROAS Multiple (x)',
          data: trends.roas,
          backgroundColor: '#8b5cf6',
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: {
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, min: 0 },
        x: { grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });
}


/* AUTHENTICATION & DAILY TRACKER LOGIC */
let dailyLogsData = [];
let dailyChartInstance = null;
let currentUser = null;

function checkAuthSession() {
  const savedUser = localStorage.getItem('denatura_user_session');
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      updateUserUI();
      document.getElementById('loginModal').classList.remove('active');
    } catch(e) {
      showLoginModal();
    }
  } else {
    showLoginModal();
  }
}

function showLoginModal() {
  document.getElementById('loginModal').classList.add('active');
}

function fillLogin(username, password) {
  document.getElementById('loginUsername').value = username;
  document.getElementById('loginPassword').value = password;
  document.getElementById('loginAlert').style.display = 'none';
}

async function handleLoginSubmit() {
  const uInput = document.getElementById('loginUsername').value.trim();
  const pInput = document.getElementById('loginPassword').value.trim();
  const alertEl = document.getElementById('loginAlert');
  const alertText = document.getElementById('loginAlertText');

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: uInput, password: pInput })
    });
    const data = await res.json();

    if (data.success) {
      currentUser = data.user;
      localStorage.setItem('denatura_user_session', JSON.stringify(currentUser));
      updateUserUI();
      document.getElementById('loginModal').classList.remove('active');
      loadDailyTrackerData();
    } else {
      alertText.innerText = data.message || "Invalid username or password";
      alertEl.style.display = 'flex';
    }
  } catch(e) {
    alertText.innerText = "Connection error. Please try again.";
    alertEl.style.display = 'flex';
  }
}

function updateUserUI() {
  if (!currentUser) return;
  const roleBadge = document.getElementById('userRoleBadge');
  if (roleBadge) {
    if (currentUser.role === 'AGENCY') {
      roleBadge.className = 'badge badge-gold';
      roleBadge.innerHTML = `<i class="fa-solid fa-user-astronaut"></i> ${currentUser.name}`;
    } else {
      roleBadge.className = 'badge badge-purple';
      roleBadge.innerHTML = `<i class="fa-solid fa-user-shield"></i> ${currentUser.name}`;
    }
  }
}

function handleLogout() {
  localStorage.removeItem('denatura_user_session');
  currentUser = null;
  showLoginModal();
}

/* Load Daily Tracker Data */
async function loadDailyTrackerData() {
  try {
    const [logsRes, summaryRes] = await Promise.all([
      fetch('/api/daily-performance'),
      fetch('/api/daily-performance/summary')
    ]);

    const logsJson = await logsRes.json();
    const summaryJson = await summaryRes.json();

    if (logsJson.success) {
      dailyLogsData = logsJson.logs;
      renderDailyTable();
      renderDailyChart();
    }

    if (summaryJson.success) {
      updateDailyKPIs(summaryJson.summary);
    }
  } catch (e) {
    console.error("Failed to load daily tracker data:", e);
  }
}

function updateDailyKPIs(summary) {
  if (!summary) return;
  document.getElementById('dtUniqueLeads').innerText = summary.totalUniqueLeads;
  document.getElementById('dtAdSpend').innerText = `₹${summary.totalAdSpend.toLocaleString('en-IN')}`;
  document.getElementById('dtAgencyCost').innerText = `₹${summary.totalAgencyCost.toLocaleString('en-IN')}`;
  document.getElementById('dtRevenue').innerText = `₹${summary.totalClinicRevenue.toLocaleString('en-IN')}`;
}

function renderDailyTable() {
  const tbody = document.getElementById('dailyLogsTableBody');
  const filterPlat = document.getElementById('filterPlatform').value;
  if (!tbody) return;

  tbody.innerHTML = '';

  let filtered = dailyLogsData;
  if (filterPlat !== 'ALL') {
    filtered = filtered.filter(l => l.platform.toLowerCase().includes(filterPlat.toLowerCase()));
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center">No daily logs matching selection</td></tr>`;
    return;
  }

  filtered.forEach(log => {
    const tr = document.createElement('tr');
    const hasRevenue = log.clinicRevenue > 0;
    
    tr.innerHTML = `
      <td><strong>${log.date}</strong></td>
      <td><span class="badge ${log.platform.includes('Facebook') ? 'badge-blue' : 'badge-purple'}">${log.platform}</span></td>
      <td>${log.service}</td>
      <td class="text-right">${log.leadsRaw}</td>
      <td class="text-right"><strong>${log.leadsUnique}</strong></td>
      <td class="text-right">₹${log.adSpend.toLocaleString('en-IN')}</td>
      <td class="text-right ${hasRevenue ? 'text-emerald fw-bold' : ''}">₹${log.clinicRevenue.toLocaleString('en-IN')}</td>
      <td class="text-right text-muted">₹${Math.round(log.agencyCost).toLocaleString('en-IN')}</td>
      <td>${hasRevenue ? `<span class="badge badge-emerald"><i class="fa-solid fa-check"></i> ${log.notes}</span>` : `<span class="text-muted">${log.notes || '-'}</span>`}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderDailyChart() {
  const ctx = document.getElementById('dailyLeadsChart');
  if (!ctx) return;

  const sortedLogs = [...dailyLogsData].reverse();
  const labels = sortedLogs.map(l => l.date.slice(5)); // MM-DD
  const leads = sortedLogs.map(l => l.leadsUnique);
  const revenue = sortedLogs.map(l => l.clinicRevenue);

  if (dailyChartInstance) {
    dailyChartInstance.destroy();
  }

  dailyChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Unique Leads',
          data: leads,
          borderColor: '#0D9488',
          backgroundColor: 'rgba(13, 148, 136, 0.1)',
          yAxisID: 'yLeads',
          fill: true,
          tension: 0.3
        },
        {
          label: 'Realized Revenue (₹)',
          data: revenue,
          borderColor: '#D97706',
          backgroundColor: 'rgba(217, 119, 6, 0.1)',
          yAxisID: 'yRevenue',
          fill: true,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        yLeads: {
          type: 'linear',
          position: 'left',
          title: { display: true, text: 'Unique Leads' }
        },
        yRevenue: {
          type: 'linear',
          position: 'right',
          title: { display: true, text: 'Revenue (₹)' },
          grid: { drawOnChartArea: false }
        }
      }
    }
  });
}

async function submitDailyLog() {
  const date = document.getElementById('dlDate').value;
  const platform = document.getElementById('dlPlatform').value;
  const leadsRaw = document.getElementById('dlLeadsRaw').value;
  const leadsUnique = document.getElementById('dlLeadsUnique').value;
  const adSpend = document.getElementById('dlAdSpend').value;
  const clinicRevenue = document.getElementById('dlRevenue').value;
  const service = document.getElementById('dlService').value;
  const notes = document.getElementById('dlNotes').value;

  try {
    const res = await fetch('/api/daily-performance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date, platform, leadsRaw, leadsUnique, adSpend, clinicRevenue, service, notes
      })
    });

    const data = await res.json();
    if (data.success) {
      document.getElementById('addDailyLogForm').reset();
      // Set today's date back
      document.getElementById('dlDate').valueAsDate = new Date();
      loadDailyTrackerData();
      alert("Daily performance log saved successfully!");
    }
  } catch(e) {
    alert("Failed to save record.");
  }
}

function exportDailyLogsCSV() {
  if (dailyLogsData.length === 0) return;
  let csv = "Date,Platform,Treatment Focus,Raw Leads,Unique Leads,Ad Spend (INR),Clinic Revenue (INR),Notes\n";

  dailyLogsData.forEach(l => {
    csv += `"${l.date}","${l.platform}","${l.service}",${l.leadsRaw},${l.leadsUnique},${l.adSpend},${l.clinicRevenue},"${l.notes.replace(/"/g, '""')}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.setAttribute('href', url);
  a.setAttribute('download', `De_Natura_Daily_Performance_${new Date().toISOString().split('T')[0]}.csv`);
  a.click();
}

// Hook into initial load
document.addEventListener('DOMContentLoaded', () => {
  checkAuthSession();
  loadDailyTrackerData();

  const dlDateInput = document.getElementById('dlDate');
  if (dlDateInput) {
    dlDateInput.valueAsDate = new Date();
  }
});
