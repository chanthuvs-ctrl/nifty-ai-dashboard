import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { UserCheck, Award, Search } from 'lucide-react';
import EmployeeProfileView from './EmployeeProfileView';
import type { EmployeeProfileData } from './EmployeeProfileView';

export const OFFICIAL_STAFF_SEED = [
  { uid: 'emp_1', name: 'Aparnendhu', role: 'Customer Relation Executive', email: 'aparnendhu@gmail.com', department: 'Clinic Operations', basicSalary: 18000, joiningDate: '12-05-2025' },
  { uid: 'emp_2', name: 'Dr Deepthy R K', role: 'Chief Dermatologist & Cosmetologist', email: 'deepthy@clinic.com', department: 'Medical Care', basicSalary: 75000, joiningDate: '01-01-2024' },
  { uid: 'emp_3', name: 'Viji S', role: 'Senior Clinic Nurse & Therapist', email: 'viji@clinic.com', department: 'Clinical Nursing', basicSalary: 22000, joiningDate: '15-03-2024' },
  { uid: 'emp_4', name: 'Subhadra C K', role: 'Clinic Attendant & Front Desk', email: 'subhadra@clinic.com', department: 'Clinic Operations', basicSalary: 16000, joiningDate: '01-06-2024' },
  { uid: 'emp_5', name: 'Dr Anagha S Nath', role: 'Aesthetic Physician', email: 'anagha@clinic.com', department: 'Medical Care', basicSalary: 55000, joiningDate: '10-08-2024' },
  { uid: 'emp_6', name: 'Amrutha M S', role: 'Clinic Receptionist', email: 'amrutha@clinic.com', department: 'Front Desk', basicSalary: 17500, joiningDate: '01-09-2024' },
  { uid: 'emp_7', name: 'Chanthu V S', role: 'IT & Operations Lead', email: 'chanthu@clinic.com', department: 'Administration', basicSalary: 60000, joiningDate: '01-01-2024' },
  { uid: 'emp_8', name: 'Letha', role: 'Housekeeping & Support', email: 'letha@clinic.com', department: 'Support Staff', basicSalary: 14000, joiningDate: '01-11-2024' }
];

export default function EmployeeProfilesVault() {
  const [profiles, setProfiles] = useState<EmployeeProfileData[]>([]);
  const [search, setSearch] = useState('');
  const [activeProfile, setActiveProfile] = useState<EmployeeProfileData | null>(null);

  const fetchAllProfiles = async () => {
    const saved = JSON.parse(localStorage.getItem('de_natura_employee_profiles') || '{}');
    
    try {
      const snap = await getDocs(collection(db, 'Users'));
      let list: EmployeeProfileData[] = [];
      
      if (!snap.empty) {
        list = snap.docs.map(d => {
          const data = d.data();
          const uid = d.id;
          return saved[uid] || {
            uid,
            name: data.name || 'Staff Member',
            role: data.role || 'Clinic Staff',
            email: data.email || '',
            department: data.department || 'Operations',
            basicSalary: data.basicSalary || 18000,
            joiningDate: data.joiningDate || '01-01-2025'
          };
        });
      } else {
        list = OFFICIAL_STAFF_SEED.map(s => saved[s.uid] || s);
      }

      setProfiles(list);
    } catch (e) {
      const list = OFFICIAL_STAFF_SEED.map(s => saved[s.uid] || s);
      setProfiles(list);
    }
  };

  useEffect(() => {
    fetchAllProfiles();
  }, []);

  const filtered = profiles.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.email.toLowerCase().includes(search.toLowerCase()) ||
    p.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className='space-y-6'>
      {/* Action Header */}
      <div className='glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
        <div className='flex items-center gap-3'>
          <div className='w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30 shadow-md'>
            <UserCheck size={24} />
          </div>
          <div>
            <h2 className='text-lg font-black text-white tracking-tight'>Employee Profiles & Certificate Vault</h2>
            <p className='text-xs text-slate-400'>Upload & manage staff certificates, resumes, photos, bank info & ID proofs.</p>
          </div>
        </div>

        <div className='relative w-full sm:w-72'>
          <Search size={16} className='absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500' />
          <input
            type='text'
            placeholder='Search employee by name, role or email...'
            value={search}
            onChange={e => setSearch(e.target.value)}
            className='w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition'
          />
        </div>
      </div>

      {/* Staff Grid */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
        {filtered.map(emp => (
          <div key={emp.uid} className='glass-panel p-6 rounded-2xl border border-slate-800 space-y-4 hover:border-cyan-500/30 transition relative group'>
            <div className='flex items-center gap-4'>
              {emp.photoUrl ? (
                <img src={emp.photoUrl} alt={emp.name} className='w-14 h-14 rounded-2xl object-cover border-2 border-cyan-500/40 shadow-md' />
              ) : (
                <div className='w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-black text-lg shadow-md'>
                  {emp.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className='min-w-0 flex-1'>
                <h3 className='font-black text-white text-base truncate'>{emp.name}</h3>
                <p className='text-xs font-bold text-cyan-400 truncate'>{emp.role}</p>
                <p className='text-[11px] text-slate-400 truncate'>{emp.department}</p>
              </div>
            </div>

            <div className='space-y-1.5 text-xs text-slate-300 pt-3 border-t border-slate-800/80'>
              <div className='flex justify-between text-[11px]'>
                <span className='text-slate-400'>Certificates Attached:</span>
                <span className='font-bold text-white bg-slate-800 px-2 py-0.5 rounded-md'>
                  {emp.documents?.length || 0} Docs
                </span>
              </div>
              <div className='flex justify-between text-[11px]'>
                <span className='text-slate-400'>Email:</span>
                <span className='font-mono text-slate-300 truncate max-w-[170px]'>{emp.email}</span>
              </div>
            </div>

            <button
              onClick={() => setActiveProfile(emp)}
              className='w-full py-2.5 px-4 bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 hover:from-cyan-500/30 hover:to-indigo-500/30 border border-cyan-500/40 text-cyan-300 font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-md'
            >
              <Award size={16} className='text-cyan-400' /> Upload Certificates, Resume & Edit Profile
            </button>
          </div>
        ))}
      </div>

      {/* Edit Profile Modal */}
      {activeProfile && (
        <div className='fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in'>
          <EmployeeProfileView
            profile={activeProfile}
            isEditable={true}
            onClose={() => setActiveProfile(null)}
            onSave={async (updated) => {
              const saved = JSON.parse(localStorage.getItem('de_natura_employee_profiles') || '{}');
              saved[updated.uid] = updated;
              localStorage.setItem('de_natura_employee_profiles', JSON.stringify(saved));

              try {
                await setDoc(doc(db, 'EmployeeProfiles', updated.uid), updated);
              } catch (e) {}

              alert('✓ Employee profile & certificates updated successfully!');
              setActiveProfile(null);
              fetchAllProfiles();
            }}
          />
        </div>
      )}
    </div>
  );
}
