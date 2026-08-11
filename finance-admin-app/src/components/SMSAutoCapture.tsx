import React, { useState } from 'react';
import { SMSLog } from '../data/baselineData';
import { MessageSquareCode, Zap, CheckCircle2, Copy } from 'lucide-react';

interface SMSAutoCaptureProps {
  smsLogs: SMSLog[];
  onIngestSMS: (text: string) => void;
}

export const SMSAutoCapture: React.FC<SMSAutoCaptureProps> = ({ smsLogs, onIngestSMS }) => {
  const [inputText, setInputText] = useState('');
  const [lastParsed, setLastParsed] = useState<string | null>(null);

  const presets = [
    { label: 'HDFC EMI', text: 'Alert: Rs 22579.00 debited from A/C XX4321 on 10-AUG-26 for Home Loan EMI payment. Info: HDFC BANK.' },
    { label: 'KSFE Chitty', text: 'Paid Rs 18750.00 to KSFE Chitty Account via GPay UPI/67891234 on 17-AUG-26. A/C XX9012 debited.' },
    { label: 'CRED Card', text: 'Rs 3555.00 debited from Axis Bank A/C XX5678 on 03-AUG-26 by CRED App. Ref: UPI/CRED/10293.' },
    { label: 'UPI Food', text: 'Rs 450.00 debited from A/C XX1234 on 12-AUG-26 at 19:42 by VPA swiggy@gpay. Info: Food & Dining.' },
    { label: 'Card Fuel', text: 'Spent Rs 2000.00 on ICICI Credit Card ending 9012 at IOCL PETROL PUMP, Kochi on 11-AUG-26.' },
    { label: 'LIC Premium', text: 'Rs 3008.00 debited from A/C XX1234 on 15-AUG-26 for LIC Policy Premium #1. Ref: NACH/LIC/9981.' }
  ];

  const handleIngest = () => {
    if (!inputText.trim()) return;
    onIngestSMS(inputText);
    setLastParsed(`✓ Ingested SMS. Parsed and auto-matched against monthly scheduled obligations.`);
    setInputText('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Sandbox & Presets */}
      <div className="glass-panel p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <MessageSquareCode className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-lg text-white">Live SMS Capture Sandbox</h3>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            Real-Time Regex Engine
          </span>
        </div>

        <p className="text-xs text-slate-400">
          Click any preset bank SMS below or paste incoming SMS text from your phone to test real-time parsing &amp; auto-reconciliation.
        </p>

        {/* Presets Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {presets.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => setInputText(preset.text)}
              className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-left transition-all group"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 block">{preset.label}</span>
              <span className="text-[11px] text-slate-300 line-clamp-1 group-hover:text-white mt-0.5">{preset.text}</span>
            </button>
          ))}
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-400 block mb-1.5">Paste Raw Bank SMS:</label>
          <textarea
            rows={4}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder="e.g. Rs 4552.00 debited from A/C XX7890 on 07-AUG-26 for KSFE Vatti Payment..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <button
          onClick={handleIngest}
          className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
        >
          <Zap className="w-4 h-4" /> Ingest &amp; Auto-Reconcile Bank SMS
        </button>

        {lastParsed && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{lastParsed}</span>
          </div>
        )}
      </div>

      {/* Captured Message Stream */}
      <div className="glass-panel p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="font-bold text-lg text-white">Captured Bank SMS Feed</h3>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
            {smsLogs.length} Messages
          </span>
        </div>

        <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
          {smsLogs.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-xs">
              No bank SMS messages logged yet.<br/>
              Use the sandbox on the left to simulate incoming SMS messages!
            </div>
          ) : (
            smsLogs.map(sms => (
              <div key={sms.id} className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between font-bold text-xs">
                  <span className="text-cyan-400">🏦 {sms.bank}</span>
                  <span className="text-emerald-400 text-sm">-₹{sms.amount.toLocaleString('en-IN')}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/80 text-[11px] text-slate-300 font-mono">
                  {sms.rawText}
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>Category: <strong className="text-purple-300">{sms.category}</strong></span>
                  <span>{new Date(sms.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
