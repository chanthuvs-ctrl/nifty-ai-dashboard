import React from 'react';
import { FinanceState } from '../data/baselineData';
import { Wallet, Landmark, AlertTriangle, ShieldCheck, ArrowUpRight, CheckCircle2, Clock } from 'lucide-react';

interface AdminDashboardProps {
  state: FinanceState;
  onNavigateToTab: (tab: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ state, onNavigateToTab }) => {
  const totalSalary = state.salary;
  const totalObligations = state.items.reduce((acc, item) => acc + item.amount, 0);
  const paidItems = state.items.filter(item => item.status === 'paid');
  const totalPaid = paidItems.reduce((acc, item) => acc + item.amount, 0);
  const pendingItems = state.items.filter(item => item.status === 'pending');
  const totalPending = pendingItems.reduce((acc, item) => acc + item.amount, 0);
  const buffer = totalSalary - totalObligations;
  const dti = ((totalObligations / totalSalary) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Monthly Income */}
        <div className="glass-panel p-5 rounded-2xl glass-panel-hover relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Monthly Salary</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-3">₹{totalSalary.toLocaleString('en-IN')}</p>
          <p className="text-xs text-slate-400 mt-1">Primary credited income</p>
        </div>

        {/* Total Commitments */}
        <div className="glass-panel p-5 rounded-2xl glass-panel-hover">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Fixed Commitments</span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center">
              <Landmark className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-3">₹{totalObligations.toLocaleString('en-IN')}</p>
          <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 inline" /> {paidItems.length} of {state.items.length} Paid (₹{totalPaid.toLocaleString('en-IN')})
          </p>
        </div>

        {/* Free Cash Buffer */}
        <div className="glass-panel p-5 rounded-2xl glass-panel-hover">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Unallocated Buffer</span>
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-3">₹{buffer.toLocaleString('en-IN')}</p>
          <p className="text-xs text-slate-400 mt-1">Free balance after fixed obligations</p>
        </div>

        {/* DTI Stress */}
        <div className="glass-panel p-5 rounded-2xl glass-panel-hover">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Commitment Stress</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-400 mt-3">{dti}%</p>
          <div className="w-full bg-slate-800 h-2 rounded-full mt-2 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-rose-500 h-full rounded-full" style={{ width: `${Math.min(parseFloat(dti), 100)}%` }}></div>
          </div>
        </div>
      </div>

      {/* Main Grid: Pending Action Items & SMS Recent Live Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: High Priority Due Items */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-bold text-lg text-white">Upcoming Due Obligations</h3>
              <p className="text-xs text-slate-400">Items extracted directly from your July baseline screenshot</p>
            </div>
            <button 
              onClick={() => onNavigateToTab('ledger')}
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              View All (17) <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {pendingItems.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                🎉 All 17 monthly obligations cleared and marked as paid!
              </div>
            ) : (
              pendingItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-xs">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-slate-200">{item.name}</p>
                      <p className="text-xs text-slate-400">Due: <span className="text-amber-300 font-medium">{item.dueDate}</span> | Category: {item.category}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm text-white">₹{item.amount.toLocaleString('en-IN')}</p>
                    <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Pending
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right 1 Col: Live Bank SMS Capture Stream */}
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-base text-white">Captured Bank SMS Feed</h3>
            <button 
              onClick={() => onNavigateToTab('sms')}
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              SMS Hub <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {state.smsLogs.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs">
                No phone messages captured yet.<br/>
                Click <span className="text-indigo-400 font-semibold cursor-pointer" onClick={() => onNavigateToTab('sms')}>Simulate SMS</span> to test auto-capture!
              </div>
            ) : (
              state.smsLogs.slice(0, 4).map((sms) => (
                <div key={sms.id} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1">
                  <div className="flex items-center justify-between font-bold text-slate-300">
                    <span className="text-cyan-400">{sms.bank}</span>
                    <span className="text-emerald-400">-₹{sms.amount.toLocaleString('en-IN')}</span>
                  </div>
                  <p className="text-slate-400 text-[11px] line-clamp-2">{sms.rawText}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
