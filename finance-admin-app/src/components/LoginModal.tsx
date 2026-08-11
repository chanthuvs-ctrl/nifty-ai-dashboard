import React, { useState } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';

interface LoginModalProps {
  onLogin: (u: string, p: string) => boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('chanthuvs');
  const [password, setPassword] = useState('Gango4@ntm');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const success = onLogin(username, password);
    if (!success) {
      setError('Invalid username or password credentials.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="glass-panel p-8 rounded-3xl w-full max-w-md space-y-6 shadow-2xl border border-slate-700/60">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 mx-auto flex items-center justify-center text-white shadow-xl shadow-indigo-500/40">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">De Natura Admin</h2>
          <p className="text-xs text-slate-400">Sign in to access your Personal Finance Assistant</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1.5">Username:</label>
            <input
              type="text"
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1.5">Password:</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {error && (
            <p className="text-xs font-semibold text-rose-400 text-center">{error}</p>
          )}

          <button
            type="submit"
            className="w-full py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" /> Authenticate &amp; Access Admin
          </button>
        </form>
      </div>
    </div>
  );
};
