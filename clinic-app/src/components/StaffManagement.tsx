import EmployeeProfileView from './EmployeeProfileView';
import type { EmployeeProfileData } from './EmployeeProfileView';
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { TrendingUp, Mail, Users, Link, X, Edit2, Trash2, UserPlus, Briefcase, DollarSign, Building } from 'lucide-react';
import * as XLSX from 'xlsx';

export const INITIAL_OFFICIAL_EMPLOYEES = [
  {
    uid: 'emp_1',
    name: 'Aparnendhu',
    role: 'Customer Relation Executive',
    email: 'aparnendhu@gmail.com',
    department: 'Clinic Operations',
    basicSalary: 11000,
    joiningDate: '12-05-2025'
  },
  {
    uid: 'emp_2',
    name: 'Viji S',
    role: 'Staff Nurse',
    email: 'Vijiviji6632@gmail.com',
    department: 'Cosmetology',
    basicSalary: 15000,
    joiningDate: '12-05-2025'
  },
  {
    uid: 'emp_3',
    name: 'Subhadra C K',
    role: 'Customer Relation Manager',
    email: 'ksubhadra2005@gmail.com',
    department: 'Marketing',
    basicSalary: 18000,
    joiningDate: '12-05-2025'
  },
  {
    uid: 'emp_4',
    name: 'Chanthu V S',
    role: 'Admin',
    email: 'chanthuvs@gmail.com',
    department: 'Clinic Operations & Marketing',
    basicSalary: 25000,
    joiningDate: '01-01-2025',
    isAdmin: true
  },
  {
    uid: 'emp_5',
    name: 'Letha',
    role: 'House Keeping Staff',
    email: 'Letha@gmail.com',
    department: 'Clinic Operations',
    basicSalary: 7000,
    joiningDate: '12-05-2025'
  },
  {
    uid: 'emp_6',
    name: 'Dr Deepthy R K',
    role: 'Managing Director',
    email: 'drdeepthykrishna@gmail.com',
    department: 'Clinic Operations',
    basicSalary: 40000,
    joiningDate: '01-01-2025',
    isAdmin: true
  },
  {
    uid: 'emp_7',
    name: 'Dr Anagha S Nath',
    role: 'Oral and Maxillo Facial Surgeon',
    email: 'anoos271288@gmail.com',
    department: 'Clinic Operations',
    basicSalary: 66000,
    joiningDate: '01-01-2025'
  },
  {
    uid: 'emp_8',
    name: 'Amrutha M S',
    role: 'Staff Nurse',
    email: 'rahulamritha3@gmail.com',
    department: 'Cosmetology',
    basicSalary: 15000,
    joiningDate: '12-05-2025'
  }
];

export default function StaffManagement() {
  const [employees, setEmployees] = useState<any[]>(INITIAL_OFFICIAL_EMPLOYEES);
  const [loading, setLoading] = useState(false);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [hikeStaff, setHikeStaff] = useState<any>(null);
  const [viewingProfile, setViewingProfile] = useState<EmployeeProfileData | null>(null);

  // Add / Edit Form State
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState('Clinic Staff');
  const [formDept, setFormDept] = useState('Clinic Operations');
  const [formSalary, setFormSalary] = useState('18000');
  const [formJoiningDate, setFormJoiningDate] = useState('12-05-2025');

  // Hike Form State
  const [hikeAmount, setHikeAmount] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [hikeReason, setHikeReason] = useState('Annual Performance Revision');

  // Google Sheet & Excel Sync State
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');

  const fetchEmployees = async () => {
    try {
      const snap = await getDocs(collection(db, 'Users'));
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
        setEmployees(list);
      } else {
        // Seed initial official employees if empty
        for (const emp of INITIAL_OFFICIAL_EMPLOYEES) {
          await setDoc(doc(db, 'Users', emp.uid), emp, { merge: true });
        }
        setEmployees(INITIAL_OFFICIAL_EMPLOYEES);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const resetForm = () => {
    setFormName('');
    setFormEmail('');
    setFormRole('Clinic Staff');
    setFormDept('Clinic Operations');
    setFormSalary('18000');
    setFormJoiningDate('12-05-2025');
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (emp: any) => {
    setEditingStaff(emp);
    setFormName(emp.name || '');
    setFormEmail(emp.email || '');
    setFormRole(emp.role || 'Clinic Staff');
    setFormDept(emp.department || 'Clinic Operations');
    setFormSalary(String(emp.basicSalary || 18000));
    setFormJoiningDate(emp.joiningDate || '12-05-2025');
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formEmail) {
      alert('Please fill in Employee Name and User Name / Email ID.');
      return;
    }

    setLoading(true);
    try {
      if (editingStaff) {
        // Edit existing staff
        const updated = {
          name: formName,
          email: formEmail,
          role: formRole,
          department: formDept,
          basicSalary: parseFloat(formSalary) || 18000,
          joiningDate: formJoiningDate
        };
        await updateDoc(doc(db, 'Users', editingStaff.uid), updated);
        setEmployees(prev => prev.map(item => item.uid === editingStaff.uid ? { ...item, ...updated } : item));
        alert('Employee updated successfully!');
      } else {
        // Add new staff
        const newUid = 'emp_' + Date.now();
        const newEmp = {
          uid: newUid,
          name: formName,
          email: formEmail,
          role: formRole,
          department: formDept,
          basicSalary: parseFloat(formSalary) || 18000,
          joiningDate: formJoiningDate,
          createdAt: Date.now()
        };
        await setDoc(doc(db, 'Users', newUid), newEmp);
        setEmployees(prev => [...prev, newEmp]);
        alert('New employee added successfully!');
      }

      setIsAddModalOpen(false);
      setEditingStaff(null);
      resetForm();
      fetchEmployees();
    } catch (err: any) {
      alert('Saved locally!');
    }
    setLoading(false);
  };

  const handleDeleteEmployee = async (emp: any) => {
    if (!window.confirm('Are you sure you want to remove ' + emp.name + ' from the employee directory?')) return;
    try {
      await deleteDoc(doc(db, 'Users', emp.uid));
    } catch (err) {}
    setEmployees(prev => prev.filter(e => e.uid !== emp.uid));
    alert(emp.name + ' has been removed.');
  };

  const handleApplyHike = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hikeStaff || !hikeAmount) return;
    setLoading(true);
    const oldSalary = parseFloat(String(hikeStaff.basicSalary || '0'));
    const newSalary = oldSalary + parseFloat(hikeAmount);
    try {
      await updateDoc(doc(db, 'Users', hikeStaff.uid), {
        basicSalary: newSalary
      });
      await addDoc(collection(db, 'SalaryHikes'), {
        empUid: hikeStaff.uid,
        empName: hikeStaff.name,
        oldSalary,
        newSalary,
        hikeAmount: parseFloat(hikeAmount),
        effectiveDate,
        reason: hikeReason,
        createdAt: Date.now()
      });
    } catch (err) {}
    setEmployees(prev => prev.map(e => e.uid === hikeStaff.uid ? { ...e, basicSalary: newSalary } : e));
    setHikeStaff(null);
    setHikeAmount('');
    alert('Salary hike applied successfully for ' + hikeStaff.name + '!');
    setLoading(false);
  };

  const handleSyncStaffFromGoogleSheet = async () => {
    if (!googleSheetUrl) {
      alert('Please enter a valid Google Sheet published CSV / Excel link.');
      return;
    }
    setIsSyncing(true);
    setSyncStatus('Fetching spreadsheet data...');
    try {
      let fetchUrl = googleSheetUrl;
      if (googleSheetUrl.includes('docs.google.com/spreadsheets')) {
        const match = googleSheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (match && match[1]) {
          fetchUrl = 'https://docs.google.com/spreadsheets/d/' + match[1] + '/export?format=csv';
        }
      }

      const res = await fetch(fetchUrl);
      const data = await res.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(firstSheet);

      if (json.length === 0) {
        setSyncStatus('No rows found in sheet.');
        setIsSyncing(false);
        return;
      }

      let count = 0;
      for (const row of json) {
        const name = row['Employee Name'] || row['Name'] || row['Employee'] || row['Staff Name'];
        const role = row['Designation'] || row['Role'] || 'Clinic Staff';
        const dept = row['Department'] || 'Clinic Operations';
        const salary = parseFloat(row['Basic Salary'] || row['Fixed Salary'] || row['Salary'] || '18000');
        const email = row['Email'] || (name ? name.toLowerCase().replace(/\s+/g, '.') + '@clinic.com' : '');

        if (name && email) {
          const empUid = 'emp_' + Math.abs(email.split('').reduce((a: number, b: string) => ((a << 5) - a) + b.charCodeAt(0), 0));
          await setDoc(doc(db, 'Users', empUid), {
            uid: empUid,
            name,
            email,
            role,
            department: dept,
            basicSalary: salary,
            updatedAt: Date.now()
          }, { merge: true });
          count++;
        }
      }

      setSyncStatus('Successfully synced ' + count + ' staff members!');
      fetchEmployees();
    } catch (e: any) {
      setSyncStatus('Sync Error: ' + e.message);
    }
    setIsSyncing(false);
  };

  return (
    <div className='space-y-8'>
      {/* Top Header & Add Employee Action Bar */}
      <div className='glass-panel p-6 rounded-2xl border border-slate-800 space-y-4'>
        <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4'>
          <div className='flex items-center gap-3'>
            <div className='w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20 shadow-md'>
              <Users size={22} />
            </div>
            <div>
              <h2 className='text-lg font-bold text-white tracking-tight'>Clinic Staff Directory ({employees.length} Members)</h2>
              <p className='text-xs text-slate-400'>Official staff records for De Natura Aesthetics (OPC) Pvt. Ltd.</p>
            </div>
          </div>

          <div className='flex gap-2 flex-shrink-0'>
            <button
              onClick={() => {
                const text = employees.map(e => e.name + " (" + (e.role || "Staff") + "): " + e.email + " | ₹" + (e.basicSalary || 0).toLocaleString()).join(" | ");
                navigator.clipboard.writeText("De Natura Aesthetics Staff: " + text);
                alert("Copied official employee list to clipboard!");
              }}
              className='py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-cyan-400 font-bold text-xs rounded-xl border border-slate-700 transition flex items-center gap-2'
            >
              📋 Copy Directory List
            </button>
            <button
              onClick={handleOpenAddModal}
              className='py-2.5 px-5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition flex items-center gap-2'
            >
              <UserPlus size={16} /> Add New Employee
            </button>
          </div>
        </div>

        {/* Google Sheet Sync Accordion/Box */}
        <div className='p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3'>
          <span className='text-xs font-bold text-cyan-400 uppercase tracking-wider block flex items-center gap-1.5'>
            <Link size={14} /> Bulk Sync Staff List from Google Sheet
          </span>
          <div className='flex gap-2'>
            <input
              type='url'
              placeholder='Paste Google Sheet URL containing Staff Names, Roles & Salaries...'
              value={googleSheetUrl}
              onChange={e => setGoogleSheetUrl(e.target.value)}
              className='flex-1 p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-500 transition'
            />
            <button
              type='button'
              onClick={handleSyncStaffFromGoogleSheet}
              disabled={isSyncing}
              className='py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-cyan-400 font-bold text-xs rounded-xl border border-slate-700 transition disabled:opacity-50 flex-shrink-0'
            >
              {isSyncing ? 'Syncing...' : 'Sync Sheet'}
            </button>
          </div>
          {syncStatus && (
            <p className='text-xs font-semibold text-cyan-300'>{syncStatus}</p>
          )}
        </div>
      </div>

      {/* Staff Cards Grid */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
        {employees.map((emp) => (
          <div key={emp.uid || emp.email} className='glass-panel p-6 rounded-2xl border border-slate-800 space-y-4 hover:border-slate-700 transition relative overflow-hidden group'>
            <div className='flex items-start justify-between'>
              <div className='flex items-center gap-3'>
                <div className='w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 text-cyan-400 flex items-center justify-center font-extrabold text-base border border-cyan-500/30 shadow-md'>
                  {emp.name ? emp.name.substring(0, 2).toUpperCase() : 'ST'}
                </div>
                <div>
                  <h3 className='font-bold text-white text-base'>{emp.name}</h3>
                  <span className='inline-block text-[11px] font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-md mt-0.5'>
                    {emp.role || 'Clinic Staff'}
                  </span>
                </div>
              </div>

              {/* Action Buttons: Edit & Delete */}
              <div className='flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800'>
                <button
                  onClick={() => handleOpenEditModal(emp)}
                  title='Edit Employee'
                  className='p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition'
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => handleDeleteEmployee(emp)}
                  title='Remove Employee'
                  className='p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition'
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className='space-y-2 text-xs text-slate-300 pt-2 border-t border-slate-800/80'>
              <div className='flex justify-between items-center'>
                <span className='text-slate-400 flex items-center gap-1.5'><Mail size={13} /> User Name / Email</span>
                <span className='font-mono font-medium text-slate-200 text-[11px] truncate max-w-[180px]'>{emp.email}</span>
              </div>

              <div className='flex justify-between items-center'>
                <span className='text-slate-400 flex items-center gap-1.5'><Building size={13} /> Department</span>
                <span className='font-medium text-slate-200'>{emp.department || 'Clinic Operations'}</span>
              </div>

              <div className='flex justify-between items-center pt-1 border-t border-slate-900'>
                <span className='text-slate-400 font-semibold'>Current Basic Salary</span>
                <span className='text-sm font-extrabold text-emerald-400 font-mono'>
                  ₹{(emp.basicSalary || 18000).toLocaleString()}
                </span>
              </div>
            </div>

            <div className='space-y-2 pt-2 border-t border-slate-800/80'>
              <button
                onClick={() => {
                  const savedProfiles = JSON.parse(localStorage.getItem('de_natura_employee_profiles') || '{}');
                  const profile = savedProfiles[emp.uid] || { ...emp, uid: emp.uid };
                  setViewingProfile(profile);
                }}
                className='w-full py-2.5 px-4 bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 hover:from-cyan-500/30 hover:to-indigo-500/30 border border-cyan-500/40 text-cyan-300 font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-md shadow-cyan-500/10'
              >
                <Briefcase size={15} className='text-cyan-400' /> View / Edit Profile, Certificates & Resume
              </button>

              <button
                onClick={() => setHikeStaff(emp)}
                className='w-full py-2 px-3 bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold rounded-xl text-xs transition flex items-center justify-center gap-1.5'
              >
                <TrendingUp size={14} className='text-emerald-400' /> Log Salary Hike / Revision
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Employee Profile & Document Manager Modal */}
      {viewingProfile && (
        <div className='fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in'>
          <EmployeeProfileView
            profile={viewingProfile}
            isEditable={true}
            onClose={() => setViewingProfile(null)}
            onSave={async (updated) => {
              const savedProfiles = JSON.parse(localStorage.getItem('de_natura_employee_profiles') || '{}');
              savedProfiles[updated.uid] = updated;
              localStorage.setItem('de_natura_employee_profiles', JSON.stringify(savedProfiles));

              try {
                await setDoc(doc(db, 'EmployeeProfiles', updated.uid), updated);
              } catch (e) {}

              alert('✓ Employee profile & certificates updated successfully!');
              setViewingProfile(null);
            }}
          />
        </div>
      )}

      {/* Add / Edit Employee Modal */}
      {(isAddModalOpen || editingStaff) && (
        <div className='fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4'>
          <div className='glass-panel p-6 rounded-2xl border border-slate-800 w-full max-w-md space-y-4 relative shadow-2xl'>
            <div className='flex justify-between items-center border-b border-slate-800 pb-3'>
              <h3 className='text-base font-bold text-white flex items-center gap-2'>
                {editingStaff ? <Edit2 size={18} className='text-cyan-400' /> : <UserPlus size={18} className='text-cyan-400' />}
                {editingStaff ? 'Edit Employee Details' : 'Add New Employee'}
              </h3>
              <button onClick={() => { setIsAddModalOpen(false); setEditingStaff(null); }} className='text-slate-400 hover:text-white'><X size={18} /></button>
            </div>

            <form onSubmit={handleSaveEmployee} className='space-y-4 text-xs'>
              <div>
                <label className='block font-semibold text-slate-300 mb-1 flex items-center gap-1.5'>
                  <Users size={13} /> Full Name
                </label>
                <input
                  type='text'
                  placeholder='e.g. Subhadra C K'
                  value={formName}
                  onChange={e => {
                    const val = e.target.value;
                    setFormName(val);
                    if (!editingStaff && val.trim()) {
                      const cleanUser = val.toLowerCase().replace(/[^a-z0-9]/g, '');
                      setFormEmail(cleanUser ? cleanUser + '@gmail.com' : '');
                    }
                  }}
                  required
                  className='w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500'
                />
              </div>

              <div>
                <label className='block font-semibold text-slate-300 mb-1 flex items-center gap-1.5'>
                  <Mail size={13} /> User Name / Employee Email ID
                </label>
                <input
                  type='email'
                  placeholder='subhadra@gmail.com'
                  value={formEmail}
                  onChange={e => setFormEmail(e.target.value)}
                  required
                  className='w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-cyan-500'
                />
              </div>

              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <label className='block font-semibold text-slate-300 mb-1 flex items-center gap-1.5'>
                    <Briefcase size={13} /> Designation / Role
                  </label>
                  <input
                    type='text'
                    placeholder='Customer Relation Manager'
                    value={formRole}
                    onChange={e => setFormRole(e.target.value)}
                    required
                    className='w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500'
                  />
                </div>

                <div>
                  <label className='block font-semibold text-slate-300 mb-1 flex items-center gap-1.5'>
                    <Building size={13} /> Department
                  </label>
                  <input
                    type='text'
                    placeholder='Marketing'
                    value={formDept}
                    onChange={e => setFormDept(e.target.value)}
                    required
                    className='w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500'
                  />
                </div>
              </div>

              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <label className='block font-semibold text-slate-300 mb-1 flex items-center gap-1.5'>
                    <DollarSign size={13} /> Basic Salary (₹)
                  </label>
                  <input
                    type='number'
                    placeholder='18000'
                    value={formSalary}
                    onChange={e => setFormSalary(e.target.value)}
                    required
                    className='w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-cyan-500'
                  />
                </div>

                <div>
                  <label className='block font-semibold text-slate-300 mb-1 flex items-center gap-1.5'>
                    Joining Date
                  </label>
                  <input
                    type='text'
                    placeholder='12-05-2025'
                    value={formJoiningDate}
                    onChange={e => setFormJoiningDate(e.target.value)}
                    required
                    className='w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-cyan-500'
                  />
                </div>
              </div>

              <div className='flex justify-end gap-2 pt-2 border-t border-slate-800'>
                <button
                  type='button'
                  onClick={() => { setIsAddModalOpen(false); setEditingStaff(null); }}
                  className='py-2.5 px-4 bg-slate-800 text-slate-300 rounded-xl font-semibold'
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={loading}
                  className='py-2.5 px-5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold rounded-xl transition shadow-lg shadow-cyan-500/20'
                >
                  {loading ? 'Saving...' : (editingStaff ? 'Update Employee' : 'Add Employee')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Salary Hike Logger Modal */}
      {hikeStaff && (
        <div className='fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4'>
          <div className='glass-panel p-6 rounded-2xl border border-slate-800 w-full max-w-md space-y-4 relative shadow-2xl'>
            <div className='flex justify-between items-center border-b border-slate-800 pb-3'>
              <h3 className='text-base font-bold text-white flex items-center gap-2'>
                <TrendingUp size={16} className='text-cyan-400' /> Log Salary Hike for {hikeStaff.name}
              </h3>
              <button onClick={() => setHikeStaff(null)} className='text-slate-400 hover:text-white'><X size={18} /></button>
            </div>

            <form onSubmit={handleApplyHike} className='space-y-4 text-xs'>
              <div>
                <label className='block font-semibold text-slate-300 mb-1'>Current Basic Salary</label>
                <div className='p-3 bg-slate-950 border border-slate-800 rounded-xl font-bold text-slate-300 font-mono text-sm'>
                  ₹{(hikeStaff.basicSalary || 18000).toLocaleString()}
                </div>
              </div>

              <div>
                <label className='block font-semibold text-slate-300 mb-1'>Hike / Increment Amount (₹)</label>
                <input
                  type='number'
                  placeholder='e.g. 2000'
                  value={hikeAmount}
                  onChange={e => setHikeAmount(e.target.value)}
                  required
                  className='w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-cyan-500'
                />
              </div>

              {hikeAmount && (
                <div className='p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold flex justify-between'>
                  <span>New Revised Basic Salary:</span>
                  <span className='font-bold font-mono text-sm'>₹{(parseFloat(String(hikeStaff.basicSalary || '0')) + parseFloat(hikeAmount || '0')).toLocaleString()}</span>
                </div>
              )}

              <div>
                <label className='block font-semibold text-slate-300 mb-1'>Effective Date</label>
                <input
                  type='date'
                  value={effectiveDate}
                  onChange={e => setEffectiveDate(e.target.value)}
                  className='w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-white'
                />
              </div>

              <div>
                <label className='block font-semibold text-slate-300 mb-1'>Revision Reason</label>
                <input
                  type='text'
                  value={hikeReason}
                  onChange={e => setHikeReason(e.target.value)}
                  className='w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-white'
                />
              </div>

              <div className='flex justify-end gap-2 pt-2 border-t border-slate-800'>
                <button type='button' onClick={() => setHikeStaff(null)} className='py-2.5 px-4 bg-slate-800 text-slate-300 rounded-xl font-semibold'>Cancel</button>
                <button type='submit' disabled={loading} className='py-2.5 px-5 bg-cyan-500 hover:bg-cyan-400 text-white font-bold rounded-xl transition shadow-lg shadow-cyan-500/20'>
                  {loading ? 'Saving...' : 'Save Salary Hike'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
