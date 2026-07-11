# Changelog — Nifty AI Dashboard

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-07-09

### Added
- **AI Decision Engine**: Multi-factor indicators system with weighted scoring to recommend CE/PE buys, spreads, strangles, or condors.
- **Simulation Environment**: Embedded Black-Scholes pricing models for option chain generation and greeks estimation.
- **Execution Modes**: Manual trade logging and automated paper trading driven by real-time indicator polling.
- **Upstox Brokerage API Integration**: Connect token authentication, real-time option chain fetching, and intraday MIS order placement.
- **User Authentication**: Administrative login and logout cookie verification.
- **Stats Bar**: Dashboard header stats displaying Booked P&L, completed trades count, and executed legs count.
- **Control Enforcements**: Daily halt reset and manual journal clearing capability.

---

## [1.1.0] - 2026-07-11

### Fixed
- **PnL Engine Calculations**: Corrected the booked P&L calculation at trade close so closed trades no longer record ₹0 or fall back improperly when strikes shift outside the active option chain window. Real-time options pricing logic now falls back gracefully to the Black-Scholes pricing engine when live quotes are missing.
- **PnL Separation**: Separated Booked P&L (realized CLOSED trades only) from Floating P&L (unrealized OPEN trades only) across the backend state and frontend views.

### Added
- **Trading Session Hours Enforcements**: Automated entries and exits are strictly gated between 09:30 AM IST and 03:00 PM IST. At exactly 03:00 PM IST, any active position is force squared off.
- **Auto-Disable Automation**: Auto trading mode is automatically set to OFF after 03:30 PM IST.
- **09:00 AM Daily Reset**: Counters for today's trades, today's legs, daily closed P&L, and halt flags are reset at exactly 09:00 AM IST daily, writing a log to the dashboard change timeline.
- **Realistic Lot Sizing Engine**: Replaced basic capital division with dynamic risk-based and margin-based sizing. Option Buying is capped at 10% premium SL (not exceeding 2% capital risk). Strangles (₹1.5L/lot pair) and Spreads (₹50k/lot) respect both margin allocations and 2% risk. Available capital is fetched live from the Upstox balance API in real trading mode, falling back to manual settings for paper trading.
- **Improved Strategy Exit Logic**: Removed all point-based trailing SL exit rules on the spot index (such as the 30-point Nifty trailing exits). Positions now exit only on: Hard Stop Loss hit (2% capital), Profit Target hit (₹1,500/lot for options buying; ₹2,500/lot for sells/spreads), Strategy Signal shift, or Session Square-off at 15:00 IST.
- **AI Signal Confirmation Delay**: Added a 120-second confirmation delay on exits due to AI Signal change. If the signal reverses back to normal during the cooldown, the cooldown is cancelled and the trade continues, avoiding multiple trades from temporary signal fluctuations.
- **PnL-based Trailing Stop-Loss**: Enforced that trailing stop-loss checks run exclusively on trade P&L (never on index spot levels). Option buys activate trailing only after profit exceeds 4% of trading capital. Strangles and spreads activate after configured threshold (default 1% capital).

### Changed
- **UI Positions Rename**: Renamed visible text labels from "Journal" to "Positions" across the main dashboard header and panels while keeping DOM element IDs intact for system consistency.

---

## [1.2.0] - Planned

### Option Buying MTF Filters
- Add 15m/5m/1m macro trend/RSI pullback checks.
