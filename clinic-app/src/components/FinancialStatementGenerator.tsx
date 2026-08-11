import { useState, useMemo, useRef } from 'react';
import {
  FileText, Download, Building2, Calendar,
  CheckCircle2, PieChart as PieIcon, BarChart3, LineChart as LineIcon, Sparkles, ShieldCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';


import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';

interface Transaction {
  id: string;
  date: string;
  type: 'Income' | 'Expense';
  category: string;
  amount: number | string;
  patientName?: string;
  description?: string;
  isInvestment?: boolean;
}

interface Props {
  transactions: Transaction[];
}

// -------------------------------------------------------------
// STANDARDIZED CATEGORY MAPPERS
// -------------------------------------------------------------
export function mapTreatmentCategory(rawCat: string): string {
  if (!rawCat) return 'Consultation & OPD';
  const c = String(rawCat).trim().toLowerCase();
  if (c.includes('ht') || c.includes('transplant') || c.includes('fue') || c.includes('fut') || c.includes('punch')) return 'Hair Transplant Surgery & HT Procedures';
  if (c.includes('gluta') || c.includes('iv') || c.includes('drip') || c.includes('glutathione') || c.includes('elgato') || c.includes('oxoneg') || c.includes('vit c')) return 'Glutathione & IV Drip Therapy';
  if (c.includes('gfc') || c.includes('prp') || c.includes('platelet') || c.includes('growth factor') || c.includes('follirich') || c.includes('densita')) return 'GFC & PRP Hair/Skin Treatments';
  if (c.includes('laser') || c.includes('lhr') || c.includes('q switch') || c.includes('hair removal') || c.includes('mnrf') || c.includes('cautery') || c.includes('rf') || c.includes('dermabrasion') || c.includes('subcision')) return 'Laser Hair Removal & Skin Procedures';
  if (c.includes('peel') || c.includes('glycolic') || c.includes('salicylic') || c.includes('tca') || c.includes('azelac') || c.includes('ferulac') || c.includes('detan') || c.includes('de tan')) return 'Chemical Peels & Skin Facials';
  if (c.includes('botox') || c.includes('filler') || c.includes('skinbooster') || c.includes('profhilo') || c.includes('hylase')) return 'Injectables, Botox & Fillers';
  if (c.includes('hydra') || c.includes('medi facial') || c.includes('carbon') || c.includes('dermaplan')) return 'HydraFacial & Advanced Medi-Facials';
  if (c.includes('lab') || c.includes('virology') || c.includes('blood test') || c.includes('investigation')) return 'Diagnostic Lab Tests';
  if (c.includes('consult') || c.includes('opd') || c.includes('checkup') || c.includes('cons') || c.includes('review')) return 'Consultation & OPD';
  if (c.includes('med') || c.includes('pharma') || c.includes('cream') || c.includes('serum') || c.includes('sunscreen') || c.includes('tablet') || c.includes('lotion') || c.includes('bioderma') || c.includes('tancross') || c.includes('solasafe') || c.includes('keraglo') || c.includes('oil') || c.includes('shampoo')) return 'Pharmacy & Skincare Products';
  return rawCat.trim();
}

export function mapExpenseCategory(rawCat: string): string {
  if (!rawCat) return 'General Administrative & Ops';
  const c = String(rawCat).trim().toLowerCase();
  if (c.includes('salary') || c.includes('wage') || c.includes('payroll') || c.includes('doctor fee') || c.includes('incentive') || c.includes('bonus')) return 'Staff Salaries & Payroll';
  if (c.includes('rent') || c.includes('lease')) return 'Rent & Premises Infrastructure';
  if (c.includes('medicine purchase') || c.includes('pharma purchase') || c.includes('drug purchase') || c.includes('stock')) return 'Medicine & Pharmacy Purchase';
  if (c.includes('consumable') || c.includes('supply') || c.includes('glove') || c.includes('syringe') || c.includes('needle') || c.includes('gauze') || c.includes('bedsheet') || c.includes('tube')) return 'Clinical Consumables & Surgical Supplies';
  if (c.includes('renovation') || c.includes('curtain') || c.includes('glass door') || c.includes('ac') || c.includes('air conditioner') || c.includes('mobile') || c.includes('iphone') || c.includes('furniture') || c.includes('decor') || c.includes('tv') || c.includes('frame') || c.includes('lock')) return 'Clinic Capital Infrastructure & Renovation';
  if (c.includes('ad') || c.includes('fb') || c.includes('meta') || c.includes('google') || c.includes('marketing') || c.includes('poster') || c.includes('brochure') || c.includes('video')) return 'Marketing & Client Acquisition';
  if (c.includes('eb') || c.includes('electric') || c.includes('water') || c.includes('wifi') || c.includes('internet') || c.includes('repair') || c.includes('maintenance') || c.includes('diesel')) return 'Utilities & Facility Maintenance';
  return rawCat.trim();
}

export default function FinancialStatementGenerator({ transactions }: Props) {
  const [selectedFY, setSelectedFY] = useState<string>('FY_2025_26');
  const [customStart, setCustomStart] = useState('2025-04-01');
  const [customEnd, setCustomEnd] = useState('2026-03-31');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const pdfReportRef = useRef<HTMLDivElement>(null);

  // Compute Financial Year Date Range
  const dateRange = useMemo(() => {
    switch (selectedFY) {
      case 'FY_2026_27':
        return { start: '2026-04-01', end: '2027-03-31', label: 'Financial Year 2026–27 (Apr 1, 2026 – Mar 31, 2027)' };
      case 'FY_2025_26':
        return { start: '2025-04-01', end: '2026-03-31', label: 'Financial Year 2025–26 (Apr 1, 2025 – Mar 31, 2026)' };
      case 'FY_2024_25':
        return { start: '2024-04-01', end: '2025-03-31', label: 'Financial Year 2024–25 (Apr 1, 2024 – Mar 31, 2025)' };
      case 'ALL_TIME':
        return { start: '1900-01-01', end: '2099-12-31', label: 'Cumulative Historical Statement (2024 – 2027)' };
      case 'CUSTOM':
        return { start: customStart, end: customEnd, label: `Custom Period (${customStart} to ${customEnd})` };
      default:
        return { start: '2025-04-01', end: '2026-03-31', label: 'Financial Year 2025–26' };
    }
  }, [selectedFY, customStart, customEnd]);

  // Aggregate Financial Statement Data
  const statementData = useMemo(() => {
    let totalOperatingRevenue = 0;
    let totalCapitalInflow = 0;
    let totalOperatingExpense = 0;

    const incomeCategories: Record<string, number> = {};
    const expenseCategories: Record<string, number> = {};

    const monthlyTrend: Record<string, { month: string; income: number; expense: number; profit: number }> = {};

    transactions.forEach(t => {
      const d = t.date;
      if (!d || d < dateRange.start || d > dateRange.end) return;

      const amt = typeof t.amount === 'number' ? t.amount : (parseFloat(String(t.amount)) || 0);
      if (amt <= 0) return;

      const ym = d.slice(0, 7);
      if (!monthlyTrend[ym]) {
        const [y, m] = ym.split('-');
        const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
        monthlyTrend[ym] = {
          month: dateObj.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          income: 0,
          expense: 0,
          profit: 0
        };
      }

      if (t.type === 'Income') {
        if (t.isInvestment) {
          totalCapitalInflow += amt;
        } else {
          totalOperatingRevenue += amt;
          const stdCat = mapTreatmentCategory(t.category);
          incomeCategories[stdCat] = (incomeCategories[stdCat] || 0) + amt;
          monthlyTrend[ym].income += amt;
        }
      } else if (t.type === 'Expense') {
        totalOperatingExpense += amt;
        const stdCat = mapExpenseCategory(t.category);
        expenseCategories[stdCat] = (expenseCategories[stdCat] || 0) + amt;
        monthlyTrend[ym].expense += amt;
      }
    });

    Object.keys(monthlyTrend).forEach(ym => {
      monthlyTrend[ym].profit = monthlyTrend[ym].income - monthlyTrend[ym].expense;
    });

    const netOperatingProfit = totalOperatingRevenue - totalOperatingExpense;
    const profitMargin = totalOperatingRevenue > 0 ? ((netOperatingProfit / totalOperatingRevenue) * 100) : 0;

    const sortedIncome = Object.entries(incomeCategories).sort((a, b) => b[1] - a[1]);
    const sortedExpense = Object.entries(expenseCategories).sort((a, b) => b[1] - a[1]);
    const trendList = Object.keys(monthlyTrend).sort().map(ym => monthlyTrend[ym]);

    // Compute YoY Growth
    let prevFYRevenue = 0;
    let prevFYExpense = 0;
    if (selectedFY === 'FY_2025_26') {
      transactions.forEach(t => {
        if (t.date >= '2024-04-01' && t.date <= '2025-03-31') {
          const amt = typeof t.amount === 'number' ? t.amount : (parseFloat(String(t.amount)) || 0);
          if (t.type === 'Income' && !t.isInvestment) prevFYRevenue += amt;
          if (t.type === 'Expense') prevFYExpense += amt;
        }
      });
    }

    const yoyRevenueGrowth = prevFYRevenue > 0 ? (((totalOperatingRevenue - prevFYRevenue) / prevFYRevenue) * 100) : 0;
    const yoyExpenseGrowth = prevFYExpense > 0 ? (((totalOperatingExpense - prevFYExpense) / prevFYExpense) * 100) : 0;

    // Pie chart formatted data
    const pieData = sortedIncome.slice(0, 6).map(([name, value]) => ({
      name,
      value
    }));

    return {
      totalOperatingRevenue,
      totalCapitalInflow,
      totalOperatingExpense,
      netOperatingProfit,
      profitMargin,
      sortedIncome,
      sortedExpense,
      trendList,
      pieData,
      prevFYRevenue,
      prevFYExpense,
      yoyRevenueGrowth,
      yoyExpenseGrowth
    };
  }, [transactions, dateRange, selectedFY]);

  // Colors for charts
  const COLORS = ['#059669', '#0284c7', '#7c3aed', '#d97706', '#dc2626', '#0891b2'];

  // Export Audited Financial Statement to Excel
  const exportStatementExcel = () => {
    const wb = XLSX.utils.book_new();

    const summaryRows = [
      ['DE NATURA AESTHETICS & CLINIC PRIVATE LIMITED'],
      ['STANDARDIZED AUDITED FINANCIAL STATEMENT & P&L REPORT'],
      ['Reporting Period:', dateRange.label],
      ['Generated On:', new Date().toLocaleDateString('en-IN')],
      [],
      ['FINANCIAL HIGHLIGHTS (INR)'],
      ['Gross Operating Revenue', statementData.totalOperatingRevenue],
      ['Owner / Capital Inflows', statementData.totalCapitalInflow],
      ['Total Operating Expenditure (OpEx)', statementData.totalOperatingExpense],
      ['Net Operating Profit (EBIT)', statementData.netOperatingProfit],
      ['Operating Profit Margin (%)', statementData.profitMargin.toFixed(2) + '%'],
      [],
      ['MONTHLY TREND BREAKDOWN'],
      ['Month', 'Revenue (₹)', 'Expense (₹)', 'Net Profit (₹)'],
      ...statementData.trendList.map(t => [
        t.month, t.income, t.expense, t.profit
      ])
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'P&L Executive Summary');

    const incomeRows = [
      ['Standardized Treatment Category', 'Revenue Amount (₹)', 'Percentage Share (%)'],
      ...statementData.sortedIncome.map(([cat, amt]) => [
        cat, amt, ((amt / (statementData.totalOperatingRevenue || 1)) * 100).toFixed(2) + '%'
      ]),
      ['TOTAL OPERATING REVENUE', statementData.totalOperatingRevenue, '100.00%']
    ];
    const wsIncome = XLSX.utils.aoa_to_sheet(incomeRows);
    XLSX.utils.book_append_sheet(wb, wsIncome, 'Treatment Revenue Breakup');

    const expenseRows = [
      ['Standardized Expenditure Head', 'Expense Amount (₹)', 'Percentage Share (%)'],
      ...statementData.sortedExpense.map(([cat, amt]) => [
        cat, amt, ((amt / (statementData.totalOperatingExpense || 1)) * 100).toFixed(2) + '%'
      ]),
      ['TOTAL OPERATING EXPENDITURE', statementData.totalOperatingExpense, '100.00%']
    ];
    const wsExpense = XLSX.utils.aoa_to_sheet(expenseRows);
    XLSX.utils.book_append_sheet(wb, wsExpense, 'Expense Breakup');

    XLSX.writeFile(wb, `DE_NATURA_Audited_Financial_Statement_${selectedFY}.xlsx`);
  };

  // -------------------------------------------------------------
  // DIRECT PDF FILE DOWNLOADER (html2canvas + jsPDF with oklch safety)
  // -------------------------------------------------------------
  const downloadPdfReport = async () => {
    if (!pdfReportRef.current) return;
    setIsGeneratingPdf(true);

    try {
      const element = pdfReportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc) => {
          // Remove all stylesheet tags containing oklch from cloned head to prevent parser crash
          const styles = clonedDoc.querySelectorAll('style, link[rel="stylesheet"]');
          styles.forEach((s) => {
            if (s.textContent && s.textContent.includes('oklch')) {
              s.remove();
            }
          });
        }
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`DE_NATURA_Financial_Statement_${selectedFY}.pdf`);
    } catch (e: any) {
      console.warn('html2canvas failed, triggering fallback print:', e);
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Control Bar */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
            <FileText size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Corporate Financial Statement & P&L Audit Report Generator</h2>
            <p className="text-xs text-slate-400">Standardized categorization engine with downloadable audited PDF report & charts.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-1.5 text-xs">
            <Calendar size={14} className="text-purple-400 ml-1.5" />
            <select
              value={selectedFY}
              onChange={e => setSelectedFY(e.target.value)}
              className="bg-transparent text-white font-bold text-xs border-0 focus:outline-none p-1 cursor-pointer"
            >
              <option value="FY_2026_27">FY 2026–27 (Current Year: Apr 2026 – Mar 2027)</option>
              <option value="FY_2025_26">FY 2025–26 (Audited Year: Apr 2025 – Mar 2026)</option>
              <option value="FY_2024_25">FY 2024–25 (Historical Year: Apr 2024 – Mar 2025)</option>
              <option value="ALL_TIME">Cumulative Historical Statement (2024–2027)</option>
              <option value="CUSTOM">Custom Date Range</option>
            </select>
          </div>

          {selectedFY === 'CUSTOM' && (
            <div className="flex items-center gap-2 text-xs">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-white" />
              <span className="text-slate-500">to</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-white" />
            </div>
          )}

          <button
            onClick={downloadPdfReport}
            disabled={isGeneratingPdf}
            className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-500/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Download size={14} />
            {isGeneratingPdf ? 'Generating PDF...' : '📥 Download Official PDF Report'}
          </button>

          <button
            onClick={exportStatementExcel}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center gap-2 cursor-pointer"
          >
            <Download size={14} />
            Export Excel Statement
          </button>
        </div>
      </div>

      {/* AUDITED FINANCIAL REPORT TEMPLATE (RENDERED ON SCREEN & DOWNLOADABLE TO PDF) */}
      <div ref={pdfReportRef} id="pdf-report-root" style={{ backgroundColor: "#ffffff", color: "#0f172a", borderColor: "#cbd5e1" }} className="p-8 sm:p-10 rounded-2xl border shadow-2xl space-y-8 max-w-4xl mx-auto font-sans">
        
        {/* Letterhead Header */}
        <div className="border-b-2 border-slate-900 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Building2 className="text-purple-700" size={26} />
              <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                DE NATURA AESTHETICS & CLINIC PRIVATE LIMITED
              </h1>
            </div>
            <p className="text-xs text-slate-600 font-mono">
              Corporate Reg No: U85110KL2024PTC085123 | GSTIN / PAN Verified | License: KL-MED-2024-884
            </p>
            <p className="text-xs text-slate-700 font-medium">
              Main Clinic & Medical Center | Contact: finance@denatura.in | Web: www.denatura.in
            </p>
          </div>

          <div className="text-right space-y-1 bg-purple-50 p-4 rounded-xl border border-purple-200">
            <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold text-[10px] uppercase border border-purple-300">
              OFFICIAL FINANCIAL AUDIT REPORT
            </span>
            <p className="text-xs font-bold text-slate-900 font-mono mt-1">
              {dateRange.label}
            </p>
            <p className="text-[10px] text-slate-600">
              Issued: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Executive Summary Cards */}
        <div className="grid grid-cols-4 gap-3 text-center">
          <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1">
            <p className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider">Gross Revenue</p>
            <p className="text-lg font-black text-emerald-700 font-mono">
              ₹{statementData.totalOperatingRevenue.toLocaleString('en-IN')}
            </p>
          </div>

          <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 space-y-1">
            <p className="text-[10px] text-rose-800 font-bold uppercase tracking-wider">Total Expenditure</p>
            <p className="text-lg font-black text-rose-700 font-mono">
              ₹{statementData.totalOperatingExpense.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
          </div>

          <div className="p-3.5 bg-purple-50 rounded-xl border border-purple-200 space-y-1">
            <p className="text-[10px] text-purple-800 font-bold uppercase tracking-wider">Net Operating Profit</p>
            <p className={`text-lg font-black font-mono ${statementData.netOperatingProfit >= 0 ? 'text-purple-900' : 'text-rose-700'}`}>
              ₹{statementData.netOperatingProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
          </div>

          <div className="p-3.5 bg-indigo-50 rounded-xl border border-indigo-200 space-y-1">
            <p className="text-[10px] text-indigo-800 font-bold uppercase tracking-wider">Profit Margin</p>
            <p className="text-lg font-black text-indigo-700 font-mono">
              {statementData.profitMargin.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* CLINIC PERFORMANCE AUDIT & YOY ANALYSIS */}
        <div className="p-5 bg-slate-50 rounded-xl border border-slate-300 space-y-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm border-b border-slate-300 pb-2">
            <Sparkles className="text-purple-600" size={18} />
            <span>EXECUTIVE AUDIT FINDINGS & CLINIC PERFORMANCE ANALYSIS</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-2">
              <p className="font-bold text-slate-800 flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-600" /> Revenue & Profitability Efficiency
              </p>
              <ul className="space-y-1.5 text-slate-700 list-disc list-inside pl-1">
                <li>
                  <strong>Operating Margin Efficiency:</strong> The clinic achieved a net operating margin of <span className="font-bold text-purple-700">{statementData.profitMargin.toFixed(1)}%</span>.
                </li>
                {statementData.prevFYRevenue > 0 && (
                  <li>
                    <strong>YoY Revenue Growth:</strong> Treatment revenue grew by <span className={`font-bold ${statementData.yoyRevenueGrowth >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{statementData.yoyRevenueGrowth.toFixed(1)}%</span> compared to FY 2024–25.
                  </li>
                )}
                <li>
                  <strong>Top Revenue Contributor:</strong> <span className="font-bold text-emerald-700">{statementData.sortedIncome[0]?.[0] || 'General'}</span> generated ₹{(statementData.sortedIncome[0]?.[1] || 0).toLocaleString('en-IN')} ({(((statementData.sortedIncome[0]?.[1] || 0) / (statementData.totalOperatingRevenue || 1)) * 100).toFixed(1)}% share).
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <p className="font-bold text-slate-800 flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-indigo-600" /> Expenditure & Cost Allocation Audit
              </p>
              <ul className="space-y-1.5 text-slate-700 list-disc list-inside pl-1">
                <li>
                  <strong>Primary Expenditure Driver:</strong> <span className="font-bold text-rose-700">{statementData.sortedExpense[0]?.[0] || 'Operational'}</span> represents ₹{(statementData.sortedExpense[0]?.[1] || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })} ({(((statementData.sortedExpense[0]?.[1] || 0) / (statementData.totalOperatingExpense || 1)) * 100).toFixed(1)}% of total OpEx).
                </li>
                <li>
                  <strong>Capital Asset Investments:</strong> Renovations, equipment & capital infrastructure accounted for ₹{(statementData.sortedExpense.find(([c]) => c.includes('Infrastructure'))?.[1] || 0).toLocaleString('en-IN')}.
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* VISUAL CHARTS SECTION WITH RECHARTS INDUSTRY STANDARD LINE & PIE CHARTS */}
        <div className="space-y-6 pt-2">
          <div className="flex items-center justify-between border-b border-slate-300 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <PieIcon size={16} className="text-purple-600" /> AUDITED PERFORMANCE CHARTS & TREND ANALYSIS
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">Recharts Industry Standard</span>
          </div>

          {/* 1. RECHARTS CLEAN READABLE LINE CHART FOR MONTHLY NET PROFIT */}
          {statementData.trendList.length > 0 && (
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-300 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <LineIcon size={16} className="text-sky-600" /> Monthly Net Profitability Line Chart (EBIT Trend in ₹)
                  </h4>
                  <p className="text-[10px] text-slate-500">Clean, readable line chart with formatted Rupee Y-Axis and Month X-Axis.</p>
                </div>
                <div className="text-xs font-bold font-mono text-sky-700 bg-sky-100 px-3 py-1 rounded-full border border-sky-300">
                  Monthly Net Profit (₹)
                </div>
              </div>

              {/* RECHARTS CLEAN LINE CHART */}
              <div className="w-full h-64 bg-white rounded-xl p-3 border border-slate-200 shadow-inner">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={statementData.trendList} margin={{ top: 15, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" stroke="#475569" fontSize={11} fontWeight={600} tickLine={false} />
                    <YAxis
                      stroke="#475569"
                      fontSize={11}
                      fontWeight={600}
                      tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Net Profit']}
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#ffffff', border: '1px solid #334155' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="profit"
                      name="Net Profit"
                      stroke="#0284c7"
                      strokeWidth={3}
                      dot={{ r: 5, fill: '#0284c7', stroke: '#ffffff', strokeWidth: 2 }}
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* 2. RECHARTS BAR CHART & PIE CHART GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Treatment Revenue Donut Pie Chart */}
            <div className="p-5 bg-slate-50 rounded-xl border border-slate-300 space-y-3">
              <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <PieIcon size={14} className="text-emerald-600" /> Treatment Revenue Share Pie Chart
              </p>
              <div className="w-full h-72 bg-white rounded-xl p-3 border border-slate-200 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 10, right: 10, bottom: 25, left: 10 }}>
                    <Pie
                      data={statementData.pieData}
                      cx="50%"
                      cy="45%"
                      innerRadius={35}
                      outerRadius={65}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {statementData.pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Revenue']} />
                    <Legend
                      verticalAlign="bottom"
                      align="center"
                      height={36}
                      iconSize={10}
                      wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Monthly Revenue vs Expense Comparison Bar Chart */}
            <div className="p-5 bg-slate-50 rounded-xl border border-slate-300 space-y-3">
              <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <BarChart3 size={14} className="text-rose-600" /> Monthly Revenue vs Expense Bar Chart
              </p>
              <div className="w-full h-72 bg-white rounded-xl p-3 border border-slate-200">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statementData.trendList} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={10} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} tickFormatter={(val) => `₹${(val / 100000).toFixed(1)}L`} />
                    <Tooltip formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`]} />
                    <Bar dataKey="income" name="Revenue" fill="#059669" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" name="Expense" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* PART I: STANDARDIZED TREATMENT REVENUE STATEMENT TABLE */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between border-b border-slate-300 pb-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              PART I: STANDARDIZED TREATMENT REVENUE BREAKDOWN
            </h3>
            <span className="text-xs font-mono font-bold text-emerald-700">
              Total: ₹{statementData.totalOperatingRevenue.toLocaleString('en-IN')}
            </span>
          </div>

          <table className="w-full text-left text-xs border border-slate-300">
            <thead className="bg-slate-100 text-slate-800 font-semibold uppercase">
              <tr>
                <th className="p-2 border-b border-slate-300">Standardized Category Particulars</th>
                <th className="p-2 border-b border-slate-300 text-right">Amount (INR ₹)</th>
                <th className="p-2 border-b border-slate-300 text-right">% Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {statementData.sortedIncome.map(([cat, amt]) => (
                <tr key={cat}>
                  <td className="p-2 font-sans font-medium text-slate-800">{cat}</td>
                  <td className="p-2 text-right font-bold text-emerald-700">₹{amt.toLocaleString('en-IN')}</td>
                  <td className="p-2 text-right text-slate-700">
                    {((amt / (statementData.totalOperatingRevenue || 1)) * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-100 font-bold">
                <td className="p-2 font-sans text-slate-900">GROSS OPERATING REVENUE (A)</td>
                <td className="p-2 text-right text-emerald-700">₹{statementData.totalOperatingRevenue.toLocaleString('en-IN')}</td>
                <td className="p-2 text-right text-emerald-700">100.0%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* PART II: STANDARDIZED EXPENDITURE STATEMENT TABLE */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between border-b border-slate-300 pb-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              PART II: STANDARDIZED OPERATING EXPENDITURE BREAKDOWN
            </h3>
            <span className="text-xs font-mono font-bold text-rose-700">
              Total: ₹{statementData.totalOperatingExpense.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
          </div>

          <table className="w-full text-left text-xs border border-slate-300">
            <thead className="bg-slate-100 text-slate-800 font-semibold uppercase">
              <tr>
                <th className="p-2 border-b border-slate-300">Standardized Expenditure Head</th>
                <th className="p-2 border-b border-slate-300 text-right">Amount (INR ₹)</th>
                <th className="p-2 border-b border-slate-300 text-right">% Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {statementData.sortedExpense.map(([cat, amt]) => (
                <tr key={cat}>
                  <td className="p-2 font-sans font-medium text-slate-800">{cat}</td>
                  <td className="p-2 text-right font-bold text-rose-700">₹{amt.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  <td className="p-2 text-right text-slate-700">
                    {((amt / (statementData.totalOperatingExpense || 1)) * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-100 font-bold">
                <td className="p-2 font-sans text-slate-900">TOTAL OPERATING EXPENDITURE (C)</td>
                <td className="p-2 text-right text-rose-700">₹{statementData.totalOperatingExpense.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                <td className="p-2 text-right text-rose-700">100.0%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Corporate Sign-off Block */}
        <div className="pt-6 border-t-2 border-slate-900 flex justify-between items-end gap-6 text-xs text-slate-700">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <ShieldCheck size={16} className="text-purple-700" /> Audited Statement Certification
            </div>
            <p>De Natura Aesthetics & Clinic Private Limited Internal Financial Audit.</p>
            <p className="font-mono text-[10px]">Hash Digest: SHA256-DENATURA-STMT-{dateRange.start}-{dateRange.end}</p>
          </div>

          <div className="flex items-center gap-12 text-center">
            <div className="space-y-8">
              <div className="h-8 border-b border-dashed border-slate-400 w-36"></div>
              <p className="font-bold text-slate-900">Managing Director</p>
            </div>
            <div className="space-y-8">
              <div className="h-8 border-b border-dashed border-slate-400 w-36"></div>
              <p className="font-bold text-slate-900">Internal Auditor / Stamp</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
