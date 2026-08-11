from typing import Dict, Any, List, Optional

def find_scalper_trade(
    enriched_chain: List[Dict[str, Any]], 
    spot_price: float, 
    capital: float,
    preferred_index: str = "Nifty"
) -> Optional[Dict[str, Any]]:
    """
    Scans the enriched option chain to find an institutional scalping opportunity.
    Applies strict risk and sizing bounds:
    - Premium >= ₹20
    - Lots capped at max 27 (to avoid order splitting)
    - Lots sized maximally to fit within allocated capital
    - Imbalance <= -4.0%
    """
    if capital < 2000:
        return None
        
    lot_size = 20 if preferred_index.lower() == "sensex" else 65
    
    candidates = []
    
    for item in enriched_chain:
        strike = item.get("strike", item.get("strike_price"))
        
        # Check Calls
        c_price = item.get("call_price", 0.0)
        c_fair = item.get("fair_call_price", 0.0)
        c_imb = item.get("call_imbalance_pct", 0.0)
        
        if c_price >= 20.0 and c_fair > 0 and (c_price * lot_size) <= capital:
            if c_imb <= -4.0:
                candidates.append({
                    "strike": strike, 
                    "type": "CE", 
                    "price": c_price, 
                    "fair": c_fair, 
                    "imb": c_imb
                })
                
        # Check Puts
        p_price = item.get("put_price", 0.0)
        p_fair = item.get("fair_put_price", 0.0)
        p_imb = item.get("put_imbalance_pct", 0.0)
        
        if p_price >= 20.0 and p_fair > 0 and (p_price * lot_size) <= capital:
            if p_imb <= -4.0:
                candidates.append({
                    "strike": strike, 
                    "type": "PE", 
                    "price": p_price, 
                    "fair": p_fair, 
                    "imb": p_imb
                })
                
    if not candidates:
        return None
        
    # Sort candidates by best imbalance (most undervalued first)
    candidates.sort(key=lambda x: x["imb"])
    
    best_candidate = candidates[0]
    entry_price = best_candidate["price"]
    
    # Calculate Lots
    max_affordable_lots = int(capital // (entry_price * lot_size))
    lots = min(27, max_affordable_lots)
    
    if lots < 1:
        return None
        
    # Calculate Exits
    # Target = Max(Fair Value, Entry + 2.50) to beat friction
    target_price = max(best_candidate["fair"], entry_price + 2.50)
    
    # SL = Entry - 2.00 (Strict tight stop)
    sl_price = round(entry_price - 2.00, 2)
    
    trade_signal = {
        "strike": best_candidate["strike"],
        "type": best_candidate["type"],
        "entry": round(entry_price, 2),
        "target": round(target_price, 2),
        "sl": sl_price,
        "lots": lots,
        "imbalance": best_candidate["imb"],
        "fair_value": best_candidate["fair"]
    }
    
    return trade_signal
