with open('app.py', 'r') as f:
    content = f.read()

import re

# Remove any function block containing strat_15m = self.evaluate_first_15m_breakout_strategy()
pattern = r'def evaluate_strategy_suite_old.*?\n\n'
content = re.sub(r'def evaluate_strategy_suite\(self\) -> dict:\s*\n\s*"""Evaluates all 5 specialized trading strategies.*?\n\s*return res', '', content, flags=re.DOTALL)

with open('app.py', 'w') as f:
    f.write(content)

print("Cleaned up old 5-strategy evaluators!")
