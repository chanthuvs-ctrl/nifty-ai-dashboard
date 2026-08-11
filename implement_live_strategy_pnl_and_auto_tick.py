with open('app.py', 'r') as f:
    content = f.read()

# 1. Ensure tick_5s calls process_independent_multi_strategy_ticks
content = content.replace('self._auto_trade_tick()', 'self.process_independent_multi_strategy_ticks()')

# 2. Attach active_position & live PnL to evaluate_strategy_suite in app.py
pos_suite = content.find('def evaluate_strategy_suite(self) -> dict:')
if pos_suite != -1:
    pos_res = content.find('res = {}', pos_suite)
    pos_ret = content.find('return res', pos_res)
    if pos_res != -1 and pos_ret != -1:
        new_loop = '''res = {}
        for key, s in all_strats:
            s["is_enabled"] = enabled.get(key, True) if key in enabled else True
            s["is_live_deployed"] = live_deploy.get(key, True) if key in live_deploy else True
            
            # Attach active position details and live PnL
            pos = self.strategy_positions.get(key)
            if pos is not None:
                spot_diff = (self.spot_price - pos["entry_spot"]) if pos.get("signal") == "Buy CE" else (pos["entry_spot"] - self.spot_price)
                lot_qty = pos.get("lot_size", 65) * pos.get("lots", 1)
                live_pnl = round(spot_diff * lot_qty, 2)
                s["active_position"] = {
                    "symbol": pos.get("symbol", f"NIFTY {pos.get('signal')}"),
                    "entry_spot": pos.get("entry_spot", self.spot_price),
                    "current_spot": round(self.spot_price, 2),
                    "signal": pos.get("signal", "Buy CE"),
                    "lots": pos.get("lots", 1),
                    "pnl_rupees": live_pnl,
                    "status": "OPEN"
                }
            else:
                s["active_position"] = None
            res[key] = s'''
        content = content[:pos_res] + new_loop + '\n        ' + content[pos_ret:]
        print("Successfully attached active_position & live PnL in app.py!")

with open('app.py', 'w') as f:
    f.write(content)

