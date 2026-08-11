import { useState, useMemo } from 'react';
import { DollarSign, BarChart3, LineChart, ShieldCheck } from 'lucide-react';

export interface Transaction {
  id?: string;
  date: string; // YYYY-MM-DD or YYYY-DD-MM
  type: 'Income' | 'Expense';
  amount: number | string;
  category?: string;
  description?: string;
}

interface Props {
  transactions: Transaction[];
  _activePeriod?: string;
}

export default function FinancialYearCharts({ transactions }: Props) {
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);
  const [hoveredLinePoint, setHoveredLinePoint] = useState<any | null>(null);

  // Normalize YYYY-DD-MM / YYYY-MM-DD helper
    // Normalize YYYY-MM-DD / D/M/YYYY helper
        const normalizeDate = (rawDate: any): string => {
    if (!rawDate) return new Date().toISOString().split('T')[0];
    const s = String(rawDate).trim();
    if (!s) return new Date().toISOString().split('T')[0];
    const parts = s.split(/[-/.]/);
    if (parts.length === 3) {
      if (parts[2].length === 4) {
        return parts[2] + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0');
      }
      if (parts[0].length === 4) {
        return parts[0] + '-' + parts[1].padStart(2, '0') + '-' + parts[2].padStart(2, '0');
      }
    }
    return new Date().toISOString().split('T')[0];
  };

  // Monthly Aggregation
  const financialData = useMemo(() => {
    const monthlyMap: Record<string, { income: number; expense: number }> = {};

    transactions.forEach(t => {
      const norm = normalizeDate(t.date);
      const ym = norm.slice(0, 7); // YYYY-MM
      const amt = parseFloat(String(t.amount || 0)) || 0;

      if (!monthlyMap[ym]) {
        monthlyMap[ym] = { income: 0, expense: 0 };
      }

      if (t.type === 'Income') {
        monthlyMap[ym].income += amt;
      } else {
        monthlyMap[ym].expense += amt;
      }
    });

    // Generate last 12 rolling months ending Aug 2026
    const months: string[] = [];
    const baseDate = new Date(2026, 7, 1); // Aug 2026
    for (let i = 11; i >= 0; i--) {
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 1);
      const ym = d.getFullYear() + '-' + (d.getMonth() + 1).toString().padStart(2, '0');
      months.push(ym);
    }

    const chartList = months.map(ym => {
      const data = monthlyMap[ym] || { income: 0, expense: 0 };
      const profit = data.income - data.expense;
      
      const parts = ym.split('-');
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

      return {
        ym,
        label,
        income: data.income,
        expense: data.expense,
        profit
      };
    });

    // Indian Financial Year Calculations (Apr 1 to Mar 31)
    // FY 2026-27 (Current: Apr 2026 - Mar 2027)
    let currFYIncome = 0;
    let currFYExpense = 0;

    // FY 2025-26 (Previous: Apr 2025 - Mar 2026)
    let prevFYIncome = 0;
    let prevFYExpense = 0;

    Object.keys(monthlyMap).forEach(ym => {
      const inc = monthlyMap[ym].income;
      const exp = monthlyMap[ym].expense;

      if (ym >= '2026-04' && ym <= '2027-03') {
        currFYIncome += inc;
        currFYExpense += exp;
      } else if (ym >= '2025-04' && ym <= '2026-03') {
        prevFYIncome += inc;
        prevFYExpense += exp;
      }
    });

    return {
      chartList,
      currFY: {
        income: currFYIncome,
        expense: currFYExpense,
        profit: currFYIncome - currFYExpense,
        margin: currFYIncome > 0 ? ((currFYIncome - currFYExpense) / currFYIncome) * 100 : 0
      },
      prevFY: {
        income: prevFYIncome,
        expense: prevFYExpense,
        profit: prevFYIncome - prevFYExpense,
        margin: prevFYIncome > 0 ? ((prevFYIncome - prevFYExpense) / prevFYIncome) * 100 : 0
      }
    };
  }, [transactions]);

  // Max value for scaling SVG Bar height
  const maxBarValue = Math.max(
    ...financialData.chartList.map(d => Math.max(d.income, d.expense)),
    100000
  );

  // Line Chart Bounds
  const maxProfit = Math.max(...financialData.chartList.map(d => d.profit), 50000);
  const minProfit = Math.min(...financialData.chartList.map(d => d.profit), -50000);
  const profitRange = (maxProfit - minProfit) || 100000;

  return (
    <div className='space-y-8 text-slate-100'>
      {/* Financial Year Summary Cards */}
      <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
        {/* Current FY Card */}
        <div className='glass-panel p-6 rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-slate-900/90 to-slate-950/90 space-y-4 shadow-xl shadow-cyan-500/10 relative overflow-hidden'>
          <div className='flex items-center justify-between border-b border-slate-800 pb-4'>
            <div>
              <span className='px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-extrabold text-[10px] uppercase tracking-wider'>
                Current Financial Year (FY 2026-27)
              </span>
              <h3 className='text-lg font-black text-white mt-1'>Apr 2026 – Mar 2027 Summary</h3>
            </div>
            <div className='w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center font-black'>
              <DollarSign size={20} />
            </div>
          </div>

          <div className='grid grid-cols-3 gap-3 text-center'>
            <div className='p-3 rounded-xl bg-slate-950/60 border border-slate-800/80'>
              <p className='text-[10px] font-bold text-slate-400 uppercase tracking-wider'>Income</p>
              <p className='text-sm sm:text-base font-extrabold text-emerald-400 font-mono mt-0.5'>
                ₹{(financialData.currFY.income / 100000).toFixed(2)}L
              </p>
              <p className='text-[9px] text-slate-500 font-mono'>₹{financialData.currFY.income.toLocaleString()}</p>
            </div>

            <div className='p-3 rounded-xl bg-slate-950/60 border border-slate-800/80'>
              <p className='text-[10px] font-bold text-slate-400 uppercase tracking-wider'>Expenses</p>
              <p className='text-sm sm:text-base font-extrabold text-rose-400 font-mono mt-0.5'>
                ₹{(financialData.currFY.expense / 100000).toFixed(2)}L
              </p>
              <p className='text-[9px] text-slate-500 font-mono'>₹{financialData.currFY.expense.toLocaleString()}</p>
            </div>

            <div className='p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30'>
              <p className='text-[10px] font-bold text-cyan-300 uppercase tracking-wider'>Net Profit</p>
              <p className='text-sm sm:text-base font-extrabold text-cyan-300 font-mono mt-0.5'>
                ₹{(financialData.currFY.profit / 100000).toFixed(2)}L
              </p>
              <p className='text-[9px] text-cyan-400 font-bold'>Margin: {financialData.currFY.margin.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        {/* Previous FY Card */}
        <div className='glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4 relative overflow-hidden'>
          <div className='flex items-center justify-between border-b border-slate-800 pb-4'>
            <div>
              <span className='px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 font-bold text-[10px] uppercase tracking-wider'>
                Previous Financial Year (FY 2025-26)
              </span>
              <h3 className='text-lg font-black text-white mt-1'>Apr 2025 – Mar 2026 Audit</h3>
            </div>
            <div className='w-10 h-10 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center font-black'>
              <ShieldCheck size={20} />
            </div>
          </div>

          <div className='grid grid-cols-3 gap-3 text-center'>
            <div className='p-3 rounded-xl bg-slate-950/60 border border-slate-800/80'>
              <p className='text-[10px] font-bold text-slate-400 uppercase tracking-wider'>Income</p>
              <p className='text-sm sm:text-base font-extrabold text-emerald-400 font-mono mt-0.5'>
                ₹{(financialData.prevFY.income / 100000).toFixed(2)}L
              </p>
              <p className='text-[9px] text-slate-500 font-mono'>₹{financialData.prevFY.income.toLocaleString()}</p>
            </div>

            <div className='p-3 rounded-xl bg-slate-950/60 border border-slate-800/80'>
              <p className='text-[10px] font-bold text-slate-400 uppercase tracking-wider'>Expenses</p>
              <p className='text-sm sm:text-base font-extrabold text-rose-400 font-mono mt-0.5'>
                ₹{(financialData.prevFY.expense / 100000).toFixed(2)}L
              </p>
              <p className='text-[9px] text-slate-500 font-mono'>₹{financialData.prevFY.expense.toLocaleString()}</p>
            </div>

            <div className='p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30'>
              <p className='text-[10px] font-bold text-indigo-300 uppercase tracking-wider'>Net Profit</p>
              <p className='text-sm sm:text-base font-extrabold text-indigo-300 font-mono mt-0.5'>
                ₹{(financialData.prevFY.profit / 100000).toFixed(2)}L
              </p>
              <p className='text-[9px] text-indigo-400 font-bold'>Margin: {financialData.prevFY.margin.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* 12-Month Bar Chart: Income vs Expense */}
      <div className='glass-panel p-6 rounded-2xl border border-slate-800 space-y-6'>
        <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4'>
          <div className='flex items-center gap-3'>
            <div className='w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center'>
              <BarChart3 size={20} />
            </div>
            <div>
              <h3 className='text-base font-extrabold text-white tracking-tight'>12-Month Income vs Expense Bar Chart</h3>
              <p className='text-xs text-slate-400'>Comparing monthly inflow (emerald) vs outflow (rose) for the last 12 months.</p>
            </div>
          </div>

          <div className='flex items-center gap-4 text-xs font-bold'>
            <div className='flex items-center gap-1.5'>
              <span className='w-3 h-3 rounded-md bg-emerald-400 inline-block' />
              <span className='text-slate-300'>Monthly Income</span>
            </div>
            <div className='flex items-center gap-1.5'>
              <span className='w-3 h-3 rounded-md bg-rose-400 inline-block' />
              <span className='text-slate-300'>Monthly Expense</span>
            </div>
          </div>
        </div>

        {/* Bar Chart Visual */}
        <div className='h-64 flex items-end justify-between gap-2 sm:gap-4 pt-8 pb-4 px-2 border-b border-slate-800/80 relative'>
          {financialData.chartList.map(item => {
            const incPct = Math.min(100, (item.income / maxBarValue) * 100);
            const expPct = Math.min(100, (item.expense / maxBarValue) * 100);
            const isHovered = hoveredMonth === item.ym;

            return (
              <div 
                key={item.ym} 
                className='flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative'
                onMouseEnter={() => setHoveredMonth(item.ym)}
                onMouseLeave={() => setHoveredMonth(null)}
              >
                {/* Tooltip */}
                {isHovered && (
                  <div className='absolute -top-16 z-30 bg-slate-900 border border-cyan-500/50 p-2.5 rounded-xl shadow-2xl text-[11px] font-mono space-y-1 min-w-[140px] pointer-events-none animate-fade-in'>
                    <p className='font-bold text-cyan-400 border-b border-slate-800 pb-1'>{item.label}</p>
                    <p className='text-emerald-400'>Inc: ₹{item.income.toLocaleString()}</p>
                    <p className='text-rose-400'>Exp: ₹{item.expense.toLocaleString()}</p>
                    <p className={'font-bold ' + (item.profit >= 0 ? 'text-cyan-300' : 'text-amber-400')}>
                      Net: ₹{item.profit.toLocaleString()}
                    </p>
                  </div>
                )}

                {/* Bars side-by-side */}
                <div className='w-full flex items-end justify-center gap-1 h-full'>
                  <div 
                    style={{ height: incPct + '%' }} 
                    className='w-1/2 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-sm transition-all duration-300 group-hover:brightness-125'
                  />
                  <div 
                    style={{ height: expPct + '%' }} 
                    className='w-1/2 bg-gradient-to-t from-rose-600 to-rose-400 rounded-t-sm transition-all duration-300 group-hover:brightness-125'
                  />
                </div>

                <span className='text-[10px] font-bold text-slate-400 mt-2 truncate w-full text-center'>
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 12-Month Line Chart: Net Profit Trend */}
      <div className='glass-panel p-6 rounded-2xl border border-slate-800 space-y-6 relative'>
        <div className='flex items-center justify-between border-b border-slate-800 pb-4'>
          <div className='flex items-center gap-3'>
            <div className='w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center'>
              <LineChart size={20} />
            </div>
            <div>
              <h3 className='text-base font-extrabold text-white tracking-tight'>12-Month Net Profit Line Chart</h3>
              <p className='text-xs text-slate-400'>Hover on any data point to view exact P&L profit breakdown.</p>
            </div>
          </div>
        </div>

        {/* Hover Floating Tooltip Modal for Line Chart */}
        {hoveredLinePoint && (
          <div className='p-3 bg-slate-900/95 border border-cyan-500/50 rounded-2xl shadow-2xl space-y-1.5 text-xs font-mono max-w-xs animate-fade-in backdrop-blur-xl border-l-4 border-l-cyan-400'>
            <div className='flex justify-between items-center border-b border-slate-800 pb-1'>
              <span className='font-bold text-white uppercase tracking-wider'>{hoveredLinePoint.item.label}</span>
              <span className={'px-2 py-0.5 rounded-md font-extrabold text-[10px] ' + (hoveredLinePoint.item.profit >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300')}>
                {hoveredLinePoint.item.profit >= 0 ? 'Net Surplus' : 'Deficit'}
              </span>
            </div>
            <div className='grid grid-cols-2 gap-2 text-[11px] pt-1'>
              <div>
                <p className='text-slate-400 text-[9px] uppercase'>Income</p>
                <p className='font-extrabold text-emerald-400'>₹{hoveredLinePoint.item.income.toLocaleString()}</p>
              </div>
              <div>
                <p className='text-slate-400 text-[9px] uppercase'>Expense</p>
                <p className='font-extrabold text-rose-400'>₹{hoveredLinePoint.item.expense.toLocaleString()}</p>
              </div>
              <div className='col-span-2 pt-1 border-t border-slate-800/80 flex justify-between items-center'>
                <span className='text-slate-300 font-bold'>Net Monthly Profit:</span>
                <span className={'font-black text-sm ' + (hoveredLinePoint.item.profit >= 0 ? 'text-cyan-300' : 'text-rose-400')}>
                  ₹{hoveredLinePoint.item.profit.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* SVG Line Chart */}
        <div className='relative w-full h-56 pt-4'>
          <svg className='w-full h-full overflow-visible' viewBox='0 0 1000 200' preserveAspectRatio='none'>
            <defs>
              <linearGradient id='profitGradient' x1='0' y1='0' x2='0' y2='1'>
                <stop offset='0%' stopColor='#06b6d4' stopOpacity='0.4' />
                <stop offset='100%' stopColor='#06b6d4' stopOpacity='0' />
              </linearGradient>
            </defs>

            {/* Zero Axis Line */}
            {(() => {
              const zeroY = 180 - ((0 - minProfit) / profitRange) * 160;
              return (
                <line x1='0' y1={zeroY} x2='1000' y2={zeroY} stroke='#334155' strokeDasharray='4' strokeWidth='1.5' />
              );
            })()}

            {/* Calculate Points */}
            {(() => {
              const points = financialData.chartList.map((item, idx) => {
                const x = (idx / (financialData.chartList.length - 1)) * 960 + 20;
                const y = 180 - ((item.profit - minProfit) / profitRange) * 160;
                return { x, y, item };
              });

              const pathD = points.reduce((acc, p, idx) => {
                return idx === 0 ? 'M ' + p.x + ' ' + p.y : acc + ' L ' + p.x + ' ' + p.y;
              }, '');

              const areaD = pathD + ' L ' + points[points.length - 1].x + ' 190 L ' + points[0].x + ' 190 Z';

              return (
                <g>
                  {/* Fill Gradient Area */}
                  <path d={areaD} fill='url(#profitGradient)' />
                  
                  {/* Stroke Line */}
                  <path d={pathD} fill='none' stroke='#06b6d4' strokeWidth='3.5' strokeLinecap='round' strokeLinejoin='round' />

                  {/* Data Point Circles */}
                  {points.map((p, idx) => (
                    <g 
                      key={idx} 
                      className='cursor-pointer group'
                      onMouseEnter={() => setHoveredLinePoint(p)}
                      onMouseLeave={() => setHoveredLinePoint(null)}
                    >
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r='7'
                        fill={p.item.profit >= 0 ? '#10b981' : '#f43f5e'}
                        stroke='#0f172a'
                        strokeWidth='2'
                        className='transition-all duration-200 hover:r-10 hover:stroke-cyan-400'
                      />
                    </g>
                  ))}
                </g>
              );
            })()}
          </svg>

          {/* Month Labels below line chart */}
          <div className='flex justify-between text-[10px] font-bold text-slate-400 mt-4 px-2'>
            {financialData.chartList.map(item => (
              <span 
                key={item.ym} 
                onMouseEnter={() => {
                  const p = financialData.chartList.find(c => c.ym === item.ym);
                  if (p) setHoveredLinePoint({ item: p });
                }}
                className={'cursor-pointer hover:underline ' + (item.profit >= 0 ? 'text-emerald-400 font-extrabold' : 'text-rose-400 font-extrabold')}
              >
                {item.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
