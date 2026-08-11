with open('app.py', 'r') as f:
    content = f.read()

import re

# Add Signal Hysteresis Lock Dictionary & Confirmation Logic to SimulationState.__init__
pos_init = content.find('def __init__(self):')
if pos_init != -1:
    pos_end_init = content.find('self._init_multi_strategy_engine()', pos_init)
    if pos_end_init != -1:
        lock_init = '''self.strategy_signal_locks = {}  # {strat_key: {"signal": str, "timestamp": float, "confidence": float}}
        self.signal_lock_duration = 180.0  # 3-minute minimum signal lock threshold to prevent tick-by-tick flips'''
        content = content[:pos_end_init] + lock_init + '\n        ' + content[pos_end_init:]

# Update individual evaluators to use 0.15% Hysteresis Buffer around VWAP/EMA
content = content.replace('if spot > vwap:', 'vwap_h = vwap * 1.0015\n        vwap_l = vwap * 0.9985\n        if spot > vwap_h:')
content = content.replace('elif spot < vwap:', 'elif spot < vwap_l:')

# Wrap evaluate_strategy_suite with Signal Lock Hysteresis (3-minute minimum lock)
pos_suite = content.find('def evaluate_strategy_suite(self) -> dict:')
if pos_suite != -1:
    pos_ret = content.find('return res', pos_suite)
    if pos_ret != -1:
        lock_wrapper = '''now_ts = time.time()
        for key, s in res.items():
            locked = self.strategy_signal_locks.get(key)
            if locked is not None and (now_ts - locked["timestamp"] < self.signal_lock_duration):
                # Respect confirmed locked signal for minimum 3 minutes
                s["signal"] = locked["signal"]
                s["confidence"] = locked["confidence"]
                s["reason"] = f"[CONFIRMED CANDLE CLOSE - 3M LOCK] {s['reason']}"
            else:
                if s["signal"] != "No Trade":
                    self.strategy_signal_locks[key] = {
                        "signal": s["signal"],
                        "timestamp": now_ts,
                        "confidence": s.get("confidence", 90.0)
                    }
        return res'''
        content = content[:pos_ret] + lock_wrapper
        print("Successfully applied 3-minute Signal Lock Hysteresis to evaluate_strategy_suite!")

with open('app.py', 'w') as f:
    f.write(content)

