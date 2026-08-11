import { useState, useEffect } from 'react';
import { Search, RefreshCw, Users, Phone, MapPin, Briefcase, Calendar, IndianRupee, FileSpreadsheet } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { OFFICIAL_STAFF_REGISTRY } from '../constants/staffRegistry';

interface EmployeeRow {
  uid: string;
  name: string;
  designation: string;
  department: string;
  email: string;
  phone: string;
  emergencyContact: string;
  address: string;
  fixedSalary: number;
  joiningDate: string;
  empId: string;
}

export default function EmployeeDirectory() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<keyof EmployeeRow>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      // Try to load from Firestore Users collection (has profile details)
      const snap = await getDocs(collection(db, 'Users'));
      const firestoreMap = new Map<string, any>();
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.email) firestoreMap.set(data.email.toLowerCase(), { uid: d.id, ...data });
      });

      // Also fetch EmployeeProfiles for extended details
      const profileSnap = await getDocs(collection(db, 'EmployeeProfiles'));
      const profileMap = new Map<string, any>();
      profileSnap.docs.forEach(d => {
        const data = d.data();
        if (data.email) profileMap.set(data.email.toLowerCase(), data);
        else if (data.uid) profileMap.set(data.uid, data);
      });

      // Merge registry + Firestore + Profiles
      const merged: EmployeeRow[] = OFFICIAL_STAFF_REGISTRY.map(reg => {
        const fs = firestoreMap.get(reg.email.toLowerCase()) || {};
        // Check aliases too
        let profile: any = profileMap.get(reg.email.toLowerCase()) || {};
        if (!profile.phone) {
          for (const alias of (reg.aliases || [])) {
            const aliasProfile = profileMap.get(alias.toLowerCase() + '@gmail.com') || profileMap.get(alias.toLowerCase());
            if (aliasProfile?.phone) { profile = aliasProfile; break; }
          }
        }

        return {
          uid: fs.uid || reg.empId,
          empId: reg.empId,
          name: fs.name || reg.name,
          designation: fs.role || reg.role,
          department: fs.department || reg.department,
          email: reg.email,
          phone: profile.phone || fs.phone || '—',
          emergencyContact: profile.emergencyContact || profile.emergency_contact || fs.emergencyContact || '—',
          address: profile.address || fs.address || '—',
          fixedSalary: fs.basicSalary || reg.basicSalary || 0,
          joiningDate: fs.joiningDate || reg.joiningDate || '—',
        };
      });

      setEmployees(merged);
    } catch (e) {
      console.error(e);
      // Fallback to registry only
      setEmployees(OFFICIAL_STAFF_REGISTRY.map(reg => ({
        uid: reg.empId,
        empId: reg.empId,
        name: reg.name,
        designation: reg.role,
        department: reg.department,
        email: reg.email,
        phone: '—',
        emergencyContact: '—',
        address: '—',
        fixedSalary: reg.basicSalary,
        joiningDate: reg.joiningDate,
      })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchEmployees(); }, []);

  const handleSort = (key: keyof EmployeeRow) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const filtered = employees.filter(e =>
    [e.name, e.designation, e.department, e.email, e.phone, e.address]
      .join(' ').toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    const av = String(a[sortKey] || '').toLowerCase();
    const bv = String(b[sortKey] || '').toLowerCase();
    return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  const exportToExcel = () => {
    const data = sorted.map(e => ({
      'Emp ID': e.empId,
      'Name': e.name,
      'Designation': e.designation,
      'Department': e.department,
      'Email': e.email,
      'Phone (Primary)': e.phone,
      'Emergency Contact': e.emergencyContact,
      'Address': e.address,
      'Fixed Salary (₹)': e.fixedSalary,
      'Date of Joining': e.joiningDate,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    // Column widths
    ws['!cols'] = [
      { wch: 10 }, { wch: 22 }, { wch: 26 }, { wch: 24 },
      { wch: 28 }, { wch: 18 }, { wch: 22 }, { wch: 36 },
      { wch: 18 }, { wch: 16 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employee Directory');
    XLSX.writeFile(wb, 'DE_NATURA_Employee_Directory_' + new Date().toISOString().split('T')[0] + '.xlsx');
  };

  const SortHeader = ({ label, col }: { label: string; col: keyof EmployeeRow }) => (
    <th
      onClick={() => handleSort(col)}
      className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 cursor-pointer hover:text-white transition select-none whitespace-nowrap"
    >
      <span className="flex items-center gap-1">
        {label}
        {sortKey === col && (
          <span className="text-cyan-400">{sortDir === 'asc' ? '↑' : '↓'}</span>
        )}
      </span>
    </th>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center border border-teal-500/20">
              <Users size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Employee Directory</h2>
              <p className="text-xs text-slate-400">All employee details — download as Excel for HR records</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchEmployees}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
            <button
              onClick={exportToExcel}
              disabled={sorted.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition disabled:opacity-50"
            >
              <FileSpreadsheet size={15} />
              Export Excel ({sorted.length})
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Users, label: 'Total Staff', value: employees.length, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
            { icon: Briefcase, label: 'Departments', value: new Set(employees.map(e => e.department)).size, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
            { icon: IndianRupee, label: 'Avg. Salary', value: '₹' + (employees.reduce((s, e) => s + e.fixedSalary, 0) / Math.max(1, employees.length)).toLocaleString('en-IN', { maximumFractionDigits: 0 }), color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
            { icon: Phone, label: 'With Contact', value: employees.filter(e => e.phone !== '—').length, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className={'flex items-center gap-3 p-3 rounded-xl border ' + color.split(' ').slice(1).join(' ')}>
              <Icon size={18} className={color.split(' ')[0]} />
              <div>
                <p className="text-xs text-slate-400">{label}</p>
                <p className="text-sm font-bold text-white">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Search + Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800/80">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by name, role, department, phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-teal-500 transition"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center flex flex-col items-center gap-3 text-slate-400">
            <RefreshCw size={24} className="animate-spin text-teal-400" />
            Loading employee data...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-900/80 border-b border-slate-800">
                <tr>
                  <SortHeader label="Emp ID" col="empId" />
                  <SortHeader label="Name" col="name" />
                  <SortHeader label="Designation" col="designation" />
                  <SortHeader label="Department" col="department" />
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                    <span className="flex items-center gap-1"><Phone size={11} /> Phone</span>
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                    <span className="flex items-center gap-1"><Phone size={11} /> Emergency</span>
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                    <span className="flex items-center gap-1"><MapPin size={11} /> Address</span>
                  </th>
                  <SortHeader label="Fixed Salary" col="fixedSalary" />
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                    <span className="flex items-center gap-1"><Calendar size={11} /> Joined</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {sorted.map(emp => (
                  <tr key={emp.uid} className="hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3 font-mono text-[10px] text-slate-500 whitespace-nowrap">{emp.empId}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center font-bold text-[10px] text-white flex-shrink-0">
                          {emp.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-white">{emp.name}</p>
                          <p className="text-[10px] text-slate-500">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{emp.designation}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 whitespace-nowrap">
                        {emp.department}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{emp.phone}</td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{emp.emergencyContact}</td>
                    <td className="px-4 py-3 text-slate-400 max-w-[180px]">
                      <span className="truncate block" title={emp.address}>{emp.address}</span>
                    </td>
                    <td className="px-4 py-3 text-emerald-400 font-bold whitespace-nowrap">
                      ₹{emp.fixedSalary.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{emp.joiningDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sorted.length === 0 && (
              <div className="p-8 text-center text-slate-500 text-sm">No employees match your search.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
