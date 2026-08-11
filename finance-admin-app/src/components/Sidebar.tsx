import React from 'react';
import { 
  LayoutDashboard, 
  Receipt, 
  MessageSquareCode, 
  CalendarDays, 
  BarChart3, 
  BrainCircuit, 
  Settings, 
  LogOut,
  ShieldCheck
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: string;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, user, onLogout }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard Overview', icon: LayoutDashboard },
    { id: 'ledger', label: 'Screenshot Ledger', icon: Receipt },
    { id: 'sms', label: 'Bank SMS Auto-Capture', icon: MessageSquareCode, badge: 'Live' },
    { id: 'calendar', label: 'Payment Due Calendar', icon: CalendarDays },
    { id: 'analytics', label: 'Financial Analytics', icon: BarChart3 },
    { id: 'advisor', label: 'AI Financial Advisor', icon: BrainCircuit, badge: 'AI' },
    { id: 'settings', label: 'Admin Settings', icon: Settings }
  ];

  return (
    <aside className="w-64 bg-[#0e1424] border-r border-slate-800/80 flex flex-col h-screen sticky top-0 z-30">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
          <Receipt className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-bold text-base text-white tracking-tight flex items-center gap-1.5">
            De Natura <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">Admin</span>
          </h2>
          <p className="text-xs text-slate-400">Personal Finance Assistant</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Admin Management
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                isActive
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  item.badge === 'Live' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Admin User Footer */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-900/40">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold text-xs">
              {user.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-200">{user}</p>
              <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 inline" /> Admin Authenticated
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign Out
        </button>
      </div>
    </aside>
  );
};
