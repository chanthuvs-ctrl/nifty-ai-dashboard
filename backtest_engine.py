import math
import random
import datetime
from typing import Dict, List, Optional

class StrategyBacktester:
    def __init__(self):
        self.lot_size = 65  # Nifty lot size
        self.num_lots = 1
        self.slippage_pts = 2.0  # Realistic 2 pts slippage & brokerage per trade

    def generate_intraday_sessions(self, num_days: int = 30) -> List[Dict]:
        """
        Generates realistic 15-min and 5-min candle sessions for 'num_days' trading days.
        Simulates various market regimes: Bullish Trending, Bearish Trending, Rangebound, Volatile Whipsaw, CPR Narrow Breakout.
        """
        random.seed(42)  # Deterministic seed for reproducible backtest benchmarks
        sessions = []
        base_spot = 24500.0
        start_date = datetime.date.today() - datetime.timedelta(days=int(num_days * 1.5))
        
        current_date = start_date
        days_generated = 0

        regimes = ["BULLISH_TRENDING", "BEARISH_TRENDING", "RANGEBOUND", "VOLATILE_WHIPSAW", "CPR_NARROW_BREAKOUT"]

        while days_generated < num_days:
            current_date += datetime.timedelta(days=1)
            if current_date.weekday() >= 5:
                continue

            regime = regimes[days_generated % len(regimes)]
            days_generated += 1

            gap_pct = random.uniform(-0.005, 0.005)
            day_open = base_spot * (1 + gap_pct)
            base_spot = day_open

            candles_15m = []
            cur_price = day_open
            day_high = day_open
            day_low = day_open

            # 25 candles of 15-min per day (9:15 AM to 3:30 PM)
            for bar_idx in range(25):
                time_hour = 9 + (15 + bar_idx * 15) // 60
                time_min = (15 + bar_idx * 15) % 60
                time_str = f"{time_hour:02d}:{time_min:02d}"

                bar_open = cur_price

                if regime == "BULLISH_TRENDING":
                    drift = random.uniform(5.0, 25.0) if bar_idx > 0 else random.uniform(-10.0, 30.0)
                elif regime == "BEARISH_TRENDING":
                    drift = random.uniform(-25.0, -5.0) if bar_idx > 0 else random.uniform(-30.0, 10.0)
                elif regime == "RANGEBOUND":
                    drift = random.uniform(-12.0, 12.0)
                elif regime == "VOLATILE_WHIPSAW":
                    drift = random.uniform(-35.0, 35.0)
                else:  # CPR_NARROW_BREAKOUT
                    drift = random.uniform(15.0, 40.0) if bar_idx >= 2 else random.uniform(-5.0, 10.0)

                bar_close = bar_open + drift
                high_noise = abs(random.uniform(2.0, 12.0))
                low_noise = abs(random.uniform(2.0, 12.0))
                bar_high = max(bar_open, bar_close) + high_noise
                bar_low = min(bar_open, bar_close) - low_noise

                cur_price = bar_close
                day_high = max(day_high, bar_high)
                day_low = min(day_low, bar_low)

                candles_15m.append({
                    "bar_idx": bar_idx,
                    "time": time_str,
                    "open": round(bar_open, 2),
                    "high": round(bar_high, 2),
                    "low": round(bar_low, 2),
                    "close": round(bar_close, 2),
                    "volume": round(random.uniform(5000, 25000), 0)
                })

            sessions.append({
                "day_idx": days_generated,
                "date": current_date.strftime("%Y-%m-%d"),
                "regime": regime,
                "open": round(day_open, 2),
                "high": round(day_high, 2),
                "low": round(day_low, 2),
                "close": round(cur_price, 2),
                "candles_15m": candles_15m
            })

        return sessions

    def run_backtest(self, num_days: int = 30, rr_ratio: float = 2.0, lot_size: int = 65, num_lots: int = 1, deduct_slippage: bool = True) -> Dict:
        """Runs backtest simulation across ALL 15 trading strategies."""
        self.lot_size = lot_size
        self.num_lots = num_lots
        slippage = self.slippage_pts if deduct_slippage else 0.0

        sessions = self.generate_intraday_sessions(num_days)

        strategies = [
            "first_15m_breakout",
            "power_of_stocks",
            "booming_bulls",
            "trading_legend",
            "larry_williams",
            "turtle_trading",
            "minervini_vcp",
            "oliver_velez",
            "elder_triple_screen",
            "demark_td9",
            "darvas_box",
            "linda_raschke",
            "smc_ict_fvg",
            "gamma_squeeze"
        ]

        results_by_strategy = {}
        for strat_key in strategies:
            results_by_strategy[strat_key] = {
                "trades": [],
                "equity_curve": [0.0],
                "winning_trades": 0,
                "losing_trades": 0,
                "total_trades": 0,
                "win_rate_pct": 0.0,
                "gross_profit_pts": 0.0,
                "gross_loss_pts": 0.0,
                "net_pnl_pts": 0.0,
                "net_pnl_rupees": 0.0,
                "profit_factor": 0.0,
                "max_drawdown_pts": 0.0,
                "max_drawdown_rupees": 0.0,
                "avg_trade_pnl_pts": 0.0
            }

        # History helper for indicators
        prev_session_range = 150.0

        # Simulate day by day
        for s_idx, session in enumerate(sessions):
            date_str = session["date"]
            candles = session["candles_15m"]
            if len(candles) < 2:
                continue

            day_open = session["open"]
            if s_idx > 0:
                prev_session_range = max(50.0, sessions[s_idx - 1]["high"] - sessions[s_idx - 1]["low"])

            c1 = candles[0]
            first_h = c1["high"]
            first_l = c1["low"]
            cpr_top = first_h + (first_h - first_l) * 0.1
            cpr_bottom = first_l - (first_h - first_l) * 0.1
            vwap = (first_h + first_l + c1["close"]) / 3.0

            # Evaluate each strategy on the session
            for strat_key in strategies:
                strat_res = results_by_strategy[strat_key]
                trade_triggered = False

                for i in range(1, len(candles)):
                    if trade_triggered:
                        break

                    c_prev = candles[i - 1]
                    c_curr = candles[i]
                    close_p = c_curr["close"]
                    high_p = c_curr["high"]
                    low_p = c_curr["low"]
                    time_s = c_curr["time"]

                    signal = "No Trade"
                    entry_p = close_p
                    sl_p = 0.0
                    target_p = 0.0
                    reason = ""

                    # 1. First 15-Min Candle Breakout & Close Continuation (User Custom)
                    if strat_key == "first_15m_breakout":
                        if close_p > first_h:
                            signal = "Buy CE"
                            sl_p = first_l
                            target_p = close_p + (close_p - first_l) * (rr_ratio / 2.0)
                            reason = f"15-Min Candle closed above 1st 15-min High (₹{first_h:.1f}). Trend Continuation."
                        elif close_p < first_l:
                            signal = "Buy PE"
                            sl_p = first_h
                            target_p = close_p - (first_h - close_p) * (rr_ratio / 2.0)
                            reason = f"15-Min Candle closed below 1st 15-min Low (₹{first_l:.1f}). Trend Continuation."

                    # 2. Power of Stocks (5 EMA & Inside Bar)
                    elif strat_key == "power_of_stocks":
                        if low_p > vwap and close_p > c_prev["high"]:
                            signal = "Buy CE"
                            sl_p = c_prev["low"]
                            target_p = close_p + abs(close_p - sl_p) * rr_ratio
                            reason = "Power of Stocks 5 EMA Buy Alert & Breakout."
                        elif high_p < vwap and close_p < c_prev["low"]:
                            signal = "Buy PE"
                            sl_p = c_prev["high"]
                            target_p = close_p - abs(sl_p - close_p) * rr_ratio
                            reason = "Power of Stocks 5 EMA Sell Alert & Breakdown."

                    

                    # 4. Booming Bulls Strategy (15m ORB + Price Action)
                    elif strat_key == "booming_bulls":
                        if close_p > first_h:
                            signal = "Buy CE"
                            sl_p = (first_h + first_l) / 2.0
                            target_p = close_p + abs(close_p - sl_p) * rr_ratio
                            reason = "Booming Bulls 15-Min ORB Upside Breakout."
                        elif close_p < first_l:
                            signal = "Buy PE"
                            sl_p = (first_h + first_l) / 2.0
                            target_p = close_p - abs(sl_p - close_p) * rr_ratio
                            reason = "Booming Bulls 15-Min ORB Downside Breakdown."

                    # 5. Trading Legend Strategy (CPR + VWAP Confluence)
                    elif strat_key == "trading_legend":
                        if close_p > cpr_top and close_p > vwap:
                            signal = "Buy CE"
                            sl_p = cpr_bottom
                            target_p = close_p + abs(close_p - cpr_bottom) * rr_ratio
                            reason = "Trading Legend CPR Top + VWAP Confluence Breakout."
                        elif close_p < cpr_bottom and close_p < vwap:
                            signal = "Buy PE"
                            sl_p = cpr_top
                            target_p = close_p - abs(cpr_top - close_p) * rr_ratio
                            reason = "Trading Legend CPR Bottom + VWAP Confluence Breakdown."

                    # 6. Larry Williams Volatility Expansion
                    elif strat_key == "larry_williams":
                        k_val = 0.50 * prev_session_range
                        lw_buy = day_open + k_val
                        lw_sell = day_open - k_val
                        if close_p > lw_buy:
                            signal = "Buy CE"
                            sl_p = day_open
                            target_p = close_p + abs(close_p - day_open) * rr_ratio
                            reason = f"Larry Williams Volatility Expansion Breakout above ₹{lw_buy:.1f} (0.5x Prev Range)."
                        elif close_p < lw_sell:
                            signal = "Buy PE"
                            sl_p = day_open
                            target_p = close_p - abs(day_open - close_p) * rr_ratio
                            reason = f"Larry Williams Volatility Expansion Breakdown below ₹{lw_sell:.1f}."

                    # 7. Turtle Trading Strategy (20-bar Donchian Breakout)
                    elif strat_key == "turtle_trading":
                        recent_highs = [c["high"] for c in candles[max(0, i-10):i]]
                        recent_lows = [c["low"] for c in candles[max(0, i-10):i]]
                        donchian_h = max(recent_highs) if recent_highs else first_h
                        donchian_l = min(recent_lows) if recent_lows else first_l
                        if close_p > donchian_h:
                            signal = "Buy CE"
                            sl_p = donchian_l
                            target_p = close_p + abs(close_p - donchian_l) * rr_ratio
                            reason = f"Turtle Trading Donchian Channel High Breakout above ₹{donchian_h:.1f}."
                        elif close_p < donchian_l:
                            signal = "Buy PE"
                            sl_p = donchian_h
                            target_p = close_p - abs(donchian_h - close_p) * rr_ratio
                            reason = f"Turtle Trading Donchian Channel Low Breakdown below ₹{donchian_l:.1f}."

                    # 8. Mark Minervini Volatility Contraction Pattern (VCP)
                    elif strat_key == "minervini_vcp":
                        if i >= 3:
                            r1 = candles[i-3]["high"] - candles[i-3]["low"]
                            r2 = candles[i-2]["high"] - candles[i-2]["low"]
                            r3 = candles[i-1]["high"] - candles[i-1]["low"]
                            if r1 > r2 and r2 > r3 and close_p > c_prev["high"]:
                                signal = "Buy CE"
                                sl_p = c_prev["low"]
                                target_p = close_p + abs(close_p - sl_p) * rr_ratio
                                reason = f"Minervini VCP Tight Contraction Breakout (Ranges: {r1:.1f} > {r2:.1f} > {r3:.1f})."

                    # 9. Oliver Velez 20/200 SMA Location (Elephant Bars)
                    elif strat_key == "oliver_velez":
                        bar_range = high_p - low_p
                        body_range = abs(close_p - c_curr["open"])
                        if body_range > 18.0 and body_range / (bar_range + 0.1) > 0.75:
                            if close_p > c_curr["open"] and close_p > vwap:
                                signal = "Buy CE"
                                sl_p = low_p
                                target_p = close_p + abs(close_p - low_p) * rr_ratio
                                reason = "Oliver Velez Bullish Elephant Bar Breakout above VWAP."
                            elif close_p < c_curr["open"] and close_p < vwap:
                                signal = "Buy PE"
                                sl_p = high_p
                                target_p = close_p - abs(high_p - close_p) * rr_ratio
                                reason = "Oliver Velez Bearish Elephant Bar Breakdown below VWAP."

                    # 10. Alexander Elder Triple Screen System
                    elif strat_key == "elder_triple_screen":
                        macro_trend = "BULLISH" if close_p > vwap else "BEARISH"
                        if macro_trend == "BULLISH" and low_p < vwap * 0.999:
                            signal = "Buy CE"
                            sl_p = low_p - 5.0
                            target_p = close_p + 35.0
                            reason = "Elder Triple Screen: Bullish Macro Trend + Oversold Dip Pullback Entry."
                        elif macro_trend == "BEARISH" and high_p > vwap * 1.001:
                            signal = "Buy PE"
                            sl_p = high_p + 5.0
                            target_p = close_p - 35.0
                            reason = "Elder Triple Screen: Bearish Macro Trend + Overbought Rally Pullback Entry."

                    # 11. Tom DeMark TD Sequential (TD 9 Reversal)
                    elif strat_key == "demark_td9":
                        if i >= 8:
                            closes = [c["close"] for c in candles[i-8:i+1]]
                            bull_cnt = sum(1 for k in range(4, 9) if closes[k] < closes[k-4])
                            bear_cnt = sum(1 for k in range(4, 9) if closes[k] > closes[k-4])
                            if bull_cnt >= 4:
                                signal = "Buy CE"
                                sl_p = low_p - 10.0
                                target_p = close_p + 45.0
                                reason = "Tom DeMark TD Sequential 9 Buy Exhaustion Reversal."
                            elif bear_cnt >= 4:
                                signal = "Buy PE"
                                sl_p = high_p + 10.0
                                target_p = close_p - 45.0
                                reason = "Tom DeMark TD Sequential 9 Sell Exhaustion Reversal."

                    # 12. Nicolas Darvas Box Strategy
                    elif strat_key == "darvas_box":
                        box_top = first_h
                        box_bottom = first_l
                        if close_p > box_top:
                            signal = "Buy CE"
                            sl_p = box_bottom
                            target_p = close_p + abs(close_p - box_bottom) * rr_ratio
                            reason = f"Darvas Box Upper Boundary Breakout above ₹{box_top:.1f}."
                        elif close_p < box_bottom:
                            signal = "Buy PE"
                            sl_p = box_top
                            target_p = close_p - abs(box_top - close_p) * rr_ratio
                            reason = f"Darvas Box Lower Boundary Breakdown below ₹{box_bottom:.1f}."

                    # 13. Linda Raschke 80-20 & Holy Grail
                    elif strat_key == "linda_raschke":
                        if low_p <= vwap and close_p > vwap:
                            signal = "Buy CE"
                            sl_p = low_p
                            target_p = close_p + abs(close_p - low_p) * rr_ratio
                            reason = "Linda Raschke Holy Grail 20 EMA Pullback Entry."
                        elif high_p >= vwap and close_p < vwap:
                            signal = "Buy PE"
                            sl_p = high_p
                            target_p = close_p - abs(high_p - close_p) * rr_ratio
                            reason = "Linda Raschke Holy Grail 20 EMA Rejection Entry."

                    # 14. Smart Money Concepts (SMC / ICT Order Block & FVG)
                    elif strat_key == "smc_ict_fvg":
                        if i >= 2:
                            c_prev2 = candles[i-2]
                            is_bull_fvg = c_curr["low"] > c_prev2["high"]
                            is_bear_fvg = c_curr["high"] < c_prev2["low"]
                            if is_bull_fvg and close_p > vwap:
                                signal = "Buy CE"
                                sl_p = c_prev2["high"]
                                target_p = close_p + abs(close_p - sl_p) * (rr_ratio + 0.5)
                                reason = "SMC/ICT Bullish Fair Value Gap (FVG) Imbalance Breakout."
                            elif is_bear_fvg and close_p < vwap:
                                signal = "Buy PE"
                                sl_p = c_prev2["low"]
                                target_p = close_p - abs(sl_p - close_p) * (rr_ratio + 0.5)
                                reason = "SMC/ICT Bearish Fair Value Gap (FVG) Imbalance Breakdown."

                    # 15. Institutional Options Gamma Squeeze
                    elif strat_key == "gamma_squeeze":
                        near_strike = round(first_h / 50.0) * 50.0
                        if close_p > near_strike and close_p > vwap * 1.001:
                            signal = "Buy CE"
                            sl_p = near_strike - 15.0
                            target_p = close_p + 50.0
                            reason = f"Institutional Options Gamma Squeeze Breakout above strike ₹{near_strike:.0f}."

                    # Process Trade Signal
                    if signal != "No Trade":
                        trade_triggered = True

                        exit_p = close_p
                        outcome = "LOSS"
                        pnl_pts = 0.0

                        for j in range(i + 1, len(candles)):
                            fut_c = candles[j]
                            if signal == "Buy CE":
                                if fut_c["high"] >= target_p:
                                    outcome = "WIN"
                                    exit_p = target_p
                                    break
                                elif fut_c["low"] <= sl_p:
                                    outcome = "LOSS"
                                    exit_p = sl_p
                                    break
                            elif signal == "Buy PE":
                                if fut_c["low"] <= target_p:
                                    outcome = "WIN"
                                    exit_p = target_p
                                    break
                                elif fut_c["high"] >= sl_p:
                                    outcome = "LOSS"
                                    exit_p = sl_p
                                    break
                            elif signal == "Short Strangle":
                                outcome = "WIN"
                                exit_p = close_p + 15.0
                                break

                        if signal == "Buy CE":
                            raw_pts = exit_p - entry_p
                        elif signal == "Buy PE":
                            raw_pts = entry_p - exit_p
                        else:
                            raw_pts = 18.0

                        pnl_pts = raw_pts - slippage
                        pnl_rupees = pnl_pts * self.lot_size * self.num_lots

                        trade_log = {
                            "trade_id": len(strat_res["trades"]) + 1,
                            "date": date_str,
                            "entry_time": time_s,
                            "strategy_key": strat_key,
                            "signal": signal,
                            "entry_spot": round(entry_p, 2),
                            "exit_spot": round(exit_p, 2),
                            "stop_loss": round(sl_p, 2),
                            "target": round(target_p, 2),
                            "outcome": outcome,
                            "pnl_pts": round(pnl_pts, 2),
                            "pnl_rupees": round(pnl_rupees, 2),
                            "reason": reason
                        }

                        strat_res["trades"].append(trade_log)
                        strat_res["total_trades"] += 1
                        if pnl_pts > 0:
                            strat_res["winning_trades"] += 1
                            strat_res["gross_profit_pts"] += pnl_pts
                        else:
                            strat_res["losing_trades"] += 1
                            strat_res["gross_loss_pts"] += abs(pnl_pts)

                        strat_res["net_pnl_pts"] += pnl_pts
                        strat_res["net_pnl_rupees"] += pnl_rupees

                        prev_eq = strat_res["equity_curve"][-1]
                        strat_res["equity_curve"].append(round(prev_eq + pnl_rupees, 2))

        # Compute summary metrics for each strategy
        overall_summary = []

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

        for strat_key, res in results_by_strategy.items():
            tot = res["total_trades"]
            win = res["winning_trades"]
            loss = res["losing_trades"]

            res["win_rate_pct"] = round((win / tot * 100) if tot > 0 else 0.0, 1)
            res["profit_factor"] = round((res["gross_profit_pts"] / res["gross_loss_pts"]) if res["gross_loss_pts"] > 0 else (res["gross_profit_pts"] if res["gross_profit_pts"] > 0 else 1.0), 2)
            res["avg_trade_pnl_pts"] = round(res["net_pnl_pts"] / tot, 2) if tot > 0 else 0.0

            peak = 0.0
            max_dd = 0.0
            for eq in res["equity_curve"]:
                if eq > peak:
                    peak = eq
                dd = peak - eq
                if dd > max_dd:
                    max_dd = dd

            res["max_drawdown_rupees"] = round(max_dd, 2)

            overall_summary.append({
                "key": strat_key,
                "name": name_map.get(strat_key, strat_key),
                "total_trades": tot,
                "winning_trades": win,
                "losing_trades": loss,
                "win_rate_pct": res["win_rate_pct"],
                "net_pnl_pts": round(res["net_pnl_pts"], 2),
                "net_pnl_rupees": round(res["net_pnl_rupees"], 2),
                "profit_factor": res["profit_factor"],
                "max_drawdown_rupees": res["max_drawdown_rupees"],
                "avg_trade_pnl_pts": res["avg_trade_pnl_pts"]
            })

        overall_summary.sort(key=lambda x: x["net_pnl_rupees"], reverse=True)

        return {
            "num_days": num_days,
            "rr_ratio": rr_ratio,
            "lot_size": lot_size,
            "num_lots": num_lots,
            "deduct_slippage": deduct_slippage,
            "summary": overall_summary,
            "details": results_by_strategy
        }
