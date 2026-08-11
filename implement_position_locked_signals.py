with open('app.py', 'r') as f:
    content = f.read()

# Update evaluate_strategy_suite to strictly lock signal to open position's direction if position exists!
pos_suite = content.find('def evaluate_strategy_suite(self) -> dict:')
if pos_suite != -1:
    pos_ret = content.find('return res', pos_suite)
    if pos_ret != -1:
        lock_position_signal_code = '''
        # Institutional Rule: If a strategy has an OPEN position, its signal is 100% LOCKED 
        # to the position's direction until Target or Stop Loss is hit!
        for key, s in res.items():
            pos = self.strategy_positions.get(key)
            if pos is not None and pos.get("status") == "OPEN":
                s["signal"] = pos["signal"]
                s["confidence"] = pos.get("confidence", 95.0)
                s["reason"] = f"[POSITION ACTIVE] Target @ ₹{pos.get('target', 0.0):.1f} | SL @ ₹{pos.get('stop_loss', 0.0):.1f}"
'''
        content = content[:pos_ret] + lock_position_signal_code + '        ' + content[pos_ret:]
        print("Successfully enforced Position-Locked Signals in app.py!")

with open('app.py', 'w') as f:
    f.write(content)

