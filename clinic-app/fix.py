
admin_code = """import { useState } from 'react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { 
  LogOut, Sparkles, DollarSign, Users, Calendar, FileText, Mail, 
  Activity, Bell, Search, ChevronRight, Shield
} from 'lucide-react';

import AIAnalytics from './AIAnalytics';
import IncomeExpenseTracker from './IncomeExpenseTracker';
import StaffManagement from './StaffManagement';
import LeaveManagement from './LeaveManagement';
import PayslipGenerator from './PayslipGenerator';
import OfferLetterGenerator from './OfferLetterGenerator';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'analytics' | 'income' | 'staff' | 'leaves' | 'payslips' | 'offerletter'>('analytics');
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const navItems = [
    { id: 'analytics', label: 'AI Analytics & Insights', icon: Sparkles, badge: 'AI' },
    { id: 'income', label: 'Income & Expense Tracker', icon: DollarSign },
    { id: 'staff', label: 'Staff & Salary Hikes', icon: Users },
    { id: 'leaves', label: 'Leave Approvals', icon: Calendar },
    { id: 'payslips', label: 'Payroll & Payslips', icon: FileText },
    { id: 'offerletter', label: 'Offer Letters', icon: Mail }
  ];

  return (
    <div className='min-h-screen bg-slate-950 text-slate-100 flex selection:bg-cyan-500 selection:text-white'>
      <aside className='w-64 bg-slate-900/90 border-r border-slate-800/80 flex flex-col justify-between p-4 sticky top-0 h-screen z-30 glass-panel'>
        <div className='space-y-6'>
          <div className='flex items-center gap-3 px-3 py-2 border-b border-slate-800/80 pb-4'>
            <div className='w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-md shadow-cyan-500/20'>
              <Activity className='w-5 h-5 text-white' />
            </div>
            <div>
              <h1 className='text-sm font-extrabold tracking-tight text-white'>DE NATURA</h1>
              <p className='text-[9px] font-bold tracking-widest text-cyan-400 uppercase'>Admin Workspace</p>
            </div>
          </div>

          <nav className='space-y-1'>
            <p className='px-3 text-[10px] font-bold tracking-wider text-slate-500 uppercase mb-2'>Main Menu</p>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={"w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all " + (
                    isActive 
                      ? 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 text-cyan-300 shadow-md shadow-cyan-500/10' 
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  )}
                >
                  <div className='flex items-center gap-3'>
                    <Icon size={18} className={isActive ? 'text-cyan-400' : 'text-slate-400'} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className='px-1.5 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 text-[9px] font-extrabold border border-cyan-500/30'>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className='pt-4 border-t border-slate-800/80 space-y-3'>
          <div className='flex items-center gap-3 px-2 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800/80'>
            <div className='w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-xs text-white'>
              AD
            </div>
            <div className='flex-1 min-w-0'>
              <p className='text-xs font-bold text-slate-200 truncate'>Clinic Admin</p>
              <p className='text-[10px] text-slate-500 truncate'>admin@clinic.com</p>
            </div>
            <Shield size={14} className='text-cyan-400 flex-shrink-0' />
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
            <span>Admin</span>
            <ChevronRight size={14} className='text-slate-600' />
            <span className='text-slate-200 font-semibold capitalize'>
              {navItems.find(n => n.id === activeTab)?.label}
            </span>
          </div>

          <div className='flex items-center gap-4'>
            <div className='relative hidden sm:block w-64'>
              <Search className='w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2' />
              <input 
                type='text' 
                placeholder='Search transactions, staff...'
                className='w-full pl-9 pr-3 py-1.5 bg-slate-900/90 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 transition'
              />
            </div>
            <button className='w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition relative'>
              <Bell size={16} />
              <span className='w-2 h-2 rounded-full bg-cyan-400 absolute top-1.5 right-1.5 animate-pulse' />
            </button>
          </div>
        </header>

        <div className='p-8 max-w-7xl w-full mx-auto space-y-8'>
          {activeTab === 'analytics' && <AIAnalytics />}
          {activeTab === 'income' && <IncomeExpenseTracker />}
          {activeTab === 'staff' && <StaffManagement />}
          {activeTab === 'leaves' && <LeaveManagement isAdmin={true} />}
          {activeTab === 'payslips' && <PayslipGenerator isAdmin={true} />}
          {activeTab === 'offerletter' && <OfferLetterGenerator />}
        </div>
      </main>
    </div>
  );
}
"""

emp_code = """import { useState } from 'react';
import { auth } from '../firebase';
import { signOut, updatePassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { LogOut, Calendar, FileText, Lock, Activity, ChevronRight } from 'lucide-react';

import LeaveManagement from './LeaveManagement';
import PayslipGenerator from './PayslipGenerator';

export default function EmployeeDashboard() {
  const [activeTab, setActiveTab] = useState<'leaves' | 'payslips' | 'password'>('leaves');
  const [newPass, setNewPass] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
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
    { id: 'password', label: 'Account Security', icon: Lock }
  ];

  return (
    <div className='min-h-screen bg-slate-950 text-slate-100 flex selection:bg-cyan-500 selection:text-white'>
      <aside className='w-64 bg-slate-900/90 border-r border-slate-800/80 flex flex-col justify-between p-4 sticky top-0 h-screen z-30 glass-panel'>
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
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
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
              {auth.currentUser?.email?.charAt(0).toUpperCase() || 'E'}
            </div>
            <div className='flex-1 min-w-0'>
              <p className='text-xs font-bold text-slate-200 truncate'>{auth.currentUser?.email?.split('@')[0]}</p>
              <p className='text-[10px] text-slate-500 truncate'>{auth.currentUser?.email}</p>
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

        <div className='p-8 max-w-7xl w-full mx-auto space-y-8'>
          {activeTab === 'leaves' && <LeaveManagement isAdmin={false} />}
          {activeTab === 'payslips' && <PayslipGenerator isAdmin={false} currentEmpEmail={auth.currentUser?.email || ''} />}
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
"""

with open('src/components/AdminDashboard.tsx', 'w') as f: f.write(admin_code)
with open('src/components/EmployeeDashboard.tsx', 'w') as f: f.write(emp_code)

with open('src/components/PayslipGenerator.tsx', 'r') as f: c = f.read()
c = c.replace('FileText, ', '')
with open('src/components/PayslipGenerator.tsx', 'w') as f: f.write(c)

print('Updated fix script written.')
