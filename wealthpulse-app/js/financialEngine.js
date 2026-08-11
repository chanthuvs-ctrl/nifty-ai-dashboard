// WealthPulse AI - Financial Calculation Engine

export function calculateFinancialSummary(data) {
  // 1. Income Calculations
  const rentalIncome = (data.realAssets.properties || []).reduce((acc, p) => acc + (p.monthlyRentalIncome || 0), 0);
  const tradingIncome = Math.max(0, data.tradingPnL.monthlyAveragePnL || 0);
  
  const grossMonthlyIncome = (data.income.monthlySalary || 0) + 
                             (data.income.monthlyBonus || 0) + 
                             (data.income.sideIncome || 0) + 
                             rentalIncome + 
                             tradingIncome;
                             
  const annualIncome = grossMonthlyIncome * 12;

  // 2. Expenses Calculations
  const essentialMonthly = data.expenses.essentialMonthly || 0;
  const discretionaryMonthly = data.expenses.discretionaryMonthly || 0;
  const annualTermPremium = (data.insurance.termPolicies || []).reduce((acc, p) => acc + (p.annualPremium || 0), 0);
  const annualInvPremium = (data.insurance.investmentPolicies || []).reduce((acc, p) => acc + (p.annualPremium || 0), 0);
  const totalAnnualInsurance = annualTermPremium + annualInvPremium;
  const monthlyInsuranceExpense = totalAnnualInsurance / 12;

  const totalMonthlyExpense = essentialMonthly + discretionaryMonthly + monthlyInsuranceExpense;
  const totalAnnualExpense = totalMonthlyExpense * 12;

  // 3. Debt & Chit Fund Liabilities
  const loanEMIs = (data.loans || []).reduce((acc, l) => acc + (l.monthlyEMI || 0), 0);
  const loanPrincipalTotal = (data.loans || []).reduce((acc, l) => acc + (l.principalOutstanding || 0), 0);

  // Chit Funds treated as monthly liability commitments and total remaining payment liability
  const chitInstallments = (data.chitFunds || []).reduce((acc, c) => acc + (c.monthlyInstallment || 0), 0);
  const chitRemainingLiability = (data.chitFunds || []).reduce((acc, c) => acc + ((c.monthlyInstallment || 0) * (c.remainingMonths || 0)), 0);
  const chitAuctionPayoutsAvailable = (data.chitFunds || []).reduce((acc, c) => acc + (c.auctionPayoutAvailable || 0), 0);

  const totalMonthlyDebtCommitment = loanEMIs + chitInstallments;
  const totalLiabilities = loanPrincipalTotal + chitRemainingLiability;

  // 4. Debt-to-Income (DTI) Ratio
  const dtiPct = grossMonthlyIncome > 0 ? (totalMonthlyDebtCommitment / grossMonthlyIncome) * 100 : 0;
  let dtiStatus = "HEALTHY";
  if (dtiPct > 45) dtiStatus = "CRITICAL";
  else if (dtiPct > 35) dtiStatus = "WARNING";

  // 5. Monthly Cash Surplus & Savings Rate
  const monthlySIP = data.mutualFunds.monthlySIPAmount || 0;
  const netMonthlySurplus = grossMonthlyIncome - totalMonthlyExpense - totalMonthlyDebtCommitment - monthlySIP;
  const savingsRatePct = grossMonthlyIncome > 0 ? ((monthlySIP + Math.max(0, netMonthlySurplus)) / grossMonthlyIncome) * 100 : 0;

  // 6. Asset Valuation
  const mfCorpus = data.mutualFunds.currentCorpusValue || 0;
  const tradingCapital = data.tradingPnL.capitalAllocated || 0;
  const ulipCorpus = (data.insurance.investmentPolicies || []).reduce((acc, p) => acc + (p.currentCorpusValue || 0), 0);

  // Gold Assets calculation
  const gold = data.realAssets.gold || {};
  const totalGoldGrams = (gold.physicalGoldGrams || 0) + (gold.sgbGrams || 0) + (gold.digitalGoldGrams || 0);
  const goldValueTotal = totalGoldGrams * (gold.pricePerGramINR || 7250);

  // Real Estate Value
  const realEstateValueTotal = (data.realAssets.properties || []).reduce((acc, p) => acc + (p.estimatedMarketValue || 0), 0);

  // Emergency Fund
  const emergencyFundSaved = (data.goals || []).find(g => g.id === "goal_1")?.currentSaved || 450000;

  const liquidAssets = mfCorpus + tradingCapital + emergencyFundSaved;
  const realAssetsTotal = realEstateValueTotal + goldValueTotal;
  const totalAssets = liquidAssets + realAssetsTotal + ulipCorpus;

  const netWorth = totalAssets - totalLiabilities;
  const liquidNetWorth = liquidAssets + goldValueTotal - (totalLiabilities * 0.3); // Conservative liquid net worth

  // 7. Insurance Adequacy Audit
  const totalTermCover = (data.insurance.termPolicies || []).reduce((acc, p) => acc + (p.isActive ? (p.sumAssured || 0) : 0), 0);
  const recommendedTermCover = (annualIncome * 12) + totalLiabilities;
  const termCoverGap = Math.max(0, recommendedTermCover - totalTermCover);
  const isTermAdequate = totalTermCover >= recommendedTermCover;

  // 8. Financial Independence (FIRE) Days Calculation
  const fireTargetCorpus = totalAnnualExpense * 25; // 4% safe withdrawal rule
  const cagrMonthly = (data.mutualFunds.expectedCAGRPct || 12.0) / 12 / 100;
  const annualHike = (data.income.expectedAnnualHikePct || 8.0) / 100;
  const inflationRate = (data.expenses.annualInflationPct || 6.0) / 100;

  let currentInv = mfCorpus + tradingCapital;
  let monthsToFIRECount = 0;
  const maxSimMonths = 600; // 50 years max safety cap
  let currentSIP = monthlySIP;
  let projectedExpenseAnnual = totalAnnualExpense;

  while (monthsToFIRECount < maxSimMonths) {
    const requiredTargetAtMonth = projectedExpenseAnnual * 25;
    if (currentInv >= requiredTargetAtMonth) {
      break;
    }

    currentInv = (currentInv * (1 + cagrMonthly)) + currentSIP;

    monthsToFIRECount++;
    if (monthsToFIRECount % 12 === 0) {
      currentSIP = currentSIP * (1 + annualHike);
      projectedExpenseAnnual = projectedExpenseAnnual * (1 + inflationRate);
    }
  }

  const daysToFIRE = Math.round(monthsToFIRECount * 30.4375);
  const yearsToFIRE = (monthsToFIRECount / 12).toFixed(1);
  const fireTargetYear = new Date().getFullYear() + Math.floor(monthsToFIRECount / 12);

  // 9. Financial Health Score (0 - 100)
  let healthScore = 0;
  
  if (dtiPct <= 25) healthScore += 30;
  else if (dtiPct <= 35) healthScore += 22;
  else if (dtiPct <= 45) healthScore += 12;
  else healthScore += 5;

  const reqEmergencyFund = totalMonthlyExpense * 6;
  const emergencyRatio = emergencyFundSaved / reqEmergencyFund;
  healthScore += Math.min(25, Math.round(emergencyRatio * 25));

  if (isTermAdequate) healthScore += 15;
  else healthScore += Math.round((totalTermCover / recommendedTermCover) * 15);

  if (savingsRatePct >= 35) healthScore += 15;
  else if (savingsRatePct >= 20) healthScore += 10;
  else healthScore += 5;

  const assetDebtRatio = totalLiabilities > 0 ? totalAssets / totalLiabilities : 10;
  if (assetDebtRatio >= 3) healthScore += 15;
  else if (assetDebtRatio >= 1.5) healthScore += 10;
  else healthScore += 4;

  return {
    grossMonthlyIncome,
    annualIncome,
    essentialMonthly,
    discretionaryMonthly,
    totalMonthlyExpense,
    totalAnnualExpense,
    loanEMIs,
    loanPrincipalTotal,
    chitInstallments,
    chitRemainingLiability,
    chitAuctionPayoutsAvailable,
    totalMonthlyDebtCommitment,
    totalLiabilities,
    dtiPct,
    dtiStatus,
    netMonthlySurplus,
    savingsRatePct,
    mfCorpus,
    tradingCapital,
    ulipCorpus,
    goldValueTotal,
    realEstateValueTotal,
    totalGoldGrams,
    liquidAssets,
    realAssetsTotal,
    totalAssets,
    netWorth,
    liquidNetWorth,
    totalTermCover,
    recommendedTermCover,
    termCoverGap,
    isTermAdequate,
    fireTargetCorpus,
    monthsToFIRE: monthsToFIRECount,
    daysToFIRE,
    yearsToFIRE,
    fireTargetYear,
    healthScore
  };
}
