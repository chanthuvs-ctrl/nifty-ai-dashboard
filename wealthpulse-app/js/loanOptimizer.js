// WealthPulse AI - Loan Burden Optimizer & Payoff Strategy Engine

export function runDebtPayoffOptimization(data, extraMonthlyBudget = 5000) {
  const loans = JSON.parse(JSON.stringify(data.loans || []));
  const chits = JSON.parse(JSON.stringify(data.chitFunds || []));

  // Combine loans and chit fund liabilities into a normalized debt list
  const normalizedDebts = [];

  loans.forEach(l => {
    normalizedDebts.push({
      id: l.id,
      name: l.name,
      type: "LOAN",
      balance: l.principalOutstanding,
      interestRatePct: l.interestRatePct,
      monthlyEMI: l.monthlyEMI,
      remainingMonths: l.remainingMonths
    });
  });

  chits.forEach(c => {
    // Chit fund effective interest rate approx ~10.5% (or based on dividend discount)
    normalizedDebts.push({
      id: c.id,
      name: c.name,
      type: "CHIT_FUND",
      balance: c.monthlyInstallment * c.remainingMonths,
      interestRatePct: 10.5,
      monthlyEMI: c.monthlyInstallment,
      remainingMonths: c.remainingMonths,
      auctionPayoutAvailable: c.auctionPayoutAvailable
    });
  });

  if (normalizedDebts.length === 0) {
    return {
      avalanche: { totalMonths: 0, totalInterestPaid: 0, monthsSaved: 0, interestSaved: 0, schedule: [] },
      snowball: { totalMonths: 0, totalInterestPaid: 0, monthsSaved: 0, interestSaved: 0, schedule: [] },
      suggestions: ["You currently have zero active debt! Keep investing in growth assets."]
    };
  }

  // 1. Baseline Schedule (No Extra Prepayment)
  const baseline = simulatePayoff(JSON.parse(JSON.stringify(normalizedDebts)), 0, "NONE");

  // 2. Avalanche Strategy (Highest Interest Rate First)
  const avalancheDebts = JSON.parse(JSON.stringify(normalizedDebts)).sort((a, b) => b.interestRatePct - a.interestRatePct);
  const avalanche = simulatePayoff(avalancheDebts, extraMonthlyBudget, "AVALANCHE");
  avalanche.interestSaved = Math.max(0, baseline.totalInterestPaid - avalanche.totalInterestPaid);
  avalanche.monthsSaved = Math.max(0, baseline.totalMonths - avalanche.totalMonths);

  // 3. Snowball Strategy (Smallest Balance First)
  const snowballDebts = JSON.parse(JSON.stringify(normalizedDebts)).sort((a, b) => a.balance - b.balance);
  const snowball = simulatePayoff(snowballDebts, extraMonthlyBudget, "SNOWBALL");
  snowball.interestSaved = Math.max(0, baseline.totalInterestPaid - snowball.totalInterestPaid);
  snowball.monthsSaved = Math.max(0, baseline.totalMonths - snowball.totalMonths);

  // 4. Actionable Loan Burden Recommendations
  const suggestions = [];

  // High Interest Warning (>14%)
  const highInterestDebts = normalizedDebts.filter(d => d.interestRatePct >= 14);
  if (highInterestDebts.length > 0) {
    const totalHighInterestBalance = highInterestDebts.reduce((sum, d) => sum + d.balance, 0);
    const highInterestNames = highInterestDebts.map(d => d.name).join(", ");
    suggestions.push({
      title: "🚨 High Interest Debt Alert",
      badge: "CRITICAL",
      text: `You have high-interest debt totaling ₹${totalHighInterestBalance.toLocaleString()} (${highInterestNames}). Pay these off FIRST using the Avalanche method to stop wealth drain.`
    });
  }

  // Chit Fund Auction Arbitrage Opportunity
  const activeChit = chits.find(c => c.auctionPayoutAvailable > 0 && !c.isAuctioned);
  const creditCardOrPersonalLoan = loans.find(l => l.interestRatePct >= 14);
  if (activeChit && creditCardOrPersonalLoan) {
    const payout = activeChit.auctionPayoutAvailable;
    suggestions.push({
      title: "⚡ Chit Fund Auction Arbitrage",
      badge: "OPTIMIZATION",
      text: `You can auction your ${activeChit.name} to receive ~₹${payout.toLocaleString()} cash liquidity today, and use it immediately to wipe out your high-interest ${creditCardOrPersonalLoan.name} (${creditCardOrPersonalLoan.interestRatePct}% p.a.). This instantly frees up ₹${creditCardOrPersonalLoan.monthlyEMI.toLocaleString()}/month in cash flow!`
    });
  }

  // ULIP / Low-yield Investment Policy Surrender Opportunity
  const lowYieldUlip = (data.insurance.investmentPolicies || []).find(p => (p.estimatedReturnPct || 0) < 6.5);
  if (lowYieldUlip && lowYieldUlip.surrenderValue > 50000) {
    suggestions.push({
      title: "💡 Low-Yield Policy Reallocation",
      badge: "REALLOCATE",
      text: `${lowYieldUlip.name} earns only ${lowYieldUlip.estimatedReturnPct}% p.a. while your loans cost up to 18%. Surrendering this policy gives you ~₹${lowYieldUlip.surrenderValue.toLocaleString()} liquidity to pay down debt or invest in 12% mutual funds.`
    });
  }

  // Prepayment Impact
  if (extraMonthlyBudget > 0) {
    suggestions.push({
      title: "🚀 Prepayment Velocity Impact",
      badge: "SPEED",
      text: `Adding ₹${extraMonthlyBudget.toLocaleString()}/month extra prepayment will save you ₹${avalanche.interestSaved.toLocaleString()} in interest and make you debt-free ${avalanche.monthsSaved} months (${(avalanche.monthsSaved/12).toFixed(1)} years) faster!`
    });
  }

  return {
    baseline,
    avalanche,
    snowball,
    suggestions
  };
}

function simulatePayoff(debts, extraBudget, strategy) {
  let months = 0;
  let totalInterestPaid = 0;
  const maxMonths = 360;
  const schedule = [];

  let currentDebts = debts.map(d => ({ ...d }));

  while (months < maxMonths && currentDebts.some(d => d.balance > 0.01)) {
    months++;
    let monthInterest = 0;
    let extraAvailable = extraBudget;

    // Apply monthly interest and minimum payments
    currentDebts.forEach(d => {
      if (d.balance > 0) {
        const monthlyRate = (d.interestRatePct / 12) / 100;
        const interest = d.balance * monthlyRate;
        monthInterest += interest;
        d.balance += interest;

        // Regular EMI payment
        const payment = Math.min(d.balance, d.monthlyEMI);
        d.balance -= payment;
      }
    });

    // Apply extra prepayment to target debt according to strategy
    if (extraAvailable > 0) {
      for (let d of currentDebts) {
        if (d.balance > 0) {
          const prepay = Math.min(d.balance, extraAvailable);
          d.balance -= prepay;
          extraAvailable -= prepay;
          if (extraAvailable <= 0) break;
        }
      }
    }

    totalInterestPaid += monthInterest;

    if (months % 6 === 0 || !currentDebts.some(d => d.balance > 0.01)) {
      const remainingTotal = currentDebts.reduce((sum, d) => sum + Math.max(0, d.balance), 0);
      schedule.push({
        month: months,
        year: (months / 12).toFixed(1),
        remainingTotal: Math.round(remainingTotal),
        interestPaidSoFar: Math.round(totalInterestPaid)
      });
    }
  }

  return {
    totalMonths: months,
    totalInterestPaid: Math.round(totalInterestPaid),
    schedule
  };
}
