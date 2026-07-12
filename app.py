import math
import random
import time
import os
import json
import asyncio
import requests
import re
import datetime
import uuid
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI(title="Nifty Intraday AI Strategy Decision Engine API")

# Indian Standard Time (IST) Timezone Helpers
def get_ist_datetime():
    utc_now = datetime.datetime.now(datetime.timezone.utc)
    return utc_now + datetime.timedelta(hours=5, minutes=30)

def get_ist_time_str() -> str:
    return get_ist_datetime().strftime("%H:%M:%S")

def get_ist_date_str() -> str:
    return get_ist_datetime().strftime("%Y-%m-%d")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_no_cache_headers(request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path.endswith((".html", ".js", ".css")) or path == "/":
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response


# ==========================================
# 1. BLACK-SCHOLES PRICING & GREEKS ENGINE
# ==========================================

def normal_cdf(x: float) -> float:
    """Cumulative distribution function for standard normal distribution."""
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))

def normal_pdf(x: float) -> float:
    """Probability density function for standard normal distribution."""
    return (1.0 / math.sqrt(2.0 * math.pi)) * math.exp(-0.5 * x * x)

def calculate_greeks(
    s: float, k: float, t: float, sigma: float, r: float, is_call: bool
) -> Dict[str, float]:
    """
    s: spot price
    k: strike price
    t: time to expiration (in years, e.g., days/365)
    sigma: implied volatility (as decimal, e.g., 0.15)
    r: risk-free interest rate (as decimal, e.g., 0.07)
    """
    if t <= 0:
        # Expiry state
        price = max(0.0, s - k) if is_call else max(0.0, k - s)
        return {
            "price": price, "delta": 1.0 if is_call and s > k else (-1.0 if not is_call and s < k else 0.0),
            "gamma": 0.0, "theta": 0.0, "vega": 0.0
        }
    
    d1 = (math.log(s / k) + (r + 0.5 * sigma ** 2) * t) / (sigma * math.sqrt(t))
    d2 = d1 - sigma * math.sqrt(t)
    
    if is_call:
        price = s * normal_cdf(d1) - k * math.exp(-r * t) * normal_cdf(d2)
        delta = normal_cdf(d1)
        # Theta for call (daily decay)
        theta_val = (
            -(s * normal_pdf(d1) * sigma) / (2 * math.sqrt(t)) 
            - r * k * math.exp(-r * t) * normal_cdf(d2)
        ) / 365.0
    else:
        price = k * math.exp(-r * t) * normal_cdf(-d2) - s * normal_cdf(-d1)
        delta = normal_cdf(d1) - 1.0
        # Theta for put (daily decay)
        theta_val = (
            -(s * normal_pdf(d1) * sigma) / (2 * math.sqrt(t)) 
            + r * k * math.exp(-r * t) * normal_cdf(-d2)
        ) / 365.0

    gamma = normal_pdf(d1) / (s * sigma * math.sqrt(t))
    vega = (s * normal_pdf(d1) * math.sqrt(t)) / 100.0  # divided by 100 for 1% IV change
    
    return {
        "price": max(0.01, price),
        "delta": delta,
        "gamma": gamma,
        "theta": theta_val,
        "vega": vega
    }


def fetch_live_index_price(index_symbol: str = "Nifty"):
    """Fetch live Nifty 50 or SENSEX spot price and intraday changes from Google Finance."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    price, change_pct, change_val = None, 0.0, 0.0
    try:
        if index_symbol.lower() == "sensex":
            url = "https://www.google.com/finance/quote/SENSEX:INDEXBOM"
            title = "BSE SENSEX"
        else:
            url = "https://www.google.com/finance/quote/NIFTY_50:INDEXNSE"
            title = "NIFTY 50"
            
        resp = requests.get(url, headers=headers, timeout=5)
        idx = resp.text.find(f'class="gO24Ff">{title}</div>')
        if idx != -1:
            block = resp.text[idx:idx+1500]
            
            # Spot Price
            match_price = re.search(r'jsname="Pdsbrc"[^>]*><span>([^<]+)</span>', block, re.DOTALL)
            if match_price:
                price = float(match_price.group(1).replace(",", ""))
                
            # Change percentage
            match_pct = re.search(r'jsname="vY9t3b"[^>]*><span[^>]*>([^<]+)</span>', block, re.DOTALL)
            if match_pct:
                pct_str = match_pct.group(1).replace("%", "").replace(",", "")
                change_pct = float(pct_str)
                
            # Change value
            match_val = re.search(r'jsname="xnruHf"[^>]*>(?:<span>)*([^<+-]*[+-][^<]+?)(?:</span>)+', block, re.DOTALL)
            if not match_val:
                match_val = re.search(r'\(([^)]+)\)\s*Today', block, re.DOTALL)
            if match_val:
                val_str = match_val.group(1).replace(",", "")
                change_val = float(val_str)
    except Exception as e:
        print(f"Live {index_symbol} fetch warning:", e)
    return price, change_pct, change_val


# ==========================================
# 2. SIMULATION & DATA ENGINE STATE
# ==========================================

class SimulationState:
    def __init__(self):
        # Fetch live price or fallback to current typical price
        price_data = fetch_live_index_price("Nifty")
        live_price = price_data[0] if price_data[0] is not None else 24270.85
        self.spot_price = live_price
        self.intraday_change_pct = price_data[1]
        self.intraday_change_val = price_data[2]
        self.prev_close_baseline = live_price - self.intraday_change_val
        self.vix = 14.5
        self.pcr = 0.95
        self.last_live_fetch = time.time()
        self.market_session = "Live Market"
        self.premarket_open_price = None
        self.price_source = "Google Finance (NSE India)" if live_price else "Simulation Fallback"
        self.price_date = get_ist_date_str()
        self.price_time = get_ist_time_str()
        
        # Historical completed candles for multi-timeframe analysis
        self.candles_1m: List[Dict] = []
        self.candles_5m: List[Dict] = []
        self.candles_15m: List[Dict] = []
        self.completed_candles = self.candles_5m  # Backwards compatibility alias
        
        # Price history for live chart (capped at 360 points ≈ 30 min at 5s intervals)
        self.price_history: List[Dict] = []
        
        # Current building candles
        self.candle_1m = {
            "time": time.time(),
            "open": self.spot_price,
            "high": self.spot_price,
            "low": self.spot_price,
            "close": self.spot_price,
            "volume": 0.0,
            "vwap_sum_pv": 0.0,
            "vwap_sum_v": 0.0
        }
        self.candle_5m = {
            "time": time.time(),
            "open": self.spot_price,
            "high": self.spot_price,
            "low": self.spot_price,
            "close": self.spot_price,
            "volume": 0.0,
            "vwap_sum_pv": 0.0,
            "vwap_sum_v": 0.0
        }
        self.candle_15m = {
            "time": time.time(),
            "open": self.spot_price,
            "high": self.spot_price,
            "low": self.spot_price,
            "close": self.spot_price,
            "volume": 0.0,
            "vwap_sum_pv": 0.0,
            "vwap_sum_v": 0.0
        }
        self.current_candle = self.candle_5m
        
        # Session benchmarks
        self.opening_range_high = self.spot_price + 40.0
        self.opening_range_low = self.spot_price - 40.0
        self.prev_day_high = self.spot_price + 100.0
        self.prev_day_low = self.spot_price - 100.0
        self.today_high = self.spot_price + 45.0
        self.today_low = self.spot_price - 45.0
        self.gap_pct = 0.35 # % gap up
        
        # Technical Indicator States
        self.ema_20 = self.spot_price - 5.0
        self.ema_50 = self.spot_price - 20.0
        self.rsi = 52.0
        self.adx = 22.0
        self.supertrend = "Bullish" # Bullish / Bearish
        self.supertrend_val = self.spot_price - 70.0
        self.macd = 1.5
        self.macd_signal = 0.8
        
        # Breadth and sectors
        self.advance_decline = 1.25 # Adv / Decl ratio
        self.sector_strength = {
            "Nifty Bank": 0.45,
            "Nifty IT": -0.25,
            "Nifty FMCG": 0.15,
            "Nifty Metal": 0.85
        }
        
        # Settings
        self.settings = {
            "capital": 500000.0,
            "risk_pct": 1.0, # 1% risk per trade
            "preferred_broker": "Upstox",
            "preferred_strategy": "All",
            "refresh_interval": 5, # seconds
            "vix_threshold": 10.0, # % change
            "regime_override": "Auto", # "Auto" or specific name
            "vix_baseline": 14.5,
            "feed_mode": "Simulation", # "Simulation" or "Upstox"
            "upstox_access_token": "",
            "upstox_expiry_date": (datetime.date.today() + datetime.timedelta(days=(3 - datetime.date.today().weekday()) % 7)).strftime("%Y-%m-%d"),
            "preferred_index": "Nifty",
            "dashboard_username": "admin",
            "dashboard_password": "password123",
            "session_token": "",
            "auto_trade_mode": "OFF",
            "trailing_sl_pts": 30.0
        }
        
        # Load settings from disk if exists
        if os.path.exists("settings.json"):
            try:
                with open("settings.json", "r") as f:
                    saved = json.load(f)
                    self.settings.update(saved)
            except Exception as e:
                print(f"Failed to load settings from disk: {e}")
                
        # Ensure saved expiry date is not in the past
        today_str = datetime.date.today().strftime("%Y-%m-%d")
        saved_expiry = self.settings.get("upstox_expiry_date")
        if saved_expiry and saved_expiry < today_str:
            self.update_default_expiry()
            if self.settings.get("upstox_expiry_date") < today_str:
                pref_index = self.settings.get("preferred_index", "Nifty")
                target_weekday = 4 if pref_index.lower() == "sensex" else 3
                days_ahead = (target_weekday - datetime.date.today().weekday()) % 7
                next_expiry = datetime.date.today() + datetime.timedelta(days=days_ahead)
                self.settings["upstox_expiry_date"] = next_expiry.strftime("%Y-%m-%d")
            self.save_settings()
        
        self.upstox_option_chain = []
        self.option_chain = []
        
        # Live Auto-Trading State
        self.auto_trade_active_id = None
        self.daily_closed_pnl = 0.0
        self.daily_stop_limit_hit = False
        self.highest_lowest_spot_since_entry = 0.0
        self.initial_sl_price = 0.0
        self.trailed_sl_price = 0.0
        self.last_trade_date = get_ist_date_str()
        
        # AI Signal Change Cooldown State (v1.1)
        self.signal_change_pending = False
        self.signal_change_pending_since = 0.0
        self.pending_exit_signal = "" 
        
        # Trailing Stop Activation State (v1.1)
        self.trail_activated = False
        self.peak_pnl_since_activation = -999999.0
        
        # Dynamic active recommendation
        self.current_recommendation = "No Trade"
        self.confidence = 50.0
        self.market_regime = "Range Bound"
        self.rec_reasoning: List[str] = ["Awaiting sufficient candles."]
        self.rec_negation: List[str] = ["Waiting for signals to strengthen."]
        self.recalculation_trigger = "Schedule"
        self.last_rec_time = time.time()
        self.last_strategy_change_time = 0.0
        
        # Strategy change history log
        self.change_log: List[Dict] = []
        
        # Initializing historical candles for technical analysis
        self._init_history()
        
    def _init_history(self):
        """Pre-populate 20 completed candles for each timeframe so EMAs/RSI work immediately."""
        now_ts = time.time()
        
        # 1-minute candles initialization
        start_time_1m = now_ts - (20 * 60)
        curr = self.spot_price - 10.0
        for i in range(20):
            c_time = start_time_1m + (i * 60)
            open_p = curr
            close_p = curr + random.uniform(-5, 5)
            high_p = max(open_p, close_p) + random.uniform(0, 2)
            low_p = min(open_p, close_p) - random.uniform(0, 2)
            vol = random.uniform(200, 1000)
            vw = (open_p + high_p + low_p + close_p) / 4
            self.candles_1m.append({
                "time": c_time,
                "open": open_p,
                "high": high_p,
                "low": low_p,
                "close": close_p,
                "volume": vol,
                "vwap": vw
            })
            curr = close_p
            
        # 5-minute candles initialization
        start_time_5m = now_ts - (20 * 300)
        curr = self.spot_price - 10.0
        for i in range(20):
            c_time = start_time_5m + (i * 300)
            open_p = curr
            close_p = curr + random.uniform(-25, 25)
            high_p = max(open_p, close_p) + random.uniform(0, 10)
            low_p = min(open_p, close_p) - random.uniform(0, 10)
            vol = random.uniform(1000, 5000)
            vw = (open_p + high_p + low_p + close_p) / 4
            self.candles_5m.append({
                "time": c_time,
                "open": open_p,
                "high": high_p,
                "low": low_p,
                "close": close_p,
                "volume": vol,
                "vwap": vw
            })
            curr = close_p
            
        # 15-minute candles initialization
        start_time_15m = now_ts - (20 * 900)
        curr = self.spot_price - 10.0
        for i in range(20):
            c_time = start_time_15m + (i * 900)
            open_p = curr
            close_p = curr + random.uniform(-75, 75)
            high_p = max(open_p, close_p) + random.uniform(0, 30)
            low_p = min(open_p, close_p) - random.uniform(0, 30)
            vol = random.uniform(3000, 15000)
            vw = (open_p + high_p + low_p + close_p) / 4
            self.candles_15m.append({
                "time": c_time,
                "open": open_p,
                "high": high_p,
                "low": low_p,
                "close": close_p,
                "volume": vol,
                "vwap": vw
            })
            curr = close_p
            
        self.spot_price = curr
        for candle in [self.candle_1m, self.candle_5m, self.candle_15m]:
            candle["open"] = curr
            candle["high"] = curr
            candle["low"] = curr
            candle["close"] = curr
        self.recompute_indicators()
        
    def save_settings(self):
        try:
            with open("settings.json", "w") as f:
                json.dump(self.settings, f, indent=4)
        except Exception as e:
            print(f"Failed to save settings: {e}")

    def get_upstox_expiries(self, preferred_index: str) -> List[str]:
        token = self.settings.get("upstox_access_token")
        if not token:
            return []
            
        cache_key = preferred_index.lower()
        now = time.time()
        if hasattr(self, "_expiry_cache") and cache_key in self._expiry_cache:
            cache_time, cached_dates = self._expiry_cache[cache_key]
            if now - cache_time < 3600:
                return cached_dates
                
        try:
            url = "https://api.upstox.com/v2/option/contract"
            headers = {
                "Accept": "application/json",
                "Authorization": f"Bearer {token}"
            }
            instrument_key = "BSE_INDEX|SENSEX" if preferred_index.lower() == "sensex" else "NSE_INDEX|Nifty 50"
            resp = requests.get(url, headers=headers, params={"instrument_key": instrument_key}, timeout=5)
            if resp.status_code == 200:
                res_data = resp.json()
                if res_data.get("status") == "success":
                    contracts = res_data.get("data", [])
                    today_str = datetime.date.today().strftime("%Y-%m-%d")
                    expiries = sorted(list(set(c.get("expiry") for c in contracts if c.get("expiry") >= today_str)))
                    if not hasattr(self, "_expiry_cache"):
                        self._expiry_cache = {}
                    self._expiry_cache[cache_key] = (now, expiries[:6])
                    return expiries[:6]
        except Exception as e:
            print(f"Failed fetching expiries from Upstox: {e}")
            
        return []

    def update_default_expiry(self):
        pref_index = self.settings.get("preferred_index", "Nifty")
        feed_mode = self.settings.get("feed_mode", "Simulation")
        
        if feed_mode == "Upstox" and self.settings.get("upstox_access_token"):
            expiries = self.get_upstox_expiries(pref_index)
            if expiries:
                self.settings["upstox_expiry_date"] = expiries[0]
                return
                
        target_weekday = 4 if pref_index.lower() == "sensex" else 3
        today = datetime.date.today()
        days_ahead = (target_weekday - today.weekday()) % 7
        next_expiry = today + datetime.timedelta(days=days_ahead)
        self.settings["upstox_expiry_date"] = next_expiry.strftime("%Y-%m-%d")

    def analyze_timeframe(self, candles: List[Dict]) -> Dict:
        """Returns indicators and trend direction for a given completed candle history."""
        if len(candles) < 5:
            return {"trend": "Neutral", "ema20": self.spot_price, "ema50": self.spot_price, "rsi": 50.0}
            
        closes = [c["close"] for c in candles]
        
        # Simple EMA calculation helper
        def calculate_ema(data: List[float], span: int) -> float:
            alpha = 2.0 / (span + 1)
            ema = data[0]
            for val in data[1:]:
                ema = val * alpha + ema * (1 - alpha)
            return ema

        ema20 = calculate_ema(closes, min(20, len(closes)))
        ema50 = calculate_ema(closes, min(50, len(closes)))
        
        # RSI 14
        gains = []
        losses = []
        for i in range(1, len(closes)):
            diff = closes[i] - closes[i-1]
            gains.append(max(0.0, diff))
            losses.append(max(0.0, -diff))
            
        avg_gain = sum(gains[-14:]) / 14 if len(gains) >= 14 else 1.0
        avg_loss = sum(losses[-14:]) / 14 if len(losses) >= 14 else 1.0
        
        if avg_loss == 0:
            rsi = 100.0
        else:
            rs = avg_gain / avg_loss
            rsi = 100.0 - (100.0 / (1.0 + rs))
            
        # Classify Trend
        if ema20 > ema50:
            trend = "Bullish" if rsi > 50.0 else "Neutral-Bullish"
        elif ema20 < ema50:
            trend = "Bearish" if rsi < 50.0 else "Neutral-Bearish"
        else:
            trend = "Neutral"
            
        return {
            "trend": trend,
            "ema20": ema20,
            "ema50": ema50,
            "rsi": rsi
        }

    def recompute_indicators(self):
        """Calculates indicators based on completed candle history."""
        analysis_5m = self.analyze_timeframe(self.candles_5m)
        
        # Update self properties using the 5m timeframe
        self.ema_20 = analysis_5m["ema20"]
        self.ema_50 = analysis_5m["ema50"]
        self.rsi = analysis_5m["rsi"]
        
        # ADX (Directional Index approximation)
        self.adx = max(10.0, min(60.0, self.adx + random.uniform(-1.0, 1.0)))
        
        # MACD (Approx)
        self.macd = self.ema_20 - self.ema_50
        self.macd_signal = self.macd * 0.8
        
        # Supertrend direction
        if self.spot_price > self.ema_20:
            self.supertrend = "Bullish"
            self.supertrend_val = self.spot_price - 40.0
        else:
            self.supertrend = "Bearish"
            self.supertrend_val = self.spot_price + 40.0

    def get_rolling_momentum(self) -> float:
        """Returns the rolling price change percentage over the last 2 minutes."""
        if not self.price_history:
            return 0.0
        # Ticks are appended every 5 seconds. 2 minutes = 24 ticks back.
        lookback = min(24, len(self.price_history) - 1)
        prev_price = self.price_history[-lookback - 1]["price"]
        if prev_price <= 0:
            return 0.0
        return ((self.spot_price - prev_price) / prev_price) * 100.0

    def get_available_capital(self) -> float:
        """Returns the capital to be used for lot sizing calculations."""
        mode = self.settings.get("auto_trade_mode", "OFF")
        token = self.settings.get("upstox_access_token")
        
        if mode == "Live" and token:
            url = "https://api.upstox.com/v2/user/profile/balance"
            headers = {
                "Accept": "application/json",
                "Authorization": f"Bearer {token}"
            }
            try:
                resp = requests.get(url, headers=headers, timeout=5)
                if resp.status_code == 200:
                    res_json = resp.json()
                    if res_json.get("status") == "success":
                        equity_data = res_json.get("data", {}).get("equity", {})
                        available = equity_data.get("available_margin")
                        if available is not None:
                            print(f"💰 Upstox Live Capital Query: ₹{available:.2f} available.")
                            return float(available)
            except Exception as e:
                print(f"⚠️ Failed to query Upstox available capital: {e}")
                
        # Default fallback to manual capital setting
        return float(self.settings.get("capital", 500000.0))

    def calculate_suggested_lots_and_margin(self, strategy: str, spot: float) -> tuple:
        """Calculates suggested lots, margin required, and risk amount based on capital and strategy type."""
        capital = self.get_available_capital()
        preferred_index = self.settings.get("preferred_index", "Nifty")
        lot_size = 20 if preferred_index.lower() == "sensex" else 65
        
        # Max SL amount: 2% of capital
        max_risk = capital * 0.02
        
        # 1. Option Buying (Buy CE, Buy PE)
        if "Buy CE" in strategy or "Buy PE" in strategy:
            # Fetch ATM premium (LTP)
            atm_premium = 100.0
            if preferred_index.lower() == "sensex":
                atm_strike = round(spot / 100.0) * 100
            else:
                atm_strike = round(spot / 50.0) * 50
                
            for item in self.option_chain:
                if item.get("strike") == atm_strike:
                    if "CE" in strategy:
                        atm_premium = item.get("call_price", 100.0)
                    else:
                        atm_premium = item.get("put_price", 100.0)
                    break
            
            # SL = 10% premium. Risk per lot = premium * lot_size * 0.10
            risk_per_lot = atm_premium * lot_size * 0.10
            suggested_lots = max(1, int(max_risk / risk_per_lot))
            margin_per_lot = atm_premium * lot_size
            
            margin_required = suggested_lots * margin_per_lot
            risk_amount = suggested_lots * risk_per_lot
            return suggested_lots, margin_required, risk_amount

        # 2. Short Strangle / Short Straddle
        elif "Strangle" in strategy or "Straddle" in strategy:
            # Execution Size Formula: Lots = floor((Capital * 0.80) / 160,000)
            MARGIN_STRANGLE = 160000.0
            suggested_lots = max(1, int((capital * 0.80) / MARGIN_STRANGLE))
            margin_required = suggested_lots * MARGIN_STRANGLE
            risk_amount = max_risk
            return suggested_lots, margin_required, risk_amount

        # 3. Spreads (Bull Call, Bear Put, Bull Put, Bear Call) or Iron Condor
        else:
            # Margin = ₹50,000 per lot
            MARGIN_SPREAD = 50000.0
            
            if preferred_index.lower() == "sensex":
                atm_strike = round(spot / 100.0) * 100
                strike_interval = 100
            else:
                atm_strike = round(spot / 50.0) * 50
                strike_interval = 50
                
            leg1_premium = 100.0
            leg2_premium = 60.0
            for item in self.option_chain:
                if item.get("strike") == atm_strike:
                    if "Call" in strategy or "CE" in strategy:
                        leg1_premium = item.get("call_price", 100.0)
                    else:
                        leg1_premium = item.get("put_price", 100.0)
                if "Call" in strategy or "CE" in strategy:
                    if item.get("strike") == atm_strike + strike_interval:
                        leg2_premium = item.get("call_price", 60.0)
                else:
                    if item.get("strike") == atm_strike - strike_interval:
                        leg2_premium = item.get("put_price", 60.0)
            
            net_premium = abs(leg1_premium - leg2_premium)
            # Risk is 50% of net premium
            risk_per_lot = net_premium * 0.50 * lot_size
            
            # Respect both margin (80% capital allocation limit) and 2% risk
            max_lots_by_risk = max(1, int(max_risk / risk_per_lot))
            max_lots_by_margin = max(1, int((capital * 0.80) / MARGIN_SPREAD))
            
            suggested_lots = min(max_lots_by_risk, max_lots_by_margin)
            margin_required = suggested_lots * MARGIN_SPREAD
            risk_amount = suggested_lots * risk_per_lot
            return suggested_lots, margin_required, risk_amount

    def get_option_buy_strategies(self) -> List[Dict]:
        # Calculate rolling 2-minute change
        mom_pct = self.get_rolling_momentum()
        capital = self.settings.get("capital", 500000.0)
        max_risk = capital * 0.02 # 2% max risk limit
        
        # lot size
        preferred_index = self.settings.get("preferred_index", "Nifty")
        lot_size = 20 if preferred_index.lower() == "sensex" else 65
        
        # Fetch ATM premium (LTP)
        atm_premium = 100.0
        if preferred_index.lower() == "sensex":
            atm_strike = round(self.spot_price / 100.0) * 100
        else:
            atm_strike = round(self.spot_price / 50.0) * 50
            
        for item in self.option_chain:
            if item.get("strike") == atm_strike:
                atm_premium = item.get("call_price", 100.0)
                break
                
        # SL = 10% premium. Risk per lot = premium * lot_size * 0.10
        risk_per_lot = atm_premium * lot_size * 0.10
        suggested_lots = max(1, int(max_risk / risk_per_lot))
        
        # Momentum strategy status
        mom_status = "WAITING FOR BREAKOUT"
        mom_action = "NO SIGNAL"
        mom_reason = f"2-min rolling move is {mom_pct:+.2f}% (Threshold: ±0.18%)"
        
        if mom_pct <= -0.18:
            mom_status = "ACTIVE SIGNAL (PE BUY)"
            mom_action = "BUY PE"
            mom_reason = f"Sudden Crash! 2-min momentum drops by {mom_pct:.2f}%"
        elif mom_pct >= 0.18:
            mom_status = "ACTIVE SIGNAL (CE BUY)"
            mom_action = "BUY CE"
            mom_reason = f"Sudden Spike! 2-min momentum surges by {mom_pct:+.2f}%"
            
        # VWAP Pullback strategy status
        vwap_val = self.get_vwap()
        pullback_status = "WAITING"
        pullback_action = "NO SIGNAL"
        pullback_reason = "Price is away from VWAP/EMA support levels"
        
        if abs(self.spot_price - vwap_val) <= 15.0:
            if self.rsi <= 40:
                pullback_status = "ACTIVE SIGNAL (CE BUY)"
                pullback_action = "BUY CE"
                pullback_reason = "Price pulling back to VWAP support with oversold RSI"
            elif self.rsi >= 60:
                pullback_status = "ACTIVE SIGNAL (PE BUY)"
                pullback_action = "BUY PE"
                pullback_reason = "Price pulling back to VWAP resistance with overbought RSI"
                
        return [
            {
                "name": "Momentum Velocity Breakout",
                "description": "Captures sudden rapid market crashes or spikes using a 2-minute rolling change window.",
                "status": mom_status,
                "action": mom_action,
                "reason": mom_reason,
                "suggested_lots": suggested_lots,
                "lot_size": lot_size,
                "stop_loss_points": 30.0,
                "risk_pct": "2.0%",
                "risk_amount": f"₹{max_risk:.2f}"
            },
            {
                "name": "VWAP Pullback / Mean Reversion",
                "description": "Enters high-probability momentum buys when price rests at VWAP support with confirming RSI signals.",
                "status": pullback_status,
                "action": pullback_action,
                "reason": pullback_reason,
                "suggested_lots": suggested_lots,
                "lot_size": lot_size,
                "stop_loss_points": 25.0,
                "risk_pct": "2.0%",
                "risk_amount": f"₹{max_risk:.2f}"
            }
        ]

    def tick_5s(self, override_type: Optional[str] = None):
        self.check_daily_reset()
        """Simulate market price tick update every 5 seconds or handle manual overrides."""
        # 1. Update spot price
        old_spot = self.spot_price
        live_price = None
        
        if override_type == "breakout_high":
            self.spot_price = self.today_high + 15.0
            self.recalculation_trigger = "Today's High Broken"
        elif override_type == "breakout_low":
            self.spot_price = self.today_low - 15.0
            self.recalculation_trigger = "Today's Low Broken"
        elif override_type == "vamp_crossover":
            # Cross over/under vwap
            vw = self.get_vwap()
            self.spot_price = vw + (5.0 if old_spot < vw else -5.0)
            self.recalculation_trigger = "VWAP Crossover"
        elif override_type == "iv_spike":
            self.vix += 3.0
            self.recalculation_trigger = "IV Spike"
        elif override_type == "pcr_shift":
            self.pcr = 1.35 if self.pcr < 1.0 else 0.55
            self.recalculation_trigger = "PCR Shift"
        elif override_type == "large_writing":
            self.pcr = 1.45
            self.recalculation_trigger = "Large Put Writing"
        elif override_type == "sudden_crash":
            self.spot_price = old_spot - 85.0
            self.recalculation_trigger = "Sudden Market Crash Triggered"
        elif override_type == "sudden_spike":
            self.spot_price = old_spot + 85.0
            self.recalculation_trigger = "Sudden Market Spike Triggered"
        else:
            # Determine current IST market session
            utc_now = datetime.datetime.now(datetime.timezone.utc)
            ist_now = utc_now + datetime.timedelta(hours=5, minutes=30)
            is_weekday = ist_now.weekday() < 5
            current_time_str = ist_now.strftime("%H:%M")
            
            preferred_index = self.settings.get("preferred_index", "Nifty")
            
            if is_weekday:
                if "09:00" <= current_time_str < "09:07":
                    self.market_session = "Pre-Market (Order Entry)"
                elif "09:07" <= current_time_str < "09:15":
                    self.market_session = "Pre-Market (Matching)"
                elif "09:15" <= current_time_str < "15:30":
                    self.market_session = "Live Market"
                else:
                    self.market_session = "Post-Market / Closed"
            else:
                self.market_session = "Market Closed (Weekend)"
            
            now = time.time()
            live_price = None
            
            if self.market_session == "Pre-Market (Order Entry)":
                self.premarket_open_price = None
                baseline = 79996.60 if preferred_index.lower() == "sensex" else 24270.85
                # Pre-market order book equilibrium build-up fluctuations (±0.15% max)
                self.spot_price = baseline + random.uniform(-35.0, 35.0) if preferred_index.lower() == "sensex" else baseline + random.uniform(-10.0, 10.0)
                self.price_source = "BSE Pre-Market Equilibrium" if preferred_index.lower() == "sensex" else "NSE Pre-Market Equilibrium"
                self.recalculation_trigger = "Pre-Market Order Building"
                
            elif self.market_session == "Pre-Market (Matching)":
                baseline = 79996.60 if preferred_index.lower() == "sensex" else 24270.85
                if self.premarket_open_price is None:
                    self.premarket_open_price = baseline + (random.uniform(-45.0, 60.0) if preferred_index.lower() == "sensex" else random.uniform(-15.0, 20.0))
                self.spot_price = self.premarket_open_price
                self.price_source = "BSE Discovered Opening Price" if preferred_index.lower() == "sensex" else "NSE Discovered Opening Price"
                self.recalculation_trigger = "Pre-Market Matching Discovered"
                
            else:
                self.premarket_open_price = None
                
                # Periodically fetch live price from Google Finance
                if now - self.last_live_fetch >= 30:
                    price_data = fetch_live_index_price(preferred_index)
                    if price_data[0] is not None:
                        live_price = price_data[0]
                        self.spot_price = live_price
                        self.intraday_change_pct = price_data[1]
                        self.intraday_change_val = price_data[2]
                        self.prev_close_baseline = price_data[0] - price_data[2]
                        self.last_live_fetch = now
                
                if not live_price:
                    # Normal drift simulation
                    drift = 0.0
                    regime = self.market_regime
                    if "Strong Bull" in regime:
                        drift = 0.5
                    elif "Strong Bear" in regime:
                        drift = -0.5
                    
                    # Ensure baseline exists
                    if not getattr(self, "prev_close_baseline", None):
                        self.prev_close_baseline = self.spot_price - self.intraday_change_val
                    
                    # Drift spot price
                    self.spot_price += drift + random.uniform(-2.0, 2.0)
                    
                    # Update change metrics to stay in sync
                    if self.prev_close_baseline != 0.0:
                        self.intraday_change_val = self.spot_price - self.prev_close_baseline
                        self.intraday_change_pct = (self.intraday_change_val / self.prev_close_baseline) * 100.0
                    
                    # Bound random spikes relative to starting spot price area
                    if preferred_index.lower() == "sensex":
                        if self.spot_price > 110000: self.spot_price -= 100.0
                        if self.spot_price < 50000: self.spot_price += 100.0
                    else:
                        if self.spot_price > 35000: self.spot_price -= 25.0
                        if self.spot_price < 15000: self.spot_price += 25.0

        # Update source and timestamps
        if override_type:
            self.price_source = f"Manual Trigger ({override_type})"
        elif live_price:
            self.price_source = "Google Finance (BSE India)" if preferred_index.lower() == "sensex" else "Google Finance (NSE India)"
        else:
            self.price_source = "Google Finance (Simulated Drift)"
            
        self.price_date = get_ist_date_str()
        self.price_time = get_ist_time_str()

        # Update high/low boundary checks
        if self.spot_price > self.today_high:
            self.today_high = self.spot_price
            if override_type is None:
                self.recalculation_trigger = "Today's High broken"
        if self.spot_price < self.today_low:
            self.today_low = self.spot_price
            if override_type is None:
                self.recalculation_trigger = "Today's Low broken"

        # VIX and PCR minor drift
        if override_type is None:
            self.vix += random.uniform(-0.15, 0.15)
            self.vix = max(9.0, min(35.0, self.vix))
            self.pcr += random.uniform(-0.01, 0.01)
            self.pcr = max(0.4, min(1.8, self.pcr))

        # Check VIX deviation trigger
        vix_pct_change = abs(self.vix - self.settings["vix_baseline"]) / self.settings["vix_baseline"] * 100.0
        if vix_pct_change > self.settings["vix_threshold"] and override_type is None:
            self.recalculation_trigger = "VIX changes more than threshold"
            self.settings["vix_baseline"] = self.vix

        # Append to price history for live chart
        self.price_history.append({
            "time": get_ist_time_str(),
            "price": round(self.spot_price, 2),
            "vwap": round(self.get_vwap(), 2),
            "ema20": round(self.ema_20, 2),
            "ema50": round(self.ema_50, 2)
        })
        if len(self.price_history) > 360:
            self.price_history.pop(0)

        # Update current candle metrics for all three timeframes
        for candle in [self.candle_1m, self.candle_5m, self.candle_15m]:
            candle["high"] = max(candle["high"], self.spot_price)
            candle["low"] = min(candle["low"], self.spot_price)
            candle["close"] = self.spot_price
            candle["volume"] += random.uniform(50, 200)
            candle["vwap_sum_pv"] += self.spot_price * candle["volume"]
            candle["vwap_sum_v"] += candle["volume"]

        now = time.time()
        
        # 1. Check if 1 minute completed
        if now - self.candle_1m["time"] >= 60 or override_type == "candle_close":
            vwap_val = self.candle_1m["vwap_sum_pv"] / self.candle_1m["vwap_sum_v"] if self.candle_1m["vwap_sum_v"] > 0 else self.spot_price
            self.candles_1m.append({
                "time": self.candle_1m["time"],
                "open": self.candle_1m["open"],
                "high": self.candle_1m["high"],
                "low": self.candle_1m["low"],
                "close": self.candle_1m["close"],
                "volume": self.candle_1m["volume"],
                "vwap": vwap_val
            })
            if len(self.candles_1m) > 60:
                self.candles_1m.pop(0)
            self.candle_1m = {
                "time": now,
                "open": self.spot_price,
                "high": self.spot_price,
                "low": self.spot_price,
                "close": self.spot_price,
                "volume": 0.0,
                "vwap_sum_pv": 0.0,
                "vwap_sum_v": 0.0
            }

        # 2. Check if 5 minutes completed
        if now - self.candle_5m["time"] >= 300 or override_type == "candle_close":
            vwap_val = self.candle_5m["vwap_sum_pv"] / self.candle_5m["vwap_sum_v"] if self.candle_5m["vwap_sum_v"] > 0 else self.spot_price
            self.candles_5m.append({
                "time": self.candle_5m["time"],
                "open": self.candle_5m["open"],
                "high": self.candle_5m["high"],
                "low": self.candle_5m["low"],
                "close": self.candle_5m["close"],
                "volume": self.candle_5m["volume"],
                "vwap": vwap_val
            })
            if len(self.candles_5m) > 60:
                self.candles_5m.pop(0)
            self.candle_5m = {
                "time": now,
                "open": self.spot_price,
                "high": self.spot_price,
                "low": self.spot_price,
                "close": self.spot_price,
                "volume": 0.0,
                "vwap_sum_pv": 0.0,
                "vwap_sum_v": 0.0
            }
            # Keep alias synchronized
            self.current_candle = self.candle_5m
            self.recompute_indicators()
            self.recalculation_trigger = "Completed 5-minute candle"

        # 3. Check if 15 minutes completed
        if now - self.candle_15m["time"] >= 900 or override_type == "candle_close":
            vwap_val = self.candle_15m["vwap_sum_pv"] / self.candle_15m["vwap_sum_v"] if self.candle_15m["vwap_sum_v"] > 0 else self.spot_price
            self.candles_15m.append({
                "time": self.candle_15m["time"],
                "open": self.candle_15m["open"],
                "high": self.candle_15m["high"],
                "low": self.candle_15m["low"],
                "close": self.candle_15m["close"],
                "volume": self.candle_15m["volume"],
                "vwap": vwap_val
            })
            if len(self.candles_15m) > 60:
                self.candles_15m.pop(0)
            self.candle_15m = {
                "time": now,
                "open": self.spot_price,
                "high": self.spot_price,
                "low": self.spot_price,
                "close": self.spot_price,
                "volume": 0.0,
                "vwap_sum_pv": 0.0,
                "vwap_sum_v": 0.0
            }

        # Check immediate override recalculations or periodic recalculation
        if self.recalculation_trigger != "Schedule" or (now - self.last_rec_time >= 60):
            self.evaluate_decision_engine()
            
        # Daily 09:00 AM reset and trading session rules check
        self.check_daily_reset()

        # Run live automated trading execution tick
        if not self.daily_stop_limit_hit:
            self._auto_trade_tick()

    def get_vwap(self) -> float:
        """Returns session VWAP estimation."""
        if not self.completed_candles:
            return self.spot_price
        total_pv = sum(c["close"] * c["volume"] for c in self.completed_candles)
        total_v = sum(c["volume"] for c in self.completed_candles)
        if total_v == 0:
            return self.spot_price
        return total_pv / total_v

    def fetch_upstox_data(self) -> bool:
        token = self.settings["upstox_access_token"]
        expiry = self.settings["upstox_expiry_date"]
        if not token or not expiry:
            return False
            
        url = "https://api.upstox.com/v2/option/chain"
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {token}"
        }
        preferred_index = self.settings.get("preferred_index", "Nifty")
        instrument_key = "BSE_INDEX|SENSEX" if preferred_index.lower() == "sensex" else "NSE_INDEX|Nifty 50"
        params = {
            "instrument_key": instrument_key,
            "expiry_date": expiry
        }
        
        try:
            resp = requests.get(url, headers=headers, params=params, timeout=5)
            if resp.status_code != 200:
                print(f"Upstox API returned error {resp.status_code}: {resp.text}")
                return False
                
            res = resp.json()
            if res.get("status") != "success" or "data" not in res:
                print(f"Upstox API failed: {res}")
                return False
                
            data_list = res["data"]
            if not data_list:
                print("Upstox returned empty option chain data list")
                return False
                
            # 1. Update spot price from underlying_spot_price of the first element
            first_item = data_list[0]
            self.spot_price = float(first_item.get("underlying_spot_price", self.spot_price))
            self.price_source = "Upstox Live Feed (BSE India)" if preferred_index.lower() == "sensex" else "Upstox Live Feed (NSE India)"
            self.price_date = get_ist_date_str()
            self.price_time = get_ist_time_str()
            
            # Recalculate change metrics using prev_close_baseline
            if getattr(self, "prev_close_baseline", 0.0) != 0.0:
                self.intraday_change_val = self.spot_price - self.prev_close_baseline
                self.intraday_change_pct = (self.intraday_change_val / self.prev_close_baseline) * 100.0
            
            # 2. Parse option chain
            parsed_chain = []
            for item in data_list:
                strike = float(item["strike_price"])
                
                call_opt = item.get("call_options")
                put_opt = item.get("put_options")
                
                call_price = 0.05
                call_oi = 0
                call_change_oi = 0
                call_delta = 0.0
                call_theta = 0.0
                call_vega = 0.0
                call_iv = "0.0%"
                call_bid = 0.05
                call_ask = 0.05
                call_key = ""
                
                if call_opt:
                    mdata = call_opt.get("market_data") or {}
                    greeks = call_opt.get("option_greeks") or {}
                    call_price = float(mdata.get("ltp", 0.05))
                    call_bid = float(mdata.get("bid", call_price))
                    call_ask = float(mdata.get("ask", call_price))
                    call_oi = int(mdata.get("oi", 0))
                    call_prev_oi = int(mdata.get("prev_oi", 0))
                    call_change_oi = call_oi - call_prev_oi
                    call_delta = float(greeks.get("delta", 0.0))
                    call_theta = float(greeks.get("theta", 0.0))
                    call_vega = float(greeks.get("vega", 0.0))
                    call_iv = f"{float(greeks.get('iv', 0.0)):.1f}%"
                    call_key = call_opt.get("instrument_key", "")
                    
                put_price = 0.05
                put_oi = 0
                put_change_oi = 0
                put_delta = 0.0
                put_theta = 0.0
                put_vega = 0.0
                put_iv = "0.0%"
                put_bid = 0.05
                put_ask = 0.05
                put_key = ""
                
                if put_opt:
                    mdata = put_opt.get("market_data") or {}
                    greeks = put_opt.get("option_greeks") or {}
                    put_price = float(mdata.get("ltp", 0.05))
                    put_bid = float(mdata.get("bid", put_price))
                    put_ask = float(mdata.get("ask", put_price))
                    put_oi = int(mdata.get("oi", 0))
                    put_prev_oi = int(mdata.get("prev_oi", 0))
                    put_change_oi = put_oi - put_prev_oi
                    put_delta = float(greeks.get("delta", 0.0))
                    put_theta = float(greeks.get("theta", 0.0))
                    put_vega = float(greeks.get("vega", 0.0))
                    put_iv = f"{float(greeks.get('iv', 0.0)):.1f}%"
                    put_key = put_opt.get("instrument_key", "")
                    
                parsed_chain.append({
                    "strike": int(strike),
                    "call_oi": call_oi,
                    "call_change_oi": call_change_oi,
                    "call_iv": call_iv,
                    "call_delta": call_delta,
                    "call_theta": call_theta,
                    "call_vega": call_vega,
                    "call_price": call_price,
                    "call_bid": call_bid,
                    "call_ask": call_ask,
                    "call_instrument_key": call_key,
                    "put_price": put_price,
                    "put_bid": put_bid,
                    "put_ask": put_ask,
                    "put_delta": put_delta,
                    "put_theta": put_theta,
                    "put_vega": put_vega,
                    "put_iv": put_iv,
                    "put_change_oi": put_change_oi,
                    "put_oi": put_oi,
                    "put_instrument_key": put_key
                })
            
            self.upstox_option_chain = parsed_chain
            
            # Update PCR based on actual aggregate OI from the chain!
            total_call_oi = sum(x["call_oi"] for x in parsed_chain)
            total_put_oi = sum(x["put_oi"] for x in parsed_chain)
            if total_call_oi > 0:
                self.pcr = total_put_oi / total_call_oi
                
            # Query actual live India VIX spot price from Upstox market quotes!
            try:
                vix_url = "https://api.upstox.com/v2/market-quote/quotes"
                vix_headers = {
                    "Accept": "application/json",
                    "Authorization": f"Bearer {token}"
                }
                vix_resp = requests.get(vix_url, headers=vix_headers, params={"symbol": "NSE_INDEX|India VIX"}, timeout=3)
                if vix_resp.status_code == 200:
                    vix_data = vix_resp.json()
                    if vix_data.get("status") == "success":
                        quote = vix_data.get("data", {}).get("NSE_INDEX:India VIX", {})
                        last_price = quote.get("last_price")
                        if last_price:
                            self.vix = float(last_price)
            except Exception as e:
                print(f"Failed to fetch live India VIX from Upstox: {e}")
            
            self.recompute_indicators()
            self.evaluate_decision_engine()
            
            # Append to price history for live chart
            self.price_history.append({
                "time": get_ist_time_str(),
                "price": round(self.spot_price, 2),
                "vwap": round(self.get_vwap(), 2),
                "ema20": round(self.ema_20, 2),
                "ema50": round(self.ema_50, 2)
            })
            if len(self.price_history) > 360:
                self.price_history.pop(0)
            
            return True
            
        except Exception as e:
            print(f"Error fetching Upstox option chain: {e}")
            return False

    # ==========================================
    # 3. REGIME & STRATEGY DECISION ENGINE
    # ==========================================

    def classify_market_regime(self) -> str:
        """Classify Nifty Spot market regime dynamically based on indicator values."""
        if self.settings["regime_override"] != "Auto":
            return self.settings["regime_override"]
            
        vw = self.get_vwap()
        
        # 1. Breakouts/Breakdowns
        if self.spot_price > self.opening_range_high:
            return "Breakout"
        if self.spot_price < self.opening_range_low:
            return "Breakdown"
            
        # 2. Trend assessment
        is_bullish_emas = self.ema_20 > self.ema_50
        trend_aligned = (self.spot_price > self.ema_20) and is_bullish_emas
        trend_bearish = (self.spot_price < self.ema_20) and not is_bullish_emas
        
        # 3. Volatility / VIX
        if self.vix > 22.0:
            if trend_aligned:
                return "Strong Bull Trend"
            elif trend_bearish:
                return "Strong Bear Trend"
            else:
                return "High Volatility"
        
        if self.vix < 12.0:
            return "Low Volatility"
            
        # 4. Moving Averages / Ranges
        if abs(self.spot_price - vw) < 25.0 and self.adx < 20.0:
            return "Range Bound"
            
        if is_bullish_emas:
            return "Strong Bull Trend" if self.rsi > 60 else "Weak Bull Trend"
        else:
            return "Strong Bear Trend" if self.rsi < 40 else "Weak Bear Trend"

    def calculate_trade_pnl(self, t, spot):
        """Calculates current floating P&L of a trade based on option Greeks or Spot price."""
        pnl = 0.0
        entry = t["entry_spot"]
        legs = t.get("legs", [])
        strat = t.get("strategy", "")
        if legs:
            for leg in legs:
                leg_ltp = None
                if self.settings.get("feed_mode") == "Upstox" and self.upstox_option_chain:
                    for chain_item in self.upstox_option_chain:
                        if chain_item.get("strike") == leg.get("strike"):
                            if leg.get("option_type") == "CE":
                                leg_ltp = chain_item.get("call_price")
                            else:
                                leg_ltp = chain_item.get("put_price")
                if leg_ltp is None:
                    t_years = 4.0 / 365.0
                    r = 0.07
                    is_call = leg["option_type"].upper() == "CE"
                    opt_res = calculate_greeks(spot, leg["strike"], t_years, self.vix / 100.0, r, is_call)
                    leg_ltp = opt_res["price"]
                    
                leg_diff = leg_ltp - leg["entry_price"]
                if leg["action"] == "BUY":
                    pnl += leg_diff * leg["quantity"]
                else:
                    pnl -= leg_diff * leg["quantity"]
        else:
            diff = spot - entry
            multiplier = t.get("lot_size", 65) * t["size"]
            if "CE" in strat or "Bull" in strat:
                pnl += diff * multiplier
            else:
                pnl -= diff * multiplier
        return pnl

    def update_option_chain(self):
        spot = self.spot_price
        preferred_index = self.settings.get("preferred_index", "Nifty")
        if preferred_index.lower() == "sensex":
            atm_strike = round(spot / 100.0) * 100
            strike_interval = 100
            upstox_filter_width = 600
        else:
            atm_strike = round(spot / 50.0) * 50
            strike_interval = 50
            upstox_filter_width = 300
            
        option_chain = []
        if self.settings.get("feed_mode") == "Upstox" and self.upstox_option_chain:
            option_chain = [x for x in self.upstox_option_chain if abs(x["strike"] - atm_strike) <= upstox_filter_width]
            option_chain = sorted(option_chain, key=lambda x: x["strike"])
        else:
            t_years = 4.0 / 365.0
            r = 0.07
            for i in range(-6, 7):
                strike = atm_strike + (i * strike_interval)
                dist_from_atm = abs(strike - spot)
                iv_strike = (self.vix / 100.0) + (dist_from_atm / 1000.0) * 0.10
                
                call_greeks = calculate_greeks(spot, strike, t_years, iv_strike, r, is_call=True)
                put_greeks = calculate_greeks(spot, strike, t_years, iv_strike, r, is_call=False)
                
                base_oi = 5000000 / (1 + (dist_from_atm / 150.0) ** 2)
                call_oi = int(base_oi * (1.2 if strike > spot else 0.8) * (1.1 - 0.2 * (self.pcr - 1.0)))
                put_oi = int(base_oi * (0.8 if strike > spot else 1.2) * (self.pcr))
                
                call_change_oi = int(call_oi * random.uniform(-0.05, 0.08))
                put_change_oi = int(put_oi * random.uniform(-0.05, 0.08))
                
                option_chain.append({
                    "strike": strike,
                    "call_oi": call_oi,
                    "call_change_oi": call_change_oi,
                    "call_iv": f"{iv_strike*100:.1f}%",
                    "call_delta": call_greeks["delta"],
                    "call_theta": call_greeks["theta"],
                    "call_vega": call_greeks["vega"],
                    "call_price": call_greeks["price"],
                    "call_bid": max(0.05, call_greeks["price"] - 0.2),
                    "call_ask": call_greeks["price"] + 0.2,
                    "call_instrument_key": f"SIM_CALL_{strike}",
                    "put_price": put_greeks["price"],
                    "put_bid": max(0.05, put_greeks["price"] - 0.2),
                    "put_ask": put_greeks["price"] + 0.2,
                    "put_delta": put_greeks["delta"],
                    "put_theta": put_greeks["theta"],
                    "put_vega": put_greeks["vega"],
                    "put_iv": f"{iv_strike*100:.1f}%",
                    "put_change_oi": put_change_oi,
                    "put_oi": put_oi,
                    "put_instrument_key": f"SIM_PUT_{strike}"
                })
        self.option_chain = option_chain

    def _auto_trade_tick(self):
        """Automated trading logic processing at each tick."""
        mode = self.settings.get("auto_trade_mode", "OFF")
        if mode == "OFF":
            return
            
        # Ensure fresh option chain is built
        self.update_option_chain()
            
        ist_now = get_ist_datetime()
        ist_time = ist_now.time()
        
        feed_mode = self.settings.get("feed_mode", "Simulation")
        
        # 1. Trading start check (09:30 IST)
        if feed_mode != "Simulation" and ist_time < datetime.time(9, 30):
            return
            
        # 2. Trading stop & force square-off (15:00 IST for Live, 15:30 IST for Paper)
        close_time = datetime.time(15, 0) if mode == "Live" else datetime.time(15, 30)
        if feed_mode != "Simulation" and ist_time >= close_time:
            if self.auto_trade_active_id:
                active_trade = None
                for t in journal.trades:
                    if t["id"] == self.auto_trade_active_id and t["status"] == "OPEN":
                        active_trade = t
                        break
                if active_trade:
                    journal.close_trade(active_trade["id"], self.spot_price)
                    active_trade["reason"] = f"Force Square-off ({close_time.strftime('%H:%M')} IST Trading Session Close)"
                    journal.save_journal()
                    self.auto_trade_active_id = None
                    print(f"🤖 AUTO-TRADE: Force squared off open position at {close_time.strftime('%H:%M')} IST.")
            return
            
        capital = self.get_available_capital()
        daily_limit = capital * 0.05
        preferred_index = self.settings.get("preferred_index", "Nifty")
        lot_size = 20 if preferred_index.lower() == "sensex" else 65
        spot = self.spot_price
        
        # Calculate current floating P&L of active position
        floating_pnl = 0.0
        active_trade = None
        if self.auto_trade_active_id:
            for t in journal.trades:
                if t["id"] == self.auto_trade_active_id and t["status"] == "OPEN":
                    active_trade = t
                    break
            
            if active_trade:
                floating_pnl = self.calculate_trade_pnl(active_trade, spot)
            else:
                self.auto_trade_active_id = None
                self.trail_activated = False
                self.peak_pnl_since_activation = -999999.0
        else:
            self.trail_activated = False
            self.peak_pnl_since_activation = -999999.0
                
        rec = self.current_recommendation
        strategy_for_sizing = active_trade["strategy"] if active_trade else rec
        
        # Determine lot sizing based on max 2% trade limit risk & margins
        suggested_lots, margin_required, risk_amount = self.calculate_suggested_lots_and_margin(strategy_for_sizing, spot)
        trade_limit = risk_amount
        
        # Calculate today's closed P&L
        today_str = get_ist_date_str()
        today_closed = [t for t in journal.trades if t.get("status") == "CLOSED" and t.get("date") == today_str]
        closed_pnl = sum(t.get("pnl", 0.0) for t in today_closed)
                
        total_daily_pnl = closed_pnl + floating_pnl
        self.daily_closed_pnl = closed_pnl
        
        # 1. Check cumulative daily stop-loss halt (5% of capital)
        if total_daily_pnl <= -daily_limit:
            print(f"🛑 DAILY LOSS HALT: Intraday P&L ({total_daily_pnl:.2f}) hit/exceeded 5% limit ({-daily_limit:.2f}). Halting all trading.")
            self.daily_stop_limit_hit = True
            self.settings["auto_trade_mode"] = "OFF"
            self.save_settings()
            if active_trade:
                journal.close_trade(active_trade["id"], spot)
                active_trade["reason"] = f"Intraday 5% SL limit hit at ₹{total_daily_pnl:.2f}"
                journal.save_journal()
                self.auto_trade_active_id = None
            return

        # 2. Manage Active Position (if exists)
        if active_trade:
            # A. Check 2% trade stop loss limit (Hard SL hit)
            if floating_pnl <= -trade_limit:
                journal.close_trade(active_trade["id"], spot)
                active_trade["reason"] = f"Trade 2% SL limit hit at ₹{floating_pnl:.2f}"
                journal.save_journal()
                self.auto_trade_active_id = None
                self.signal_change_pending = False
                self.trail_activated = False
                print(f"🤖 AUTO-TRADE: Closed position due to 2% Trade SL limit (₹{floating_pnl:.2f})")
                return
                
            strat = active_trade["strategy"]
            active_size = active_trade.get("size", suggested_lots)
            
            # C. Profit Management & Trailing Stop-Loss stage checks
            is_option_buy = "Buy CE" in strat or "Buy PE" in strat
            is_strangle = "Strangle" in strat
            
            if is_option_buy:
                activation_threshold = capital * 0.04
            elif is_strangle:
                activation_threshold = self.settings.get("strangle_trail_activation", capital * 0.01)
            else:
                activation_threshold = self.settings.get("spread_trail_activation", capital * 0.01)
                
            # Initialize stage properties on trade if not present
            if "stage" not in active_trade:
                active_trade["stage"] = "OPEN"
            if "peak_pnl" not in active_trade:
                active_trade["peak_pnl"] = max(0.0, floating_pnl)
            else:
                active_trade["peak_pnl"] = max(active_trade["peak_pnl"], floating_pnl)
            if "locked_profit" not in active_trade:
                active_trade["locked_profit"] = 0.0
            if "trail_activated" not in active_trade:
                active_trade["trail_activated"] = False
            if "initial_risk" not in active_trade:
                active_trade["initial_risk"] = calculate_trade_initial_risk(active_trade, capital)
                
            # Read variables
            current_stage = active_trade["stage"]
            peak_pnl = active_trade["peak_pnl"]
            R = active_trade["initial_risk"]
            entry_brokerage = active_trade.get("brokerage", 0.0)
            total_costs = 3.0 * entry_brokerage
            
            # Transition triggers
            # Stage 1 -> Stage 2 (OPEN -> RISK)
            if current_stage == "OPEN":
                current_stage = "RISK"
                print(f"🔄 TRADE STAGE CHANGE (ID {active_trade['id']}): OPEN -> RISK (Risk carrying started, Hard SL active)")
            
            # Stage 2 -> Stage 3 (RISK -> BREAKEVEN)
            if current_stage == "RISK" and floating_pnl >= R:
                current_stage = "BREAKEVEN"
                active_trade["locked_profit"] = total_costs
                print(f"🔄 TRADE STAGE CHANGE (ID {active_trade['id']}): RISK -> BREAKEVEN (Profit reached 1R: ₹{floating_pnl:.2f} >= ₹{R:.2f}). SL moved to cover transaction costs (₹{total_costs:.2f}).")
                
            # Stage 3 -> Stage 4 (BREAKEVEN -> PROFIT PROTECTION)
            # Trailing stops / lock profit activates at >= 2R AND when trailing activation threshold is met
            if current_stage == "BREAKEVEN" and floating_pnl >= 2.0 * R and floating_pnl >= activation_threshold:
                current_stage = "PROFIT PROTECTION"
                active_trade["trail_activated"] = True
                print(f"🔄 TRADE STAGE CHANGE (ID {active_trade['id']}): BREAKEVEN -> PROFIT PROTECTION (Profit reached 2R & activation threshold: ₹{floating_pnl:.2f} >= ₹{2.0*R:.2f}). Trailing profit locks active.")
                
            # Stage 4 -> Stage 5 (PROFIT PROTECTION -> PROFIT MAXIMIZATION)
            if current_stage == "PROFIT PROTECTION" and floating_pnl >= 6.0 * R:
                current_stage = "PROFIT MAXIMIZATION"
                print(f"🔄 TRADE STAGE CHANGE (ID {active_trade['id']}): PROFIT PROTECTION -> PROFIT MAXIMIZATION (Profit reached 6R: ₹{floating_pnl:.2f} >= ₹{6.0*R:.2f}). Holding for maximized returns.")
            
            # Store back stage
            active_trade["stage"] = current_stage
            
            # Dynamic Lock Profit calculation for PROFIT PROTECTION / PROFIT MAXIMIZATION
            if current_stage in ["PROFIT PROTECTION", "PROFIT MAXIMIZATION"]:
                multiple = peak_pnl / R if R > 0 else 0
                lock_pct = 0.0
                if multiple >= 10.0:
                    lock_pct = 0.90
                elif multiple >= 8.0:
                    lock_pct = 0.80
                elif multiple >= 6.0:
                    lock_pct = 0.70
                elif multiple >= 5.0:
                    lock_pct = 0.60
                elif multiple >= 4.0:
                    lock_pct = 0.50
                elif multiple >= 3.0:
                    lock_pct = 0.40
                elif multiple >= 2.0:
                    lock_pct = 0.30
                else:
                    lock_pct = 0.30
                    
                calculated_lock = peak_pnl * lock_pct
                if calculated_lock > active_trade["locked_profit"]:
                    print(f"🔒 PROFIT LOCK UPDATE (ID {active_trade['id']}): ₹{active_trade['locked_profit']:.2f} -> ₹{calculated_lock:.2f} (Lock Pct: {lock_pct*100:.0f}%, Peak PnL: ₹{peak_pnl:.2f})")
                    active_trade["locked_profit"] = round(calculated_lock, 2)
            
            # Save progress so far
            journal.save_journal()
            
            # Exits Evaluation
            sl_hit = False
            exit_reason = ""
            
            if current_stage == "RISK":
                # Check Hard SL
                if floating_pnl <= -R:
                    sl_hit = True
                    exit_reason = f"Hard SL hit (Limit: -₹{R:.2f}, Current PnL: ₹{floating_pnl:.2f})"
            elif current_stage == "BREAKEVEN":
                # Check Breakeven SL
                if floating_pnl < total_costs:
                    sl_hit = True
                    exit_reason = f"Breakeven SL hit (Stop: ₹{total_costs:.2f}, Current PnL: ₹{floating_pnl:.2f})"
            elif current_stage in ["PROFIT PROTECTION", "PROFIT MAXIMIZATION"]:
                # Check Locked Profit trailing stop
                locked_threshold = active_trade["locked_profit"]
                if floating_pnl < locked_threshold:
                    sl_hit = True
                    exit_reason = f"Profit Protection SL hit (Stop: ₹{locked_threshold:.2f}, Current PnL: ₹{floating_pnl:.2f})"
                    
            if sl_hit:
                journal.close_trade(active_trade["id"], spot)
                active_trade["reason"] = exit_reason
                journal.save_journal()
                self.auto_trade_active_id = None
                self.signal_change_pending = False
                print(f"🤖 AUTO-TRADE: Closed position (ID {active_trade['id']}). Reason: {exit_reason}")
                return
            
            # D. Check for AI recommendation change exit with confirmation delay
            is_bullish = "CE" in strat or "Bull" in strat
            is_bearish = "PE" in strat or "Bear" in strat
            is_neutral = "Strangle" in strat or "Condor" in strat
            
            rec = self.current_recommendation
            should_close = False
            if rec == "No Trade":
                should_close = True
            elif is_neutral and "Strangle" not in rec and "Condor" not in rec:
                should_close = True
            elif is_bullish and ("PE" in rec or "Bear" in rec or "Short Strangle" in rec or "Iron Condor" in rec):
                should_close = True
            elif is_bearish and ("CE" in rec or "Bull" in rec or "Short Strangle" in rec or "Iron Condor" in rec):
                should_close = True
                
            if should_close:
                # Add confirmation delay: 120 seconds
                if not getattr(self, "signal_change_pending", False):
                    self.signal_change_pending = True
                    self.signal_change_pending_since = time.time()
                    self.pending_exit_signal = rec
                    print(f"⏰ AUTO-TRADE: AI Signal shifted to {rec}. Starting 120s confirmation cooldown...")
                else:
                    elapsed = time.time() - self.signal_change_pending_since
                    remaining = max(0, int(120.0 - elapsed))
                    if elapsed >= 120.0:
                        # Cooldown completed, close trade
                        journal.close_trade(active_trade["id"], spot)
                        active_trade["reason"] = f"AI Signal shifted to {rec} (Confirmed after 120s cooldown)"
                        journal.save_journal()
                        self.auto_trade_active_id = None
                        self.signal_change_pending = False
                        self.trail_activated = False
                        print(f"🤖 AUTO-TRADE: Closed position (AI Signal shift to {rec} confirmed)")
                        return
                    else:
                        print(f"⏰ AUTO-TRADE: AI Signal shift pending confirmation ({remaining}s remaining)...")
            else:
                # If signal reversed/restored within cooldown, cancel pending exit
                if getattr(self, "signal_change_pending", False):
                    self.signal_change_pending = False
                    self.pending_exit_signal = ""
                    print("⏰ AUTO-TRADE: Cancelled pending exit (AI Signal restored).")

        # 3. Open New Position (if none exists)
        else:
            rec = self.current_recommendation
            conf = self.confidence
            allowed_strategies = [
                "Buy CE", "Buy PE", "Bull Call Spread", "Bear Put Spread", 
                "Bull Put Spread", "Bear Call Spread", "Short Strangle", "Iron Condor"
            ]
            if conf >= 65.0 and rec in allowed_strategies:
                self.highest_lowest_spot_since_entry = 0.0 # Starts at 0.0 peak P&L seen
                self.initial_sl_price = -trade_limit # representing initial SL P&L
                self.trailed_sl_price = -trade_limit # representing trailed SL P&L
                
                atm_strike = round(spot / 100.0) * 100 if preferred_index.lower() == "sensex" else round(spot / 50.0) * 50
                strike_interval = 100 if preferred_index.lower() == "sensex" else 50
                
                # Define legs based on strategy
                legs_to_order = []
                if rec == "Buy CE":
                    legs_to_order.append({"strike": atm_strike, "option_type": "CE", "action": "BUY"})
                elif rec == "Buy PE":
                    legs_to_order.append({"strike": atm_strike, "option_type": "PE", "action": "BUY"})
                elif rec == "Bull Call Spread":
                    legs_to_order.append({"strike": atm_strike, "option_type": "CE", "action": "BUY"})
                    legs_to_order.append({"strike": atm_strike + strike_interval, "option_type": "CE", "action": "SELL"})
                elif rec == "Bear Put Spread":
                    legs_to_order.append({"strike": atm_strike, "option_type": "PE", "action": "BUY"})
                    legs_to_order.append({"strike": atm_strike - strike_interval, "option_type": "PE", "action": "SELL"})
                elif rec == "Bull Put Spread":
                    legs_to_order.append({"strike": atm_strike, "option_type": "PE", "action": "SELL"})
                    legs_to_order.append({"strike": atm_strike - strike_interval, "option_type": "PE", "action": "BUY"})
                elif rec == "Bear Call Spread":
                    legs_to_order.append({"strike": atm_strike, "option_type": "CE", "action": "SELL"})
                    legs_to_order.append({"strike": atm_strike + strike_interval, "option_type": "CE", "action": "BUY"})
                elif rec == "Short Strangle" or rec == "Short Straddle":
                    # Locate deep OTM Buy hedge strikes closest to ₹2 premium
                    hedge_call_strike = atm_strike + 5 * strike_interval
                    hedge_put_strike = atm_strike - 5 * strike_interval
                    if self.option_chain:
                        calls = [x for x in self.option_chain if x.get("call_price") is not None]
                        if calls:
                            hedge_call_item = min(calls, key=lambda x: abs(x["call_price"] - 2.0))
                            hedge_call_strike = hedge_call_item["strike"]
                        puts = [x for x in self.option_chain if x.get("put_price") is not None]
                        if puts:
                            hedge_put_item = min(puts, key=lambda x: abs(x["put_price"] - 2.0))
                            hedge_put_strike = hedge_put_item["strike"]
                    
                    sell_call_strike = atm_strike + strike_interval if rec == "Short Strangle" else atm_strike
                    sell_put_strike = atm_strike - strike_interval if rec == "Short Strangle" else atm_strike
                    
                    # BUY legs must be appended first so they execute first
                    legs_to_order.append({"strike": hedge_call_strike, "option_type": "CE", "action": "BUY"})
                    legs_to_order.append({"strike": hedge_put_strike, "option_type": "PE", "action": "BUY"})
                    legs_to_order.append({"strike": sell_call_strike, "option_type": "CE", "action": "SELL"})
                    legs_to_order.append({"strike": sell_put_strike, "option_type": "PE", "action": "SELL"})
                elif rec == "Iron Condor":
                    legs_to_order.append({"strike": atm_strike + strike_interval, "option_type": "CE", "action": "SELL"})
                    legs_to_order.append({"strike": atm_strike + 2*strike_interval, "option_type": "CE", "action": "BUY"})
                    legs_to_order.append({"strike": atm_strike - strike_interval, "option_type": "PE", "action": "SELL"})
                    legs_to_order.append({"strike": atm_strike - 2*strike_interval, "option_type": "PE", "action": "BUY"})

                if mode == "Live":
                    live_legs = []
                    for leg in legs_to_order:
                        k = leg["strike"]
                        ot = leg["option_type"]
                        act = leg["action"]
                        
                        instrument_key = None
                        for item in self.option_chain:
                            if item["strike"] == k:
                                instrument_key = item["call_instrument_key"] if ot == "CE" else item["put_instrument_key"]
                                break
                        if not instrument_key:
                            instrument_key = f"SIM_{ot.upper()}_{k}"
                            
                        live_legs.append(LiveLegOrder(
                            instrument_key=instrument_key,
                            quantity=suggested_lots * lot_size,
                            transaction_type=act,
                            order_type="MARKET",
                            price=0.0,
                            strike=k,
                            option_type=ot
                        ))
                    
                    order_req = LiveOrderRequest(strategy=rec, legs=live_legs)
                    try:
                        res = execute_live_order(order_req)
                        if res.get("status") in ["SUCCESS", "PARTIAL_SUCCESS"] and "trade" in res:
                            self.auto_trade_active_id = res["trade"]["id"]
                            print(f"⚡ AUTO-TRADE REAL: Placed {rec} position successfully (ID: {self.auto_trade_active_id})")
                    except Exception as e:
                        print(f"❌ AUTO-TRADE REAL: Failed placing order: {e}")
                else:
                    # Paper mode
                    legs_logged = []
                    strikes_logged = []
                    for leg in legs_to_order:
                        k = leg["strike"]
                        ot = leg["option_type"]
                        act = leg["action"]
                        
                        ltp = 100.0
                        for item in self.option_chain:
                            if item["strike"] == k:
                                ltp = item["call_price"] if ot == "CE" else item["put_price"]
                                break
                                
                        legs_logged.append({
                            "instrument_key": f"SIM_{ot.upper()}_{k}",
                            "strike": float(k),
                            "option_type": ot,
                            "action": act,
                            "entry_price": float(ltp),
                            "quantity": suggested_lots * lot_size
                        })
                        strikes_logged.append(f"{act} SIM_{ot.upper()}_{k} x {suggested_lots * lot_size}")
                        
                    trade = journal.add_trade(
                        strategy=rec,
                        entry_price=spot,
                        strikes=strikes_logged,
                        confidence=conf,
                        reason=f"Live Auto Paper: AI Signal {rec} at {conf:.1f}%",
                        size=suggested_lots,
                        execution_type="Paper",
                        lot_size=lot_size,
                        legs=legs_logged
                    )
                    self.auto_trade_active_id = trade["id"]
                    print(f"🤖 AUTO-TRADE PAPER: Entered {rec} position (ID: {self.auto_trade_active_id})")

    def check_daily_reset(self):
        """Checks and enforces daily reset and time-based automation rules."""
        ist_now = get_ist_datetime()
        today_date = ist_now.strftime("%Y-%m-%d")
        ist_time = ist_now.time()
        
        # 1. 09:00 AM IST Daily Reset
        if getattr(self, "last_daily_reset_date", "") != today_date:
            if ist_time >= datetime.time(9, 0):
                self.daily_closed_pnl = 0.0
                self.daily_stop_limit_hit = False
                self.auto_trade_active_id = None
                
                # Clear today's trades from journal to reset today_trades and today_legs counters
                journal.trades = [t for t in journal.trades if t.get("date") != today_date]
                journal.save_journal()
                
                self.last_daily_reset_date = today_date
                
                # Append to change log
                self.change_log.append({
                    "time": get_ist_time_str(),
                    "prev_strategy": "N/A",
                    "new_strategy": self.current_recommendation,
                    "confidence": f"{self.confidence:.1f}%",
                    "reason": "🌅 Daily reset completed",
                    "indicators_changed": "Daily counters cleared"
                })
                print("🌅 Daily reset completed")
                
        feed_mode = self.settings.get("feed_mode", "Simulation")
        
        # 2. After 15:30 IST: Disable all automation (only for non-Simulation feeds)
        if feed_mode != "Simulation" and ist_time >= datetime.time(15, 30):
            if self.settings.get("auto_trade_mode", "OFF") != "OFF":
                self.settings["auto_trade_mode"] = "OFF"
                self.save_settings()
                print("🤖 AUTO-TRADE: Session ended. Automation disabled after 15:30 IST.")

    def evaluate_decision_engine(self):
        """Executes the weighted scoring scoring engine and selects strategies."""
        regime = self.classify_market_regime()
        vwap_val = self.get_vwap()
        
        # Check for Option Buy Momentum Breakout first!
        mom_pct = self.get_rolling_momentum()
        is_momentum_breakout = False
        primary_rec = "No Trade"
        confidence_pct = 50.0
        reasoning_list = []
        negation_list = []
        
        if mom_pct >= 0.18:
            primary_rec = "Buy CE"
            confidence_pct = 95.0
            reasoning_list = [
                f"Sudden Market Spike! 2-min momentum surges by {mom_pct:+.2f}% (Threshold: +0.18%)",
                "Momentum Velocity Breakout strategy triggered on CE side.",
                f"Index spot price trending strongly upward (Spot: {self.spot_price:.1f})."
            ]
            negation_list = [
                "Option selling negated due to sudden high-velocity trend.",
                "PE options negated due to strong bullish spike."
            ]
            is_momentum_breakout = True
        elif mom_pct <= -0.18:
            primary_rec = "Buy PE"
            confidence_pct = 95.0
            reasoning_list = [
                f"Sudden Market Crash! 2-min momentum drops by {mom_pct:.2f}% (Threshold: -0.18%)",
                "Momentum Velocity Breakout strategy triggered on PE side.",
                f"Index spot price dropping rapidly (Spot: {self.spot_price:.1f})."
            ]
            negation_list = [
                "Option selling negated due to sudden high-velocity trend.",
                "CE options negated due to strong bearish crash."
            ]
            is_momentum_breakout = True
            
        if not is_momentum_breakout:
            # Weighted Score Computation (Base Bullish vs Bearish)
            scores = {
                "bullish": 0,
                "bearish": 0,
                "sideways": 0
            }
            
            reasons_bullish = []
            reasons_bearish = []
            reasons_neutral = []
            
            # 1. ORB (Weight: 15)
            if self.spot_price > self.opening_range_high:
                scores["bullish"] += 15
                reasons_bullish.append("Opening Range Breakout upside (+15)")
            elif self.spot_price < self.opening_range_low:
                scores["bearish"] += 15
                reasons_bearish.append("Opening Range Breakdown downside (+15)")
            else:
                scores["sideways"] += 10
                reasons_neutral.append("Price within Opening Range (+10)")
                
            # 2. VWAP Crossover (Weight: 10)
            if self.spot_price > vwap_val:
                scores["bullish"] += 10
                reasons_bullish.append("Price above VWAP (+10)")
            else:
                scores["bearish"] += 10
                reasons_bearish.append("Price below VWAP (+10)")
                
            # 3. EMA alignment (Weight: 10)
            if self.ema_20 > self.ema_50:
                scores["bullish"] += 10
                reasons_bullish.append("EMA 20 > EMA 50 crossover (+10)")
            else:
                scores["bearish"] += 10
                reasons_bearish.append("EMA 20 < EMA 50 breakdown (+10)")
                
            # 4. ADX trend strength (Weight: 10)
            if self.adx > 25.0:
                if self.spot_price > self.ema_20:
                    scores["bullish"] += 10
                    reasons_bullish.append("ADX > 25 indicates Strong Bullish Trend (+10)")
                else:
                    scores["bearish"] += 10
                    reasons_bearish.append("ADX > 25 indicates Strong Bearish Trend (+10)")
            else:
                scores["sideways"] += 10
                reasons_neutral.append("ADX < 20 indicates Sideways Consolidation (+10)")
                
            # 5. VIX Trend (Weight: 15)
            if self.vix > 18.0:
                scores["bearish"] += 10
                reasons_bearish.append("VIX is elevated, favoring hedging/buying puts (+10)")
            else:
                scores["sideways"] += 15
                reasons_neutral.append("VIX is low/stable, premium decay favors option sellers (+15)")
                
            # 6. PCR (Weight: 10)
            if self.pcr > 1.25:
                scores["bullish"] += 10
                reasons_bullish.append("PCR is bullish (>1.25) indicating put writers control (+10)")
            elif self.pcr < 0.75:
                scores["bearish"] += 10
                reasons_bearish.append("PCR is bearish (<0.75) indicating heavy call writing (+10)")
            else:
                scores["sideways"] += 8
                reasons_neutral.append("PCR is neutral, range-bound positioning (+8)")
                
            # 7. OI Build-up (Weight: 15)
            if self.pcr > 1.15:
                scores["bullish"] += 15
                reasons_bullish.append("Heavy Put writing building support at ATM strikes (+15)")
            elif self.pcr < 0.85:
                scores["bearish"] += 15
                reasons_bearish.append("Heavy Call writing building resistance at ATM strikes (+15)")
            else:
                scores["sideways"] += 10
                reasons_neutral.append("OI build-up balanced on both Call and Put sides (+10)")
                
            # 8. IV Change (Weight: 10)
            if self.vix > 20.0:
                scores["bearish"] += 5
                reasons_bearish.append("Rising IV points to downside risk volatility (+5)")
            else:
                scores["sideways"] += 10
                reasons_neutral.append("Stable/Crushing IV favors selling strategies (+10)")
                
            # 9. Breadth & Sectors (Weight: 10 total)
            if self.advance_decline > 1.5:
                scores["bullish"] += 10
                reasons_bullish.append("Strong Advance/Decline ratio & broad market breadth (+10)")
            elif self.advance_decline < 0.65:
                scores["bearish"] += 10
                reasons_bearish.append("Weak Advance/Decline ratio indicating broad selloff (+10)")
            else:
                scores["sideways"] += 5
                reasons_neutral.append("Market breadth is balanced across sectors (+5)")

            # Strategy selection based on aggregate weighted scores
            total_bullish = scores["bullish"]
            total_bearish = scores["bearish"]
            total_sideways = scores["sideways"]
            
            max_score = max(total_bullish, total_bearish, total_sideways)
            
            if max_score == total_bullish and total_bullish > 45:
                confidence_pct = min(98.0, 50.0 + (total_bullish / 100.0) * 45.0)
                reasoning_list = reasons_bullish
                negation_list = reasons_bearish
                if "Strong" in regime or "Breakout" in regime:
                    primary_rec = "Buy CE" if self.vix > 15.0 else "Bull Call Spread"
                else:
                    primary_rec = "Bull Put Spread"
            elif max_score == total_bearish and total_bearish > 45:
                confidence_pct = min(98.0, 50.0 + (total_bearish / 100.0) * 45.0)
                reasoning_list = reasons_bearish
                negation_list = reasons_bullish
                if "Strong" in regime or "Breakdown" in regime:
                    primary_rec = "Buy PE" if self.vix > 15.0 else "Bear Put Spread"
                else:
                    primary_rec = "Bear Call Spread"
            else:
                confidence_pct = min(98.0, 50.0 + (total_sideways / 100.0) * 45.0)
                reasoning_list = reasons_neutral
                negation_list = reasons_bullish + reasons_bearish
                if self.vix > 18.0:
                    primary_rec = "Iron Condor"
                else:
                    primary_rec = "Short Strangle"
            
            # Rule: If confidence is below 65%, force NO TRADE.
            if confidence_pct < 65.0:
                primary_rec = "No Trade"
                reasoning_list.append("Confidence score below institutional threshold of 65%.")

            # Multi-Timeframe Trend Confirmation
            analysis_15m = self.analyze_timeframe(self.candles_15m)
            analysis_1m = self.analyze_timeframe(self.candles_1m)
            analysis_5m = self.analyze_timeframe(self.candles_5m)
            
            trend_15m = analysis_15m["trend"]
            trend_5m = analysis_5m["trend"]
            trend_1m = analysis_1m["trend"]
            
            is_bullish_confirmed = (trend_15m in ["Bullish", "Neutral-Bullish"]) and \
                                   (trend_5m in ["Bullish", "Neutral-Bullish"]) and \
                                   (trend_1m == "Bullish")
                                   
            is_bearish_confirmed = (trend_15m in ["Bearish", "Neutral-Bearish"]) and \
                                   (trend_5m in ["Bearish", "Neutral-Bearish"]) and \
                                   (trend_1m == "Bearish")
                                   
            reasoning_list.append(f"MTF Trend Check: 15m (Macro) = {trend_15m}, 5m (Setup) = {trend_5m}, 1m (Confirm) = {trend_1m}")
            
            # Filter directional strategies through Multi-Timeframe Confirmation
            if primary_rec in ["Buy CE", "Bull Call Spread", "Bull Put Spread"]:
                if not is_bullish_confirmed:
                    reasoning_list.append(f"⚠️ Bullish signal '{primary_rec}' blocked: Mismatched MTF trend (15m: {trend_15m}, 5m: {trend_5m}, 1m: {trend_1m}). Locked to Sideways.")
                    if self.vix > 18.0:
                        primary_rec = "Iron Condor"
                    else:
                        primary_rec = "Short Strangle"
                    confidence_pct = 70.0
            elif primary_rec in ["Buy PE", "Bear Put Spread", "Bear Call Spread"]:
                if not is_bearish_confirmed:
                    reasoning_list.append(f"⚠️ Bearish signal '{primary_rec}' blocked: Mismatched MTF trend (15m: {trend_15m}, 5m: {trend_5m}, 1m: {trend_1m}). Locked to Sideways.")
                    if self.vix > 18.0:
                        primary_rec = "Iron Condor"
                    else:
                        primary_rec = "Short Strangle"
                    confidence_pct = 70.0

        # Apply Stability Filter
        old_rec = self.current_recommendation
        old_conf = self.confidence
        
        should_change = False
        if old_rec == "No Trade" and primary_rec != "No Trade":
            should_change = True
        elif abs(confidence_pct - old_conf) >= 10.0:
            should_change = True
        elif self.recalculation_trigger != "Schedule" and self.recalculation_trigger != "Completed 5-minute candle":
            should_change = True
        elif regime != self.market_regime:
            should_change = True
        elif old_rec == "No Trade":
            should_change = True

        # Apply Cooldown Debounce Protection (Avoid rapid chattering/oscillation in live markets)
        now_ts = time.time()
        cooldown_period = 60.0  # 60 seconds lock to confirm setup before shifting
        time_since_change = now_ts - self.last_strategy_change_time
        
        # Immediate bypass for safety overrides or first evaluation
        is_safety_override = "Sudden" in self.recalculation_trigger or is_momentum_breakout
        is_first_eval = len(self.change_log) == 0
        
        if should_change and primary_rec != old_rec and not is_first_eval and not is_safety_override:
            if time_since_change < cooldown_period:
                should_change = False
                reasoning_list.append(f"AI Setup locked (cooldown active: {int(cooldown_period - time_since_change)}s remaining for trade execution stability).")
            
        # Always update confidence, reasoning, and negation in real-time
        self.confidence = confidence_pct
        self.rec_reasoning = reasoning_list
        self.rec_negation = negation_list
        
        if should_change or not self.change_log:
            # Save actual previous rec before update
            prev_strat = self.current_recommendation
            self.current_recommendation = primary_rec
            self.last_strategy_change_time = time.time()  # Enforce cooldown block on successful strategy shift
            
            # Log changes to the change timeline
            if not self.change_log or self.change_log[-1]["new_strategy"] != primary_rec:
                self.change_log.append({
                    "time": get_ist_time_str(),
                    "prev_strategy": prev_strat,
                    "new_strategy": primary_rec,
                    "confidence": f"{confidence_pct:.1f}%",
                    "reason": self.recalculation_trigger,
                    "indicators_changed": ", ".join(reasoning_list[:3])
                })
        
        # Reset trigger
        self.recalculation_trigger = "Schedule"
        self.last_rec_time = time.time()


# Singleton simulation state instance
state = SimulationState()

# Option trade P&L points calculator
def calculate_trade_pnl_points(strategy: str, diff: float) -> float:
    strat = strategy.upper()
    if "SHORT STRANGLE" in strat:
        if abs(diff) <= 100:
            return 50.0 - (abs(diff) * 0.15)
        else:
            return 35.0 - (abs(diff) - 100) * 1.5
    elif "IRON CONDOR" in strat:
        if abs(diff) <= 80:
            pts = 30.0 - (abs(diff) * 0.1)
            return max(-50.0, pts)
        else:
            pts = 22.0 - (abs(diff) - 80) * 1.2
            return max(-50.0, pts)
    elif "BULL PUT" in strat:
        if diff >= 0:
            return min(20.0, 5.0 + diff * 0.15)
        else:
            return max(-30.0, diff * 0.5)
    elif "BEAR CALL" in strat:
        if diff <= 0:
            return min(20.0, 5.0 - diff * 0.15)
        else:
            return max(-30.0, -diff * 0.5)
    elif "BULL CALL" in strat:
        return min(50.0, max(-30.0, diff * 0.4))
    elif "BEAR PUT" in strat:
        return min(50.0, max(-30.0, -diff * 0.4))
    elif "BUY CE" in strat or "LONG CE" in strat:
        if diff >= 0:
            return diff * 0.6
        else:
            return max(-80.0, diff * 0.8)
    elif "BUY PE" in strat or "LONG PE" in strat:
        if diff <= 0:
            return -diff * 0.6
        else:
            return max(-80.0, -diff * 0.8)
    else:
        if "CE" in strat or "BULL" in strat:
            return diff * 0.5
        elif "PE" in strat or "BEAR" in strat:
            return -diff * 0.5
        else:
            return 10.0

# ==========================================
# 4. PAPER TRADING & TRADE JOURNAL ENGINE
# ==========================================

def calculate_trade_initial_risk(trade, capital):
    strat = trade.get("strategy", "")
    size = trade.get("size", 1)
    lot_size = trade.get("lot_size", 65)
    
    if "Buy CE" in strat or "Buy PE" in strat:
        if "legs" in trade and trade["legs"]:
            premium = sum(leg["entry_price"] * leg["quantity"] for leg in trade["legs"])
        else:
            premium = trade["entry_spot"] * lot_size * size
        return round(premium * 0.10, 2)
    else:
        if "legs" in trade and trade["legs"]:
            if "Strangle" in strat:
                premium = sum(leg["entry_price"] * leg["quantity"] for leg in trade["legs"])
            else: # Spreads/Iron Condor
                buy_prem = sum(leg["entry_price"] * leg["quantity"] for leg in trade["legs"] if leg["action"] == "BUY")
                sell_prem = sum(leg["entry_price"] * leg["quantity"] for leg in trade["legs"] if leg["action"] == "SELL")
                premium = abs(sell_prem - buy_prem)
            return round(premium * 0.50, 2)
        else:
            return round(capital * 0.02, 2)

class TradeJournal:
    def __init__(self):
        self.trades: List[Dict] = []
        if os.path.exists("journal.json"):
            try:
                with open("journal.json", "r") as f:
                    self.trades = json.load(f)
            except Exception as e:
                print(f"Failed to load journal from disk: {e}")
                
    def save_journal(self):
        try:
            with open("journal.json", "w") as f:
                json.dump(self.trades, f, indent=4)
        except Exception as e:
            print(f"Failed to save journal: {e}")
        
    def add_trade(self, strategy: str, entry_price: float, strikes: List[str], confidence: float, reason: str, size: int = 1, execution_type: str = "Paper", lot_size: int = 65, legs: Optional[List[Dict]] = None, initial_risk: Optional[float] = None):
        trade_id = str(len(self.trades) + 1)
        entry_premium = 0.0
        if legs:
            entry_premium = sum(leg["entry_price"] * leg["quantity"] for leg in legs)
        else:
            entry_premium = entry_price * lot_size * size
            
        trade = {
            "id": trade_id,
            "date": get_ist_date_str(),
            "time": get_ist_time_str(),
            "strategy": strategy,
            "entry_spot": entry_price,
            "strikes": strikes,
            "confidence": f"{confidence:.1f}%",
            "size": size,
            "status": "OPEN",
            "exit_spot": None,
            "pnl": 0.0,
            "reason": reason,
            "outcome": "PENDING",
            "execution_type": execution_type,
            "lot_size": lot_size,
            "legs": legs,
            "brokerage": round(0.005 * entry_premium, 2),
            "stage": "OPEN",
            "locked_profit": 0.0,
            "trail_activated": False,
            "peak_pnl": 0.0
        }
        
        if initial_risk is None:
            capital = float(state.settings.get("capital", 500000.0)) if 'state' in globals() else 500000.0
            initial_risk = calculate_trade_initial_risk(trade, capital)
        trade["initial_risk"] = initial_risk
        
        self.trades.append(trade)
        self.save_journal()
        return trade
        
    def close_trade(self, trade_id: str, exit_spot: float):
        for trade in self.trades:
            if trade["id"] == trade_id and trade["status"] == "OPEN":
                trade["status"] = "CLOSED"
                trade["exit_spot"] = exit_spot
                # Calculate P&L based on direction
                pnl = 0.0
                strat = trade["strategy"]
                entry = trade["entry_spot"]
                
                multiplier = float(trade.get("lot_size", 65)) * trade["size"]
                diff = exit_spot - entry
                
                # If we have stored option legs, calculate exact realized P&L based on option prices!
                if "legs" in trade and trade["legs"]:
                    pnl = 0.0
                    entry_premium = sum(leg["entry_price"] * leg["quantity"] for leg in trade["legs"])
                    exit_premium = 0.0
                    for leg in trade["legs"]:
                        # Look up current LTP of this leg from the option chain
                        leg_exit_price = None
                        
                        # 1. Look up in state.option_chain
                        for item in state.option_chain:
                            if item.get("call_instrument_key") == leg["instrument_key"]:
                                leg_exit_price = item.get("call_price")
                                break
                            elif item.get("put_instrument_key") == leg["instrument_key"]:
                                leg_exit_price = item.get("put_price")
                                break
                        
                        # 2. Look up in state.upstox_option_chain (part of PnL calculation engine)
                        if leg_exit_price is None:
                            if state.settings.get("feed_mode") == "Upstox" and state.upstox_option_chain:
                                for chain_item in state.upstox_option_chain:
                                    if chain_item.get("strike") == leg.get("strike"):
                                        if leg.get("option_type") == "CE":
                                            leg_exit_price = chain_item.get("call_price")
                                        else:
                                            leg_exit_price = chain_item.get("put_price")
                                        break
                                        
                        # 3. Fallback to Black-Scholes Greeks pricing (part of PnL calculation engine)
                        if leg_exit_price is None:
                            t_years = 4.0 / 365.0
                            r = 0.07
                            is_call = leg["option_type"].upper() == "CE"
                            opt_res = calculate_greeks(exit_spot, leg["strike"], t_years, state.vix / 100.0, r, is_call)
                            leg_exit_price = opt_res["price"]
                        
                        leg["exit_price"] = leg_exit_price
                        exit_premium += leg_exit_price * leg["quantity"]
                        leg_diff = leg_exit_price - leg["entry_price"]
                        if leg["action"] == "BUY":
                            pnl += leg_diff * leg["quantity"]
                        else:
                            pnl -= leg_diff * leg["quantity"]
                    trade["brokerage"] = round(0.005 * (entry_premium + exit_premium), 2)
                else:
                    pnl_points = calculate_trade_pnl_points(strat, diff)
                    pnl = pnl_points * multiplier
                    entry_premium = trade["entry_spot"] * trade["lot_size"] * trade["size"]
                    exit_premium = exit_spot * trade["lot_size"] * trade["size"]
                    trade["brokerage"] = round(0.005 * (entry_premium + exit_premium), 2)
                    
                trade["pnl"] = round(pnl, 2)
                trade["outcome"] = "WIN" if pnl > 0 else "LOSS"
                self.save_journal()
                return trade
        return None

    def get_analytics(self, execution_type: str = "All") -> Dict:
        if execution_type == "Live":
            closed_trades = [t for t in self.trades if t["status"] == "CLOSED" and t.get("execution_type", "Paper").startswith("Live")]
        elif execution_type == "Paper":
            closed_trades = [t for t in self.trades if t["status"] == "CLOSED" and not t.get("execution_type", "Paper").startswith("Live")]
        else:
            closed_trades = [t for t in self.trades if t["status"] == "CLOSED"]
            
        if not closed_trades:
            return {
                "win_rate": "0%", "loss_rate": "0%", "profit_factor": "0.0",
                "avg_win": "0.0", "avg_loss": "0.0", "drawdown": "0.0",
                "best_strategy": "N/A", "worst_strategy": "N/A"
            }
            
        wins = [t for t in closed_trades if t["pnl"] > 0]
        losses = [t for t in closed_trades if t["pnl"] <= 0]
        
        win_rate = len(wins) / len(closed_trades) * 100
        loss_rate = len(losses) / len(closed_trades) * 100
        
        sum_wins = sum(t["pnl"] for t in wins)
        sum_losses = abs(sum(t["pnl"] for t in losses))
        
        profit_factor = sum_wins / sum_losses if sum_losses > 0 else (sum_wins if sum_wins > 0 else 1.0)
        avg_win = sum_wins / len(wins) if wins else 0.0
        avg_loss = sum_losses / len(losses) if losses else 0.0
        
        # Compute drawdown
        balance = 500000.0
        peak = balance
        max_dd = 0.0
        for t in closed_trades:
            balance += t["pnl"]
            if balance > peak:
                peak = balance
            dd = (peak - balance) / peak * 100.0
            if dd > max_dd:
                max_dd = dd
                
        # Find best/worst strategies
        strat_pnl = {}
        for t in closed_trades:
            s = t["strategy"]
            strat_pnl[s] = strat_pnl.get(s, 0.0) + t["pnl"]
            
        best = max(strat_pnl, key=strat_pnl.get) if strat_pnl else "N/A"
        worst = min(strat_pnl, key=strat_pnl.get) if strat_pnl else "N/A"
        
        return {
            "win_rate": f"{win_rate:.1f}%",
            "loss_rate": f"{loss_rate:.1f}%",
            "profit_factor": f"{profit_factor:.2f}",
            "avg_win": f"₹{avg_win:.2f}",
            "avg_loss": f"₹{avg_loss:.2f}",
            "drawdown": f"{max_dd:.2f}%",
            "best_strategy": best,
            "worst_strategy": worst
        }

journal = TradeJournal()

# Pre-populate dynamic trades history only if the journal is empty
if len(journal.trades) == 0:
    t1 = journal.add_trade("Bull Put Spread", 22210.0, ["22200 PE", "22150 PE"], 90.0, "VIX Falling, strong put writing", size=2)
    journal.close_trade(t1["id"], 22260.0)
    t2 = journal.add_trade("Buy PE", 22280.0, ["22300 PE"], 75.0, "VWAP breakdowns and negative breadth", size=1)
    journal.close_trade(t2["id"], 22230.0)


# ==========================================
# 5. REST API ROUTING
# ==========================================

class SettingsUpdate(BaseModel):
    capital: float
    risk_pct: float
    preferred_broker: str
    preferred_strategy: str
    regime_override: str
    feed_mode: str
    upstox_access_token: str
    upstox_expiry_date: str
    dashboard_username: str
    dashboard_password: str
    auto_trade_mode: str = "OFF"
    trailing_sl_pts: float = 30.0

class LoginRequest(BaseModel):
    username: str
    password: str

class TriggerOverride(BaseModel):
    override_type: str

class TradeLeg(BaseModel):
    instrument_key: str
    strike: float
    option_type: str
    action: str
    entry_price: float
    quantity: int

class TradeRequest(BaseModel):
    strategy: str
    entry_spot: float
    strikes: List[str]
    confidence: float
    reason: str
    size: int
    legs: Optional[List[TradeLeg]] = None

class CloseRequest(BaseModel):
    trade_id: str
    exit_spot: float

class SyncRequest(BaseModel):
    trades: List[Dict]

@app.get("/api/market-data")
def get_market_data():
    state.check_daily_reset()
    fallback_active = False
    if state.settings.get("feed_mode") == "Upstox":
        success = state.fetch_upstox_data()
        if not success:
            state.tick_5s()
            fallback_active = True
        else:
            # Still run decision engine + auto-trade tick even on successful Upstox feed
            state.evaluate_decision_engine()
            if not state.daily_stop_limit_hit:
                state._auto_trade_tick()
    else:
        state.tick_5s()
    
    spot = state.spot_price
    
    # 1. Trailing Stop Loss on Open positions based purely on Nifty point movement removed per v1.1 rules.
                
    # 2. Check 2% Capital Protection (Auto-Exit) separately for Paper and Live
    capital = state.settings.get("capital", 500000.0)
    risk_limit = capital * 0.02
    
    def get_single_trade_pnl(t):
        return state.calculate_trade_pnl(t, spot)

    # Check Paper Trades Capital Protection
    paper_open = [t for t in journal.trades if t.get("status") == "OPEN" and not t.get("execution_type", "Paper").startswith("Live")]
    if paper_open:
        total_paper_pnl = sum(get_single_trade_pnl(t) for t in paper_open)
        if total_paper_pnl <= -risk_limit:
            print(f"⚠️ PAPER CAPITAL PROTECTION TRIGGERED: Paper loss (₹{total_paper_pnl:.2f}) exceeded 2% limit (₹{risk_limit:.2f}). Exiting all paper trades.")
            for t in paper_open:
                journal.close_trade(t["id"], spot)
                t["reason"] = f"Auto-Exit Paper Capital Protection (2% Max Loss hit at ₹{total_paper_pnl:.2f})"
            journal.save_journal()

    # Check Live Trades Capital Protection
    live_open = [t for t in journal.trades if t.get("status") == "OPEN" and t.get("execution_type", "Paper").startswith("Live")]
    if live_open:
        total_live_pnl = sum(get_single_trade_pnl(t) for t in live_open)
        if total_live_pnl <= -risk_limit:
            print(f"⚠️ LIVE CAPITAL PROTECTION TRIGGERED: Live loss (₹{total_live_pnl:.2f}) exceeded 2% limit (₹{risk_limit:.2f}). Exiting all live trades.")
            for t in live_open:
                journal.close_trade(t["id"], spot)
                t["reason"] = f"Auto-Exit Live Capital Protection (2% Max Loss hit at ₹{total_live_pnl:.2f})"
            journal.save_journal()
            
    # Include option buy strategies in the returned data block
    option_buy_strategies = state.get_option_buy_strategies()
    preferred_index = state.settings.get("preferred_index", "Nifty")
    if preferred_index.lower() == "sensex":
        atm_strike = round(spot / 100.0) * 100
        strike_interval = 100
        upstox_filter_width = 600
    else:
        atm_strike = round(spot / 50.0) * 50
        strike_interval = 50
        upstox_filter_width = 300
    
    option_chain = []
    if state.settings.get("feed_mode") == "Upstox" and state.upstox_option_chain:
        option_chain = [x for x in state.upstox_option_chain if abs(x["strike"] - atm_strike) <= upstox_filter_width]
        option_chain = sorted(option_chain, key=lambda x: x["strike"])
    else:
        t_years = 4.0 / 365.0
        r = 0.07
        
        for i in range(-6, 7):
            strike = atm_strike + (i * strike_interval)
            dist_from_atm = abs(strike - spot)
            iv_strike = (state.vix / 100.0) + (dist_from_atm / 1000.0) * 0.10
            
            call_greeks = calculate_greeks(spot, strike, t_years, iv_strike, r, is_call=True)
            put_greeks = calculate_greeks(spot, strike, t_years, iv_strike, r, is_call=False)
            
            base_oi = 5000000 / (1 + (dist_from_atm / 150.0) ** 2)
            call_oi = int(base_oi * (1.2 if strike > spot else 0.8) * (1.1 - 0.2 * (state.pcr - 1.0)))
            put_oi = int(base_oi * (0.8 if strike > spot else 1.2) * (state.pcr))
            
            call_change_oi = int(call_oi * random.uniform(-0.05, 0.08))
            put_change_oi = int(put_oi * random.uniform(-0.05, 0.08))
            
            option_chain.append({
                "strike": strike,
                "call_oi": call_oi,
                "call_change_oi": call_change_oi,
                "call_iv": f"{iv_strike*100:.1f}%",
                "call_delta": call_greeks["delta"],
                "call_theta": call_greeks["theta"],
                "call_vega": call_greeks["vega"],
                "call_price": call_greeks["price"],
                "call_bid": max(0.05, call_greeks["price"] - 0.2),
                "call_ask": call_greeks["price"] + 0.2,
                "call_instrument_key": f"SIM_CALL_{strike}",
                "put_price": put_greeks["price"],
                "put_bid": max(0.05, put_greeks["price"] - 0.2),
                "put_ask": put_greeks["price"] + 0.2,
                "put_delta": put_greeks["delta"],
                "put_theta": put_greeks["theta"],
                "put_vega": put_greeks["vega"],
                "put_iv": f"{iv_strike*100:.1f}%",
                "put_change_oi": put_change_oi,
                "put_oi": put_oi,
                "put_instrument_key": f"SIM_PUT_{strike}"
            })
        
    min_pain = float("inf")
    max_pain_strike = atm_strike
    for candidate_strike in [c["strike"] for c in option_chain]:
        total_loss = 0.0
        for opt in option_chain:
            k = opt["strike"]
            c_loss = max(0.0, candidate_strike - k) * opt["call_oi"]
            p_loss = max(0.0, k - candidate_strike) * opt["put_oi"]
            total_loss += c_loss + p_loss
        if total_loss < min_pain:
            min_pain = total_loss
            max_pain_strike = candidate_strike

    strikes_suggested = {
        "ATM": f"{atm_strike}",
        "ITM": f"{atm_strike - strike_interval if state.confidence > 70 else atm_strike + strike_interval}",
        "OTM": f"{atm_strike + strike_interval if state.confidence > 70 else atm_strike - strike_interval}"
    }

    expected_move = spot * (state.vix / 100.0) / math.sqrt(252)

    secondary_rec = "Short Strangle"
    tertiary_rec = "Iron Condor"
    if "Buy" in state.current_recommendation:
        secondary_rec = "Bull Put Spread" if "CE" in state.current_recommendation else "Bear Call Spread"
        tertiary_rec = "No Trade"
    elif "Strangle" in state.current_recommendation:
        secondary_rec = "Iron Condor"
        tertiary_rec = "No Trade"

    # Determine lot sizing based on max 2% trade limit risk & margins
    suggested_lots, margin_required, risk_amount = state.calculate_suggested_lots_and_margin(state.current_recommendation, spot)
    lot_size = 20 if preferred_index.lower() == "sensex" else 65

    state.update_option_chain()
    return {
        "spot_price": round(spot, 2),
        "change_pct": state.intraday_change_pct,
        "change_val": state.intraday_change_val,
        "price_source": state.price_source,
        "price_date": state.price_date,
        "price_time": state.price_time,
        "vix": round(state.vix, 2),
        "pcr": round(state.pcr, 2),
        "regime": state.market_regime,
        "recommendation": state.current_recommendation,
        "confidence": round(state.confidence, 1),
        "secondary_recommendation": secondary_rec,
        "tertiary_recommendation": tertiary_rec,
        "reasoning": state.rec_reasoning,
        "negation": state.rec_negation,
        "auto_trade_mode": state.settings.get("auto_trade_mode", "OFF"),
        "trailing_sl_pts": state.settings.get("trailing_sl_pts", 30.0),
        "daily_stop_limit_hit": state.daily_stop_limit_hit,
        "daily_pnl": round(state.daily_closed_pnl, 2),
        "daily_brokerage": round(sum(t.get("brokerage", 0.0) for t in journal.trades if t.get("date") == get_ist_date_str()), 2),
        "total_brokerage": round(sum(t.get("brokerage", 0.0) for t in journal.trades), 2),
        "today_trades": sum(1 for t in journal.trades if t.get("status") == "CLOSED" and t.get("date") == get_ist_date_str()),
        "today_legs": sum(len(t.get("legs") or []) or 1 for t in journal.trades if t.get("status") == "CLOSED" and t.get("date") == get_ist_date_str()),
        "timeframe_trends": {
            "m15": state.analyze_timeframe(state.candles_15m)["trend"],
            "m5": state.analyze_timeframe(state.candles_5m)["trend"],
            "m1": state.analyze_timeframe(state.candles_1m)["trend"]
        },
        "indicators": {
            "ema_20": round(state.ema_20, 2),
            "ema_50": round(state.ema_50, 2),
            "rsi": round(state.rsi, 1),
            "adx": round(state.adx, 1),
            "macd": round(state.macd, 2),
            "macd_signal": round(state.macd_signal, 2),
            "supertrend": state.supertrend,
            "supertrend_val": round(state.supertrend_val, 2),
            "vwap": round(state.get_vwap(), 2),
            "atr": 35.0,
            "advance_decline": round(state.advance_decline, 2),
            "max_pain": max_pain_strike,
            "expected_move": round(expected_move, 2)
        },
        "session": {
            "opening_range_high": state.opening_range_high,
            "opening_range_low": state.opening_range_low,
            "prev_day_high": state.prev_day_high,
            "prev_day_low": state.prev_day_low,
            "today_high": round(state.today_high, 2),
            "today_low": round(state.today_low, 2),
            "gap_pct": state.gap_pct
        },
        "option_chain": option_chain,
        "strikes_suggested": strikes_suggested,
        "trade_card": {
            "entry_zone": f"{spot - 15.0:.1f} - {spot + 10.0:.1f}",
            "target": f"{spot + 80.0:.1f}" if "CE" in state.current_recommendation or "Bull" in state.current_recommendation else f"{spot - 80.0:.1f}",
            "stop_loss": f"{spot - 30.0:.1f}" if "CE" in state.current_recommendation or "Bull" in state.current_recommendation else f"{spot + 30.0:.1f}",
            "risk_reward": "1:2.6",
            "max_risk": f"₹{risk_amount:.2f}",
            "margin_required": f"₹{margin_required:.2f}",
            "lot_size": lot_size,
            "suggested_lots": suggested_lots,
            "theta_decay": "-₹350/lot day",
            "iv_effect": "Neutral",
            "holding_time": "1 - 3 hours"
        },
        "option_buy_strategies": option_buy_strategies,
        "fallback_active": fallback_active,
        "market_session": state.market_session,
        "lock_remaining_seconds": max(0, int(60.0 - (time.time() - state.last_strategy_change_time)))
    }

@app.get("/api/logs")
def get_logs():
    return state.change_log

@app.get("/api/chart-data")
def get_chart_data():
    return {
        "price_history": state.price_history,
        "strategy_changes": state.change_log,
        "current_strategy": state.current_recommendation,
        "current_confidence": round(state.confidence, 1)
    }

@app.get("/api/settings")
def get_settings():
    pref_index = state.settings.get("preferred_index", "Nifty")
    feed_mode = state.settings.get("feed_mode", "Simulation")
    token = state.settings.get("upstox_access_token")
    
    expiry_dates = []
    if feed_mode == "Upstox" and token:
        expiry_dates = state.get_upstox_expiries(pref_index)
        
    if not expiry_dates:
        # Fallback to calculated weekday expiries
        today = datetime.date.today()
        target_weekday = 4 if pref_index.lower() == "sensex" else 3
        for i in range(5):
            days_ahead = (target_weekday - today.weekday()) % 7
            next_expiry = today + datetime.timedelta(days=days_ahead + i * 7)
            expiry_dates.append(next_expiry.strftime("%Y-%m-%d"))
            
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    saved_expiry = state.settings.get("upstox_expiry_date")
    
    # If saved expiry is in the past, auto-update to the next upcoming expiry
    if saved_expiry and saved_expiry < today_str:
        state.settings["upstox_expiry_date"] = expiry_dates[0]
        state.save_settings()
        saved_expiry = expiry_dates[0]
        
    if saved_expiry and saved_expiry not in expiry_dates:
        if saved_expiry >= today_str:
            expiry_dates.insert(0, saved_expiry)
            
    return {
        **state.settings,
        "upcoming_expiry_dates": expiry_dates
    }

@app.post("/api/settings")
def update_settings(data: SettingsUpdate):
    state.settings["capital"] = data.capital
    state.settings["risk_pct"] = data.risk_pct
    state.settings["preferred_broker"] = data.preferred_broker
    state.settings["preferred_strategy"] = data.preferred_strategy
    state.settings["regime_override"] = data.regime_override
    state.settings["feed_mode"] = data.feed_mode
    state.settings["upstox_access_token"] = data.upstox_access_token
    state.settings["upstox_expiry_date"] = data.upstox_expiry_date
    state.settings["dashboard_username"] = data.dashboard_username
    state.settings["dashboard_password"] = data.dashboard_password
    state.settings["auto_trade_mode"] = data.auto_trade_mode
    state.settings["trailing_sl_pts"] = data.trailing_sl_pts
    
    # Try updating the expiry automatically based on token validity/feed mode
    state.update_default_expiry()
    
    state.evaluate_decision_engine()
    state.save_settings()
    return {"status": "SUCCESS"}

class ExpiryUpdateRequest(BaseModel):
    expiry_date: str

@app.post("/api/settings/expiry")
def update_settings_expiry(data: ExpiryUpdateRequest):
    state.settings["upstox_expiry_date"] = data.expiry_date
    state.evaluate_decision_engine()
    state.save_settings()
    return {"status": "SUCCESS", "upstox_expiry_date": data.expiry_date}

class IndexUpdateRequest(BaseModel):
    preferred_index: str

@app.post("/api/settings/index")
def update_settings_index(data: IndexUpdateRequest):
    state.settings["preferred_index"] = data.preferred_index
    
    # Clear price history and strategy change logs to reset the chart
    state.price_history = []
    state.change_log = []
    
    # Recalculate expiry list and update default expiry dynamically
    state.update_default_expiry()
    
    # Clear the old option chain so it fetches the new one
    state.upstox_option_chain = []
    
    # Force engine tick to recalculate spot price and strategy
    price_data = fetch_live_index_price(data.preferred_index)
    live_price = price_data[0]
    if live_price is not None:
        state.spot_price = live_price
        state.intraday_change_pct = price_data[1]
        state.intraday_change_val = price_data[2]
        state.prev_close_baseline = live_price - price_data[2]
    state.evaluate_decision_engine()
    state.save_settings()
    return {
        "status": "SUCCESS", 
        "preferred_index": data.preferred_index,
        "upstox_expiry_date": state.settings["upstox_expiry_date"]
    }

class LiveLegOrder(BaseModel):
    instrument_key: str
    quantity: int
    transaction_type: str
    order_type: str
    price: float = 0.0
    strike: Optional[float] = None
    option_type: Optional[str] = None

class LiveOrderRequest(BaseModel):
    strategy: str
    legs: List[LiveLegOrder]

def wait_for_order_fill(order_id: str, token: str) -> bool:
    url = f"https://api.upstox.com/v2/order/history?order_id={order_id}"
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {token}"
    }
    for _ in range(10): # retry for 10 times (approx 5 seconds)
        try:
            resp = requests.get(url, headers=headers, timeout=3)
            if resp.status_code == 200:
                res_json = resp.json()
                if res_json.get("status") == "success":
                    order_data = res_json.get("data", [{}])
                    # order history returns a list of states, check if any is "complete"
                    if any(state.get("status") == "complete" for state in order_data):
                        print(f"✅ Upstox Order {order_id} filled successfully.")
                        return True
        except Exception as e:
            print(f"Error checking order status: {e}")
        time.sleep(0.5)
    return False

@app.post("/api/execute-live")
def execute_live_order(data: LiveOrderRequest):
    token = state.settings.get("upstox_access_token")
    mode = state.settings.get("feed_mode")
    
    preferred_index = state.settings.get("preferred_index", "Nifty")
    lot_size = 20 if preferred_index.lower() == "sensex" else 65
    
    # Pre-calculate leg details (strike, option_type, entry_price) for logging
    legs_logged = []
    for leg in data.legs:
        ltp = leg.price
        strike_val = leg.strike or 0.0
        opt_type = leg.option_type or "CE"
        for item in state.option_chain:
            if item.get("call_instrument_key") == leg.instrument_key:
                ltp = item.get("call_price", 0.0)
                strike_val = item.get("strike", 0.0)
                opt_type = "CE"
                break
            elif item.get("put_instrument_key") == leg.instrument_key:
                ltp = item.get("put_price", 0.0)
                strike_val = item.get("strike", 0.0)
                opt_type = "PE"
                break
        legs_logged.append({
            "instrument_key": leg.instrument_key,
            "strike": strike_val,
            "option_type": opt_type,
            "action": leg.transaction_type,
            "entry_price": ltp if ltp > 0 else leg.price,
            "quantity": leg.quantity
        })
        
    if mode != "Upstox" or not token:
        # Mock Live execution (simulate the tiny fill delay for Strangle/Straddle BUY legs)
        if "Strangle" in data.strategy or "Straddle" in data.strategy:
            time.sleep(0.05)
            
        trade = journal.add_trade(
            strategy=data.strategy,
            entry_price=state.spot_price,
            strikes=[f"{leg.transaction_type} {leg.instrument_key.split('|')[-1]} x {leg.quantity}" for leg in data.legs],
            confidence=state.confidence,
            reason=f"Mock Live execution of {data.strategy}",
            size=1,
            execution_type="Live (Mock)",
            lot_size=lot_size,
            legs=legs_logged
        )
        return {
            "status": "SUCCESS",
            "message": "Order executed in Mock Live Mode (Upstox config not active)",
            "trade": trade
        }
        
    url = "https://api.upstox.com/v2/order/place"
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": f"Bearer {token}"
    }
    
    placed_orders = []
    failed_orders = []
    
    is_strangle_or_straddle = "Strangle" in data.strategy or "Straddle" in data.strategy
    
    if is_strangle_or_straddle:
        buy_legs = [leg for leg in data.legs if leg.transaction_type == "BUY"]
        sell_legs = [leg for leg in data.legs if leg.transaction_type == "SELL"]
        
        # Step 1: Execute the deep OTM Buy hedge legs first
        buy_success_ids = []
        for leg in buy_legs:
            payload = {
                "quantity": leg.quantity,
                "product": "I",
                "validity": "DAY",
                "price": leg.price,
                "tag": "decision-engine",
                "instrument_token": leg.instrument_key,
                "order_type": leg.order_type,
                "transaction_type": leg.transaction_type,
                "disclosed_quantity": 0,
                "trigger_price": 0.0,
                "is_amo": False
            }
            try:
                resp = requests.post(url, json=payload, headers=headers, timeout=5)
                res_json = resp.json()
                if resp.status_code == 200 and res_json.get("status") == "success":
                    order_id = res_json.get("data", {}).get("order_id")
                    placed_orders.append({
                        "leg": leg.instrument_key,
                        "order_id": order_id
                    })
                    buy_success_ids.append(order_id)
                else:
                    err_msg = res_json.get("errors", [{}])[0].get("message", "Unknown error") if isinstance(res_json.get("errors"), list) else str(res_json)
                    failed_orders.append({"leg": leg.instrument_key, "error": err_msg})
            except Exception as e:
                failed_orders.append({"leg": leg.instrument_key, "error": str(e)})
                
        # Step 2: Await API confirmation that the Buy legs have been filled
        for o_id in buy_success_ids:
            wait_for_order_fill(o_id, token)
            
        # Step 3: Execute the core Sell legs
        for leg in sell_legs:
            payload = {
                "quantity": leg.quantity,
                "product": "I",
                "validity": "DAY",
                "price": leg.price,
                "tag": "decision-engine",
                "instrument_token": leg.instrument_key,
                "order_type": leg.order_type,
                "transaction_type": leg.transaction_type,
                "disclosed_quantity": 0,
                "trigger_price": 0.0,
                "is_amo": False
            }
            try:
                resp = requests.post(url, json=payload, headers=headers, timeout=5)
                res_json = resp.json()
                if resp.status_code == 200 and res_json.get("status") == "success":
                    placed_orders.append({
                        "leg": leg.instrument_key,
                        "order_id": res_json.get("data", {}).get("order_id")
                    })
                else:
                    err_msg = res_json.get("errors", [{}])[0].get("message", "Unknown error") if isinstance(res_json.get("errors"), list) else str(res_json)
                    failed_orders.append({"leg": leg.instrument_key, "error": err_msg})
            except Exception as e:
                failed_orders.append({"leg": leg.instrument_key, "error": str(e)})
                
    else:
        # Standard sequential execution for other strategies
        for leg in data.legs:
            payload = {
                "quantity": leg.quantity,
                "product": "I",
                "validity": "DAY",
                "price": leg.price,
                "tag": "decision-engine",
                "instrument_token": leg.instrument_key,
                "order_type": leg.order_type,
                "transaction_type": leg.transaction_type,
                "disclosed_quantity": 0,
                "trigger_price": 0.0,
                "is_amo": False
            }
            try:
                resp = requests.post(url, json=payload, headers=headers, timeout=5)
                res_json = resp.json()
                if resp.status_code == 200 and res_json.get("status") == "success":
                    placed_orders.append({
                        "leg": leg.instrument_key,
                        "order_id": res_json.get("data", {}).get("order_id")
                    })
                else:
                    err_msg = res_json.get("errors", [{}])[0].get("message", "Unknown error") if isinstance(res_json.get("errors"), list) else str(res_json)
                    failed_orders.append({
                        "leg": leg.instrument_key,
                        "error": err_msg
                    })
            except Exception as e:
                failed_orders.append({
                    "leg": leg.instrument_key,
                    "error": str(e)
                })
            
    legs_desc = [f"{leg.transaction_type} {leg.instrument_key.split('|')[-1]} x {leg.quantity}" for leg in data.legs]
    trade = journal.add_trade(
        strategy=data.strategy,
        entry_price=state.spot_price,
        strikes=legs_desc,
        confidence=state.confidence,
        reason=f"Live Execution on Upstox. Orders placed: {len(placed_orders)}, Failed: {len(failed_orders)}",
        size=1,
        execution_type="Live",
        lot_size=lot_size,
        legs=legs_logged
    )
    
    if failed_orders:
        return {
            "status": "PARTIAL_SUCCESS" if placed_orders else "FAILED",
            "message": f"Placed: {len(placed_orders)}, Failed: {len(failed_orders)}",
            "placed": placed_orders,
            "failed": failed_orders,
            "trade": trade
        }
        
    return {
        "status": "SUCCESS",
        "message": "All strategy legs successfully executed on Upstox!",
        "placed": placed_orders,
        "trade": trade
    }

@app.post("/api/settings/action")
def trigger_action(data: TriggerOverride):
    state.tick_5s(override_type=data.override_type)
    
    # Determine lot sizing based on max 2% trade limit risk & margins
    suggested_lots, margin_required, risk_amount = state.calculate_suggested_lots_and_margin(state.current_recommendation, state.spot_price)
        
    return {
        "status": "SUCCESS", 
        "trigger": state.recalculation_trigger,
        "spot": state.spot_price,
        "recommendation": state.current_recommendation,
        "confidence": state.confidence,
        "reasoning": state.rec_reasoning,
        "suggested_lots": suggested_lots
    }

@app.get("/api/journal")
def get_journal():
    return {
        "trades": journal.trades[::-1],
        "analytics": journal.get_analytics("Paper"),
        "live_analytics": journal.get_analytics("Live")
    }

@app.post("/api/journal/trade")
def place_trade(data: TradeRequest):
    preferred_index = state.settings.get("preferred_index", "Nifty")
    lot_size = 20 if preferred_index.lower() == "sensex" else 65
    legs_list = None
    if data.legs:
        legs_list = [leg.dict() for leg in data.legs]
    trade = journal.add_trade(
        strategy=data.strategy,
        entry_price=data.entry_spot,
        strikes=data.strikes,
        confidence=data.confidence,
        reason=data.reason,
        size=data.size,
        lot_size=lot_size,
        legs=legs_list
    )
    return {"status": "SUCCESS", "trade": trade}

@app.post("/api/journal/close")
def close_trade(data: CloseRequest):
    trade = journal.close_trade(data.trade_id, data.exit_spot)
    if not trade:
        raise HTTPException(status_code=404, detail="Open trade not found")
    if state.auto_trade_active_id == data.trade_id:
        state.auto_trade_active_id = None
        print(f"🤖 AUTO-TRADE: Manually closed active trade {data.trade_id}. Resetting auto_trade_active_id.")
    return {"status": "SUCCESS", "trade": trade}

@app.post("/api/journal/sync")
def sync_journal(data: SyncRequest):
    # Restore the server chronological order by reversing client's newest-first list
    journal.trades = data.trades[::-1]
    journal.save_journal()
    return {
        "status": "SUCCESS",
        "trades": journal.trades[::-1],
        "analytics": journal.get_analytics("Paper"),
        "live_analytics": journal.get_analytics("Live")
    }

# ==========================================
# AUTHENTICATION MIDDLEWARE & ENDPOINTS
# ==========================================

@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    # Disable admin login for now (allow all requests)
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

@app.get("/login", response_class=HTMLResponse)
def get_login_page():
    try:
        with open("static/login.html", "r") as f:
            return HTMLResponse(content=f.read())
    except Exception as e:
        return HTMLResponse(content=f"Error loading login page: {e}", status_code=500)

@app.post("/api/login")
def login(data: LoginRequest, response: Response):
    expected_user = state.settings.get("dashboard_username", "admin")
    expected_pass = state.settings.get("dashboard_password", "password123")
    
    if data.username == expected_user and data.password == expected_pass:
        session_token = uuid.uuid4().hex
        state.settings["session_token"] = session_token
        state.save_settings()
        
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            max_age=30*24*60*60, # 30 days
            samesite="lax"
        )
        return {"status": "SUCCESS"}
    
    raise HTTPException(status_code=401, detail="Invalid username or password")

@app.post("/api/logout")
def logout(response: Response):
    state.settings["session_token"] = ""
    state.save_settings()
    response.delete_cookie(key="session_token")
    return {"status": "SUCCESS"}

@app.get("/api/check-auth")
def check_auth(request: Request):
    session_token = request.cookies.get("session_token")
    expected_token = state.settings.get("session_token")
    if session_token and expected_token and session_token == expected_token:
        return {"status": "SUCCESS", "authenticated": True}
    return {"status": "FAILED", "authenticated": False}

@app.post("/api/reset-daily-halt")
def reset_daily_halt():
    """Manually reset the daily loss halt so auto-trading can resume today."""
    state.daily_stop_limit_hit = False
    state.daily_closed_pnl = 0.0
    state.auto_trade_active_id = None
    
    # Wipe today's closed trades from the journal so they don't trigger the halt again
    today_str = get_ist_date_str()
    journal.trades = [t for t in journal.trades if t.get("date") != today_str]
    journal.save_journal()
    
    if state.settings.get("auto_trade_mode", "OFF") == "OFF":
        state.settings["auto_trade_mode"] = "Paper"
        state.save_settings()
    return {"status": "SUCCESS", "message": "Daily halt cleared. Auto-Paper re-enabled."}

@app.post("/api/journal/clear-today")
def clear_today_journal():
    """Wipe all of today's closed auto-trades so the daily P&L resets to zero."""
    today_str = get_ist_date_str()
    original_count = len(journal.trades)
    journal.trades = [t for t in journal.trades if t.get("date") != today_str]
    journal.save_journal()
    removed = original_count - len(journal.trades)
    state.daily_closed_pnl = 0.0
    state.daily_stop_limit_hit = False
    return {"status": "SUCCESS", "removed": removed, "message": f"Cleared {removed} today's trades."}

@app.delete("/api/journal/all")
def delete_all_journal_trades(request: Request):
    """Wipe all trades in the database (requires authentication)."""
    session_token = request.cookies.get("session_token")
    expected_token = state.settings.get("session_token")
    if not session_token or not expected_token or session_token != expected_token:
        raise HTTPException(status_code=401, detail="Unauthorized")
        
    original_count = len(journal.trades)
    journal.trades = []
    journal.save_journal()
    
    state.daily_closed_pnl = 0.0
    state.daily_stop_limit_hit = False
    state.auto_trade_active_id = None
    
    return {
        "status": "SUCCESS", 
        "removed": original_count, 
        "message": "All trades deleted successfully."
    }

app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

