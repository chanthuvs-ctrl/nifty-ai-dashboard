// Automated Test Suite for WealthPulse AI Engine
import { DEFAULT_FINANCIAL_DATA } from "./js/dataModel.js";
import { calculateFinancialSummary } from "./js/financialEngine.js";
import { runDebtPayoffOptimization } from "./js/loanOptimizer.js";
import { queryAIBrain } from "./js/aiBrain.js";

console.log("=========================================");
console.log("  WealthPulse AI Engine Unit Test Suite  ");
console.log("=========================================");

// Test 1: Financial Summary Calculation
const summary = calculateFinancialSummary(DEFAULT_FINANCIAL_DATA);
console.log("\n[Test 1] Financial Summary Metrics:");
console.log("- Gross Monthly Income: ₹" + summary.grossMonthlyIncome.toLocaleString());
console.log("- Total Monthly Debt Commitment: ₹" + summary.totalMonthlyDebtCommitment.toLocaleString() + " (Loans + Chit Funds)");
console.log("- Debt-to-Income (DTI) Ratio: " + summary.dtiPct.toFixed(2) + "% (" + summary.dtiStatus + ")");
console.log("- Total Assets: ₹" + summary.totalAssets.toLocaleString());
console.log("- Total Liabilities: ₹" + summary.totalLiabilities.toLocaleString());
console.log("- Net Worth: ₹" + summary.netWorth.toLocaleString());
console.log("- Days to Financial Independence: " + summary.daysToFIRE.toLocaleString() + " Days (" + summary.yearsToFIRE + " Years)");
console.log("- Financial Health Score: " + summary.healthScore + "/100");

if (summary.grossMonthlyIncome > 0 && summary.netWorth > 0 && summary.daysToFIRE > 0) {
  console.log("--> PASS: Summary calculations generated valid non-zero values.");
} else {
  console.error("--> FAIL: Summary calculations failed!");
  process.exit(1);
}

// Test 2: Debt Optimization (Avalanche vs Snowball)
const optResults = runDebtPayoffOptimization(DEFAULT_FINANCIAL_DATA, 5000);
console.log("\n[Test 2] Loan Payoff Optimization:");
console.log("- Avalanche Interest Saved: ₹" + optResults.avalanche.interestSaved.toLocaleString());
console.log("- Avalanche Months Saved: " + optResults.avalanche.monthsSaved + " Months");
console.log("- Generated Suggestions Count: " + optResults.suggestions.length);

if (optResults.suggestions.length > 0 && optResults.avalanche.monthsSaved >= 0) {
  console.log("--> PASS: Debt optimization engine produced actionable insights.");
} else {
  console.error("--> FAIL: Debt optimization engine returned empty results.");
  process.exit(1);
}

// Test 3: AI Brain Chatbot Query Engine
console.log("\n[Test 3] AI Brain Chatbot Query Engine:");

const q1 = "Can I take a new loan of 10 Lakhs at 11% for 5 years?";
const resp1 = queryAIBrain(q1, DEFAULT_FINANCIAL_DATA);
console.log("- Query: \"" + q1 + "\"");
console.log("- Response Contains Verdict: " + resp1.includes("AI Decision Verdict"));

const q2 = "Can I take a loan to close my credit card debt?";
const resp2 = queryAIBrain(q2, DEFAULT_FINANCIAL_DATA);
console.log("- Query: \"" + q2 + "\"");
console.log("- Response Contains Consolidation: " + resp2.includes("Debt Consolidation"));

if (resp1.includes("AI Decision Verdict") && resp2.includes("Debt Consolidation")) {
  console.log("--> PASS: AI Brain Chatbot decision engine evaluated scenario correctly.");
} else {
  console.error("--> FAIL: AI Chatbot decision engine output malformed.");
  process.exit(1);
}

console.log("\n=========================================");
console.log("  ALL UNIT TESTS PASSED SUCCESSFULLY!  ");
console.log("=========================================");
