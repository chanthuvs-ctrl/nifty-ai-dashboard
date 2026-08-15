filepath = 'clinic-app/src/components/AdAgencyAnalytics.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    old = f.read()

# Find the import block at top and the lead interface to know how much to replace
# We'll replace everything from the top import to the end of fetchAndParse

new_top = r"""import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { TrendingUp, TrendingDown, Users, DollarSign, Target, RefreshCw, AlertCircle, ExternalLink, BarChart2, Percent, PhoneCall, CheckCircle2, XCircle, Clock, MapPin } from 'lucide-react';

const SHEET_ID = '1YGEz617KY0bfGoR8nQqRffcFc8wsYF2L9FZbVV5IxY4';
const XLSX_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx`;
const CSV_URL  = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
const GST = 0.18;
const REFRESH_MS = 5 * 60 * 1000;

const DISTRICTS = ['palakkad','alappuzha','kottayam','ernakulam','wayanad','pathanamthitta','kollam','kozhikode','thrissur','kannur','kasaragod','malappuram','idukki'];

interface Lead {
  name: string;
  platform: 'Facebook' | 'Instagram' | 'Other';
  treatment: string;
  location: string;
  status: 'converted' | 'warm' | 'out_of_district' | 'invalid' | 'unresponsive';
  revenue: number;
  statusNote: string;
}

interface ParsedData {
  leads: Lead[];
  // Ad spend (from Amount Spent sheet)
  metaSpendExGST: number;
  metaSpendInGST: number;
  googleSpendExGST: number;
  googleSpendInGST: number;
  totalAdSpendExGST: number;
  totalAdSpendInGST: number;
  // Agency fee (dynamic monthly)
  agencyFee: number;
  billCount: number;
  nextBillDate: Date;
  // Meta
  lastUpdated: Date;
  rawCount: number;
  dateFrom: string;
  dateTo: string;
  campaigns: Set<string>;
}

// Agency fee: ₹29,500/month billed on the 6th from 6-Aug-2026
function calcAgencyFee(): { totalFee: number; billCount: number; nextBillDate: Date } {
  const FIRST = new Date('2026-08-06');
  const FEE   = 29500;
  const today = new Date();
  let count = 0;
  const d = new Date(FIRST);
  while (d <= today) { count++; d.setMonth(d.getMonth() + 1); }
  return { totalFee: count * FEE, billCount: count, nextBillDate: new Date(d) };
}

function classifyStatus(note: string): { status: Lead['status']; revenue: number } {
  const s = (note || '').trim().toLowerCase();
  if (s.includes('consult')) {
    const m = s.match(/(\d[\d,]+)\s*\/?-?/);
    const rev = m ? parseInt(m[1].replace(/,/g,''), 10) : 0;
    if (rev > 0) return { status: 'converted', revenue: rev };
  }
  if (['will come','next week','call back','he will call','she will come','will inform',
       'will visit','after onam','call friday','appointment','planning'].some(w => s.includes(w)))
    return { status: 'warm', revenue: 0 };
  if (DISTRICTS.some(d => s.includes(d)) || s.includes('out of district') || s.includes('long distance'))
    return { status: 'out_of_district', revenue: 0 };
  if (['wrong enquiry','wrong enqury','donor area thin','cheeks filling','n/a','enquiry not done',
       'not possible','not looking','not interested','no idea','no incoming'].some(w => s.startsWith(w) || s === w))
    return { status: 'invalid', revenue: 0 };
  return { status: 'unresponsive', revenue: 0 };
}

function parseTreatment(raw: string): string {
  const map: Record<string,string> = {
    hair_transplant_planning:'Hair Transplant Planning',
    prp_gfc_hair_treatment:'PRP / GFC Hair Treatment',
    hair_fall_hair_thinning:'Hair Fall / Hair Thinning',
    acne_scars_marks:'Acne Scars / Marks',
    skin_pigmentation_melasma:'Pigmentation / Melasma',
    glutathione_iv_therapy:'Glutathione IV Therapy',
    hydrafacial_medi_facial:'Hydrafacial / Medi-Facial',
    skin_tag_mole_removal:'Skin Tag / Mole Removal',
    not_sure_need_guidance:'Not Sure / Need Guidance',
  };
  return map[raw] || raw.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()) || 'General';
}

function parseCSVRow(line: string): string[] {
  const cols: string[] = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (inQ && line[i+1]==='"') { cur+='"'; i++; } else { inQ=!inQ; } }
    else if (ch === ',' && !inQ) { cols.push(cur); cur=''; }
    else cur += ch;
  }
  cols.push(cur); return cols;
}

async function fetchAdSpend(): Promise<{ metaExGST: number; googleExGST: number }> {
  const res = await fetch(XLSX_URL);
  if (!res.ok) throw new Error(`XLSX fetch failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  const wb  = XLSX.read(buf, { type: 'array' });
  const ws  = wb.Sheets['Amount Spent'];
  if (!ws) return { metaExGST: 0, googleExGST: 0 };
  // sheet_to_json with header:1 gives array of arrays (0-indexed rows)
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  // Row 0: ['Meta Ads', '', 'Google Ads']
  // Row 1: ['Total Amount Spent', 22685.16]  <- Meta
  // Row 2: ['Total Amount Spent', 9158.77]   <- Google
  const metaExGST   = parseFloat(String(rows[1]?.[1] ?? 0)) || 0;
  const googleExGST = parseFloat(String(rows[2]?.[1] ?? 0)) || 0;
  return { metaExGST, googleExGST };
}

async function fetchLeads(): Promise<{
  leads: Lead[]; rawCount: number; dateFrom: string; dateTo: string; campaigns: Set<string>;
}> {
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
  const text = await res.text();
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) throw new Error('Empty leads sheet');

  const rawHeaders = parseCSVRow(lines[0]);
  const hMap: Record<string,number> = {};
  rawHeaders.forEach((h,i) => { hMap[h.replace(/"/g,'').trim().toLowerCase()] = i; });
  const col = (row: string[], key: string) => {
    const idx = hMap[key.toLowerCase().trim()];
    return idx !== undefined ? (row[idx]||'').replace(/"/g,'').trim() : '';
  };

  const leads: Lead[] = [];
  const allDates: string[] = [];
  const campaigns = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVRow(lines[i]);
    const name = col(row,'full_name');
    if (!name) continue;
    const ct = col(row,'created_time');
    if (ct) allDates.push(ct.split('T')[0]);
    const camp = col(row,'campaign_name');
    if (camp) campaigns.add(camp);
    const { status, revenue } = classifyStatus(col(row,'status'));
    leads.push({
      name,
      platform: col(row,'platform').toLowerCase() === 'ig' ? 'Instagram'
               : col(row,'platform').toLowerCase() === 'fb' ? 'Facebook' : 'Other',
      treatment: parseTreatment(col(row,'what_would_you_like_to_consult_for?')),
      location: col(row,'city'),
      status, revenue,
      statusNote: col(row,'status'),
    });
  }
  allDates.sort();
  return { leads, rawCount: lines.length - 1, dateFrom: allDates[0]||'', dateTo: allDates[allDates.length-1]||'', campaigns };
}

async function fetchAll(): Promise<ParsedData> {
  // Fetch in parallel
  const [spend, leadsData] = await Promise.all([fetchAdSpend(), fetchLeads()]);
  const { totalFee: agencyFee, billCount, nextBillDate } = calcAgencyFee();
  const metaSpendInGST   = spend.metaExGST   * (1 + GST);
  const googleSpendInGST = spend.googleExGST * (1 + GST);
  return {
    leads: leadsData.leads,
    metaSpendExGST:   spend.metaExGST,
    metaSpendInGST,
    googleSpendExGST: spend.googleExGST,
    googleSpendInGST,
    totalAdSpendExGST: spend.metaExGST + spend.googleExGST,
    totalAdSpendInGST: metaSpendInGST + googleSpendInGST,
    agencyFee, billCount, nextBillDate,
    lastUpdated: new Date(),
    rawCount: leadsData.rawCount,
    dateFrom: leadsData.dateFrom,
    dateTo: leadsData.dateTo,
    campaigns: leadsData.campaigns,
  };
}"""

# Find the section to replace - from top to end of old fetchAndParse
import re

# Find where the STATUS_CONFIG starts (that's where our new top ends)
marker = "const STATUS_CONFIG"
if marker not in old:
    print("ERROR: STATUS_CONFIG marker not found")
else:
    keep_from = old.index(marker)
    # Replace everything before STATUS_CONFIG
    new_content = new_top + "\n\n" + old[keep_from:]
    
    # Now update the component function to use the new data model
    # 1. Update fetchData call
    new_content = new_content.replace(
        "      const parsed = await fetchAndParse();",
        "      const parsed = await fetchAll();"
    )
    
    # 2. Update destructuring in component
    old_destr = "  const { leads, adSpend, agencyFee, billCount, nextBillDate, lastUpdated, rawCount, dateFrom, dateTo, campaigns } = data;"
    new_destr  = "  const { leads, metaSpendExGST, metaSpendInGST, googleSpendExGST, googleSpendInGST, totalAdSpendExGST, totalAdSpendInGST, agencyFee, billCount, nextBillDate, lastUpdated, rawCount, dateFrom, dateTo, campaigns } = data;"
    new_content = new_content.replace(old_destr, new_destr)

    # 3. Fix derived variables that used old adSpend
    old_derived = r"""  const totalSpend = adSpend + agencyFee;
  const converted = leads.filter(l => l.status === 'converted');
  const totalRevenue = converted.reduce((s, l) => s + l.revenue, 0);
  const netAdOnly = totalRevenue - adSpend;
  const netOverall = totalRevenue - totalSpend;
  const roas = adSpend > 0 ? ((totalRevenue / adSpend) * 100).toFixed(1) : '0';
  const roi = totalSpend > 0 ? (((totalRevenue - totalSpend) / totalSpend) * 100).toFixed(1) : '0';
  const N = leads.length;
  const cplAd = N > 0 ? Math.round(adSpend / N) : 0;
  const cpa = converted.length > 0 ? Math.round(adSpend / converted.length) : 0;
  const cvr = N > 0 ? ((converted.length / N) * 100).toFixed(1) : '0';
  const fbLeads = leads.filter(l => l.platform === 'Facebook');
  const igLeads = leads.filter(l => l.platform === 'Instagram');
  const fbRev = fbLeads.filter(l => l.status === 'converted').reduce((s,l) => s + l.revenue, 0);
  const igRev = igLeads.filter(l => l.status === 'converted').reduce((s,l) => s + l.revenue, 0);"""

    new_derived = r"""  const totalExpenditure = totalAdSpendInGST + agencyFee;
  const converted = leads.filter(l => l.status === 'converted');
  const totalRevenue = converted.reduce((s, l) => s + l.revenue, 0);
  const netAdOnly  = totalRevenue - totalAdSpendInGST;
  const netOverall = totalRevenue - totalExpenditure;
  // ROAS uses excl-GST spend (industry standard: actual platform spend)
  const roas = totalAdSpendExGST > 0 ? ((totalRevenue / totalAdSpendExGST) * 100).toFixed(1) : '0';
  const roi  = totalExpenditure  > 0 ? (((totalRevenue - totalExpenditure) / totalExpenditure) * 100).toFixed(1) : '0';
  const N   = leads.length;
  const cplMeta   = N > 0 ? Math.round(metaSpendInGST / N) : 0;
  const cpa       = converted.length > 0 ? Math.round(totalAdSpendInGST / converted.length) : 0;
  const cvr       = N > 0 ? ((converted.length / N) * 100).toFixed(1) : '0';
  const fbLeads   = leads.filter(l => l.platform === 'Facebook');
  const igLeads   = leads.filter(l => l.platform === 'Instagram');
  const fbRev     = fbLeads.filter(l => l.status === 'converted').reduce((s,l) => s + l.revenue, 0);
  const igRev     = igLeads.filter(l => l.status === 'converted').reduce((s,l) => s + l.revenue, 0);"""

    new_content = new_content.replace(old_derived, new_derived)

    # 4. Replace the KPI cards array
    old_cards_start = "  type Card = { label: string; value: string; sub: string; icon: React.ElementType; grad: string; ic: string };"
    old_cards_end   = "];"
    # Find the cards array and replace it
    cards_start_idx = new_content.index(old_cards_start)
    cards_end_idx   = new_content.index(old_cards_end, cards_start_idx) + len(old_cards_end)
    
    new_cards = r"""  type Card = { label: string; value: string; sub: string; icon: React.ElementType; grad: string; ic: string };
  const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
  const cards: Card[] = [
    // --- Ad Spend ---
    { label: 'Meta Ad Spend (excl. GST)', value: fmt(metaSpendExGST),   sub: `+18% GST = ${fmt(metaSpendInGST)}`,   icon: BarChart2,   grad:'from-blue-900/30 to-slate-900/60',    ic:'text-blue-400'    },
    { label: 'Google Ad Spend (excl. GST)',value: fmt(googleSpendExGST), sub: `+18% GST = ${fmt(googleSpendInGST)}`, icon: BarChart2,   grad:'from-sky-900/30 to-slate-900/60',     ic:'text-sky-400'     },
    { label: 'Total Ad Spend (incl. GST)', value: fmt(totalAdSpendInGST),sub: `Excl. GST: ${fmt(totalAdSpendExGST)}`,icon: DollarSign,  grad:'from-rose-900/30 to-slate-900/60',    ic:'text-rose-400'    },
    { label: `Agency Fee (${billCount} bill${billCount>1?'s':''})`,
      value: fmt(agencyFee),
      sub: `Next: ${nextBillDate.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}`,
                                                                          icon: DollarSign,  grad:'from-slate-800/80 to-slate-900/60',   ic:'text-slate-300'   },
    { label: 'Total Expenditure',          value: fmt(totalExpenditure), sub: 'Ad Spend + Agency Fee',               icon: TrendingDown, grad:'from-rose-900/40 to-slate-900/60',   ic:'text-rose-400'    },
    // --- Revenue ---
    { label: 'Revenue Generated',          value: fmt(totalRevenue),     sub: `${converted.length} paying clients`, icon: TrendingUp,  grad:'from-emerald-900/30 to-slate-900/60', ic:'text-emerald-400' },
    { label: 'Net (Ad Spend incl. GST)',   value: `${netAdOnly>=0?'+':''}${fmt(Math.abs(netAdOnly))}`,
      sub: netAdOnly>=0 ? '✅ Profitable on ads' : '❌ Loss on ads',
                                                                          icon: netAdOnly>=0?TrendingUp:TrendingDown,
                                                                          grad: netAdOnly>=0?'from-emerald-900/25 to-slate-900/60':'from-rose-900/25 to-slate-900/60',
                                                                          ic:   netAdOnly>=0?'text-emerald-400':'text-rose-400' },
    { label: 'Net (Overall)',              value: `${netOverall>=0?'+':'-'}${fmt(Math.abs(netOverall))}`,
      sub: netOverall>=0 ? '✅ Overall profit' : '❌ Deficit incl. agency',
                                                                          icon: netOverall>=0?TrendingUp:TrendingDown,
                                                                          grad: netOverall>=0?'from-emerald-900/25 to-slate-900/60':'from-rose-900/25 to-slate-900/60',
                                                                          ic:   netOverall>=0?'text-emerald-400':'text-rose-400' },
    { label: 'ROAS (excl. GST basis)',     value: `${roas}%`,            sub: parseFloat(roas)>=100?'Positive return':'Below breakeven',
                                                                          icon: Percent,    grad: parseFloat(roas)>=100?'from-cyan-900/25 to-slate-900/60':'from-rose-900/25 to-slate-900/60',
                                                                          ic:   parseFloat(roas)>=100?'text-cyan-400':'text-rose-400' },
    { label: 'Overall ROI',                value: `${roi}%`,             sub: 'Incl. agency + GST',
                                                                          icon: Percent,    grad: parseFloat(roi)>=0?'from-cyan-900/25 to-slate-900/60':'from-rose-900/25 to-slate-900/60',
                                                                          ic:   parseFloat(roi)>=0?'text-cyan-400':'text-rose-400' },
    { label: 'Unique Leads',              value: String(N),              sub: `${rawCount} raw form submissions`,   icon: Users,       grad:'from-indigo-900/25 to-slate-900/60',  ic:'text-indigo-400'  },
    { label: 'Converted Clients',         value: String(converted.length),sub:`${cvr}% conversion rate`,           icon: Target,      grad:'from-purple-900/25 to-slate-900/60',  ic:'text-purple-400'  },
    { label: 'CPL (Meta incl. GST)',      value: fmt(cplMeta),           sub: 'Cost per unique lead',              icon: DollarSign,  grad:'from-amber-900/25 to-slate-900/60',   ic:'text-amber-400'   },
    { label: 'CPA (Total Ad Spend)',      value: fmt(cpa),               sub: 'Cost per paying client',            icon: Target,      grad:'from-amber-900/25 to-slate-900/60',   ic:'text-amber-400'   },
  ];"""

    new_content = new_content[:cards_start_idx] + new_cards + new_content[cards_end_idx:]

    # 5. Fix insight banner
    old_insight = r"""        <p className="text-[11px] text-slate-400 leading-relaxed">
          On ad spend alone the campaign is <strong className="text-white">profitable</strong> (ROAS {roas}%, net +₹{Math.abs(netAdOnly).toLocaleString('en-IN')}).
          The agency fee of ₹29,500 creates an overall deficit of ₹{Math.abs(netOverall).toLocaleString('en-IN')}.
          <strong className="text-white"> Facebook drives {fbRev > 0 ? Math.round(fbRev / totalRevenue * 100) : 99}% of revenue</strong> vs Instagram.
          {(statusCount['warm'] || 0)} warm pipeline leads represent significant deferred revenue potential.
        </p>"""

    new_insight = r"""        <p className="text-[11px] text-slate-400 leading-relaxed">
          Total ad spend (Meta + Google) is <strong className="text-white">₹{Math.round(totalAdSpendExGST).toLocaleString('en-IN')} excl. GST</strong> (₹{Math.round(totalAdSpendInGST).toLocaleString('en-IN')} incl. 18% GST).
          On ad spend the campaign is {netAdOnly >= 0 ? <strong className="text-emerald-400">profitable</strong> : <strong className="text-rose-400">at a loss</strong>} (ROAS {roas}%).
          Combined with ₹{agencyFee.toLocaleString('en-IN')} agency fee, overall net is {netOverall >= 0 ? '+' : '-'}₹{Math.abs(netOverall).toLocaleString('en-IN')}.
          <strong className="text-white"> Facebook drives {totalRevenue > 0 ? Math.round(fbRev / totalRevenue * 100) : 99}% of revenue.</strong>&nbsp;
          {(statusCount['warm'] || 0)} warm pipeline leads represent significant pending revenue.
        </p>"""

    new_content = new_content.replace(old_insight, new_insight)

    # 6. Fix the cplAd reference used in old platform section (now cplMeta)
    new_content = new_content.replace('cplAd', 'cplMeta')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("✅ AdAgencyAnalytics.tsx rewritten with live spend from Amount Spent sheet!")
    print(f"   New file size: {len(new_content):,} chars")
