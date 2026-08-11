import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import EmployeeDashboard from './components/EmployeeDashboard';

function getStoredRole(): string | null {
  try {
    return sessionStorage.getItem('userRole') || localStorage.getItem('userRole');
  } catch (e) {
    return null;
  }
}

function AuthGuard({ children, requireRole }: { children: React.ReactNode, requireRole?: string }) {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const localRole = localStorage.getItem('userRole');
      if (localRole && !sessionStorage.getItem('userRole')) {
        sessionStorage.setItem('userRole', localRole);
        sessionStorage.setItem('userEmail', localStorage.getItem('userEmail') || '');
        sessionStorage.setItem('userName', localStorage.getItem('userName') || '');
        sessionStorage.setItem('userEmpId', localStorage.getItem('userEmpId') || '');
      }
    } catch (e) {
      console.error('Session sync error:', e);
    }

    const role = getStoredRole();

    if (!role) {
      navigate('/login', { replace: true });
      return;
    }

    if (requireRole) {
      if (requireRole === 'Admin' && role !== 'Admin') {
        navigate('/employee', { replace: true });
        return;
      }
      if (requireRole === 'Employee' && role !== 'Employee') {
        navigate('/admin', { replace: true });
        return;
      }
    }
    setReady(true);
  }, [navigate, requireRole]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center font-sans">
        <div className="flex items-center gap-3 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
          <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-semibold text-slate-300">Loading De Natura Workspace...</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function RootRedirect() {
  const role = getStoredRole();
  if (role === 'Admin') return <Navigate to="/admin" replace />;
  if (role === 'Employee') return <Navigate to="/employee" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<AuthGuard requireRole="Admin"><AdminDashboard /></AuthGuard>} />
        <Route path="/employee" element={<AuthGuard requireRole="Employee"><EmployeeDashboard /></AuthGuard>} />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
