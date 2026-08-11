// WealthPulse AI - Financial Data Model & State Management

export const DEFAULT_FINANCIAL_DATA = {
  profile: {
    name: "Alex Morgan",
    age: 32,
    targetRetirementAge: 48,
    currencySymbol: "₹",
    currencyCode: "INR"
  },
  
  income: {
    monthlySalary: 180000,
    monthlyBonus: 15000,
    sideIncome: 25000,
    expectedAnnualHikePct: 8.0
  },

  expenses: {
    essentialMonthly: 65000,
    discretionaryMonthly: 30000,
    annualInflationPct: 6.0
  },

  loans: [
    {
      id: "loan_1",
      name: "Home Loan (HDFC)",
      type: "Home",
      principalOutstanding: 3200000,
      interestRatePct: 8.5,
      monthlyEMI: 31500,
      remainingMonths: 168,
      prepaymentAllowed: true
    },
    {
      id: "loan_2",
      name: "Personal Loan (ICICI)",
      type: "Personal",
      principalOutstanding: 420000,
      interestRatePct: 14.5,
      monthlyEMI: 14200,
      remainingMonths: 36,
      prepaymentAllowed: true
    },
    {
      id: "loan_3",
      name: "Credit Card EMI (HDFC)",
      type: "CreditCard",
      principalOutstanding: 95000,
      interestRatePct: 18.0,
      monthlyEMI: 8800,
      remainingMonths: 12,
      prepaymentAllowed: true
    }
  ],

  chitFunds: [
    {
      id: "chit_1",
      name: "Shanthi Chits 5L Scheme",
      monthlyInstallment: 20000,
      totalMonths: 25,
      remainingMonths: 14,
      totalValue: 500000,
      dividendEarnedSoFar: 28000,
      auctionPayoutAvailable: 410000,
      isAuctioned: false,
      payoutReceived: 0
    }
  ],

  insurance: {
    termPolicies: [
      {
        id: "term_1",
        name: "HDFC Click2Protect",
        sumAssured: 15000000,
        annualPremium: 18500,
        expiryAge: 65,
        isActive: true
      }
    ],
    investmentPolicies: [
      {
        id: "inv_policy_1",
        name: "LIC Endowment Moneyback",
        annualPremium: 60000,
        currentCorpusValue: 280000,
        maturityValue: 850000,
        maturityYear: 2032,
        estimatedReturnPct: 5.2,
        surrenderValue: 240000,
        recommendationFlag: "LOW_YIELD"
      }
    ]
  },

  mutualFunds: {
    currentCorpusValue: 1450000,
    monthlySIPAmount: 35000,
    equityRatioPct: 75,
    debtRatioPct: 25,
    expectedCAGRPct: 12.0
  },

  tradingPnL: {
    capitalAllocated: 350000,
    monthlyAveragePnL: 18000,
    winRatePct: 64.0,
    tradingType: "Options & Swing Trading",
    consistencyIndexScore: 78
  },

  realAssets: {
    properties: [
      {
        id: "prop_1",
        name: "2BHK Apartment (Bangalore)",
        type: "Residential House",
        estimatedMarketValue: 7500000,
        purchasePrice: 5800000,
        annualAppreciationPct: 6.5,
        monthlyRentalIncome: 22000
      },
      {
        id: "prop_2",
        name: "Ancestral Plot (Coimbatore)",
        type: "Land/Plot",
        estimatedMarketValue: 2500000,
        purchasePrice: 1500000,
        annualAppreciationPct: 8.0,
        monthlyRentalIncome: 0
      }
    ],
    gold: {
      physicalGoldGrams: 120,
      sgbGrams: 50,
      digitalGoldGrams: 20,
      pricePerGramINR: 7250,
      purchaseCostTotal: 1050000
    }
  },

  goals: [
    {
      id: "goal_1",
      name: "Emergency Fund (6 Months Expenses)",
      targetAmount: 600000,
      currentSaved: 450000,
      targetYear: 2027,
      priority: "CRITICAL"
    },
    {
      id: "goal_2",
      name: "Financial Independence (FIRE)",
      targetAmount: 35000000,
      currentSaved: 0,
      targetYear: 2042,
      priority: "HIGH"
    }
  ]
};

export const BLANK_FINANCIAL_DATA = {
  profile: {
    name: "My Profile",
    age: 30,
    targetRetirementAge: 50,
    currencySymbol: "₹",
    currencyCode: "INR"
  },
  income: { monthlySalary: 0, monthlyBonus: 0, sideIncome: 0, expectedAnnualHikePct: 8.0 },
  expenses: { essentialMonthly: 0, discretionaryMonthly: 0, annualInflationPct: 6.0 },
  loans: [],
  chitFunds: [],
  insurance: { termPolicies: [], investmentPolicies: [] },
  mutualFunds: { currentCorpusValue: 0, monthlySIPAmount: 0, equityRatioPct: 80, debtRatioPct: 20, expectedCAGRPct: 12.0 },
  tradingPnL: { capitalAllocated: 0, monthlyAveragePnL: 0, winRatePct: 50.0, tradingType: "None", consistencyIndexScore: 50 },
  realAssets: {
    properties: [],
    gold: { physicalGoldGrams: 0, sgbGrams: 0, digitalGoldGrams: 0, pricePerGramINR: 7250, purchaseCostTotal: 0 }
  },
  goals: [
    { id: "goal_1", name: "Emergency Fund", targetAmount: 300000, currentSaved: 0, targetYear: 2026, priority: "CRITICAL" }
  ]
};

export class FinancialStore {
  constructor() {
    this.data = this.loadFromStorage() || JSON.parse(JSON.stringify(DEFAULT_FINANCIAL_DATA));
  }

  loadFromStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = localStorage.getItem("wealthpulse_data_v1");
        return saved ? JSON.parse(saved) : null;
      }
      return null;
    } catch (e) {
      console.warn("Could not load from localStorage:", e);
      return null;
    }
  }

  saveToStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem("wealthpulse_data_v1", JSON.stringify(this.data));
      }
    } catch (e) {
      console.warn("Could not save to localStorage:", e);
    }
  }

  resetToDefault() {
    this.data = JSON.parse(JSON.stringify(DEFAULT_FINANCIAL_DATA));
    this.saveToStorage();
    return this.data;
  }

  startBlankProfile() {
    this.data = JSON.parse(JSON.stringify(BLANK_FINANCIAL_DATA));
    this.saveToStorage();
    return this.data;
  }

  exportJSON() {
    return JSON.stringify(this.data, null, 2);
  }

  importJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      this.data = parsed;
      this.saveToStorage();
      return true;
    } catch (e) {
      console.error("Invalid JSON import:", e);
      return false;
    }
  }
}
