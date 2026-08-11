import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { AdminDashboard } from './components/AdminDashboard';
import { BudgetLedger } from './components/BudgetLedger';
import { SMSAutoCapture } from './components/SMSAutoCapture';
import { PaymentCalendar } from './components/PaymentCalendar';
import { FinancialAnalytics } from './components/FinancialAnalytics';
import { AIAdvisor } from './components/AIAdvisor';
import { AdminSettings } from './components/AdminSettings';
import { LoginModal } from './components/LoginModal';
import { INITIAL_BASELINE_DATA, FinanceState, ObligationItem } from './data/baselineData';
import { parseBankSMS } from './utils/smsParser';

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<string>('chanthuvs');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [state, setState] = useState<FinanceState>(() => {
    const saved = localStorage.getItem('de_natura_finance_state');
    return saved ? JSON.parse(saved) : INITIAL_BASELINE_DATA;
  });

  const [showSMSModal, setShowSMSModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [modalSMSText, setModalSMSText] = useState('');

  useEffect(() => {
    localStorage.setItem('de_natura_finance_state', JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    const token = localStorage.getItem('de_natura_token');
    if (token === 'token_chanthuvs_admin') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (u: string, p: string): boolean => {
    if (u === 'chanthuvs' && p === 'Gango4@ntm') {
      setUser(u);
      setIsAuthenticated(true);
      localStorage.setItem('de_natura_token', 'token_chanthuvs_admin');
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('de_natura_token');
  };

  const handleToggleStatus = (id: string) => {
    setState(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === id
          ? { ...item, status: item.status === 'paid' ? 'pending' : 'paid' }
          : item
      )
    }));
  };

  const handleAddItem = (newItem: Partial<ObligationItem>) => {
    const item: ObligationItem = {
      id: 'item_' + Date.now(),
      name: newItem.name || 'New Item',
      amount: newItem.amount || 0,
      dueDate: newItem.dueDate || 'Flexible',
      category: newItem.category || 'Loans & EMIs',
      status: 'pending',
      notes: newItem.notes || 'Added manually'
    };
    setState(prev => ({
      ...prev,
      items: [...prev.items, item]
    }));
  };

  const handleIngestSMS = (smsText: string) => {
    const parsed = parseBankSMS(smsText);
    setState(prev => {
      const updatedLogs = [parsed, ...prev.smsLogs];
      // Auto reconcile logic
      let matchedItem = false;
      const updatedItems = prev.items.map(item => {
        if (!matchedItem && item.status !== 'paid') {
          const amtDiff = Math.abs(item.amount - parsed.amount);
          if (amtDiff < 2) {
            matchedItem = true;
            return { ...item, status: 'paid' as const };
          }
        }
        return item;
      });
      return {
        ...prev,
        smsLogs: updatedLogs,
        items: updatedItems
      };
    });
  };

  const handleResetBaseline = () => {
    if (confirm("Reset financial state back to July screenshot baseline?")) {
      setState(INITIAL_BASELINE_DATA);
    }
  };

  if (!isAuthenticated) {
    return <LoginModal onLogin={handleLogin} />;
  }

  return (
    <div className="flex min-h-screen bg-[#070a12] text-slate-100">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          month={state.month}
          onOpenSMSModal={() => setShowSMSModal(true)}
          onOpenGuideModal={() => setShowGuideModal(true)}
          onResetBaseline={handleResetBaseline}
        />

        <main className="p-6 flex-1 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <AdminDashboard state={state} onNavigateToTab={setActiveTab} />
          )}

          {activeTab === 'ledger' && (
            <BudgetLedger
              items={state.items}
              onToggleStatus={handleToggleStatus}
              onAddItem={handleAddItem}
            />
          )}

          {activeTab === 'sms' && (
            <SMSAutoCapture
              smsLogs={state.smsLogs}
              onIngestSMS={handleIngestSMS}
            />
          )}

          {activeTab === 'calendar' && (
            <PaymentCalendar items={state.items} />
          )}

          {activeTab === 'analytics' && (
            <FinancialAnalytics items={state.items} salary={state.salary} />
          )}

          {activeTab === 'advisor' && (
            <AIAdvisor />
          )}

          {activeTab === 'settings' && (
            <AdminSettings user={user} onResetBaseline={handleResetBaseline} />
          )}
        </main>
      </div>

      {/* SMS Simulation Modal */}
      {showSMSModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl w-full max-w-lg space-y-4">
            <h3 className="text-lg font-bold text-white">📲 Bank SMS Ingest Sandbox</h3>
            <textarea
              rows={4}
              value={modalSMSText}
              onChange={e => setModalSMSText(e.target.value)}
              placeholder="Paste raw SMS text here..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSMSModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (modalSMSText.trim()) {
                    handleIngestSMS(modalSMSText);
                    setModalSMSText('');
                    setShowSMSModal(false);
                  }
                }}
                className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl"
              >
                Ingest &amp; Reconcile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phone Setup Guide Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl w-full max-w-xl space-y-4">
            <h3 className="text-lg font-bold text-white">🔗 Phone SMS Webhook Integration Guide</h3>
            <div className="p-3 bg-black rounded-xl font-mono text-xs text-cyan-400 border border-slate-800">
              POST https://finpulse-app.loca.lt/api/sms/ingest
            </div>
            <p className="text-xs text-slate-400">
              Set up SMS Forwarder / Tasker on Android or iOS Shortcuts on iPhone to automatically post bank SMS text to your hosted URL.
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setShowGuideModal(false)}
                className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-xl"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
