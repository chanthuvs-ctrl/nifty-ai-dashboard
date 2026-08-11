export interface ObligationItem {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  category: 'Loans & EMIs' | 'KSFE Chitty' | 'Credit Cards' | 'Insurance' | 'Variable & Misc';
  status: 'paid' | 'pending';
  notes?: string;
  paidTimestamp?: string;
}

export interface SMSLog {
  id: string;
  rawText: string;
  amount: number;
  type: 'debit' | 'credit';
  bank: string;
  account?: string;
  merchant: string;
  category: string;
  timestamp: string;
  reconciled: boolean;
  matchedItemId?: string;
}

export interface FinanceState {
  month: string;
  salary: number;
  items: ObligationItem[];
  smsLogs: SMSLog[];
}

export const INITIAL_BASELINE_DATA: FinanceState = {
  month: "July 2026",
  salary: 116000,
  items: [
    { id: "gold_loan", name: "Gold loan", amount: 3600, dueDate: "1st", category: "Loans & EMIs", status: "pending", notes: "Monthly gold loan interest" },
    { id: "cred", name: "cred", amount: 3555, dueDate: "3rd", category: "Credit Cards", status: "pending", notes: "CRED bill payment" },
    { id: "ksfe_vatti_1", name: "ksfe vatti #1", amount: 4552, dueDate: "7th", category: "KSFE Chitty", status: "pending", notes: "Chit fund vatti instalment 1" },
    { id: "ksfe_vatti_2", name: "ksfe vatti #2", amount: 4552, dueDate: "7th", category: "KSFE Chitty", status: "pending", notes: "Chit fund vatti instalment 2" },
    { id: "ksfe_vatti_3", name: "ksfe vatti #3", amount: 4552, dueDate: "7th", category: "KSFE Chitty", status: "pending", notes: "Chit fund vatti instalment 3" },
    { id: "ksfe_vatti_4", name: "ksfe vatti #4", amount: 4552, dueDate: "7th", category: "KSFE Chitty", status: "pending", notes: "Chit fund vatti instalment 4" },
    { id: "lic_2", name: "lic 2", amount: 2500, dueDate: "7th", category: "Insurance", status: "pending", notes: "Life Insurance policy 2" },
    { id: "credit_card", name: "Credit card", amount: 5324, dueDate: "10th", category: "Credit Cards", status: "pending", notes: "Primary bank credit card" },
    { id: "credit_card_amma", name: "Credit card - Amma i", amount: 3756, dueDate: "10th", category: "Credit Cards", status: "pending", notes: "Amma credit card statement" },
    { id: "lic_1", name: "lic 1", amount: 3008, dueDate: "15th", category: "Insurance", status: "pending", notes: "Life Insurance policy 1" },
    { id: "ksfe_chala", name: "ksfe chala", amount: 18750, dueDate: "17th", category: "KSFE Chitty", status: "pending", notes: "KSFE Chitty instalment" },
    { id: "ksfe_vatti_new_1", name: "ksfe vatti new #1", amount: 7750, dueDate: "24th", category: "KSFE Chitty", status: "pending", notes: "New chitty vatti 1" },
    { id: "ksfe_vatti_new_2", name: "ksfe vatti new #2", amount: 7750, dueDate: "24th", category: "KSFE Chitty", status: "pending", notes: "New chitty vatti 2" },
    { id: "lic_3", name: "lic 3", amount: 1000, dueDate: "28th", category: "Insurance", status: "pending", notes: "Life Insurance policy 3" },
    { id: "homeloan", name: "Homeloan", amount: 22579, dueDate: "Flexible", category: "Loans & EMIs", status: "pending", notes: "Housing Loan EMI" },
    { id: "personal_loan", name: "Personal loan", amount: 21034, dueDate: "Flexible", category: "Loans & EMIs", status: "pending", notes: "Bank Personal Loan EMI" },
    { id: "misc", name: "Misc / Untagged", amount: 2814, dueDate: "Ongoing", category: "Variable & Misc", status: "pending", notes: "Unallocated reserve" }
  ],
  smsLogs: []
};
