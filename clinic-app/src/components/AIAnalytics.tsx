import FinancialYearCharts from './FinancialYearCharts';
import FinancialStatementGenerator from './FinancialStatementGenerator';
import { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import {
  Sparkles, TrendingUp, TrendingDown, IndianRupee, ShieldCheck, Database,
  Filter, PieChart, Download, UserPlus, Users, X
} from 'lucide-react';
import * as XLSX from 'xlsx';

// Canonical category mapper
function getCanonicalCategory(rawCat: string): string {
  if (!rawCat) return 'General';
  const c = String(rawCat).trim().toLowerCase();
  if (c.includes('gfc') || c.includes('prp')) return 'GFC & PRP Treatments';
  if (c.includes('peel') || c.includes('chemical')) return 'Chemical Peels & Facials';
  if (c.includes('laser') || c.includes('hair removal')) return 'Laser Treatments';
  if (c.includes('botox') || c.includes('filler')) return 'Injectables & Botox';
  if (c.includes('hydra') || c.includes('facial')) return 'HydraFacial & Skin Care';
  if (c.includes('consult') || c.includes('opd')) return 'Consultation & OPD';
  if (c.includes('med') || c.includes('pharmacy') || c.includes('drug')) return 'Medicines & Pharmacy';
  if (c.includes('salary') || c.includes('wage') || c.includes('payroll')) return 'Staff Salaries';
  if (c.includes('rent') || c.includes('lease')) return 'Rent & Premises';
  if (c.includes('ad') || c.includes('marketing') || c.includes('fb') || c.includes('google')) return 'Marketing & Ads';
  if (c.includes('supply') || c.includes('consumable') || c.includes('material')) return 'Clinical Supplies';
  if (c.includes('utility') || c.includes('eb') || c.includes('electric') || c.includes('water')) return 'Utilities & EB';
  return rawCat.trim();
}

function normalizeTxDate(rawDate: any): string {
  if (!rawDate) return new Date().toISOString().split('T')[0];
  const s = String(rawDate).trim();
  if (!s) return new Date().toISOString().split('T')[0];
  const parts = s.split(/[-/.]/);
  if (parts.length === 3) {
    if (parts[2].length === 4) {
      return parts[2] + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0');
    }
    if (parts[0].length === 4) {
      return parts[0] + '-' + parts[1].padStart(2, '0') + '-' + parts[2].padStart(2, '0');
    }
  }
  return new Date().toISOString().split('T')[0];
}

export default function AIAnalytics() {
  const [loadingImport, setLoadingImport] = useState(false);
  const [viewMode, setViewMode] = useState<'analytics' | 'statement'>('analytics');

  // Time Period Filter State
  const [periodFilter, setPeriodFilter] = useState<string>('current_year');
  const [customStartDate, setCustomStartDate] = useState('2026-01-01');
  const [customEndDate, setCustomEndDate] = useState('2026-12-31');

  // Search & Toggle states
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const [showAllIncomeCategories, setShowAllIncomeCategories] = useState(false);
  const [incomeCategorySearchTerm, setIncomeCategorySearchTerm] = useState('');

  const [transactions, setTransactions] = useState<any[]>([]);

  // -------------------------------------------------------------
  // New Customer Acquisition & Patient LTV Intelligence
  // -------------------------------------------------------------
  const [selectedAcquisitionMonth, setSelectedAcquisitionMonth] = useState<string | null>(null);
  const [acquisitionPage, setAcquisitionPage] = useState<number>(1);
  const acquisitionPageSize = 6;
  const [acquisitionSearchTerm, setAcquisitionSearchTerm] = useState<string>('');

  const acquisitionAnalytics = useMemo(() => {
    const monthlyConsultMap: Record<string, {
      ym: string;
      label: string;
      newCustomersCount: number;
      consultCount: number;
      consultRevenue: number;
      firstMonthRevenue: number;
      sameMonthRevenue: number;
      lifetimeRevenue: number;
      avgLtv: number;
      patients: Array<{
        name: string;
        date: string;
        firstDate: string;
        service: string;
        firstMonthRev: number;
        sameMonthRev: number;
        lifetimeRev: number;
      }>;
    }> = {};

    const patientTxMap: Record<string, Array<{ date: string; ym: string; amount: number; service: string }>> = {};

    transactions.forEach(t => {
      const pName = String(t.patientName || '').trim();
      if (!pName) return;
      const patKey = pName.toLowerCase();
      const amt = parseFloat(t.amount) || 0;

      if (t.type === 'Income' && amt > 0) {
        if (!patientTxMap[patKey]) patientTxMap[patKey] = [];
        patientTxMap[patKey].push({
          date: t.date,
          ym: t.date.slice(0, 7),
          amount: amt,
          service: String(t.category || 'General')
        });
      }
    });

    transactions.forEach(t => {
      if (t.type !== 'Income') return;
      const pName = String(t.patientName || '').trim();
      if (!pName) return;
      const patKey = pName.toLowerCase();

      const catLower = String(t.category || '').toLowerCase();
      const descLower = String(t.description || '').toLowerCase();
      const amt = parseFloat(t.amount) || 0;

      const isConsult = catLower.includes('consult') || descLower.includes('consult') || catLower.includes('opd');
      const is300 = amt === 300 || String(t.rate || '').includes('300') || descLower.includes('300');

      if (isConsult && is300) {
        const ym = t.date.slice(0, 7);
        if (!ym) return;

        if (!monthlyConsultMap[ym]) {
          const [year, month] = ym.split('-');
          const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
          const label = dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

          monthlyConsultMap[ym] = {
            ym,
            label,
            newCustomersCount: 0,
            consultCount: 0,
            consultRevenue: 0,
            firstMonthRevenue: 0,
            sameMonthRevenue: 0,
            lifetimeRevenue: 0,
            avgLtv: 0,
            patients: []
          };
        }

        const mItem = monthlyConsultMap[ym];
        mItem.consultCount += 1;
        mItem.newCustomersCount += 1;
        mItem.consultRevenue += 300;

        const txs = patientTxMap[patKey] || [];
        let pFirstMonthRev = 0;
        let pLifetimeRev = 0;

        txs.forEach(tx => {
          pLifetimeRev += tx.amount;
          if (tx.ym === ym) pFirstMonthRev += tx.amount;
        });

        mItem.firstMonthRevenue += pFirstMonthRev;
        mItem.sameMonthRevenue += pFirstMonthRev;
        mItem.lifetimeRevenue += pLifetimeRev;

        mItem.patients.push({
          name: pName,
          date: t.date,
          firstDate: t.date,
          service: t.category || 'Consultation',
          firstMonthRev: pFirstMonthRev,
          sameMonthRev: pFirstMonthRev,
          lifetimeRev: pLifetimeRev
        });
      }
    });

    let totalConsultCount = 0;
    let totalConsultRevenue = 0;
    let totalLifetimeRevenueOverall = 0;

    const monthlyList = Object.keys(monthlyConsultMap).sort().reverse().map(ym => {
      const item = monthlyConsultMap[ym];
      item.avgLtv = item.patients.length > 0 ? Math.round(item.lifetimeRevenue / item.patients.length) : 0;
      totalConsultCount += item.consultCount;
      totalConsultRevenue += item.consultRevenue;
      totalLifetimeRevenueOverall += item.lifetimeRevenue;
      item.patients.sort((a, b) => b.lifetimeRev - a.lifetimeRev);
      return item;
    });

    const overallAvgLtv = totalConsultCount > 0 ? Math.round(totalLifetimeRevenueOverall / totalConsultCount) : 0;

    return {
      monthlyList,
      totalConsultCount,
      totalConsultRevenue,
      totalLifetimeRevenueOverall,
      overallAvgLtv,
      monthlyConsultMap
    };
  }, [transactions]);

  const fetchTransactions = async () => {
    try {
      const savedUrl = localStorage.getItem('de_natura_gsheet_url') || 'https://docs.google.com/spreadsheets/d/1TtcywkssTiAGyGrabmlpf0Xjy39LEbA0?rtpof=true&usp=drive_fs';
      let exportUrl = savedUrl;
      const match = savedUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        exportUrl = 'https://docs.google.com/spreadsheets/d/' + match[1] + '/export?format=xlsx';
      }

      const res = await fetch(exportUrl);
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
        const wsname = wb.SheetNames.find((s: string) => s.toLowerCase().includes('cash book') || s.toLowerCase().includes('cashbook') || s.toLowerCase().includes('ledger') || s.toLowerCase().includes('transaction')) || wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { raw: false });

        const parsed: any[] = [];
        data.forEach((row: any, idx: number) => {
          const getVal = (possibleKeys: string[]) => {
            for (const key of Object.keys(row)) {
              const cleanKey = key.trim().toLowerCase();
              if (possibleKeys.some((pk: string) => cleanKey === pk.toLowerCase() || cleanKey.includes(pk.toLowerCase()))) {
                return row[key];
              }
            }
            return null;
          };

          const cleanDate = normalizeTxDate(getVal(['date', 'dt', 'day', 'time', 'trx date'])) || new Date().toISOString().split('T')[0];
          const rawPatient = getVal(['name', 'patient name', 'patient', 'client']) || '';
          const rawDoctor = getVal(['dr', 'doctor name', 'doctor']) || '';
          const rawCategory = getVal(['service', 'service name', 'category', 'particulars']) || 'General';

          const parseNum = (v: any) => {
            if (!v) return 0;
            const s = String(v).replace(/[^0-9.]/g, '');
            return parseFloat(s) || 0;
          };

          const rawCashIn = parseNum(getVal(['cash in', 'cashin', 'income', 'receipt', 'credit', 'inflow']));
          const rawCashOut = parseNum(getVal(['cashout', 'cash out', 'expense', 'debit', 'outflow']));
          const rawMode = getVal(['mode of payment', 'payment mode', 'pay mode', 'mode', 'payment method', 'mop', 'payment']) || 'Cash';

          const normalizeMode = (mStr: string): string[] => {
            if (!mStr) return ['Cash'];
            const parts = String(mStr).split(/[,/&]/).map(s => s.trim());
            const normalized = parts.map(part => {
              const p = part.toLowerCase();
              if (p.includes('gpay') || p.includes('google') || p.includes('upi') || p.includes('phonepe') || p.includes('paytm')) return 'GPay';
              if (p.includes('bank') || p.includes('transfer') || p.includes('neft') || p.includes('rtgs') || p.includes('online')) return 'Bank Transfer';
              if (p.includes('card') || p.includes('pos') || p.includes('debit') || p.includes('credit')) return 'Card';
              return 'Cash';
            });
            return Array.from(new Set(normalized));
          };

          const modesArray = normalizeMode(String(rawMode));
          const catLower = String(rawCategory || '').toLowerCase();
          const patLower = String(rawPatient || '').toLowerCase();
          const isSummaryRow = ['fixed salary', 'designation', 'department', 'joining date', 'total deductions', 'loss of pay'].some(kw => catLower.includes(kw) || patLower.includes(kw));

          if (!isSummaryRow) {
            const isDeepthy = patLower.includes('deepth');
            const isInvestKeyword = ['invest', 'cash transfer', 'account transfer', 'transfer', 'byhand', 'fund'].some(kw => catLower.includes(kw));
            const isInvestment = isDeepthy && isInvestKeyword;
            const categoryStr = isInvestment ? 'Capital Investment (Deepthy)' : String(rawCategory);

            if (rawCashIn > 0) {
              parsed.push({
                id: 'tx_drive_' + idx + '_' + cleanDate + '_' + rawCashIn,
                date: cleanDate,
                type: 'Income',
                category: categoryStr,
                isInvestment: isInvestment,
                patientName: String(rawPatient),
                doctorName: String(rawDoctor),
                paymentMethods: modesArray,
                amount: rawCashIn,
                description: isInvestment ? 'Owner Capital Inflow for Expenses' : ('Service: ' + rawCategory),
                createdAt: Date.now() - idx
              });
            }
            if (rawCashOut > 0) {
              parsed.push({
                id: 'tx_drive_out_' + idx + '_' + cleanDate + '_' + rawCashOut,
                date: cleanDate,
                type: 'Expense',
                category: String(rawCategory),
                patientName: String(rawPatient),
                doctorName: String(rawDoctor),
                paymentMethods: modesArray,
                amount: rawCashOut,
                description: 'Expense: ' + rawCategory,
                createdAt: Date.now() - idx
              });
            }
          }
        });

        parsed.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setTransactions(parsed);
      }
    } catch (e) {
      console.error('AI Analytics fetch error:', e);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleImportSheetData = async () => {
    setLoadingImport(true);
    try {
      const savedUrl = localStorage.getItem('de_natura_gsheet_url');
      if (!savedUrl) {
        alert('Please enter your Google Sheet or OneDrive URL in Income & Expense Tracker to sync.');
        setLoadingImport(false);
        return;
      }
      let sheetUrl = savedUrl;
      const match = savedUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        sheetUrl = 'https://docs.google.com/spreadsheets/d/' + match[1] + '/export?format=xlsx';
      }
      const res = await fetch(sheetUrl);
      const data = await res.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array', cellDates: false });
      const sheetName = workbook.SheetNames.find((s: string) => s.toLowerCase().includes('cash book') || s.toLowerCase().includes('cashbook') || s.toLowerCase().includes('ledger')) || workbook.SheetNames[0];
      const firstSheet = workbook.Sheets[sheetName];
      const json: any[] = XLSX.utils.sheet_to_json(firstSheet, { raw: false });

      let imported = 0;
      for (const row of json) {
        const d = normalizeTxDate(row['Date'] || row['date']);
        const amt = parseFloat(row['Amount'] || row['amount'] || 0);
        if (!d || amt <= 0) continue;
        const typ = row['Type'] || row['type'] || 'Income';
        const cat = row['Category'] || row['category'] || 'General';
        const pName = row['Patient Name'] || row['patient'] || '';

        const txId = 'sheet_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        await setDoc(doc(db, 'Transactions', txId), {
          date: d,
          type: typ,
          category: cat,
          amount: amt,
          paymentMethod: row['Payment Method'] || 'Cash',
          patientName: pName,
          description: row['Description'] || 'Imported from Google Sheet',
          createdAt: Date.now()
        });
        imported++;
      }
      alert('✅ Sync Complete! Added ' + imported + ' transactions from Google Sheet.');
      fetchTransactions();
    } catch (e: any) {
      alert('Import Error: ' + e.message);
    }
    setLoadingImport(false);
  };

  const analytics = useMemo(() => {
    let start = '2026-01-01';
    let end = '2026-12-31';

    if (periodFilter === 'all') {
      start = '1900-01-01'; end = '2099-12-31';
    } else if (periodFilter === 'current_fy') {
      start = '2026-04-01'; end = '2027-03-31';
    } else if (periodFilter === 'prev_fy') {
      start = '2025-04-01'; end = '2026-03-31';
    } else if (periodFilter === 'current_quarter') {
      start = '2026-07-01'; end = '2026-09-30';
    } else if (periodFilter.startsWith('month_')) {
      const targetYM = periodFilter.replace('month_', '');
      start = targetYM + '-01'; end = targetYM + '-31';
    } else if (periodFilter === 'custom') {
      start = customStartDate; end = customEndDate;
    }

    const filteredTx = transactions.filter(t => {
      const normDate = normalizeTxDate(t.date);
      if (!normDate) return false;
      return normDate >= start && normDate <= end;
    });

    const totalIncome = filteredTx.filter(t => t.type === 'Income' && !t.isInvestment).reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    const totalExpense = filteredTx.filter(t => t.type === 'Expense').reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    const netProfit = totalIncome - totalExpense;
    const profitMargin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : '0.0';

    const categoryIncome: Record<string, number> = {};
    filteredTx.filter(t => t.type === 'Income').forEach(t => {
      const c = getCanonicalCategory(t.category);
      categoryIncome[c] = (categoryIncome[c] || 0) + (parseFloat(t.amount) || 0);
    });

    const categoryExpense: Record<string, number> = {};
    filteredTx.filter(t => t.type === 'Expense').forEach(t => {
      const c = getCanonicalCategory(t.category);
      categoryExpense[c] = (categoryExpense[c] || 0) + (parseFloat(t.amount) || 0);
    });

    const sortedIncomeCategories = Object.entries(categoryIncome).sort((a, b) => b[1] - a[1]);
    const sortedExpenseCategories = Object.entries(categoryExpense).sort((a, b) => b[1] - a[1]);

    return {
      filteredTx, totalIncome, totalExpense, netProfit, profitMargin,
      sortedIncomeCategories, sortedExpenseCategories
    };
  }, [transactions, periodFilter, customStartDate, customEndDate]);

  const { filteredTx, totalIncome, totalExpense, netProfit, profitMargin, sortedIncomeCategories, sortedExpenseCategories } = analytics;

  const exportAnalyticsExcel = () => {
    const data = filteredTx.map(t => ({
      Date: t.date,
      Type: t.type,
      Category: t.category,
      'Patient Name': t.patientName || '—',
      'Doctor Name': t.doctorName || '—',
      'Amount (₹)': parseFloat(t.amount) || 0,
      'Payment Method': Array.isArray(t.paymentMethods) ? t.paymentMethods.join(', ') : (t.paymentMethod || 'Cash'),
      Description: t.description || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Analytics Ledger');
    XLSX.writeFile(wb, 'DE_NATURA_AI_Analytics_' + periodFilter + '.xlsx');
  };

  return (
    <div className="space-y-6">
      {/* Prominent Full-Width Top Navigation Tab Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-2 p-1.5 bg-slate-900/90 rounded-2xl border border-slate-800 shadow-xl">
        <button
          onClick={() => setViewMode('analytics')}
          className={`w-full sm:flex-1 py-3 px-5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer ${
            viewMode === 'analytics'
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20 border border-cyan-400/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Sparkles size={16} />
          <span>📊 Financial Analytics & Customer Intelligence</span>
        </button>

        <button
          onClick={() => setViewMode('statement')}
          className={`w-full sm:flex-1 py-3 px-5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer ${
            viewMode === 'statement'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/20 border border-purple-400/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <PieChart size={16} />
          <span>📜 Corporate P&L Financial Statement Generator</span>
        </button>
      </div>
      {/* Header Bar */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">AI Analytics & Financial Intelligence</h2>
            <p className="text-xs text-slate-400">Real-time revenue, expense & profitability insights across {filteredTx.length} transactions</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
            <Filter size={14} className="text-slate-400 ml-2" />
            <select
              value={periodFilter}
              onChange={e => setPeriodFilter(e.target.value)}
              className="bg-transparent text-white font-semibold text-xs border-0 focus:outline-none p-1.5 cursor-pointer"
            >
              <option value="current_year">CY 2026 (Jan–Dec 2026)</option>
              <option value="current_fy">FY 2026–27 (Apr 2026 – Mar 2027)</option>
              <option value="prev_fy">FY 2025–26 (Apr 2025 – Mar 2026)</option>
              <option value="current_quarter">Q3 2026 (Jul–Sep 2026)</option>
              <optgroup label="2026 Monthly Breakdown">
                <option value="month_2026-04">📅 April 2026</option>
                <option value="month_2026-05">📅 May 2026</option>
                <option value="month_2026-06">📅 June 2026</option>
                <option value="month_2026-07">📅 July 2026</option>
                <option value="month_2026-03">📅 March 2026</option>
                <option value="month_2026-02">📅 February 2026</option>
                <option value="month_2026-01">📅 January 2026</option>
              </optgroup>
              <option value="all">All Time Historical (2024–2026)</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {periodFilter === 'custom' && (
            <div className="flex items-center gap-2 text-xs">
              <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-white" />
              <span className="text-slate-500">to</span>
              <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-white" />
            </div>
          )}



          <button
            onClick={handleImportSheetData}
            disabled={loadingImport}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 font-bold text-xs rounded-xl border border-slate-700 transition"
          >
            <Database size={14} />
            {loadingImport ? 'Syncing...' : 'Sync Google Sheet'}
          </button>

          <button
            onClick={exportAnalyticsExcel}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition"
          >
            <Download size={14} />
            Export Excel
          </button>
        </div>
      </div>

      {/* View Mode Content */}
      {viewMode === 'statement' ? (
        <FinancialStatementGenerator transactions={transactions} />
      ) : (
        <>
      {/* 4 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex justify-between items-center text-slate-400 text-xs font-semibold">
            <span>Total Revenue</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <TrendingUp size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-400 font-mono">₹{totalIncome.toLocaleString('en-IN')}</p>
          <p className="text-[11px] text-slate-500 font-medium">Inflows across all categories</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex justify-between items-center text-slate-400 text-xs font-semibold">
            <span>Total Expenses</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
              <TrendingDown size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-rose-400 font-mono">₹{totalExpense.toLocaleString('en-IN')}</p>
          <p className="text-[11px] text-slate-500 font-medium">Operational & marketing costs</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex justify-between items-center text-slate-400 text-xs font-semibold">
            <span>Net Profit</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
              <IndianRupee size={16} />
            </div>
          </div>
          <p className={'text-2xl font-black font-mono ' + (netProfit >= 0 ? 'text-cyan-400' : 'text-rose-400')}>
            ₹{netProfit.toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-slate-500 font-medium">Revenue minus expenses</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex justify-between items-center text-slate-400 text-xs font-semibold">
            <span>Profit Margin</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
              <ShieldCheck size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-purple-400 font-mono">{profitMargin}%</p>
          <p className="text-[11px] text-slate-500 font-medium">Overall margin efficiency</p>
        </div>
      </div>

      {/* NEW CUSTOMER ACQUISITION & PATIENT LTV SECTION */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20 flex-shrink-0">
              <UserPlus size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">New Customer Acquisition & Patient LTV Intelligence</h3>
              <p className="text-xs text-slate-400">Tracks every patient consultation (₹300) and measures their same-month & total lifetime revenue.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs font-bold text-purple-400">
              {acquisitionAnalytics.totalConsultCount} Total New Customers Acquired
            </span>
          </div>
        </div>

        {/* Quick Acquisition Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-800 space-y-1">
            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Total New Patients (₹300 Consult)</p>
            <p className="text-xl font-extrabold text-purple-400 font-mono">{acquisitionAnalytics.totalConsultCount.toLocaleString()} Patients</p>
            <p className="text-[10px] text-slate-500">First-time consultation bookings</p>
          </div>

          <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-800 space-y-1">
            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Total Lifetime Revenue Generated</p>
            <p className="text-xl font-extrabold text-emerald-400 font-mono">₹{acquisitionAnalytics.totalLifetimeRevenueOverall.toLocaleString('en-IN')}</p>
            <p className="text-[10px] text-slate-500">From all follow-ups & treatments</p>
          </div>

          <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-800 space-y-1">
            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Average Revenue / Customer (LTV)</p>
            <p className="text-xl font-extrabold text-cyan-400 font-mono">₹{acquisitionAnalytics.overallAvgLtv.toLocaleString('en-IN')} / Patient</p>
            <p className="text-[10px] text-slate-500">Average lifetime value</p>
          </div>
        </div>

        {/* Monthly Acquisition Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3.5 align-middle">Acquisition Month</th>
                <th className="p-3.5 text-center align-middle">New Customers</th>
                <th className="p-3.5 text-right align-middle">Consultation Revenue</th>
                <th className="p-3.5 text-right align-middle">Same-Month Revenue</th>
                <th className="p-3.5 text-right align-middle">Total Lifetime Revenue</th>
                <th className="p-3.5 text-right align-middle">Avg Patient LTV</th>
                <th className="p-3.5 text-center align-middle">Patient Roster</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {acquisitionAnalytics.monthlyList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">No consultation (₹300) records found.</td>
                </tr>
              ) : (
                acquisitionAnalytics.monthlyList
                  .slice((acquisitionPage - 1) * acquisitionPageSize, acquisitionPage * acquisitionPageSize)
                  .map(item => {
                    const [yearStr, monthStr] = item.ym.split('-');
                    const prevYearYM = (parseInt(yearStr, 10) - 1) + '-' + monthStr;
                    const prevYearItem = acquisitionAnalytics.monthlyConsultMap[prevYearYM];

                    let yoyNode = <span className="text-slate-500 font-mono">—</span>;
                    if (prevYearItem) {
                      const diff = item.consultCount - prevYearItem.consultCount;
                      const pct = ((diff / prevYearItem.consultCount) * 100).toFixed(1);
                      const isPos = diff >= 0;
                      yoyNode = (
                        <div className="flex flex-col items-center justify-center font-mono text-[11px]">
                          <span className="text-slate-300 font-semibold">{prevYearItem.consultCount} Patients ({monthStr}/{parseInt(yearStr, 10) - 1})</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${isPos ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                            {isPos ? `+${diff} (+${pct}%)` : `${diff} (${pct}%)`}
                          </span>
                        </div>
                      );
                    }

                    return (
                  <tr key={item.ym} className="hover:bg-slate-800/40 transition">
                    <td className="p-3.5 font-bold text-white align-middle whitespace-nowrap">
                      <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                      {item.label}
                    </td>
                    <td className="p-3.5 text-center align-middle whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 font-bold font-mono">
                        {item.consultCount} New Patients
                      </span>
                    </td>
                    <td className="p-3.5 text-center align-middle whitespace-nowrap">
                      {yoyNode}
                    </td>
                    <td className="p-3.5 text-right font-mono text-slate-300 align-middle whitespace-nowrap">
                      ₹{(item.consultCount * 300).toLocaleString('en-IN')}
                    </td>
                    <td className="p-3.5 text-right font-mono text-emerald-400 font-semibold align-middle whitespace-nowrap">
                      ₹{item.firstMonthRevenue.toLocaleString('en-IN')}
                    </td>
                    <td className="p-3.5 text-right font-mono text-cyan-400 font-bold align-middle whitespace-nowrap">
                      ₹{item.lifetimeRevenue.toLocaleString('en-IN')}
                    </td>
                    <td className="p-3.5 text-right font-mono text-purple-300 font-semibold align-middle whitespace-nowrap">
                      ₹{item.avgLtv.toLocaleString('en-IN')}
                    </td>
                    <td className="p-3.5 text-center align-middle whitespace-nowrap">
                      <button
                        onClick={() => {
                          setSelectedAcquisitionMonth(item.ym);
                          setAcquisitionSearchTerm('');
                        }}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-white font-bold text-[11px] rounded-lg border border-slate-700 transition inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Users size={12} />
                        View Patients ({item.consultCount})
                      </button>
                    </td>
                  </tr>
                );
                  })
              )}
            </tbody>
          </table>

          {/* Pagination Controls (6 Rows Per Page) */}
          {acquisitionAnalytics.monthlyList.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between p-3.5 bg-slate-900/90 border-t border-slate-800 text-xs text-slate-400 gap-3">
              <div>
                Showing <span className="font-bold text-white">{(acquisitionPage - 1) * acquisitionPageSize + 1}</span> to <span className="font-bold text-white">{Math.min(acquisitionPage * acquisitionPageSize, acquisitionAnalytics.monthlyList.length)}</span> of <span className="font-bold text-white">{acquisitionAnalytics.monthlyList.length}</span> acquisition months
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={acquisitionPage <= 1}
                  onClick={() => setAcquisitionPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-lg border border-slate-700 transition cursor-pointer"
                >
                  ◄ Previous
                </button>
                <span className="font-mono text-purple-300 px-2 font-semibold">
                  Page {acquisitionPage} of {Math.ceil(acquisitionAnalytics.monthlyList.length / acquisitionPageSize) || 1}
                </span>
                <button
                  disabled={acquisitionPage >= Math.ceil(acquisitionAnalytics.monthlyList.length / acquisitionPageSize)}
                  onClick={() => setAcquisitionPage(p => Math.min(Math.ceil(acquisitionAnalytics.monthlyList.length / acquisitionPageSize), p + 1))}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-lg border border-slate-700 transition cursor-pointer"
                >
                  Next ►
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DRILL DOWN PATIENT ROSTER MODAL */}
      {selectedAcquisitionMonth && acquisitionAnalytics.monthlyConsultMap[selectedAcquisitionMonth] && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
                  <Users size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    New Patients Acquired in {acquisitionAnalytics.monthlyConsultMap[selectedAcquisitionMonth].label}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {acquisitionAnalytics.monthlyConsultMap[selectedAcquisitionMonth].consultCount} Patients | Total Lifetime Revenue: ₹{acquisitionAnalytics.monthlyConsultMap[selectedAcquisitionMonth].lifetimeRevenue.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAcquisitionMonth(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 border-b border-slate-800 bg-slate-950/40">
              <div className="relative">
                <input
                  type="text"
                  placeholder="🔍 Search patient name..."
                  value={acquisitionSearchTerm}
                  onChange={e => setAcquisitionSearchTerm(e.target.value)}
                  className="w-full py-2 px-4 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-purple-500 transition"
                />
              </div>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 flex-1 divide-y divide-slate-800/40">
              {acquisitionAnalytics.monthlyConsultMap[selectedAcquisitionMonth].patients
                .filter(p => p.name.toLowerCase().includes(acquisitionSearchTerm.toLowerCase()))
                .map((patient, idx) => (
                  <div key={idx} className="pt-2.5 first:pt-0 flex items-center justify-between text-xs hover:bg-slate-800/30 p-2 rounded-xl transition">
                    <div className="space-y-0.5">
                      <p className="font-bold text-white text-sm capitalize">{patient.name}</p>
                      <p className="text-[11px] text-slate-400">
                        First Consult Date: <span className="font-mono text-purple-300">{patient.firstDate}</span>
                      </p>
                    </div>
                    <div className="text-right space-y-0.5 font-mono">
                      <p className="text-emerald-400 font-bold text-sm">₹{patient.lifetimeRev.toLocaleString('en-IN')}</p>
                      <p className="text-[10px] text-slate-500">
                        Month 1: ₹{patient.firstMonthRev.toLocaleString('en-IN')} | Lifetime Total
                      </p>
                    </div>
                  </div>
                ))}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900/90 text-right">
              <button
                onClick={() => setSelectedAcquisitionMonth(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Breakdowns: Income & Expense Side-by-Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 flex-shrink-0">
                <TrendingUp size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Category-Wise Income Breakdown</h3>
                <p className="text-xs text-slate-400">Revenue generated across service & treatment categories.</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-bold text-emerald-400 self-start sm:self-auto">
              Showing {incomeCategorySearchTerm ? sortedIncomeCategories.filter(([cat]) => cat.toLowerCase().includes(incomeCategorySearchTerm.toLowerCase())).length : (showAllIncomeCategories ? sortedIncomeCategories.length : Math.min(5, sortedIncomeCategories.length))} of {sortedIncomeCategories.length} Categories
            </span>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="🔍 Search income categories (e.g. Consultation, GFC, Laser, Hydrafacial)..."
              value={incomeCategorySearchTerm}
              onChange={e => setIncomeCategorySearchTerm(e.target.value)}
              className="w-full py-2.5 px-4 bg-slate-900/90 border border-slate-800 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition shadow-inner"
            />
            {incomeCategorySearchTerm && (
              <button type="button" onClick={() => setIncomeCategorySearchTerm('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-white text-xs font-bold">
                ✕ Clear
              </button>
            )}
          </div>

          <div className="space-y-3 text-xs">
            {sortedIncomeCategories.length === 0 ? (
              <p className="text-slate-500 text-center py-4">No income records logged in selected date range.</p>
            ) : (
              (incomeCategorySearchTerm
                ? sortedIncomeCategories.filter(([cat]) => cat.toLowerCase().includes(incomeCategorySearchTerm.toLowerCase()))
                : (showAllIncomeCategories ? sortedIncomeCategories : sortedIncomeCategories.slice(0, 5))
              ).map(([cat, amt]) => {
                const pct = totalIncome > 0 ? ((amt / totalIncome) * 100).toFixed(1) : '0';
                return (
                  <div key={cat} className="p-3 bg-slate-900/80 rounded-xl border border-slate-800/80 space-y-1.5 hover:border-slate-700 transition">
                    <div className="flex justify-between items-center font-semibold">
                      <span className="text-slate-200 capitalize">{cat}</span>
                      <span className="font-mono text-emerald-400 font-bold">₹{amt.toLocaleString('en-IN')} ({pct}%)</span>
                    </div>
                    <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full" style={{ width: pct + '%' }} />
                    </div>
                  </div>
                );
              })
            )}

            {!incomeCategorySearchTerm && sortedIncomeCategories.length > 5 && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setShowAllIncomeCategories(!showAllIncomeCategories)}
                  className="py-2.5 px-6 bg-slate-900 hover:bg-slate-800 text-emerald-400 font-bold text-xs rounded-xl border border-slate-800 hover:border-emerald-500/30 transition shadow-md inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {showAllIncomeCategories ? '▲ Show Less' : '▼ Show More Categories (' + (sortedIncomeCategories.length - 5) + ' more)'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20 flex-shrink-0">
                <PieChart size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Category-Wise Expense Breakdown</h3>
                <p className="text-xs text-slate-400">Spending across operational categories for selected period.</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-bold text-rose-400 self-start sm:self-auto">
              Showing {categorySearchTerm ? sortedExpenseCategories.filter(([cat]) => cat.toLowerCase().includes(categorySearchTerm.toLowerCase())).length : (showAllCategories ? sortedExpenseCategories.length : Math.min(5, sortedExpenseCategories.length))} of {sortedExpenseCategories.length} Categories
            </span>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="🔍 Search expense categories (e.g. Salary, Rent, Ads, Supplies)..."
              value={categorySearchTerm}
              onChange={e => setCategorySearchTerm(e.target.value)}
              className="w-full py-2.5 px-4 bg-slate-900/90 border border-slate-800 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-rose-500 transition shadow-inner"
            />
            {categorySearchTerm && (
              <button type="button" onClick={() => setCategorySearchTerm('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-white text-xs font-bold">
                ✕ Clear
              </button>
            )}
          </div>

          <div className="space-y-3 text-xs">
            {sortedExpenseCategories.length === 0 ? (
              <p className="text-slate-500 text-center py-4">No expense records logged in selected date range.</p>
            ) : (
              (categorySearchTerm
                ? sortedExpenseCategories.filter(([cat]) => cat.toLowerCase().includes(categorySearchTerm.toLowerCase()))
                : (showAllCategories ? sortedExpenseCategories : sortedExpenseCategories.slice(0, 5))
              ).map(([cat, amt]) => {
                const pct = totalExpense > 0 ? ((amt / totalExpense) * 100).toFixed(1) : '0';
                return (
                  <div key={cat} className="p-3 bg-slate-900/80 rounded-xl border border-slate-800/80 space-y-1.5 hover:border-slate-700 transition">
                    <div className="flex justify-between items-center font-semibold">
                      <span className="text-slate-200 capitalize">{cat}</span>
                      <span className="font-mono text-rose-400 font-bold">₹{amt.toLocaleString('en-IN')} ({pct}%)</span>
                    </div>
                    <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                      <div className="h-full bg-gradient-to-r from-rose-500 to-amber-500 rounded-full" style={{ width: pct + '%' }} />
                    </div>
                  </div>
                );
              })
            )}

            {!categorySearchTerm && sortedExpenseCategories.length > 5 && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setShowAllCategories(!showAllCategories)}
                  className="py-2.5 px-6 bg-slate-900 hover:bg-slate-800 text-rose-400 font-bold text-xs rounded-xl border border-slate-800 hover:border-rose-500/30 transition shadow-md inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {showAllCategories ? '▲ Show Less' : '▼ Show More Categories (' + (sortedExpenseCategories.length - 5) + ' more)'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <FinancialYearCharts transactions={transactions} />
        </>
      )}
    </div>
  );
}
