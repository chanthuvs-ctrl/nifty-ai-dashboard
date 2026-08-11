import React from 'react';
import { Settings as SettingsIcon, ShieldCheck, Key, RefreshCw } from 'lucide-react';

interface AdminSettingsProps {
  user: string;
  onResetBaseline: () => void;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({ user, onResetBaseline }) => {
  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 rounded-2xl space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
            <SettingsIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Admin System &amp; Webhook Settings</h2>
            <p className="text-xs text-slate-400">Manage security credentials, API keys, and database baseline</p>
          </div>
        </div>

        {/* Security Credentials */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Admin Credentials Configured
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-500 block">Username:</span>
              <span className="text-slate-200 font-mono font-bold">{user}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Security Status:</span>
              <span className="text-emerald-400 font-semibold">Authenticated Session Active</span>
            </div>
          </div>
        </div>

        {/* Webhook API details */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Key className="w-4 h-4 text-indigo-400" /> REST API Ingest Webhook
          </div>
          <p className="text-xs text-slate-400">
            HTTP POST Webhook Endpoint for Smartphone SMS Auto-Forwarding (Tasker / iOS Shortcuts):
          </p>
          <div className="p-3 rounded-lg bg-black text-cyan-400 font-mono text-xs overflow-x-auto">
            POST https://finpulse-app.loca.lt/api/sms/ingest
          </div>
        </div>

        {/* Data Reset */}
        <div className="pt-2">
          <button
            onClick={onResetBaseline}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all"
          >
            <RefreshCw className="w-4 h-4" /> Reset Database to July Screenshot Baseline
          </button>
        </div>
      </div>
    </div>
  );
};
