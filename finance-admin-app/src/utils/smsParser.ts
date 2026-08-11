import { SMSLog } from '../data/baselineData';

export function parseBankSMS(text: string): SMSLog {
  const raw = text.trim();
  let amount = 0;
  let type: 'debit' | 'credit' = 'debit';
  let merchant = 'Unknown Merchant';
  let bank = 'Bank SMS';
  let account = '';
  let category = 'General';

  // Amount match
  const amtMatch = raw.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i) || 
                   raw.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:rs\.?|inr|₹)/i) ||
                   raw.match(/(?:debited|credited|paid|spent)\s+(?:by|for|of)?\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  
  if (amtMatch) {
    amount = parseFloat(amtMatch[1].replace(/,/g, ''));
  }

  // Type match
  if (/credited|received|added|refund/i.test(raw)) {
    type = 'credit';
  } else if (/debited|spent|paid|transferred|withdrawn|charged/i.test(raw)) {
    type = 'debit';
  }

  // Bank Match
  if (/hdfc/i.test(raw)) bank = 'HDFC Bank';
  else if (/sbi|state bank/i.test(raw)) bank = 'SBI';
  else if (/icici/i.test(raw)) bank = 'ICICI Bank';
  else if (/axis/i.test(raw)) bank = 'Axis Bank';
  else if (/kvb|karur/i.test(raw)) bank = 'KVB';
  else if (/federal/i.test(raw)) bank = 'Federal Bank';
  else if (/south indian|sib/i.test(raw)) bank = 'South Indian Bank';
  else if (/cred/i.test(raw)) bank = 'CRED App';
  else if (/gpay|google pay/i.test(raw)) bank = 'Google Pay';
  else if (/phonepe/i.test(raw)) bank = 'PhonePe';
  else if (/paytm/i.test(raw)) bank = 'Paytm';

  // Account
  const accMatch = raw.match(/(?:a\/c|account|card|vpa|ending with|ending in)\s*([x\*\d]{4,})/i);
  if (accMatch) account = accMatch[1];

  // Category & Merchant match
  if (/swiggy|zomato|eats|restaurant|food/i.test(raw)) {
    merchant = raw.match(/swiggy|zomato|restaurant/i)?.[0] || 'Food & Dining';
    category = 'Food & Dining';
  } else if (/ksfe|chala|vatti|chitty/i.test(raw)) {
    merchant = 'KSFE Chitty / Vatti';
    category = 'KSFE Chitty';
  } else if (/home loan|housing loan|loan emi/i.test(raw)) {
    merchant = 'Home Loan EMI';
    category = 'Loans & EMIs';
  } else if (/personal loan/i.test(raw)) {
    merchant = 'Personal Loan EMI';
    category = 'Loans & EMIs';
  } else if (/lic|insurance|premium/i.test(raw)) {
    merchant = 'LIC Policy Premium';
    category = 'Insurance';
  } else if (/cred|credit card/i.test(raw)) {
    merchant = 'Credit Card Bill';
    category = 'Credit Cards';
  } else if (/gold loan/i.test(raw)) {
    merchant = 'Gold Loan Interest';
    category = 'Loans & EMIs';
  } else if (/amazon|flipkart|myntra|shopping/i.test(raw)) {
    merchant = 'Shopping / E-Commerce';
    category = 'Shopping';
  } else if (/uber|ola|rapido|petrol|fuel|hpcl|bpcl|iocl/i.test(raw)) {
    merchant = 'Transport / Fuel';
    category = 'Transport';
  }

  return {
    id: 'sms_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    rawText: raw,
    amount,
    type,
    bank,
    account,
    merchant,
    category,
    timestamp: new Date().toISOString(),
    reconciled: false
  };
}
