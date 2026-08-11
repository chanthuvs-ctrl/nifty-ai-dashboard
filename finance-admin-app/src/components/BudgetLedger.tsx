import React, { useState } from 'react';
import { ObligationItem } from '../data/baselineData';
import { Search, Plus, CheckCircle2, Clock, Download } from 'lucide-react';

interface BudgetLedgerProps {
  items: ObligationItem[];
  onToggleStatus: (id: string) => void;
  onAddItem: (item: Partial<ObligationItem>) => void;
}

export const BudgetLedger: React.FC<BudgetLedgerProps> = ({ items, onToggleStatus, onAddItem }) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newCategory, setNewCategory] = useState<ObligationItem['category']>('Loans & EMIs');

  const categories = ['all', 'Loans & EMIs', 'KSFE Chitty', 'Credit Cards', 'Insurance', 'Variable & Misc'];

  const filteredItems = items.filter(item => {
    const matchCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase()) || 
                        item.dueDate.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  });

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newAmount) return;
    onAddItem({
      name: newName,
      amount: parseFloat(newAmount),
      dueDate: newDueDate || 'Flexible',
      category: newCategory,
      status: 'pending'
    });
    setNewName('');
    setNewAmount('');
    setNewDueDate('');
    setShowAddModal(false);
  };

  const exportCSV = () => {
    const headers = ["ID", "Name", "Category", "Due Date", "Amount (INR)", "Status"];
    const rows = items.map(i => [i.id, `"${i.name}"`, `"${i.category}"`, `"${i.dueDate}"`, i.amount, i.status]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "screenshot_budget_ledger.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 rounded-2xl space-y-5">
        {/* Toolbar Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">Screenshot Budget Ledger</h2>
            <p className="text-xs text-slate-400">July statement extracted baseline items with live payment status tracking</p>
          </div>

          <div className="flex items-center gap-2.5">
            <button 
              onClick={exportCSV}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 transition-all"
            >
              <Plus className="w-4 h-4" /> Add Obligation
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-800">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="Search item, due date, category..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  categoryFilter === cat
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat === 'all' ? `All (${items.length})` : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Obligation Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4">Amount (₹)</th>
                <th className="py-3 px-4">Notes</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {filteredItems.map(item => {
                const isPaid = item.status === 'paid';
                return (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                        isPaid
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      }`}>
                        {isPaid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                        {isPaid ? 'Paid' : 'Pending'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-200">
                      <span className={isPaid ? 'line-through opacity-50' : ''}>{item.name}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-medium text-slate-300">
                      {item.dueDate}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-white">
                      ₹{item.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-400">
                      {item.notes || 'Screenshot baseline item'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => onToggleStatus(item.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          isPaid
                            ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                            : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {isPaid ? 'Mark Pending' : 'Mark Paid'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-white">Add New Monthly Obligation</h3>
            <form onSubmit={handleSaveItem} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Obligation Name:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. KSFE Vatti #5"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Amount (₹):</label>
                  <input
                    type="number"
                    required
                    placeholder="4552"
                    value={newAmount}
                    onChange={e => setNewAmount(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Due Date:</label>
                  <input
                    type="text"
                    placeholder="7th"
                    value={newDueDate}
                    onChange={e => setNewDueDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Category:</label>
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value as ObligationItem['category'])}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="Loans & EMIs">Loans & EMIs</option>
                  <option value="KSFE Chitty">KSFE Chitty</option>
                  <option value="Credit Cards">Credit Cards</option>
                  <option value="Insurance">Insurance</option>
                  <option value="Variable & Misc">Variable & Misc</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
