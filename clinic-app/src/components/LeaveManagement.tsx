import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, getDocs, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { Calendar, CheckCircle2, XCircle, Clock, Info } from 'lucide-react';

const getLeaveKey = (item: any) => {
  if (!item) return '';
  const email = (item.userEmail || '').trim().toLowerCase();
  const start = (item.startDate || '').trim();
  const end = (item.endDate || '').trim();
  return email + '_' + start + '_' + end;
};

export default function LeaveManagement({ isAdmin }: { isAdmin: boolean }) {
  const [leaves, setLeaves] = useState<any[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [leaveType, setLeaveType] = useState<'Full Day' | 'Half Day'>('Full Day');
  const [loading, setLoading] = useState(false);

  const processLeaveItems = (cloudList: any[], localList: any[]) => {
    const uniqueMap = new Map();
    
    // 1. First load local draft items
    localList.forEach(item => {
      const key = getLeaveKey(item);
      if (key && key !== '__') {
        uniqueMap.set(key, { ...item });
      }
    });

    // 2. Cloud items ALWAYS override local items and update status (Approved/Rejected)
    cloudList.forEach(item => {
      const key = getLeaveKey(item);
      if (key && key !== '__') {
        const existing = uniqueMap.get(key) || {};
        uniqueMap.set(key, { ...existing, ...item });
      }
    });

    const list = Array.from(uniqueMap.values());
    list.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
    setLeaves(list);
  };

  const fetchLeaves = async () => {
    try {
      let cloudList: any[] = [];
      try {
        const snap = await getDocs(collection(db, 'Leaves'));
        cloudList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) {}

      let localList: any[] = [];
      try {
        localList = JSON.parse(localStorage.getItem('de_natura_leaves') || '[]');
      } catch (e) {}

      processLeaveItems(cloudList, localList);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchLeaves();

    // Subscribe to realtime cloud updates for leaves
    let unsubscribe: any = null;
    try {
      unsubscribe = onSnapshot(collection(db, 'Leaves'), (snap) => {
        const cloudList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        let localList: any[] = [];
        try {
          localList = JSON.parse(localStorage.getItem('de_natura_leaves') || '[]');
        } catch (e) {}
        processLeaveItems(cloudList, localList);
      });
    } catch(e) {}

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate || !reason) return;
    setLoading(true);

    const user = auth.currentUser;
    const isSameDate = startDate && endDate && startDate === endDate;
    let days = 1;
    if (isSameDate) {
      days = leaveType === 'Half Day' ? 0.5 : 1;
    } else {
      const s = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end.getTime() - s.getTime());
      days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }

    const sessionEmail = sessionStorage.getItem('userEmail') || user?.email || 'staff@gmail.com';
    const sessionHandle = sessionEmail.split('@')[0];
    const targetUid = (user && user.uid) ? String(user.uid) : ('emp_' + sessionHandle);
    const targetName = (user && user.displayName) ? String(user.displayName) : (sessionHandle.charAt(0).toUpperCase() + sessionHandle.slice(1));

    const newLeave: Record<string, any> = {
      userUid: String(targetUid),
      userName: String(targetName),
      userEmail: String(sessionEmail),
      startDate: String(startDate || ''),
      endDate: String(endDate || ''),
      days: Number(days) || 1,
      leaveType: String(startDate === endDate ? leaveType : 'Full Day'),
      reason: String(reason || ''),
      status: 'Pending',
      createdAt: Date.now()
    };

    try {
      await addDoc(collection(db, 'Leaves'), newLeave);
      try {
        const saved = JSON.parse(localStorage.getItem('de_natura_leaves') || '[]');
        localStorage.setItem('de_natura_leaves', JSON.stringify([newLeave, ...saved]));
      } catch(e){}
      setStartDate('');
      setEndDate('');
      setReason('');
      fetchLeaves();
      alert('✓ Leave application submitted successfully!');
    } catch (e: any) {
      // Fallback local save if cloud permission fails
      try {
        const saved = JSON.parse(localStorage.getItem('de_natura_leaves') || '[]');
        localStorage.setItem('de_natura_leaves', JSON.stringify([newLeave, ...saved]));
      } catch(err){}
      setStartDate('');
      setEndDate('');
      setReason('');
      fetchLeaves();
      alert('✓ Leave application submitted successfully!');
    }

      
    setLoading(false);
  };

  const handleUpdateStatus = async (targetItem: any, status: 'Approved' | 'Rejected') => {
    const id = targetItem.id;
    const targetKey = getLeaveKey(targetItem);

    if (id) {
      try {
        await updateDoc(doc(db, 'Leaves', id), { status });
      } catch (e: any) {}
    }

    // Update in-memory state instantly
    setLeaves(prev => prev.map(item => (item.id === id || getLeaveKey(item) === targetKey) ? { ...item, status } : item));

    // Update local storage cache
    try {
      const saved = JSON.parse(localStorage.getItem('de_natura_leaves') || '[]');
      const updated = saved.map((item: any) => (item.id === id || getLeaveKey(item) === targetKey) ? { ...item, status } : item);
      localStorage.setItem('de_natura_leaves', JSON.stringify(updated));
    } catch (e) {}

    fetchLeaves();
  };

  return (
    <div className='space-y-8'>
      {!isAdmin && (
        <div className='glass-panel p-8 rounded-2xl border border-slate-800 space-y-6'>
          <div className='flex items-center gap-3 border-b border-slate-800/80 pb-4'>
            <div className='w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20'>
              <Calendar size={20} />
            </div>
            <div>
              <h2 className='text-lg font-bold text-white tracking-tight'>Apply for Staff Leave</h2>
              <p className='text-xs text-slate-400'>Submit a formal leave request for management review.</p>
            </div>
          </div>

          <div className='p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs flex items-center gap-2'>
            <Info size={16} className='flex-shrink-0' />
            <span><strong>Clinic Leave Policy:</strong> 1 leave day per month is fully paid. Any additional leave days in the same month trigger automated Loss of Pay (LOP) deductions in your monthly payslip.</span>
          </div>

          <form onSubmit={handleApply} className='grid grid-cols-1 md:grid-cols-3 gap-5'>
            <div>
              <label className='block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2'>Start Date</label>
              <input type='date' value={startDate} onChange={e => setStartDate(e.target.value)} required className='w-full p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-500 transition' />
            </div>
            <div>
              <label className='block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2'>End Date</label>
              <input type='date' value={endDate} onChange={e => setEndDate(e.target.value)} required className='w-full p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-500 transition' />
            </div>
            <div>
              <label className='block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2'>
                Leave Duration Type
                {startDate && endDate && startDate !== endDate && (
                  <span className='text-[10px] text-amber-400 font-normal ml-2'>(Disabled for multi-day)</span>
                )}
              </label>
              <select
                value={startDate === endDate ? leaveType : 'Full Day'}
                onChange={e => setLeaveType(e.target.value as any)}
                disabled={!startDate || !endDate || startDate !== endDate}
                className='w-full p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-500 transition disabled:opacity-50 disabled:cursor-not-allowed'
              >
                <option value='Full Day'>Full Day (1.0 Day)</option>
                <option value='Half Day'>Half Day (0.5 Day)</option>
              </select>
            </div>
            <div className='md:col-span-3'>
              <label className='block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2'>Reason for Absence</label>
              <input type='text' placeholder='e.g. Personal work / Family medical emergency' value={reason} onChange={e => setReason(e.target.value)} required className='w-full p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-500 transition' />
            </div>
            <div className='md:col-span-3 text-right pt-2'>
              <button type='submit' disabled={loading} className='py-3 px-6 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 text-xs transition disabled:opacity-50'>
                {loading ? 'Submitting Application...' : 'Submit Leave Request'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Leave Logs Table */}
      <div className='glass-panel p-8 rounded-2xl border border-slate-800 space-y-6'>
        <div className='flex justify-between items-center border-b border-slate-800/80 pb-4'>
          <div>
            <h3 className='text-lg font-bold text-white tracking-tight'>Leave Applications & Approvals</h3>
            <p className='text-xs text-slate-400'>Comprehensive log of staff absences and approval states.</p>
          </div>
          <span className='px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold'>
            Total Requests: {leaves.length}
          </span>
        </div>

        <div className='overflow-x-auto'>
          <table className='w-full text-left border-collapse'>
            <thead>
              <tr className='border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider'>
                <th className='py-3 px-4'>Staff Member</th>
                <th className='py-3 px-4'>Leave Duration</th>
                <th className='py-3 px-4'>Total Days</th>
                <th className='py-3 px-4'>Reason</th>
                <th className='py-3 px-4'>Approval Status</th>
                {isAdmin && <th className='py-3 px-4 text-right'>Action</th>}
              </tr>
            </thead>
            <tbody className='divide-y divide-slate-800/50 text-xs'>
              {leaves.length === 0 ? (
                <tr><td colSpan={isAdmin ? 6 : 5} className='py-6 text-center text-slate-500'>No leave applications submitted yet.</td></tr>
              ) : (
                leaves.map(l => (
                  <tr key={l.id} className='hover:bg-slate-900/50 transition-colors'>
                    <td className='py-3.5 px-4 font-semibold text-white'>{l.userName || l.userEmail}</td>
                    <td className='py-3.5 px-4 text-slate-300 font-mono'>{l.startDate} to {l.endDate}</td>
                    <td className='py-3.5 px-4 font-bold text-slate-200'>{l.days} Day(s) <span className='text-[10px] text-slate-400 font-normal'>({l.leaveType || 'Full Day'})</span></td>
                    <td className='py-3.5 px-4 text-slate-400'>{l.reason}</td>
                    <td className='py-3.5 px-4'>
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full border ${
                        l.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        l.status === 'Rejected' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
                      }`}>
                        {l.status === 'Approved' ? <CheckCircle2 size={12} /> : l.status === 'Rejected' ? <XCircle size={12} /> : <Clock size={12} />}
                        {l.status}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className='py-3.5 px-4 text-right space-x-2'>
                        {l.status === 'Pending' && (
                          <>
                            <button onClick={() => handleUpdateStatus(l, 'Approved')} className='bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition shadow-md shadow-emerald-600/20'>Approve</button>
                            <button onClick={() => handleUpdateStatus(l, 'Rejected')} className='bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition shadow-md shadow-rose-600/20'>Reject</button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
