// WealthPulse AI - Financial AI Chatbot & New Loan Decision Engine

import { calculateFinancialSummary } from "./financialEngine.js";

export function queryAIBrain(promptText, currentData) {
  const text = promptText.trim().toLowerCase();
  const summary = calculateFinancialSummary(currentData);

  if (text.includes("new loan") || text.includes("take a loan") || text.includes("afford a loan") || text.includes("credit card") || text.includes("lakh") || text.includes("loan to close")) {
    return evaluateNewLoanScenario(promptText, currentData, summary);
  }

  if (text.includes("burden") || text.includes("overcome loan") || text.includes("payoff") || text.includes("avalanche") || text.includes("snowball") || text.includes("chit fund")) {
    return generateLoanBurdenAdvice(currentData, summary);
  }

  if (text.includes("fire") || text.includes("independence") || text.includes("days to") || text.includes("retire")) {
    return generateFIREAdvice(currentData, summary);
  }

  return generateGeneralFinancialAdvice(promptText, currentData, summary);
}

function evaluateNewLoanScenario(promptText, currentData, summary) {
  let amount = 500000;
  let interestPct = 11.0;
  let tenureYears = 5;
  let isConsolidation = promptText.toLowerCase().includes("close") || promptText.toLowerCase().includes("pay off") || promptText.toLowerCase().includes("consolidate");

  const lakhMatch = promptText.match(/(\d+(\.\d+)?)\s*(lakh|lakhs|l)/i);
  const rawNumMatch = promptText.match(/₹?\s*(\d{5,8})/);
  if (lakhMatch) {
    amount = parseFloat(lakhMatch[1]) * 100000;
  } else if (rawNumMatch) {
    amount = parseFloat(rawNumMatch[1]);
  }

  const rateMatch = promptText.match(/(\d+(\.\d+)?)\s*%/);
  if (rateMatch) {
    interestPct = parseFloat(rateMatch[1]);
  }

  const monthlyRate = (interestPct / 12) / 100;
  const numPayments = tenureYears * 12;
  const newLoanEMI = Math.round((amount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1));

  let existingLoanEMIClosed = 0;
  let closedLoanName = "";
  if (isConsolidation) {
    const highIntLoan = (currentData.loans || []).concat(currentData.chitFunds || []).sort((a,b) => (b.interestRatePct || 10) - (a.interestRatePct || 10))[0];
    if (highIntLoan) {
      existingLoanEMIClosed = highIntLoan.monthlyEMI || highIntLoan.monthlyInstallment || 0;
      closedLoanName = highIntLoan.name;
    }
  }

  const netEMIDelta = newLoanEMI - existingLoanEMIClosed;
  const postLoanMonthlyDebt = summary.totalMonthlyDebtCommitment + netEMIDelta;
  const postLoanDTI = (postLoanMonthlyDebt / summary.grossMonthlyIncome) * 100;
  const postLoanSurplus = summary.netMonthlySurplus - netEMIDelta;

  const fireDelayDays = Math.round(netEMIDelta > 0 ? (netEMIDelta / summary.grossMonthlyIncome) * 365 * 1.8 : -Math.abs((existingLoanEMIClosed - newLoanEMI) / summary.grossMonthlyIncome) * 365 * 1.5);

  let verdict = "SAFE";
  let verdictBadge = "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
  let reasoning = [];

  if (isConsolidation && netEMIDelta < 0) {
    verdict = "HIGHLY RECOMMENDED";
    verdictBadge = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    reasoning.push(`✅ <strong>Debt Refinancing Advantage</strong>: Taking this ₹${(amount/100000).toFixed(1)}L loan at ${interestPct}% to close ${closedLoanName} will <strong>REDUCE your monthly EMI by ₹${Math.abs(netEMIDelta).toLocaleString()}/month</strong>.`);
    reasoning.push(`✅ Your Debt-to-Income (DTI) will drop from <strong>${summary.dtiPct.toFixed(1)}%</strong> down to <strong>${postLoanDTI.toFixed(1)}%</strong>.`);
    reasoning.push(`⚡ <strong>FIRE Acceleration</strong>: This move accelerates your Financial Independence by approximately <strong>${Math.abs(fireDelayDays)} days</strong>!`);
  } else if (postLoanDTI > 45) {
    verdict = "NOT RECOMMENDED (HIGH RISK)";
    verdictBadge = "bg-rose-500/20 text-rose-400 border-rose-500/30";
    reasoning.push(`⚠️ <strong>DTI Danger Zone</strong>: Adding a new EMI of ₹${newLoanEMI.toLocaleString()}/month increases your DTI ratio to <strong>${postLoanDTI.toFixed(1)}%</strong> (Safe threshold is < 35%).`);
    reasoning.push(`⚠️ <strong>Monthly Buffer Warning</strong>: Your monthly cash surplus would drop to ₹${postLoanSurplus.toLocaleString()}/month, leaving minimal buffer for emergencies.`);
    reasoning.push(`🚨 <strong>FIRE Delay</strong>: This new loan will <strong>delay your Financial Independence by ${fireDelayDays} days (~${(fireDelayDays/365).toFixed(1)} years)</strong>!`);
  } else if (postLoanDTI > 35) {
    verdict = "PROCEED WITH CAUTION";
    verdictBadge = "bg-amber-500/20 text-amber-400 border-amber-500/30";
    reasoning.push(`⚡ <strong>Moderate DTI Burden</strong>: Your DTI will increase from <strong>${summary.dtiPct.toFixed(1)}%</strong> to <strong>${postLoanDTI.toFixed(1)}%</strong>.`);
    reasoning.push(`ℹ️ <strong>Monthly EMI</strong>: Proposed new EMI is <strong>₹${newLoanEMI.toLocaleString()}/month</strong> for ${tenureYears} years.`);
    reasoning.push(`⏳ <strong>FIRE Impact</strong>: Delays your Financial Independence by <strong>${fireDelayDays} days</strong>.`);
  } else {
    verdict = "APPROVED (SAFE TO TAKE)";
    verdictBadge = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    reasoning.push(`✅ <strong>Healthy Financial Cushion</strong>: Your income of ₹${summary.grossMonthlyIncome.toLocaleString()}/mo easily supports this new EMI of ₹${newLoanEMI.toLocaleString()}/mo.`);
    reasoning.push(`✅ Post-loan DTI remains low and healthy at <strong>${postLoanDTI.toFixed(1)}%</strong>.`);
    reasoning.push(`ℹ️ FIRE timeline impact: Minor delay of ~${fireDelayDays} days.`);
  }

  const isSafeVerdict = verdict.includes("SAFE") || verdict.includes("APPROVED") || verdict.includes("HIGHLY");
  const verdictColorClass = isSafeVerdict ? "text-emerald-400" : (verdict.includes("CAUTION") ? "text-amber-400" : "text-rose-400");
  const dtiColorClass = postLoanDTI > 40 ? "text-rose-400" : "text-emerald-400";
  const typeText = isConsolidation ? "Debt Consolidation" : "New Debt Request";

  const reasoningLines = reasoning.map(r => `<div class="leading-relaxed">${r}</div>`).join("");

  return `
    <div class="space-y-3">
      <div class="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
        <div>
          <span class="text-xs uppercase tracking-wider text-slate-400 font-semibold block">AI Decision Verdict</span>
          <span class="text-lg font-bold ${verdictColorClass}">${verdict}</span>
        </div>
        <div class="px-3 py-1.5 rounded-lg border text-xs font-semibold ${verdictBadge}">
          ${typeText}
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2 text-xs">
        <div class="p-2.5 rounded-lg bg-slate-900/50 border border-slate-800">
          <span class="text-slate-400 block">Proposed Loan EMI:</span>
          <span class="text-white font-bold text-sm">₹${newLoanEMI.toLocaleString()}/mo</span>
          <span class="text-[10px] text-slate-500 block">(${interestPct}% for ${tenureYears} yrs)</span>
        </div>
        <div class="p-2.5 rounded-lg bg-slate-900/50 border border-slate-800">
          <span class="text-slate-400 block">Post-Loan DTI Ratio:</span>
          <span class="font-bold text-sm ${dtiColorClass}">${postLoanDTI.toFixed(1)}%</span>
          <span class="text-[10px] text-slate-500 block">(Current: ${summary.dtiPct.toFixed(1)}%)</span>
        </div>
      </div>

      <div class="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2 text-xs text-slate-300">
        <div class="font-semibold text-slate-200 border-b border-slate-800 pb-1">AI Analytical Insights:</div>
        ${reasoningLines}
      </div>
    </div>
  `;
}

function generateLoanBurdenAdvice(currentData, summary) {
  const highIntLoans = (currentData.loans || []).filter(l => l.interestRatePct > 12);
  const activeChit = (currentData.chitFunds || [])[0];

  return `
    <div class="space-y-3 text-xs text-slate-300">
      <div class="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30">
        <div class="font-bold text-indigo-300 text-sm mb-1">🧠 AI Debt Overcome Action Plan</div>
        <p class="text-slate-300 leading-relaxed">Your current total monthly debt commitment is <strong class="text-white">₹${summary.totalMonthlyDebtCommitment.toLocaleString()}</strong> across ${currentData.loans.length} loans and ${currentData.chitFunds.length} chit funds.</p>
      </div>

      <div class="space-y-2">
        <div class="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
          <span class="font-semibold text-emerald-400 block">1. Use Debt Avalanche Method:</span>
          Focus all extra monthly savings on paying off your high-interest debt first (${highIntLoans.map(l => l.name + " @ " + l.interestRatePct + "%").join(", ") || "Credit Cards"}).
        </div>
        ${activeChit ? `
        <div class="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
          <span class="font-semibold text-amber-400 block">2. Chit Fund Liquidity Strategy:</span>
          Your active chit scheme <em>"${activeChit.name}"</em> offers ~₹${activeChit.auctionPayoutAvailable.toLocaleString()} payout. If auctioned, you can instantly wipe out high-interest loans, saving thousands in annual interest.
        </div>` : ""}
        <div class="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
          <span class="font-semibold text-blue-400 block">3. Prepayment Rule:</span>
          Prepaying just 1 extra EMI per year on your Home Loan will reduce your tenure by over 3.5 years!
        </div>
      </div>
    </div>
  `;
}

function generateFIREAdvice(currentData, summary) {
  return `
    <div class="space-y-3 text-xs text-slate-300">
      <div class="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30">
        <div class="font-bold text-emerald-300 text-sm mb-1">🔥 Days to Financial Independence</div>
        <div class="text-2xl font-extrabold text-white my-1">${summary.daysToFIRE.toLocaleString()} Days <span class="text-xs font-normal text-emerald-400">(${summary.yearsToFIRE} Years)</span></div>
        <p class="text-slate-400">Target FIRE Corpus: <strong class="text-white">₹${(summary.fireTargetCorpus/10000000).toFixed(2)} Crores</strong> by year <strong>${summary.fireTargetYear}</strong>.</p>
      </div>

      <div class="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1.5">
        <div class="font-semibold text-slate-200">How to reduce your Days to FIRE:</div>
        <div>• 📈 <strong>Increase Monthly SIP by 10%</strong>: Reduces FIRE timeline by ~420 days.</div>
        <div>• 🛡️ <strong>Eliminate High Interest EMIs</strong>: Reinvesting ₹23,000 EMI into MFs shaves off 3.2 years to retirement.</div>
        <div>• 🏡 <strong>Real Estate & Gold Assets</strong>: Total non-tangible assets equal ₹${((summary.realAssetsTotal)/100000).toFixed(1)} Lakhs providing secondary financial security.</div>
      </div>
    </div>
  `;
}

function generateGeneralFinancialAdvice(promptText, currentData, summary) {
  return `
    <div class="space-y-2 text-xs text-slate-300">
      <div class="p-3 rounded-xl bg-slate-800/60 border border-slate-700">
        <div class="font-bold text-white text-sm mb-1">📊 Financial Snapshot Summary</div>
        <div>• Net Worth: <strong class="text-emerald-400">₹${summary.netWorth.toLocaleString()}</strong></div>
        <div>• Monthly Income: <strong class="text-white">₹${summary.grossMonthlyIncome.toLocaleString()}</strong></div>
        <div>• DTI Ratio: <strong class="${summary.dtiPct > 40 ? "text-rose-400" : "text-emerald-400"}">${summary.dtiPct.toFixed(1)}% (${summary.dtiStatus})</strong></div>
        <div>• Days to Financial Independence: <strong class="text-emerald-300">${summary.daysToFIRE.toLocaleString()} Days (${summary.yearsToFIRE} yrs)</strong></div>
      </div>

      <p class="text-slate-400">You can ask me questions like:</p>
      <div class="space-y-1 text-indigo-300 font-mono text-[11px]">
        <div>• "Can I take a new loan of ₹10 Lakh at 11% for 5 years?"</div>
        <div>• "Should I use chit fund payout to close personal loan?"</div>
        <div>• "How can I overcome my loan burden faster?"</div>
        <div>• "Am I covered with enough Term Insurance?"</div>
      </div>
    </div>
  `;
}
