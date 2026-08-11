with open('app.py', 'r') as f:
    content = f.read()

import re

# 1. Purge "Short Strangle" / "Iron Condor" from evaluate_decision_engine in app.py
content = content.replace('primary_rec = "Short Strangle"', 'primary_rec = "Buy CE" if self.spot_price >= self.ema_20 else "Buy PE"')
content = content.replace('secondary_rec = "Short Strangle"', 'secondary_rec = "Buy CE"')
content = content.replace('tertiary_rec = "Short Strangle"', 'tertiary_rec = "Buy PE"')
content = content.replace('"Short Strangle"', '"Buy CE"')
content = content.replace('"Iron Condor"', '"Buy PE"')
content = content.replace('"Short Straddle"', '"Buy CE"')

with open('app.py', 'w') as f:
    f.write(content)

print("Purged Short Strangle from decision engine in app.py!")

# 2. Also ensure get_market_data sets recommendation to the top strategy suite signal!
with open('app.py', 'r') as f:
    content = f.read()

pos_mkt = content.find('def get_market_data(self) -> Dict:')
if pos_mkt != -1:
    pos_end_mkt = content.find('def get_chart_data(self)', pos_mkt)
    if pos_end_mkt != -1:
        mkt_code = content[pos_mkt:pos_end_mkt]
        # Ensure recommendation equals top strategy suite signal
        override_snippet = '''
        suite = self.evaluate_strategy_suite()
        top_strat = None
        max_c = 0.0
        for s in suite.values():
            sig = s.get("signal", "No Trade")
            conf = s.get("confidence", 0.0)
            if sig != "No Trade" and conf > max_c:
                max_c = conf
                top_strat = s

        if top_strat:
            self.current_recommendation = top_strat["signal"]
            self.signal_confidence = top_strat["confidence"]
'''
        if 'top_strat = None' not in mkt_code:
            mkt_code = mkt_code.replace('return {', override_snippet + '        return {')
            content = content[:pos_mkt] + mkt_code + content[pos_end_mkt:]
            print("Successfully anchored current_recommendation to top strategy suite signal in get_market_data!")

with open('app.py', 'w') as f:
    f.write(content)

# 3. Clean static/script.js
with open('static/script.js', 'r') as f:
    js = f.read()

js = js.replace('"Short Strangle"', '"Buy CE"')
js = js.replace("'Short Strangle'", "'Buy CE'")

with open('static/script.js', 'w') as f:
    f.write(js)
print("Purged Short Strangle from static/script.js!")

