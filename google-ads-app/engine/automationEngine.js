/**
 * Google Ads Automation & Intelligence Engine - De Natura Aesthetics Master Edition
 * Covers ALL Clinic Treatment Categories: Hair Transplants, GFC Scalp Therapies,
 * Glutathione Drips, Laser Resurfacing, Botox/Fillers, & HydraFacial.
 * Currency: INR (₹) | Location: Trivandrum | Contact: +91 8137 093 028 | Doctor Fee: ₹300
 */

let campaigns = [
  {
    id: "cmp-101",
    name: "Search - Surgeon Hair Transplant (₹34,999 to ₹72,000)",
    channel: "SEARCH",
    status: "ENABLED",
    dailyBudget: 5000.00,
    targetCpa: 1500.00,
    targetRoas: 4.5,
    bidStrategy: "TARGET_CPA",
    impressions: 34500,
    clicks: 2820,
    cost: 45000.00,
    conversions: 38,
    revenue: 285000.00,
    keywordsCount: 28,
    adGroupCount: 4,
    healthScore: 98,
    lastOptimized: new Date(Date.now() - 3600000 * 2).toISOString(),
    landingPageUrl: "https://www.denaturaaesthetics.com/landing/hair-transplant.html"
  },
  {
    id: "cmp-102",
    name: "Search - Advanced GFC & Exosome Hair Therapy (₹5,999 + Free GFC)",
    channel: "SEARCH",
    status: "ENABLED",
    dailyBudget: 3500.00,
    targetCpa: 1200.00,
    targetRoas: 4.2,
    bidStrategy: "TARGET_ROAS",
    impressions: 24300,
    clicks: 1950,
    cost: 32000.00,
    conversions: 29,
    revenue: 165000.00,
    keywordsCount: 32,
    adGroupCount: 5,
    healthScore: 96,
    lastOptimized: new Date(Date.now() - 3600000 * 4).toISOString(),
    landingPageUrl: "https://www.denaturaaesthetics.com/landing/gfc-hair-treatment.html"
  },
  {
    id: "cmp-103",
    name: "Search - Glutathione Radiance Skin Drips (₹2,800 to ₹9,500)",
    channel: "SEARCH",
    status: "ENABLED",
    dailyBudget: 4000.00,
    targetCpa: 1300.00,
    targetRoas: 4.0,
    bidStrategy: "TARGET_CPA",
    impressions: 31200,
    clicks: 2150,
    cost: 38000.00,
    conversions: 31,
    revenue: 155000.00,
    keywordsCount: 30,
    adGroupCount: 4,
    healthScore: 95,
    lastOptimized: new Date(Date.now() - 3600000 * 6).toISOString(),
    landingPageUrl: "https://www.denaturaaesthetics.com/landing/glutathione-radiance.html"
  },
  {
    id: "cmp-104",
    name: "Performance Max - Laser Resurfacing & Acne Scars",
    channel: "PERFORMANCE_MAX",
    status: "ENABLED",
    dailyBudget: 4500.00,
    targetCpa: 1600.00,
    targetRoas: 3.8,
    bidStrategy: "MAXIMIZE_CONVERSION_VALUE",
    impressions: 48200,
    clicks: 2940,
    cost: 42000.00,
    conversions: 28,
    revenue: 170000.00,
    keywordsCount: 40,
    adGroupCount: 5,
    healthScore: 93,
    lastOptimized: new Date(Date.now() - 3600000 * 12).toISOString(),
    landingPageUrl: "https://www.denaturaaesthetics.com/landing/laser-skin-rejuvenation.html"
  },
  {
    id: "cmp-105",
    name: "Search - Anti-Aging Botox & Dermal Fillers",
    channel: "SEARCH",
    status: "ENABLED",
    dailyBudget: 3800.00,
    targetCpa: 1400.00,
    targetRoas: 4.1,
    bidStrategy: "TARGET_CPA",
    impressions: 22100,
    clicks: 1720,
    cost: 34000.00,
    conversions: 24,
    revenue: 145000.00,
    keywordsCount: 25,
    adGroupCount: 3,
    healthScore: 92,
    lastOptimized: new Date(Date.now() - 3600000 * 18).toISOString(),
    landingPageUrl: "https://www.denaturaaesthetics.com/landing/anti-aging-botox-fillers.html"
  }
];

let clinicPayments = [
  { id: "pay-101", patientName: "Rahul Verma", treatment: "Hair Transplant (2,500 Grafts)", amount: 48000, paymentDate: new Date(Date.now() - 86400000 * 1).toISOString().split('T')[0], campaignId: "cmp-101", status: "VERIFIED" },
  { id: "pay-102", patientName: "Ananya Nair", treatment: "Advanced GFC 3-Session Package", amount: 15999, paymentDate: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0], campaignId: "cmp-102", status: "VERIFIED" },
  { id: "pay-103", patientName: "Priya Sharma", treatment: "Glutathione 4-Dose Package", amount: 9500, paymentDate: new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0], campaignId: "cmp-103", status: "VERIFIED" },
  { id: "pay-104", patientName: "Sanjay Menon", treatment: "Hair Transplant (3,000 Grafts)", amount: 62000, paymentDate: new Date(Date.now() - 86400000 * 4).toISOString().split('T')[0], campaignId: "cmp-101", status: "VERIFIED" }
];

let rules = [
  {
    id: "rule-1",
    name: "Scale High ROAS Clinic Campaigns",
    conditionMetric: "ROAS",
    operator: "GREATER_THAN",
    threshold: 3.5,
    action: "INCREASE_BUDGET",
    actionValue: 15,
    frequency: "EVERY_6_HOURS",
    enabled: true,
    triggerCount: 28,
    lastTriggered: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: "rule-2",
    name: "Pause High CPA Underperformers",
    conditionMetric: "CPA",
    operator: "GREATER_THAN",
    threshold: 2500.0,
    action: "PAUSE_CAMPAIGN",
    actionValue: 0,
    frequency: "DAILY",
    enabled: true,
    triggerCount: 1,
    lastTriggered: new Date(Date.now() - 3600000 * 24).toISOString()
  },
  {
    id: "rule-3",
    name: "Auto-Harvest Wasteful Search Terms",
    conditionMetric: "WASTE_SPEND",
    operator: "GREATER_THAN",
    threshold: 1500.0,
    action: "ADD_NEGATIVE_KEYWORD",
    actionValue: 0,
    frequency: "HOURLY",
    enabled: true,
    triggerCount: 22,
    lastTriggered: new Date(Date.now() - 3600000 * 1).toISOString()
  }
];

let searchTerms = [
  { id: "st-1", query: "free hair transplant consultation pdf online", impressions: 420, clicks: 38, cost: 1850.00, conversions: 0, status: "FLAGGED_WASTE" },
  { id: "st-2", query: "best hair transplant doctor in trivandrum", impressions: 4850, clicks: 442, cost: 12400.00, conversions: 18, status: "CONVERTING" },
  { id: "st-3", query: "cheap DIY hair oil for baldness at home", impressions: 890, clicks: 76, cost: 2100.00, conversions: 0, status: "FLAGGED_WASTE" },
  { id: "st-4", query: "glutathione drip package pricing in trivandrum", impressions: 4100, clicks: 398, cost: 11200.00, conversions: 19, status: "CONVERTING" },
  { id: "st-5", query: "gfc hair treatment offer price trivandrum", impressions: 3630, clicks: 321, cost: 9590.00, conversions: 15, status: "CONVERTING" }
];

let negativeKeywords = [
  { keyword: "free", matchType: "PHRASE", addedAt: new Date(Date.now() - 86400000 * 5).toISOString(), addedByRule: "Auto-Harvest Wasteful Search Terms" },
  { keyword: "DIY", matchType: "EXACT", addedAt: new Date(Date.now() - 86400000 * 2).toISOString(), addedByRule: "Auto-Harvest Wasteful Search Terms" }
];

let executionLogs = [
  { id: "log-1", timestamp: new Date(Date.now() - 3600000 * 1).toISOString(), ruleName: "Auto-Harvest Wasteful Search Terms", actionTaken: "Added negative keyword 'free hair transplant consultation' (Spend ₹1,850, 0 conv)", campaign: "Search - Advanced GFC Hair Regrowth", status: "SUCCESS" },
  { id: "log-2", timestamp: new Date(Date.now() - 3600000 * 4).toISOString(), ruleName: "Scale High ROAS Clinic Campaigns", actionTaken: "Increased Daily Budget from ₹4,300 to ₹5,000 (+15%)", campaign: "Search - Surgeon Hair Transplant", status: "SUCCESS" }
];

let configSettings = {
  mode: "SIMULATOR",
  currency: "INR",
  currencySymbol: "₹",
  clinicName: "De Natura Aesthetics",
  clinicLocation: "Trivandrum, Kerala",
  contactNumber: "+91 8137 093 028",
  consultationFee: 300,
  developerToken: "DEV-TOK-SIMULATED-98214",
  clientId: "1098234729384-apps.googleusercontent.com",
  clientSecret: "••••••••••••••••",
  refreshToken: "1//04x-simulated-token-91823",
  customerId: "849-204-1192",
  aiModel: "Gemini-Pro-AdArchitect",
  autoRunIntervalMinutes: 30
,
  users,
  authenticateUser,
  getDailyPerformanceLogs,
  addDailyPerformanceLog,
  getDailySummary
};
// Functions

function getCampaigns() {
  return campaigns;
}

function createCampaign(data) {
  let defaultLanding = "https://www.denaturaaesthetics.com/landing/hair-transplant.html";
  if (data.name && data.name.toLowerCase().includes("gfc")) {
    defaultLanding = "https://www.denaturaaesthetics.com/landing/gfc-hair-treatment.html";
  } else if (data.name && data.name.toLowerCase().includes("glutathione")) {
    defaultLanding = "https://www.denaturaaesthetics.com/landing/glutathione-radiance.html";
  } else if (data.name && data.name.toLowerCase().includes("laser")) {
    defaultLanding = "https://www.denaturaaesthetics.com/landing/laser-skin-rejuvenation.html";
  } else if (data.name && data.name.toLowerCase().includes("botox")) {
    defaultLanding = "https://www.denaturaaesthetics.com/landing/anti-aging-botox-fillers.html";
  }

  const newCmp = {
    id: `cmp-${Date.now().toString().slice(-4)}`,
    name: data.name || "De Natura Automated Clinic Campaign",
    channel: data.channel || "SEARCH",
    status: "ENABLED",
    dailyBudget: parseFloat(data.dailyBudget) || 4000.0,
    targetCpa: parseFloat(data.targetCpa) || 1500.0,
    targetRoas: parseFloat(data.targetRoas) || 4.2,
    bidStrategy: data.bidStrategy || "TARGET_CPA",
    impressions: 0,
    clicks: 0,
    cost: 0.0,
    conversions: 0,
    revenue: 0.0,
    keywordsCount: data.keywords ? data.keywords.length : 8,
    adGroupCount: 2,
    healthScore: 100,
    lastOptimized: new Date().toISOString(),
    landingPageUrl: data.landingPageUrl || defaultLanding,
    adCopy: data.adCopy || null
  ,
  users,
  authenticateUser,
  getDailyPerformanceLogs,
  addDailyPerformanceLog,
  getDailySummary
};  campaigns.unshift(newCmp);
  return newCmp;
}

function updateCampaignStatus(id, status) {
  const cmp = campaigns.find(c => c.id === id);
  if (cmp) {
    cmp.status = status;
    cmp.lastOptimized = new Date().toISOString();
    return cmp;
  }
  return null;
}

function getClinicPayments() {
  return clinicPayments;
}

function recordClinicPayment(data) {
  const newPay = {
    id: `pay-${Date.now().toString().slice(-4)}`,
    patientName: data.patientName || "Anonymous Patient",
    treatment: data.treatment || "Clinic Treatment / Consultation",
    amount: parseFloat(data.amount) || 5000.0,
    paymentDate: data.paymentDate || new Date().toISOString().split('T')[0],
    campaignId: data.campaignId || campaigns[0].id,
    status: "VERIFIED"
  ,
  users,
  authenticateUser,
  getDailyPerformanceLogs,
  addDailyPerformanceLog,
  getDailySummary
};  clinicPayments.unshift(newPay);

  const cmp = campaigns.find(c => c.id === newPay.campaignId);
  if (cmp) {
    cmp.revenue += newPay.amount;
    cmp.conversions += 1;
  }

  return newPay;
}

function getRules() {
  return rules;
}

function addRule(ruleData) {
  const newRule = {
    id: `rule-${Date.now().toString().slice(-4)}`,
    name: ruleData.name || "Custom Optimization Rule",
    conditionMetric: ruleData.conditionMetric || "ROAS",
    operator: ruleData.operator || "GREATER_THAN",
    threshold: parseFloat(ruleData.threshold) || 3.5,
    action: ruleData.action || "INCREASE_BUDGET",
    actionValue: parseFloat(ruleData.actionValue) || 15,
    frequency: ruleData.frequency || "EVERY_6_HOURS",
    enabled: true,
    triggerCount: 0,
    lastTriggered: "Never"
  ,
  users,
  authenticateUser,
  getDailyPerformanceLogs,
  addDailyPerformanceLog,
  getDailySummary
};  rules.unshift(newRule);
  return newRule;
}

function toggleRule(id) {
  const rule = rules.find(r => r.id === id);
  if (rule) {
    rule.enabled = !rule.enabled;
    return rule;
  }
  return null;
}

function evaluateRules() {
  const newlyExecuted = [];
  const now = new Date().toISOString();

  rules.filter(r => r.enabled).forEach(rule => {
    campaigns.forEach(cmp => {
      let metricVal = 0;
      const roas = cmp.cost > 0 ? (cmp.revenue / cmp.cost) : 0;
      const cpa = cmp.conversions > 0 ? (cmp.cost / cmp.conversions) : cmp.cost;
      const convRate = cmp.clicks > 0 ? ((cmp.conversions / cmp.clicks) * 100) : 0;

      switch (rule.conditionMetric) {
        case "ROAS": metricVal = roas; break;
        case "CPA": metricVal = cpa; break;
        case "CONVERSION_RATE": metricVal = convRate; break;
        case "COST": metricVal = cmp.cost; break;
        default: metricVal = roas;
      }

      let conditionMet = false;
      if (rule.operator === "GREATER_THAN" && metricVal > rule.threshold) conditionMet = true;
      if (rule.operator === "LESS_THAN" && metricVal < rule.threshold) conditionMet = true;

      if (conditionMet && cmp.status === "ENABLED") {
        let actionDesc = "";
        if (rule.action === "INCREASE_BUDGET") {
          const oldBudget = cmp.dailyBudget;
          cmp.dailyBudget = Math.round(cmp.dailyBudget * (1 + rule.actionValue / 100));
          actionDesc = `Increased daily budget from ₹${oldBudget.toLocaleString('en-IN')} to ₹${cmp.dailyBudget.toLocaleString('en-IN')} (+${rule.actionValue}%)`;
        } else if (rule.action === "DECREASE_BUDGET") {
          const oldBudget = cmp.dailyBudget;
          cmp.dailyBudget = Math.max(1000, Math.round(cmp.dailyBudget * (1 - rule.actionValue / 100)));
          actionDesc = `Decreased daily budget from ₹${oldBudget.toLocaleString('en-IN')} to ₹${cmp.dailyBudget.toLocaleString('en-IN')} (-${rule.actionValue}%)`;
        } else if (rule.action === "PAUSE_CAMPAIGN") {
          cmp.status = "PAUSED";
          actionDesc = `Paused campaign due to ${rule.conditionMetric} (₹${metricVal.toFixed(0)}) breaching threshold ${rule.threshold}`;
        }

        if (actionDesc) {
          rule.triggerCount += 1;
          rule.lastTriggered = now;
          cmp.lastOptimized = now;

          const logEntry = {
            id: `log-${Date.now().toString().slice(-4)}`,
            timestamp: now,
            ruleName: rule.name,
            actionTaken: actionDesc,
            campaign: cmp.name,
            status: "SUCCESS"
          ,
  users,
  authenticateUser,
  getDailyPerformanceLogs,
  addDailyPerformanceLog,
  getDailySummary
};          executionLogs.unshift(logEntry);
          newlyExecuted.push(logEntry);
        }
      }
    });
  });

  return {
    evaluatedCount: rules.filter(r => r.enabled).length,
    actionsExecuted: newlyExecuted.length,
    newLogs: newlyExecuted
  ,
  users,
  authenticateUser,
  getDailyPerformanceLogs,
  addDailyPerformanceLog,
  getDailySummary
};}

// AI Ad Copy Generator for All Treatments
function generateAdCopy(prompt, businessType = "Cosmetic Clinic") {
  const brand = prompt || "De Natura Aesthetics Trivandrum";

  let landingPageUrl = "https://www.denaturaaesthetics.com/landing/hair-transplant.html";
  if (prompt.toLowerCase().includes("gfc") || prompt.toLowerCase().includes("exosome")) {
    landingPageUrl = "https://www.denaturaaesthetics.com/landing/gfc-hair-treatment.html";
  } else if (prompt.toLowerCase().includes("glutathione") || prompt.toLowerCase().includes("glow")) {
    landingPageUrl = "https://www.denaturaaesthetics.com/landing/glutathione-radiance.html";
  } else if (prompt.toLowerCase().includes("laser") || prompt.toLowerCase().includes("scar")) {
    landingPageUrl = "https://www.denaturaaesthetics.com/landing/laser-skin-rejuvenation.html";
  } else if (prompt.toLowerCase().includes("botox") || prompt.toLowerCase().includes("filler")) {
    landingPageUrl = "https://www.denaturaaesthetics.com/landing/anti-aging-botox-fillers.html";
  }

  return {
    businessContext: brand,
    landingPageUrl: landingPageUrl,
    consultationFee: "₹300 Doctor Fee",
    contactPhone: "+91 8137 093 028",
    headlines: [
      `De Natura Aesthetics Trivandrum`,
      `Top Rated Skin, Hair & Aesthetics`,
      `Surgeon Hair Transplant ₹34,999`,
      `Glutathione & GFC Special Offers`,
      `Book Doctor Consult ₹300`
    ],
    descriptions: [
      `Transform your hair & skin confidence at De Natura Aesthetics Trivandrum. 100% Surgeon-performed hair transplants & dermatologist skin therapies.`,
      `Special Clinic Offers: Advanced GFC Free Session Bonuses, Glutathione Skin Glow Bundles, and Laser Resurfacing.`,
      `Trivandrum's premier cosmetic clinic. Book doctor assessment for ₹300. Call or WhatsApp 8137093028.`
    ],
    callouts: [
      "Trivandrum Clinic",
      "₹300 Doctor Consult",
      "Surgeon Performed",
      "Special Onam Offers"
    ],
    keywords: [
      { term: "best aesthetic skin hair clinic trivandrum", matchType: "EXACT", intentScore: "99%" },
      { term: "hair transplant starting price trivandrum", matchType: "PHRASE", intentScore: "98%" },
      { term: "glutathione glow drip offer trivandrum", matchType: "PHRASE", intentScore: "96%" },
      { term: "advanced gfc hair treatment package", matchType: "PHRASE", intentScore: "95%" },
      { term: "laser skin resurfacing clinic trivandrum", matchType: "BROAD", intentScore: "90%" }
    ],
    targetLocations: ["Trivandrum", "Kollam", "Kottayam", "Kochi", "Kerala"],
    generatedAt: new Date().toISOString()
  ,
  users,
  authenticateUser,
  getDailyPerformanceLogs,
  addDailyPerformanceLog,
  getDailySummary
};}

function harvestNegatives() {
  const flagged = searchTerms.filter(st => st.status === "FLAGGED_WASTE");
  const added = [];

  flagged.forEach(st => {
    const wordList = st.query.split(" ");
    const keywordToAdd = wordList.find(w => ["free", "cheap", "diy", "pdf", "random", "home"].includes(w.toLowerCase())) || st.query;

    if (!negativeKeywords.some(nk => nk.keyword.toLowerCase() === keywordToAdd.toLowerCase())) {
      const newNeg = {
        keyword: keywordToAdd,
        matchType: "PHRASE",
        addedAt: new Date().toISOString(),
        addedByRule: "Auto-Harvest Wasteful Search Terms"
      ,
  users,
  authenticateUser,
  getDailyPerformanceLogs,
  addDailyPerformanceLog,
  getDailySummary
};      negativeKeywords.unshift(newNeg);
      added.push(newNeg);
    }
    st.status = "ADDED_TO_NEGATIVES";
  });

  return {
    harvestedCount: added.length,
    newNegatives: added
  ,
  users,
  authenticateUser,
  getDailyPerformanceLogs,
  addDailyPerformanceLog,
  getDailySummary
};}

function getAnalytics() {
  const totalSpend = campaigns.reduce((acc, c) => acc + c.cost, 0);
  const totalRevenue = campaigns.reduce((acc, c) => acc + c.revenue, 0);
  const totalConversions = campaigns.reduce((acc, c) => acc + c.conversions, 0);
  const totalClicks = campaigns.reduce((acc, c) => acc + c.clicks, 0);
  const totalImpressions = campaigns.reduce((acc, c) => acc + c.impressions, 0);

  const roas = totalSpend > 0 ? (totalRevenue / totalSpend) : 0;
  const cpa = totalConversions > 0 ? (totalSpend / totalConversions) : 0;
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100) : 0;

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const trendSpend = [22000, 25000, 27500, 31000, 34000, 39000, 28500];
  const trendRevenue = [105000, 128000, 138000, 165000, 185000, 215000, 145000];
  const trendRoas = trendSpend.map((s, idx) => parseFloat((trendRevenue[idx] / s).toFixed(2)));

  return {
    summary: {
      totalSpend: parseFloat(totalSpend.toFixed(2)),
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalConversions,
      totalClicks,
      totalImpressions,
      roas: parseFloat(roas.toFixed(2)),
      cpa: parseFloat(cpa.toFixed(2)),
      ctr: parseFloat(ctr.toFixed(2)),
      activeCampaignsCount: campaigns.filter(c => c.status === "ENABLED").length,
      pausedCampaignsCount: campaigns.filter(c => c.status === "PAUSED").length,
      currency: "INR",
      currencySymbol: "₹",
      clinicLocation: "Trivandrum, Kerala",
      contactNumber: "+91 8137 093 028",
      consultationFee: 300
    },
    trends: {
      days,
      spend: trendSpend,
      revenue: trendRevenue,
      roas: trendRoas
    }
  ,
  users,
  authenticateUser,
  getDailyPerformanceLogs,
  addDailyPerformanceLog,
  getDailySummary
};}


// User Authentication Store
const users = [
  { username: "admin", password: "admin123", role: "ADMIN", name: "Clinic Administrator" },
  { username: "alchemy_ads", password: "alchemy123", role: "AGENCY", name: "Alchemy Ads Performance Manager" }
];

// Daily Performance Records (De Natura Campaign Dataset)
const dailyPerformanceLogs = [
  { id: "dp-1", date: "2026-07-07", platform: "Facebook", service: "PRP / GFC Hair Treatment", leadsRaw: 3, leadsUnique: 2, adSpend: 850, clinicRevenue: 300, agencyCost: 1017, notes: "Arun s Nair consulted (₹300)" },
  { id: "dp-2", date: "2026-07-08", platform: "Facebook", service: "Hair Transplant Planning", leadsRaw: 4, leadsUnique: 3, adSpend: 900, clinicRevenue: 0, agencyCost: 1017, notes: "Follow ups scheduled" },
  { id: "dp-3", date: "2026-07-09", platform: "Instagram", service: "Acne Scars / Marks", leadsRaw: 7, leadsUnique: 6, adSpend: 1100, clinicRevenue: 0, agencyCost: 1017, notes: "Midhun Raj & Amina details given" },
  { id: "dp-4", date: "2026-07-10", platform: "Facebook", service: "Hair Fall / Hair Thinning", leadsRaw: 5, leadsUnique: 4, adSpend: 950, clinicRevenue: 300, agencyCost: 1017, notes: "Vishnu S R consulted (₹300)" },
  { id: "dp-5", date: "2026-07-11", platform: "Facebook", service: "Acne Scars / Marks", leadsRaw: 3, leadsUnique: 2, adSpend: 750, clinicRevenue: 0, agencyCost: 1017, notes: "Arun Chandran message sent" },
  { id: "dp-6", date: "2026-07-12", platform: "Instagram", service: "Acne Scars / Marks", leadsRaw: 4, leadsUnique: 2, adSpend: 800, clinicRevenue: 0, agencyCost: 1017, notes: "Aswathy Nair call back" },
  { id: "dp-7", date: "2026-07-13", platform: "Facebook", service: "Glutathione IV & Hair Fall", leadsRaw: 6, leadsUnique: 4, adSpend: 1200, clinicRevenue: 5600, agencyCost: 1017, notes: "Dr. Fathima Sameer (₹5,300) & Nisam AR (₹300) consulted" },
  { id: "dp-8", date: "2026-07-14", platform: "Instagram", service: "Acne Scars / Marks", leadsRaw: 4, leadsUnique: 3, adSpend: 850, clinicRevenue: 300, agencyCost: 1017, notes: "Abhijithantony consulted (₹300)" },
  { id: "dp-9", date: "2026-07-15", platform: "Facebook", service: "Acne Scars / Marks", leadsRaw: 2, leadsUnique: 1, adSpend: 600, clinicRevenue: 0, agencyCost: 1017, notes: "Priyanka Priya follow up" },
  { id: "dp-10", date: "2026-07-16", platform: "Instagram", service: "Acne Scars / Marks", leadsRaw: 2, leadsUnique: 1, adSpend: 600, clinicRevenue: 0, agencyCost: 1017, notes: "Surya Thejas WhatsApp sent" },
  { id: "dp-11", date: "2026-07-17", platform: "Facebook", service: "PRP / GFC & Hair Transplant", leadsRaw: 5, leadsUnique: 4, adSpend: 950, clinicRevenue: 0, agencyCost: 1017, notes: "Aswathy Vishak & Bro Ken Heart" },
  { id: "dp-12", date: "2026-07-21", platform: "Instagram", service: "PRP / GFC & Acne Marks", leadsRaw: 5, leadsUnique: 4, adSpend: 900, clinicRevenue: 0, agencyCost: 1017, notes: "Nishad & Vineeth promised visit" },
  { id: "dp-13", date: "2026-07-22", platform: "Facebook", service: "PRP / GFC Hair Treatment", leadsRaw: 8, leadsUnique: 6, adSpend: 1300, clinicRevenue: 20220, agencyCost: 1017, notes: "Zeena Beegam converted (₹20,220)" },
  { id: "dp-14", date: "2026-07-23", platform: "Facebook", service: "General Products Dynamic", leadsRaw: 8, leadsUnique: 5, adSpend: 1100, clinicRevenue: 0, agencyCost: 1017, notes: "Anilkumar & Lino Lopzz" },
  { id: "dp-15", date: "2026-07-24", platform: "Facebook & IG", service: "Hair Transplant & Acne Marks", leadsRaw: 12, leadsUnique: 4, adSpend: 1400, clinicRevenue: 0, agencyCost: 1017, notes: "Sreekanth SR & Nandakishore call back" },
  { id: "dp-16", date: "2026-07-25", platform: "Instagram", service: "PRP / GFC Hair Treatment", leadsRaw: 3, leadsUnique: 2, adSpend: 750, clinicRevenue: 0, agencyCost: 1017, notes: "Palode Sreejith looking GFC" },
  { id: "dp-17", date: "2026-07-26", platform: "Instagram", service: "Acne Scars / Marks", leadsRaw: 3, leadsUnique: 2, adSpend: 750, clinicRevenue: 0, agencyCost: 1017, notes: "Hafsal Hyder Ali scheduled next week" },
  { id: "dp-18", date: "2026-07-27", platform: "Facebook", service: "Pigmentation & Acne Marks", leadsRaw: 7, leadsUnique: 4, adSpend: 1050, clinicRevenue: 0, agencyCost: 1017, notes: "Ajitha S S appointment Aug 5" },
  { id: "dp-19", date: "2026-07-28", platform: "Facebook", service: "Pigmentation / Melasma / Tan", leadsRaw: 2, leadsUnique: 1, adSpend: 500, clinicRevenue: 0, agencyCost: 1017, notes: "Sindhu S hydrafacial details" },
  { id: "dp-20", date: "2026-07-29", platform: "Facebook & IG", service: "Hair Transplant & Mole Removal", leadsRaw: 6, leadsUnique: 5, adSpend: 1000, clinicRevenue: 0, agencyCost: 1017, notes: "Siraj Trivandrum & Kiran Sathya" },
  { id: "dp-21", date: "2026-07-30", platform: "Facebook", service: "Hair Transplant Planning", leadsRaw: 8, leadsUnique: 7, adSpend: 1250, clinicRevenue: 3374, agencyCost: 1017, notes: "Cifin Kc converted (₹3,374)" },
  { id: "dp-22", date: "2026-07-31", platform: "Facebook", service: "PRP / GFC Hair Treatment", leadsRaw: 2, leadsUnique: 1, adSpend: 500, clinicRevenue: 0, agencyCost: 1017, notes: "Murugan will inform" },
  { id: "dp-23", date: "2026-08-03", platform: "Facebook", service: "Hair Transplant Planning", leadsRaw: 2, leadsUnique: 1, adSpend: 500, clinicRevenue: 0, agencyCost: 1017, notes: "Balakrishnan Kundil thin donor" },
  { id: "dp-24", date: "2026-08-04", platform: "Facebook", service: "PRP / GFC & Hair Fall", leadsRaw: 8, leadsUnique: 6, adSpend: 1200, clinicRevenue: 300, agencyCost: 1017, notes: "Prasanth GS consulted (₹300), Sanal & Sreekandan visit" },
  { id: "dp-25", date: "2026-08-05", platform: "Facebook & IG", service: "Hair Fall & Medi Facial", leadsRaw: 7, leadsUnique: 6, adSpend: 1100, clinicRevenue: 0, agencyCost: 1017, notes: "Shabu AV & Vinod Kumar call back" },
  { id: "dp-26", date: "2026-08-06", platform: "Facebook & IG", service: "Hair Transplant & PRP GFC", leadsRaw: 5, leadsUnique: 4, adSpend: 1000, clinicRevenue: 0, agencyCost: 1017, notes: "Sunil Lal & Chandu Nair coming next week, Arya Sundaresan post-Onam" },
  { id: "dp-27", date: "2026-08-07", platform: "Facebook & IG", service: "Acne Scars & Hair Fall", leadsRaw: 6, leadsUnique: 5, adSpend: 1000, clinicRevenue: 0, agencyCost: 1017, notes: "Dileep D & Nihas Rasheed leave issue" },
  { id: "dp-28", date: "2026-08-10", platform: "Instagram", service: "PRP / GFC Hair Treatment", leadsRaw: 2, leadsUnique: 1, adSpend: 500, clinicRevenue: 0, agencyCost: 1017, notes: "Anu out of district (Kottayam)" },
  { id: "dp-29", date: "2026-08-11", platform: "Facebook", service: "Pigmentation / Melasma / Tan", leadsRaw: 2, leadsUnique: 1, adSpend: 500, clinicRevenue: 0, agencyCost: 1017, notes: "Sleena D Saimol follow up" }
];

function authenticateUser(username, password) {
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return null;
  return { username: user.username, role: user.role, name: user.name ,
  users,
  authenticateUser,
  getDailyPerformanceLogs,
  addDailyPerformanceLog,
  getDailySummary
};}

function getDailyPerformanceLogs() {
  return dailyPerformanceLogs;
}

function addDailyPerformanceLog(data) {
  const newLog = {
    id: `dp-${Date.now()}`,
    date: data.date || new Date().toISOString().split('T')[0],
    platform: data.platform || "Facebook",
    service: data.service || "General Consulting",
    leadsRaw: parseInt(data.leadsRaw) || 0,
    leadsUnique: parseInt(data.leadsUnique) || 0,
    adSpend: parseFloat(data.adSpend) || 0,
    clinicRevenue: parseFloat(data.clinicRevenue) || 0,
    agencyCost: parseFloat(data.agencyCost) || 1017, // ~₹29,500 / 29 days
    notes: data.notes || ""
  ,
  users,
  authenticateUser,
  getDailyPerformanceLogs,
  addDailyPerformanceLog,
  getDailySummary
};  dailyPerformanceLogs.unshift(newLog);
  return newLog;
}

function getDailySummary() {
  const totalAdSpend = dailyPerformanceLogs.reduce((acc, l) => acc + l.adSpend, 0);
  const totalClinicRevenue = dailyPerformanceLogs.reduce((acc, l) => acc + l.clinicRevenue, 0);
  const totalAgencyCost = 29500; // ₹25,000 + 18% GST
  const totalCost = totalAdSpend + totalAgencyCost;
  const totalRawLeads = dailyPerformanceLogs.reduce((acc, l) => acc + l.leadsRaw, 0);
  const totalUniqueLeads = dailyPerformanceLogs.reduce((acc, l) => acc + l.leadsUnique, 0);
  const totalConversions = 8; // Converted paying clients in dataset
  
  const cplAdSpend = totalUniqueLeads > 0 ? (totalAdSpend / totalUniqueLeads) : 0;
  const cplTotalCost = totalUniqueLeads > 0 ? (totalCost / totalUniqueLeads) : 0;
  const cpaAdSpend = totalConversions > 0 ? (totalAdSpend / totalConversions) : 0;
  const cpaTotalCost = totalConversions > 0 ? (totalCost / totalConversions) : 0;
  const roasAdSpend = totalAdSpend > 0 ? ((totalClinicRevenue / totalAdSpend) * 100) : 0;
  const roiOverall = totalCost > 0 ? (((totalClinicRevenue - totalCost) / totalCost) * 100) : 0;
  
  return {
    totalAdSpend,
    totalAgencyCost,
    totalCost,
    totalClinicRevenue,
    netProfitAdSpend: totalClinicRevenue - totalAdSpend,
    netProfitOverall: totalClinicRevenue - totalCost,
    totalRawLeads,
    totalUniqueLeads,
    totalConversions,
    cplAdSpend: parseFloat(cplAdSpend.toFixed(2)),
    cplTotalCost: parseFloat(cplTotalCost.toFixed(2)),
    cpaAdSpend: parseFloat(cpaAdSpend.toFixed(2)),
    cpaTotalCost: parseFloat(cpaTotalCost.toFixed(2)),
    roasAdSpend: parseFloat((totalClinicRevenue / totalAdSpend).toFixed(2)),
    roiOverall: parseFloat(roiOverall.toFixed(1)),
    currency: "INR",
    currencySymbol: "₹"
  };
}

module.exports = {
  getCampaigns,
  createCampaign,
  updateCampaignStatus,
  getClinicPayments,
  recordClinicPayment,
  getRules,
  addRule,
  toggleRule,
  evaluateRules,
  generateAdCopy,
  harvestNegatives,
  getAnalytics,
  searchTerms,
  negativeKeywords,
  executionLogs,
  configSettings,
  users,
  authenticateUser,
  getDailyPerformanceLogs,
  addDailyPerformanceLog,
  getDailySummary
};
