import React from 'react';
import { ObligationItem } from '../data/baselineData';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

interface FinancialAnalyticsProps {
  items: ObligationItem[];
  salary: number;
}

export const FinancialAnalytics: React.FC<FinancialAnalyticsProps> = ({ items, salary }) => {
  // Category Totals
  const categoryTotals: { [cat: string]: number } = {};
  items.forEach(item => {
    categoryTotals[item.category] = (categoryTotals[item.category] || 0) + item.amount;
  });

  const catLabels = Object.keys(categoryTotals);
  const catData = Object.values(categoryTotals);

  const doughnutData = {
    labels: catLabels,
    datasets: [
      {
        data: catData,
        backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
        borderWidth: 0
      }
    ]
  };

  const totalObligations = items.reduce((acc, i) => acc + i.amount, 0);
  const buffer = salary - totalObligations;

  const barData = {
    labels: ['Salary Income', 'KSFE Chitty', 'Loans & EMIs', 'Credit Cards', 'LIC Insurance', 'Free Buffer'],
    datasets: [
      {
        label: 'Amount (₹)',
        data: [
          salary,
          categoryTotals['KSFE Chitty'] || 0,
          categoryTotals['Loans & EMIs'] || 0,
          categoryTotals['Credit Cards'] || 0,
          categoryTotals['Insurance'] || 0,
          buffer
        ],
        backgroundColor: ['#10b981', '#6366f1', '#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4'],
        borderRadius: 8
      }
    ]
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Category Donut Chart */}
      <div className="glass-panel p-6 rounded-2xl space-y-4">
        <h3 className="font-bold text-lg text-white border-b border-slate-800 pb-3">
          Commitment Category Breakdown
        </h3>
        <div className="h-72 flex items-center justify-center">
          <Doughnut
            data={doughnutData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'bottom', labels: { color: '#9ca3af', font: { family: 'Plus Jakarta Sans' } } }
              }
            }}
          />
        </div>
      </div>

      {/* Income vs Commitments Bar Chart */}
      <div className="glass-panel p-6 rounded-2xl space-y-4">
        <h3 className="font-bold text-lg text-white border-b border-slate-800 pb-3">
          Cash Allocation &amp; Liquidity Flow
        </h3>
        <div className="h-72">
          <Bar
            data={barData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                x: { ticks: { color: '#9ca3af' }, grid: { display: false } },
                y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } }
              },
              plugins: { legend: { display: false } }
            }}
          />
        </div>
      </div>
    </div>
  );
};
