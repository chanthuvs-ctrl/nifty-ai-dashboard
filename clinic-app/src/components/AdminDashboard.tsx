import EmployeeProfilesVault from './EmployeeProfilesVault';
import { useState } from 'react';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { collection, writeBatch, doc } from 'firebase/firestore';
import { 
  LogOut, Sparkles, DollarSign, Users, Calendar, FileText, Mail, Menu, X, UserCheck, 
  Bell, Search, ChevronRight, Shield, Check, AlertTriangle, Loader2
, FolderOpen, Table2} from 'lucide-react';

import AIAnalytics from './AIAnalytics';
import IncomeExpenseTracker from './IncomeExpenseTracker';
import StaffManagement from './StaffManagement';
import LeaveManagement from './LeaveManagement';
import PayslipGenerator from './PayslipGenerator';
import OfferLetterGenerator from './OfferLetterGenerator';
import DocumentVault from './DocumentVault';
import EmployeeDirectory from './EmployeeDirectory';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'analytics' | 'income' | 'staff' | 'profiles' | 'leaves' | 'payslips' | 'offerletter' | 'documents' | 'directory'>('analytics');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  // Global Background Upload State
  const [bgUpload, setBgUpload] = useState<{
    isUploading: boolean;
    progress: number;
    count: number;
    total: number;
    status: 'idle' | 'uploading' | 'completed' | 'failed';
    error: string;
  }>({
    isUploading: false,
    progress: 0,
    count: 0,
    total: 0,
    status: 'idle',
    error: ''
  });

  const handleLogout = async () => {
    try { await signOut(auth); } catch(e){} 
    sessionStorage.clear(); localStorage.clear();
    navigate('/login', { replace: true });
  };

  // High-Speed Firestore writeBatch Bulk Uploader (50x faster)
  const startBackgroundBulkUpload = async (records: any[]) => {
    if (records.length === 0) return;

    const total = records.length;
    setBgUpload({
      isUploading: true,
      progress: 0,
      count: 0,
      total,
      status: 'uploading',
      error: ''
    });

    const batchSize = 450; // Firestore limit is 500 per batch
    let processedCount = 0;

    try {
      for (let i = 0; i < total; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = records.slice(i, i + batchSize);

        chunk.forEach(item => {
          const docRef = doc(collection(db, 'Transactions'));
          batch.set(docRef, {
            ...item,
            createdAt: Date.now()
          });
        });

        await batch.commit();
        processedCount += chunk.length;
        const progressPct = Math.min(100, Math.round((processedCount / total) * 100));

        setBgUpload(prev => ({
          ...prev,
          count: processedCount,
          progress: progressPct
        }));
      }

      setBgUpload(prev => ({
        ...prev,
        isUploading: false,
        status: 'completed',
        progress: 100
      }));

      // Auto-hide success toast after 8 seconds
      setTimeout(() => {
        setBgUpload(prev => ({ ...prev, status: 'idle' }));
      }, 8000);

    } catch (err: any) {
      console.error('Bulk writeBatch upload error:', err);
      setBgUpload({
        isUploading: false,
        progress: 0,
        count: processedCount,
        total,
        status: 'failed',
        error: err.message || 'Failed to complete bulk upload.'
      });
    }
  };

  const navItems = [
    { id: 'analytics', label: 'AI Analytics & Insights', icon: Sparkles, badge: 'AI Live' },
    { id: 'income', label: 'Income & Expenses', icon: DollarSign, badge: 'Ledger' },
    { id: 'profiles', label: 'Employee Profiles & Docs', icon: UserCheck, badge: 'Vault' },
    { id: 'staff', label: 'Staff Directory', icon: Users, badge: 'Hikes' },
    { id: 'leaves', label: 'Leave Approvals', icon: Calendar, badge: 'Policy' },
    { id: 'payslips', label: 'Payslip Generator', icon: FileText, badge: 'PDF' },
    { id: 'offerletter', label: 'Offer Letters', icon: Mail, badge: 'HR' },
    { id: 'documents', label: 'Document Vault', icon: FolderOpen, badge: 'Docs' },
    { id: 'directory', label: 'Employee Directory', icon: Table2, badge: 'Excel' },
  ];

  return (
    <div className='min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row font-["Plus_Jakarta_Sans",sans-serif] selection:bg-cyan-500 selection:text-white relative'>
      {/* Mobile Top Navbar */}
      <div className='lg:hidden bg-slate-900/95 border-b border-slate-800 p-4 sticky top-0 z-40 backdrop-blur-xl flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <div className='w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 font-black text-base'>
            DN
          </div>
          <div>
            <h1 className='font-black text-sm tracking-tight text-white'>DE NATURA</h1>
            <p className='text-[9px] font-semibold text-cyan-400 uppercase tracking-widest'>Clinic & HR Portal</p>
          </div>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className='p-2 bg-slate-800 text-slate-200 hover:text-white rounded-xl border border-slate-700 focus:outline-none'
          aria-label='Toggle Menu'
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Backdrop for Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className='fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 lg:hidden animate-fade-in'
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={"w-72 bg-slate-900/95 border-r border-slate-800/80 flex flex-col justify-between p-6 shrink-0 backdrop-blur-xl fixed lg:sticky top-0 left-0 h-screen z-50 transition-transform duration-300 ease-in-out " + (mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')}>
        <div className='space-y-8'>
          <div className='flex items-center justify-between px-2'>
            <div className='flex items-center gap-3'>
              <div className='w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 font-black text-xl'>
                DN
              </div>
              <div>
                <h1 className='font-black text-base tracking-tight text-white'>DE NATURA</h1>
                <p className='text-[10px] font-semibold text-cyan-400 uppercase tracking-widest'>Clinic & HR Portal</p>
              </div>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className='lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg'
            >
              <X size={18} />
            </button>
          </div>

          <nav className='space-y-1.5'>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as any);
                    setMobileMenuOpen(false);
                  }}
                  className={"w-full flex items-center justify-between p-3 rounded-xl font-medium text-xs transition-all duration-200 group " + (isActive ? 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/10 border border-cyan-500/30 text-white font-bold shadow-lg shadow-cyan-500/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50')}
                >
                  <div className='flex items-center gap-3'>
                    <Icon size={18} className={isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={"text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider " + (isActive ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400')}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className='space-y-4 pt-6 border-t border-slate-800/80'>
          <div className='p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-3'>
            <div className='w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold text-xs border border-cyan-500/20'>
              AD
            </div>
            <div className='flex-1 min-w-0'>
              <p className='text-xs font-bold text-white truncate'>Admin Workspace</p>
              <p className='text-[10px] text-slate-400 truncate'>admin@clinic.com</p>
            </div>
            <Shield size={14} className='text-cyan-400 shrink-0' />
          </div>

          <button
            onClick={() => {
              setMobileMenuOpen(false);
              handleLogout();
            }}
            className='w-full flex items-center justify-center gap-2 p-3 bg-slate-900 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 rounded-xl text-xs font-semibold transition'
          >
            <LogOut size={16} /> Sign Out Admin
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className='flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8'>
        <header className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80'>
          <div>
            <div className='flex items-center gap-2 text-xs text-slate-400 font-medium mb-1'>
              <span>Dashboard</span>
              <ChevronRight size={12} />
              <span className='text-cyan-400 capitalize'>{activeTab}</span>
            </div>
            <h2 className='text-xl sm:text-2xl font-black text-white tracking-tight'>
              {activeTab === 'analytics' && 'AI Analytics & Pricing Intelligence'}
              {activeTab === 'income' && 'Income & Expense Tracker'}
              {activeTab === 'profiles' && 'Employee Profiles, Certificates & Resume Vault'}
              {activeTab === 'staff' && 'Staff Directory & Salary Hike Logger'}
              {activeTab === 'leaves' && 'Employee Leave Approval Portal'}
              {activeTab === 'payslips' && 'Monthly Payslip & LOP Calculator'}
              {activeTab === 'offerletter' && 'HR Offer Letter Generator'}
              {activeTab === 'documents' && 'Employee Document & Certificate Vault'}
              {activeTab === 'directory' && 'Employee Directory & HR Data Export'}
            </h2>
          </div>

          <div className='flex items-center gap-3'>
            <div className='relative hidden md:block'>
              <Search size={16} className='absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500' />
              <input
                type='text'
                placeholder='Search records...'
                className='pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition w-64'
              />
            </div>
            <button className='p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition relative'>
              <Bell size={16} />
              <span className='absolute top-2 right-2 w-2 h-2 rounded-full bg-cyan-500 animate-pulse' />
            </button>
          </div>
        </header>

        {/* Tab Workspace Views */}
        <div className='space-y-6'>
          {activeTab === 'analytics' && <AIAnalytics />}
          {activeTab === 'income' && <IncomeExpenseTracker onStartBulkUpload={startBackgroundBulkUpload} bgUpload={bgUpload} />}
          {activeTab === 'profiles' && <EmployeeProfilesVault />}
          {activeTab === 'staff' && <StaffManagement />}
          {activeTab === 'leaves' && <LeaveManagement isAdmin={true} />}
          {activeTab === 'payslips' && <PayslipGenerator isAdmin={true} />}
          {activeTab === 'offerletter' && <OfferLetterGenerator />}
          {activeTab === 'documents' && <DocumentVault isAdmin={true} currentEmpEmail={sessionStorage.getItem('userEmail') || ''} />}
          {activeTab === 'directory' && <EmployeeDirectory />}
        </div>
      </main>

      {/* Floating Background Upload Progress Widget */}
      {(bgUpload.isUploading || bgUpload.status === 'completed' || bgUpload.status === 'failed') && (
        <div className='fixed bottom-6 right-6 z-50 bg-slate-900/95 border border-cyan-500/40 p-4 rounded-2xl shadow-2xl shadow-cyan-500/20 w-84 backdrop-blur-xl space-y-3 animate-fade-in'>
          <div className='flex items-center justify-between border-b border-slate-800 pb-2.5'>
            <div className='flex items-center gap-2'>
              {bgUpload.isUploading && <Loader2 size={16} className='text-cyan-400 animate-spin' />}
              {bgUpload.status === 'completed' && <Check size={16} className='text-emerald-400' />}
              {bgUpload.status === 'failed' && <AlertTriangle size={16} className='text-rose-400' />}
              <span className='text-xs font-bold text-white'>
                {bgUpload.isUploading && 'Bulk Uploading Records...'}
                {bgUpload.status === 'completed' && 'Upload Complete!'}
                {bgUpload.status === 'failed' && 'Upload Issue'}
              </span>
            </div>
            <span className='text-xs font-mono font-bold text-cyan-400'>{bgUpload.progress}%</span>
          </div>

          {bgUpload.isUploading && (
            <div className='space-y-1.5'>
              <div className='w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800'>
                <div
                  className='h-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-300 rounded-full'
                  style={{ width: bgUpload.progress + '%' }}
                />
              </div>
              <p className='text-[11px] text-slate-400 font-medium'>
                Writing {bgUpload.count.toLocaleString()} of {bgUpload.total.toLocaleString()} records in background. You can safely switch pages!
              </p>
            </div>
          )}

          {bgUpload.status === 'completed' && (
            <p className='text-xs text-emerald-300 font-semibold'>
              🎉 Successfully saved all {bgUpload.total.toLocaleString()} transaction records to database!
            </p>
          )}

          {bgUpload.status === 'failed' && (
            <p className='text-xs text-rose-400 font-semibold'>
              {bgUpload.error || 'An error occurred during upload.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
