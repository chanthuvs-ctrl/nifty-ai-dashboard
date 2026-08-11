with open('app.py', 'r') as f:
    content = f.read()

pos_suite = content.find('def evaluate_strategy_suite(self) -> dict:')
if pos_suite != -1:
    pos_ret = content.find('return res', pos_suite)
    if pos_ret != -1:
        lock_code = '''
        # Apply 3-Minute Signal Lock Hysteresis (prevents tick-by-tick signal flipping)
        if not hasattr(self, "strategy_signal_locks"):
            self.strategy_signal_locks = {}
            
        now_ts = time.time()
        for key, s in res.items():
            locked = self.strategy_signal_locks.get(key)
            if locked is not None and (now_ts - locked["timestamp"] < 180.0):
                # Lock confirmed signal for minimum 3 minutes
                s["signal"] = locked["signal"]
                s["confidence"] = locked["confidence"]
                s["reason"] = f"[CONFIRMED 3M LOCK] {s['reason']}"
            else:
                if s.get("signal") != "No Trade":
                    self.strategy_signal_locks[key] = {
                        "signal": s["signal"],
                        "timestamp": now_ts,
                        "confidence": s.get("confidence", 90.0)
                    }
'''
        content = content[:pos_ret] + lock_code + '        ' + content[pos_ret:]
        print("Applied 3-Minute Signal Hysteresis Lock to evaluate_strategy_suite in app.py!")

with open('app.py', 'w') as f:
    f.write(content)

