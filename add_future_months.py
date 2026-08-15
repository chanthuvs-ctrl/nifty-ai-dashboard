# 1. Update AIAnalytics.tsx
ai_path = 'clinic-app/src/components/AIAnalytics.tsx'
with open(ai_path, 'r', encoding='utf-8') as f:
    ai_content = f.read()

future_opts_ai = '''<optgroup label="2026 Monthly Breakdown">
                <option value="month_2026-12">📅 December 2026</option>
                <option value="month_2026-11">📅 November 2026</option>
                <option value="month_2026-10">📅 October 2026</option>
                <option value="month_2026-09">📅 September 2026</option>
                <option value="month_2026-08">📅 August 2026</option>'''

if 'month_2026-09' not in ai_content:
    ai_content = ai_content.replace('<optgroup label="2026 Monthly Breakdown">\n                <option value="month_2026-08">📅 August 2026</option>', future_opts_ai)

with open(ai_path, 'w', encoding='utf-8') as f:
    f.write(ai_content)

print("AIAnalytics.tsx future months added!")

# 2. Update IncomeExpenseTracker.tsx
ie_path = 'clinic-app/src/components/IncomeExpenseTracker.tsx'
with open(ie_path, 'r', encoding='utf-8') as f:
    ie_content = f.read()

future_opts_ie = '''<optgroup label="2026 Monthly Breakdown">
              <option value='month_2026-12'>📅 December 2026</option>
              <option value='month_2026-11'>📅 November 2026</option>
              <option value='month_2026-10'>📅 October 2026</option>
              <option value='month_2026-09'>📅 September 2026</option>
              <option value='month_2026-08'>📅 August 2026</option>'''

if 'month_2026-09' not in ie_content:
    ie_content = ie_content.replace('<optgroup label="2026 Monthly Breakdown">\n              <option value=\'month_2026-08\'>📅 August 2026</option>', future_opts_ie)

with open(ie_path, 'w', encoding='utf-8') as f:
    f.write(ie_content)

print("IncomeExpenseTracker.tsx future months added!")
