import { useState } from 'react';


import { useNavigate } from 'react-router-dom';
import { getStaffByInput } from '../constants/staffRegistry';
import { Activity, ShieldCheck, Sparkles, ArrowRight, Lock, Mail } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const inputVal = (email || '').trim();
      const staffObj = getStaffByInput(inputVal);
      if (!staffObj) {
        setError('Invalid Username or Email ID. Please check your credentials.');
        setLoading(false);
        return;
      }
      const isAdmin = !!staffObj.isAdmin || inputVal.includes('admin') || inputVal.includes('chanthuvs');
      const userRole = isAdmin ? 'Admin' : 'Employee';

      // Clear any previous session/local storage to prevent cross-account leaks
      sessionStorage.clear();
      localStorage.removeItem('userEmpId');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('userRole');
      localStorage.removeItem('userName');

      // Store current authenticated user session
      sessionStorage.setItem('userEmpId', staffObj.empId);
      sessionStorage.setItem('userEmail', staffObj.email);
      sessionStorage.setItem('userRole', userRole);
      sessionStorage.setItem('userName', staffObj.name);

      localStorage.setItem('userEmpId', staffObj.empId);
      localStorage.setItem('userEmail', staffObj.email);
      localStorage.setItem('userRole', userRole);
      localStorage.setItem('userName', staffObj.name);

      if (userRole === 'Admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/employee', { replace: true });
      }
    } catch (err: any) {
      setError('Login error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className='min-h-screen bg-slate-950 flex relative overflow-hidden selection:bg-cyan-500 selection:text-white'>
      {/* Background Decorative Glows */}
      <div className='absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none' />
      <div className='absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none' />
      <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-3xl pointer-events-none' />

      <div className='w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 min-h-screen z-10'>
        {/* Left Side: Branding Hero */}
        <div className='lg:col-span-7 flex flex-col justify-between p-8 lg:p-16 border-r border-slate-800/40 relative'>
          <div>
            <div className='flex items-center gap-3 mb-12'>
              <div className='w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/25'>
                <Activity className='w-6 h-6 text-white' />
              </div>
              <div>
                <span className='text-xl font-extrabold tracking-tight text-white'>DE NATURA</span>
                <span className='block text-[10px] font-semibold tracking-widest text-cyan-400 uppercase'>Clinic & Aesthetic Care</span>
              </div>
            </div>

            <div className='space-y-6 max-w-xl'>
              <div className='inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold'>
                <Sparkles size={14} /> AI-Powered Clinic Management System
              </div>
              <h1 className='text-4xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight'>
                Empowering Exceptional <span className='gradient-text'>Healthcare & HR</span>
              </h1>
              <p className='text-slate-400 text-lg leading-relaxed'>
                Streamline daily clinic income, automated LOP payroll calculations, employee leave approvals, and AI-driven profitability analytics in one unified platform.
              </p>
            </div>
          </div>

          <div className='grid grid-cols-3 gap-6 pt-12 border-t border-slate-800/60 mt-12'>
            <div>
              <p className='text-2xl font-extrabold text-white'>100%</p>
              <p className='text-xs text-slate-400 font-medium mt-0.5'>Automated Payroll</p>
            </div>
            <div>
              <p className='text-2xl font-extrabold text-cyan-400'>1-Click</p>
              <p className='text-xs text-slate-400 font-medium mt-0.5'>PDF Generation</p>
            </div>
            <div>
              <p className='text-2xl font-extrabold text-indigo-400'>AI Insights</p>
              <p className='text-xs text-slate-400 font-medium mt-0.5'>Treatment Pricing</p>
            </div>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className='lg:col-span-5 flex items-center justify-center p-8 lg:p-12'>
          <div className='w-full max-w-md glass-panel p-8 lg:p-10 rounded-2xl shadow-2xl relative border border-slate-800'>
            <div className='mb-8'>
              <h2 className='text-2xl font-bold text-white tracking-tight'>Sign in to your account</h2>
              <p className='text-xs text-slate-400 mt-1'>Enter your clinic credentials to access your dashboard.</p>
            </div>

            {error && (
              <div className='mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium flex items-center gap-2'>
                <ShieldCheck className='w-4 h-4 flex-shrink-0' />
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className='space-y-5'>
              <div>
                <label className='block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2'>User Name / Employee Email ID</label>
                <div className='relative'>
                  <Mail className='w-5 h-5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2' />
                  <input
                    type='text'
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className='w-full pl-11 pr-4 py-3 bg-slate-900/80 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-sm transition-all'
                    placeholder='Username or email'
                    required
                  />
                </div>
              </div>

              <div>
                <label className='block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2'>Password</label>
                <div className='relative'>
                  <Lock className='w-5 h-5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2' />
                  <input
                    type='password'
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className='w-full pl-11 pr-4 py-3 bg-slate-900/80 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-sm transition-all'
                    placeholder='••••••••'
                    required
                  />
                </div>
              </div>

              <button
                type='submit'
                disabled={loading}
                className='w-full py-3.5 px-4 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/35 transition-all flex items-center justify-center gap-2 group disabled:opacity-50'
              >
                {loading ? 'Authenticating...' : 'Sign In to Workspace'}
                {!loading && <ArrowRight size={18} className='group-hover:translate-x-1 transition-transform' />}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
