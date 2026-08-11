export interface StaffMember {
  empId: string;
  name: string;
  email: string;
  aliases: string[];
  role: string;
  department: string;
  basicSalary: number;
  joiningDate: string;
  isAdmin?: boolean;
}

export const OFFICIAL_STAFF_REGISTRY: StaffMember[] = [
  {
    empId: 'EMP-001',
    name: 'Aparnendhu',
    email: 'aparnendhu@gmail.com',
    aliases: ['aparnendhu', 'lavenderladyh', 'lavenderladyh@gmail.com'],
    role: 'Customer Relation Executive',
    department: 'Clinic Operations',
    basicSalary: 11000,
    joiningDate: '12-05-2025'
  },
  {
    empId: 'EMP-002',
    name: 'Viji S',
    email: 'viji@gmail.com',
    aliases: ['viji', 'vijiviji6632', 'vijiviji6632@gmail.com'],
    role: 'Staff Nurse',
    department: 'Cosmetology',
    basicSalary: 15000,
    joiningDate: '12-05-2025'
  },
  {
    empId: 'EMP-003',
    name: 'Subhadra C K',
    email: 'subhadra@gmail.com',
    aliases: ['subhadra', 'ksubhadra2005', 'ksubhadra2005@gmail.com'],
    role: 'Customer Relation Manager',
    department: 'Marketing',
    basicSalary: 18000,
    joiningDate: '12-05-2025'
  },
  {
    empId: 'EMP-004',
    name: 'Amrutha M S',
    email: 'amrutha@gmail.com',
    aliases: ['amrutha', 'amritha', 'rahulamritha3', 'rahulamritha3@gmail.com'],
    role: 'Staff Nurse',
    department: 'Cosmetology',
    basicSalary: 18000,
    joiningDate: '12-05-2025'
  },
  {
    empId: 'EMP-005',
    name: 'Letha',
    email: 'letha@gmail.com',
    aliases: ['letha', 'letha@gmail.com'],
    role: 'House Keeping Staff',
    department: 'Clinic Operations',
    basicSalary: 7000,
    joiningDate: '12-05-2025'
  },
  {
    empId: 'EMP-006',
    name: 'Dr Deepthy R K',
    email: 'drdeepthy@gmail.com',
    aliases: ['deepthy', 'drdeepthy', 'drdeepthykrishna', 'drdeepthykrishna@gmail.com'],
    role: 'Managing Director',
    department: 'Clinic Operations',
    basicSalary: 40000,
    joiningDate: '01-01-2025',
    isAdmin: true
  },
  {
    empId: 'EMP-007',
    name: 'Dr Anagha S Nath',
    email: 'dranagha@gmail.com',
    aliases: ['anagha', 'dranagha', 'anoos271288', 'anoos271288@gmail.com'],
    role: 'Oral and Maxillo Facial Surgeon',
    department: 'Clinic Operations',
    basicSalary: 66000,
    joiningDate: '01-01-2025'
  },
  {
    empId: 'EMP-008',
    name: 'Chanthu V S',
    email: 'chanthuvs@gmail.com',
    aliases: ['chanthu', 'chanthuvs', 'admin'],
    role: 'Admin',
    department: 'Clinic Operations & Marketing',
    basicSalary: 25000,
    joiningDate: '01-01-2025',
    isAdmin: true
  },
  {
    empId: 'EMP-009',
    name: 'Test Staff User',
    email: 'teststaff@gmail.com',
    aliases: ['teststaff', 'testuser', 'staff'],
    role: 'Junior Nurse',
    department: 'Clinic Operations',
    basicSalary: 12000,
    joiningDate: '01-06-2025'
  }
];

export const getStaffByInput = (input: string): StaffMember | null => {
  if (!input || !input.trim()) return null; // STRICT AUTH: NEVER FALLBACK TO ANOTHER EMPLOYEE!
  const clean = input.trim().toLowerCase();
  const handle = clean.split('@')[0];

  for (const staff of OFFICIAL_STAFF_REGISTRY) {
    if (staff.empId.toLowerCase() === clean) return staff;
    if (staff.email.toLowerCase() === clean) return staff;
    if (staff.email.toLowerCase().split('@')[0] === handle) return staff;
    if (staff.aliases.some(a => a.toLowerCase() === clean || a.toLowerCase() === handle)) return staff;
  }

  // Exact Name Match
  for (const staff of OFFICIAL_STAFF_REGISTRY) {
    const firstName = staff.name.toLowerCase().split(' ')[0];
    if (firstName === handle || firstName === clean) return staff;
  }

  return null; // Strict isolation guarantee
};
