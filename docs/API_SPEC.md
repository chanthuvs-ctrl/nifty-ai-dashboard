# REST API Specifications — Nifty AI Dashboard

## Base URL
Default local host: `http://localhost:8000`

---

## 1. Get Market Data
- **URL**: `/api/market-data`
- **Method**: `GET`
- **Purpose**: Triggers state evaluation tick and returns current market data, indicators, option chain, and trade suggestions.
- **Parameters**: None
- **Response**: JSON object containing:
  - `spot_price`: Current index spot price (float).
  - `change_pct`: Intraday change percentage (float).
  - `change_val`: Intraday change value (float).
  - `regime`: Current classified market regime (string).
  - `recommendation`: Strategy recommendation (string).
  - `confidence`: Confidence score (float).
  - `reasoning`: Array of technical indicators support reasons (array of strings).
  - `option_chain`: Option chain table data (array of objects).
  - `daily_pnl`: Realized daily P&L (float).
  - `today_trades`: Number of closed trades today (int).
- **Example Response**:
  ```json
  {
    "spot_price": 24270.85,
    "change_pct": 0.45,
    "change_val": 108.35,
    "price_source": "Google Finance",
    "regime": "Range Bound",
    "recommendation": "Short Strangle",
    "confidence": 75.0,
    "reasoning": ["PCR balances calls and puts (+10)"],
    "option_chain": [
      {
        "strike": 24250,
        "call_price": 85.5,
        "put_price": 72.3,
        "call_instrument_key": "SIM_CALL_24250",
        "put_instrument_key": "SIM_PUT_24250"
      }
    ],
    "daily_pnl": 1250.0,
    "today_trades": 2
  }
  ```

---

## 2. Get Logs
- **URL**: `/api/logs`
- **Method**: `GET`
- **Purpose**: Returns the timeline of all recommendation changes and strategy updates.
- **Parameters**: None
- **Response**: Array of log events.
- **Example Response**:
  ```json
  [
    {
      "time": "11:24:05",
      "prev_strategy": "No Trade",
      "new_strategy": "Short Strangle",
      "confidence": "72.0%",
      "reason": "Schedule"
    }
  ]
  ```

---

## 3. Get Settings
- **URL**: `/api/settings`
- **Method**: `GET`
- **Purpose**: Retrieves all current dashboard configuration settings and available option expiry dates.
- **Parameters**: None
- **Response**: JSON object containing settings.
- **Example Response**:
  ```json
  {
    "capital": 500000.0,
    "risk_pct": 1.0,
    "preferred_broker": "Upstox",
    "preferred_strategy": "All",
    "refresh_interval": 5,
    "regime_override": "Auto",
    "auto_trade_mode": "OFF",
    "trailing_sl_pts": 30.0,
    "upcoming_expiry_dates": ["2026-07-16", "2026-07-23"]
  }
  ```

---

## 4. Update Settings
- **URL**: `/api/settings`
- **Method**: `POST`
- **Purpose**: Updates one or more dashboard configurations.
- **Content-Type**: `application/json`
- **Payload Parameters**:
  - `capital`: float
  - `risk_pct`: float
  - `preferred_broker`: string
  - `preferred_strategy`: string
  - `regime_override`: string
  - `feed_mode`: string
  - `upstox_access_token`: string
  - `upstox_expiry_date`: string
  - `dashboard_username`: string
  - `dashboard_password`: string
  - `auto_trade_mode`: string
  - `trailing_sl_pts`: float
- **Response**: `{"status": "SUCCESS"}`

---

## 5. Get Trade Journal
- **URL**: `/api/journal`
- **Method**: `GET`
- **Purpose**: Retrieves all recorded trades and summary analytics.
- **Parameters**: None
- **Response**: JSON object containing:
  - `trades`: Array of all trades (newest first).
  - `analytics`: Performance metrics for Paper trades.
  - `live_analytics`: Performance metrics for Live trades.
- **Example Response**:
  ```json
  {
    "trades": [
      {
        "id": "1",
        "date": "2026-07-09",
        "strategy": "Bull Put Spread",
        "entry_spot": 22210.0,
        "exit_spot": 22260.0,
        "status": "CLOSED",
        "pnl": 6500.0,
        "outcome": "WIN"
      }
    ],
    "analytics": {
      "win_rate": "100.0%",
      "profit_factor": "6.50",
      "drawdown": "0.00%"
    }
  }
  ```

---

## 6. Place Trade
- **URL**: `/api/journal/trade`
- **Method**: `POST`
- **Purpose**: Manually logs a trade execution into the journal.
- **Content-Type**: `application/json`
- **Payload Parameters**:
  - `strategy`: string
  - `entry_spot`: float
  - `strikes`: array of strings
  - `confidence`: float
  - `reason`: string
  - `size`: int
  - `legs`: Optional array of objects
- **Response**: `{"status": "SUCCESS", "trade": {...}}`

---

## 7. Close Trade
- **URL**: `/api/journal/close`
- **Method**: `POST`
- **Purpose**: Closes an open trade and calculates final P&L.
- **Content-Type**: `application/json`
- **Payload Parameters**:
  - `trade_id`: string
  - `exit_spot`: float
- **Response**: `{"status": "SUCCESS", "trade": {...}}`

---

## 8. Reset Daily Halt
- **URL**: `/api/reset-daily-halt`
- **Method**: `POST`
- **Purpose**: Clears the daily loss limit flag and re-enables Paper trading mode.
- **Response**: `{"status": "SUCCESS", "message": "Daily halt cleared."}`

---

## 9. Clear Today's Journal
- **URL**: `/api/journal/clear-today`
- **Method**: `POST`
- **Purpose**: Deletes all of today's trades and resets closed P&L to zero.
- **Response**: `{"status": "SUCCESS", "removed": 2}`

---

## 10. Delete All Journal Trades
- **URL**: `/api/journal/all`
- **Method**: `DELETE`
- **Purpose**: Purges all historical trades from the database (requires authentication cookie).
- **Response**:
  ```json
  {
    "status": "SUCCESS",
    "removed": 15,
    "message": "All trades deleted successfully."
  }
  ```
