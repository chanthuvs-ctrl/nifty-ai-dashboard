// WealthPulse AI - Main Application & UI Controller

import { FinancialStore } from './dataModel.js';
import { calculateFinancialSummary } from './financialEngine.js';
import { runDebtPayoffOptimization } from './loanOptimizer.js';
import { queryAIBrain } from './aiBrain.js';

const store = new FinancialStore();
let currentData = store.data;
let summary = calculateFinancialSummary(currentData);

// Chart Instances
let assetChart = null;
let fireChart = null;
let loanTimelineChart = null;

document.addEventListener('DOMContentLoaded', () => {
  initNavigationTabs();
  renderAllViews();
  bindFormEvents();
  bindAIChatEvents();
  bindModalEvents();
  bindFullProfileEditorEvents();
});

// 1. NAVIGATION TABS
function initNavigationTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');

      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => {
        c.classList.add('hidden');
        c.classList.remove('block');
      });

      btn.classList.add('active');
      const targetContent = document.getElementById(tabId);
      if (targetContent) {
        targetContent.classList.remove('hidden');
        targetContent.classList.add('block');
      }

      if (tabId === 'tab-overview') renderAssetChart();
      if (tabId === 'tab-projections') renderProjectionCharts();
    });
  });
}

// 2. MAIN RENDER PIPELINE
function renderAllViews() {
  summary = calculateFinancialSummary(currentData);

  renderHeaderKPIs();
  renderSnapshotKPIs();
  renderAssetListContainers();
  renderOptimizerTab();
  renderAssetChart();
  renderProjectionCharts();
}

function renderHeaderKPIs() {
  document.getElementById('header-health-score').innerText = `${summary.healthScore} / 100`;
  document.getElementById('header-health-bar').style.height = `${summary.healthScore}%`;

  document.getElementById('header-fire-days').innerHTML = `${summary.daysToFIRE.toLocaleString()} Days <span id="header-fire-years" class="text-xs font-normal text-slate-400">(${summary.yearsToFIRE} yrs)</span>`;
  document.getElementById('header-dti-val').innerHTML = `${summary.dtiPct.toFixed(1)}% <span class="text-[10px] text-slate-400 font-normal">(${summary.dtiStatus})</span>`;
}

function renderSnapshotKPIs() {
  document.getElementById('kpi-net-worth').innerText = `₹${summary.netWorth.toLocaleString()}`;
  document.getElementById('kpi-liquid-networth').innerText = `₹${(summary.liquidNetWorth / 100000).toFixed(1)}L`;

  document.getElementById('kpi-monthly-income').innerText = `₹${summary.grossMonthlyIncome.toLocaleString()}`;
  document.getElementById('kpi-monthly-surplus').innerText = `₹${summary.netMonthlySurplus.toLocaleString()}/mo`;

  document.getElementById('kpi-monthly-debt').innerText = `₹${summary.totalMonthlyDebtCommitment.toLocaleString()}`;
  document.getElementById('kpi-dti-ratio').innerText = `${summary.dtiPct.toFixed(1)}%`;

  document.getElementById('kpi-total-assets').innerText = `₹${(summary.totalAssets / 10000000).toFixed(2)} Cr`;
  document.getElementById('kpi-total-liabilities').innerText = `₹${(summary.totalLiabilities / 100000).toFixed(1)}L`;
  document.getElementById('kpi-chit-liability').innerText = `₹${(summary.chitRemainingLiability / 100000).toFixed(1)}L`;

  // Financial Health Audit Card
  document.getElementById('audit-score-badge').innerText = `${summary.healthScore} / 100`;
  document.getElementById('audit-dti-status').innerText = `${summary.dtiPct.toFixed(1)}% (${summary.dtiStatus})`;
  document.getElementById('audit-emergency-status').innerText = `₹${(summary.liquidAssets/100000).toFixed(1)}L (${(summary.liquidAssets / (summary.essentialMonthly || 1)).toFixed(1)} Mos)`;
  document.getElementById('audit-term-status').innerText = `₹${(summary.totalTermCover / 10000000).toFixed(2)} Cr (${summary.isTermAdequate ? 'Adequate' : 'Gap Exists'})`;
}

function renderAssetListContainers() {
  // Sync inputs
  document.getElementById('inp-salary').value = currentData.income.monthlySalary || 0;
  document.getElementById('inp-bonus').value = currentData.income.monthlyBonus || 0;
  document.getElementById('inp-sideincome').value = currentData.income.sideIncome || 0;

  document.getElementById('inp-essential-exp').value = currentData.expenses.essentialMonthly || 0;
  document.getElementById('inp-discretionary-exp').value = currentData.expenses.discretionaryMonthly || 0;
  document.getElementById('inp-mf-sip').value = currentData.mutualFunds.monthlySIPAmount || 0;

  // 1. Render Loans List with Inline Edit/Delete
  const loansContainer = document.getElementById('loans-list-container');
  loansContainer.innerHTML = '';

  if (currentData.loans.length === 0) {
    loansContainer.innerHTML = '<div class="text-slate-500 italic text-[11px] p-2 text-center">No active loans. Click "+ Add Loan" above to add one.</div>';
  } else {
    currentData.loans.forEach((loan, idx) => {
      const div = document.createElement('div');
      div.className = 'p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs relative group';
      div.innerHTML = `
        <div class="flex justify-between font-semibold">
          <span class="text-slate-200">${loan.name}</span>
          <div class="flex items-center gap-2">
            <span class="text-rose-400 font-bold">₹${loan.principalOutstanding.toLocaleString()}</span>
            <button data-delete-loan="${loan.id}" class="btn-del-item text-slate-500 hover:text-rose-400 text-xs px-1" title="Delete Loan">🗑️</button>
          </div>
        </div>
        <div class="flex justify-between text-[11px] text-slate-400">
          <span>EMI: ₹${loan.monthlyEMI.toLocaleString()}/mo @ ${loan.interestRatePct}%</span>
          <span>${loan.remainingMonths} mos left</span>
        </div>
      `;
      loansContainer.appendChild(div);
    });
  }

  // 2. Render Chit Funds List with Inline Edit/Delete
  const chitsContainer = document.getElementById('chits-list-container');
  chitsContainer.innerHTML = '';

  if (currentData.chitFunds.length === 0) {
    chitsContainer.innerHTML = '<div class="text-slate-500 italic text-[11px] p-2 text-center">No active chit funds. Click "+ Add Chit" above to add one.</div>';
  } else {
    currentData.chitFunds.forEach((chit) => {
      const remainingVal = chit.monthlyInstallment * chit.remainingMonths;
      const div = document.createElement('div');
      div.className = 'p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs relative group';
      div.innerHTML = `
        <div class="flex justify-between font-semibold">
          <span class="text-slate-200">${chit.name}</span>
          <div class="flex items-center gap-2">
            <span class="text-amber-400 font-bold">Liab: ₹${remainingVal.toLocaleString()}</span>
            <button data-delete-chit="${chit.id}" class="btn-del-item text-slate-500 hover:text-amber-400 text-xs px-1" title="Delete Chit Scheme">🗑️</button>
          </div>
        </div>
        <div class="flex justify-between text-[11px] text-slate-400">
          <span>Installment: ₹${chit.monthlyInstallment.toLocaleString()}/mo</span>
          <span class="text-emerald-400 font-semibold">Payout: ₹${chit.auctionPayoutAvailable.toLocaleString()}</span>
        </div>
      `;
      chitsContainer.appendChild(div);
    });
  }

  // 3. Render Properties List
  const propsContainer = document.getElementById('props-list-container');
  propsContainer.innerHTML = '';
  let totalPropVal = 0;

  if (currentData.realAssets.properties.length === 0) {
    propsContainer.innerHTML = '<div class="text-slate-500 italic text-[11px] p-2 text-center">No real estate properties listed. Click "+ Add Property" above.</div>';
  } else {
    currentData.realAssets.properties.forEach((prop) => {
      totalPropVal += prop.estimatedMarketValue;
      const div = document.createElement('div');
      div.className = 'p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs relative group';
      div.innerHTML = `
        <div class="flex justify-between font-semibold">
          <span class="text-slate-200">${prop.name} (${prop.type})</span>
          <div class="flex items-center gap-2">
            <span class="text-indigo-400 font-bold">₹${(prop.estimatedMarketValue/100000).toFixed(1)}L</span>
            <button data-delete-prop="${prop.id}" class="btn-del-item text-slate-500 hover:text-indigo-400 text-xs px-1" title="Delete Property">🗑️</button>
          </div>
        </div>
        <div class="flex justify-between text-[11px] text-slate-400">
          <span>Appreciation: ${prop.annualAppreciationPct}%/yr</span>
          <span>Rent: ₹${prop.monthlyRentalIncome || 0}/mo</span>
        </div>
      `;
      propsContainer.appendChild(div);
    });
  }

  // Gold Valuation Card updates
  const gold = currentData.realAssets.gold || {};
  const totalGrams = (gold.physicalGoldGrams || 0) + (gold.sgbGrams || 0) + (gold.digitalGoldGrams || 0);
  const goldValueTotal = totalGrams * (gold.pricePerGramINR || 7250);

  document.getElementById('gold-total-val').innerText = `₹${(goldValueTotal / 100000).toFixed(2)} Lakhs`;
  document.getElementById('gold-grams-breakdown').innerText = `Physical (${gold.physicalGoldGrams || 0}g) + SGB (${gold.sgbGrams || 0}g) + Digital (${gold.digitalGoldGrams || 0}g) @ ₹${gold.pricePerGramINR || 7250}/g`;

  // Attach Inline Delete Listeners
  document.querySelectorAll('[data-delete-loan]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-delete-loan');
      currentData.loans = currentData.loans.filter(l => l.id !== id);
      store.saveToStorage();
      renderAllViews();
    });
  });

  document.querySelectorAll('[data-delete-chit]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-delete-chit');
      currentData.chitFunds = currentData.chitFunds.filter(c => c.id !== id);
      store.saveToStorage();
      renderAllViews();
    });
  });

  document.querySelectorAll('[data-delete-prop]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-delete-prop');
      currentData.realAssets.properties = currentData.realAssets.properties.filter(p => p.id !== id);
      store.saveToStorage();
      renderAllViews();
    });
  });
}

// 3. CHARTS RENDERING
function renderAssetChart() {
  const ctx = document.getElementById('chart-asset-allocation')?.getContext('2d');
  if (!ctx) return;

  if (assetChart) assetChart.destroy();

  assetChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Mutual Funds', 'Real Estate', 'Gold Assets', 'ULIP Insurance', 'Trading Capital'],
      datasets: [{
        data: [
          summary.mfCorpus,
          summary.realEstateValueTotal,
          summary.goldValueTotal,
          summary.ulipCorpus,
          summary.tradingCapital
        ],
        backgroundColor: [
          '#10b981', // emerald
          '#6366f1', // indigo
          '#eab308', // yellow
          '#f43f5e', // rose
          '#06b6d4'  // cyan
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 11 } }
        }
      },
      cutout: '70%'
    }
  });
}

function renderProjectionCharts() {
  document.getElementById('proj-fire-days').innerText = summary.daysToFIRE.toLocaleString();
  document.getElementById('proj-fire-years').innerText = `${summary.yearsToFIRE} Years`;
  document.getElementById('proj-fire-target').innerText = `₹${(summary.fireTargetCorpus / 10000000).toFixed(2)} Crores`;
  document.getElementById('proj-fire-year').innerText = summary.fireTargetYear;

  const ctxFire = document.getElementById('chart-fire-projection')?.getContext('2d');
  if (ctxFire) {
    if (fireChart) fireChart.destroy();

    const labels = [];
    const netWorthData = [];
    const targetData = [];
    const currentYear = new Date().getFullYear();

    let curInv = summary.mfCorpus + summary.tradingCapital;
    let curSIP = currentData.mutualFunds.monthlySIPAmount;
    const cagrM = (currentData.mutualFunds.expectedCAGRPct || 12.0) / 12 / 100;
    const hikeA = (currentData.income.expectedAnnualHikePct || 8.0) / 100;
    let annualExp = summary.totalAnnualExpense;

    for (let y = 0; y <= 25; y += 2) {
      labels.push(`${currentYear + y}`);
      netWorthData.push(Math.round(curInv / 100000));
      targetData.push(Math.round((annualExp * 25) / 100000));

      for (let m = 0; m < 24; m++) {
        curInv = (curInv * (1 + cagrM)) + curSIP;
        if ((m + 1) % 12 === 0) {
          curSIP *= (1 + hikeA);
          annualExp *= 1.06;
        }
      }
    }

    fireChart = new Chart(ctxFire, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Projected Net Worth (₹ Lakhs)',
            data: netWorthData,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: true,
            tension: 0.3
          },
          {
            label: 'FIRE Target Corpus (₹ Lakhs)',
            data: targetData,
            borderColor: '#6366f1',
            borderDash: [5, 5],
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: '#64748b' }, grid: { display: false } },
          y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(51, 65, 85, 0.3)' } }
        },
        plugins: {
          legend: { labels: { color: '#94a3b8' } }
        }
      }
    });
  }

  const ctxTimeline = document.getElementById('chart-loan-timeline')?.getContext('2d');
  if (ctxTimeline) {
    if (loanTimelineChart) loanTimelineChart.destroy();

    const loanLabels = [];
    const loanMonths = [];

    currentData.loans.forEach(l => {
      loanLabels.push(l.name);
      loanMonths.push(l.remainingMonths);
    });

    currentData.chitFunds.forEach(c => {
      loanLabels.push(`${c.name} (Chit)`);
      loanMonths.push(c.remainingMonths);
    });

    loanTimelineChart = new Chart(ctxTimeline, {
      type: 'bar',
      data: {
        labels: loanLabels.length ? loanLabels : ['No Debt!'],
        datasets: [{
          label: 'Months Remaining to Pay Off',
          data: loanMonths.length ? loanMonths : [0],
          backgroundColor: ['#f43f5e', '#fbbf24', '#f59e0b', '#06b6d4'],
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        scales: {
          x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(51, 65, 85, 0.3)' } },
          y: { ticks: { color: '#94a3b8' }, grid: { display: false } }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }
}

// 4. OPTIMIZER TAB & SLIDERS
function renderOptimizerTab() {
  const extraPrepayment = parseInt(document.getElementById('slider-prepayment')?.value || 5000);
  document.getElementById('slider-prepay-val').innerText = `₹${extraPrepayment.toLocaleString()}`;

  const optResults = runDebtPayoffOptimization(currentData, extraPrepayment);

  document.getElementById('opt-avalanche-saved').innerText = `₹${optResults.avalanche.interestSaved.toLocaleString()}`;
  document.getElementById('opt-avalanche-months').innerText = `${optResults.avalanche.monthsSaved} Months`;

  document.getElementById('opt-snowball-saved').innerText = `₹${optResults.snowball.interestSaved.toLocaleString()}`;
  document.getElementById('opt-snowball-months').innerText = `${optResults.snowball.monthsSaved} Months`;

  const suggestionsContainer = document.getElementById('debt-suggestions-container');
  suggestionsContainer.innerHTML = '';

  optResults.suggestions.forEach(s => {
    const card = document.createElement('div');
    card.className = 'glass-card p-4 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-1.5 text-xs';
    card.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="font-bold text-white">${s.title}</span>
        <span class="px-2 py-0.5 rounded-md font-extrabold text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">${s.badge}</span>
      </div>
      <p class="text-slate-300 leading-relaxed">${s.text}</p>
    `;
    suggestionsContainer.appendChild(card);
  });
}

// 5. COMPREHENSIVE PROFILE EDITOR MODAL CONTROLLER
function bindFullProfileEditorEvents() {
  const editorModal = document.getElementById('modal-full-editor');

  const openEditor = () => {
    populateEditorFields();
    editorModal.classList.remove('hidden');
  };

  const closeEditor = () => editorModal.classList.add('hidden');

  document.getElementById('btn-open-profile-editor')?.addEventListener('click', openEditor);
  document.getElementById('btn-open-full-editor-tab')?.addEventListener('click', openEditor);
  document.getElementById('btn-tab-quick-edit')?.addEventListener('click', openEditor);
  document.getElementById('btn-edit-header-mobile')?.addEventListener('click', openEditor);
  document.getElementById('btn-edit-gold-inline')?.addEventListener('click', () => {
    openEditor();
    switchEditorTab('ed-tab-assets');
  });

  document.getElementById('editor-btn-close')?.addEventListener('click', closeEditor);
  document.getElementById('editor-btn-cancel')?.addEventListener('click', closeEditor);

  // Editor Tabs switching
  const edTabBtns = document.querySelectorAll('.ed-tab-btn');
  const edTabContents = document.querySelectorAll('.ed-tab-content');

  const switchEditorTab = (targetId) => {
    edTabBtns.forEach(b => {
      b.classList.remove('bg-slate-800', 'text-emerald-400');
      b.classList.add('text-slate-400');
    });
    edTabContents.forEach(c => {
      c.classList.add('hidden');
      c.classList.remove('block');
    });

    const activeBtn = Array.from(edTabBtns).find(b => b.getAttribute('data-editor-tab') === targetId);
    if (activeBtn) {
      activeBtn.classList.add('bg-slate-800', 'text-emerald-400');
      activeBtn.classList.remove('text-slate-400');
    }
    const targetContent = document.getElementById(targetId);
    if (targetContent) {
      targetContent.classList.remove('hidden');
      targetContent.classList.add('block');
    }
  };

  edTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      switchEditorTab(btn.getAttribute('data-editor-tab'));
    });
  });

  // Editor Add Item Buttons
  document.getElementById('ed-btn-add-loan')?.addEventListener('click', () => {
    currentData.loans.push({
      id: `loan_${Date.now()}`,
      name: "New Personal Loan",
      type: "Personal",
      principalOutstanding: 200000,
      interestRatePct: 13.0,
      monthlyEMI: 6500,
      remainingMonths: 36
    });
    renderEditorLoansTable();
  });

  document.getElementById('ed-btn-add-chit')?.addEventListener('click', () => {
    currentData.chitFunds.push({
      id: `chit_${Date.now()}`,
      name: "New Chit Scheme",
      monthlyInstallment: 10000,
      totalMonths: 20,
      remainingMonths: 15,
      totalValue: 200000,
      auctionPayoutAvailable: 160000
    });
    renderEditorChitsTable();
  });

  document.getElementById('ed-btn-add-prop')?.addEventListener('click', () => {
    currentData.realAssets.properties.push({
      id: `prop_${Date.now()}`,
      name: "New Plot / House",
      type: "Land/Plot",
      estimatedMarketValue: 1500000,
      annualAppreciationPct: 7.0,
      monthlyRentalIncome: 0
    });
    renderEditorPropsTable();
  });

  // Blank profile button inside editor
  document.getElementById('editor-btn-blank')?.addEventListener('click', () => {
    if (confirm("Clear all existing profile data and start completely blank?")) {
      currentData = store.startBlankProfile();
      renderAllViews();
      closeEditor();
    }
  });

  // Save All Changes button
  document.getElementById('editor-btn-save-all')?.addEventListener('click', () => {
    // 1. Income & Expenses
    currentData.income.monthlySalary = parseFloat(document.getElementById('ed-inp-salary').value) || 0;
    currentData.income.monthlyBonus = parseFloat(document.getElementById('ed-inp-bonus').value) || 0;
    currentData.income.sideIncome = parseFloat(document.getElementById('ed-inp-sideincome').value) || 0;
    currentData.income.expectedAnnualHikePct = parseFloat(document.getElementById('ed-inp-hike').value) || 8.0;

    currentData.expenses.essentialMonthly = parseFloat(document.getElementById('ed-inp-essential').value) || 0;
    currentData.expenses.discretionaryMonthly = parseFloat(document.getElementById('ed-inp-discretionary').value) || 0;

    // 2. Investments & Insurance
    currentData.mutualFunds.currentCorpusValue = parseFloat(document.getElementById('ed-inp-mf-corpus').value) || 0;
    currentData.mutualFunds.monthlySIPAmount = parseFloat(document.getElementById('ed-inp-mf-sip').value) || 0;
    currentData.mutualFunds.expectedCAGRPct = parseFloat(document.getElementById('ed-inp-mf-cagr').value) || 12.0;

    currentData.tradingPnL.capitalAllocated = parseFloat(document.getElementById('ed-inp-trading-cap').value) || 0;
    currentData.tradingPnL.monthlyAveragePnL = parseFloat(document.getElementById('ed-inp-trading-pnl').value) || 0;

    if (!currentData.insurance.termPolicies.length) {
      currentData.insurance.termPolicies.push({ id: "term_1", name: "Term Cover", sumAssured: 10000000, annualPremium: 15000, isActive: true });
    }
    currentData.insurance.termPolicies[0].sumAssured = parseFloat(document.getElementById('ed-inp-term-cover').value) || 0;

    // 3. Gold Assets
    currentData.realAssets.gold = {
      physicalGoldGrams: parseFloat(document.getElementById('ed-inp-gold-physical').value) || 0,
      sgbGrams: parseFloat(document.getElementById('ed-inp-gold-sgb').value) || 0,
      digitalGoldGrams: parseFloat(document.getElementById('ed-inp-gold-digital').value) || 0,
      pricePerGramINR: parseFloat(document.getElementById('ed-inp-gold-rate').value) || 7250
    };

    store.saveToStorage();
    renderAllViews();
    closeEditor();

    alert('✅ All Financial Details Saved Successfully!');
  });
}

function populateEditorFields() {
  document.getElementById('ed-inp-salary').value = currentData.income.monthlySalary || 0;
  document.getElementById('ed-inp-bonus').value = currentData.income.monthlyBonus || 0;
  document.getElementById('ed-inp-sideincome').value = currentData.income.sideIncome || 0;
  document.getElementById('ed-inp-hike').value = currentData.income.expectedAnnualHikePct || 8;

  document.getElementById('ed-inp-essential').value = currentData.expenses.essentialMonthly || 0;
  document.getElementById('ed-inp-discretionary').value = currentData.expenses.discretionaryMonthly || 0;

  document.getElementById('ed-inp-mf-corpus').value = currentData.mutualFunds.currentCorpusValue || 0;
  document.getElementById('ed-inp-mf-sip').value = currentData.mutualFunds.monthlySIPAmount || 0;
  document.getElementById('ed-inp-mf-cagr').value = currentData.mutualFunds.expectedCAGRPct || 12;

  document.getElementById('ed-inp-trading-cap').value = currentData.tradingPnL.capitalAllocated || 0;
  document.getElementById('ed-inp-trading-pnl').value = currentData.tradingPnL.monthlyAveragePnL || 0;

  const termCover = (currentData.insurance.termPolicies || [])[0]?.sumAssured || 15000000;
  document.getElementById('ed-inp-term-cover').value = termCover;

  const gold = currentData.realAssets.gold || {};
  document.getElementById('ed-inp-gold-physical').value = gold.physicalGoldGrams || 0;
  document.getElementById('ed-inp-gold-sgb').value = gold.sgbGrams || 0;
  document.getElementById('ed-inp-gold-digital').value = gold.digitalGoldGrams || 0;
  document.getElementById('ed-inp-gold-rate').value = gold.pricePerGramINR || 7250;

  renderEditorLoansTable();
  renderEditorChitsTable();
  renderEditorPropsTable();
}

function renderEditorLoansTable() {
  const container = document.getElementById('ed-loans-table-container');
  container.innerHTML = '';

  currentData.loans.forEach((loan, idx) => {
    const div = document.createElement('div');
    div.className = 'grid grid-cols-1 sm:grid-cols-5 gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 items-center';
    div.innerHTML = `
      <input type="text" value="${loan.name}" onchange="currentData.loans[${idx}].name=this.value" class="col-span-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white font-semibold">
      <div><span class="text-[10px] text-slate-500 block">Principal</span><input type="number" value="${loan.principalOutstanding}" onchange="currentData.loans[${idx}].principalOutstanding=parseFloat(this.value)" class="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white"></div>
      <div><span class="text-[10px] text-slate-500 block">Interest %</span><input type="number" value="${loan.interestRatePct}" onchange="currentData.loans[${idx}].interestRatePct=parseFloat(this.value)" class="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white"></div>
      <div><span class="text-[10px] text-slate-500 block">Monthly EMI</span><input type="number" value="${loan.monthlyEMI}" onchange="currentData.loans[${idx}].monthlyEMI=parseFloat(this.value)" class="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white"></div>
      <div class="flex items-center justify-between">
        <div><span class="text-[10px] text-slate-500 block">Mos Left</span><input type="number" value="${loan.remainingMonths}" onchange="currentData.loans[${idx}].remainingMonths=parseInt(this.value)" class="w-16 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white"></div>
        <button onclick="currentData.loans.splice(${idx},1); renderEditorLoansTable();" class="text-rose-400 hover:text-rose-300 font-bold p-1">✕</button>
      </div>
    `;
    container.appendChild(div);
  });
}

function renderEditorChitsTable() {
  const container = document.getElementById('ed-chits-table-container');
  container.innerHTML = '';

  currentData.chitFunds.forEach((chit, idx) => {
    const div = document.createElement('div');
    div.className = 'grid grid-cols-1 sm:grid-cols-5 gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 items-center';
    div.innerHTML = `
      <input type="text" value="${chit.name}" onchange="currentData.chitFunds[${idx}].name=this.value" class="col-span-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white font-semibold">
      <div><span class="text-[10px] text-slate-500 block">Installment/mo</span><input type="number" value="${chit.monthlyInstallment}" onchange="currentData.chitFunds[${idx}].monthlyInstallment=parseFloat(this.value)" class="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white"></div>
      <div><span class="text-[10px] text-slate-500 block">Remaining Mos</span><input type="number" value="${chit.remainingMonths}" onchange="currentData.chitFunds[${idx}].remainingMonths=parseInt(this.value)" class="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white"></div>
      <div><span class="text-[10px] text-slate-500 block">Auction Payout</span><input type="number" value="${chit.auctionPayoutAvailable}" onchange="currentData.chitFunds[${idx}].auctionPayoutAvailable=parseFloat(this.value)" class="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white"></div>
      <div class="flex justify-end">
        <button onclick="currentData.chitFunds.splice(${idx},1); renderEditorChitsTable();" class="text-amber-400 hover:text-amber-300 font-bold p-1">✕</button>
      </div>
    `;
    container.appendChild(div);
  });
}

function renderEditorPropsTable() {
  const container = document.getElementById('ed-props-table-container');
  container.innerHTML = '';

  currentData.realAssets.properties.forEach((prop, idx) => {
    const div = document.createElement('div');
    div.className = 'grid grid-cols-1 sm:grid-cols-4 gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 items-center';
    div.innerHTML = `
      <input type="text" value="${prop.name}" onchange="currentData.realAssets.properties[${idx}].name=this.value" class="col-span-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white font-semibold">
      <div><span class="text-[10px] text-slate-500 block">Market Value</span><input type="number" value="${prop.estimatedMarketValue}" onchange="currentData.realAssets.properties[${idx}].estimatedMarketValue=parseFloat(this.value)" class="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white"></div>
      <div><span class="text-[10px] text-slate-500 block">Apprec % / Rent</span><input type="number" value="${prop.monthlyRentalIncome || 0}" onchange="currentData.realAssets.properties[${idx}].monthlyRentalIncome=parseFloat(this.value)" class="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white" placeholder="Rent/mo"></div>
      <div class="flex justify-end">
        <button onclick="currentData.realAssets.properties.splice(${idx},1); renderEditorPropsTable();" class="text-indigo-400 hover:text-indigo-300 font-bold p-1">✕</button>
      </div>
    `;
    container.appendChild(div);
  });
}

// 6. FORM SAVING & QUICK ACTIONS
function bindFormEvents() {
  document.getElementById('btn-save-portfolio')?.addEventListener('click', () => {
    currentData.income.monthlySalary = parseFloat(document.getElementById('inp-salary').value) || 0;
    currentData.income.monthlyBonus = parseFloat(document.getElementById('inp-bonus').value) || 0;
    currentData.income.sideIncome = parseFloat(document.getElementById('inp-sideincome').value) || 0;

    currentData.expenses.essentialMonthly = parseFloat(document.getElementById('inp-essential-exp').value) || 0;
    currentData.expenses.discretionaryMonthly = parseFloat(document.getElementById('inp-discretionary-exp').value) || 0;
    currentData.mutualFunds.monthlySIPAmount = parseFloat(document.getElementById('inp-mf-sip').value) || 0;

    store.saveToStorage();
    renderAllViews();

    alert('✅ Financial Portfolio Saved & Updated!');
  });

  document.getElementById('btn-start-blank-portfolio')?.addEventListener('click', () => {
    if (confirm("Clear all data and start blank profile?")) {
      currentData = store.startBlankProfile();
      renderAllViews();
    }
  });

  document.getElementById('btn-blank-data')?.addEventListener('click', () => {
    if (confirm("Clear all data and start blank profile?")) {
      currentData = store.startBlankProfile();
      renderAllViews();
    }
  });

  document.getElementById('btn-add-loan-inline')?.addEventListener('click', () => {
    currentData.loans.push({
      id: `loan_${Date.now()}`,
      name: "New Personal Loan",
      type: "Personal",
      principalOutstanding: 200000,
      interestRatePct: 13.0,
      monthlyEMI: 6500,
      remainingMonths: 36
    });
    store.saveToStorage();
    renderAllViews();
  });

  document.getElementById('btn-add-chit-inline')?.addEventListener('click', () => {
    currentData.chitFunds.push({
      id: `chit_${Date.now()}`,
      name: "New Chit Scheme",
      monthlyInstallment: 10000,
      totalMonths: 20,
      remainingMonths: 15,
      totalValue: 200000,
      auctionPayoutAvailable: 160000
    });
    store.saveToStorage();
    renderAllViews();
  });

  document.getElementById('btn-add-prop-inline')?.addEventListener('click', () => {
    currentData.realAssets.properties.push({
      id: `prop_${Date.now()}`,
      name: "New Plot / House",
      type: "Land/Plot",
      estimatedMarketValue: 1500000,
      annualAppreciationPct: 7.0,
      monthlyRentalIncome: 0
    });
    store.saveToStorage();
    renderAllViews();
  });

  document.getElementById('slider-hike')?.addEventListener('input', (e) => {
    currentData.income.expectedAnnualHikePct = parseFloat(e.target.value);
    document.getElementById('slider-hike-val').innerText = `${e.target.value}%`;
    renderProjectionCharts();
  });

  document.getElementById('slider-cagr')?.addEventListener('input', (e) => {
    currentData.mutualFunds.expectedCAGRPct = parseFloat(e.target.value);
    document.getElementById('slider-cagr-val').innerText = `${e.target.value}%`;
    renderProjectionCharts();
  });

  document.getElementById('slider-prepayment')?.addEventListener('input', () => {
    renderOptimizerTab();
  });

  document.getElementById('btn-export-json')?.addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(store.exportJSON());
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "WealthPulse_Data.json");
    dlAnchorElem.click();
  });

  const handleReset = () => {
    if (confirm("Reset financial portfolio data to defaults?")) {
      currentData = store.resetToDefault();
      renderAllViews();
    }
  };
  document.getElementById('btn-reset-data')?.addEventListener('click', handleReset);
  document.getElementById('btn-mobile-reset')?.addEventListener('click', handleReset);
}

// 7. AI CHATBOT CONTROLLER
function bindAIChatEvents() {
  const form = document.getElementById('chat-input-form');
  const input = document.getElementById('chat-input-field');
  const container = document.getElementById('chat-messages-container');

  const sendMessage = (text) => {
    if (!text.trim()) return;

    const userBubble = document.createElement('div');
    userBubble.className = 'flex items-start justify-end gap-3';
    userBubble.innerHTML = `
      <div class="p-3.5 rounded-2xl rounded-tr-none bg-indigo-600 text-white max-w-xl text-xs shadow-md">
        ${text}
      </div>
    `;
    container.appendChild(userBubble);
    container.scrollTop = container.scrollHeight;

    setTimeout(() => {
      const responseHTML = queryAIBrain(text, currentData);
      const aiBubble = document.createElement('div');
      aiBubble.className = 'flex items-start gap-3';
      aiBubble.innerHTML = `
        <div class="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0 text-sm">🧠</div>
        <div class="glass-card p-4 rounded-2xl rounded-tl-none border border-slate-800 bg-slate-900/90 max-w-2xl text-xs space-y-2 text-slate-200">
          ${responseHTML}
        </div>
      `;
      container.appendChild(aiBubble);
      container.scrollTop = container.scrollHeight;
    }, 400);
  };

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const txt = input.value;
    input.value = '';
    sendMessage(txt);
  });

  document.querySelectorAll('.btn-quick-prompt').forEach(btn => {
    btn.addEventListener('click', () => {
      const prompt = btn.getAttribute('data-prompt');
      sendMessage(prompt);
    });
  });
}

// 8. MODAL EVENTS
function bindModalEvents() {
  const modal = document.getElementById('modal-add-item');
  document.getElementById('btn-add-asset-item')?.addEventListener('click', () => {
    modal.classList.remove('hidden');
  });

  const closeModal = () => modal.classList.add('hidden');
  document.getElementById('modal-btn-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-btn-cancel')?.addEventListener('click', closeModal);

  document.getElementById('modal-btn-save')?.addEventListener('click', () => {
    const type = document.getElementById('modal-item-type').value;
    const name = document.getElementById('modal-item-name').value || 'New Financial Item';
    const amount = parseFloat(document.getElementById('modal-item-amount').value) || 100000;
    const emi = parseFloat(document.getElementById('modal-item-emi').value) || 3000;

    if (type === 'LOAN') {
      currentData.loans.push({
        id: `loan_${Date.now()}`,
        name,
        type: 'Personal',
        principalOutstanding: amount,
        interestRatePct: 12.0,
        monthlyEMI: emi,
        remainingMonths: 36
      });
    } else if (type === 'CHIT') {
      currentData.chitFunds.push({
        id: `chit_${Date.now()}`,
        name,
        monthlyInstallment: emi,
        totalMonths: 20,
        remainingMonths: 15,
        totalValue: amount,
        auctionPayoutAvailable: amount * 0.8
      });
    } else if (type === 'PROPERTY') {
      currentData.realAssets.properties.push({
        id: `prop_${Date.now()}`,
        name,
        type: 'Plot/Land',
        estimatedMarketValue: amount,
        annualAppreciationPct: 7.0,
        monthlyRentalIncome: 0
      });
    }

    store.saveToStorage();
    renderAllViews();
    closeModal();
  });
}
