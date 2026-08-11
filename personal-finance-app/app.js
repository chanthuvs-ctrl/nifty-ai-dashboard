// FinPulse AI - Personal Finance Assistant Client Script with Auth Support

document.addEventListener('DOMContentLoaded', () => {
  let state = {
    month: "July 2026",
    salary: 116000,
    items: [],
    smsLogs: [],
    activeCategory: "all",
    searchQuery: "",
    user: localStorage.getItem('finpulse_user') || 'chanthuvs',
    token: localStorage.getItem('finpulse_token') || '',
    charts: {}
  };

  const SMS_PRESETS = {
    hdfc_loan: "Alert: Rs 22579.00 debited from A/C XX4321 on 10-AUG-26 for Home Loan EMI payment. Info: HDFC BANK.",
    ksfe_chala: "Paid Rs 18750.00 to KSFE Chitty Account via GPay UPI/67891234 on 17-AUG-26. A/C XX9012 debited.",
    cred: "Rs 3555.00 debited from Axis Bank A/C XX5678 on 03-AUG-26 by CRED App. Ref: UPI/CRED/10293.",
    swiggy: "Rs 450.00 debited from A/C XX1234 on 12-AUG-26 at 19:42 by VPA swiggy@gpay. Info: Food & Dining.",
    petrol: "Spent Rs 2000.00 on ICICI Credit Card ending 9012 at IOCL PETROL PUMP, Kochi on 11-AUG-26.",
    lic: "Rs 3008.00 debited from A/C XX1234 on 15-AUG-26 for LIC Policy Premium #1. Ref: NACH/LIC/9981."
  };

  init();

  async function init() {
    setupEventListeners();
    checkAuth();
  }

  function checkAuth() {
    if (!state.token) {
      document.getElementById('login-modal').classList.remove('hidden');
    } else {
      document.getElementById('login-modal').classList.add('hidden');
      document.getElementById('user-display-name').innerText = state.user || 'chanthuvs';
      loadDashboardData();
    }
  }

  async function loadDashboardData() {
    await fetchBudgetData();
    await fetchSMSLogs();
    renderAll();
  }

  function getAuthHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${state.token}`
    };
  }

  // API Calls
  async function fetchBudgetData() {
    try {
      const res = await fetch('/api/budget', { headers: getAuthHeaders() });
      if (res.status === 401) {
        logout();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        state.month = data.month || "July 2026";
        state.salary = data.salary || 116000;
        state.items = data.items || [];
        return;
      }
    } catch (e) {
      console.warn("Backend API offline, using local fallback baseline.");
    }
    loadFallbackBaseline();
  }

  async function fetchSMSLogs() {
    try {
      const res = await fetch('/api/sms', { headers: getAuthHeaders() });
      if (res.ok) {
        state.smsLogs = await res.json();
        return;
      }
    } catch (e) {
      console.warn("SMS log API unavailable.");
    }
    state.smsLogs = [];
  }

  function loadFallbackBaseline() {
    state.salary = 116000;
    state.items = [
      { id: "gold_loan", name: "Gold loan", amount: 3600, dueDate: "1st", category: "Loans & EMIs", status: "pending" },
      { id: "cred", name: "cred", amount: 3555, dueDate: "3rd", category: "Credit Cards", status: "pending" },
      { id: "ksfe_vatti_1", name: "ksfe vatti #1", amount: 4552, dueDate: "7th", category: "KSFE Chitty", status: "pending" },
      { id: "ksfe_vatti_2", name: "ksfe vatti #2", amount: 4552, dueDate: "7th", category: "KSFE Chitty", status: "pending" },
      { id: "ksfe_vatti_3", name: "ksfe vatti #3", amount: 4552, dueDate: "7th", category: "KSFE Chitty", status: "pending" },
      { id: "ksfe_vatti_4", name: "ksfe vatti #4", amount: 4552, dueDate: "7th", category: "KSFE Chitty", status: "pending" },
      { id: "lic_2", name: "lic 2", amount: 2500, dueDate: "7th", category: "Insurance", status: "pending" },
      { id: "credit_card", name: "Credit card", amount: 5324, dueDate: "10th", category: "Credit Cards", status: "pending" },
      { id: "credit_card_amma", name: "Credit card - Amma i", amount: 3756, dueDate: "10th", category: "Credit Cards", status: "pending" },
      { id: "lic_1", name: "lic 1", amount: 3008, dueDate: "15th", category: "Insurance", status: "pending" },
      { id: "ksfe_chala", name: "ksfe chala", amount: 18750, dueDate: "17th", category: "KSFE Chitty", status: "pending" },
      { id: "ksfe_vatti_new_1", name: "ksfe vatti new #1", amount: 7750, dueDate: "24th", category: "KSFE Chitty", status: "pending" },
      { id: "ksfe_vatti_new_2", name: "ksfe vatti new #2", amount: 7750, dueDate: "24th", category: "KSFE Chitty", status: "pending" },
      { id: "lic_3", name: "lic 3", amount: 1000, dueDate: "28th", category: "Insurance", status: "pending" },
      { id: "homeloan", name: "Homeloan", amount: 22579, dueDate: "Flexible", category: "Loans & EMIs", status: "pending" },
      { id: "personal_loan", name: "Personal loan", amount: 21034, dueDate: "Flexible", category: "Loans & EMIs", status: "pending" },
      { id: "misc", name: "Misc / Untagged", amount: 2814, dueDate: "Ongoing", category: "Variable & Misc", status: "pending" }
    ];
  }

  // Render Engine
  function renderAll() {
    renderMetrics();
    renderLedgerTable();
    renderSMSFeed();
    renderCalendar();
    renderCharts();
  }

  function renderMetrics() {
    const totalSalary = state.salary;
    const totalObligations = state.items.reduce((acc, i) => acc + i.amount, 0);
    const paidItems = state.items.filter(i => i.status === 'paid');
    const totalPaid = paidItems.reduce((acc, i) => acc + i.amount, 0);

    const buffer = totalSalary - totalObligations;
    const dtiRatio = ((totalObligations / totalSalary) * 100).toFixed(1);

    document.getElementById('val-salary').innerText = `₹${totalSalary.toLocaleString('en-IN')}`;
    document.getElementById('val-obligations').innerText = `₹${totalObligations.toLocaleString('en-IN')}`;
    document.getElementById('val-buffer').innerText = `₹${buffer.toLocaleString('en-IN')}`;
    document.getElementById('val-dti').innerText = `${dtiRatio}%`;

    document.getElementById('val-paid-count').innerText = `${paidItems.length} of ${state.items.length} Paid (₹${totalPaid.toLocaleString('en-IN')} cleared)`;
    document.getElementById('bar-dti').style.width = `${Math.min(dtiRatio, 100)}%`;
    document.getElementById('sms-count-badge').innerText = state.smsLogs.length;
    document.getElementById('sms-feed-count').innerText = `${state.smsLogs.length} Messages`;
  }

  function renderLedgerTable() {
    const tbody = document.getElementById('ledger-tbody');
    tbody.innerHTML = '';

    const filtered = state.items.filter(item => {
      const matchCat = state.activeCategory === 'all' || item.category === state.activeCategory;
      const q = state.searchQuery.toLowerCase();
      const matchSearch = !q || item.name.toLowerCase().includes(q) || 
                          (item.dueDate && item.dueDate.toLowerCase().includes(q)) || 
                          item.category.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No obligation items match filter.</td></tr>`;
      return;
    }

    filtered.forEach(item => {
      const tr = document.createElement('tr');
      const isPaid = item.status === 'paid';

      tr.innerHTML = `
        <td>
          <span class="status-pill ${isPaid ? 'paid' : 'pending'}">
            ${isPaid ? '✓ Paid' : '⏳ Pending'}
          </span>
        </td>
        <td>
          <strong style="${isPaid ? 'text-decoration: line-through; opacity: 0.6;' : ''}">${escapeHtml(item.name)}</strong>
        </td>
        <td><span class="pill-sm purple">${escapeHtml(item.category)}</span></td>
        <td><span class="due-tag">${escapeHtml(item.dueDate || 'N/A')}</span></td>
        <td><strong>₹${item.amount.toLocaleString('en-IN')}</strong></td>
        <td class="text-muted" style="font-size:0.8rem;">${escapeHtml(item.notes || 'Baseline screenshot item')}</td>
        <td>
          <button class="btn btn-sm ${isPaid ? 'btn-ghost' : 'btn-accent'} toggle-paid-btn" data-id="${item.id}">
            ${isPaid ? 'Mark Pending' : 'Mark Paid'}
          </button>
          <button class="btn btn-sm btn-ghost edit-item-btn" data-id="${item.id}">✏️</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderSMSFeed() {
    const container = document.getElementById('sms-feed-container');
    container.innerHTML = '';

    if (state.smsLogs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💬</div>
          <p>No phone messages captured yet.</p>
          <span class="sub-empty">Use presets on the left or paste an SMS to see live auto-capture in action!</span>
        </div>
      `;
      return;
    }

    state.smsLogs.forEach(sms => {
      const card = document.createElement('div');
      card.className = 'sms-card';
      const dateStr = sms.timestamp ? new Date(sms.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Just now';

      card.innerHTML = `
        <div class="sms-card-header">
          <span class="sms-bank">🏦 ${escapeHtml(sms.bank || 'Bank SMS')}</span>
          <span class="sms-amt">${sms.type === 'credit' ? '+' : '-'} ₹${(sms.amount || 0).toLocaleString('en-IN')}</span>
        </div>
        <div class="sms-raw">${escapeHtml(sms.rawText || '')}</div>
        <div class="sms-meta">
          <span>Tagged: <strong>${escapeHtml(sms.category || 'General')}</strong> (${escapeHtml(sms.merchant || 'Merchant')})</span>
          <span>${dateStr}</span>
        </div>
      `;
      container.appendChild(card);
    });
  }

  function renderCalendar() {
    const container = document.getElementById('calendar-grid-container');
    container.innerHTML = '';
    const dayMap = {};

    state.items.forEach(item => {
      if (!item.dueDate) return;
      const numMatch = item.dueDate.match(/(\d+)/);
      if (numMatch) {
        const day = parseInt(numMatch[1], 10);
        if (!dayMap[day]) dayMap[day] = [];
        dayMap[day].push(item);
      }
    });

    for (let day = 1; day <= 31; day++) {
      const dayBox = document.createElement('div');
      dayBox.className = 'cal-day';
      const itemsForDay = dayMap[day] || [];
      const totalDayOutflow = itemsForDay.reduce((acc, i) => acc + i.amount, 0);

      let itemsHtml = '';
      if (itemsForDay.length > 0) {
        const isPeak = totalDayOutflow > 10000;
        itemsForDay.forEach(i => {
          const cls = i.status === 'paid' ? 'paid' : (isPeak ? 'peak' : 'due');
          itemsHtml += `<div class="cal-day-item ${cls}" title="${i.name}: ₹${i.amount}">${i.name} (₹${i.amount})</div>`;
        });
      }

      dayBox.innerHTML = `
        <div class="cal-day-num">${day}</div>
        <div class="cal-day-content">${itemsHtml}</div>
      `;
      container.appendChild(dayBox);
    }
  }

  function renderCharts() {
    const categoryTotals = {};
    state.items.forEach(item => {
      const cat = item.category || 'Other';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + item.amount;
    });

    const catLabels = Object.keys(categoryTotals);
    const catData = Object.values(categoryTotals);

    const ctxCat = document.getElementById('categoryChart').getContext('2d');
    if (state.charts.category) state.charts.category.destroy();

    state.charts.category = new Chart(ctxCat, {
      type: 'doughnut',
      data: {
        labels: catLabels,
        datasets: [{
          data: catData,
          backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#9ca3af', font: { family: 'Plus Jakarta Sans' } } }
        }
      }
    });

    const dayOutflows = Array(31).fill(0);
    state.items.forEach(item => {
      const match = item.dueDate ? item.dueDate.match(/(\d+)/) : null;
      if (match) {
        const day = parseInt(match[1], 10);
        if (day >= 1 && day <= 31) dayOutflows[day - 1] += item.amount;
      }
    });

    const ctxOutflow = document.getElementById('outflowChart').getContext('2d');
    if (state.charts.outflow) state.charts.outflow.destroy();

    state.charts.outflow = new Chart(ctxOutflow, {
      type: 'bar',
      data: {
        labels: Array.from({ length: 31 }, (_, i) => `${i + 1}th`),
        datasets: [{
          label: 'Outflow (₹)',
          data: dayOutflows,
          backgroundColor: 'rgba(99, 102, 241, 0.6)',
          borderColor: '#6366f1',
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: '#6b7280', font: { size: 10 } }, grid: { display: false } },
          y: { ticks: { color: '#6b7280' }, grid: { color: 'rgba(255,255,255,0.05)' } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }

  function logout() {
    localStorage.removeItem('finpulse_token');
    localStorage.removeItem('finpulse_user');
    state.token = '';
    document.getElementById('login-modal').classList.remove('hidden');
  }

  function setupEventListeners() {
    // Login Form Submit
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const u = document.getElementById('login-username').value.trim();
      const p = document.getElementById('login-password').value.trim();
      const errBox = document.getElementById('login-error');
      errBox.classList.add('hidden');

      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: u, password: p })
        });
        const data = await res.json();
        if (data.success) {
          state.user = data.user;
          state.token = data.token;
          localStorage.setItem('finpulse_user', data.user);
          localStorage.setItem('finpulse_token', data.token);
          checkAuth();
        } else {
          errBox.innerText = data.message || "Invalid credentials";
          errBox.classList.remove('hidden');
        }
      } catch (err) {
        errBox.innerText = "Network error connecting to login server.";
        errBox.classList.remove('hidden');
      }
    });

    document.getElementById('btn-logout').addEventListener('click', logout);

    // Navigation Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabId = btn.getAttribute('data-tab');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(tabId).classList.add('active');
        if (tabId === 'tab-analytics' || tabId === 'tab-calendar') {
          setTimeout(renderCharts, 100);
        }
      });
    });

    // Search & Category Filters
    document.getElementById('ledger-search').addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderLedgerTable();
    });

    document.querySelectorAll('.filter-pills .pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.filter-pills .pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.activeCategory = pill.getAttribute('data-cat');
        renderLedgerTable();
      });
    });

    // Toggle Paid Status in Ledger Table
    document.getElementById('ledger-tbody').addEventListener('click', async (e) => {
      const toggleBtn = e.target.closest('.toggle-paid-btn');
      if (toggleBtn) {
        const id = toggleBtn.getAttribute('data-id');
        const item = state.items.find(i => i.id === id);
        if (item) {
          const newStatus = item.status === 'paid' ? 'pending' : 'paid';
          item.status = newStatus;
          renderAll();
          try {
            await fetch('/api/budget/update', {
              method: 'POST',
              headers: getAuthHeaders(),
              body: JSON.stringify({ itemId: id, status: newStatus })
            });
          } catch (err) { console.error("Error updating item status:", err); }
        }
      }

      const editBtn = e.target.closest('.edit-item-btn');
      if (editBtn) {
        const id = editBtn.getAttribute('data-id');
        const item = state.items.find(i => i.id === id);
        if (item) openItemModal(item);
      }
    });

    // SMS Presets
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-preset');
        if (SMS_PRESETS[key]) {
          document.getElementById('sms-input-text').value = SMS_PRESETS[key];
        }
      });
    });

    document.getElementById('btn-parse-sms').addEventListener('click', () => {
      const text = document.getElementById('sms-input-text').value;
      if (text.trim()) processSMSIngest(text);
    });

    // Modals
    document.getElementById('btn-open-sms-modal').addEventListener('click', () => {
      document.getElementById('sms-modal').classList.remove('hidden');
    });
    document.getElementById('sms-modal-close').addEventListener('click', () => {
      document.getElementById('sms-modal').classList.add('hidden');
    });
    document.getElementById('modal-sms-cancel').addEventListener('click', () => {
      document.getElementById('sms-modal').classList.add('hidden');
    });
    document.getElementById('modal-sms-submit').addEventListener('click', () => {
      const text = document.getElementById('modal-sms-text').value;
      if (text.trim()) {
        processSMSIngest(text);
        document.getElementById('sms-modal').classList.add('hidden');
      }
    });

    // Webhook Guide Modal
    document.getElementById('btn-open-webhook-guide').addEventListener('click', () => {
      document.getElementById('webhook-modal').classList.remove('hidden');
    });
    document.getElementById('webhook-modal-close').addEventListener('click', () => {
      document.getElementById('webhook-modal').classList.add('hidden');
    });
    document.getElementById('webhook-modal-ok').addEventListener('click', () => {
      document.getElementById('webhook-modal').classList.add('hidden');
    });

    // Add Item Modal
    document.getElementById('btn-add-item').addEventListener('click', () => openItemModal(null));
    document.getElementById('item-modal-close').addEventListener('click', () => document.getElementById('item-modal').classList.add('hidden'));
    document.getElementById('item-modal-cancel').addEventListener('click', () => document.getElementById('item-modal').classList.add('hidden'));
    document.getElementById('item-modal-save').addEventListener('click', saveItemFromModal);
  }

  async function processSMSIngest(rawText) {
    const resultBox = document.getElementById('sms-parse-result');
    resultBox.classList.remove('hidden');
    resultBox.innerHTML = `⚡ Ingesting &amp; parsing bank SMS message...`;

    try {
      const res = await fetch('/api/sms/ingest', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ smsText: rawText, source: "Web Ingest Sandbox" })
      });

      if (res.ok) {
        const data = await res.json();
        resultBox.innerHTML = `
          <strong>✓ SMS Successfully Ingested!</strong><br>
          Bank: ${escapeHtml(data.parsed.bank)} | Amount: ₹${data.parsed.amount} | Tag: ${escapeHtml(data.parsed.category)}<br>
          <span style="color:${data.reconciled ? '#34d399' : '#a78bfa'}; font-weight:600;">
            ${data.message}
          </span>
        `;
        await fetchBudgetData();
        await fetchSMSLogs();
        renderAll();
        return;
      }
    } catch (e) {
      console.warn("Backend API offline, executing client-side regex parsing fallback.");
    }
  }

  function openItemModal(item) {
    document.getElementById('edit-item-id').value = item ? item.id : '';
    document.getElementById('edit-item-name').value = item ? item.name : '';
    document.getElementById('edit-item-amount').value = item ? item.amount : '';
    document.getElementById('edit-item-date').value = item ? item.dueDate : '';
    document.getElementById('edit-item-category').value = item ? item.category : 'Loans & EMIs';
    document.getElementById('edit-item-notes').value = item ? item.notes || '' : '';
    document.getElementById('item-modal-title').innerText = item ? 'Edit Obligation Item' : 'Add Obligation Item';
    document.getElementById('item-modal').classList.remove('hidden');
  }

  function saveItemFromModal() {
    const id = document.getElementById('edit-item-id').value || 'item_' + Date.now();
    const name = document.getElementById('edit-item-name').value;
    const amount = parseFloat(document.getElementById('edit-item-amount').value);
    const dueDate = document.getElementById('edit-item-date').value;
    const category = document.getElementById('edit-item-category').value;
    const notes = document.getElementById('edit-item-notes').value;

    if (!name || isNaN(amount)) return alert("Please enter valid name and amount.");

    const existing = state.items.find(i => i.id === id);
    if (existing) {
      existing.name = name;
      existing.amount = amount;
      existing.dueDate = dueDate;
      existing.category = category;
      existing.notes = notes;
    } else {
      state.items.push({ id, name, amount, dueDate, category, notes, status: 'pending' });
    }

    document.getElementById('item-modal').classList.add('hidden');
    renderAll();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
});
