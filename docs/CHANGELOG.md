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

## [1.1.0] - Planned

### Security & Compliance
- Standardize on token-based authorization and session state lock.

### Automated Trades Refinement
- Add 2-minute signal debouncing.
- Restrict entries to 9:30 AM - 3:00 PM IST window.
- Implement premium-based trailing stop-loss gates.
