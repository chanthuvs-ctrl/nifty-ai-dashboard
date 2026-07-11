# Backlog & Roadmap — Nifty AI Dashboard

## Version 1.1

### Critical Stability & Tracking
- [x] **Realized P&L Accuracy**: Ensure closed trades calculate option leg differential exactly, and fall back to spot differential safely if option chain lookup fails.
- [x] **Est. Brokerage Calculation**: Track estimated brokerage (0.5% of total premiums collected/paid) per trade and display the daily sum on the stats bar.
- [x] **Dual P&L Displays**: Completely separate Booked P&L (realized) from Floating P&L (active positions) to avoid confusing combined numbers.
- [x] **Daily Crossover Reset**: Auto-reset trade counts, total legs, and daily closed P&L at 9:00 AM IST daily.

### Position Management
- [x] **Premium-based Trailing SL**: Change option buy SL to 10% of premium, capped at 2% of capital. Use premium-based or percentage-based trailing instead of index spot points.
- [x] **Signal Stabilization Cooldown**: Enforce a 2-minute confirmation filter before acting on exit recommendation shifts to prevent false oscillations in volatile markets.
- [x] **Strict Trading Hours**: Only open new trades between 9:30 AM and 3:00 PM IST. Force square-off of all active auto-trades at 3:00 PM IST.

### UI & Lot Sizing
- [x] **Capital-Based Lot Calculator**: Correct lot calculator so sizing is driven by SL limits and margin constraints rather than raw capital division.
- [x] **Positions Labeling**: Rename all occurrences of "Journal" to "Positions" throughout the UI.
- [ ] **Modals Exit Buttons**: Add a close (`✕`) button to all modals and control overlays.

---

## Version 1.2

### Option Buying MTF Filters
- [ ] **15-Min Macro Bias**: Implement EMA 50 trend filter on 15-minute timeframe.
- [ ] **5-Min Pullback Entry**: Implement RSI pullback zones (40-60) and VWAP touch rules on 5-minute charts.
- [ ] **1-Min Crossover Confirmation**: Integrate MACD crossover triggers on 1-minute chart.

---

## Future Ideas
- [ ] Live SMS/WhatsApp alerts for auto-trading execution events.
- [ ] Custom Webhooks integration for third-party execution terminals.
- [ ] Multi-broker allocation routing (Upstox + Zerodha).

---

## Known Bugs
- [ ] In option chain lookups, index contracts sometimes return 0.0 value fallbacks if the strike is too far ITM/OTM.
- [ ] Option buy trailing stop triggers prematurely on normal market fluctuations.

---

## Technical Debt
- [ ] Clean up redundant HTML templates inside FastAPI inline code.
- [ ] Move Black-Scholes formulas to a separate `math_utils.py` module.
- [ ] Wrap database operations inside a thread-safe file lock.
