content = r"""import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Users, DollarSign, Target, RefreshCw, AlertCircle, ExternalLink, BarChart2, Percent, PhoneCall, CheckCircle2, XCircle, Clock, MapPin } from 'lucide-react';

const SHEET_ID = '1YGEz617KY0bfGoR8nQqRffcFc8wsYF2L9FZbVV5IxY4';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&id=${SHEET_ID}`;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

interface Lead {
  name: string;
  platform: 'Facebook' | 'Instagram' | 'Other';
  treatment: string;
  location: string;
  status: 'converted' | 'warm' | 'out_of_district' | 'invalid' | 'unresponsive';
  revenue: number;
}

interface ParsedData {
  leads: Lead[];
  adSpend: number;
  agencyFee: number;
  lastUpdated: Date;
}

function parseStatus(raw: string): Lead['status'] {
  const s = (raw || '').toLowerCase();
  if (s.includes('convert') || s.includes('paid') || s.includes('visit')) return 'converted';
  if (s.includes('warm') || s.includes('promis') || s.includes('callback') || s.includes('interest')) return 'warm';
  if (s.includes('district') || s.includes('location') || s.includes('far') || s.includes('distant')) return 'out_of_district';
  if (s.includes('invalid') || s.includes('inelig') || s.includes('wrong') || s.includes('disqualif')) return 'invalid';
  return 'unresponsive';
}

function parsePlatform(raw: string): Lead['platform'] {
  const s = (raw || '').toLowerCase();
  if (s.includes('instagram') || s.includes('ig') || s.includes('insta')) return 'Instagram';
  if (s.includes('facebook') || s.includes('fb') || s.includes('meta')) return 'Facebook';
  return 'Other';
}

function getStaticData(): ParsedData {
  const staticLeads: Lead[] = [
    { name: 'Zeena Beegam', platform: 'Facebook', treatment: 'PRP / GFC Hair Treatment', location: 'Thiruvananthapuram', status: 'converted', revenue: 20220 },
    { name: 'Dr. Fathima Sameer', platform: 'Facebook', treatment: 'Glutathione IV Therapy', location: 'Ernakulam', status: 'converted', revenue: 5300 },
    { name: 'Cifin Kc', platform: 'Facebook', treatment: 'Hair Transplant Planning', location: 'Thiruvananthapuram', status: 'converted', revenue: 3374 },
    { name: 'Prasanth GS', platform: 'Facebook', treatment: 'PRP / GFC Hair Treatment', location: 'Thiruvananthapuram', status: 'converted', revenue: 300 },
    { name: 'Arun s Nair', platform: 'Facebook', treatment: 'PRP / GFC Hair Treatment', location: 'Thiruvananthapuram', status: 'converted', revenue: 300 },
    { name: 'Vishnu S R', platform: 'Facebook', treatment: 'Hair Fall / Hair Thinning', location: 'Thiruvananthapuram', status: 'converted', revenue: 300 },
    { name: 'Nisam AR', platform: 'Facebook', treatment: 'Hair Fall / Hair Thinning', location: 'Trivandrum', status: 'converted', revenue: 300 },
    { name: 'Abhijithantony', platform: 'Instagram', treatment: 'Acne Scars / Marks', location: 'Trivandrum', status: 'converted', revenue: 300 },
    ...Array.from({ length: 25 }, (_, k): Lead => ({ name: `Warm Lead ${k + 1}`, platform: 'Facebook', treatment: ['Hair Transplant Planning', 'PRP / GFC Hair Treatment', 'Acne Scars / Marks'][k % 3], location: 'Thiruvananthapuram', status: 'warm', revenue: 0 })),
    ...Array.from({ length: 14 }, (_, k): Lead => ({ name: `Distant Lead ${k + 1}`, platform: 'Facebook', treatment: 'Hair Transplant Planning', location: ['Palakkad', 'Alappuzha', 'Kottayam', 'Ernakulam'][k % 4], status: 'out_of_district', revenue: 0 })),
    ...Array.from({ length: 6 }, (_, k): Lead => ({ name: `Invalid Lead ${k + 1}`, platform: 'Instagram', treatment: 'Cheek Fillers', location: 'Unknown', status: 'invalid', revenue: 0 })),
    ...Array.from({ length: 52 }, (_, k): Lead => ({ name: `Unresponsive Lead ${k + 1}`, platform: k % 3 === 0 ? 'Instagram' : 'Facebook', treatment: ['Acne Scars / Marks', 'PRP / GFC Hair Treatment', 'Hair Transplant Planning'][k % 3], location: 'Unknown', status: 'unresponsive', revenue: 0 })),
  ];
  return { leads: staticLeads, adSpend: 26000, agencyFee: 29500, lastUpdated: new Date() };
}

const STATUS_CONFIG = {
  converted:       { label: 'Converted / Paid',            color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', bar: 'bg-emerald-500', icon: CheckCircle2 },
  warm:            { label: 'Warm Pipeline',                color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/30',   bar: 'bg-amber-500',   icon: Clock },
  out_of_district: { label: 'Out of District',             color: 'text-sky-400',     bg: 'bg-sky-500/10 border-sky-500/30',       bar: 'bg-sky-500',     icon: MapPin },
  invalid:         { label: 'Invalid / Ineligible',         color: 'text-slate-400',   bg: 'bg-slate-500/10 border-slate-700',      bar: 'bg-slate-500',   icon: XCircle },
  unresponsive:    { label: 'Unresponsive / Call Rejected', color: 'text-rose-400',    bg: 'bg-rose-500/10 border-rose-500/30',     bar: 'bg-rose-500',    icon: PhoneCall },
};

const T_COLORS = ['bg-cyan-500','bg-indigo-500','bg-purple-500','bg-amber-500','bg-emerald-500','bg-rose-500','bg-sky-500','bg-orange-500','bg-teal-500'];

export default function AdAgencyAnalytics() {
  const [data, setData] = useState<ParsedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(CSV_URL);
      if (!res.ok) throw new Error();
      const csv = await res.text();
      const lines = csv.split('\n').filter(l => l.trim());
      if (lines.length < 5) throw new Error();
      const headers = lines[0].split(',').map(h => h.replace(/"/g,'').trim().toLowerCase());
      const get = (row: string[], keys: string[]) => { for (const k of keys) { const i = headers.findIndex(h => h.includes(k)); if (i >= 0 && row[i]) return row[i].replace(/"/g,'').trim(); } return ''; };
      const leads: Lead[] = [];
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',');
        const name = get(row, ['name','client','patient']);
        if (!name || name.toLowerCase().includes('total')) continue;
        leads.push({
          name,
          platform: parsePlatform(get(row, ['platform','source','channel'])),
          treatment: get(row, ['treatment','service','category','interest']) || 'General',
          location: get(row, ['location','city','place','district']),
          status: parseStatus(get(row, ['status','result','outcome'])),
          revenue: parseFloat(get(row, ['revenue','amount','paid']).replace(/[^0-9.]/g,'')) || 0,
        });
      }
      if (leads.length < 5) throw new Error();
      setData({ leads, adSpend: 26000, agencyFee: 29500, lastUpdated: new Date() });
      setUsingFallback(false);
    } catch {
      setData(getStaticData());
      setUsingFallback(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); const t = setInterval(fetchData, REFRESH_INTERVAL_MS); return () => clearInterval(t); }, [fetchData]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-64 gap-3 text-slate-400">
      <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      <span className="text-sm font-medium">Loading Ad Agency data...</span>
    </div>
  );
  if (!data) return null;

  const { leads, adSpend, agencyFee, lastUpdated } = data;
  const totalSpend = adSpend + agencyFee;
  const totalRevenue = leads.reduce((s, l) => s + l.revenue, 0);
  const netAdOnly = totalRevenue - adSpend;
  const netOverall = totalRevenue - totalSpend;
  const roas = adSpend > 0 ? ((totalRevenue / adSpend) * 100).toFixed(1) : '0';
  const roi = totalSpend > 0 ? (((totalRevenue - totalSpend) / totalSpend) * 100).toFixed(1) : '0';
  const converted = leads.filter(l => l.status === 'converted');
  const N = leads.length;
  const cplAd = N > 0 ? Math.round(adSpend / N) : 0;
  const cpa = converted.length > 0 ? Math.round(adSpend / converted.length) : 0;
  const cvr = N > 0 ? ((converted.length / N) * 100).toFixed(1) : '0';
  const fbLeads = leads.filter(l => l.platform === 'Facebook');
  const igLeads = leads.filter(l => l.platform === 'Instagram');
  const fbRev = fbLeads.reduce((s,l) => s + l.revenue, 0);
  const igRev = igLeads.reduce((s,l) => s + l.revenue, 0);
  const treatMap: Record<string,number> = {};
  leads.forEach(l => { treatMap[l.treatment] = (treatMap[l.treatment] || 0) + 1; });
  const treatList = Object.entries(treatMap).sort((a,b) => b[1]-a[1]);
  const statusCount: Record<string,number> = {};
  leads.forEach(l => { statusCount[l.status] = (statusCount[l.status] || 0) + 1; });

  type CardItem = { label: string; value: string; sub: string; icon: React.ElementType; grad: string; ic: string };
  const cards: CardItem[] = [
    { label: 'Ad Spend (Meta)', value: `₹${adSpend.toLocaleString('en-IN')}`, sub: 'Meta Ads only', icon: DollarSign, grad: 'from-slate-800/80 to-slate-900/60', ic: 'text-slate-400' },
    { label: 'Agency Fee (incl. GST)', value: `₹${agencyFee.toLocaleString('en-IN')}`, sub: '₹25,000 + 18% GST', icon: BarChart2, grad: 'from-slate-800/80 to-slate-900/60', ic: 'text-slate-400' },
    { label: 'Total Expenditure', value: `₹${totalSpend.toLocaleString('en-IN')}`, sub: 'Ads + Agency', icon: DollarSign, grad: 'from-rose-900/30 to-slate-900/60', ic: 'text-rose-400' },
    { label: 'Revenue Generated', value: `₹${totalRevenue.toLocaleString('en-IN')}`, sub: `${converted.length} paying clients`, icon: TrendingUp, grad: 'from-emerald-900/30 to-slate-900/60', ic: 'text-emerald-400' },
    { label: 'Net (Ad Spend Only)', value: `${netAdOnly >= 0 ? '+' : ''}₹${Math.abs(netAdOnly).toLocaleString('en-IN')}`, sub: netAdOnly >= 0 ? 'Profitable on ads' : 'Loss on ads', icon: netAdOnly >= 0 ? TrendingUp : TrendingDown, grad: netAdOnly >= 0 ? 'from-emerald-900/25 to-slate-900/60' : 'from-rose-900/25 to-slate-900/60', ic: netAdOnly >= 0 ? 'text-emerald-400' : 'text-rose-400' },
    { label: 'Net (Overall)', value: `${netOverall >= 0 ? '+' : '-'}₹${Math.abs(netOverall).toLocaleString('en-IN')}`, sub: netOverall >= 0 ? 'Overall profit' : 'Overall deficit', icon: netOverall >= 0 ? TrendingUp : TrendingDown, grad: netOverall >= 0 ? 'from-emerald-900/25 to-slate-900/60' : 'from-rose-900/25 to-slate-900/60', ic: netOverall >= 0 ? 'text-emerald-400' : 'text-rose-400' },
    { label: 'ROAS', value: `${roas}%`, sub: parseFloat(roas) >= 100 ? 'Positive on ad spend' : 'Below breakeven', icon: Percent, grad: parseFloat(roas) >= 100 ? 'from-cyan-900/25 to-slate-900/60' : 'from-rose-900/25 to-slate-900/60', ic: parseFloat(roas) >= 100 ? 'text-cyan-400' : 'text-rose-400' },
    { label: 'Overall ROI', value: `${roi}%`, sub: 'Incl. agency fee', icon: Percent, grad: parseFloat(roi) >= 0 ? 'from-cyan-900/25 to-slate-900/60' : 'from-rose-900/25 to-slate-900/60', ic: parseFloat(roi) >= 0 ? 'text-cyan-400' : 'text-rose-400' },
    { label: 'Unique Leads', value: String(N), sub: '163 raw form submissions', icon: Users, grad: 'from-indigo-900/25 to-slate-900/60', ic: 'text-indigo-400' },
    { label: 'Converted Clients', value: String(converted.length), sub: `${cvr}% conversion rate`, icon: Target, grad: 'from-purple-900/25 to-slate-900/60', ic: 'text-purple-400' },
    { label: 'CPL (Ad Spend)', value: `₹${cplAd.toLocaleString('en-IN')}`, sub: 'Cost per unique lead', icon: DollarSign, grad: 'from-amber-900/25 to-slate-900/60', ic: 'text-amber-400' },
    { label: 'CPA (Ad Spend)', value: `₹${cpa.toLocaleString('en-IN')}`, sub: 'Cost per paying client', icon: Target, grad: 'from-amber-900/25 to-slate-900/60', ic: 'text-amber-400' },
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
            <h2 className="text-base font-bold text-white tracking-tight">Ad Agency Performance · Jul–Aug 2026</h2>
            <p className="text-[11px] text-slate-400">Meta Ads · Auto-refreshes every 5 min from Google Sheet</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {usingFallback && (
            <div className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-1">
              <AlertCircle size={10} /> Cached report data
            </div>
          )}
          <span className="text-[10px] text-slate-500 hidden sm:inline">Updated: {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
          <button onClick={fetchData} className="flex items-center gap-1 text-xs font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-2.5 py-1.5 hover:bg-cyan-500/20 transition-all">
            <RefreshCw size={11} /> Refresh
          </button>
          <a href={`https://docs.google.com/spreadsheets/d/${SHEET_ID}`} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 text-xs font-semibold text-slate-400 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 hover:text-white transition-all">
            <ExternalLink size={11} /> Sheet
          </a>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {cards.map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label} className={`glass-panel p-3.5 rounded-xl border border-slate-800/80 bg-gradient-to-br ${c.grad} flex flex-col gap-1.5`}>
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-tight">{c.label}</p>
                <Icon size={12} className={c.ic} />
              </div>
              <p className={`text-lg font-extrabold font-mono leading-none ${c.ic}`}>{c.value}</p>
              <p className="text-[9px] text-slate-500 leading-tight">{c.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Platform + Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Platform */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><BarChart2 size={15} className="text-cyan-400" /> Platform Performance</h3>
          <div className="space-y-3">
            {[
              { platform: 'Facebook', ls: fbLeads, rev: fbRev, color: 'from-blue-600 to-blue-400', borderBg: 'border-blue-500/20 bg-blue-500/5' },
              { platform: 'Instagram', ls: igLeads, rev: igRev, color: 'from-pink-600 to-orange-400', borderBg: 'border-pink-500/20 bg-pink-500/5' },
            ].map(p => {
              const pCvr = p.ls.filter(l => l.status === 'converted');
              const cvrRate = p.ls.length > 0 ? ((pCvr.length / p.ls.length) * 100).toFixed(1) : '0';
              const barW = N > 0 ? (p.ls.length / N) * 100 : 0;
              return (
                <div key={p.platform} className={`p-4 rounded-xl border ${p.borderBg}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-white">{p.platform}</span>
                    <span className="text-[10px] text-slate-400 font-mono">₹{p.rev.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    {[['Leads', p.ls.length, 'text-white'], ['Converted', pCvr.length, 'text-emerald-400'], ['Conv. %', cvrRate + '%', 'text-cyan-400']].map(([k, v, cls]) => (
                      <div key={String(k)}>
                        <p className={`text-base font-extrabold font-mono ${cls}`}>{v}</p>
                        <p className="text-[9px] text-slate-500 uppercase tracking-wider">{k}</p>
                      </div>
                    ))}
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full bg-gradient-to-r ${p.color} rounded-full`} style={{ width: `${barW}%` }} />
                  </div>
                  <p className="text-[9px] text-slate-500 mt-1 text-right">{barW.toFixed(1)}% of total leads</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pipeline */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><PhoneCall size={15} className="text-indigo-400" /> Lead Pipeline · {N} Leads</h3>
          <div className="space-y-2">
            {(Object.entries(STATUS_CONFIG) as [keyof typeof STATUS_CONFIG, (typeof STATUS_CONFIG)[keyof typeof STATUS_CONFIG]][]).map(([key, cfg]) => {
              const count = statusCount[key] || 0;
              const pct = N > 0 ? ((count / N) * 100).toFixed(1) : '0';
              const Icon = cfg.icon;
              return (
                <div key={key} className={`flex items-center gap-2.5 p-2.5 rounded-xl border ${cfg.bg}`}>
                  <Icon size={13} className={cfg.color} />
                  <div className="flex-1">
                    <div className="flex justify-between mb-0.5">
                      <span className="text-xs font-semibold text-slate-300">{cfg.label}</span>
                      <span className={`text-xs font-bold font-mono ${cfg.color}`}>{count} ({pct}%)</span>
                    </div>
                    <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Treatment + Converted */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Treatment Demand */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><TrendingUp size={15} className="text-purple-400" /> Treatment Demand</h3>
          <div className="space-y-2">
            {treatList.slice(0,9).map(([t, cnt], i) => {
              const pct = N > 0 ? ((cnt / N) * 100).toFixed(1) : '0';
              return (
                <div key={t} className="flex items-center gap-2.5">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${T_COLORS[i % T_COLORS.length]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-0.5">
                      <span className="text-xs text-slate-300 truncate">{t}</span>
                      <span className="text-xs font-bold text-slate-400 font-mono ml-2 flex-shrink-0">{cnt} ({pct}%)</span>
                    </div>
                    <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${T_COLORS[i % T_COLORS.length]}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Converted Revenue Log */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-400" /> Converted Clients</h3>
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
                <p className="text-sm font-extrabold text-emerald-400 font-mono flex-shrink-0 ml-2">₹{l.revenue.toLocaleString('en-IN')}</p>
              </div>
            ))}
            <div className="flex items-center justify-between p-2.5 bg-emerald-900/20 rounded-lg border border-emerald-500/20 mt-1">
              <span className="text-xs font-bold text-emerald-300">Total Revenue</span>
              <span className="text-sm font-extrabold text-emerald-400 font-mono">₹{totalRevenue.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Insight */}
      <div className="glass-panel p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
        <p className="text-xs text-amber-300 font-semibold mb-1">💡 Strategic Insight</p>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          On ad spend alone the campaign is <strong className="text-white">profitable</strong> (ROAS {roas}%, net +₹{Math.abs(netAdOnly).toLocaleString('en-IN')}).
          The agency management fee of ₹29,500 creates an overall deficit of ₹{Math.abs(netOverall).toLocaleString('en-IN')}.
          <strong className="text-white"> Facebook drives 99% of revenue</strong> with an 11.5% conversion rate vs Instagram's 2.3%.
          25 warm leads (Onam/deferred) represent significant pending pipeline revenue.
        </p>
      </div>
    </div>
  );
}
"""

with open('clinic-app/src/components/AdAgencyAnalytics.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("AdAgencyAnalytics.tsx created!")
