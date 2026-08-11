with open('app.py', 'r') as f:
    content = f.read()

import re

# 1. Remove "it_jegan" from all_keys list in enable_all_strategies_endpoint
content = content.replace('"first_15m_breakout", "power_of_stocks", "it_jegan",', '"first_15m_breakout", "power_of_stocks",')

# 2. Remove "it_jegan" from STRATEGY_OPTION_ROUTING
content = re.sub(r'\s*"it_jegan":\s*\{[^}]+\},?', '', content)

# 3. Remove evaluate_it_jegan_strategy method
pos = content.find('def evaluate_it_jegan_strategy(self)')
if pos != -1:
    end_pos = content.find('def evaluate_booming_bulls_strategy(self)', pos)
    if end_pos != -1:
        content = content[:pos] + content[end_pos:]

# 4. Remove ("it_jegan", self.evaluate_it_jegan_strategy()) from evaluate_strategy_suite
content = re.sub(r'\s*\("it_jegan",\s*self\.evaluate_it_jegan_strategy\(\)\),?', '', content)

# 5. Remove "it_jegan" defaults in toggle_strategy_settings
content = content.replace('        "it_jegan": True,\n', '')
content = content.replace('        "it_jegan": False,\n', '')

# 6. Replace string labels "15 strategies" -> "14 strategies", "15 Strategies" -> "14 Strategies"
content = content.replace('all 15 strategies', 'all 14 strategies')
content = content.replace('All 15 strategies', 'All 14 strategies')
content = content.replace('ALL 15 STRATEGIES', 'ALL 14 STRATEGIES')
content = content.replace('15 strategies', '14 strategies')
content = content.replace('15 Strategies', '14 Strategies')

with open('app.py', 'w') as f:
    f.write(content)

print("Safely removed IT Jegan from app.py!")
