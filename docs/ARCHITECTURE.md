# Architecture — Nifty AI Dashboard

## High-Level Architecture
The system follows a lightweight, single-process, web-dashboard architecture. It is reactive, where the frontend's periodic API requests (every 5 seconds) drive backend operations (scraping, option pricing, indicator calculation, signal generation, and trade evaluation).

```mermaid
graph LR
    subgraph Frontend (Browser)
        UI[Dashboard Layout]
        Chart[Chart.js Intraday Plot]
        Script[script.js Polling Controller]
    end
    subgraph Backend (FastAPI Server)
        App[app.py Routing Engine]
        State[SimulationState Manager]
        Journal[TradeJournal Database Manager]
        BS[Black-Scholes Greek Calculator]
    end
    subgraph External
        Google[Google Finance Scraper]
        UpstoxAPI[Upstox REST API]
    end

    Script -- HTTP GET /api/market-data --> App
    App --> State
    State --> Google
    State --> UpstoxAPI
    State --> BS
    App --> Journal
    Journal --> JFile[(journal.json)]
    State --> SFile[(settings.json)]
    App -- HTTP JSON Response --> Script
```

## Simulation vs. Upstox Feed Mode
- **Simulation Mode**: Uses the web scraper to fetch Nifty/Sensex index prices from Google Finance. Option premiums and Greeks are simulated using the Black-Scholes-Merton model with spot price, volatility (VIX), and PCR.
- **Upstox Mode**: Connects to the Upstox API using a user access token. Fetches live index prices and real-time option chain data. Orders are routed to Upstox's trade server instead of local journal logging.

## API Flow
1. **Polling**: Every 5 seconds, `script.js` requests `/api/market-data`.
2. **Tick Evaluation**: The server handles this request by evaluating the active feed mode:
   - Simulation: ticks candles, updates technical indicators, evaluates regime, runs trade decisions.
   - Upstox: downloads live quotes, runs the decision engine, checks active trades, runs auto-trade logic.
3. **P&L Update**: The server evaluates all open positions. It calculates trailing stop-loss triggers and updates capital risk protection limits (2% capital loss boundary).
4. **JSON Delivery**: The backend delivers a single unified JSON payload containing the spot price, indicators, suggesting trades, open/closed trades, and change logs.

## Simulation Engine
The simulation engine models market volatility, PCR dynamics, and option Greeks:
- **Index Tick**: Simulates minute, 5-minute, and 15-minute candles.
- **Greeks calculation**: Implements the cumulative distribution function (CDF) and probability density function (PDF) of normal distribution to calculate Option Delta, Theta, Vega, and Price.
- **Expected Move**: Calculated using:
  $$	ext{Expected Move} = 	ext{Spot} 	imes rac{	ext{VIX}}{100} 	imes rac{1}{\sqrt{252}}$$

## Decision Engine
Evaluates market parameters to suggest one of the following recommendations:
- `Buy CE` (Bullish directional, VIX > 15)
- `Buy PE` (Bearish directional, VIX > 15)
- `Bull Call Spread` / `Bull Put Spread` (Bullish directional, VIX <= 15)
- `Bear Put Spread` / `Bear Call Spread` (Bearish directional, VIX <= 15)
- `Short Strangle` (Range bound/sideways, VIX <= 18)
- `Iron Condor` (Range bound/sideways, VIX > 18)
- `No Trade` (Confidence below threshold of 65%)

### Technical Factors Evaluated (Weighted Scoring):
1. **Intraday Trend** (Weight: 20): EMA20 vs EMA50, Supertrend direction.
2. **Momentum & Strength** (Weight: 15): RSI and ADX levels.
3. **Opening Range Breakout** (Weight: 15): Price relative to 15-minute Opening Range high/low.
4. **Session Extremes** (Weight: 10): Support/resistance tests at Session High/Low.
5. **Moving Average Cross** (Weight: 10): Relative distance and cross directions of key EMAs.
6. **Support & Resistance Gap** (Weight: 10): High/Low boundaries compared to prev close.
7. **Options Market PCR** (Weight: 10): Put-Call Ratio boundaries.
8. **IV (VIX) Volatility** (Weight: 10): High VIX favors buying / conditional Spreads.
9. **Sector Breadth** (Weight: 10): Sector advances vs declines.

## State Management
- **Persistent State**: Written synchronously to `settings.json` and `journal.json` on modification.
- **In-Memory State**: Maintained in global variables `state` and `journal` in `app.py`.
