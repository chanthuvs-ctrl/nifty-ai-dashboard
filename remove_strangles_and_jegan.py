import re

# 1. Update app.py
with open('app.py', 'r') as f:
    content = f.read()

# Remove it_jegan from all_keys lists
content = re.sub(r'["\']it_jegan["\'],?\s*', '', content)

# Remove it_jegan from STRATEGY_OPTION_ROUTING
content = re.sub(r'\s*["\']it_jegan["\']:\s*\{[^}]+\},?', '', content)

# Remove evaluate_it_jegan_strategy method
content = re.sub(r'def evaluate_it_jegan_strategy\(self\):.*?(?=def evaluate_|$)', '', content, flags=re.DOTALL)

# Update count references from 15 to 14
content = content.replace("15 strategies", "14 strategies")
content = content.replace("15 Strategies", "14 Strategies")
content = content.replace("ALL 15", "ALL 14")

with open('app.py', 'w') as f:
    f.write(content)
print("Removed it_jegan and updated app.py for 14 strategies!")

# 2. Update backtest_engine.py
with open('backtest_engine.py', 'r') as f:
    bt = f.read()

bt = re.sub(r'["\']it_jegan["\'],?\s*', '', bt)
bt = re.sub(r'def _test_it_jegan\(self.*?(?=def _test_|$)', '', bt, flags=re.DOTALL)
bt = bt.replace("15 strategies", "14 strategies")
bt = bt.replace("15 Strategies", "14 Strategies")

with open('backtest_engine.py', 'w') as f:
    f.write(bt)
print("Removed it_jegan and updated backtest_engine.py for 14 strategies!")

# 3. Update static/index.html
with open('static/index.html', 'r') as f:
    html = f.read()

# Remove Card for IT Jegan
card_pattern = r'<div class="strat-card" id="card-strat-it_jegan">.*?</div>\s*</div>'
html = re.sub(card_pattern, '', html, flags=re.DOTALL)

# Update 15 -> 14 text in HTML
html = html.replace("ALL 15 STRATEGIES", "ALL 14 STRATEGIES")
html = html.replace("15 Strategies", "14 Strategies")
html = html.replace("15 strategies", "14 strategies")
html = html.replace("5 / 5 Enabled", "14 / 14 Enabled")

with open('static/index.html', 'w') as f:
    f.write(html)
print("Removed IT Jegan card and updated static/index.html for 14 strategies!")

# 4. Update static/script.js
with open('static/script.js', 'r') as f:
    js = f.read()

js = js.replace("ALL 15 STRATEGIES", "ALL 14 STRATEGIES")
js = js.replace("All 15 Strategies", "All 14 Strategies")
js = js.replace("15 Strategies", "14 Strategies")
js = js.replace("15 strategies", "14 strategies")

with open('static/script.js', 'w') as f:
    f.write(js)
print("Updated static/script.js for 14 strategies!")

