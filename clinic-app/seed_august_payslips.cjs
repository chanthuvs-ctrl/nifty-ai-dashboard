
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyAHCiwoA22M-SaTuoQ1zoLj1QLDtt2gOeY',
  authDomain: 'de-natura-hrms.firebaseapp.com',
  projectId: 'de-natura-hrms',
  storageBucket: 'de-natura-hrms.firebasestorage.app',
  messagingSenderId: '116316629474',
  appId: '1:116316629474:web:dbca674c0211bc8bbc71bb'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const staff = [
  { name: 'Aparnendhu', role: 'Customer Relation Executive', department: 'Clinic Operations', email: 'lavenderladyh@gmail.com', basicSalary: 11000, joiningDate: '12-05-2025' },
  { name: 'Viji S', role: 'Staff Nurse', department: 'Cosmetology', email: 'Vijiviji6632@gmail.com', basicSalary: 15000, joiningDate: '12-05-2025' },
  { name: 'Subhadra C K', role: 'Customer Relation Manager', department: 'Marketing', email: 'ksubhadra2005@gmail.com', basicSalary: 18000, joiningDate: '12-05-2025' },
  { name: 'Chanthu V S', role: 'Admin', department: 'Clinic Operations & Marketing', email: 'chanthuvs@gmail.com', basicSalary: 25000, joiningDate: '01-01-2025' },
  { name: 'Letha', role: 'House Keeping Staff', department: 'Clinic Operations', email: 'Letha@gmail.com', basicSalary: 7000, joiningDate: '12-05-2025' },
  { name: 'Dr Deepthy R K', role: 'Managing Director', department: 'Clinic Operations', email: 'drdeepthykrishna@gmail.com', basicSalary: 40000, joiningDate: '01-01-2025' },
  { name: 'Dr Anagha S Nath', role: 'Oral and Maxillo Facial Surgeon', department: 'Clinic Operations', email: 'anoos271288@gmail.com', basicSalary: 66000, joiningDate: '01-01-2025' },
  { name: 'Amrutha M S', role: 'Staff Nurse', department: 'Cosmetology', email: 'rahulamritha3@gmail.com', basicSalary: 15000, joiningDate: '12-05-2025' }
];

async function seed() {
  for (const emp of staff) {
    const cleanEmail = emp.email.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const docId = 'payslip_' + cleanEmail + '_august_2026';
    const record = {
      docId,
      empName: emp.name,
      empEmail: emp.email,
      designation: emp.role,
      department: emp.department,
      joiningDate: emp.joiningDate,
      selectedMonth: 'August',
      selectedYear: '2026',
      fixedSalary: emp.basicSalary,
      overtimeAllowance: 0,
      htAllowance: 0,
      otherAllowance: 0,
      bonus: 0,
      totalWorkingDays: 31,
      daysWorked: 31,
      fullDayLeaves: 0,
      halfDayLeaves: 0,
      totalLops: 0,
      overtimeDays: 0,
      compOff: 0,
      salaryAdvance: 0,
      tds: 0,
      lossOfPayAmount: 0,
      grossEarnings: emp.basicSalary,
      totalDeductions: 0,
      netTotal: emp.basicSalary,
      isGenerated: true,
      generatedAt: Date.now()
    };

    await setDoc(doc(db, 'Payslips', docId), record, { merge: true });
    console.log('Seeded August 2026 payslip for:', emp.name);
  }
  process.exit(0);
}

seed();
