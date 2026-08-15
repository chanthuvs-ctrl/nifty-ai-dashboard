# 1. Update AIAnalytics.tsx
ai_path = 'clinic-app/src/components/AIAnalytics.tsx'
with open(ai_path, 'r', encoding='utf-8') as f:
    ai_content = f.read()

ai_content = ai_content.replace(
    "if (c === 'con' || c.startsWith('con') || c.includes('consult') || c.includes('opd')) return 'Consultation & OPD';",
    "if (c.includes('consult') || c.includes('opd')) return 'Consultation & OPD';"
)

ai_content = ai_content.replace(
    "const isConsult = catLower === 'con' || catLower.startsWith('con') || catLower.includes('con') || catLower.includes('consult') || descLower.includes('consult') || catLower.includes('opd');",
    "const isConsult = catLower.includes('consult') || descLower.includes('consult') || catLower.includes('opd');"
)

with open(ai_path, 'w', encoding='utf-8') as f:
    f.write(ai_content)

print("AIAnalytics.tsx reverted!")

# 2. Update IncomeExpenseTracker.tsx
ie_path = 'clinic-app/src/components/IncomeExpenseTracker.tsx'
with open(ie_path, 'r', encoding='utf-8') as f:
    ie_content = f.read()

ie_content = ie_content.replace(
    "if (c === 'con' || c.startsWith('con') || c.includes('consult') || c.includes('opd')) return 'Consultation & OPD';",
    "if (c.includes('consult') || c.includes('opd')) return 'Consultation & OPD';"
)

with open(ie_path, 'w', encoding='utf-8') as f:
    f.write(ie_content)

print("IncomeExpenseTracker.tsx reverted!")
