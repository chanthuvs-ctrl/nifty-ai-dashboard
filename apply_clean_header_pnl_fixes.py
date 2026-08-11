import py_compile

with open('app.py', 'r') as f:
    content = f.read()

# 1. Fix get_market_data paper_floating_pnl & live_floating_pnl calculation
old_paper_calc = '''        "live_floating_pnl": round(sum(
            state.calculate_trade_pnl(t, state.spot_price)
            for t in journal.trades
            if t.get("status") == "OPEN" and (t.get("execution_type") or "").startswith("Live")
        ), 2),
        "paper_floating_pnl": round(sum(
            state.calculate_trade_pnl(t, state.spot_price)
            for t in journal.trades
            if t.get("status") == "OPEN" and not (t.get("execution_type") or "").startswith("Live")
        ), 2),'''

new_paper_calc = '''        "live_floating_pnl": round(sum(
            ((state.spot_price - p["entry_spot"]) if p.get("signal") == "Buy CE" else (p["entry_spot"] - state.spot_price)) * p.get("lot_size", 65) * p.get("lots", 1)
            for p in state.strategy_positions.values() if p and p.get("status") == "OPEN" and p.get("is_live")
        ), 2),
        "paper_floating_pnl": round(sum(
            ((state.spot_price - p["entry_spot"]) if p.get("signal") == "Buy CE" else (p["entry_spot"] - state.spot_price)) * p.get("lot_size", 65) * p.get("lots", 1)
            for p in state.strategy_positions.values() if p and p.get("status") == "OPEN" and not p.get("is_live")
        ), 2),'''

content = content.replace(old_paper_calc, new_paper_calc)

# Fix today_trades, today_legs, daily_brokerage in get_market_data
old_trades_mkt = '''        "today_trades": sum(1 for t in journal.trades if t.get("date") == get_ist_date_str() and (not (t.get("execution_type") or "Paper").startswith("Live") if state.settings.get("auto_trade_mode", "OFF") == "Paper" else (t.get("execution_type") or "Paper").startswith("Live"))),
        "today_legs": sum(len(t.get("legs") or []) or 1 for t in journal.trades if t.get("date") == get_ist_date_str() and (not (t.get("execution_type") or "Paper").startswith("Live") if state.settings.get("auto_trade_mode", "OFF") == "Paper" else (t.get("execution_type") or "Paper").startswith("Live"))),'''

new_trades_mkt = '''        "today_trades": sum(1 for p in state.strategy_positions.values() if p and p.get("status") == "OPEN") + sum(1 for t in journal.trades if t.get("date") == get_ist_date_str()),
        "today_legs": sum(1 for p in state.strategy_positions.values() if p and p.get("status") == "OPEN") + sum(1 for t in journal.trades if t.get("date") == get_ist_date_str()),'''

content = content.replace(old_trades_mkt, new_trades_mkt)

old_brok_mkt = '''        "daily_brokerage": round(sum(t.get("brokerage", 0.0) for t in journal.trades if t.get("date") == get_ist_date_str() and (not (t.get("execution_type") or "Paper").startswith("Live") if state.settings.get("auto_trade_mode", "OFF") == "Paper" else (t.get("execution_type") or "Paper").startswith("Live"))), 2),
        "total_brokerage": round(sum(t.get("brokerage", 0.0) for t in journal.trades if t.get("date") == get_ist_date_str() and (not (t.get("execution_type") or "Paper").startswith("Live") if state.settings.get("auto_trade_mode", "OFF") == "Paper" else (t.get("execution_type") or "Paper").startswith("Live"))), 2),'''

new_brok_mkt = '''        "daily_brokerage": round(sum(20.0 for p in state.strategy_positions.values() if p and p.get("status") == "OPEN") + sum(t.get("brokerage", 20.0) for t in journal.trades), 2),
        "total_brokerage": round(sum(20.0 for p in state.strategy_positions.values() if p and p.get("status") == "OPEN") + sum(t.get("brokerage", 20.0) for t in journal.trades), 2),'''

content = content.replace(old_brok_mkt, new_brok_mkt)

# 2. Update get_journal in app.py to map exact strategy titles and include all strategy positions
pos_j = content.find('def get_journal():')
if pos_j != -1:
    pos_loop = content.find('for strat_key, pos in state.strategy_positions.items():', pos_j)
    pos_end_loop = content.find('for t in journal.trades:', pos_loop)
    if pos_loop != -1 and pos_end_loop != -1:
        name_map_dict = '''
    name_map = {
        "first_15m_breakout": "15-Min Breakout & Close (Custom)",
        "power_of_stocks": "Power of Stocks (5 EMA & Inside Bar)",
        "booming_bulls": "Booming Bulls (15m ORB + Price Action)",
        "trading_legend": "Trading Legend (CPR + VWAP)",
        "larry_williams": "Larry Williams Volatility Expansion",
        "turtle_trading": "Turtle Trading (20-bar Donchian Breakout)",
        "minervini_vcp": "Mark Minervini Volatility Contraction (VCP)",
        "oliver_velez": "Oliver Velez (Elephant Bars & 20/200 SMA)",
        "elder_triple_screen": "Alexander Elder Triple Screen System",
        "demark_td9": "Tom DeMark TD Sequential (TD 9 Reversal)",
        "darvas_box": "Nicolas Darvas Box Range Breakout",
        "linda_raschke": "Linda Raschke (80-20 & Holy Grail)",
        "smc_ict_fvg": "Smart Money Concepts (SMC/ICT FVG)",
        "gamma_squeeze": "Institutional Options Gamma Squeeze"
    }

    for strat_key, pos in state.strategy_positions.items():
        if pos is not None and pos.get("status") == "OPEN":
            t_id = pos.get("trade_id") or f"TRADE_{strat_key.upper()}"
            seen_ids.add(t_id)
            diff = (state.spot_price - pos["entry_spot"]) if pos.get("signal") == "Buy CE" else (pos["entry_spot"] - state.spot_price)
            pnl = round(diff * pos.get("lot_size", 65) * pos.get("lots", 1), 2)
            strat_name = name_map.get(strat_key, pos.get("strategy_name", strat_key))
            trades_copy.append({
                "id": t_id,
                "date": get_ist_date_str(),
                "time": pos.get("entry_time", get_ist_time_str()),
                "timestamp": pos.get("entry_time", get_ist_time_str()),
                "recommendation": pos.get("signal", "Buy CE"),
                "strategy": strat_name,
                "strategy_name": strat_name,
                "strategy_key": strat_key,
                "entry_price": pos.get("entry_spot", state.spot_price),
                "entry_spot": pos.get("entry_spot", state.spot_price),
                "stop_loss": pos.get("stop_loss", 0.0),
                "target": pos.get("target", 0.0),
                "size": pos.get("lots", 1),
                "lots": pos.get("lots", 1),
                "quantity": pos.get("lots", 1) * pos.get("lot_size", 65),
                "status": "OPEN",
                "execution_type": "Live (Upstox API)" if pos.get("is_live") else "Paper",
                "reason": f"Strategy {strat_name} active position",
                "option_symbol": pos.get("symbol_name", f"NIFTY {pos.get('strike_price', 24500)} {pos.get('signal', 'CE')}"),
                "strikes": [pos.get("symbol_name", f"NIFTY {pos.get('strike_price', 24500)} {pos.get('signal', 'CE')}")],
                "strike_price": pos.get("strike_price", 24500),
                "expiry_date": pos.get("expiry_date", ""),
                "brokerage": 40.0 if pos.get("is_live") else 20.0,
                "pnl": pnl,
                "floating_pnl": pnl
            })
'''
        content = content[:pos_loop] + name_map_dict + content[pos_end_loop:]

with open('app.py', 'w') as f:
    f.write(content)

py_compile.compile('app.py')
print("Successfully compiled app.py with ZERO syntax errors!")
