filepath = 'clinic-app/src/components/IncomeExpenseTracker.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

old_import = "import { DollarSign, PlusCircle, ArrowUpRight, ArrowDownRight, FileText, Trash2, ChevronDown, Link as LinkIcon } from 'lucide-react';"
new_import = "import { DollarSign, PlusCircle, ArrowUpRight, ArrowDownRight, FileText, Trash2, ChevronDown, Link as LinkIcon, Filter } from 'lucide-react';"

content = content.replace(old_import, new_import)
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Added Filter icon import to IncomeExpenseTracker.tsx")
