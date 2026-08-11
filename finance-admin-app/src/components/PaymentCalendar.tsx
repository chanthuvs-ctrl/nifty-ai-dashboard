import React from 'react';
import { ObligationItem } from '../data/baselineData';
import { Calendar as CalendarIcon, AlertCircle } from 'lucide-react';

interface PaymentCalendarProps {
  items: ObligationItem[];
}

export const PaymentCalendar: React.FC<PaymentCalendarProps> = ({ items }) => {
  // Map due dates day 1 to 31
  const dayMap: { [day: number]: ObligationItem[] } = {};
  items.forEach(item => {
    const match = item.dueDate.match(/(\d+)/);
    if (match) {
      const day = parseInt(match[1], 10);
      if (!dayMap[day]) dayMap[day] = [];
      dayMap[day].push(item);
    }
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 31 Day Calendar */}
      <div className="lg:col-span-2 glass-panel p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-lg text-white">Monthly Payment Due Calendar</h3>
          </div>
          <span className="text-xs text-slate-400">July Baseline Schedule</span>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-400 mb-2">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Paid</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Upcoming</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Peak Cash Outflow</span>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
            const dayItems = dayMap[day] || [];
            const totalOutflow = dayItems.reduce((acc, item) => acc + item.amount, 0);
            const isPeak = totalOutflow > 10000;

            return (
              <div
                key={day}
                className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2 min-h-[75px] flex flex-col justify-between"
              >
                <span className="text-xs font-bold text-slate-400">{day}</span>
                <div className="space-y-1 mt-1">
                  {dayItems.map(item => (
                    <div
                      key={item.id}
                      className={`text-[10px] font-semibold p-1 rounded-md truncate ${
                        item.status === 'paid'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : isPeak
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                      title={`${item.name}: ₹${item.amount}`}
                    >
                      {item.name} (₹{item.amount})
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Peak Outflow Schedule Summary */}
      <div className="glass-panel p-6 rounded-2xl space-y-4">
        <h3 className="font-bold text-lg text-white border-b border-slate-800 pb-3">
          Cash Outflow Velocity
        </h3>

        <div className="space-y-3">
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-1">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
              <AlertCircle className="w-4 h-4" /> 7th of Month (Peak Outflow)
            </div>
            <p className="text-xs text-slate-300 font-semibold">₹20,708 Due</p>
            <p className="text-[11px] text-slate-400">4x KSFE Vatti (₹18,208) + LIC Policy 2 (₹2,500)</p>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
              <AlertCircle className="w-4 h-4" /> 17th of Month
            </div>
            <p className="text-xs text-slate-300 font-semibold">₹18,750 Due</p>
            <p className="text-[11px] text-slate-400">KSFE Chala Payment</p>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
              <AlertCircle className="w-4 h-4" /> 24th of Month
            </div>
            <p className="text-xs text-slate-300 font-semibold">₹15,500 Due</p>
            <p className="text-[11px] text-slate-400">2x KSFE Vatti New (₹15,500)</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
              10th of Month
            </div>
            <p className="text-xs text-slate-300 font-semibold">₹9,080 Due</p>
            <p className="text-[11px] text-slate-400">Credit Card Primary (₹5,324) + Amma Credit Card (₹3,756)</p>
          </div>
        </div>
      </div>
    </div>
  );
};
