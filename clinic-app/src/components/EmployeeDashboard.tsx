import EmployeeProfileView from './EmployeeProfileView';
import type { EmployeeProfileData } from './EmployeeProfileView';
import { useState } from 'react';
import { auth } from '../firebase';
import { signOut, updatePassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { LogOut, Calendar, FileText, Lock, Activity, ChevronRight, User, Menu, X , FolderOpen} from 'lucide-react';

import LeaveManagement from './LeaveManagement';
import PayslipGenerator from './PayslipGenerator';
import DocumentVault from './DocumentVault';

export default function EmployeeDashboard() {
  // SECURITY: Use only sessionStorage (cleared on tab close) for session identity.
  // localStorage is cleared on logout but sessionStorage is the strict per-tab session.
  const loggedInEmail = sessionStorage.getItem('userEmail') || auth.currentUser?.email || '';
  const [activeTab, setActiveTab] = useState<'leaves' | 'payslips' | 'password' | 'profile' | 'documents'>('payslips');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [newPass, setNewPass] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { await signOut(auth); } catch(e){} 
    sessionStorage.clear(); localStorage.clear();
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userEmpId');
    localStorage.removeItem('userName');
    navigate('/login', { replace: true });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPass) return;
    setLoading(true);
    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPass);
        setNewPass('');
        alert('Password updated successfully!');
      }
    } catch (err: any) {
      alert(err.message);
    }
    setLoading(false);
  };

  const navItems = [
    { id: 'leaves', label: 'My Leaves & Applications', icon: Calendar },
    { id: 'payslips', label: 'My Payslips & PDFs', icon: FileText },
    { id: 'profile', label: 'My Profile', icon: User },
    { id: 'documents', label: 'My Documents & Certs', icon: FolderOpen }
  ];

  if (!loggedInEmail) {
    navigate('/login', { replace: true });
    return null;
  }

  return (
    <div className='min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row selection:bg-cyan-500 selection:text-white relative overflow-x-hidden'>
      {/* Mobile Top Navigation Header */}
      <header className='md:hidden h-14 bg-slate-900/95 border-b border-slate-800/80 px-3 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md'>
        <div className='flex items-center gap-2 min-w-0'>
          <div className='w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-md shadow-cyan-500/20 flex-shrink-0'>
            <Activity className='w-3.5 h-3.5 text-white' />
          </div>
          <div className='min-w-0'>
            <h1 className='text-xs font-extrabold tracking-tight text-white truncate'>DE NATURA</h1>
          </div>
        </div>

        {/* User Profile & Sign Out right next to Menu button */}
        <div className='flex items-center gap-2 flex-shrink-0'>
          <div className='flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-950/80 border border-slate-800/80'>
            <div className='w-5 h-5 rounded bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center font-bold text-[10px] text-white'>
              {loggedInEmail.charAt(0).toUpperCase()}
            </div>
            <span className='text-[10px] font-semibold text-slate-300 max-w-[70px] truncate'>
              {loggedInEmail.split('@')[0]}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className='p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 transition'
            title='Sign Out'
          >
            <LogOut size={14} />
          </button>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className='p-1.5 rounded-lg bg-slate-800/80 text-cyan-400 border border-slate-700/60 active:scale-95 transition'
            aria-label='Toggle Menu'
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className='fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 md:hidden'
        />
      )}

      {/* Sidebar (Responsive Drawer on Mobile, Sticky Column on Desktop) */}
      <aside className={'w-64 bg-slate-900/95 md:bg-slate-900/90 border-r border-slate-800/80 flex flex-col justify-between p-4 fixed md:sticky top-0 h-screen z-50 glass-panel transition-transform duration-300 ease-in-out ' + (
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      )}>
        <div className='space-y-6'>
          <div className='flex items-center gap-3 px-3 py-2 border-b border-slate-800/80 pb-4'>
            <div className='w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-md shadow-cyan-500/20'>
              <Activity className='w-5 h-5 text-white' />
            </div>
            <div>
              <h1 className='text-sm font-extrabold tracking-tight text-white'>DE NATURA</h1>
              <p className='text-[9px] font-bold tracking-widest text-cyan-400 uppercase'>Employee Portal</p>
            </div>
          </div>

          <nav className='space-y-1'>
            <p className='px-3 text-[10px] font-bold tracking-wider text-slate-500 uppercase mb-2'>Staff Menu</p>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              if (!loggedInEmail) {
    navigate('/login', { replace: true });
    return null;
  }

  return (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id as any); setMobileMenuOpen(false); }}
                  className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all " + (
                    isActive 
                      ? 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 text-cyan-300 shadow-md shadow-cyan-500/10' 
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  )}
                >
                  <Icon size={18} className={isActive ? 'text-cyan-400' : 'text-slate-400'} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className='pt-4 border-t border-slate-800/80 space-y-3'>
          <div className='flex items-center gap-3 px-2 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800/80'>
            <div className='w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center font-bold text-xs text-white'>
              {loggedInEmail.charAt(0).toUpperCase()}
            </div>
            <div className='flex-1 min-w-0'>
              <p className='text-xs font-bold text-slate-200 truncate'>{loggedInEmail.split('@')[0]}</p>
              <p className='text-[10px] text-slate-500 truncate'>{loggedInEmail}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className='w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-xs font-semibold transition'
          >
            <LogOut size={14} /> Sign Out Workspace
          </button>
        </div>
      </aside>

      <main className='flex-1 flex flex-col min-w-0 overflow-y-auto'>
        <header className='h-16 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between px-8'>
          <div className='flex items-center gap-2 text-xs text-slate-400'>
            <span>Employee</span>
            <ChevronRight size={14} className='text-slate-600' />
            <span className='text-slate-200 font-semibold capitalize'>
              {navItems.find(n => n.id === activeTab)?.label}
            </span>
          </div>
        </header>

        <div className='p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6 sm:space-y-8'>
          {activeTab === 'leaves' && <LeaveManagement isAdmin={false} />}
          {activeTab === 'payslips' && <PayslipGenerator isAdmin={false} currentEmpEmail={loggedInEmail} />}
          {activeTab === 'profile' && (() => {
            const savedProfiles = JSON.parse(localStorage.getItem('de_natura_employee_profiles') || '{}');
            const foundKey = Object.keys(savedProfiles).find(k => savedProfiles[k].email?.toLowerCase() === loggedInEmail?.toLowerCase());
            const empProfile: EmployeeProfileData = foundKey ? savedProfiles[foundKey] : {
              uid: 'emp_current',
              name: loggedInEmail?.split('@')[0] || 'Employee',
              role: 'Staff Member',
              email: loggedInEmail,
              department: 'Clinic Operations',
              basicSalary: 15000,
              joiningDate: '01-01-2025'
            };
            if (!loggedInEmail) {
    navigate('/login', { replace: true });
    return null;
  }

  return (
              <EmployeeProfileView
                profile={empProfile}
                isEditable={false}
              />
            );
          })()}

          {activeTab === 'documents' && (
            <DocumentVault isAdmin={false} currentEmpEmail={loggedInEmail} />
          )}

          {activeTab === 'password' && (
            <div className='glass-panel p-8 rounded-2xl border border-slate-800 max-w-md space-y-6'>
              <div className='flex items-center gap-3 border-b border-slate-800/80 pb-4'>
                <div className='w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20'>
                  <Lock size={20} />
                </div>
                <div>
                  <h2 className='text-lg font-bold text-white tracking-tight'>Update Password</h2>
                  <p className='text-xs text-slate-400'>Change your initial default password.</p>
                </div>
              </div>

              <form onSubmit={handleChangePassword} className='space-y-4'>
                <div>
                  <label className='block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2'>New Password</label>
                  <input type='password' placeholder='••••••••' value={newPass} onChange={e => setNewPass(e.target.value)} required className='w-full p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-500 transition' />
                </div>
                <button type='submit' disabled={loading} className='w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/20 text-xs transition disabled:opacity-50'>
                  {loading ? 'Updating Password...' : 'Update Password'}
                </button>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
