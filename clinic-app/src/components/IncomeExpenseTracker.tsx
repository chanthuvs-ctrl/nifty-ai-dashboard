import { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { DollarSign, PlusCircle, ArrowUpRight, ArrowDownRight, FileText, Trash2, ChevronDown, Link as LinkIcon } from 'lucide-react';
import * as XLSX from 'xlsx';

export const INITIAL_SAMPLE_TRANSACTIONS = [
  {
    id: 'tx_sample_1',
    date: '2026-07-28',
    type: 'Income',
    category: 'Glutathione 3 Doses',
    patientName: 'Ananya Sharma',
    doctorName: 'Dr Anagha S Nath',
    doctorAllowance: 500,
    paymentMethods: ['GPay'],
    splitAmounts: { GPay: '6900' },
    amount: 6900,
    description: 'Glutathione therapy package completed',
    createdAt: Date.now() - 300000000
  },
  {
    id: 'tx_sample_2',
    date: '2026-07-29',
    type: 'Income',
    category: 'Facial Aesthetic',
    patientName: 'Priya Nair',
    doctorName: 'Dr Deepthy R K',
    doctorAllowance: 800,
    paymentMethods: ['Cash', 'GPay'],
    splitAmounts: { Cash: '2000', GPay: '3000' },
    amount: 5000,
    description: 'HydraFacial & Glow Treatment',
    createdAt: Date.now() - 200000000
  },
  {
    id: 'tx_sample_3',
    date: '2026-07-30',
    type: 'Expense',
    category: 'Clinic Rent',
    patientName: '',
    doctorName: '',
    doctorAllowance: 0,
    paymentMethods: ['Bank Transfer'],
    splitAmounts: { 'Bank Transfer': '35000' },
    amount: 35000,
    description: 'Monthly office space rent payment',
    createdAt: Date.now() - 100000000
  }
];



const getDirectExportUrl = (rawUrl: string): string => {
  if (!rawUrl) return '';
  const str = rawUrl.trim();
  const gsMatch = str.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (gsMatch && gsMatch[1]) {
    return 'https://docs.google.com/spreadsheets/d/' + gsMatch[1] + '/export?format=xlsx';
  }
  const gdMatch = str.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
  if (gdMatch && gdMatch[1]) {
    return 'https://docs.google.com/uc?export=download&id=' + gdMatch[1];
  }
  if (str.includes('onedrive') || str.includes('1drv')) {
    if (str.includes('download=1')) return str;
    if (str.includes('?')) return str + '&download=1';
    return str + '?download=1';
  }
  return str;
};

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
export default function IncomeExpenseTracker({ onStartBulkUpload, bgUpload: _bgUpload }: { onStartBulkUpload?: (records: any[]) => void; bgUpload?: any }) {
  // isUploading unused
  
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>(['Glutathione', 'Facial Aesthetic', 'Clinic Rent', 'Salaries', 'Supplies', 'Utilities']);
  
  // Reporting & Table Filter States
  const [periodFilter, setPeriodFilter] = useState<string>('current_year');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('All');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  
  // Single Entry State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [type, setType] = useState<'Income' | 'Expense'>('Income');
  const [selectedCategory, setSelectedCategory] = useState('Glutathione');
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  
  const [patientName, setPatientName] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [doctorAllowance, setDoctorAllowance] = useState('');

  // Main Amount Input State
  const [mainAmount, setMainAmount] = useState('');
  
  // Multi-Payment Mode State
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>(['Cash']);
  const [splitAmounts, setSplitAmounts] = useState<Record<string, string>>({ Cash: '' });
  const [isPayMethodOpen, setIsPayMethodOpen] = useState(false);
  const payMethodRef = useRef<HTMLDivElement>(null);

  const paymentOptions = ['Cash', 'GPay', 'Bank Transfer', 'Card'];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (payMethodRef.current && !payMethodRef.current.contains(event.target as Node)) {
        setIsPayMethodOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  // Bulk Selection State
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  // editingTx

  // Google Sheet & File Import State
  const [googleSheetUrl, setGoogleSheetUrl] = useState(() => localStorage.getItem('de_natura_gsheet_url') || 'https://docs.google.com/spreadsheets/d/1TtcywkssTiAGyGrabmlpf0Xjy39LEbA0?rtpof=true&usp=drive_fs');
  const [isFetchingGSheet, setIsFetchingGSheet] = useState(false);
  const [excelPreview, setExcelPreview] = useState<any[]>([]);
  const [_uploadStatus, setUploadStatus] = useState<'idle' | 'parsing' | 'ready' | 'uploading' | 'completed' | 'failed' | 'numbers_detected'>('idle');
  // uploadError unused

  // Date Normalizer
          const normalizeDate = (rawDate: any): string => {
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
  };

  const fetchTransactions = async () => {
    setIsFetchingGSheet(true);
    try {
      const urlToUse = googleSheetUrl || 'https://docs.google.com/spreadsheets/d/1TtcywkssTiAGyGrabmlpf0Xjy39LEbA0?rtpof=true&usp=drive_fs';
      const exportUrl = getDirectExportUrl(urlToUse);
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

          const cleanDate = normalizeDate(getVal(['date', 'dt', 'day', 'time', 'trx date'])) || new Date().toISOString().split('T')[0];
          const rawPatient = getVal(['name', 'patient name', 'patient', 'client']) || '';
          const rawDoctor = getVal(['dr', 'doctor name', 'doctor']) || '';
          const rawDocAllow = parseFloat(String(getVal(['allowance', 'doctor allowance', 'doc allow']) || 0).replace(/[^0-9.]/g, '')) || 0;
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
                doctorAllowance: rawDocAllow,
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
                doctorAllowance: 0,
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
        const customCats = Array.from(new Set(parsed.map((t: any) => getCanonicalCategory(t.category)).filter(Boolean)));
        setCategories((prev: string[]) => Array.from(new Set([...prev, ...customCats])));
      }
    } catch (e) {
      console.error('Drive fetch error:', e);
    } finally {
      setIsFetchingGSheet(false);
    }
  };

  const handlePurgeAllTransactions = async () => {
    if (!window.confirm('⚠️ PURGE DATABASE: Are you sure you want to PERMANENTLY CLEAR ALL records from Cloud Firestore?')) {
      return;
    }

    setLoading(true);
    try {
      // 1. Delete all docs from Transactions collection
      const snap1 = await getDocs(collection(db, 'Transactions'));
      const p1 = snap1.docs.map(d => deleteDoc(doc(db, 'Transactions', d.id)));

      // 2. Delete all docs from NewTransactions collection
      const snap2 = await getDocs(collection(db, 'NewTransactions'));
      const p2 = snap2.docs.map(d => deleteDoc(doc(db, 'NewTransactions', d.id)));

      await Promise.all([...p1, ...p2]);

      try {
        localStorage.removeItem('de_natura_transactions');
        localStorage.removeItem('de_natura_db_cleared');
      } catch (e) {}

      setTransactions([]);
      setExcelPreview([]);

      alert('✓ All records successfully purged from Cloud Firestore! Dashboard is now 100% blank (0 records).');
    } catch (err: any) {
      alert('Error clearing data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Sync & Load Saved Link from Firestore Cloud Settings
  useEffect(() => {
    const fetchSavedUrl = async () => {
      try {
        const snap = await getDoc(doc(db, 'Settings', 'googleSheet'));
        if (snap.exists() && snap.data()?.url) {
          const cloudUrl = snap.data().url;
          setGoogleSheetUrl(cloudUrl);
          localStorage.setItem('de_natura_gsheet_url', cloudUrl);
        }
      } catch (e) {}
    };
    fetchSavedUrl();
  }, []);

useEffect(() => {
    // Clear any old inflated localStorage data on every load
    
    fetchTransactions();
  }, []);

  const togglePaymentMethod = (method: string) => {
    let updatedMethods: string[];
    if (selectedPaymentMethods.includes(method)) {
      if (selectedPaymentMethods.length > 1) {
        updatedMethods = selectedPaymentMethods.filter(m => m !== method);
      } else {
        updatedMethods = selectedPaymentMethods;
      }
    } else {
      updatedMethods = [...selectedPaymentMethods, method];
    }
    setSelectedPaymentMethods(updatedMethods);
    
    // Auto sync split amounts
    const newSplits = { ...splitAmounts };
    if (mainAmount && updatedMethods.length === 1) {
      newSplits[updatedMethods[0]] = mainAmount;
    }
    setSplitAmounts(newSplits);
  };

  const handleMainAmountChange = (val: string) => {
    setMainAmount(val);
    if (selectedPaymentMethods.length === 1) {
      setSplitAmounts({ [selectedPaymentMethods[0]]: val });
    }
  };

  const calculatedTotalAmount = selectedPaymentMethods.reduce((sum, m) => {
    return sum + (parseFloat(splitAmounts[m]) || 0);
  }, 0) || (parseFloat(mainAmount) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const finalAmount = parseFloat(mainAmount) || calculatedTotalAmount;
    if (!finalAmount || finalAmount <= 0) {
      alert('Please enter a valid Transaction Amount (₹).');
      return;
    }

    setLoading(true);
    let finalCategory = selectedCategory;
    if (showCustomInput && customCategoryInput.trim()) {
      finalCategory = customCategoryInput.trim();
      if (!categories.includes(finalCategory)) {
        setCategories(prev => [...prev, finalCategory]);
      }
    }

    const currentSplits = { ...splitAmounts };
    if (selectedPaymentMethods.length === 1) {
      currentSplits[selectedPaymentMethods[0]] = String(finalAmount);
    }

    const txId = 'tx_manual_' + Date.now();
    const newTx = {
      id: txId,
      date: normalizeDate(date),
      type,
      category: finalCategory,
      patientName: patientName.trim(),
      doctorName: doctorName.trim(),
      doctorAllowance: parseFloat(doctorAllowance) || 0,
      paymentMethods: selectedPaymentMethods,
      splitAmounts: currentSplits,
      amount: finalAmount,
      description,
      createdAt: Date.now()
    };

    setTransactions(prev => {
      const updated = [newTx, ...prev];
      try {
        localStorage.setItem('de_natura_transactions', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    try {
      await addDoc(collection(db, 'Transactions'), newTx);
    } catch (err) {}

    setPatientName('');
    setDoctorName('');
    setDoctorAllowance('');
    setMainAmount('');
    setDescription('');
    setSplitAmounts({ Cash: '' });
    setSelectedPaymentMethods(['Cash']);
    setCustomCategoryInput('');
    setShowCustomInput(false);
    alert('✓ Transaction of ₹' + finalAmount.toLocaleString() + ' added to ledger!');
    setLoading(false);
  };

  const handleDeleteSingle = async (id: string) => {
    if (!window.confirm('Delete this transaction record?')) return;
    try {
      await deleteDoc(doc(db, 'Transactions', id));
    } catch (e) {}
    setTransactions(prev => {
      const updated = prev.filter(t => t.id !== id);
      // localStorage not used - Firestore is the store
      return updated;
    });
    alert('Transaction deleted.');
  };

  const handleBulkDelete = async () => {
    if (selectedTxIds.length === 0) return;
    if (!window.confirm('Delete ' + selectedTxIds.length + ' selected transactions?')) return;
    try {
      for (const id of selectedTxIds) {
        await deleteDoc(doc(db, 'Transactions', id));
      }
    } catch (e) {}
    setTransactions(prev => {
      const updated = prev.filter(t => !selectedTxIds.includes(t.id));
      // localStorage not used - Firestore is the store
      return updated;
    });
    setSelectedTxIds([]);
    alert('Selected transactions deleted.');
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedTxIds(transactions.map(t => t.id));
    } else {
      setSelectedTxIds([]);
    }
  };

  const handleToggleSelectTx = (id: string) => {
    if (selectedTxIds.includes(id)) {
      setSelectedTxIds(prev => prev.filter(i => i !== id));
    } else {
      setSelectedTxIds(prev => [...prev, id]);
    }
  };

  const getTxSignature = (t: any) => {
    const d = normalizeDate(t.date);
    const typ = (t.type || 'Income').trim().toLowerCase();
    const cat = getCanonicalCategory(t.category).trim().toLowerCase();
    const amt = (parseFloat(t.amount) || 0).toFixed(2);
    const pName = (t.patientName || '').trim().toLowerCase();
    return `${d}_${typ}_${cat}_${amt}_${pName}`;
  };

  const saveUrlToStorageAndCloud = async (url: string) => {
    setGoogleSheetUrl(url);
    localStorage.setItem('de_natura_gsheet_url', url);
    try {
      await setDoc(doc(db, 'Settings', 'googleSheet'), { url, updatedAt: Date.now() });
    } catch (e) {}
  };

  const parseRowsAndSetPreview = (data: any[], sourceName: string = 'Sheet') => {
    const parsedRows: any[] = [];
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

      const cleanDate = normalizeDate(getVal(['date', 'dt', 'day', 'time', 'trx date'])) || new Date().toISOString().split('T')[0];
      const rawPatient = getVal(['name', 'patient name', 'patient', 'client']) || '';
      const rawDoctor = getVal(['doctor name', 'doctor', 'dr']) || '';
      const rawDocAllow = parseFloat(String(getVal(['doctor allowance', 'allowance', 'doc allow']) || 0).replace(/[^0-9.]/g, '')) || 0;
      const rawCategory = getVal(['service name', 'category', 'service', 'particulars']) || 'General';

      const parseNum = (v: any) => {
        if (!v) return 0;
        const s = String(v).replace(/[^0-9.]/g, '');
        return parseFloat(s) || 0;
      };

      const rawCashIn = parseNum(getVal(['cash in', 'cashin', 'income', 'receipt', 'credit', 'inflow']));
      const rawCashOut = parseNum(getVal(['cashout', 'cash out', 'expense', 'debit', 'outflow']));
      const rawMode = getVal(['mode of payment', 'payment mode', 'pay mode', 'mode', 'payment method', 'mop', 'payment', 'paid via', 'type']) || 'Cash';

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
      const categoryStr = String(rawCategory || '').toLowerCase();
      const patientStr = String(rawPatient || '').toLowerCase();
      const isSummaryRow = ['fixed salary', 'total', 'designation', 'department', 'joining date', 'total deductions', 'loss of pay', 'employee name', 'pay slip', 'video allowance', 'salary advance', 'casual leave'].some(kw => categoryStr.includes(kw) || patientStr.includes(kw));

      if (!isSummaryRow) {
        if (rawCashIn > 0) {
          parsedRows.push({
            id: 'tx_sheet_' + Date.now() + '_' + idx,
            date: cleanDate,
            type: 'Income',
            category: String(rawCategory),
            patientName: String(rawPatient),
            doctorName: String(rawDoctor),
            doctorAllowance: rawDocAllow,
            paymentMethods: modesArray,
            amount: rawCashIn,
            description: 'Imported from ' + sourceName + ' (' + rawCategory + ')',
            createdAt: Date.now() - idx
          });
        }
        if (rawCashOut > 0) {
          parsedRows.push({
            id: 'tx_sheet_out_' + Date.now() + '_' + idx,
            date: cleanDate,
            type: 'Expense',
            category: String(rawCategory),
            patientName: String(rawPatient),
            doctorName: String(rawDoctor),
            doctorAllowance: 0,
            paymentMethods: modesArray,
            amount: rawCashOut,
            description: 'Imported Outflow (' + rawCategory + ')',
            createdAt: Date.now() - idx
          });
        }
      }
    });

    // Automatic Duplicate Filtering
    const existingSignatures = new Set(transactions.map(getTxSignature));
    const newUniqueRecords: any[] = [];
    let skippedCount = 0;

    parsedRows.forEach(r => {
      const sig = getTxSignature(r);
      if (existingSignatures.has(sig)) {
        skippedCount++;
      } else {
        existingSignatures.add(sig);
        newUniqueRecords.push(r);
      }
    });

    if (newUniqueRecords.length === 0) {
      alert(`✓ Checked ${parsedRows.length} records in ${sourceName} — ALL records are ALREADY synced in database! (0 duplicates added).`);
      setExcelPreview([]);
    } else {
      setExcelPreview(newUniqueRecords);
      alert(`✓ Found ${newUniqueRecords.length} NEW transactions from ${sourceName}! (${skippedCount} duplicate records automatically skipped). Click "Confirm & Save All Records" below to save.`);
    }
  };

  const handleSyncFromGoogleSheet = async () => {
    if (!googleSheetUrl) {
      alert('Please enter a Google Sheet or OneDrive URL.');
      return;
    }

    const exportUrl = getDirectExportUrl(googleSheetUrl);
    await saveUrlToStorageAndCloud(googleSheetUrl);

    setIsFetchingGSheet(true);

    try {
      const res = await fetch(exportUrl);
      if (!res.ok) throw new Error('Could not access sheet or OneDrive file. Ensure link permission is set to "Anyone with link can view".');
      
      const buffer = await res.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
      const wsname = wb.SheetNames.find((s: string) => s.toLowerCase().includes('cash book') || s.toLowerCase().includes('cashbook') || s.toLowerCase().includes('ledger') || s.toLowerCase().includes('transaction')) || wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { raw: false });

      parseRowsAndSetPreview(data, 'Cloud Sync Link');
    } catch (err: any) {
      console.error(err);
      alert('Error fetching file: ' + err.message);
    } finally {
      setIsFetchingGSheet(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsFetchingGSheet(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: false });
        const wsname = wb.SheetNames.find((s: string) => s.toLowerCase().includes('cash book') || s.toLowerCase().includes('cashbook') || s.toLowerCase().includes('ledger') || s.toLowerCase().includes('transaction')) || wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { raw: false });

        parseRowsAndSetPreview(data, file.name);
      } catch (err: any) {
        alert('Could not read Excel file: ' + err.message);
      }
      setIsFetchingGSheet(false);
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmExcelImport = async () => {
    if (excelPreview.length === 0) return;
    // setIsUploading(true);

    const formattedRecords = excelPreview.map((item, idx) => ({
      id: item.id || ('tx_sheet_' + Date.now() + '_' + idx),
      ...item,
      createdAt: Date.now() - (excelPreview.length - idx)
    }));

    // Save each new record to Firestore 'NewTransactions' collection
    const savePromises = formattedRecords.map(async (r: any) => {
      try {
        await setDoc(doc(db, 'NewTransactions', r.id), r);
      } catch (e) {}
    });
    await Promise.all(savePromises);

    // Add to local state immediately (no reload needed)
    setTransactions(prev => {
      const existingIds = new Set(prev.map((t: any) => t.id));
      const newOnly = formattedRecords.filter((r: any) => !existingIds.has(r.id));
      return [...newOnly, ...prev];
    });

    if (onStartBulkUpload) {
      onStartBulkUpload(formattedRecords);
    }

    alert('✓ Imported ' + formattedRecords.length + ' transactions into ledger!');
    setExcelPreview([]);
    setUploadStatus('idle');
    // setIsUploading(false);
  };

  
  // Search and Multi-Filter Logic (Memoized for 60fps response)
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const normDate = normalizeDate(t.date);
      
      let matchesPeriod = true;
      if (periodFilter === 'current_year') {
        matchesPeriod = normDate >= '2026-01-01' && normDate <= '2026-12-31';
      } else if (periodFilter === 'current_fy') {
        matchesPeriod = normDate >= '2026-04-01' && normDate <= '2027-03-31';
      } else if (periodFilter === 'prev_fy') {
        matchesPeriod = normDate >= '2025-04-01' && normDate <= '2026-03-31';
      } else if (periodFilter === 'current_quarter') {
        matchesPeriod = normDate >= '2026-07-01' && normDate <= '2026-09-30';
      } else if (periodFilter.startsWith('month_')) {
        const targetYM = periodFilter.replace('month_', ''); // e.g. 2026-04
        matchesPeriod = normDate.startsWith(targetYM);
      }

      const matchesType = filterType === 'All' || t.type === filterType;
      const matchesCategory = filterCategory === 'All' || getCanonicalCategory(t.category) === filterCategory;
      
      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchesPeriod && matchesType && matchesCategory;

      const pName = (t.patientName || '').toLowerCase();
      const dName = (t.doctorName || '').toLowerCase();
      const cat = (t.category || '').toLowerCase();
      const desc = (t.description || '').toLowerCase();
      const dateStr = (t.date || '').toLowerCase();

      return matchesPeriod && matchesType && matchesCategory && (pName.includes(q) || dName.includes(q) || cat.includes(q) || desc.includes(q) || dateStr.includes(q));
    });
  }, [transactions, periodFilter, searchQuery, filterType, filterCategory]);

  const totalPages = Math.ceil(filteredTransactions.length / pageSize) || 1;
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, currentPage, pageSize]);

  // Calculations for Summary Header (Calculated over filtered period for accurate reporting)
  const totalIncome = filteredTransactions.filter((t: any) => t.type === 'Income' && !t.isInvestment).reduce((acc: number, t: any) => acc + (parseFloat(t.amount) || 0), 0);
  const totalExpense = filteredTransactions.filter((t: any) => t.type === 'Expense').reduce((acc: number, t: any) => acc + (parseFloat(t.amount) || 0), 0);
  const netBalance = totalIncome - totalExpense;

return (
    <div className='space-y-8'>
      {/* Time Period Filter Header Bar */}
      <div className='glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
        <div className='flex items-center gap-2 text-xs text-slate-300'>
          <span className='font-bold text-white'>📅 Reporting Period:</span>
          <select
            value={periodFilter}
            onChange={e => setPeriodFilter(e.target.value)}
            className='bg-slate-900 border border-slate-700 text-cyan-300 font-bold text-xs rounded-xl p-2 cursor-pointer focus:outline-none'
          >
            <option value='current_year'>CY 2026 (Jan–Dec 2026)</option>
            <option value='current_fy'>FY 2026–27 (Apr 2026 – Mar 2027)</option>
            <option value='prev_fy'>FY 2025–26 (Apr 2025 – Mar 2026)</option>
            <option value='current_quarter'>Q3 2026 (Jul–Sep 2026)</option>
            <optgroup label="2026 Monthly Breakdown">
              <option value='month_2026-04'>📅 April 2026</option>
              <option value='month_2026-05'>📅 May 2026</option>
              <option value='month_2026-06'>📅 June 2026</option>
              <option value='month_2026-07'>📅 July 2026</option>
              <option value='month_2026-03'>📅 March 2026</option>
              <option value='month_2026-02'>📅 February 2026</option>
              <option value='month_2026-01'>📅 January 2026</option>
            </optgroup>
            <option value='all'>All Time Historical (2024–2026)</option>
          </select>
        </div>
        <span className='text-[11px] text-slate-400 font-medium'>
          Showing <strong className='text-emerald-400'>{filteredTransactions.length}</strong> transactions matching selected period
        </span>
      </div>

      {/* Metric Cards Summary */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
        <div className='glass-panel p-6 rounded-2xl border border-slate-800 flex items-center justify-between'>
          <div>
            <p className='text-xs font-semibold text-slate-400 uppercase tracking-wider'>Total Clinic Income</p>
            <h3 className='text-2xl font-extrabold text-emerald-400 font-mono mt-1'>₹{totalIncome.toLocaleString()}</h3>
          </div>
          <div className='w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20'>
            <ArrowUpRight size={24} />
          </div>
        </div>

        <div className='glass-panel p-6 rounded-2xl border border-slate-800 flex items-center justify-between'>
          <div>
            <p className='text-xs font-semibold text-slate-400 uppercase tracking-wider'>Total Expenses</p>
            <h3 className='text-2xl font-extrabold text-rose-400 font-mono mt-1'>₹{totalExpense.toLocaleString()}</h3>
          </div>
          <div className='w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20'>
            <ArrowDownRight size={24} />
          </div>
        </div>

        <div className='glass-panel p-6 rounded-2xl border border-slate-800 flex items-center justify-between'>
          <div>
            <p className='text-xs font-semibold text-slate-400 uppercase tracking-wider'>Net Clinic Balance</p>
            <h3 className={'text-2xl font-extrabold font-mono mt-1 ' + (netBalance >= 0 ? 'text-cyan-400' : 'text-rose-400')}>
              ₹{netBalance.toLocaleString()}
            </h3>
          </div>
          <div className='w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20'>
            <DollarSign size={24} />
          </div>
        </div>
      </div>

      {/* Manual Single Transaction Entry Card */}
      <div className='glass-panel p-6 rounded-2xl border border-slate-800 space-y-6'>
        <div className='flex items-center justify-between border-b border-slate-800 pb-4'>
          <div className='flex items-center gap-3'>
            <div className='w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20'>
              <PlusCircle size={20} />
            </div>
            <div>
              <h2 className='text-lg font-bold text-white tracking-tight'>Log Manual Transaction</h2>
              <p className='text-xs text-slate-400'>Enter daily patient treatment income, doctor allowances, or operational clinic expenses.</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className='grid grid-cols-1 md:grid-cols-4 gap-4 text-xs'>
          <div>
            <label className='block font-semibold text-slate-300 mb-1'>Date</label>
            <input 
              type='date' 
              value={date} 
              onChange={e => setDate(e.target.value)} 
              required 
              className='w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-white' 
            />
          </div>

          <div>
            <label className='block font-semibold text-slate-300 mb-1'>Type</label>
            <select 
              value={type} 
              onChange={e => setType(e.target.value as any)} 
              className='w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-white font-medium'
            >
              <option value='Income'>Income (+ Cash In)</option>
              <option value='Expense'>Expense (- Cash Out)</option>
            </select>
          </div>

          <div>
            <label className='block font-semibold text-slate-300 mb-1'>Patient Name</label>
            <input 
              type='text' 
              placeholder='e.g. Ananya Sharma' 
              value={patientName} 
              onChange={e => setPatientName(e.target.value)} 
              className='w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-white' 
            />
          </div>

          <div>
            <label className='block font-semibold text-slate-300 mb-1'>Doctor Name</label>
            <input 
              type='text' 
              placeholder='e.g. Dr Anagha S Nath' 
              value={doctorName} 
              onChange={e => setDoctorName(e.target.value)} 
              className='w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-white' 
            />
          </div>

          <div>
            <label className='block font-semibold text-slate-300 mb-1'>Doctor Allowance (₹)</label>
            <input 
              type='number' 
              placeholder='500' 
              value={doctorAllowance} 
              onChange={e => setDoctorAllowance(e.target.value)} 
              className='w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono' 
            />
          </div>

          <div>
            <label className='block font-semibold text-slate-300 mb-1'>Category / Service</label>
            <select 
              value={selectedCategory} 
              onChange={e => setSelectedCategory(e.target.value)} 
              className='w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-white font-medium'
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className='block font-semibold text-slate-300 mb-1 text-cyan-400'>Transaction Amount (₹)</label>
            <input 
              type='number' 
              placeholder='e.g. 5000' 
              value={mainAmount} 
              onChange={e => handleMainAmountChange(e.target.value)} 
              required 
              className='w-full p-3 bg-slate-900 border border-cyan-500/40 rounded-xl text-white font-extrabold font-mono text-sm focus:outline-none focus:border-cyan-400' 
            />
          </div>

          {/* Payment Method Multi-Select */}
          <div ref={payMethodRef} className='relative'>
            <label className='block font-semibold text-slate-300 mb-1'>Mode of Payment</label>
            <div 
              onClick={() => setIsPayMethodOpen(!isPayMethodOpen)}
              className='w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-white cursor-pointer flex justify-between items-center select-none'
            >
              <span className='truncate font-medium text-xs'>
                {selectedPaymentMethods.join(', ')}
              </span>
              <ChevronDown size={14} className='text-slate-400' />
            </div>

            {isPayMethodOpen && (
              <div 
                onClick={(e) => e.stopPropagation()}
                className='absolute left-0 right-0 top-full mt-2 bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-2xl z-50 space-y-1.5'
              >
                <div className='text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1'>Select Payment Modes:</div>
                {paymentOptions.map(option => {
                  const isChecked = selectedPaymentMethods.includes(option);
                  return (
                    <div 
                      key={option} 
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePaymentMethod(option);
                      }}
                      className={'flex items-center justify-between text-xs p-2 rounded-lg cursor-pointer transition select-none ' + (isChecked ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-semibold' : 'text-slate-300 hover:bg-slate-800/80 border border-transparent')}
                    >
                      <div className='flex items-center gap-2'>
                        <input type='checkbox' checked={isChecked} readOnly className='rounded pointer-events-none' />
                        <span>{option}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className='md:col-span-3'>
            <label className='block font-semibold text-slate-300 mb-1'>Description / Remarks</label>
            <input 
              type='text' 
              placeholder='e.g. Glutathione 3 Doses package payment' 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              className='w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-white' 
            />
          </div>

          <div className='flex items-end'>
            <button 
              type='submit' 
              disabled={loading} 
              className='w-full py-3 px-5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold rounded-xl transition shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2'
            >
              <PlusCircle size={16} /> Log Transaction
            </button>
          </div>
        </form>
      </div>

      {/* Google Sheet Sync Accordion */}
      <div className='glass-panel p-6 rounded-2xl border border-slate-800 space-y-4'>
        <div className='flex items-center justify-between border-b border-slate-800 pb-3'>
          <span className='text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2'>
            <LinkIcon size={16} /> Bulk Sync Transactions from Google Sheet / Excel
          </span>
        </div>

        <div className='flex gap-3'>
          <input
            type='url'
            placeholder='Paste Google Sheet URL...'
            value={googleSheetUrl}
            onChange={e => setGoogleSheetUrl(e.target.value)}
            className='flex-1 p-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs'
          />
          <button
            onClick={handleSyncFromGoogleSheet}
            disabled={isFetchingGSheet}
            className='py-3 px-5 bg-slate-800 hover:bg-slate-700 text-cyan-400 font-bold text-xs rounded-xl border border-slate-700 transition'
          >
            {isFetchingGSheet ? 'Fetching...' : 'Fetch Sheet Data'}
          </button>
        </div>

        {excelPreview.length > 0 && (
          <div className='p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3'>
            <div className='flex justify-between items-center'>
              <span className='text-xs font-bold text-emerald-400'>Parsed {excelPreview.length} records ready for import!</span>
              <button
                onClick={handleConfirmExcelImport}
                className='py-2 px-4 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs rounded-xl transition'
              >
                Confirm & Save All Records
              </button>
            </div>
          </div>
        )}
      </div>

            {/* Live Sync Transactions (Google Sheet / OneDrive / File) */}
      <div className='glass-panel p-6 rounded-2xl border border-slate-800 space-y-4'>
        <div className='flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-2'>
          <span className='text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2'>
            <LinkIcon size={16} /> Live Sync Transactions (OneDrive / Google Drive / Excel)
          </span>
          <div className='flex items-center gap-2'>
            <button
              onClick={handlePurgeAllTransactions}
              className='px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-xs rounded-xl border border-rose-500/30 transition flex items-center gap-1.5 cursor-pointer'
              title='Clear all existing transaction records to perform a 100% clean sync'
            >
              🗑️ Clear Database & Sync Fresh
            </button>
            <span className='text-[10px] text-slate-400 font-medium hidden sm:inline'>Link stored permanently</span>
          </div>
        </div>

        <div className='flex flex-col space-y-3'>
          <div className='flex flex-col sm:flex-row gap-3'>
            <input
              type='url'
              placeholder='Paste OneDrive / Google Sheet shared link...'
              value={googleSheetUrl}
              onChange={e => saveUrlToStorageAndCloud(e.target.value)}
              className='flex-1 p-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 transition'
            />
            <button
              onClick={handleSyncFromGoogleSheet}
              disabled={isFetchingGSheet}
              className='py-3 px-6 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap'
            >
              {isFetchingGSheet ? '⚡ Syncing Sheet Data...' : '🔄 Sync & Import Sheet Data'}
            </button>
          </div>

          <div className='flex items-center gap-3 py-1'>
            <div className='flex-1 border-t border-slate-800' />
            <span className='text-[10px] font-bold text-slate-500 uppercase tracking-widest'>OR Upload Directly From Laptop</span>
            <div className='flex-1 border-t border-slate-800' />
          </div>

          <div className='flex items-center gap-3 p-3 bg-slate-900/90 border border-slate-800 rounded-xl'>
            <span className='text-xs font-semibold text-slate-300 flex-1 min-w-0 truncate'>
              Option B: Select any Excel (.xlsx, .xls, .csv) file directly from your computer
            </span>
            <label className='py-2.5 px-5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 transition cursor-pointer flex items-center gap-2 flex-shrink-0'>
              📁 Choose Excel File from Laptop
              <input
                type='file'
                accept='.xlsx,.xls,.csv'
                onChange={handleFileUpload}
                className='hidden'
              />
            </label>
          </div>
        </div>

        {excelPreview.length > 0 && (
          <div className='p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3'>
            <div className='flex justify-between items-center'>
              <span className='text-xs font-bold text-emerald-400'>Found {excelPreview.length} new non-duplicate records ready for import!</span>
              <button
                onClick={handleConfirmExcelImport}
                className='py-2 px-4 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs rounded-xl transition cursor-pointer'
              >
                Confirm & Save All Records
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transactions Table Ledger */}
      <div className='glass-panel p-6 rounded-2xl border border-slate-800 space-y-4'>
        <div className='flex justify-between items-center border-b border-slate-800 pb-4'>
          <div className='flex items-center gap-3'>
            <div className='w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20'>
              <FileText size={18} />
            </div>
            <div>
              <h2 className='text-base font-bold text-white tracking-tight'>Transaction Ledger ({filteredTransactions.length} Records)</h2>
              <p className='text-xs text-slate-400'>Comprehensive log of clinic income receipts, doctor allowances, and operational expenses.</p>
            </div>
          </div>

          {selectedTxIds.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className='py-2 px-4 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-xs rounded-xl border border-rose-500/30 transition flex items-center gap-2'
            >
              <Trash2 size={14} /> Delete Selected ({selectedTxIds.length})
            </button>
          )}
        </div>

                {/* Search & Multi-Filter Toolbar */}
        <div className='grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-900/80 rounded-xl border border-slate-800'>
          <div className='relative sm:col-span-1'>
            <input
              type='text'
              placeholder='🔍 Search patient, doctor, category, remarks...'
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className='w-full py-2 px-3 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 transition'
            />
          </div>
          <div>
            <select
              value={filterType}
              onChange={e => { setFilterType(e.target.value); setCurrentPage(1); }}
              className='w-full py-2 px-3 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs font-semibold'
            >
              <option value='All'>All Types (Income & Expenses)</option>
              <option value='Income'>Income Only (+ Inflows)</option>
              <option value='Expense'>Expenses Only (- Outflows)</option>
            </select>
          </div>
          <div>
            <select
              value={filterCategory}
              onChange={e => { setFilterCategory(e.target.value); setCurrentPage(1); }}
              className='w-full py-2 px-3 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs font-semibold'
            >
              <option value='All'>All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className='overflow-x-auto'>
          <table className='w-full text-xs text-left text-slate-300 border-collapse'>
            <thead className='bg-slate-900/90 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800'>
              <tr>
                <th className='p-3 w-10'>
                  <input type='checkbox' onChange={handleSelectAll} checked={selectedTxIds.length > 0 && selectedTxIds.length === paginatedTransactions.length} />
                </th>
                <th className='p-3'>Date</th>
                <th className='p-3'>Patient Name</th>
                <th className='p-3'>Doctor Name</th>
                <th className='p-3'>Type</th>
                <th className='p-3'>Category</th>
                <th className='p-3'>Mode of Payment</th>
                <th className='p-3'>Doc Allowance</th>
                <th className='p-3 text-right'>Amount (₹)</th>
                <th className='p-3 text-right'>Action</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-slate-800/80'>
              {paginatedTransactions.map(t => (
                <tr key={t.id} className='hover:bg-slate-900/40 transition'>
                  <td className='p-3'>
                    <input type='checkbox' checked={selectedTxIds.includes(t.id)} onChange={() => handleToggleSelectTx(t.id)} />
                  </td>
                  <td className='p-3 font-mono font-medium text-cyan-400'>{t.date}</td>
                  <td className='p-3 font-bold text-white'>{t.patientName || '-'}</td>
                  <td className='p-3 text-slate-300'>{t.doctorName || '-'}</td>
                  <td className='p-3'>
                    <span className={'px-2 py-0.5 rounded-md font-bold text-[10px] ' + (t.type === 'Income' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20')}>
                      {t.type}
                    </span>
                  </td>
                  <td className='p-3 font-medium text-slate-200'>{t.category}</td>
                  <td className='p-3 text-xs text-cyan-300 font-mono'>
                    {Array.isArray(t.paymentMethods) ? t.paymentMethods.join(', ') : (t.paymentMethods || 'Cash')}
                  </td>
                  <td className='p-3 font-mono text-indigo-400 font-semibold'>
                    {t.doctorAllowance ? '₹' + t.doctorAllowance.toLocaleString() : '-'}
                  </td>
                  <td className={'p-3 text-right font-extrabold font-mono text-sm ' + (t.type === 'Income' ? 'text-emerald-400' : 'text-rose-400')}>
                    ₹{(t.amount || 0).toLocaleString()}
                  </td>
                  <td className='p-3 text-right'>
                    <button
                      onClick={() => handleDeleteSingle(t.id)}
                      className='p-1.5 text-slate-400 hover:text-rose-400 rounded-lg transition'
                      title='Delete Record'
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-800 text-xs text-slate-400'>
          <div className='flex items-center gap-2'>
            <span>Rows:</span>
            <select
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className='bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-white font-semibold text-xs cursor-pointer'
            >
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
              <option value={250}>250 per page</option>
            </select>
            <span>
              Showing {filteredTransactions.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredTransactions.length)} of {filteredTransactions.length}
            </span>
          </div>

          <div className='flex items-center gap-2 self-end sm:self-auto'>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className='px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition cursor-pointer'
            >
              Previous
            </button>
            <span className='px-3 py-1.5 bg-slate-900 border border-slate-800 text-cyan-400 rounded-lg text-xs font-bold font-mono'>
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className='px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition cursor-pointer'
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}