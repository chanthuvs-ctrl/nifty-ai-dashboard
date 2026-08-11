import React from 'react';
import { BrainCircuit, AlertOctagon, Lightbulb, ShieldCheck } from 'lucide-react';

export const AIAdvisor: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 rounded-2xl space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/30 flex items-center justify-center">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">AI Financial Architect Intelligence</h2>
            <p className="text-xs text-slate-400">Smart analysis of your handwritten July baseline obligations</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1 */}
          <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-2">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
              <AlertOctagon className="w-5 h-5" /> High Commitment Stress (97.6%)
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Your fixed commitments of ₹1,13,186 consume nearly 98% of your monthly salary (₹1,16,000). Leaving only ₹2,814 for emergency living expenses.
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 space-y-2">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
              <Lightbulb className="w-5 h-5" /> KSFE Chitty Strategy
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              You have 6 KSFE Vatti payments (₹33,708/mo) + KSFE Chala (₹18,750/mo). Auctioning or maturing older chits can free up ₹30,000+ monthly cashflow immediately.
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <ShieldCheck className="w-5 h-5" /> LIC Premium Safety
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              3 LIC policies totalling ₹6,508/mo are scheduled on the 7th, 15th, and 28th. Auto-capture will monitor your bank balance before each debit to avoid bounce penalties.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
