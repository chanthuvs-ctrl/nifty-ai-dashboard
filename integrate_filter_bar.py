# 1. Update AIAnalytics.tsx
ai_path = 'clinic-app/src/components/AIAnalytics.tsx'
with open(ai_path, 'r', encoding='utf-8') as f:
    ai_content = f.read()

# Add import
if "DateRangeFilterBar" not in ai_content:
    ai_content = "import DateRangeFilterBar, { getDateRangeFromPreset } from './DateRangeFilterBar';\n" + ai_content

# Update analytics filtering logic to use getDateRangeFromPreset
old_analytics_range = """    let start = '2026-01-01';
    let end = '2026-12-31';

    if (periodFilter === 'all') {
      start = '1900-01-01'; end = '2099-12-31';
    } else if (periodFilter === 'current_fy') {
      start = '2026-04-01'; end = '2027-03-31';
    } else if (periodFilter === 'prev_fy') {
      start = '2025-04-01'; end = '2026-03-31';
    } else if (periodFilter === 'current_quarter') {
      start = '2026-07-01'; end = '2026-09-30';
    } else if (periodFilter.startsWith('month_')) {
      const targetYM = periodFilter.replace('month_', '');
      start = targetYM + '-01'; end = targetYM + '-31';
    } else if (periodFilter === 'custom') {
      start = customStartDate; end = customEndDate;
    }"""

new_analytics_range = """    const range = getDateRangeFromPreset(periodFilter, customStartDate, customEndDate);
    const start = range.start;
    const end = range.end;"""

if old_analytics_range in ai_content:
    ai_content = ai_content.replace(old_analytics_range, new_analytics_range)

# Replace the HTML control block in AIAnalytics.tsx with <DateRangeFilterBar ... />
old_ui_ai_start = '<div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">'
old_ui_ai_end = '</div>\n          )}'

ui_ai_start_pos = ai_content.find(old_ui_ai_start)
ui_ai_end_pos = ai_content.find(old_ui_ai_end, ui_ai_start_pos)

new_ui_ai = '''<DateRangeFilterBar
            periodFilter={periodFilter}
            setPeriodFilter={setPeriodFilter}
            customStartDate={customStartDate}
            setCustomStartDate={setCustomStartDate}
            customEndDate={customEndDate}
            setCustomEndDate={setCustomEndDate}
            availableMonths={availableMonths}
            matchingCount={analytics.filteredTx.length}
          />'''

if ui_ai_start_pos != -1 and ui_ai_end_pos != -1:
    ai_content = ai_content[:ui_ai_start_pos] + new_ui_ai + ai_content[ui_ai_end_pos + len(old_ui_ai_end):]

with open(ai_path, 'w', encoding='utf-8') as f:
    f.write(ai_content)

print("AIAnalytics.tsx updated with DateRangeFilterBar!")

# 2. Update IncomeExpenseTracker.tsx
ie_path = 'clinic-app/src/components/IncomeExpenseTracker.tsx'
with open(ie_path, 'r', encoding='utf-8') as f:
    ie_content = f.read()

if "DateRangeFilterBar" not in ie_content:
    ie_content = "import DateRangeFilterBar, { getDateRangeFromPreset } from './DateRangeFilterBar';\n" + ie_content

# Add state for custom dates if not present
if "const [customStartDate, setCustomStartDate]" not in ie_content:
    ie_content = ie_content.replace(
        "const [periodFilter, setPeriodFilter] = useState<string>('current_year');",
        "const [periodFilter, setPeriodFilter] = useState<string>('current_month');\n  const [customStartDate, setCustomStartDate] = useState('2026-01-01');\n  const [customEndDate, setCustomEndDate] = useState('2026-12-31');"
    )

# Update useMemo filter logic to use getDateRangeFromPreset
old_ie_filter = """      const normDate = normalizeDate(t.date);
      let matchesPeriod = true;

      if (periodFilter === 'current_year') {
        matchesPeriod = normDate >= '2026-01-01' && normDate <= '2026-12-31';
      } else if (periodFilter === 'current_fy') {
        matchesPeriod = normDate >= '2026-04-01' && normDate <= '2027-03-31';
      } else if (periodFilter === 'prev_fy') {
        matchesPeriod = normDate >= '2025-04-01' && normDate <= '2026-03-31';
      } else if (periodFilter === 'current_quarter') {
        matchesPeriod = normDate >= '2026-07-01' && normDate <= '2026-09-30';
      } else if (periodFilter.startsWith('month_')) {
        const targetYM = periodFilter.replace('month_', ''); // e.g. 2026-04
        matchesPeriod = normDate.startsWith(targetYM);
      }"""

new_ie_filter = """      const normDate = normalizeDate(t.date);
      const range = getDateRangeFromPreset(periodFilter, customStartDate, customEndDate);
      const matchesPeriod = normDate >= range.start && normDate <= range.end;"""

if old_ie_filter in ie_content:
    ie_content = ie_content.replace(old_ie_filter, new_ie_filter)

# Replace the HTML control block in IncomeExpenseTracker.tsx with <DateRangeFilterBar ... />
old_ui_ie_start = '<div className=\'glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3\'>'
old_ui_ie_end = '</div>'

ui_ie_start_pos = ie_content.find(old_ui_ie_start)
ui_ie_end_pos = ie_content.find(old_ui_ie_end, ui_ie_start_pos)

new_ui_ie = '''<DateRangeFilterBar
        periodFilter={periodFilter}
        setPeriodFilter={setPeriodFilter}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
        availableMonths={availableMonths}
        matchingCount={filteredTransactions.length}
      />'''

if ui_ie_start_pos != -1 and ui_ie_end_pos != -1:
    ie_content = ie_content[:ui_ie_start_pos] + new_ui_ie + ie_content[ui_ie_end_pos + len(old_ui_ie_end):]

with open(ie_path, 'w', encoding='utf-8') as f:
    f.write(ie_content)

print("IncomeExpenseTracker.tsx updated with DateRangeFilterBar!")
