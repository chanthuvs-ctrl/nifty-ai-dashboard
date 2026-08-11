import { useState, useEffect } from 'react';
import { OFFICIAL_STAFF_REGISTRY, getStaffByInput } from '../constants/staffRegistry';
import { db } from '../firebase';
import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { Download, Printer, FileText, CheckCircle, Save, AlertCircle, RefreshCw } from 'lucide-react';
import jsPDF from 'jspdf';

import { DE_NATURA_LOGO_BASE64 } from '../logoBase64';



export default function PayslipGenerator({ isAdmin = true, currentEmpEmail }: { isAdmin?: boolean; currentEmpEmail?: string }) {
  // OFFICIAL_STAFF_REGISTRY is the sole source — no need for mutable state
  const employees = OFFICIAL_STAFF_REGISTRY;
  const [selectedEmpEmail, setSelectedEmpEmail] = useState('');
  
  const currentYear = new Date().getFullYear();
  const currentMonthIdx = new Date().getMonth();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const [selectedMonth, setSelectedMonth] = useState(monthNames[currentMonthIdx]);
  const [selectedYear, setSelectedYear] = useState(String(currentYear));

  // Helper: Calculate exact days in month
  const getDaysInMonth = (monthName: string, yearStr: string): number => {
    const idx = monthNames.indexOf(monthName);
    const yr = parseInt(yearStr) || new Date().getFullYear();
    if (idx === -1) return 31;
    return new Date(yr, idx + 1, 0).getDate();
  };

  // Employee Detail Inputs
  const [empName, setEmpName] = useState<string>('Aparnendhu');
  const [designation, setDesignation] = useState<string>('Customer Relation Executive');
  const [department, setDepartment] = useState<string>('Clinic Operations');
  const [joiningDate, setJoiningDate] = useState<string>('12-05-2025');

  // Earnings Inputs
  const [fixedSalary, setFixedSalary] = useState<number | string>(11000);
  const [overtimeAllowance, setOvertimeAllowance] = useState<number | string>(0);
  const [htAllowance, setHtAllowance] = useState<number | string>(0);
  const [otherAllowance, setOtherAllowance] = useState<number | string>(0);
  const [bonus, setBonus] = useState<number | string>(0);

  // Attendance & Deductions Inputs
  const [totalWorkingDays, setTotalWorkingDays] = useState<number | string>(getDaysInMonth(monthNames[currentMonthIdx], String(currentYear)));
  const [daysWorked, setDaysWorked] = useState<number | string>(getDaysInMonth(monthNames[currentMonthIdx], String(currentYear)));
  const [fullDayLeaves, setFullDayLeaves] = useState<number | string>(0);
  const [halfDayLeaves, setHalfDayLeaves] = useState<number | string>(0);
  const [totalLops, setTotalLops] = useState<number | string>(0);
  const [overtimeDays, setOvertimeDays] = useState<number | string>(0);
  const [compOff, setCompOff] = useState<number | string>(0);
  const [salaryAdvance, setSalaryAdvance] = useState<number | string>(0);
  const [tds, setTds] = useState<number | string>(0);

  // Firestore Sync & Generation Status
  const [isGenerated, setIsGenerated] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLoadingPayslip, setIsLoadingPayslip] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string>('');

  // Load existing payslip & AUTO-DETECT LAST GENERATED PAYSLIP MONTH
  const loadPayslipRecord = async (emailStr: string, monthStr: string, yearStr: string) => {
    if (!emailStr) return;
    const canonicalStaff = getStaffByInput(emailStr);
    if (!canonicalStaff) return;
    setIsLoadingPayslip(true);

    const targetMonth = monthStr || 'July';
    const mLower = targetMonth.toLowerCase();
    
    // Candidate Doc IDs for absolute backward & forward compatibility
    const candidateDocIds = [
      'payslip_' + canonicalStaff.empId + '_' + mLower + '_' + yearStr,
      'payslip_' + canonicalStaff.email.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + mLower + '_' + yearStr,
      ...(canonicalStaff.aliases || []).map(a => 'payslip_' + a.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + mLower + '_' + yearStr)
    ];
    const uniqueDocIds = Array.from(new Set(candidateDocIds));

    let cloudRecord: any = null;

    // 1. QUERY CLOUD FIRESTORE FOR SPECIFIC SELECTED PERIOD
    for (const dId of uniqueDocIds) {
      try {
        const snap = await getDoc(doc(db, 'Payslips', dId));
        if (snap.exists() && snap.data() && snap.data().isGenerated !== false) {
          cloudRecord = snap.data();
          break;
        }
      } catch (e) {}
    }

    const applyDataRecord = (data: any) => {
      if (!data) return;
      setSelectedMonth(data.selectedMonth || targetMonth);
      setEmpName(data.empName || canonicalStaff.name);
      setDesignation(data.designation || canonicalStaff.role);
      setDepartment(data.department || canonicalStaff.department);
      setJoiningDate(data.joiningDate || canonicalStaff.joiningDate);
      setFixedSalary(data.fixedSalary !== undefined ? parseFloat(String(data.fixedSalary)) : canonicalStaff.basicSalary);
      setOvertimeAllowance(data.overtimeAllowance || 0);
      setHtAllowance(data.htAllowance || 0);
      setOtherAllowance(data.otherAllowance || 0);
      setBonus(data.bonus || 0);
      const totalDaysInMonth = data.totalWorkingDays || getDaysInMonth(targetMonth, yearStr);
      setTotalWorkingDays(totalDaysInMonth);
      setFullDayLeaves(data.fullDayLeaves !== undefined ? parseFloat(String(data.fullDayLeaves)) : 0);
      setHalfDayLeaves(data.halfDayLeaves !== undefined ? parseFloat(String(data.halfDayLeaves)) : 0);
      setTotalLops(data.totalLops !== undefined ? parseFloat(String(data.totalLops)) : 0);
      setDaysWorked(data.daysWorked !== undefined ? parseFloat(String(data.daysWorked)) : (totalDaysInMonth - (data.totalLops !== undefined ? parseFloat(String(data.totalLops)) : 0)));
      setSalaryAdvance(data.salaryAdvance !== undefined ? parseFloat(String(data.salaryAdvance)) : 0);
      setTds(data.tds !== undefined ? parseFloat(String(data.tds)) : 0);
      setIsGenerated(true);
    };

    if (cloudRecord) {
      applyDataRecord(cloudRecord);
      try {
        localStorage.setItem('de_natura_payslip_' + 'payslip_' + canonicalStaff.empId + '_' + mLower + '_' + yearStr, JSON.stringify(cloudRecord));
      } catch(e){}
      setIsLoadingPayslip(false);
      return;
    }



    // 3. DYNAMIC FIRESTORE LEAVES QUERY FOR SELECTED UNGENERATED PERIOD
    let dynamicApprovedLeaves = 0;
    try {
      const snapLeaves = await getDocs(collection(db, 'Leaves'));
      if (!snapLeaves.empty) {
        const monthIdxStr = String(monthNames.indexOf(targetMonth) + 1).padStart(2, '0');
        snapLeaves.docs.forEach(d => {
          const l = d.data();
          const isUserMatch = (l.empId && l.empId === canonicalStaff.empId) ||
                              (l.userEmail && l.userEmail.toLowerCase() === canonicalStaff.email.toLowerCase()) ||
                              (l.userName && canonicalStaff.name && l.userName.toLowerCase().includes(canonicalStaff.name.toLowerCase().split(' ')[0]));
          const isMatchingMonth = l.startDate && (l.startDate.includes('-' + monthIdxStr + '-') || l.startDate.includes(yearStr));
          if (isUserMatch && l.status === 'Approved' && isMatchingMonth) {
            dynamicApprovedLeaves += parseFloat(String(l.days)) || 1;
          }
        });
      }
    } catch(e) {}

    const defaultWorkingDays = getDaysInMonth(targetMonth, yearStr);
    const dynamicLops = Math.max(0, dynamicApprovedLeaves - 1);

    setSelectedMonth(targetMonth);
    setIsGenerated(true);
    setEmpName(canonicalStaff.name);
    setDesignation(canonicalStaff.role);
    setDepartment(canonicalStaff.department);
    setJoiningDate(canonicalStaff.joiningDate);
    setFixedSalary(canonicalStaff.basicSalary);
    setTotalWorkingDays(defaultWorkingDays);
    setFullDayLeaves(dynamicApprovedLeaves);
    setTotalLops(dynamicLops);
    setDaysWorked(defaultWorkingDays - dynamicLops);
    setSalaryAdvance(0);
    setIsLoadingPayslip(false);
  };

  // Match target employee email using 100% unique canonical resolution
  const syncEmployeeDetails = (targetEmail?: string, _list?: any[]) => {
    const activeSessionEmail = sessionStorage.getItem('userEmail') || '';
    const cleanTarget = (targetEmail || currentEmpEmail || activeSessionEmail || '').trim().toLowerCase();
    const canonicalStaff = getStaffByInput(cleanTarget);

    if (!canonicalStaff) return;

    if (canonicalStaff) {
      setSelectedEmpEmail(canonicalStaff.email);
      setEmpName(canonicalStaff.name);
      setDesignation(canonicalStaff.role || 'Clinic Staff');
      setDepartment(canonicalStaff.department || 'Clinic Operations');
      setFixedSalary(canonicalStaff.basicSalary);
      setJoiningDate(canonicalStaff.joiningDate || '12-05-2025');
      // Note: Do NOT call loadPayslipRecord here. The second useEffect
      // [selectedMonth, selectedYear, selectedEmpEmail] handles all data loading.
      // Calling it here creates a race condition.
    }
  };

  useEffect(() => {
    const activeSessionEmail = sessionStorage.getItem('userEmail') || '';
    const emailToUse = currentEmpEmail || activeSessionEmail;
    
    // 1. Synchronous Instant Hydration (0ms)
    syncEmployeeDetails(emailToUse);

    // OFFICIAL_STAFF_REGISTRY is the single source of truth for payslip dropdowns.
    // Firestore 'Users' collection is only for StaffManagement CRUD and has
    // different/legacy email formats that cause duplicates. We do NOT merge here.
  }, [currentEmpEmail]);

  useEffect(() => {
    if (selectedEmpEmail) {
      loadPayslipRecord(selectedEmpEmail, selectedMonth, selectedYear);
    }
  }, [selectedMonth, selectedYear, selectedEmpEmail]);

    const handleEmpChange = (email: string) => {
    const emp = employees.find(e => e.email === email) || getStaffByInput(email);
    if (!emp) return;

    // FIX: Reset ALL salary fields to zero / registry defaults BEFORE the async
    // Firestore fetch runs. This prevents old employee's values (advance, LOPs, etc.)
    // from persisting on screen while the new employee's data is loading.
    setEmpName(emp.name);
    setDesignation(emp.role || (emp as any).designation || 'Clinic Staff');
    setDepartment(emp.department || 'Clinic Operations');
    setFixedSalary(parseFloat(String(emp.basicSalary)) || 0);
    setJoiningDate(emp.joiningDate || '12-05-2025');
    setOvertimeAllowance(0);
    setHtAllowance(0);
    setOtherAllowance(0);
    setBonus(0);
    setSalaryAdvance(0);
    setTds(0);
    setTotalLops(0);
    setFullDayLeaves(0);
    setHalfDayLeaves(0);
    setOvertimeDays(0);
    setCompOff(0);

    // FIX: Set selectedEmpEmail LAST so the useEffect[selectedEmpEmail] fires AFTER
    // the reset above — guaranteeing a clean slate before the Firestore fetch runs.
    // Do NOT call loadPayslipRecord here; useEffect handles it exactly once.
    setSelectedEmpEmail(emp.email);
  };

  // Helper numerical parsers
  const numFixedSalary = parseFloat(String(fixedSalary)) || 0;
  const numTotalWorkingDays = parseFloat(String(totalWorkingDays)) || 31;
  const numTotalLops = parseFloat(String(totalLops)) || 0;
  const numSalaryAdvance = parseFloat(String(salaryAdvance)) || 0;
  const numTds = parseFloat(String(tds)) || 0;
  const numOvertimeAllowance = parseFloat(String(overtimeAllowance)) || 0;
  const numHtAllowance = parseFloat(String(htAllowance)) || 0;
  const numOtherAllowance = parseFloat(String(otherAllowance)) || 0;
  const numBonus = parseFloat(String(bonus)) || 0;

  // Days Worked = Total Days - Loss of Pay Days
  const computedDaysWorked = Math.max(0, numTotalWorkingDays - numTotalLops);

  // Dynamic Calculations matching Google Sheet
  const dailyRate = numTotalWorkingDays > 0 ? numFixedSalary / numTotalWorkingDays : 0;
  const lossOfPayAmount = Math.round(dailyRate * numTotalLops);
  const totalDeductions = lossOfPayAmount + numSalaryAdvance + numTds;
  const grossEarnings = numFixedSalary + numOvertimeAllowance + numHtAllowance + numOtherAllowance + numBonus;
  const netTotal = Math.max(0, grossEarnings - totalDeductions);

  // Admin Save & Generate Action
  const handleSaveAndGenerate = async () => {
    if (!selectedEmpEmail) return;
    setIsSaving(true);
    setSaveMessage('');

    const canonicalStaff = getStaffByInput(selectedEmpEmail);
    if (!canonicalStaff) return;

    const mLower = selectedMonth.toLowerCase();
    const candidateDocIds = [
      'payslip_' + canonicalStaff.empId + '_' + mLower + '_' + selectedYear,
      'payslip_' + canonicalStaff.email.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + mLower + '_' + selectedYear,
      ...(canonicalStaff.aliases || []).map((a: string) => 'payslip_' + a.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + mLower + '_' + selectedYear)
    ];
    const uniqueDocIds = Array.from(new Set(candidateDocIds));

    const record = {
      docId: uniqueDocIds[0],
      empId: canonicalStaff.empId,
      empName,
      empEmail: canonicalStaff.email,
      designation,
      department,
      joiningDate,
      selectedMonth,
      selectedYear,
      fixedSalary,
      overtimeAllowance,
      htAllowance,
      otherAllowance,
      bonus,
      totalWorkingDays,
      daysWorked,
      fullDayLeaves,
      halfDayLeaves,
      totalLops,
      overtimeDays,
      compOff,
      salaryAdvance,
      tds,
      lossOfPayAmount,
      grossEarnings,
      totalDeductions,
      netTotal,
      isGenerated: true,
      generatedAt: Date.now()
    };

    let saveSuccess = false;
    const primaryDocId = uniqueDocIds[0];
    for (const dId of uniqueDocIds) {
      const aliasRecord = { ...record, docId: dId };
      try {
        await setDoc(doc(db, 'Payslips', dId), aliasRecord, { merge: true });
        if (dId === primaryDocId) saveSuccess = true;
      } catch (e: any) {
        console.error('Firestore save FAILED for ' + dId + ':', e);
      }
    }

    setIsGenerated(true);
    if (saveSuccess) {
      setSaveMessage('✓ Payslip for ' + empName + ' (' + selectedMonth + ' ' + selectedYear + ') saved to Cloud successfully!');
    } else {
      setSaveMessage('❌ SAVE FAILED — Could not write to Firestore. Check your internet connection and try again.');
    }
    setIsSaving(false);
  };

  const fmtVal = (val: any) => {
    const n = parseFloat(String(val)) || 0;
    if (n <= 0) return '-';
    return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleDownloadPDF = () => {
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 12;
      const contentWidth = pageWidth - (margin * 2);

      // Outer Border
      pdf.setLineWidth(0.5);
      pdf.setDrawColor(0, 0, 0);
      pdf.rect(margin, margin, contentWidth, 260);

      // Header Section
      pdf.rect(margin, margin, contentWidth, 24);
      pdf.line(margin + 65, margin, margin + 65, margin + 24);

      // Logo
      try {
        pdf.addImage(DE_NATURA_LOGO_BASE64, 'PNG', margin + 8, margin + 3, 48, 18);
      } catch (e) {}

      // Title
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.text('DE NATURA AESTHETICS', margin + 115, margin + 10, { align: 'center' });
      pdf.setFontSize(12);
      pdf.text('Pay Slip', margin + 115, margin + 18, { align: 'center' });

      // Employee Info Section
      let y = margin + 24;
      const infoHeight = 32;
      pdf.rect(margin, y, contentWidth, infoHeight);

      const infoRows = [
        ['Employee Name', ': ' + empName],
        ['Designation', ': ' + designation],
        ['Department', ': ' + department],
        ['Month', ': ' + selectedMonth + ' ' + selectedYear],
        ['Joining Date', ': ' + joiningDate]
      ];

      pdf.setFontSize(9.5);
      infoRows.forEach((row, i) => {
        const rowY = y + 6 + (i * 5.2);
        pdf.setFont('helvetica', 'bold');
        pdf.text(row[0], margin + 6, rowY);
        pdf.setFont('helvetica', 'normal');
        pdf.text(row[1], margin + 45, rowY);
      });

      // Calculations Table
      y += infoHeight;
      const calcHeight = 85;
      pdf.rect(margin, y, contentWidth, calcHeight);

      // Column divider lines
      const col1W = 60;
      const col2W = 32;
      const col3W = 60;

      const x1 = margin + col1W;
      const x2 = x1 + col2W;
      const x3 = x2 + col3W;

      pdf.line(x1, y, x1, y + calcHeight);
      pdf.line(x2, y, x2, y + calcHeight);
      pdf.line(x3, y, x3, y + calcHeight);

      const numLeaves = parseFloat(String(fullDayLeaves)) || 0;
      const tableRows = [
        ['Fixed Salary', numFixedSalary > 0 ? numFixedSalary.toLocaleString('en-IN') : '-', 'Total no of working days', String(numTotalWorkingDays)],
        ['Overtime Allowance', fmtVal(overtimeAllowance), 'Number of days worked', String(daysWorked)],
        ['HT Allowance', fmtVal(htAllowance), 'No of full day Leaves', numLeaves > 0 ? numLeaves.toFixed(2) : '-'],
        ['Other Allowance', fmtVal(otherAllowance), 'No of half day Leaves', fmtVal(halfDayLeaves)],
        ['Total Deductions', fmtVal(totalDeductions), 'Total No of LOPs', fmtVal(totalLops)],
        ['Bonus', fmtVal(bonus), 'No of days worked Overtime', fmtVal(overtimeDays)],
        ['TDS (Tax Deducted)', fmtVal(tds), 'Compoff', fmtVal(compOff)],
        ['', '', 'Salary Advance', fmtVal(salaryAdvance)]
      ];

      pdf.setFontSize(8.5);
      tableRows.forEach((row, i) => {
        const rowY = y + 6 + (i * 8.5);
        pdf.line(margin, rowY + 2.5, margin + contentWidth, rowY + 2.5);

        pdf.setFont('helvetica', 'normal');
        pdf.text(row[0], margin + 4, rowY);
        pdf.setFont('helvetica', 'bold');
        pdf.text(row[1], x1 - 4, rowY, { align: 'right' });

        pdf.setFont('helvetica', 'normal');
        pdf.text(row[2], x2 + 4, rowY);
        pdf.setFont('helvetica', 'bold');
        pdf.text(row[3], margin + contentWidth - 4, rowY, { align: 'right' });
      });

      // Total Row
      const totalY = y + calcHeight - 7;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.text('Total', margin + 4, totalY);
      pdf.text(netTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 }), x1 - 4, totalY, { align: 'right' });

      pdf.text('Loss of pay Amount', x2 + 4, totalY);
      pdf.text(fmtVal(lossOfPayAmount), margin + contentWidth - 4, totalY, { align: 'right' });

      // Footer Address
      const footerY = y + calcHeight + 12;
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.text('De Natura Aesthetics (OPC) Pvt. Ltd.', margin + (contentWidth / 2), footerY, { align: 'center' });
      pdf.setFont('helvetica', 'normal');
      pdf.text('Adwaitham Tower, Maruthamkuzhi Bridge, opp. Dhanya Supermarket, Kanjirampara, Thiruvananthapuram - 695030 | Ph: 8137093028', margin + (contentWidth / 2), footerY + 5, { align: 'center' });
      pdf.setFont('helvetica', 'bolditalic');
      pdf.text('"This is a system-generated document. No signature is required."', margin + (contentWidth / 2), footerY + 11, { align: 'center' });

      pdf.save('Payslip_' + empName.replace(/[^a-zA-Z0-9]/g, '_') + '_' + selectedMonth + '_' + selectedYear + '.pdf');
    } catch (e) {
      console.error('PDF Generation Error:', e);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className='space-y-8'>
      {/* Month & Year Selection Bar for Staff / Admin */}
      {!isAdmin && (
        <div className='glass-panel p-6 rounded-2xl border border-teal-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl bg-slate-900/90'>
          <div>
            <h2 className='text-base font-extrabold text-white tracking-tight flex items-center gap-2'>
              <FileText size={20} className='text-teal-400' /> Select Payslip Period & Generate PDF
            </h2>
            <p className='text-xs text-slate-400 mt-1'>Select payroll period and click Fetch or Generate PDF to pull live database records.</p>
          </div>

          <div className='flex flex-wrap items-center gap-3 w-full md:w-auto'>
            <div className='flex items-center gap-2'>
              <select
                value={selectedMonth}
                onChange={e => {
                  const newM = e.target.value;
                  setSelectedMonth(newM);
                  const activeEmail = selectedEmpEmail || currentEmpEmail || sessionStorage.getItem('userEmail') || '';
                  if (activeEmail) loadPayslipRecord(activeEmail, newM, selectedYear);
                }}
                className='p-2.5 bg-slate-950 border border-teal-500/40 rounded-xl text-white font-semibold text-xs focus:ring-2 focus:ring-teal-500'
              >
                {monthNames.map(m => <option key={m} value={m}>{m}</option>)}
              </select>

              <select
                value={selectedYear}
                onChange={e => {
                  const newY = e.target.value;
                  setSelectedYear(newY);
                  const activeEmail = selectedEmpEmail || currentEmpEmail || sessionStorage.getItem('userEmail') || '';
                  if (activeEmail) loadPayslipRecord(activeEmail, selectedMonth, newY);
                }}
                className='p-2.5 bg-slate-950 border border-teal-500/40 rounded-xl text-white font-mono text-xs focus:ring-2 focus:ring-teal-500'
              >
                <option value='2025'>2025</option>
                <option value='2026'>2026</option>
                <option value='2027'>2027</option>
              </select>
            </div>

            <button
              onClick={() => {
                const activeEmail = selectedEmpEmail || currentEmpEmail || sessionStorage.getItem('userEmail') || '';
                if (activeEmail) loadPayslipRecord(activeEmail, selectedMonth, selectedYear);
              }}
              className='py-2.5 px-4 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5'
            >
              <RefreshCw size={14} /> Fetch Payslip
            </button>

            <button
              onClick={handleDownloadPDF}
              className='py-2.5 px-5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition flex items-center gap-2'
            >
              <Download size={14} /> Generate & Download PDF
            </button>
          </div>
        </div>
      )}

      {/* Admin Control Panel (Only visible for Admins) */}
      {isAdmin && (
        <div className='glass-panel p-6 rounded-2xl border border-slate-800 space-y-4'>
          <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4'>
            <div className='flex items-center gap-3'>
              <div className='w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20'>
                <FileText size={20} />
              </div>
              <div>
                <h2 className='text-lg font-bold text-white tracking-tight'>Payslip Control & Generator</h2>
                <p className='text-xs text-slate-400'>Update pay details & generate official payslips for employee portal access.</p>
              </div>
            </div>

            <button
              onClick={handleSaveAndGenerate}
              disabled={isSaving || isLoadingPayslip}
              className='py-3 px-6 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center gap-2 flex-shrink-0 disabled:opacity-50'
            >
              {isSaving ? <RefreshCw size={16} className='animate-spin' /> : <Save size={16} />}
              {isGenerated ? '🔄 Save & Regenerate Payslip' : '💾 Save & Generate Payslip'}
            </button>
          </div>

          {isLoadingPayslip && (
            <div className='p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold flex items-center gap-2'>
              <RefreshCw size={16} className='animate-spin' />
              Loading payslip data from Cloud...
            </div>
          )}

          {saveMessage && !isLoadingPayslip && (
            <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
              saveMessage.startsWith('❌')
                ? 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
                : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
            }`}>
              {saveMessage.startsWith('❌') ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
              {saveMessage}
            </div>
          )}

          <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs'>
            <div>
              <label className='block font-semibold text-slate-300 mb-1'>Select Employee</label>
              <select
                value={selectedEmpEmail}
                onChange={e => handleEmpChange(e.target.value)}
                className='w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-medium'
              >
                {employees.filter(emp => !emp.isAdmin).map(emp => (
                  <option key={emp.email} value={emp.email}>
                    {emp.name} ({emp.role || 'Staff'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className='block font-semibold text-slate-300 mb-1'>Employee Name</label>
              <input
                type='text'
                value={empName}
                onChange={e => setEmpName(e.target.value)}
                className='w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-medium'
              />
            </div>

            <div>
              <label className='block font-semibold text-slate-300 mb-1'>Designation</label>
              <input
                type='text'
                value={designation}
                onChange={e => setDesignation(e.target.value)}
                className='w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-medium'
              />
            </div>

            <div>
              <label className='block font-semibold text-slate-300 mb-1'>Department</label>
              <input
                type='text'
                value={department}
                onChange={e => setDepartment(e.target.value)}
                className='w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-medium'
              />
            </div>

            <div>
              <label className='block font-semibold text-slate-300 mb-1'>Month & Year</label>
              <div className='flex gap-2'>
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className='w-1/2 p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-medium'
                >
                  {monthNames.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <input
                  type='number'
                  value={selectedYear}
                  onChange={e => setSelectedYear(e.target.value)}
                  className='w-1/2 p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono'
                />
              </div>
            </div>

            <div>
              <label className='block font-semibold text-slate-300 mb-1'>Joining Date</label>
              <input
                type='text'
                value={joiningDate}
                onChange={e => setJoiningDate(e.target.value)}
                className='w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono'
              />
            </div>

            <div>
              <label className='block font-semibold text-slate-300 mb-1'>Fixed Salary (₹)</label>
              <input
                type='number'
                value={fixedSalary}
                onChange={e => setFixedSalary(e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                className='w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono'
              />
            </div>

            <div>
              <label className='block font-semibold text-slate-300 mb-1'>Overtime Allowance (₹)</label>
              <input
                type='number'
                value={overtimeAllowance}
                onChange={e => setOvertimeAllowance(e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                className='w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono'
              />
            </div>

            <div>
              <label className='block font-semibold text-slate-300 mb-1'>HT Allowance (₹)</label>
              <input
                type='number'
                value={htAllowance}
                onChange={e => setHtAllowance(e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                className='w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono'
              />
            </div>

            <div>
              <label className='block font-semibold text-slate-300 mb-1'>Other Allowance (₹)</label>
              <input
                type='number'
                value={otherAllowance}
                onChange={e => setOtherAllowance(e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                className='w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono'
              />
            </div>

            <div>
              <label className='block font-semibold text-slate-300 mb-1'>Bonus (₹)</label>
              <input
                type='number'
                value={bonus}
                onChange={e => setBonus(e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                className='w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono'
              />
            </div>

            <div>
              <label className='block font-semibold text-slate-300 mb-1'>TDS (Tax Deducted ₹)</label>
              <input
                type='number'
                value={tds}
                onChange={e => setTds(e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                className='w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono'
              />
            </div>

            <div>
              <label className='block font-semibold text-slate-300 mb-1'>Total Working Days</label>
              <input
                type='number'
                value={totalWorkingDays}
                onChange={e => setTotalWorkingDays(e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                className='w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono'
              />
            </div>

            <div>
              <label className='block font-semibold text-slate-300 mb-1'>Days Worked</label>
              <input
                type='number'
                value={computedDaysWorked}
                onChange={e => setDaysWorked(e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                className='w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono'
              />
            </div>

            <div>
              <label className='block font-semibold text-slate-300 mb-1'>Full Day Leaves</label>
              <input
                type='number'
                step='0.5'
                value={fullDayLeaves}
                onChange={e => setFullDayLeaves(e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                className='w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono'
              />
            </div>

            <div>
              <label className='block font-semibold text-slate-300 mb-1'>Half Day Leaves</label>
              <input
                type='number'
                step='0.5'
                value={halfDayLeaves}
                onChange={e => setHalfDayLeaves(e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                className='w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono'
              />
            </div>

            <div>
              <label className='block font-semibold text-slate-300 mb-1'>Total LOP Days</label>
              <input
                type='number'
                step='0.5'
                value={totalLops}
                onChange={e => setTotalLops(e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                className='w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono'
              />
            </div>

            <div>
              <label className='block font-semibold text-slate-300 mb-1'>No of days Overtime</label>
              <input
                type='number'
                value={overtimeDays}
                onChange={e => setOvertimeDays(parseInt(e.target.value) || 0)}
                className='w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono'
              />
            </div>

            <div>
              <label className='block font-semibold text-slate-300 mb-1'>Comp-Off Days</label>
              <input
                type='number'
                value={compOff}
                onChange={e => setCompOff(parseInt(e.target.value) || 0)}
                className='w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono'
              />
            </div>

            <div>
              <label className='block font-semibold text-slate-300 mb-1'>Salary Advance (₹)</label>
              <input
                type='number'
                value={salaryAdvance}
                onChange={e => setSalaryAdvance(e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                className='w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono'
              />
            </div>
          </div>
        </div>
      )}

      {/* If Employee is viewing and Payslip is NOT generated yet */}
      {!isAdmin && !isGenerated ? (
        <div className='glass-panel p-12 rounded-2xl border border-slate-800 text-center space-y-4 max-w-xl mx-auto'>
          <div className='w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 mx-auto'>
            <AlertCircle size={28} />
          </div>
          <div>
            <h3 className='text-lg font-bold text-white'>Payslip Not Generated Yet</h3>
            <p className='text-xs text-slate-400 mt-1.5 leading-relaxed'>
              The official payslip for <strong className='text-cyan-400'>{selectedMonth} {selectedYear}</strong> has not been generated or published by Clinic Management yet.
            </p>
          </div>
          <p className='text-[11px] text-slate-500 bg-slate-900/80 p-3 rounded-xl border border-slate-800'>
            💡 Please check back later or contact Clinic Admin to request payslip generation for {selectedMonth} {selectedYear}.
          </p>
        </div>
      ) : (
        <>
          {/* Action Bar */}
          <div className='flex justify-between items-center bg-slate-900/60 p-4 rounded-xl border border-slate-800'>
            <div className='text-xs font-semibold text-slate-300 flex items-center gap-2'>
              <CheckCircle size={16} className='text-emerald-400' /> Monthly Payslip Statement ({empName} - {selectedMonth} {selectedYear})
            </div>

            <div className='flex gap-3'>
              <button
                onClick={handleDownloadPDF}
                className='py-2.5 px-5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition flex items-center gap-2'
              >
                <Download size={15} /> Download PDF Payslip
              </button>
              <button
                onClick={handlePrint}
                className='py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition flex items-center gap-2'
              >
                <Printer size={15} /> Print
              </button>
            </div>
          </div>

          {/* Exact Sheet Document Preview Container */}
          <div className='flex justify-center'>
            <div 
              id='payslip-preview-card'
              className='w-full max-w-3xl bg-white text-slate-950 p-6 rounded-none shadow-2xl border-2 border-slate-900'
              style={{ backgroundColor: '#ffffff', color: '#000000', fontFamily: 'Arial, sans-serif' }}
            >
              {/* Top Header Grid */}
              <div className='grid grid-cols-12 border-b-2 border-slate-900'>
                <div className='col-span-4 p-3 border-r-2 border-slate-900 flex items-center justify-center bg-white'>
                  <img src={DE_NATURA_LOGO_BASE64} alt='Logo' style={{ height: '48px', width: 'auto', display: 'block' }} />
                </div>
                <div className='col-span-8 p-3 text-center flex flex-col justify-center bg-white'>
                  <h1 className='text-xl font-black tracking-wide text-slate-950 uppercase'>DE NATURA AESTHETICS</h1>
                  <h2 className='text-base font-bold text-slate-900 mt-1'>Pay Slip</h2>
                </div>
              </div>

              {/* Employee Info Rows */}
              <div className='border-b-2 border-slate-900 text-xs font-bold divide-y divide-slate-900'>
                <div className='py-1.5 px-3 flex'><span className='w-36 text-slate-900'>Employee Name</span><span>: {empName}</span></div>
                <div className='py-1.5 px-3 flex'><span className='w-36 text-slate-900'>Designation</span><span>: {designation}</span></div>
                <div className='py-1.5 px-3 flex'><span className='w-36 text-slate-900'>Department</span><span>: {department}</span></div>
                <div className='py-1.5 px-3 flex'><span className='w-36 text-slate-900'>Month</span><span>: {selectedMonth} {selectedYear}</span></div>
                <div className='py-1.5 px-3 flex'><span className='w-36 text-slate-900'>Joining Date</span><span>: {joiningDate}</span></div>
              </div>

              {/* Two-Column Salary Breakdown Table */}
              <div className='overflow-x-auto -mx-2 px-2'>
              <table className='w-full text-xs border-collapse border-b-2 border-slate-900'>
                <tbody className='divide-y divide-slate-900'>
                  <tr className='divide-x divide-slate-900'>
                    <td className='w-[35%] p-2 text-slate-900'>Fixed Salary</td>
                    <td className='w-[15%] p-2 text-right font-bold font-mono'>{fixedSalary.toLocaleString()}</td>
                    <td className='w-[35%] p-2 text-slate-900'>Total no of working days</td>
                    <td className='w-[15%] p-2 text-right font-bold font-mono'>{totalWorkingDays}</td>
                  </tr>
                  <tr className='divide-x divide-slate-900'>
                    <td className='p-2 text-slate-900'>Overtime Allowance</td>
                    <td className='p-2 text-right font-bold font-mono'>{fmtVal(overtimeAllowance)}</td>
                    <td className='p-2 text-slate-900'>Number of days worked</td>
                    <td className='p-2 text-right font-bold font-mono'>{computedDaysWorked}</td>
                  </tr>
                  <tr className='divide-x divide-slate-900'>
                    <td className='p-2 text-slate-900'>HT Allowance</td>
                    <td className='p-2 text-right font-bold font-mono'>{fmtVal(htAllowance)}</td>
                    <td className='p-2 text-slate-900'>No of full day Leaves</td>
                    <td className='p-2 text-right font-bold font-mono'>{parseFloat(String(fullDayLeaves)) > 0 ? parseFloat(String(fullDayLeaves)).toFixed(2) : '-'}</td>
                  </tr>
                  <tr className='divide-x divide-slate-900'>
                    <td className='p-2 text-slate-900'>Other Allowance</td>
                    <td className='p-2 text-right font-bold font-mono'>{fmtVal(otherAllowance)}</td>
                    <td className='p-2 text-slate-900'>No of half day Leaves</td>
                    <td className='p-2 text-right font-bold font-mono'>{fmtVal(halfDayLeaves)}</td>
                  </tr>
                  <tr className='divide-x divide-slate-900'>
                    <td className='p-2 text-slate-900'>Total Deductions</td>
                    <td className='p-2 text-right font-bold font-mono'>{fmtVal(totalDeductions)}</td>
                    <td className='p-2 text-slate-900'>Total No of LOPs</td>
                    <td className='p-2 text-right font-bold font-mono'>{fmtVal(totalLops)}</td>
                  </tr>
                  <tr className='divide-x divide-slate-900'>
                    <td className='p-2 text-slate-900'>Bonus</td>
                    <td className='p-2 text-right font-bold font-mono'>{fmtVal(bonus)}</td>
                    <td className='p-2 text-slate-900'>No of days worked Overtime</td>
                    <td className='p-2 text-right font-bold font-mono'>{fmtVal(overtimeDays)}</td>
                  </tr>
                  <tr className='divide-x divide-slate-900'>
                    <td className='p-2 text-slate-900'>TDS (Tax Deducted)</td>
                    <td className='p-2 text-right font-bold font-mono'>{fmtVal(tds)}</td>
                    <td className='p-2 text-slate-900'>Compoff</td>
                    <td className='p-2 text-right font-bold font-mono'>{fmtVal(compOff)}</td>
                  </tr>
                  <tr className='divide-x divide-slate-900'>
                    <td className='p-2'></td>
                    <td className='p-2'></td>
                    <td className='p-2 text-slate-900'>Salary Advance</td>
                    <td className='p-2 text-right font-bold font-mono'>{fmtVal(salaryAdvance)}</td>
                  </tr>
                  <tr className='divide-x divide-slate-900 font-black text-sm bg-slate-50'>
                    <td className='p-2 text-slate-950 font-extrabold'>Total</td>
                    <td className='p-2 text-right font-black font-mono text-base'>{netTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className='p-2 text-slate-950 font-extrabold'>Loss of pay Amount</td>
                    <td className='p-2 text-right font-bold font-mono text-xs'>{fmtVal(lossOfPayAmount)}</td>
                  </tr>
                </tbody>
              </table>
              </div>

              {/* Footer Disclaimer */}
              <div className='p-3 text-center text-[10px] text-slate-600 space-y-0.5'>
                <p className='font-bold text-slate-800'>De Natura Aesthetics (OPC) Pvt. Ltd.</p>
                <p>Adwaitham Tower, Maruthamkuzhi Bridge, opp. Dhanya Supermarket, Kanjirampara, Thiruvananthapuram - 695030 | Ph: 8137093028</p>
                <p className='italic font-bold text-slate-700 pt-1'>"This is a system-generated document. No signature is required."</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
