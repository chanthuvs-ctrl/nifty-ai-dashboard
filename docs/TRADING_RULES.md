# Trading Rules — Nifty AI Dashboard

## Capital Management
- **Capital Pool**: Configured in Settings (`capital`, default ₹5,00,000). Used to size all trades and determine risk limits.
- **Margin Threshold**: 80% of total capital is used as the absolute maximum allocation limit for margin-based strategies (strangles, spreads).

## Risk Management (Capital Protection)
- **2% Max Loss Guardrail**: The system computes the aggregate floating P&L of all open positions in real-time. If the total loss exceeds **2% of capital** (e.g. -₹10,000 on ₹5,00,000 capital), the system automatically triggers an emergency market exit. All open positions are immediately squared off.
- **Halt Execution**: Once the 2% daily loss limit is hit, no new automated trades can be initiated for the remainder of the session, unless manually reset.

## Lot Sizing Logic
- **Option Buying (CE/PE)**: Limit risk to 2% of capital.
  - Risk per lot is approximated as:
    $$	ext{Risk per lot} = 0.5 	imes 30.0 	imes 	ext{Lot Size}$$
  - Suggested lots = `max(1, int(Max Risk / Risk per lot))`.
- **Option Selling / Spreads**:
  - Conservative margin requirement: ₹1,20,000 for spreads/strangles, ₹15,000 for buying.
  - Suggested lots = `max(1, int(Capital / Margin Requirement))`.

*Lot sizes used: Nifty = 65, Sensex = 20.*

## Auto Trading Logic
- **Execution Mode**: Configured as `OFF`, `Paper`, or `Live`.
- **Entry Trigger**: When a strategy shift occurs and confidence exceeds 65%, the system places simulated or real trades according to the recommendation.
- **Signal Confirmation**: Auto trades are placed dynamically when the decision engine recommendation changes.
- **Exit Trigger**:
  1. Target Profit reached.
  2. Stop Loss reached (2% capital risk).
  3. Trailing Stop Loss hit.
  4. Decision engine recommendation shifts away from the current strategy (e.g., from Bullish to Sideways).

## Trailing Stop Rules
- **Points-based spot trailing**:
  - Trailing distance is configured in Settings (`trailing_sl_pts`, default 30.0 points).
  - **Long Positions (Bullish)**: Trailed upward from the highest spot price seen since trade entry. Trigger occurs if spot price drops below `highest_spot_seen - trailing_sl_pts`.
  - **Short Positions (Bearish)**: Trailed downward from the lowest spot price seen since trade entry. Trigger occurs if spot price rises above `lowest_spot_seen + trailing_sl_pts`.

## Trading Hours & Limits
- Currently, the simulation and live tick evaluations run whenever the dashboard frontend polls the API.
- There are no hard limits on hours implemented in the v1.0.0 codebase. System processes ticks continuously on requests.
