import React from 'react';
import { Radio, MessageSquarePlus, Link2, RotateCcw } from 'lucide-react';

interface HeaderProps {
  month: string;
  onOpenSMSModal: () => void;
  onOpenGuideModal: () => void;
  onResetBaseline: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  month,
  onOpenSMSModal,
  onOpenGuideModal,
  onResetBaseline
}) => {
  return (
    <header className="h-20 border-b border-slate-800/80 bg-[#0e1424]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-white tracking-tight">Admin Finance Architect</h1>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            {month} Statement
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-0.5">
          Screenshot Baseline Ledger + Automated Phone Bank SMS Capture
        </p>
      </div>

      <div className="flex items-center gap-3">
        {/* Status indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
          <span>SMS Webhook Active</span>
        </div>

        <button
          onClick={onOpenSMSModal}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-md shadow-indigo-600/30 transition-all"
        >
          <MessageSquarePlus className="w-4 h-4" /> Simulate SMS
        </button>

        <button
          onClick={onOpenGuideModal}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
        >
          <Link2 className="w-4 h-4" /> Phone Setup
        </button>

        <button
          onClick={onResetBaseline}
          title="Reset back to July screenshot default baseline"
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
