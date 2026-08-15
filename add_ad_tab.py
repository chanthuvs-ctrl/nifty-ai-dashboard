filepath = 'clinic-app/src/components/AdminDashboard.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add import
old_import = "import AIAnalytics from './AIAnalytics';"
new_import = "import AIAnalytics from './AIAnalytics';\nimport AdAgencyAnalytics from './AdAgencyAnalytics';"

content = content.replace(old_import, new_import)

# 2. Add to activeTab type
old_type = "const [activeTab, setActiveTab] = useState<'analytics' | 'income' | 'staff' | 'profiles' | 'leaves' | 'payslips' | 'offerletter' | 'documents' | 'directory'>('analytics');"
new_type = "const [activeTab, setActiveTab] = useState<'analytics' | 'income' | 'adagency' | 'staff' | 'profiles' | 'leaves' | 'payslips' | 'offerletter' | 'documents' | 'directory'>('analytics');"

content = content.replace(old_type, new_type)

# 3. Add nav item - insert after income nav item
old_nav = "    { id: 'income', label: 'Income & Expenses', icon: DollarSign, badge: 'Ledger' },"
new_nav = """    { id: 'income', label: 'Income & Expenses', icon: DollarSign, badge: 'Ledger' },
    { id: 'adagency', label: 'Ad Agency Analytics', icon: Target, badge: 'Meta Ads' },"""

content = content.replace(old_nav, new_nav)

# 4. Add tab render - insert after analytics render
old_render = "          {activeTab === 'analytics' && <AIAnalytics />}"
new_render = """          {activeTab === 'analytics' && <AIAnalytics />}
          {activeTab === 'adagency' && <AdAgencyAnalytics />}"""

content = content.replace(old_render, new_render)

# 5. Add page title for adagency
old_title = "              {activeTab === 'analytics' && 'AI Analytics & Pricing Intelligence'}"
new_title = """              {activeTab === 'analytics' && 'AI Analytics & Pricing Intelligence'}
              {activeTab === 'adagency' && 'Ad Agency Performance & Campaign Analytics'}"""

content = content.replace(old_title, new_title)

# 6. Check Target is imported
if "'Target'" not in content and "Target," not in content and "Target }" not in content:
    import re
    content = re.sub(r"(import \{[^}]+)(} from 'lucide-react')", lambda m: m.group(1) + ', Target' + m.group(2), content, count=1)
    print("Added Target to lucide imports")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("AdminDashboard.tsx updated with Ad Agency tab!")
