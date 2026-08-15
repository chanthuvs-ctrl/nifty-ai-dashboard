# 1. Update AIAnalytics.tsx
ai_path = 'clinic-app/src/components/AIAnalytics.tsx'
with open(ai_path, 'r', encoding='utf-8') as f:
    ai_content = f.read()

# Add availableMonths useMemo hook
ai_hook = '''  const availableMonths = useMemo(() => {
    const ymSet = new Set<string>();
    transactions.forEach(t => {
      if (t.date && typeof t.date === 'string' && t.date.length >= 7) {
        const ym = t.date.slice(0, 7);
        if (/^\\d{4}-\\d{2}$/.test(ym)) {
          ymSet.add(ym);
        }
      }
    });
    const currentYM = new Date().toISOString().slice(0, 7);
    ymSet.add(currentYM);

    return Array.from(ymSet).sort().reverse().map(ym => {
      const [year, month] = ym.split('-');
      const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      const label = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      return { ym, label: '📅 ' + label };
    });
  }, [transactions]);'''

if 'const availableMonths =' not in ai_content:
    ai_content = ai_content.replace('const [transactions, setTransactions] = useState<any[]>(() => REAL_CLINIC_TRANSACTIONS);', 'const [transactions, setTransactions] = useState<any[]>(() => REAL_CLINIC_TRANSACTIONS);\n\n' + ai_hook)

# Replace hardcoded optgroup in AIAnalytics.tsx
old_optgroup_ai_start = '<optgroup label="2026 Monthly Breakdown">'
old_optgroup_ai_end = '</optgroup>'

start_ai = ai_content.find(old_optgroup_ai_start)
end_ai = ai_content.find(old_optgroup_ai_end, start_ai)

dynamic_optgroup_ai = '''<optgroup label="Monthly Breakdown">
                {availableMonths.map(m => (
                  <option key={m.ym} value={'month_' + m.ym}>{m.label}</option>
                ))}
              </optgroup>'''

if start_ai != -1 and end_ai != -1:
    ai_content = ai_content[:start_ai] + dynamic_optgroup_ai + ai_content[end_ai + len(old_optgroup_ai_end):]

with open(ai_path, 'w', encoding='utf-8') as f:
    f.write(ai_content)

print("AIAnalytics.tsx dynamic months updated!")

# 2. Update IncomeExpenseTracker.tsx
ie_path = 'clinic-app/src/components/IncomeExpenseTracker.tsx'
with open(ie_path, 'r', encoding='utf-8') as f:
    ie_content = f.read()

ie_hook = '''  const availableMonths = useMemo(() => {
    const ymSet = new Set<string>();
    transactions.forEach(t => {
      if (t.date && typeof t.date === 'string' && t.date.length >= 7) {
        const ym = t.date.slice(0, 7);
        if (/^\\d{4}-\\d{2}$/.test(ym)) {
          ymSet.add(ym);
        }
      }
    });
    const currentYM = new Date().toISOString().slice(0, 7);
    ymSet.add(currentYM);

    return Array.from(ymSet).sort().reverse().map(ym => {
      const [year, month] = ym.split('-');
      const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      const label = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      return { ym, label: '📅 ' + label };
    });
  }, [transactions]);'''

if 'const availableMonths =' not in ie_content:
    ie_content = ie_content.replace('const [transactions, setTransactions] = useState<any[]>(() => REAL_CLINIC_TRANSACTIONS);', 'const [transactions, setTransactions] = useState<any[]>(() => REAL_CLINIC_TRANSACTIONS);\n\n' + ie_hook)

old_optgroup_ie_start = '<optgroup label="2026 Monthly Breakdown">'
old_optgroup_ie_end = '</optgroup>'

start_ie = ie_content.find(old_optgroup_ie_start)
end_ie = ie_content.find(old_optgroup_ie_end, start_ie)

dynamic_optgroup_ie = '''<optgroup label="Monthly Breakdown">
              {availableMonths.map(m => (
                <option key={m.ym} value={'month_' + m.ym}>{m.label}</option>
              ))}
            </optgroup>'''

if start_ie != -1 and end_ie != -1:
    ie_content = ie_content[:start_ie] + dynamic_optgroup_ie + ie_content[end_ie + len(old_optgroup_ie_end):]

with open(ie_path, 'w', encoding='utf-8') as f:
    f.write(ie_content)

print("IncomeExpenseTracker.tsx dynamic months updated!")
