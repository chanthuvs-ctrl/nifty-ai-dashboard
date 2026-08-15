import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { TrendingUp, TrendingDown, Users, DollarSign, Target, RefreshCw, AlertCircle, ExternalLink, BarChart2, Percent, PhoneCall, CheckCircle2, XCircle, Clock, MapPin, X } from 'lucide-react';

const SHEET_ID = '1YGEz617KY0bfGoR8nQqRffcFc8wsYF2L9FZbVV5IxY4';
const XLSX_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx`;
const CSV_URL  = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
const REFRESH  = 5 * 60 * 1000;
const GST      = 0.18;
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

interface PageData {
  leads: Lead[];
  metaExGST: number;
  googleExGST: number;
  agencyFee: number;
  billCount: number;
  nextBillDate: Date;
  rawCount: number;
  dateFrom: string;
  dateTo: string;
}

function agencyCalc() {
  const first = new Date('2026-08-06'), fee = 29500;
  const d = new Date(first); let n = 0;
  while (d <= new Date()) { n++; d.setMonth(d.getMonth() + 1); }
  return { agencyFee: n * fee, billCount: n, nextBillDate: new Date(d) };
}

function classify(note: string): { status: Lead['status']; revenue: number } {
  const s = (note || '').trim().toLowerCase();
  if (s.includes('consult')) {
    const m = s.match(/([0-9][0-9,]*)\s*\/?-?/);
    const rev = m ? parseInt(m[1].replace(/,/g,''), 10) : 0;
    if (rev > 0) return { status: 'converted', revenue: rev };
  }
  if (['will come','next week','call back','he will call','she will come','will inform','after onam','appointment','planning','call friday'].some(w => s.includes(w)))
    return { status: 'warm', revenue: 0 };
  if (DISTRICTS.some(d => s.includes(d)) || ['out of district','long distance','out of coverage'].some(w => s.includes(w)))
    return { status: 'out_of_district', revenue: 0 };
  if (['wrong enquiry','wrong enqury','donor area thin','cheeks filling','not possible','not interested','no idea','no incoming','enquiry not done'].some(w => s.includes(w)) || s === 'n/a' || s === 'na')
    return { status: 'invalid', revenue: 0 };
  return { status: 'unresponsive', revenue: 0 };
}

function parseTx(raw: string) {
  const m: Record<string,string> = {
    hair_transplant_planning:'Hair Transplant Planning', prp_gfc_hair_treatment:'PRP / GFC Hair Treatment',
    hair_fall_hair_thinning:'Hair Fall / Hair Thinning', acne_scars_marks:'Acne Scars / Marks',
    skin_pigmentation_melasma:'Pigmentation / Melasma', glutathione_iv_therapy:'Glutathione IV Therapy',
    hydrafacial_medi_facial:'Hydrafacial / Medi-Facial', not_sure_need_guidance:'Not Sure / Need Guidance',
  };
  return m[raw] || raw.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()) || 'General';
}

function csvRow(line: string): string[] {
  const cols: string[] = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (q && line[i+1]==='"') { cur+='"'; i++; } else q=!q; }
    else if (c === ',' && !q) { cols.push(cur); cur=''; }
    else cur += c;
  }
  cols.push(cur); return cols;
}

// Column letter to 0-based index: A=0, B=1 ... I=8
function colIdx(ref: string): number {
  let n = 0;
  for (const ch of ref.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

async function loadAll(): Promise<PageData> {
  const [xlsxRes, csvRes] = await Promise.all([fetch(XLSX_URL), fetch(CSV_URL)]);

  // --- Spend from XLSX: scan cells properly ---
  let metaExGST = 0, googleExGST = 0;
  try {
    const buf = await xlsxRes.arrayBuffer();
    const wb  = XLSX.read(buf, { type: 'array' });
    const ws  = wb.Sheets['Amount Spent'];
    if (ws) {
      // Scan every cell. Meta total is in B3, Google total is in I4
      // But use label-based search to be robust to future changes:
      // Row with 'Total Amount Spent' in col A -> Meta (value in col B)
      // Row with 'Total Amount Spent' in col H -> Google (value in col I)
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:Z50');
      for (let r = range.s.r; r <= range.e.r; r++) {
        const cellA = ws[XLSX.utils.encode_cell({r, c: 0})];
        const cellH = ws[XLSX.utils.encode_cell({r, c: 7})]; // col H
        const labelA = cellA ? String(cellA.v || '').toLowerCase() : '';
        const labelH = cellH ? String(cellH.v || '').toLowerCase() : '';
        if (labelA.includes('total amount spent') && metaExGST === 0) {
          const valCell = ws[XLSX.utils.encode_cell({r, c: 1})]; // col B
          metaExGST = valCell ? parseFloat(String(valCell.v || 0)) || 0 : 0;
        }
        if (labelH.includes('total amount spent') && googleExGST === 0) {
          const valCell = ws[XLSX.utils.encode_cell({r, c: 8})]; // col I
          googleExGST = valCell ? parseFloat(String(valCell.v || 0)) || 0 : 0;
        }
      }
    }
  } catch { /* keep zeros on failure */ }

  // --- Leads from CSV ---
  const text = await csvRes.text();
  const lines = text.split('\n').filter(l => l.trim());
  const rawH = csvRow(lines[0]);
  const hMap: Record<string,number> = {};
  rawH.forEach((h,i) => { hMap[h.replace(/"/g,'').trim().toLowerCase()] = i; });
  const col = (row: string[], key: string) => { const i = hMap[key.toLowerCase().trim()]; return i !== undefined ? (row[i]||'').replace(/"/g,'').trim() : ''; };

  const leads: Lead[] = [];
  const dates: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = csvRow(lines[i]);
    const name = col(row,'full_name'); if (!name) continue;
    const ct = col(row,'created_time'); if (ct) dates.push(ct.split('T')[0]);
    const note = col(row,'status');
    const { status, revenue } = classify(note);
    leads.push({
      name,
      platform: col(row,'platform').toLowerCase() === 'ig' ? 'Instagram' : col(row,'platform').toLowerCase() === 'fb' ? 'Facebook' : 'Other',
      treatment: parseTx(col(row,'what_would_you_like_to_consult_for?')),
      location: col(row,'city'),
      status, revenue,
      statusNote: note,
    });
  }
  dates.sort();
  const { agencyFee, billCount, nextBillDate } = agencyCalc();
  return { leads, metaExGST, googleExGST, agencyFee, billCount, nextBillDate, rawCount: lines.length - 1, dateFrom: dates[0]||'', dateTo: dates[dates.length-1]||'' };
}

type StatusKey = 'converted' | 'warm' | 'out_of_district' | 'invalid' | 'unresponsive';

const SC: Record<StatusKey, { label: string; tc: string; bg: string; bar: string; icon: React.ElementType; badge: string }> = {
  converted:       { label:'Converted / Paid',            tc:'text-emerald-400', bg:'bg-emerald-500/10 border-emerald-500/30', bar:'bg-emerald-500', icon:CheckCircle2, badge:'bg-emerald-500/20 text-emerald-300' },
  warm:            { label:'Warm Pipeline',                tc:'text-amber-400',   bg:'bg-amber-500/10 border-amber-500/30',   bar:'bg-amber-500',   icon:Clock,        badge:'bg-amber-500/20 text-amber-300'   },
  out_of_district: { label:'Out of District',             tc:'text-sky-400',     bg:'bg-sky-500/10 border-sky-500/30',       bar:'bg-sky-500',     icon:MapPin,       badge:'bg-sky-500/20 text-sky-300'       },
  invalid:         { label:'Invalid / Ineligible',         tc:'text-slate-400',   bg:'bg-slate-500/10 border-slate-700',      bar:'bg-slate-500',   icon:XCircle,      badge:'bg-slate-700 text-slate-300'      },
  unresponsive:    { label:'Unresponsive / Dropped',       tc:'text-rose-400',    bg:'bg-rose-500/10 border-rose-500/30',     bar:'bg-rose-500',    icon:PhoneCall,    badge:'bg-rose-500/20 text-rose-300'     },
};
const TC = ['bg-cyan-500','bg-indigo-500','bg-purple-500','bg-amber-500','bg-emerald-500','bg-rose-500','bg-sky-500','bg-orange-500','bg-teal-500'];

export default function AdAgencyAnalytics() {
  const [data, setData]         = useState<PageData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [popup, setPopup]       = useState<StatusKey | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await loadAll()); }
    catch (e: any) { setError(String(e?.message || 'Failed to load')); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); const t = setInterval(load, REFRESH); return () => clearInterval(t); }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-64 gap-3 text-slate-400">
      <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      <span className="text-sm">Loading Ad Agency data...</span>
    </div>
  );
  if (error || !data) return (
    <div className="flex items-center justify-center min-h-64 gap-3 text-rose-400">
      <AlertCircle size={18} />
      <div>
        <p className="text-sm font-semibold">Could not load data</p>
        <p className="text-xs text-slate-500 mt-1">{error}</p>
        <button onClick={load} className="mt-2 text-xs text-cyan-400 underline">Retry</button>
      </div>
    </div>
  );

  const { leads, metaExGST, googleExGST, agencyFee, billCount, nextBillDate, rawCount, dateFrom, dateTo } = data;
  const metaInGST    = metaExGST   * (1 + GST);
  const googleInGST  = googleExGST * (1 + GST);
  const totalAdExGST = metaExGST + googleExGST;
  const totalAdInGST = metaInGST + googleInGST;
  const totalExp     = totalAdInGST + agencyFee;
  const converted    = leads.filter(l => l.status === 'converted');
  const revenue      = converted.reduce((s,l) => s + l.revenue, 0);
  const netAd        = revenue - totalAdInGST;
  const netAll       = revenue - totalExp;
  const roas         = totalAdExGST > 0 ? ((revenue / totalAdExGST) * 100).toFixed(1) : '0';
  const roi          = totalExp     > 0 ? (((revenue - totalExp) / totalExp) * 100).toFixed(1) : '0';
  const N            = leads.length;
  const cpl          = N > 0 ? Math.round(metaInGST / N) : 0;
  const cpa          = converted.length > 0 ? Math.round(totalAdInGST / converted.length) : 0;
  const cvr          = N > 0 ? ((converted.length / N) * 100).toFixed(1) : '0';
  const fbLeads      = leads.filter(l => l.platform === 'Facebook');
  const igLeads      = leads.filter(l => l.platform === 'Instagram');
  const fbRev        = fbLeads.filter(l=>l.status==='converted').reduce((s,l)=>s+l.revenue,0);
  const tMap: Record<string,number> = {};
  leads.forEach(l => { tMap[l.treatment] = (tMap[l.treatment]||0)+1; });
  const tList = Object.entries(tMap).sort((a,b)=>b[1]-a[1]);
  const sCnt: Record<string,number> = {};
  leads.forEach(l => { sCnt[l.status] = (sCnt[l.status]||0)+1; });

  const r  = (n: number) => `\u20b9${Math.round(n).toLocaleString('en-IN')}`;
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '';

  const popupLeads = popup ? leads.filter(l => l.status === popup) : [];

  const cards = [
    { label:'Meta Ad Spend (excl. GST)',  value:r(metaExGST),    sub:`+18% GST = ${r(metaInGST)}`,       ic:'text-blue-400',    grad:'from-blue-900/30 to-slate-900/60',    icon:BarChart2    },
    { label:'Google Ad Spend (excl. GST)',value:r(googleExGST),  sub:`+18% GST = ${r(googleInGST)}`,     ic:'text-sky-400',     grad:'from-sky-900/30 to-slate-900/60',     icon:BarChart2    },
    { label:'Total Ad Spend (incl. GST)', value:r(totalAdInGST), sub:`Excl. GST: ${r(totalAdExGST)}`,    ic:'text-rose-400',    grad:'from-rose-900/30 to-slate-900/60',    icon:DollarSign   },
    { label:`Agency Fee (${billCount} bill${billCount>1?'s':''})`, value:r(agencyFee), sub:`Next: ${nextBillDate.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}`, ic:'text-slate-300', grad:'from-slate-800/80 to-slate-900/60', icon:DollarSign },
    { label:'Total Expenditure',          value:r(totalExp),     sub:'Ad Spend + Agency Fee',             ic:'text-rose-400',    grad:'from-rose-900/40 to-slate-900/60',    icon:TrendingDown  },
    { label:'Revenue Generated',          value:r(revenue),      sub:`${converted.length} paying clients`,ic:'text-emerald-400', grad:'from-emerald-900/30 to-slate-900/60', icon:TrendingUp   },
    { label:'Net (Ad Spend incl. GST)',   value:(netAd>=0?'+':'')+r(Math.abs(netAd)),   sub:netAd>=0?'Profitable on ads':'Loss on ads',       ic:netAd>=0?'text-emerald-400':'text-rose-400', grad:netAd>=0?'from-emerald-900/25 to-slate-900/60':'from-rose-900/25 to-slate-900/60', icon:netAd>=0?TrendingUp:TrendingDown },
    { label:'Net (Overall)',              value:(netAll>=0?'+':'-')+r(Math.abs(netAll)), sub:netAll>=0?'Overall profit':'Deficit incl. agency', ic:netAll>=0?'text-emerald-400':'text-rose-400', grad:netAll>=0?'from-emerald-900/25 to-slate-900/60':'from-rose-900/25 to-slate-900/60', icon:netAll>=0?TrendingUp:TrendingDown },
    { label:'ROAS (excl. GST basis)',     value:`${roas}%`,      sub:parseFloat(roas)>=100?'Positive return':'Below breakeven', ic:parseFloat(roas)>=100?'text-cyan-400':'text-rose-400', grad:parseFloat(roas)>=100?'from-cyan-900/25 to-slate-900/60':'from-rose-900/25 to-slate-900/60', icon:Percent },
    { label:'Overall ROI',               value:`${roi}%`,       sub:'Incl. agency + GST',                ic:parseFloat(roi)>=0?'text-cyan-400':'text-rose-400', grad:parseFloat(roi)>=0?'from-cyan-900/25 to-slate-900/60':'from-rose-900/25 to-slate-900/60', icon:Percent },
    { label:'Unique Leads',              value:String(N),       sub:`${rawCount} raw submissions`,        ic:'text-indigo-400',  grad:'from-indigo-900/25 to-slate-900/60',  icon:Users        },
    { label:'Converted Clients',         value:String(converted.length), sub:`${cvr}% conversion rate`,  ic:'text-purple-400',  grad:'from-purple-900/25 to-slate-900/60',  icon:Target       },
    { label:'CPL (Meta incl. GST)',      value:r(cpl),          sub:'Cost per unique lead',              ic:'text-amber-400',   grad:'from-amber-900/25 to-slate-900/60',   icon:DollarSign   },
    { label:'CPA (All Ad Spend)',        value:r(cpa),          sub:'Cost per paying client',            ic:'text-amber-400',   grad:'from-amber-900/25 to-slate-900/60',   icon:Target       },
  ];

  return (
    <div className="space-y-5">
      {/* Roster Popup Modal */}
      {popup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setPopup(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative z-10 glass-panel rounded-2xl border border-slate-700 w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className={`flex items-center justify-between p-4 border-b border-slate-800`}>
              <div className="flex items-center gap-2.5">
                {(() => { const Icon = SC[popup].icon; return <Icon size={16} className={SC[popup].tc} />; })()}
                <div>
                  <h3 className="text-sm font-bold text-white">{SC[popup].label}</h3>
                  <p className="text-[10px] text-slate-400">{popupLeads.length} leads in this category</p>
                </div>
              </div>
              <button onClick={() => setPopup(null)} className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800">
                <X size={16} />
              </button>
            </div>
            {/* Lead List */}
            <div className="overflow-y-auto flex-1 p-3 space-y-2">
              {popupLeads.map((lead, i) => (
                <div key={i} className="p-3 bg-slate-900/70 rounded-xl border border-slate-800 hover:border-slate-700 transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className={`mt-0.5 w-5 h-5 rounded-md text-[9px] font-bold flex items-center justify-center flex-shrink-0 ${SC[popup].badge}`}>{i+1}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{lead.name}</p>
                        <p className="text-[10px] text-slate-400">{lead.treatment} · {lead.platform}{lead.location ? ` · ${lead.location}` : ''}</p>
                        {lead.statusNote && (
                          <p className="text-[10px] text-slate-500 mt-1 italic leading-relaxed">{lead.statusNote}</p>
                        )}
                      </div>
                    </div>
                    {lead.revenue > 0 && (
                      <span className="text-sm font-extrabold text-emerald-400 font-mono flex-shrink-0">{r(lead.revenue)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {/* Footer total for converted */}
            {popup === 'converted' && (
              <div className="p-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-300">Total Revenue</span>
                <span className="text-sm font-extrabold text-emerald-400 font-mono">{r(popupLeads.reduce((s,l)=>s+l.revenue,0))}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500/20 to-orange-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 flex-shrink-0">
            <Target size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              Ad Agency Performance{dateFrom ? ` · ${fmtDate(dateFrom)} – ${fmtDate(dateTo)}` : ''}
            </h2>
            <p className="text-[11px] text-slate-400">Meta + Google Ads · Live from Google Sheet · {N} unique leads · {rawCount} raw submissions</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-slate-500 hidden sm:inline">Auto-refresh every 5 min</span>
          <button onClick={load} className="flex items-center gap-1 text-xs font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-2.5 py-1.5 hover:bg-cyan-500/20 transition-all">
            <RefreshCw size={11} /> Refresh
          </button>
          <a href={`https://docs.google.com/spreadsheets/d/${SHEET_ID}`} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 text-xs font-semibold text-slate-400 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 hover:text-white transition-all">
            <ExternalLink size={11} /> Sheet
          </a>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {cards.map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label} className={`glass-panel p-3.5 rounded-xl border border-slate-800/80 bg-gradient-to-br ${c.grad} flex flex-col gap-1.5`}>
              <div className="flex items-center justify-between"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-tight">{c.label}</p><Icon size={12} className={c.ic} /></div>
              <p className={`text-base font-extrabold font-mono leading-none ${c.ic}`}>{c.value}</p>
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
              { platform:'Facebook', ls:fbLeads, rev:fbRev, grad:'from-blue-600 to-blue-400', bg:'border-blue-500/20 bg-blue-500/5' },
              { platform:'Instagram', ls:igLeads, rev:igLeads.filter(l=>l.status==='converted').reduce((s,l)=>s+l.revenue,0), grad:'from-pink-600 to-orange-400', bg:'border-pink-500/20 bg-pink-500/5' },
            ].map(p => {
              const pc = p.ls.filter(l=>l.status==='converted');
              const rate = p.ls.length>0 ? ((pc.length/p.ls.length)*100).toFixed(1):'0';
              return (
                <div key={p.platform} className={`p-4 rounded-xl border ${p.bg}`}>
                  <div className="flex justify-between mb-3"><span className="text-sm font-bold text-white">{p.platform}</span><span className="text-[10px] text-slate-400 font-mono">{r(p.rev)}</span></div>
                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    {[['Leads',p.ls.length,'text-white'],['Converted',pc.length,'text-emerald-400'],['Conv. %',rate+'%','text-cyan-400']].map(([k,v,cls])=>(
                      <div key={String(k)}><p className={`text-base font-extrabold font-mono ${cls}`}>{v}</p><p className="text-[9px] text-slate-500 uppercase">{k}</p></div>
                    ))}
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className={`h-full bg-gradient-to-r ${p.grad}`} style={{width:`${N>0?(p.ls.length/N*100):0}%`}}/></div>
                  <p className="text-[9px] text-slate-500 mt-1 text-right">{N>0?(p.ls.length/N*100).toFixed(1):0}% of total leads</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pipeline - clickable */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><PhoneCall size={15} className="text-indigo-400" /> Lead Pipeline · {N} Leads <span className="text-[9px] text-slate-500 font-normal ml-1">Click to view roster</span></h3>
          <div className="space-y-2">
            {(Object.entries(SC) as [StatusKey, typeof SC[StatusKey]][]).map(([key,cfg])=>{
              const cnt = sCnt[key]||0; const pct = N>0?((cnt/N)*100).toFixed(1):'0'; const Icon=cfg.icon;
              return (
                <button
                  key={key}
                  onClick={() => setPopup(key)}
                  className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl border ${cfg.bg} hover:brightness-110 hover:scale-[1.01] transition-all text-left cursor-pointer`}
                >
                  <Icon size={13} className={cfg.tc}/>
                  <div className="flex-1">
                    <div className="flex justify-between mb-0.5">
                      <span className="text-xs font-semibold text-slate-300">{cfg.label}</span>
                      <span className={`text-xs font-bold font-mono ${cfg.tc}`}>{cnt} ({pct}%)</span>
                    </div>
                    <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden"><div className={`h-full ${cfg.bar}`} style={{width:`${pct}%`}}/></div>
                  </div>
                </button>
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
            {tList.slice(0,9).map(([t,cnt],i)=>{
              const pct=N>0?((cnt/N)*100).toFixed(1):'0';
              return (<div key={t} className="flex items-center gap-2.5">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${TC[i%TC.length]}`}/>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between mb-0.5"><span className="text-xs text-slate-300 truncate">{t}</span><span className="text-xs font-bold text-slate-400 font-mono ml-2 flex-shrink-0">{cnt} ({pct}%)</span></div>
                  <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden"><div className={`h-full ${TC[i%TC.length]}`} style={{width:`${pct}%`}}/></div>
                </div>
              </div>);
            })}
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-400" /> Converted Clients</h3>
          <div className="space-y-1.5">
            {converted.sort((a,b)=>b.revenue-a.revenue).map((l,i)=>(
              <div key={i} className="flex items-center justify-between p-2.5 bg-slate-900/60 rounded-lg border border-slate-800/60 hover:border-emerald-500/20 transition-all">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-[9px] font-bold flex-shrink-0">{i+1}</span>
                  <div className="min-w-0"><p className="text-xs font-semibold text-white truncate">{l.name}</p><p className="text-[9px] text-slate-500 truncate">{l.treatment} · {l.platform}</p></div>
                </div>
                <p className="text-sm font-extrabold text-emerald-400 font-mono flex-shrink-0 ml-2">{r(l.revenue)}</p>
              </div>
            ))}
            <div className="flex items-center justify-between p-2.5 bg-emerald-900/20 rounded-lg border border-emerald-500/20 mt-1">
              <span className="text-xs font-bold text-emerald-300">Total Revenue</span>
              <span className="text-sm font-extrabold text-emerald-400 font-mono">{r(revenue)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Insight */}
      <div className="glass-panel p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
        <p className="text-xs text-amber-300 font-semibold mb-1">&#128161; Strategic Insight</p>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Total ad spend (Meta + Google) is <strong className="text-white">{r(totalAdExGST)} excl. GST</strong> ({r(totalAdInGST)} incl. 18% GST).
          ROAS is {roas}% — campaign is {netAd >= 0 ? <strong className="text-emerald-400">profitable on ad spend alone</strong> : <strong className="text-rose-400">at a loss on ad spend</strong>}.
          With {billCount} agency bill{billCount>1?'s':''} ({r(agencyFee)}), overall net is {netAll >= 0 ? '+' : '-'}{r(Math.abs(netAll))}.{' '}
          <strong className="text-white">Facebook drives {revenue > 0 ? Math.round(fbRev/revenue*100) : 99}% of revenue.</strong>{' '}
          {(sCnt['warm']||0)} warm leads represent pending pipeline revenue.
        </p>
      </div>
    </div>
  );
}
