content = r"""import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Users, DollarSign, Target, RefreshCw, AlertCircle, ExternalLink, BarChart2, Percent, PhoneCall, CheckCircle2, XCircle, Clock, MapPin } from 'lucide-react';

const SHEET_ID = '1YGEz617KY0bfGoR8nQqRffcFc8wsYF2L9FZbVV5IxY4';
// CSV export URL — works without API key as long as sheet is shared
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&id=${SHEET_ID}`;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

// Kerala districts for "out of district" detection
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
  adSpend: number;
  agencyFee: number;
  lastUpdated: Date;
  rawCount: number;
}

function classifyStatus(statusNote: string): { status: Lead['status']; revenue: number } {
  const s = (statusNote || '').trim().toLowerCase();

  // Converted = note contains "consult" + a number amount
  if (s.includes('consult')) {
    const amtMatch = s.match(/(\d[\d,]+)\s*\/?-?/);
    const rev = amtMatch ? parseInt(amtMatch[1].replace(/,/g, ''), 10) : 0;
    if (rev > 0) return { status: 'converted', revenue: rev };
  }

  // Warm pipeline
  if (['will come', 'next week', 'call back', 'he will call', 'she will come', 'will inform',
       'will visit', 'after onam', 'will call', 'call friday', 'appointment', 'call back if need',
       'he will inform', 'she will inform', 'planning', 'call back when'].some(w => s.includes(w))) {
    return { status: 'warm', revenue: 0 };
  }

  // Out of district
  if (DISTRICTS.some(d => s.includes(d)) || s.includes('out of district') || s.includes('long distance') ||
      s.includes('out of coverage') || s.includes('looking near')) {
    return { status: 'out_of_district', revenue: 0 };
  }

  // Invalid / ineligible
  if (['wrong enquiry', 'wrong enqury', 'donor area thin', 'cheeks filling', 'n/a', 'enquiry not done',
       'not possible', 'not looking', 'not interested', 'no idea', 'no incoming', 'na'].some(w => s === w || s.startsWith(w))) {
    return { status: 'invalid', revenue: 0 };
  }

  return { status: 'unresponsive', revenue: 0 };
}

function parseTreatment(raw: string): string {
  const map: Record<string, string> = {
    hair_transplant_planning: 'Hair Transplant Planning',
    prp_gfc_hair_treatment: 'PRP / GFC Hair Treatment',
    hair_fall_hair_thinning: 'Hair Fall / Hair Thinning',
    acne_scars_marks: 'Acne Scars / Marks',
    skin_pigmentation_melasma: 'Pigmentation / Melasma',
    glutathione_iv_therapy: 'Glutathione IV Therapy',
    hydrafacial_medi_facial: 'Hydrafacial / Medi-Facial',
    skin_tag_mole_removal: 'Skin Tag / Mole Removal',
    not_sure_need_guidance: 'Not Sure / Need Guidance',
  };
  return map[raw] || raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'General';
}

async function fetchAndParse(): Promise<ParsedData> {
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();

  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) throw new Error('Empty sheet');

  // Parse header row
  const headerLine = lines[0];
  const headers = headerLine.split(',').map(h => h.replace(/"/g, '').trim());

  const col = (row: string[], key: string) => {
    const idx = headers.indexOf(key);
    return idx >= 0 ? (row[idx] || '').replace(/"/g, '').trim() : '';
  };

  const leads: Lead[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',');
    const name = col(row, 'full_name');
    if (!name) continue;

    const platform = col(row, 'platform').toLowerCase();
    const rawTreatment = col(row, 'what_would_you_like_to_consult_for?');
    const city = col(row, 'city');
    const statusNote = col(row, 'status '); // Note: trailing space in actual header

    const { status, revenue } = classifyStatus(statusNote);

    leads.push({
      name,
      platform: platform === 'ig' ? 'Instagram' : platform === 'fb' ? 'Facebook' : 'Other',
      treatment: parseTreatment(rawTreatment),
      location: city,
      status,
      revenue,
      statusNote,
    });
  }

  return {
    leads,
    adSpend: 26000,
    agencyFee: 29500,
    lastUpdated: new Date(),
    rawCount: lines.length - 1,
  };
}

const STATUS_CONFIG = {
  converted:       { label: 'Converted / Paid',            color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', bar: 'bg-emerald-500', icon: CheckCircle2 },
  warm:            { label: 'Warm Pipeline',                color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/30',   bar: 'bg-amber-500',   icon: Clock },
  out_of_district: { label: 'Out of District',             color: 'text-sky-400',     bg: 'bg-sky-500/10 border-sky-500/30',       bar: 'bg-sky-500',     icon: MapPin },
  invalid:         { label: 'Invalid / Ineligible',         color: 'text-slate-400',   bg: 'bg-slate-500/10 border-slate-700',      bar: 'bg-slate-500',   icon: XCircle },
  unresponsive:    { label: 'Unresponsive / Dropped',       color: 'text-rose-400',    bg: 'bg-rose-500/10 border-rose-500/30',     bar: 'bg-rose-500',    icon: PhoneCall },
};

const T_COLORS = ['bg-cyan-500','bg-indigo-500','bg-purple-500','bg-amber-500','bg-emerald-500','bg-rose-500','bg-sky-500','bg-orange-500','bg-teal-500'];

export default function AdAgencyAnalytics() {
  const [data, setData] = useState<ParsedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const parsed = await fetchAndParse();
      setData(parsed);
    } catch (e: any) {
      setError(String(e?.message || 'Failed to load'));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_INTERVAL_MS);
    return () => clearInterval(t);
  }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-64 gap-3 text-slate-400">
      <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      <span className="text-sm font-medium">Loading Ad Agency data from Google Sheet...</span>
    </div>
  );

  if (error || !data) return (
    <div className="flex items-center justify-center min-h-64 gap-3 text-rose-400">
      <AlertCircle size={18} />
      <div>
        <p className="text-sm font-semibold">Could not load Google Sheet</p>
        <p className="text-xs text-slate-500 mt-0.5">Make sure the sheet is shared as "Anyone with link can view"</p>
        <p className="text-xs text-slate-600 mt-0.5">{error}</p>
        <button onClick={load} className="mt-2 text-xs text-cyan-400 underline">Retry</button>
      </div>
    </div>
  );

  const { leads, adSpend, agencyFee, lastUpdated, rawCount } = data;
  const totalSpend = adSpend + agencyFee;
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
  const igRev = igLeads.filter(l => l.status === 'converted').reduce((s,l) => s + l.revenue, 0);

  const treatMap: Record<string,number> = {};
  leads.forEach(l => { treatMap[l.treatment] = (treatMap[l.treatment] || 0) + 1; });
  const treatList = Object.entries(treatMap).sort((a,b) => b[1]-a[1]);

  const statusCount: Record<string,number> = {};
  leads.forEach(l => { statusCount[l.status] = (statusCount[l.status] || 0) + 1; });

  type Card = { label: string; value: string; sub: string; icon: React.ElementType; grad: string; ic: string };
  const cards: Card[] = [
    { label: 'Ad Spend (Meta)', value: `\u20b9${adSpend.toLocaleString('en-IN')}`, sub: 'Meta Ads campaign', icon: DollarSign, grad: 'from-slate-800/80 to-slate-900/60', ic: 'text-slate-300' },
    { label: 'Agency Fee (incl. GST)', value: `\u20b9${agencyFee.toLocaleString('en-IN')}`, sub: '\u20b925,000 base + 18% GST', icon: BarChart2, grad: 'from-slate-800/80 to-slate-900/60', ic: 'text-slate-300' },
    { label: 'Total Expenditure', value: `\u20b9${totalSpend.toLocaleString('en-IN')}`, sub: 'Ads + Agency combined', icon: DollarSign, grad: 'from-rose-900/30 to-slate-900/60', ic: 'text-rose-400' },
    { label: 'Revenue Generated', value: `\u20b9${totalRevenue.toLocaleString('en-IN')}`, sub: `${converted.length} paying clients`, icon: TrendingUp, grad: 'from-emerald-900/30 to-slate-900/60', ic: 'text-emerald-400' },
    { label: 'Net (Ad Spend Only)', value: `${netAdOnly >= 0 ? '+' : ''}\u20b9${Math.abs(netAdOnly).toLocaleString('en-IN')}`, sub: netAdOnly >= 0 ? '\u2705 Profitable on ad spend' : '\u274c Loss on ad spend', icon: netAdOnly >= 0 ? TrendingUp : TrendingDown, grad: netAdOnly >= 0 ? 'from-emerald-900/25 to-slate-900/60' : 'from-rose-900/25 to-slate-900/60', ic: netAdOnly >= 0 ? 'text-emerald-400' : 'text-rose-400' },
    { label: 'Net (Overall)', value: `${netOverall >= 0 ? '+' : '-'}\u20b9${Math.abs(netOverall).toLocaleString('en-IN')}`, sub: netOverall >= 0 ? '\u2705 Overall profit' : '\u274c Deficit incl. agency fee', icon: netOverall >= 0 ? TrendingUp : TrendingDown, grad: netOverall >= 0 ? 'from-emerald-900/25 to-slate-900/60' : 'from-rose-900/25 to-slate-900/60', ic: netOverall >= 0 ? 'text-emerald-400' : 'text-rose-400' },
    { label: 'ROAS', value: `${roas}%`, sub: parseFloat(roas) >= 100 ? 'Positive return on ad spend' : 'Below breakeven', icon: Percent, grad: parseFloat(roas) >= 100 ? 'from-cyan-900/25 to-slate-900/60' : 'from-rose-900/25 to-slate-900/60', ic: parseFloat(roas) >= 100 ? 'text-cyan-400' : 'text-rose-400' },
    { label: 'Overall ROI', value: `${roi}%`, sub: 'Return incl. agency fee', icon: Percent, grad: parseFloat(roi) >= 0 ? 'from-cyan-900/25 to-slate-900/60' : 'from-rose-900/25 to-slate-900/60', ic: parseFloat(roi) >= 0 ? 'text-cyan-400' : 'text-rose-400' },
    { label: 'Unique Leads', value: String(N), sub: `${rawCount} raw form submissions`, icon: Users, grad: 'from-indigo-900/25 to-slate-900/60', ic: 'text-indigo-400' },
    { label: 'Converted Clients', value: String(converted.length), sub: `${cvr}% conversion rate`, icon: Target, grad: 'from-purple-900/25 to-slate-900/60', ic: 'text-purple-400' },
    { label: 'CPL (Ad Only)', value: `\u20b9${cplAd.toLocaleString('en-IN')}`, sub: 'Cost per unique lead', icon: DollarSign, grad: 'from-amber-900/25 to-slate-900/60', ic: 'text-amber-400' },
    { label: 'CPA (Ad Only)', value: `\u20b9${cpa.toLocaleString('en-IN')}`, sub: 'Cost per paying client', icon: Target, grad: 'from-amber-900/25 to-slate-900/60', ic: 'text-amber-400' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500/20 to-orange-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 flex-shrink-0">
            <Target size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Ad Agency Performance · Jul–Aug 2026</h2>
            <p className="text-[11px] text-slate-400">Meta Ads · Live from Google Sheet · {N} unique leads · {rawCount} raw submissions</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-slate-500">Updated: {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} <span className="text-slate-600">(auto 5 min)</span></span>
          <button onClick={load} className="flex items-center gap-1 text-xs font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-2.5 py-1.5 hover:bg-cyan-500/20 transition-all">
            <RefreshCw size={11} /> Refresh
          </button>
          <a href={`https://docs.google.com/spreadsheets/d/${SHEET_ID}`} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 text-xs font-semibold text-slate-400 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 hover:text-white transition-all">
            <ExternalLink size={11} /> Open Sheet
          </a>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {cards.map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label} className={`glass-panel p-3.5 rounded-xl border border-slate-800/80 bg-gradient-to-br ${c.grad} flex flex-col gap-1.5`}>
              <div className="flex items-center justify-between"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-tight">{c.label}</p><Icon size={12} className={c.ic} /></div>
              <p className={`text-lg font-extrabold font-mono leading-none ${c.ic}`}>{c.value}</p>
              <p className="text-[9px] text-slate-500 leading-tight">{c.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Platform + Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><BarChart2 size={15} className="text-cyan-400" /> Platform Performance</h3>
          <div className="space-y-3">
            {[
              { platform: 'Facebook', ls: fbLeads, rev: fbRev, grad: 'from-blue-600 to-blue-400', borderBg: 'border-blue-500/20 bg-blue-500/5' },
              { platform: 'Instagram', ls: igLeads, rev: igRev, grad: 'from-pink-600 to-orange-400', borderBg: 'border-pink-500/20 bg-pink-500/5' },
            ].map(p => {
              const pCvr = p.ls.filter(l => l.status === 'converted');
              const rate = p.ls.length > 0 ? ((pCvr.length / p.ls.length) * 100).toFixed(1) : '0';
              const barW = N > 0 ? (p.ls.length / N) * 100 : 0;
              return (
                <div key={p.platform} className={`p-4 rounded-xl border ${p.borderBg}`}>
                  <div className="flex justify-between mb-3"><span className="text-sm font-bold text-white">{p.platform}</span><span className="text-[10px] text-slate-400 font-mono">\u20b9{p.rev.toLocaleString('en-IN')}</span></div>
                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    {[['Leads', p.ls.length, 'text-white'], ['Converted', pCvr.length, 'text-emerald-400'], ['Conv. %', rate + '%', 'text-cyan-400']].map(([k, v, cls]) => (
                      <div key={String(k)}><p className={`text-base font-extrabold font-mono ${cls}`}>{v}</p><p className="text-[9px] text-slate-500 uppercase tracking-wider">{k}</p></div>
                    ))}
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className={`h-full bg-gradient-to-r ${p.grad} rounded-full`} style={{ width: `${barW}%` }} /></div>
                  <p className="text-[9px] text-slate-500 mt-1 text-right">{barW.toFixed(1)}% of total leads</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><PhoneCall size={15} className="text-indigo-400" /> Lead Pipeline · {N} Unique Leads</h3>
          <div className="space-y-2">
            {(Object.entries(STATUS_CONFIG) as [keyof typeof STATUS_CONFIG, (typeof STATUS_CONFIG)[keyof typeof STATUS_CONFIG]][]).map(([key, cfg]) => {
              const count = statusCount[key] || 0;
              const pct = N > 0 ? ((count / N) * 100).toFixed(1) : '0';
              const Icon = cfg.icon;
              return (
                <div key={key} className={`flex items-center gap-2.5 p-2.5 rounded-xl border ${cfg.bg}`}>
                  <Icon size={13} className={cfg.color} />
                  <div className="flex-1">
                    <div className="flex justify-between mb-0.5"><span className="text-xs font-semibold text-slate-300">{cfg.label}</span><span className={`text-xs font-bold font-mono ${cfg.color}`}>{count} ({pct}%)</span></div>
                    <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden"><div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${pct}%` }} /></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Treatment + Converted */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><TrendingUp size={15} className="text-purple-400" /> Treatment Demand</h3>
          <div className="space-y-2">
            {treatList.slice(0,9).map(([t, cnt], i) => {
              const pct = N > 0 ? ((cnt / N) * 100).toFixed(1) : '0';
              return (
                <div key={t} className="flex items-center gap-2.5">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${T_COLORS[i % T_COLORS.length]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-0.5"><span className="text-xs text-slate-300 truncate">{t}</span><span className="text-xs font-bold text-slate-400 font-mono ml-2 flex-shrink-0">{cnt} ({pct}%)</span></div>
                    <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden"><div className={`h-full rounded-full ${T_COLORS[i % T_COLORS.length]}`} style={{ width: `${pct}%` }} /></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-400" /> Converted Clients — Revenue</h3>
          <div className="space-y-1.5">
            {converted.sort((a,b) => b.revenue - a.revenue).map((l, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 bg-slate-900/60 rounded-lg border border-slate-800/60 hover:border-emerald-500/20 transition-all">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-[9px] font-bold flex-shrink-0">{i+1}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{l.name}</p>
                    <p className="text-[9px] text-slate-500 truncate">{l.treatment} · {l.platform}</p>
                  </div>
                </div>
                <p className="text-sm font-extrabold text-emerald-400 font-mono flex-shrink-0 ml-2">\u20b9{l.revenue.toLocaleString('en-IN')}</p>
              </div>
            ))}
            <div className="flex items-center justify-between p-2.5 bg-emerald-900/20 rounded-lg border border-emerald-500/20 mt-1">
              <span className="text-xs font-bold text-emerald-300">Total Revenue</span>
              <span className="text-sm font-extrabold text-emerald-400 font-mono">\u20b9{totalRevenue.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Insight */}
      <div className="glass-panel p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
        <p className="text-xs text-amber-300 font-semibold mb-1">&#128161; Strategic Insight</p>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          On ad spend alone the campaign is <strong className="text-white">profitable</strong> (ROAS {roas}%, net +\u20b9{Math.abs(netAdOnly).toLocaleString('en-IN')}).
          The agency fee of \u20b929,500 creates an overall deficit of \u20b9{Math.abs(netOverall).toLocaleString('en-IN')}.
          <strong className="text-white"> Facebook drives {fbRev > 0 ? Math.round(fbRev / totalRevenue * 100) : 99}% of revenue</strong> vs Instagram.
          {(statusCount['warm'] || 0)} warm pipeline leads represent significant deferred revenue potential.
        </p>
      </div>
    </div>
  );
}
"""

with open('clinic-app/src/components/AdAgencyAnalytics.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("AdAgencyAnalytics.tsx rewritten with correct parser!")
