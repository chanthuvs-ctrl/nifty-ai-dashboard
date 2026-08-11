import re

with open('app.py', 'r') as f:
    content = f.read()

# 1. Delete evaluate_it_jegan_strategy function cleanly
pos = content.find('def evaluate_it_jegan_strategy(self)')
if pos != -1:
    end_pos = content.find('def evaluate_booming_bulls_strategy(self)', pos)
    if end_pos != -1:
        content = content[:pos] + content[end_pos:]
        print("Deleted evaluate_it_jegan_strategy from app.py!")

# 2. Delete it_jegan evaluator call in evaluate_strategy_suite
pos_suite = content.find('def evaluate_strategy_suite(self)')
if pos_suite != -1:
    end_suite = content.find('def _init_multi_strategy_engine', pos_suite)
    suite_code = content[pos_suite:end_suite]
    suite_code = re.sub(r'\s*\("it_jegan",\s*self\.evaluate_it_jegan_strategy\(\)\),?', '', suite_code)
    content = content[:pos_suite] + suite_code + content[end_suite:]
    print("Deleted it_jegan from evaluate_strategy_suite!")

with open('app.py', 'w') as f:
    f.write(content)

