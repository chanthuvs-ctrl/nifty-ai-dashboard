with open('app.py', 'r') as f:
    content = f.read()

pos = content.find('strat_15m = self.evaluate_first_15m_breakout_strategy()')
if pos != -1:
    pos_start = content.rfind('def evaluate_strategy_suite', 0, pos)
    pos_end = content.find('def sync_settings_strategies', pos)
    if pos_start != -1 and pos_end != -1:
        content = content[:pos_start] + content[pos_end:]
        print("Deleted duplicate evaluate_strategy_suite method in app.py!")

with open('app.py', 'w') as f:
    f.write(content)

