import math
from typing import Dict, List, Any

def normal_cdf(x: float) -> float:
    """Cumulative distribution function for standard normal distribution."""
    # Approximation of normal cumulative distribution
    temp = 1.0 / (1.0 + 0.2316419 * abs(x))
    k = ((((1.330274429 * temp - 1.821255978) * temp + 1.781477937) * temp - 0.356563782) * temp + 0.319381530) * temp
    ans = 1.0 - 0.398942280401 * math.exp(-0.5 * x * x) * k
    return ans if x >= 0 else 1.0 - ans

def normal_pdf(x: float) -> float:
    """Probability density function for standard normal distribution."""
    return math.exp(-0.5 * x * x) / 2.5066282746310005  # 1.0 / sqrt(2 * pi)

def calculate_black_scholes_price(
    s: float, k: float, t: float, sigma: float, r: float, is_call: bool
) -> float:
    """
    s: spot price
    k: strike price
    t: time to expiration (in years, e.g. days/365)
    sigma: implied volatility (as decimal)
    r: risk-free interest rate (as decimal)
    """
    if t <= 0 or sigma <= 0 or s <= 0 or k <= 0:
        # Expiry state intrinsic values
        return max(0.05, float(round(max(0.0, s - k) if is_call else max(0.0, k - s), 2)))
        
    try:
        d1 = (math.log(s / k) + (r + 0.5 * sigma ** 2) * t) / (sigma * math.sqrt(t))
        d2 = d1 - sigma * math.sqrt(t)
        
        if is_call:
            price = s * normal_cdf(d1) - k * math.exp(-r * t) * normal_cdf(d2)
        else:
            price = k * math.exp(-r * t) * normal_cdf(-d2) - s * normal_cdf(-d1)
        return max(0.05, float(round(price, 2)))
    except Exception:
        # Fallback to intrinsic value
        return max(0.05, float(round(max(0.0, s - k) if is_call else max(0.0, k - s), 2)))

def compute_option_chain_arbitrage(
    option_chain: List[Dict[str, Any]], 
    spot_price: float, 
    days_to_expiry: float = 1.0
) -> List[Dict[str, Any]]:
    """
    Takes option chain data list and spot price, calculates theoretical fair values,
    and returns enriched data containing imbalance percentages.
    """
    t_years = max(0.0001, days_to_expiry / 365.0)
    risk_free_rate = 0.07  # Standard interest rate in India (7%)
    
    enriched_chain = []
    
    for item in option_chain:
        strike = float(item.get("strike", item.get("strike_price", 0)))
        if strike <= 0:
            continue
            
        call_price = float(item.get("call_price", 0.05))
        put_price = float(item.get("put_price", 0.05))
        
        # Determine implied or baseline volatility (standard dynamic volatility estimation)
        call_iv_val = item.get("call_iv", 13.0)
        if isinstance(call_iv_val, str):
            call_iv_val = call_iv_val.replace("%", "").strip()
        
        put_iv_val = item.get("put_iv", 13.0)
        if isinstance(put_iv_val, str):
            put_iv_val = put_iv_val.replace("%", "").strip()
            
        try:
            call_iv = float(call_iv_val) / 100.0
        except Exception:
            call_iv = 0.13
            
        try:
            put_iv = float(put_iv_val) / 100.0
        except Exception:
            put_iv = 0.13
        
        if call_iv <= 0: call_iv = 0.13
        if put_iv <= 0: put_iv = 0.13
        
        # Calculate theoretical fair prices
        fair_call = calculate_black_scholes_price(spot_price, strike, t_years, call_iv, risk_free_rate, is_call=True)
        fair_put = calculate_black_scholes_price(spot_price, strike, t_years, put_iv, risk_free_rate, is_call=False)
        
        # Calculate pricing imbalances
        # Imbalance % = ((Live LTP - Fair Price) / Fair Price) * 100
        call_imbalance = 0.0
        if fair_call > 0:
            call_imbalance = round(((call_price - fair_call) / fair_call) * 100.0, 2)
            
        put_imbalance = 0.0
        if fair_put > 0:
            put_imbalance = round(((put_price - fair_put) / fair_put) * 100.0, 2)
            
        enriched_item = dict(item)
        enriched_item["fair_call_price"] = fair_call
        enriched_item["call_imbalance_pct"] = call_imbalance
        enriched_item["fair_put_price"] = fair_put
        enriched_item["put_imbalance_pct"] = put_imbalance
        
        enriched_chain.append(enriched_item)
        
    return enriched_chain

def scan_top_arbitrage_opportunities(enriched_chain: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """
    Scans the enriched option chain and returns top undervalued and overvalued contracts.
    """
    undervalued = []
    overvalued = []
    
    for item in enriched_chain:
        strike = item.get("strike", item.get("strike_price"))
        
        # Call CE checks
        c_price = item.get("call_price", 0)
        if c_price > 2.0: # Skip deep OTM illiquid options
            c_imb = item.get("call_imbalance_pct", 0)
            c_fair = item.get("fair_call_price", 0)
            opp = {"strike": strike, "type": "CE", "price": c_price, "fair_price": c_fair, "imbalance_pct": c_imb}
            if c_imb <= -5.0:
                undervalued.append(opp)
            elif c_imb >= 5.0:
                overvalued.append(opp)
                
        # Put PE checks
        p_price = item.get("put_price", 0)
        if p_price > 2.0:
            p_imb = item.get("put_imbalance_pct", 0)
            p_fair = item.get("fair_put_price", 0)
            opp = {"strike": strike, "type": "PE", "price": p_price, "fair_price": p_fair, "imbalance_pct": p_imb}
            if p_imb <= -5.0:
                undervalued.append(opp)
            elif p_imb >= 5.0:
                overvalued.append(opp)
                
    # Sort opportunities: most undervalued first, most overvalued first
    undervalued = sorted(undervalued, key=lambda x: x["imbalance_pct"])[:5]
    overvalued = sorted(overvalued, key=lambda x: x["imbalance_pct"], reverse=True)[:5]
    
    return {"undervalued": undervalued, "overvalued": overvalued}
