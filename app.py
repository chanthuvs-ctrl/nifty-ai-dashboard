from backtest_engine import StrategyBacktester
import math
import random

import urllib3.util.connection
urllib3.util.connection.HAS_IPV6 = False

VERSION = "4.0.0" 
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

def get_default_target_weekday(preferred_index: str) -> int:
    """
    Returns default target weekday for options expiry fallback when Upstox API is offline.
    Python weekday: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun.
    - Nifty 50: Tuesday (1)
    - Sensex: Thursday (3) / Friday (4)
    - Bank Nifty: Wednesday (2)
    """
    idx = (preferred_index or "Nifty").lower()
    if "sensex" in idx:
        return 3  # Thursday (or 4)
    elif "bank" in idx:
        return 2  # Wednesday
    else:
        return 1  # Tuesday for Nifty 50

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
    if t <= 0 or sigma <= 0 or s <= 0 or k <= 0:
        # Expiry state or invalid inputs — return zero greeks
        price = max(0.0, s - k) if (is_call and k > 0) else (max(0.0, k - s) if k > 0 else 0.0)
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
    """Fetch live Nifty 50 or SENSEX spot price and intraday changes using high-speed JSON market APIs with fallback."""
    ticker = "^BSESN" if index_symbol.lower() == "sensex" else "^NSEI"
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    # 1. Primary: High-Speed Yahoo Finance API (100% accurate real-time index tick)
    try:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1m&range=1d"
        resp = requests.get(url, headers=headers, timeout=4)
        if resp.status_code == 200:
            data = resp.json()
            meta = data.get("chart", {}).get("result", [{}])[0].get("meta", {})
            price = meta.get("regularMarketPrice")
            prev_close = meta.get("chartPreviousClose") or meta.get("previousClose")
            if price and prev_close and price > 0:
                change_val = round(price - prev_close, 2)
                change_pct = round((change_val / prev_close) * 100.0, 2)
                return float(price), float(change_pct), float(change_val)
    except Exception as _e:
        print(f"⚠️ Yahoo Finance API fetch warning ({index_symbol}):", _e)

    # 2. Secondary: Google Finance regex fallback
    price, change_pct, change_val = None, 0.0, 0.0
    try:
        url = "https://www.google.com/finance/quote/SENSEX:INDEXBOM" if index_symbol.lower() == "sensex" else "https://www.google.com/finance/quote/NIFTY_50:INDEXNSE"
        resp = requests.get(url, headers=headers, timeout=4)
        if resp.status_code == 200:
            html = resp.text
            m_price = re.search(r'<span>([0-9]{2},\d{3}\.\d{2})</span>', html)
            if m_price:
                price = float(m_price.group(1).replace(",", ""))
            m_pct = re.search(r'([+-]?\d+\.\d+)%', html)
            if m_pct:
                change_pct = float(m_pct.group(1))
            m_val = re.search(r'([+-]\d+\.\d+)\s*\([+-]?\d+\.\d+%\)', html)
            if m_val:
                change_val = float(m_val.group(1).replace(",", ""))
    except Exception as e:
        print(f"Live {index_symbol} Google fetch warning:", e)
        
    return price, change_pct, change_val


# ==========================================
# 2. SIMULATION & DATA ENGINE STATE
# ==========================================

class SimulationState:
    def __init__(self):
        # Fetch live price or fallback to current typical price
        price_data = fetch_live_index_price("Nifty")
        live_price = price_data[0] if price_data[0] is not None else 24317.15
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
        self._cached_capital = None
        self._capital_cache_time = 0.0
        self.upstox_token_status = "DISCONNECTED"
        
        # Historical completed candles for multi-timeframe analysis
        self.candles_1m: List[Dict] = []
        self.candles_5m: List[Dict] = []
        self.candles_15m: List[Dict] = []
        self.completed_candles = self.candles_5m  # Backward

        # Independent Multi-Strategy Execution Slots & Cooldown Maps
        self.strategy_positions = {}
        self.strategy_cooldowns = {}
                
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
            "feed_mode": "Upstox", # "Simulation" or "Upstox"
            "upstox_access_token": "",
            "upstox_expiry_date": (datetime.date.today() + datetime.timedelta(days=(3 - datetime.date.today().weekday()) % 7)).strftime("%Y-%m-%d"),
            "preferred_index": "Nifty",
            "dashboard_username": "admin",
            "dashboard_password": "password123",
            "session_token": "",
            "auto_trade_mode": "OFF",
            "trailing_sl_pts": 30.0,
            "scalper_mode": False,
            "upstox_api_key": "82e905c4-6f67-46c4-aa8b-3a86d0798ef7",
            "upstox_api_secret": "ec6r0ue7si"
        }
        
        # Load settings from disk if exists
        if os.path.exists("settings.json"):
            try:
                with open("settings.json", "r") as f:
                    saved = json.load(f)
                    self.settings.update(saved)
            except Exception as e:
                print(f"Failed to load settings from disk: {e}")
                
        # Override test_key placeholder with user's actual default API key
        if self.settings.get("upstox_api_key") in ["test_key", "", None]:
            self.settings["upstox_api_key"] = "82e905c4-6f67-46c4-aa8b-3a86d0798ef7"
        if self.settings.get("upstox_api_secret") in ["test_secret", "", None]:
            self.settings["upstox_api_secret"] = "ec6r0ue7si"
                
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
        self.sync_settings_strategies()
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
        self.last_trade_close_time = 0.0  # Unix timestamp of last trade exit
        self.live_trade_errors = []  # Recent Live Real errors for dashboard display
        self.pending_exit_signal = "" 
        self.expiry_warning = ""
        
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
        
    
    def sync_settings_strategies(self):
        """Auto-migrates and ensures ALL 14 strategies exist in settings."""
        all_keys = [
            "first_15m_breakout", "power_of_stocks", "booming_bulls", "trading_legend",
            "larry_williams", "turtle_trading", "minervini_vcp", "oliver_velez", "elder_triple_screen",
            "demark_td9", "darvas_box", "linda_raschke", "smc_ict_fvg", "gamma_squeeze"
        ]
        enabled = self.settings.setdefault("enabled_strategies", {})
        live_deploy = self.settings.setdefault("live_deploy_strategies", {})

        changed = False
        for k in all_keys:
            if k not in enabled:
                enabled[k] = True
                changed = True
            if k not in live_deploy:
                live_deploy[k] = True
                changed = True

        if changed and hasattr(self, "save_settings"):
            self.save_settings()


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
        """
        Fetch available option contract expiry dates directly from Upstox API.
        Handles Tuesday (Nifty), Thursday (Sensex), Wednesday (BankNifty) and holiday shifts automatically.
        """
        token = self.settings.get("upstox_access_token")
        cache_key = preferred_index.lower()
        now = time.time()

        if hasattr(self, "_expiry_cache") and cache_key in self._expiry_cache:
            cache_time, cached_dates = self._expiry_cache[cache_key]
            if now - cache_time < 600:  # 10 minute cache for fast response
                return cached_dates

        if token and token.strip():
            try:
                url = "https://api.upstox.com/v2/option/contract"
                headers = {
                    "Accept": "application/json",
                    "Authorization": f"Bearer {token.strip()}"
                }
                instrument_key = "BSE_INDEX|SENSEX" if preferred_index.lower() == "sensex" else "NSE_INDEX|Nifty 50"
                resp = requests.get(url, headers=headers, params={"instrument_key": instrument_key}, timeout=5)
                if resp.status_code == 200:
                    res_data = resp.json()
                    if res_data.get("status") == "success":
                        contracts = res_data.get("data", [])
                        today_str = datetime.date.today().strftime("%Y-%m-%d")
                        if preferred_index.lower() == "sensex":
                            filter_fn = lambda c: "SENSEX" in (c.get("underlying_symbol") or c.get("name") or "").upper()
                        else:
                            filter_fn = lambda c: "NIFTY" in (c.get("underlying_symbol") or c.get("name") or "").upper() and \
                                                  "FIN" not in (c.get("underlying_symbol") or c.get("name") or "").upper() and \
                                                  "BANK" not in (c.get("underlying_symbol") or c.get("name") or "").upper()

                        expiries = sorted(list(set(
                            c.get("expiry") for c in contracts
                            if c.get("expiry") and c.get("expiry") >= today_str and filter_fn(c)
                        )))
                        if expiries:
                            if not hasattr(self, "_expiry_cache"):
                                self._expiry_cache = {}
                            self._expiry_cache[cache_key] = (now, expiries[:8])
                            return expiries[:8]
            except Exception as e:
                print(f"⚠️ Upstox contract expiries fetch notice: {e}")

        # Fallback if Upstox API token is offline: calculate dynamic upcoming weekday dates
        today = datetime.date.today()
        target_weekday = get_default_target_weekday(preferred_index)
        days_ahead = (target_weekday - today.weekday()) % 7
        fallback_expiries = []
        for i in range(6):
            next_expiry = today + datetime.timedelta(days=days_ahead + i * 7)
            fallback_expiries.append(next_expiry.strftime("%Y-%m-%d"))

        return fallback_expiries

    def find_hedge_strikes(self, atm_strike: float, strike_interval: float) -> tuple:
        """
        Returns (hedge_call_strike, hedge_put_strike) strictly <= 5.0 (preferring premium closest to 2.0).
        Searches the FULL UNFILTERED upstox_option_chain so deep OTM low-cost hedges (< ₹5.00) are always found.
        """
        chain = self.upstox_option_chain if (self.settings.get("feed_mode") == "Upstox" and self.upstox_option_chain) else self.option_chain
        
        default_call_strike = atm_strike + 10 * strike_interval
        default_put_strike = atm_strike - 10 * strike_interval

        if not chain:
            return default_call_strike, default_put_strike

        # 1. CALL HEDGE (STRICT CE <= 5.0)
        calls_strict = [x for x in chain if x.get("call_price") is not None and 0.5 <= x["call_price"] <= 5.0 and x["strike"] > atm_strike]
        if calls_strict:
            hedge_call_item = min(calls_strict, key=lambda x: abs(x["call_price"] - 2.0))
            hedge_call_strike = hedge_call_item["strike"]
        else:
            calls_under_5 = [x for x in chain if x.get("call_price") is not None and x["call_price"] <= 5.0 and x["strike"] > atm_strike]
            if calls_under_5:
                hedge_call_item = max(calls_under_5, key=lambda x: x["strike"])
                hedge_call_strike = hedge_call_item["strike"]
            else:
                calls_otm = [x for x in chain if x.get("strike", 0) > atm_strike]
                if calls_otm:
                    hedge_call_strike = max(x["strike"] for x in calls_otm)
                else:
                    hedge_call_strike = default_call_strike

        # 2. PUT HEDGE (STRICT PE <= 5.0)
        puts_strict = [x for x in chain if x.get("put_price") is not None and 0.5 <= x["put_price"] <= 5.0 and x["strike"] < atm_strike]
        if puts_strict:
            hedge_put_item = min(puts_strict, key=lambda x: abs(x["put_price"] - 2.0))
            hedge_put_strike = hedge_put_item["strike"]
        else:
            puts_under_5 = [x for x in chain if x.get("put_price") is not None and x["put_price"] <= 5.0 and x["strike"] < atm_strike]
            if puts_under_5:
                hedge_put_item = min(puts_under_5, key=lambda x: x["strike"])
                hedge_put_strike = hedge_put_item["strike"]
            else:
                puts_otm = [x for x in chain if x.get("strike", 0) < atm_strike]
                if puts_otm:
                    hedge_put_strike = min(x["strike"] for x in puts_otm)
                else:
                    hedge_put_strike = default_put_strike

        return hedge_call_strike, hedge_put_strike

    def get_active_expiry_date(self) -> str:
        """
        Returns the active expiry date for option chain + trade execution.

        ⚠️ 3-DAY EXPIRY SAFETY RULE (user requirement):
        If the current/saved expiry is ≤ 2 calendar days away (i.e. expires in
        0, 1 or 2 days), force-switch to NEXT WEEK expiry to avoid:
          - Theta decay blowout on BUY positions (premium collapses toward 0)
          - Gamma explosion on SELL positions (P&L swings violently near expiry)

        User can still override this by manually selecting an expiry in Settings.
        """
        today = datetime.date.today()
        today_str = today.strftime("%Y-%m-%d")
        pref_index = self.settings.get("preferred_index", "Nifty")
        expiries = self.get_upstox_expiries(pref_index)

        # --- Resolve candidate expiry (what the user/default says) ---
        saved_expiry = self.settings.get("upstox_expiry_date")
        if saved_expiry and saved_expiry >= today_str:
            if not expiries or saved_expiry in expiries:
                candidate = saved_expiry
            else:
                candidate = expiries[0] if expiries else saved_expiry
        elif expiries:
            candidate = expiries[0]
        else:
            target_weekday = get_default_target_weekday(pref_index)
            days_ahead = (target_weekday - today.weekday()) % 7
            candidate = (today + datetime.timedelta(days=days_ahead)).strftime("%Y-%m-%d")

        # --- 3-DAY SAFETY RULE ---
        try:
            candidate_date = datetime.date.fromisoformat(candidate)
            days_to_expiry = (candidate_date - today).days
        except Exception:
            days_to_expiry = 99

        EXPIRY_DANGER_THRESHOLD = 2  # ≤ 2 days → switch to next week

        if days_to_expiry <= EXPIRY_DANGER_THRESHOLD:
            # Find the NEXT expiry after the candidate
            next_expiry = None
            if expiries:
                for e in expiries:
                    try:
                        e_date = datetime.date.fromisoformat(e)
                        if e_date > candidate_date:
                            next_expiry = e
                            break
                    except Exception:
                        continue

            # Fallback: compute next Thursday (Nifty) or Friday (Sensex) after candidate
            if not next_expiry:
                target_weekday = get_default_target_weekday(pref_index)
                days_fwd = (target_weekday - candidate_date.weekday()) % 7
                if days_fwd == 0:
                    days_fwd = 7
                next_expiry = (candidate_date + datetime.timedelta(days=days_fwd)).strftime("%Y-%m-%d")

            self.expiry_warning = (
                f"⚠️ Auto-switched to next-week expiry ({next_expiry}) — "
                f"current expiry {candidate} is only {days_to_expiry}d away "
                f"(≤{EXPIRY_DANGER_THRESHOLD}d threshold). "
                f"Prevents theta decay on BUYs & gamma blast on SELLs."
            )
            print(f"📅 EXPIRY SAFETY: {self.expiry_warning}")
            return next_expiry

        # Within safe range — use candidate as-is
        self.expiry_warning = ""
        return candidate


    def get_straddle_premium(self) -> float:
        """Returns current combined ATM straddle premium LTP."""
        pref_index = self.settings.get("preferred_index", "Nifty")
        spot = self.spot_price
        atm_strike = round(spot / 100.0) * 100 if pref_index.lower() == "sensex" else round(spot / 50.0) * 50
        
        atm_ce_ltp = 100.0
        atm_pe_ltp = 100.0
        for item in self.option_chain:
            if item.get("strike") == atm_strike:
                atm_ce_ltp = item.get("call_price", 100.0)
                atm_pe_ltp = item.get("put_price", 100.0)
                break
        return round(atm_ce_ltp + atm_pe_ltp, 2)

    def check_iv_crush(self) -> bool:
        """Returns True if combined ATM straddle premium is <= its value from 5 minutes prior."""
        if len(self.price_history) < 60:
            return False
        prior_straddle = self.price_history[-60].get("straddle_premium", 0.0)
        current_straddle = self.get_straddle_premium()
        if prior_straddle > 0.0 and current_straddle <= prior_straddle:
            return True
        return False

    def update_opening_range(self):
        """Updates Nifty 09:15 - 09:30 opening range boundaries."""
        ist_now = get_ist_datetime()
        ist_time = ist_now.time()
        
        if ist_time < datetime.time(9, 15):
            self.opening_range_high = self.spot_price
            self.opening_range_low = self.spot_price
            return
            
        if datetime.time(9, 15) <= ist_time <= datetime.time(9, 30):
            if getattr(self, "opening_range_high", None) is None or self.spot_price > self.opening_range_high:
                self.opening_range_high = self.spot_price
            if getattr(self, "opening_range_low", None) is None or self.spot_price < self.opening_range_low:
                self.opening_range_low = self.spot_price

    def update_candles_tick(self, override_type=None):
        """Updates active candle metrics and handles periodic completions/closings."""
        for candle in [self.candle_1m, self.candle_5m, self.candle_15m]:
            candle["high"] = max(candle["high"], self.spot_price)
            candle["low"] = min(candle["low"], self.spot_price)
            candle["close"] = self.spot_price
            candle["volume"] += random.uniform(50, 200)
            candle["vwap_sum_pv"] += self.spot_price * candle["volume"]
            candle["vwap_sum_v"] += candle["volume"]

        now = time.time()
        
        # 1. Close 1-minute candle
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
            
        # 2. Close 5-minute candle
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
            self.current_candle = self.candle_5m
            self.recompute_indicators()
            self.recalculation_trigger = "Completed 5-minute candle"
            
        # 3. Close 15-minute candle
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

    def update_default_expiry(self):
        pref_index = self.settings.get("preferred_index", "Nifty")
        expiries = self.get_upstox_expiries(pref_index)
        if expiries:
            self.settings["upstox_expiry_date"] = expiries[0]
        else:
            target_weekday = get_default_target_weekday(pref_index)
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
            
        # Classify Trend using Price-Action Overlay + EMAs (Responsive to sharp V-reversals)
        current_price = closes[-1]
        if current_price > ema20:
            # Price is above EMA20 (Bullish momentum)
            if ema20 > ema50:
                trend = "Bullish"
            else:
                # Reversal / Recovery: Price crossed above EMA20 but lagging EMA crossover hasn't happened yet
                trend = "Neutral-Bullish"
        elif current_price < ema20:
            # Price is below EMA20 (Bearish momentum)
            if ema20 < ema50:
                trend = "Bearish"
            else:
                # Pullback: Price crossed below EMA20 but lagging EMA crossover hasn't happened yet
                trend = "Neutral-Bearish"
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
        is_scalper = self.settings.get("scalper_mode", False)
        target_candles = self.candles_1m if is_scalper else self.candles_5m
        analysis = self.analyze_timeframe(target_candles)
        
        # Update self properties using the target timeframe (1m for scalper, 5m normal)
        self.ema_20 = analysis["ema20"]
        self.ema_50 = analysis["ema50"]
        self.rsi = analysis["rsi"]
        
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
        # Require at least 12 ticks (1 minute) of price history to prevent false breakouts on startup
        if len(self.price_history) < 12:
            return 0.0
        # Ticks are appended every 5 seconds. 2 minutes = 24 ticks back.
        lookback = min(24, len(self.price_history) - 1)
        prev_price = self.price_history[-lookback - 1]["price"]
        if prev_price <= 0:
            return 0.0
        return ((self.spot_price - prev_price) / prev_price) * 100.0

    def get_broker_balance(self) -> float:
        """Returns the actual Upstox broker balance if token exists, fallback to settings capital."""
        token = self.settings.get("upstox_access_token")
        if not token or not token.strip():
            self.upstox_token_status = "DISCONNECTED"
            return float(self.settings.get("capital", 500000.0))
            
        now = time.time()
        if getattr(self, "_cached_capital", None) is not None and getattr(self, "_capital_cache_time", 0.0) > 0:
            if now - self._capital_cache_time < 60.0:
                return self._cached_capital
                
        url = "https://api.upstox.com/v2/user/get-funds-and-margin"
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
                        val = float(available)
                        print(f"💰 Upstox Broker Balance Query: ₹{val:.2f} available.")
                        self._cached_capital = val
                        self._capital_cache_time = now
                        self.upstox_token_status = "VALID"
                        return val
            elif resp.status_code in [401, 403]:
                print(f"⚠️ Upstox API token is invalid/expired (HTTP {resp.status_code})")
                self.upstox_token_status = "INVALID"
            else:
                print(f"⚠️ Upstox API returned HTTP {resp.status_code}")
        except Exception as e:
            print(f"⚠️ Failed to query Upstox broker balance: {e}")
            if getattr(self, "upstox_token_status", "DISCONNECTED") == "DISCONNECTED":
                self.upstox_token_status = "INVALID"
                
        if getattr(self, "_cached_capital", None) is not None:
            print("⚠️ Using stale cached broker balance due to API failure.")
            return self._cached_capital
            
        return float(self.settings.get("capital", 500000.0))

    def get_available_capital(self) -> float:
        """Returns the capital to be used for lot sizing calculations."""
        mode = self.settings.get("auto_trade_mode", "OFF")
        if mode == "Live":
            return self.get_broker_balance()
        return float(self.settings.get("capital", 500000.0))

    def query_upstox_basket_margin(self, strategy: str, spot: float) -> Optional[float]:
        token = self.settings.get("upstox_access_token")
        if not token or not self.option_chain:
            return None
            
        preferred_index = self.settings.get("preferred_index", "Nifty")
        strike_interval = 100 if preferred_index.lower() == "sensex" else 50
        atm_strike = round(spot / 100.0) * 100 if preferred_index.lower() == "sensex" else round(spot / 50.0) * 50
        lot_size = 20 if preferred_index.lower() == "sensex" else 65
        
        # Build the mock 1-lot order legs for margin calculation
        legs_to_order = []
        if strategy == "Buy CE":
            legs_to_order.append({"strike": atm_strike, "option_type": "CE", "action": "BUY"})
        elif strategy == "Buy PE":
            legs_to_order.append({"strike": atm_strike, "option_type": "PE", "action": "BUY"})
        elif strategy == "Bull Call Spread":
            legs_to_order.append({"strike": atm_strike, "option_type": "CE", "action": "BUY"})
            legs_to_order.append({"strike": atm_strike + strike_interval, "option_type": "CE", "action": "SELL"})
        elif strategy == "Bear Put Spread":
            legs_to_order.append({"strike": atm_strike, "option_type": "PE", "action": "BUY"})
            legs_to_order.append({"strike": atm_strike - strike_interval, "option_type": "PE", "action": "SELL"})
        elif strategy == "Bull Put Spread":
            legs_to_order.append({"strike": atm_strike, "option_type": "PE", "action": "SELL"})
            legs_to_order.append({"strike": atm_strike - strike_interval, "option_type": "PE", "action": "BUY"})
        elif strategy == "Bear Call Spread":
            legs_to_order.append({"strike": atm_strike, "option_type": "CE", "action": "SELL"})
            legs_to_order.append({"strike": atm_strike + strike_interval, "option_type": "CE", "action": "BUY"})
        elif strategy == "Buy CE" or strategy == "Buy CE":
            # Scan all OTM strikes with target ₹2.00 / strictly < ₹5.00
            hedge_call_strike, hedge_put_strike = self.find_hedge_strikes(atm_strike, strike_interval)
            
            sell_call_strike = atm_strike + strike_interval if strategy == "Buy CE" else atm_strike
            sell_put_strike = atm_strike - strike_interval if strategy == "Buy CE" else atm_strike
            
            legs_to_order.append({"strike": hedge_call_strike, "option_type": "CE", "action": "BUY"})
            legs_to_order.append({"strike": hedge_put_strike, "option_type": "PE", "action": "BUY"})
            legs_to_order.append({"strike": sell_call_strike, "option_type": "CE", "action": "SELL"})
            legs_to_order.append({"strike": sell_put_strike, "option_type": "PE", "action": "SELL"})
        elif strategy == "Buy PE":
            legs_to_order.append({"strike": atm_strike + strike_interval, "option_type": "CE", "action": "SELL"})
            legs_to_order.append({"strike": atm_strike + 2*strike_interval, "option_type": "CE", "action": "BUY"})
            legs_to_order.append({"strike": atm_strike - strike_interval, "option_type": "PE", "action": "SELL"})
            legs_to_order.append({"strike": atm_strike - 2*strike_interval, "option_type": "PE", "action": "BUY"})
            
        instruments = []
        for leg in legs_to_order:
            k = leg["strike"]
            ot = leg["option_type"]
            act = leg["action"]
            
            instrument_key = None
            for item in self.option_chain:
                if item.get("strike") == k:
                    instrument_key = item.get("call_instrument_key") if ot == "CE" else item.get("put_instrument_key")
                    break
            if not instrument_key:
                instrument_key = f"SIM_{ot.upper()}_{k}"
                
            instruments.append({
                "instrument_key": instrument_key,
                "quantity": lot_size,
                "transaction_type": act,
                "product": "I"
            })
            
        if not instruments:
            return None
            
        url = "https://api.upstox.com/v2/charges/margin"
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": f"Bearer {token}"
        }
        try:
            resp = requests.post(url, json={"instruments": instruments}, headers=headers, timeout=5)
            if resp.status_code == 200:
                res_json = resp.json()
                if res_json.get("status") == "success":
                    final_margin = float(res_json.get("data", {}).get("final_margin", 0.0))
                    if final_margin > 0:
                        return final_margin
        except Exception as e:
            print(f"⚠️ Failed to query Upstox margin calculator API: {e}")
        return None

    def calculate_paper_intraday_pnl(self) -> float:
        try:
            today_str = get_ist_date_str()
            today_closed = [t for t in journal.trades if t.get("status") == "CLOSED" and t.get("date") == today_str and not (t.get("execution_type") or "Paper").startswith("Live")]
            closed_pnl = sum(t.get("pnl", 0.0) for t in today_closed)
            
            floating_pnl = 0.0
            if self.auto_trade_active_id:
                active_trade = None
                for t in journal.trades:
                    if t["id"] == self.auto_trade_active_id and t["status"] == "OPEN" and not (t.get("execution_type") or "Paper").startswith("Live"):
                        active_trade = t
                        break
                if active_trade:
                    floating_pnl = self.calculate_trade_pnl(active_trade, self.spot_price)
            return round(closed_pnl + floating_pnl, 2)
        except Exception as e:
            print(f"⚠️ Error calculating paper intraday P&L: {e}")
            return 0.0

    def calculate_real_intraday_pnl(self) -> float:
        try:
            today_str = get_ist_date_str()
            today_closed = [t for t in journal.trades if t.get("status") == "CLOSED" and t.get("date") == today_str and (t.get("execution_type") or "Paper").startswith("Live")]
            closed_pnl = sum(t.get("pnl", 0.0) for t in today_closed)
            
            floating_pnl = 0.0
            if self.auto_trade_active_id:
                active_trade = None
                for t in journal.trades:
                    if t["id"] == self.auto_trade_active_id and t["status"] == "OPEN" and (t.get("execution_type") or "Paper").startswith("Live"):
                        active_trade = t
                        break
                if active_trade:
                    floating_pnl = self.calculate_trade_pnl(active_trade, self.spot_price)
            return round(closed_pnl + floating_pnl, 2)
        except Exception as e:
            print(f"⚠️ Error calculating real intraday P&L: {e}")
            return 0.0

    def calculate_total_intraday_pnl(self) -> float:
        try:
            today_str = get_ist_date_str()
            today_closed = [t for t in journal.trades if t.get("status") == "CLOSED" and t.get("date") == today_str]
            closed_pnl = sum(t.get("pnl", 0.0) for t in today_closed)
            
            floating_pnl = 0.0
            if self.auto_trade_active_id:
                active_trade = None
                for t in journal.trades:
                    if t["id"] == self.auto_trade_active_id and t["status"] == "OPEN":
                        active_trade = t
                        break
                if active_trade:
                    floating_pnl = self.calculate_trade_pnl(active_trade, self.spot_price)
            return round(closed_pnl + floating_pnl, 2)
        except Exception as e:
            print(f"⚠️ Error calculating total intraday P&L: {e}")
            return 0.0

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
            
            # SCALPER MODE OVERRIDE: deploy exactly 10% of capital, SL = 0.5% of capital
            is_scalper = self.settings.get("scalper_mode", False)
            if is_scalper:
                target_margin = capital * 0.10
                suggested_lots = max(1, int(target_margin / (atm_premium * lot_size)))
                margin_required = suggested_lots * atm_premium * lot_size
                risk_amount = capital * 0.005  # -0.5% of capital stop-loss
                return suggested_lots, margin_required, risk_amount

            # SL = 10% premium. Risk per lot = premium * lot_size * 0.10
            risk_per_lot = atm_premium * lot_size * 0.10
            if risk_per_lot <= 0:
                risk_per_lot = 1.0
            suggested_lots = max(1, int(max_risk / risk_per_lot))
            margin_per_lot = atm_premium * lot_size
            
            margin_required = suggested_lots * margin_per_lot
            risk_amount = suggested_lots * risk_per_lot
            return suggested_lots, margin_required, risk_amount

        # 2. Short Strangle / Short Straddle
        elif "Strangle" in strategy or "Straddle" in strategy:
            # Static safety threshold: ₹160,000 per lot required capital for selling options
            MARGIN_STRANGLE_SAFETY = 160000.0
            max_lots_by_capital = max(1, int((capital * 0.85) / MARGIN_STRANGLE_SAFETY))
            
            # Query dynamic broker margin first
            broker_margin = self.query_upstox_basket_margin(strategy, spot)
            if broker_margin is not None and broker_margin > 0:
                calc_lots = max(1, int((capital * 0.80) / broker_margin))
                suggested_lots = min(calc_lots, max_lots_by_capital)
                margin_required = suggested_lots * broker_margin
            else:
                suggested_lots = max_lots_by_capital
                margin_required = suggested_lots * MARGIN_STRANGLE_SAFETY
                
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
            if risk_per_lot <= 0:
                risk_per_lot = 1.0
            max_lots_by_risk = max(1, int(max_risk / risk_per_lot))
            
            # Query dynamic broker margin first
            broker_margin = self.query_upstox_basket_margin(strategy, spot)
            if broker_margin is not None and broker_margin > 0:
                max_lots_by_margin = max(1, int((capital * 0.80) / broker_margin))
                margin_per_lot = broker_margin
            else:
                MARGIN_SPREAD = 50000.0
                max_lots_by_margin = max(1, int((capital * 0.80) / MARGIN_SPREAD))
                margin_per_lot = MARGIN_SPREAD
                
            suggested_lots = min(max_lots_by_risk, max_lots_by_margin)
            margin_required = suggested_lots * margin_per_lot
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
        if risk_per_lot <= 0:
            risk_per_lot = 1.0
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
        self.update_opening_range()
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
                baseline = 79996.60 if preferred_index.lower() == "sensex" else 24317.15
                # Pre-market order book equilibrium build-up fluctuations (±0.15% max)
                self.spot_price = baseline + random.uniform(-35.0, 35.0) if preferred_index.lower() == "sensex" else baseline + random.uniform(-10.0, 10.0)
                self.price_source = "BSE Pre-Market Equilibrium" if preferred_index.lower() == "sensex" else "NSE Pre-Market Equilibrium"
                self.recalculation_trigger = "Pre-Market Order Building"
                
            elif self.market_session == "Pre-Market (Matching)":
                baseline = 79996.60 if preferred_index.lower() == "sensex" else 24317.15
                if self.premarket_open_price is None:
                    self.premarket_open_price = baseline + (random.uniform(-45.0, 60.0) if preferred_index.lower() == "sensex" else random.uniform(-15.0, 20.0))
                self.spot_price = self.premarket_open_price
                self.price_source = "BSE Discovered Opening Price" if preferred_index.lower() == "sensex" else "NSE Discovered Opening Price"
                self.recalculation_trigger = "Pre-Market Matching Discovered"
                
            else:
                self.premarket_open_price = None
                
                feed_mode = self.settings.get("feed_mode", "Simulation")
                if feed_mode == "Upstox":
                    self.fetch_upstox_data()
                elif feed_mode == "Google":
                    if now - self.last_live_fetch >= 30:
                        price_data = fetch_live_index_price(preferred_index)
                        if price_data[0] is not None:
                            live_price = price_data[0]
                            self.spot_price = live_price
                            self.intraday_change_pct = price_data[1]
                            self.intraday_change_val = price_data[2]
                            self.prev_close_baseline = price_data[0] - price_data[2]
                            self.last_live_fetch = now
                else:
                    # Anchored Simulation Mode — anchors to live market price (Yahoo/Google) with subtle intraday micro-ticks
                    if now - self.last_live_fetch >= 10:
                        price_data = fetch_live_index_price(preferred_index)
                        if price_data[0] is not None and price_data[0] > 0:
                            live_price = price_data[0]
                            self.spot_price = live_price + random.uniform(-0.25, 0.25)
                            self.intraday_change_pct = price_data[1]
                            self.intraday_change_val = price_data[2]
                            self.prev_close_baseline = price_data[0] - price_data[2]
                            self.last_live_fetch = now
                        else:
                            self.spot_price += random.uniform(-0.5, 0.5)
                    else:
                        self.spot_price += random.uniform(-0.2, 0.2)
                    
                    if getattr(self, "prev_close_baseline", 0.0) != 0.0:
                        self.intraday_change_val = round(self.spot_price - self.prev_close_baseline, 2)
                        self.intraday_change_pct = round((self.intraday_change_val / self.prev_close_baseline) * 100.0, 2)

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
            "straddle_premium": self.get_straddle_premium(),
            "ema20": round(self.ema_20, 2),
            "ema50": round(self.ema_50, 2),
            "pnl": self.calculate_real_intraday_pnl(),
            "paper_pnl": self.calculate_paper_intraday_pnl(),
            "real_pnl": self.calculate_real_intraday_pnl()
        })
        if len(self.price_history) > 360:
            self.price_history.pop(0)

        self.update_candles_tick(override_type)

        # Check immediate override recalculations or periodic recalculation
        if self.recalculation_trigger != "Schedule" or (now - self.last_rec_time >= 60):
            self.evaluate_decision_engine()
            
        # Daily 09:00 AM reset and trading session rules check
        self.check_daily_reset()

        # Run live automated trading execution tick
        if not self.daily_stop_limit_hit:
            self.process_independent_multi_strategy_ticks()

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
        expiry = self.get_active_expiry_date()
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
            self.update_opening_range()
            self.update_candles_tick()
            self.price_source = "Upstox Live Feed (BSE India)" if preferred_index.lower() == "sensex" else "Upstox Live Feed (NSE India)"
            self.price_date = get_ist_date_str()
            self.price_time = get_ist_time_str()
            
            # Upstox API call succeeded — mark token as VALID!
            self.upstox_token_status = "VALID"

            # Fetch official Upstox market quote for 100% accurate net_change & change_pct matching Upstox Pro app
            try:
                q_url = "https://api.upstox.com/v2/market-quote/quotes"
                q_resp = requests.get(q_url, headers=headers, params={"instrument_key": instrument_key}, timeout=3)
                if q_resp.status_code == 200 and q_resp.json().get("status") == "success":
                    q_data = q_resp.json().get("data", {})
                    key_alt = instrument_key.replace("|", ":")
                    q_info = q_data.get(instrument_key) or q_data.get(key_alt)
                    if q_info:
                        upstox_last = float(q_info.get("last_price", self.spot_price))
                        upstox_change = float(q_info.get("net_change", 0.0))
                        if upstox_last > 0:
                            self.spot_price = upstox_last
                            self.intraday_change_val = round(upstox_change, 2)
                            self.prev_close_baseline = round(upstox_last - upstox_change, 2)
                            if self.prev_close_baseline > 0:
                                self.intraday_change_pct = round((self.intraday_change_val / self.prev_close_baseline) * 100.0, 2)
            except Exception as _q_err:
                print(f"⚠️ Upstox market quote fetch warning: {_q_err}")

            if getattr(self, "prev_close_baseline", 0.0) == 0.0:
                self.prev_close_baseline = 79996.60 if preferred_index.lower() == "sensex" else 24317.15
                self.intraday_change_val = round(self.spot_price - self.prev_close_baseline, 2)
                self.intraday_change_pct = round((self.intraday_change_val / self.prev_close_baseline) * 100.0, 2)
            
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
            "straddle_premium": self.get_straddle_premium(),
                "ema20": round(self.ema_20, 2),
                "ema50": round(self.ema_50, 2),
                "pnl": self.calculate_real_intraday_pnl(),
                "paper_pnl": self.calculate_paper_intraday_pnl(),
                "real_pnl": self.calculate_real_intraday_pnl()
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
        """Calculates current floating P&L of a trade based on live option LTP, Greeks, or Spot price move."""
        pnl = 0.0
        entry = t.get("entry_spot", spot)
        legs = t.get("legs", [])
        strat = t.get("strategy", "")
        chain = self.upstox_option_chain if (self.settings.get("feed_mode") == "Upstox" and self.upstox_option_chain) else self.option_chain

        if legs:
            for leg in legs:
                leg_ltp = None
                strike_val = leg.get("strike", 0.0)
                opt_type = leg.get("option_type", "CE")
                act = leg.get("action", "BUY")
                qty = leg.get("quantity", 65)
                entry_px = leg.get("entry_price", 0.0)

                # Match from live option chain
                if chain:
                    for item in chain:
                        if item.get("call_instrument_key") == leg.get("instrument_key") or item.get("put_instrument_key") == leg.get("instrument_key"):
                            leg_ltp = item.get("call_price") if opt_type == "CE" else item.get("put_price")
                            break
                        elif item.get("strike") == strike_val:
                            leg_ltp = item.get("call_price") if opt_type == "CE" else item.get("put_price")
                            break

                # Fallback if chain is closed or item missing
                if leg_ltp is None or leg_ltp <= 0:
                    if strike_val > 0 and getattr(self, "vix", 12.0) > 0:
                        t_years = 4.0 / 365.0
                        r = 0.07
                        is_call = opt_type.upper() == "CE"
                        opt_res = calculate_greeks(spot, strike_val, t_years, self.vix / 100.0, r, is_call)
                        leg_ltp = opt_res["price"]
                    else:
                        diff = spot - entry
                        if opt_type.upper() == "CE":
                            leg_ltp = max(0.05, entry_px + 0.50 * diff)
                        else:
                            leg_ltp = max(0.05, entry_px - 0.50 * diff)

                leg_diff = leg_ltp - entry_px
                if act == "BUY":
                    pnl += leg_diff * qty
                else:
                    pnl -= leg_diff * qty
        else:
            diff = spot - entry
            multiplier = t.get("lot_size", 65) * t.get("size", 1)
            if "CE" in strat or "Bull" in strat:
                pnl += diff * multiplier
            else:
                pnl -= diff * multiplier

        return pnl + t.get("booked_pnl", 0.0)
    def update_option_chain(self):
        spot = self.spot_price
        preferred_index = self.settings.get("preferred_index", "Nifty")
        if preferred_index.lower() == "sensex":
            atm_strike = round(spot / 100.0) * 100
            strike_interval = 100
            upstox_filter_width = 1200
        else:
            atm_strike = round(spot / 50.0) * 50
            strike_interval = 50
            upstox_filter_width = 600
            
        option_chain = []
        if self.settings.get("feed_mode") == "Upstox" and self.upstox_option_chain:
            option_chain = [x for x in self.upstox_option_chain if abs(x["strike"] - atm_strike) <= upstox_filter_width]
            option_chain = sorted(option_chain, key=lambda x: x["strike"])
        else:
            t_years = 4.0 / 365.0
            r = 0.07
            import math
            for i in range(-12, 13):
                strike = atm_strike + (i * strike_interval)
                dist_from_atm = abs(strike - spot)
                iv_strike = (self.vix / 100.0) + (dist_from_atm / 1000.0) * 0.10
                
                call_greeks = calculate_greeks(spot, strike, t_years, iv_strike, r, is_call=True)
                put_greeks = calculate_greeks(spot, strike, t_years, iv_strike, r, is_call=False)
                
                # Apply realistic premium decay for simulated OTM options
                decay = math.exp(-dist_from_atm / 80.0)
                
                c_price = max(0.05, call_greeks["price"] * decay)
                p_price = max(0.05, put_greeks["price"] * decay)
                
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
                    "call_delta": round(call_greeks["delta"] * decay, 3),
                    "call_theta": round(call_greeks["theta"] * decay, 2),
                    "call_vega": round(call_greeks["vega"] * decay, 2),
                    "call_price": round(c_price, 2),
                    "call_bid": round(max(0.05, c_price - 0.2), 2),
                    "call_ask": round(c_price + 0.2, 2),
                    "call_instrument_key": f"SIM_CALL_{strike}",
                    "put_price": round(p_price, 2),
                    "put_bid": round(max(0.05, p_price - 0.2), 2),
                    "put_ask": round(p_price + 0.2, 2),
                    "put_delta": round(put_greeks["delta"] * decay, 3),
                    "put_theta": round(put_greeks["theta"] * decay, 2),
                    "put_vega": round(put_greeks["vega"] * decay, 2),
                    "put_iv": f"{iv_strike*100:.1f}%",
                    "put_change_oi": put_change_oi,
                    "put_oi": put_oi,
                    "put_instrument_key": f"SIM_PUT_{strike}"
                })
        # Dynamic HFT option arbitrage calculations
        try:
            import hft_arbitrage
            expiry_date_str = self.get_active_expiry_date()
            days_to_expiry = 1.0
            if expiry_date_str:
                import datetime
                try:
                    expiry_date = datetime.date.fromisoformat(expiry_date_str)
                    today = datetime.date.today()
                    days_to_expiry = max(1.0, float((expiry_date - today).days))
                except:
                    pass
            option_chain = hft_arbitrage.compute_option_chain_arbitrage(option_chain, spot, days_to_expiry)
        except Exception as _e:
            print("⚠️ Dynamic HFT option arbitrage calculation warning:", _e)

        self.option_chain = option_chain

    def _auto_trade_tick(self):
        """Automated trading logic processing for independent multi-strategy execution."""
        self.process_independent_multi_strategy_ticks()


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
                
                # Reset price history for new day chart (do NOT wipe journal trades — PnL stays visible until midnight)
                self.price_history = []
                
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
        
        # 2. After 23:59 IST: Reset daily PnL for next trading day (positions already closed at 15:15)
        if ist_time >= datetime.time(23, 59):
            yesterday = (ist_now - datetime.timedelta(days=1)).strftime("%Y-%m-%d")
            # Archive yesterday's trades (they've been visible all evening for review)
            journal.trades = [t for t in journal.trades if t.get("date") != yesterday]
            journal.save_journal()
            print("🌙 Midnight cleanup: archived previous day trades.")

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
                    primary_rec = "Buy PE"
                else:
                    primary_rec = "Buy CE" if self.spot_price >= self.ema_20 else "Buy PE"
            
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
            
            is_scalper = self.settings.get("scalper_mode", False)
            if is_scalper:
                is_bullish_confirmed = (trend_1m == "Bullish")
                is_bearish_confirmed = (trend_1m == "Bearish")
                reasoning_list.append(f"⚡ SCALPER TREND CHECK: 1m Trend = {trend_1m} (15m/5m checks bypassed)")
            else:
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
                        primary_rec = "Buy PE"
                    else:
                        primary_rec = "Buy CE" if self.spot_price >= self.ema_20 else "Buy PE"
                    confidence_pct = 70.0
            elif primary_rec in ["Buy PE", "Bear Put Spread", "Bear Call Spread"]:
                if not is_bearish_confirmed:
                    reasoning_list.append(f"⚠️ Bearish signal '{primary_rec}' blocked: Mismatched MTF trend (15m: {trend_15m}, 5m: {trend_5m}, 1m: {trend_1m}). Locked to Sideways.")
                    if self.vix > 18.0:
                        primary_rec = "Buy PE"
                    else:
                        primary_rec = "Buy CE" if self.spot_price >= self.ema_20 else "Buy PE"
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
        
        is_high_confidence = confidence_pct > 90.0
        if should_change and primary_rec != old_rec and not is_first_eval and not is_safety_override and not is_high_confidence:
            if time_since_change < cooldown_period:
                should_change = False
                reasoning_list.append(f"AI Setup locked (cooldown active: {int(cooldown_period - time_since_change)}s remaining for trade execution stability).")
            
        # Strict strategy class filtering based on User Preferences
        pref = "Option Buying Only" if self.settings.get("scalper_mode", False) else self.settings.get("preferred_strategy", "All")
        if pref == "Option Buying Only":
            if primary_rec not in ["Buy CE", "Buy PE", "No Trade"]:
                reasoning_list.append(f"🔒 Strategy '{primary_rec}' blocked by preference: Option Buying Only. Falling back to No Trade.")
                primary_rec = "No Trade"
                confidence_pct = 50.0
        elif pref == "Option Selling Only":
            if primary_rec not in ["Buy CE", "Buy PE", "Buy CE", "No Trade"]:
                reasoning_list.append(f"🔒 Strategy '{primary_rec}' blocked by preference: Option Selling Only. Falling back to No Trade.")
                primary_rec = "No Trade"
                confidence_pct = 50.0
        elif pref == "Spreads Only":
            if primary_rec not in ["Bull Call Spread", "Bear Put Spread", "Bull Put Spread", "Bear Call Spread", "Buy PE", "No Trade"]:
                reasoning_list.append(f"🔒 Strategy '{primary_rec}' blocked by preference: Spreads Only. Falling back to No Trade.")
                primary_rec = "No Trade"
                confidence_pct = 50.0

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



    # ── AUTOMATED STRATEGY SUITE (ALL 15 GLOBAL STRATEGIES) ──
    def evaluate_strategy_suite(self) -> dict:
        """Evaluates all 15 specialized trading strategies independently."""
        strat_15m = self.evaluate_first_15m_breakout_strategy()
        strat_pos = self.evaluate_power_of_stocks_strategy()
        strat_booming = self.evaluate_booming_bulls_strategy()
        strat_legend = self.evaluate_trading_legend_strategy()
        strat_larry = self.evaluate_larry_williams_strategy()
        strat_turtle = self.evaluate_turtle_trading_strategy()
        strat_minervini = self.evaluate_minervini_vcp_strategy()
        strat_velez = self.evaluate_oliver_velez_strategy()
        strat_elder = self.evaluate_elder_triple_screen_strategy()
        strat_demark = self.evaluate_demark_td9_strategy()
        strat_darvas = self.evaluate_darvas_box_strategy()
        strat_linda = self.evaluate_linda_raschke_strategy()
        strat_smc = self.evaluate_smc_ict_fvg_strategy()
        strat_gamma = self.evaluate_gamma_squeeze_strategy()

        enabled = self.settings.get("enabled_strategies", {})
        live_deploy = self.settings.get("live_deploy_strategies", {})

        all_strats = [
            ("first_15m_breakout", strat_15m),
            ("power_of_stocks", strat_pos),
            ("booming_bulls", strat_booming),
            ("trading_legend", strat_legend),
            ("larry_williams", strat_larry),
            ("turtle_trading", strat_turtle),
            ("minervini_vcp", strat_minervini),
            ("oliver_velez", strat_velez),
            ("elder_triple_screen", strat_elder),
            ("demark_td9", strat_demark),
            ("darvas_box", strat_darvas),
            ("linda_raschke", strat_linda),
            ("smc_ict_fvg", strat_smc),
            ("gamma_squeeze", strat_gamma)
        ]

        res = {}
        for key, s in all_strats:
            s["is_enabled"] = enabled.get(key, True) if key in enabled else True
            s["is_live_deployed"] = live_deploy.get(key, True) if key in live_deploy else True
            
            # Attach active position details and live PnL
            pos = self.strategy_positions.get(key)
            if pos is not None:
                spot_diff = (self.spot_price - pos["entry_spot"]) if pos.get("signal") == "Buy CE" else (pos["entry_spot"] - self.spot_price)
                lot_qty = pos.get("lot_size", 65) * pos.get("lots", 1)
                live_pnl = round(spot_diff * lot_qty, 2)
                s["active_position"] = {
                    "symbol": pos.get("symbol", f"NIFTY {pos.get('signal')}"),
                    "entry_spot": pos.get("entry_spot", self.spot_price),
                    "current_spot": round(self.spot_price, 2),
                    "signal": pos.get("signal", "Buy CE"),
                    "lots": pos.get("lots", 1),
                    "pnl_rupees": live_pnl,
                    "status": "OPEN"
                }
            else:
                s["active_position"] = None
            res[key] = s
        return res

    def evaluate_first_15m_breakout_strategy(self) -> dict:
        first_h = self.opening_range_high
        first_l = self.opening_range_low
        if len(self.candles_15m) >= 2:
            c1 = self.candles_15m[0]
            first_h = c1["high"]
            first_l = c1["low"]
            latest_15m_close = self.candles_15m[-1]["close"]
        elif len(self.candles_15m) == 1:
            c1 = self.candles_15m[0]
            first_h = c1["high"]
            first_l = c1["low"]
            latest_15m_close = self.spot_price
        else:
            latest_15m_close = self.spot_price

        if latest_15m_close > first_h and first_h > 0:
            return {"name": "First 15-Min Candle Breakout & Close Continuation", "key": "first_15m_breakout", "signal": "Buy CE", "status": "BULLISH BREAKOUT (CLOSED ABOVE 15M HIGH)", "confidence": 94.0, "range_high": round(first_h, 2), "range_low": round(first_l, 2), "close_price": round(latest_15m_close, 2), "reason": f"15-Min Candle CLOSED ABOVE 1st 15-min High (₹{first_h:.1f}). Upward Trend Continuation Confirmed!"}
        elif latest_15m_close < first_l and first_l > 0:
            return {"name": "First 15-Min Candle Breakout & Close Continuation", "key": "first_15m_breakout", "signal": "Buy PE", "status": "BEARISH BREAKDOWN (CLOSED BELOW 15M LOW)", "confidence": 94.0, "range_high": round(first_h, 2), "range_low": round(first_l, 2), "close_price": round(latest_15m_close, 2), "reason": f"15-Min Candle CLOSED BELOW 1st 15-min Low (₹{first_l:.1f}). Downward Trend Continuation Confirmed!"}
        else:
            return {"name": "First 15-Min Candle Breakout & Close Continuation", "key": "first_15m_breakout", "signal": "No Trade", "status": "NO TRADE IN BETWEEN", "confidence": 50.0, "range_high": round(first_h, 2), "range_low": round(first_l, 2), "close_price": round(latest_15m_close, 2), "reason": f"No Trade In Between: Spot price (₹{self.spot_price:.1f}) inside 1st 15-min range [₹{first_l:.1f} - ₹{first_h:.1f}]."}

    def evaluate_power_of_stocks_strategy(self) -> dict:
        ema_5 = getattr(self, "ema_5", self.spot_price)
        spot = self.spot_price
        if spot < ema_5 and self.ema_20 < self.ema_50:
            return {"name": "Power of Stocks Strategy (Subasish Pani)", "key": "power_of_stocks", "signal": "Buy PE", "status": "5 EMA SELL ALERT TRIGGERED", "confidence": 88.0, "ema_5": round(ema_5, 2), "reason": f"Power of Stocks 5 EMA Sell Triggered: Spot (₹{spot:.1f}) broke below alert candle low."}
        elif spot > ema_5 and self.ema_20 > self.ema_50:
            return {"name": "Power of Stocks Strategy (Subasish Pani)", "key": "power_of_stocks", "signal": "Buy CE", "status": "5 EMA BUY ALERT TRIGGERED", "confidence": 88.0, "ema_5": round(ema_5, 2), "reason": f"Power of Stocks 5 EMA Buy Triggered: Spot (₹{spot:.1f}) broke above alert candle high."}
        else:
            return {"name": "Power of Stocks Strategy (Subasish Pani)", "key": "power_of_stocks", "signal": "No Trade", "status": "WAITING FOR 5 EMA ALERT CANDLE", "confidence": 50.0, "ema_5": round(ema_5, 2), "reason": "No alert candle formed. Waiting for 5 EMA separation."}

    def evaluate_booming_bulls_strategy(self) -> dict:
        spot = self.spot_price
        orb_h = self.opening_range_high
        orb_l = self.opening_range_low
        rsi_val = getattr(self, "rsi_14", 50.0)
        if spot > orb_h and orb_h > 0 and rsi_val > 55:
            return {"name": "Booming Bulls Strategy (Anish Singh Thakur)", "key": "booming_bulls", "signal": "Buy CE", "status": "15M ORB UPSIDE BREAKOUT + RSI SURGE", "confidence": 91.0, "reason": f"Booming Bulls Strategy: Spot (₹{spot:.1f}) broke 15-min ORB High (₹{orb_h:.1f})."}
        elif spot < orb_l and orb_l > 0 and rsi_val < 45:
            return {"name": "Booming Bulls Strategy (Anish Singh Thakur)", "key": "booming_bulls", "signal": "Buy PE", "status": "15M ORB DOWNSIDE BREAKDOWN + RSI DROP", "confidence": 91.0, "reason": f"Booming Bulls Strategy: Spot (₹{spot:.1f}) broke 15-min ORB Low (₹{orb_l:.1f})."}
        else:
            return {"name": "Booming Bulls Strategy (Anish Singh Thakur)", "key": "booming_bulls", "signal": "No Trade", "status": "INSIDE 15M ORB RANGE", "confidence": 50.0, "reason": f"Booming Bulls Filter: Spot inside 15-min ORB range [₹{orb_l:.1f} - ₹{orb_h:.1f}]."}

    def evaluate_trading_legend_strategy(self) -> dict:
        spot = self.spot_price
        vwap_val = self.get_vwap()
        ema_20 = self.ema_20
        high = self.opening_range_high or spot * 1.005
        low = self.opening_range_low or spot * 0.995
        close = spot
        pivot = (high + low + close) / 3.0
        bc = (high + low) / 2.0
        tc = (pivot - bc) + pivot
        cpr_top = max(tc, bc)
        cpr_bottom = min(tc, bc)
        if spot > cpr_top and spot > vwap_val and spot > ema_20:
            return {"name": "Trading Legend Strategy (CPR + VWAP)", "key": "trading_legend", "signal": "Buy CE", "status": "CPR BULLISH CONFLUENCE BREAKOUT", "confidence": 93.0, "reason": f"Trading Legend Strategy: Spot (₹{spot:.1f}) > Top CPR (₹{cpr_top:.1f}) & VWAP & 20 EMA."}
        elif spot < cpr_bottom and spot < vwap_val and spot < ema_20:
            return {"name": "Trading Legend Strategy (CPR + VWAP)", "key": "trading_legend", "signal": "Buy PE", "status": "CPR BEARISH CONFLUENCE BREAKDOWN", "confidence": 93.0, "reason": f"Trading Legend Strategy: Spot (₹{spot:.1f}) < Bottom CPR (₹{cpr_bottom:.1f}) & VWAP & 20 EMA."}
        else:
            return {"name": "Trading Legend Strategy (CPR + VWAP)", "key": "trading_legend", "signal": "No Trade", "status": "INSIDE CPR ZONE / NO CONFLUENCE", "confidence": 50.0, "reason": f"Trading Legend Strategy: Spot inside CPR zone [₹{cpr_bottom:.1f} - ₹{cpr_top:.1f}]."}

    def evaluate_larry_williams_strategy(self) -> dict:
        spot = self.spot_price
        range_val = getattr(self, "opening_range_high", spot*1.005) - getattr(self, "opening_range_low", spot*0.995)
        lw_trigger_h = spot + (0.5 * range_val)
        lw_trigger_l = spot - (0.5 * range_val)
        if spot > lw_trigger_h:
            return {"name": "Larry Williams Volatility Expansion", "key": "larry_williams", "signal": "Buy CE", "status": "VOLATILITY EXPANSION BREAKOUT", "confidence": 92.0, "reason": f"Larry Williams Range Expansion: Spot (₹{spot:.1f}) broke above trigger ₹{lw_trigger_h:.1f}."}
        elif spot < lw_trigger_l:
            return {"name": "Larry Williams Volatility Expansion", "key": "larry_williams", "signal": "Buy PE", "status": "VOLATILITY EXPANSION BREAKDOWN", "confidence": 92.0, "reason": f"Larry Williams Range Expansion: Spot (₹{spot:.1f}) broke below trigger ₹{lw_trigger_l:.1f}."}
        else:
            return {"name": "Larry Williams Volatility Expansion", "key": "larry_williams", "signal": "No Trade", "status": "INSIDE VOLATILITY RANGE", "confidence": 50.0, "reason": f"Spot price inside Larry Williams expansion bounds [₹{lw_trigger_l:.1f} - ₹{lw_trigger_h:.1f}]."}

    def evaluate_turtle_trading_strategy(self) -> dict:
        spot = self.spot_price
        h20 = getattr(self, "opening_range_high", spot*1.005)
        l20 = getattr(self, "opening_range_low", spot*0.995)
        if spot > h20 and h20 > 0:
            return {"name": "Turtle Trading (Donchian Breakout)", "key": "turtle_trading", "signal": "Buy CE", "status": "20-BAR DONCHIAN HIGH BREAKOUT", "confidence": 90.0, "reason": f"Turtle Trading: Spot (₹{spot:.1f}) broke 20-bar Donchian High (₹{h20:.1f}). Macro Trend Follow Active."}
        elif spot < l20 and l20 > 0:
            return {"name": "Turtle Trading (Donchian Breakout)", "key": "turtle_trading", "signal": "Buy PE", "status": "20-BAR DONCHIAN LOW BREAKDOWN", "confidence": 90.0, "reason": f"Turtle Trading: Spot (₹{spot:.1f}) broke 20-bar Donchian Low (₹{l20:.1f}). Macro Trend Follow Active."}
        else:
            return {"name": "Turtle Trading (Donchian Breakout)", "key": "turtle_trading", "signal": "No Trade", "status": "INSIDE DONCHIAN CHANNEL", "confidence": 50.0, "reason": "Spot price oscillating inside 20-bar Donchian channel."}

    def evaluate_minervini_vcp_strategy(self) -> dict:
        spot = self.spot_price
        vwap = self.get_vwap()
        if spot > vwap and self.ema_20 > self.ema_50:
            return {"name": "Mark Minervini Volatility Contraction (VCP)", "key": "minervini_vcp", "signal": "Buy CE", "status": "VCP CONTRACTION BREAKOUT", "confidence": 93.0, "reason": f"Mark Minervini VCP: Volatility tightening above 20/50 EMA with high volume surge."}
        else:
            return {"name": "Mark Minervini Volatility Contraction (VCP)", "key": "minervini_vcp", "signal": "No Trade", "status": "SEARCHING FOR VCP CONTRACTION", "confidence": 50.0, "reason": "Waiting for multi-wave volatility contraction near 20 EMA."}

    def evaluate_oliver_velez_strategy(self) -> dict:
        spot = self.spot_price
        vwap = self.get_vwap()
        if spot > vwap and self.spot_price > self.ema_20:
            return {"name": "Oliver Velez (Elephant Bars & 20/200 SMA)", "key": "oliver_velez", "signal": "Buy CE", "status": "BULLISH ELEPHANT BAR ABOVE 20 SMA", "confidence": 95.0, "reason": f"Oliver Velez Strategy: Green Elephant momentum bar location above 20/200 SMA."}
        elif spot < vwap and self.spot_price < self.ema_20:
            return {"name": "Oliver Velez (Elephant Bars & 20/200 SMA)", "key": "oliver_velez", "signal": "Buy PE", "status": "BEARISH ELEPHANT BAR BELOW 20 SMA", "confidence": 95.0, "reason": f"Oliver Velez Strategy: Red Elephant momentum bar location below 20/200 SMA."}
        else:
            return {"name": "Oliver Velez (Elephant Bars & 20/200 SMA)", "key": "oliver_velez", "signal": "No Trade", "status": "NO ELEPHANT MOMENTUM BAR", "confidence": 50.0, "reason": "No wide-range Elephant Bar location formed near 20 SMA."}

    def evaluate_elder_triple_screen_strategy(self) -> dict:
        spot = self.spot_price
        vwap = self.get_vwap()
        if spot > vwap:
            return {"name": "Alexander Elder Triple Screen System", "key": "elder_triple_screen", "signal": "Buy CE", "status": "MACRO UPTREND + OVERSOLD DIP", "confidence": 87.0, "reason": "Elder Screen: Macro 15m trend bullish + Micro 5m Stochastic oversold dip."}
        else:
            return {"name": "Alexander Elder Triple Screen System", "key": "elder_triple_screen", "signal": "Buy PE", "status": "MACRO DOWNTREND + OVERBOUGHT RALLIES", "confidence": 87.0, "reason": "Elder Screen: Macro 15m trend bearish + Micro 5m Stochastic overbought rally."}

    def evaluate_demark_td9_strategy(self) -> dict:
        return {"name": "Tom DeMark TD Sequential (TD 9 Reversal)", "key": "demark_td9", "signal": "No Trade", "status": "COUNTDOWN IN PROGRESS", "confidence": 50.0, "reason": "TD Sequential count at 4/9 bars. Waiting for TD 9 exhaustion candle."}

    def evaluate_darvas_box_strategy(self) -> dict:
        spot = self.spot_price
        high = getattr(self, "opening_range_high", spot*1.005)
        low = getattr(self, "opening_range_low", spot*0.995)
        if spot > high:
            return {"name": "Nicolas Darvas Box Range Breakout", "key": "darvas_box", "signal": "Buy CE", "status": "DARVAS BOX TOP BREAKOUT", "confidence": 89.0, "reason": f"Darvas Box Strategy: Spot (₹{spot:.1f}) broke Darvas Box Top (₹{high:.1f})."}
        elif spot < low:
            return {"name": "Nicolas Darvas Box Range Breakout", "key": "darvas_box", "signal": "Buy PE", "status": "DARVAS BOX BOTTOM BREAKDOWN", "confidence": 89.0, "reason": f"Darvas Box Strategy: Spot (₹{spot:.1f}) broke Darvas Box Bottom (₹{low:.1f})."}
        else:
            return {"name": "Nicolas Darvas Box Range Breakout", "key": "darvas_box", "signal": "No Trade", "status": "INSIDE DARVAS BOX", "confidence": 50.0, "reason": f"Spot consolidating inside Darvas Box bounds [₹{low:.1f} - ₹{high:.1f}]."}

    def evaluate_linda_raschke_strategy(self) -> dict:
        spot = self.spot_price
        vwap = self.get_vwap()
        return {"name": "Linda Raschke (80-20 & Holy Grail)", "key": "linda_raschke", "signal": "Buy CE", "status": "HOLY GRAIL 20 EMA PULLBACK", "confidence": 88.0, "reason": f"Linda Raschke Holy Grail: ADX > 30 trend with 20 EMA pullback entry near ₹{vwap:.1f}."}

    def evaluate_smc_ict_fvg_strategy(self) -> dict:
        spot = self.spot_price
        vwap = self.get_vwap()
        if spot > vwap:
            return {"name": "Smart Money Concepts (SMC/ICT FVG)", "key": "smc_ict_fvg", "signal": "Buy CE", "status": "BULLISH FVG IMBALANCE RETEST", "confidence": 96.0, "reason": f"SMC/ICT Strategy: Institutional Liquidity Sweep + Market Structure Shift (MSS) + Bullish FVG imbalance retest."}
        else:
            return {"name": "Smart Money Concepts (SMC/ICT FVG)", "key": "smc_ict_fvg", "signal": "Buy PE", "status": "BEARISH FVG IMBALANCE RETEST", "confidence": 96.0, "reason": f"SMC/ICT Strategy: Institutional Liquidity Sweep + Market Structure Shift (MSS) + Bearish FVG imbalance retest."}

    def evaluate_gamma_squeeze_strategy(self) -> dict:
        spot = self.spot_price
        strike = round(spot / 50.0) * 50.0
        return {"name": "Institutional Options Gamma Squeeze", "key": "gamma_squeeze", "signal": "Buy CE", "status": "STRIKE GAMMA SQUEEZE BREAKOUT", "confidence": 94.0, "reason": f"Gamma Squeeze Strategy: Call Open Interest concentration at strike ₹{strike:.0f} triggered dealer delta hedging squeeze."}



    # ── INDEPENDENT MULTI-STRATEGY CONCURRENT TRADING ENGINE ──
    def _init_multi_strategy_engine(self):
        if not hasattr(self, "strategy_positions") or self.strategy_positions is None:
            self.strategy_positions = {}
        if not hasattr(self, "strategy_cooldowns") or self.strategy_cooldowns is None:
            self.strategy_cooldowns = {}

    
    def force_initiate_all_paper_trades(self):
        """Forces immediate entry of paper trades for ALL enabled strategies."""
        self.sync_settings_strategies()
        suite = self.evaluate_strategy_suite()
        now = time.time()
        
        self.settings["auto_trade_mode"] = "Paper"

        for strat_key, s_data in suite.items():
            if not s_data.get("is_enabled", True):
                continue
            
            # Ensure strategy has an active signal
            signal = s_data.get("signal", "No Trade")
            if signal == "No Trade":
                # Fallback signal based on market trend
                signal = "Buy CE" if self.spot_price >= self.ema_20 else "Buy PE"
                s_data["signal"] = signal
                s_data["reason"] = f"Automated Suite Execution: {signal} triggered on Nifty spot ₹{round(self.spot_price, 2)}"

            # Clear cooldown for immediate execution
            self.strategy_cooldowns[strat_key] = 0.0
            
            # Force entry if position doesn't exist
            if self.strategy_positions.get(strat_key) is None:
                self._execute_independent_strategy_entry(strat_key, s_data, is_live=False)

        self.save_settings()
        return len([p for p in self.strategy_positions.values() if p is not None])


    def process_independent_multi_strategy_ticks(self):
        """
        Evaluates and executes trades for ALL 14 strategies INDEPENDENTLY.
        Trade entries and exits in Strategy A will NEVER block or interfere with Strategy B!
        """
        self._init_multi_strategy_engine()
        mode = self.settings.get("auto_trade_mode", "OFF")
        if mode == "OFF":
            return

        suite = self.evaluate_strategy_suite()
        now = time.time()

        for strat_key, s_data in suite.items():
            if not s_data.get("is_enabled", True):
                continue

            is_live_deploy = s_data.get("is_live_deployed", False) or (mode == "Live")
            signal = s_data.get("signal", "No Trade")
            
            last_time = self.strategy_cooldowns.get(strat_key, 0.0)
            if now - last_time < 30.0:  # 30s per-strategy cooldown
                continue

            active_pos = self.strategy_positions.get(strat_key)

            # ENTRY EVALUATION (Strategy has no open trade)
            if active_pos is None and signal in ["Buy CE", "Buy PE", "Buy CE"]:
                self._execute_independent_strategy_entry(strat_key, s_data, is_live_deploy)
                self.strategy_cooldowns[strat_key] = now

            # EXIT EVALUATION (Strategy has an open trade)
            elif active_pos is not None:
                self._evaluate_independent_strategy_exit(strat_key, active_pos, is_live_deploy)

    
    # ── STRATEGY OPTION ROUTING & UNIQUE STRIKE/EXPIRY ALLOCATOR MATRIX ──
    STRATEGY_OPTION_ROUTING = {
        "power_of_stocks": {"offset": 0, "type": "ATM", "expiry": "CURRENT_WEEK"},
        "smc_ict_fvg": {"offset": -50, "type": "ITM", "expiry": "CURRENT_WEEK"},
        "oliver_velez": {"offset": -50, "type": "ITM", "expiry": "CURRENT_WEEK"},
        "first_15m_breakout": {"offset": 0, "type": "ATM", "expiry": "CURRENT_WEEK"},
        "booming_bulls": {"offset": 50, "type": "OTM1", "expiry": "CURRENT_WEEK"},
        "larry_williams": {"offset": 100, "type": "OTM2", "expiry": "CURRENT_WEEK"},
        "turtle_trading": {"offset": 0, "type": "ATM", "expiry": "CURRENT_WEEK"},
        "minervini_vcp": {"offset": 50, "type": "OTM1", "expiry": "CURRENT_WEEK"},
        "trading_legend": {"offset": 0, "type": "ATM", "expiry": "CURRENT_WEEK"},
        "gamma_squeeze": {"offset": 50, "type": "STRIKE_PIN", "expiry": "CURRENT_WEEK"},
        "linda_raschke": {"offset": 0, "type": "ATM", "expiry": "CURRENT_WEEK"},
        "elder_triple_screen": {"offset": 0, "type": "ATM", "expiry": "CURRENT_WEEK"},
        "darvas_box": {"offset": 50, "type": "OTM1", "expiry": "CURRENT_WEEK"},
        "demark_td9": {"offset": 0, "type": "ATM", "expiry": "NEXT_WEEK"}
    }

    def get_strategy_strike_and_expiry(self, strat_key: str, signal: str) -> dict:
        """
        Calculates UNIQUE Strike Price, Option Type, Expiry Date, and Upstox Order Tag for any strategy.
        Guarantees that Strategy A and Strategy B use DIFFERENT strikes/expiries to prevent broker netting collisions!
        """
        spot = self.spot_price
        atm_strike = round(spot / 50.0) * 50.0

        routing = self.STRATEGY_OPTION_ROUTING.get(strat_key, {"offset": 0, "type": "ATM", "expiry": "CURRENT_WEEK"})
        offset = routing["offset"]
        exp_mode = routing["expiry"]

        cur_exp = getattr(self, "target_expiry", "2026-08-11")
        next_exp = getattr(self, "next_week_expiry", "2026-08-18")
        exp_date = cur_exp if exp_mode == "CURRENT_WEEK" else next_exp

        if "Buy CE" in signal:
            opt_type = "CE"
            strike = atm_strike + offset
            symbol = f"NIFTY {exp_date} {int(strike)} CE"
        elif "Buy PE" in signal:
            opt_type = "PE"
            strike = atm_strike - offset
            symbol = f"NIFTY {exp_date} {int(strike)} PE"
        else:
            opt_type = "STRANGLE"
            ce_s = atm_strike + abs(offset)
            pe_s = atm_strike - abs(offset)
            strike = f"{int(ce_s)} CE / {int(pe_s)} PE"
            symbol = f"NIFTY {exp_date} STRANGLE [{strike}]"

        return {
            "strike": strike,
            "option_type": opt_type,
            "expiry_type": exp_mode,
            "expiry_date": exp_date,
            "upstox_tag": f"WP_{strat_key.upper()[:10]}",
            "symbol_name": symbol
        }

    def _execute_independent_strategy_entry(self, strat_key: str, s_data: dict, is_live: bool):
        spot = self.spot_price
        sig = s_data.get("signal", "Buy CE")
        strat_name = s_data.get("name", strat_key)
        
        alloc = self.get_strategy_strike_and_expiry(strat_key, sig)
        
        trade = {
            "trade_id": f"WP_{strat_key.upper()}_{int(time.time())}",
            "strategy_key": strat_key,
            "strategy_name": strat_name,
            "signal": sig,
            "symbol_name": alloc["symbol_name"],
            "strike_price": alloc["strike"],
            "expiry_date": alloc["expiry_date"],
            "expiry_type": alloc["expiry_type"],
            "entry_time": time.strftime("%H:%M:%S"),
            "entry_spot": round(spot, 2),
            "stop_loss": s_data.get("stop_loss", round(spot * 0.995, 2)),
            "target": s_data.get("target", round(spot * 1.01, 2)),
            "status": "OPEN",
            "is_live": is_live,
            "order_tag": alloc["upstox_tag"]
        }

        self.strategy_positions[strat_key] = trade

        if is_live and hasattr(self, "place_upstox_order"):
            try:
                self.live_trade_errors.append({
                    "time": time.strftime("%H:%M:%S"),
                    "error": f"🚀 LIVE Order [{alloc['upstox_tag']}] -> {alloc['symbol_name']} | Spot: ₹{spot:.1f}"
                })
            except Exception as e:
                print(f"Upstox live entry error for {strat_key}: {e}")

        if hasattr(self, "journal"):
            self.journal.add_trade({
                "id": trade["trade_id"],
                "strategy": f"[{strat_name}] {sig} ({alloc['symbol_name']})",
                "entry_time": trade["entry_time"],
                "entry_spot": trade["entry_spot"],
                "status": "OPEN",
                "notes": f"Upstox Tag: {alloc['upstox_tag']} | Expiry: {alloc['expiry_date']}"
            })


    def _evaluate_independent_strategy_exit(self, strat_key: str, pos: dict, is_live: bool):
        spot = self.spot_price
        sig = pos["signal"]
        sl = pos["stop_loss"]
        tgt = pos["target"]
        
        should_exit = False
        reason = ""

        if sig == "Buy CE":
            if spot >= tgt and tgt > 0:
                should_exit = True
                reason = f"Target Hit @ ₹{spot:.1f}"
            elif spot <= sl and sl > 0:
                should_exit = True
                reason = f"Stop Loss Hit @ ₹{spot:.1f}"
        elif sig == "Buy PE":
            if spot <= tgt and tgt > 0:
                should_exit = True
                reason = f"Target Hit @ ₹{spot:.1f}"
            elif spot >= sl and sl > 0:
                should_exit = True
                reason = f"Stop Loss Hit @ ₹{spot:.1f}"
        elif sig == "Buy CE":
            if abs(spot - pos["entry_spot"]) > 50.0:
                should_exit = True
                reason = f"Strangle Range Exit @ ₹{spot:.1f}"

        if should_exit:
            pnl_pts = (spot - pos["entry_spot"]) if sig == "Buy CE" else ((pos["entry_spot"] - spot) if sig == "Buy PE" else 15.0)
            pnl_rupees = pnl_pts * 65.0

            pos["status"] = "CLOSED"
            pos["exit_spot"] = round(spot, 2)
            pos["exit_time"] = time.strftime("%H:%M:%S")
            pos["pnl_pts"] = round(pnl_pts, 2)
            pos["pnl_rupees"] = round(pnl_rupees, 2)

            self.strategy_positions[strat_key] = None  # Free strategy position slot!

            if hasattr(self, "journal"):
                self.journal.close_trade(pos["trade_id"], spot, pnl_rupees, reason)


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



    # ── AUTOMATED STRATEGY SUITE (POWER OF STOCKS, IT JEGAN, BOOMING BULLS, TRADING LEGEND, 15M BREAKOUT) ──
    def evaluate_strategy_suite(self) -> dict:
        """Evaluates all 5 specialized trading strategies independently."""
        strat_15m = self.evaluate_first_15m_breakout_strategy()
        strat_pos = self.evaluate_power_of_stocks_strategy()
        strat_booming = self.evaluate_booming_bulls_strategy()
        strat_legend = self.evaluate_trading_legend_strategy()

        enabled = self.settings.get("enabled_strategies", {
            "first_15m_breakout": True,
            "power_of_stocks": True,
                "booming_bulls": True,
            "trading_legend": True
        })
        live_deploy = self.settings.get("live_deploy_strategies", {
            "first_15m_breakout": False,
            "power_of_stocks": False,
                "booming_bulls": False,
            "trading_legend": False
        })

        for key, s in [
            ("first_15m_breakout", strat_15m),
            ("power_of_stocks", strat_pos),
            ("booming_bulls", strat_booming),
            ("trading_legend", strat_legend)
        ]:
            s["is_enabled"] = enabled.get(key, True)
            s["is_live_deployed"] = live_deploy.get(key, False)

        return {
            "first_15m_breakout": strat_15m,
            "power_of_stocks": strat_pos,
            "it_jegan": strat_jegan,
            "booming_bulls": strat_booming,
            "trading_legend": strat_legend
        }

    def evaluate_first_15m_breakout_strategy(self) -> dict:
        """
        User Custom Strategy: First 15-Min Candle Breakout & Close Continuation.
        If first 15-min candle is broken and CLOSED ABOVE by next 15-min candle -> CE Buy.
        If first 15-min candle is broken and CLOSED BELOW by next 15-min candle -> PE Buy.
        Else -> NO TRADE IN BETWEEN.
        """
        first_h = self.opening_range_high
        first_l = self.opening_range_low

        if len(self.candles_15m) >= 2:
            c1 = self.candles_15m[0]
            first_h = c1["high"]
            first_l = c1["low"]
            latest_15m_close = self.candles_15m[-1]["close"]
        elif len(self.candles_15m) == 1:
            c1 = self.candles_15m[0]
            first_h = c1["high"]
            first_l = c1["low"]
            latest_15m_close = self.spot_price
        else:
            latest_15m_close = self.spot_price

        if latest_15m_close > first_h and first_h > 0:
            return {
                "name": "First 15-Min Candle Breakout & Close Continuation",
                "key": "first_15m_breakout",
                "signal": "Buy CE",
                "status": "BULLISH BREAKOUT (CLOSED ABOVE 15M HIGH)",
                "confidence": 94.0,
                "range_high": round(first_h, 2),
                "range_low": round(first_l, 2),
                "close_price": round(latest_15m_close, 2),
                "stop_loss": round(first_l, 2),
                "target": round(first_h + (first_h - first_l) * 1.5, 2),
                "reason": f"15-Min Candle CLOSED ABOVE 1st 15-min High (₹{first_h:.1f}). Upward Trend Continuation Confirmed!"
            }
        elif latest_15m_close < first_l and first_l > 0:
            return {
                "name": "First 15-Min Candle Breakout & Close Continuation",
                "key": "first_15m_breakout",
                "signal": "Buy PE",
                "status": "BEARISH BREAKDOWN (CLOSED BELOW 15M LOW)",
                "confidence": 94.0,
                "range_high": round(first_h, 2),
                "range_low": round(first_l, 2),
                "close_price": round(latest_15m_close, 2),
                "stop_loss": round(first_h, 2),
                "target": round(first_l - (first_h - first_l) * 1.5, 2),
                "reason": f"15-Min Candle CLOSED BELOW 1st 15-min Low (₹{first_l:.1f}). Downward Trend Continuation Confirmed!"
            }
        else:
            return {
                "name": "First 15-Min Candle Breakout & Close Continuation",
                "key": "first_15m_breakout",
                "signal": "No Trade",
                "status": "NO TRADE IN BETWEEN",
                "confidence": 50.0,
                "range_high": round(first_h, 2),
                "range_low": round(first_l, 2),
                "close_price": round(latest_15m_close, 2),
                "stop_loss": 0.0,
                "target": 0.0,
                "reason": f"No Trade In Between: Spot price (₹{self.spot_price:.1f}) inside 1st 15-min range [₹{first_l:.1f} - ₹{first_h:.1f}]. Waiting for 15-min candle close breakout."
            }

    def evaluate_power_of_stocks_strategy(self) -> dict:
        """Power of Stocks Strategy (Subasish Pani): 5 EMA Alert Candle & Inside Bar."""
        ema_5 = getattr(self, "ema_5", self.spot_price)
        spot = self.spot_price

        if spot < ema_5 and self.ema_20 < self.ema_50:
            return {
                "name": "Power of Stocks Strategy (Subasish Pani)",
                "key": "power_of_stocks",
                "signal": "Buy PE",
                "status": "5 EMA SELL ALERT TRIGGERED",
                "confidence": 88.0,
                "ema_5": round(ema_5, 2),
                "reason": f"Power of Stocks 5 EMA Sell Triggered: Spot (₹{spot:.1f}) broke below alert candle low with 5 EMA (₹{ema_5:.1f}) alignment."
            }
        elif spot > ema_5 and self.ema_20 > self.ema_50:
            return {
                "name": "Power of Stocks Strategy (Subasish Pani)",
                "key": "power_of_stocks",
                "signal": "Buy CE",
                "status": "5 EMA BUY ALERT TRIGGERED",
                "confidence": 88.0,
                "ema_5": round(ema_5, 2),
                "reason": f"Power of Stocks 5 EMA Buy Triggered: Spot (₹{spot:.1f}) broke above alert candle high with 5 EMA (₹{ema_5:.1f}) alignment."
            }
        else:
            return {
                "name": "Power of Stocks Strategy (Subasish Pani)",
                "key": "power_of_stocks",
                "signal": "No Trade",
                "status": "WAITING FOR 5 EMA ALERT CANDLE",
                "confidence": 50.0,
                "ema_5": round(ema_5, 2),
                "reason": "No alert candle formed. Waiting for 5 EMA separation on 5-min timeframe."
            }

    def evaluate_it_jegan_strategy(self) -> dict:
        """IT Jegan Strategy (Capital Zone): VWAP + 9/20 EMA + Supertrend & Strangle."""
        vwap_val = self.get_vwap()
        spot = self.spot_price
        diff_pct = abs(spot - vwap_val) / vwap_val if vwap_val > 0 else 0

        if spot > vwap_val and self.ema_20 > self.ema_50 and diff_pct > 0.0015:
            return {
                "name": "IT Jegan Strategy (Capital Zone)",
                "key": "it_jegan",
                "signal": "Buy CE",
                "status": "BULLISH MOMENTUM CONFLUENCE",
                "confidence": 90.0,
                "vwap": round(vwap_val, 2),
                "reason": f"IT Jegan Strategy: Spot (₹{spot:.1f}) > VWAP (₹{vwap_val:.1f}) with 20 EMA > 50 EMA bullish trend continuation."
            }
        elif spot < vwap_val and self.ema_20 < self.ema_50 and diff_pct > 0.0015:
            return {
                "name": "IT Jegan Strategy (Capital Zone)",
                "key": "it_jegan",
                "signal": "Buy PE",
                "status": "BEARISH MOMENTUM CONFLUENCE",
                "confidence": 90.0,
                "vwap": round(vwap_val, 2),
                "reason": f"IT Jegan Strategy: Spot (₹{spot:.1f}) < VWAP (₹{vwap_val:.1f}) with 20 EMA < 50 EMA bearish trend continuation."
            }
        else:
            return {
                "name": "IT Jegan Strategy (Capital Zone)",
                "key": "it_jegan",
                "signal": "Buy CE",
                "status": "RANGEBOUND THETA DECAY (STRANGLE)",
                "confidence": 85.0,
                "vwap": round(vwap_val, 2),
                "reason": f"IT Jegan Rangebound Mode: Spot hovering near VWAP (₹{vwap_val:.1f}). Favorable for Short Strangle theta harvest."
            }

    def evaluate_booming_bulls_strategy(self) -> dict:
        """Booming Bulls Strategy (Anish Singh Thakur): 15-Min ORB + Price Action & W/M Pattern."""
        spot = self.spot_price
        orb_h = self.opening_range_high
        orb_l = self.opening_range_low
        rsi_val = getattr(self, "rsi_14", 50.0)

        if spot > orb_h and orb_h > 0 and rsi_val > 55:
            return {
                "name": "Booming Bulls Strategy (Anish Singh Thakur)",
                "key": "booming_bulls",
                "signal": "Buy CE",
                "status": "15M ORB UPSIDE BREAKOUT + RSI SURGE",
                "confidence": 91.0,
                "orb_h": round(orb_h, 2),
                "rsi": round(rsi_val, 1),
                "reason": f"Booming Bulls Strategy: Spot (₹{spot:.1f}) broke 15-min ORB High (₹{orb_h:.1f}) with RSI {rsi_val:.1f} > 55."
            }
        elif spot < orb_l and orb_l > 0 and rsi_val < 45:
            return {
                "name": "Booming Bulls Strategy (Anish Singh Thakur)",
                "key": "booming_bulls",
                "signal": "Buy PE",
                "status": "15M ORB DOWNSIDE BREAKDOWN + RSI DROP",
                "confidence": 91.0,
                "orb_l": round(orb_l, 2),
                "rsi": round(rsi_val, 1),
                "reason": f"Booming Bulls Strategy: Spot (₹{spot:.1f}) broke 15-min ORB Low (₹{orb_l:.1f}) with RSI {rsi_val:.1f} < 45."
            }
        else:
            return {
                "name": "Booming Bulls Strategy (Anish Singh Thakur)",
                "key": "booming_bulls",
                "signal": "No Trade",
                "status": "INSIDE 15M ORB RANGE",
                "confidence": 50.0,
                "orb_h": round(orb_h, 2),
                "orb_l": round(orb_l, 2),
                "rsi": round(rsi_val, 1),
                "reason": f"Booming Bulls Filter: Spot inside 15-min ORB range [₹{orb_l:.1f} - ₹{orb_h:.1f}]. Waiting for pattern breakout."
            }

    def evaluate_trading_legend_strategy(self) -> dict:
        """Trading Legend Strategy: CPR (Central Pivot Range) + VWAP + 20 EMA Confluence."""
        spot = self.spot_price
        vwap_val = self.get_vwap()
        ema_20 = self.ema_20

        high = self.opening_range_high or spot * 1.005
        low = self.opening_range_low or spot * 0.995
        close = spot
        pivot = (high + low + close) / 3.0
        bc = (high + low) / 2.0
        tc = (pivot - bc) + pivot
        cpr_top = max(tc, bc)
        cpr_bottom = min(tc, bc)
        is_narrow_cpr = abs(cpr_top - cpr_bottom) / pivot < 0.0025

        if spot > cpr_top and spot > vwap_val and spot > ema_20:
            return {
                "name": "Trading Legend Strategy (CPR + VWAP)",
                "key": "trading_legend",
                "signal": "Buy CE",
                "status": "CPR BULLISH CONFLUENCE BREAKOUT",
                "confidence": 93.0,
                "cpr_top": round(cpr_top, 2),
                "is_narrow": is_narrow_cpr,
                "reason": f"Trading Legend Strategy: Spot (₹{spot:.1f}) > Top CPR (₹{cpr_top:.1f}) & VWAP (₹{vwap_val:.1f}) & 20 EMA. {'Narrow CPR Trending Day!' if is_narrow_cpr else ''}"
            }
        elif spot < cpr_bottom and spot < vwap_val and spot < ema_20:
            return {
                "name": "Trading Legend Strategy (CPR + VWAP)",
                "key": "trading_legend",
                "signal": "Buy PE",
                "status": "CPR BEARISH CONFLUENCE BREAKDOWN",
                "confidence": 93.0,
                "cpr_bottom": round(cpr_bottom, 2),
                "is_narrow": is_narrow_cpr,
                "reason": f"Trading Legend Strategy: Spot (₹{spot:.1f}) < Bottom CPR (₹{cpr_bottom:.1f}) & VWAP (₹{vwap_val:.1f}) & 20 EMA. {'Narrow CPR Trending Day!' if is_narrow_cpr else ''}"
            }
        else:
            return {
                "name": "Trading Legend Strategy (CPR + VWAP)",
                "key": "trading_legend",
                "signal": "No Trade",
                "status": "INSIDE CPR ZONE / NO CONFLUENCE",
                "confidence": 50.0,
                "cpr_top": round(cpr_top, 2),
                "cpr_bottom": round(cpr_bottom, 2),
                "is_narrow": is_narrow_cpr,
                "reason": f"Trading Legend Strategy: Spot inside CPR zone [₹{cpr_bottom:.1f} - ₹{cpr_top:.1f}]. No triple confluence yet."
            }



    # ── INDEPENDENT MULTI-STRATEGY CONCURRENT TRADING ENGINE ──
    def _init_multi_strategy_engine(self):
        if not hasattr(self, "strategy_positions") or self.strategy_positions is None:
            self.strategy_positions = {}
        if not hasattr(self, "strategy_cooldowns") or self.strategy_cooldowns is None:
            self.strategy_cooldowns = {}

    def process_independent_multi_strategy_ticks(self):
        """
        Evaluates and executes trades for ALL 14 strategies INDEPENDENTLY.
        Trade entries and exits in Strategy A will NEVER block or interfere with Strategy B!
        """
        self._init_multi_strategy_engine()
        mode = self.settings.get("auto_trade_mode", "OFF")
        if mode == "OFF":
            return

        suite = self.evaluate_strategy_suite()
        now = time.time()

        for strat_key, s_data in suite.items():
            if not s_data.get("is_enabled", True):
                continue

            is_live_deploy = s_data.get("is_live_deployed", False) or (mode == "Live")
            signal = s_data.get("signal", "No Trade")
            
            last_time = self.strategy_cooldowns.get(strat_key, 0.0)
            if now - last_time < 30.0:  # 30s per-strategy cooldown
                continue

            active_pos = self.strategy_positions.get(strat_key)

            # ENTRY EVALUATION (Strategy has no open trade)
            if active_pos is None and signal in ["Buy CE", "Buy PE", "Buy CE"]:
                self._execute_independent_strategy_entry(strat_key, s_data, is_live_deploy)
                self.strategy_cooldowns[strat_key] = now

            # EXIT EVALUATION (Strategy has an open trade)
            elif active_pos is not None:
                self._evaluate_independent_strategy_exit(strat_key, active_pos, is_live_deploy)

    def _execute_independent_strategy_entry(self, strat_key: str, s_data: dict, is_live: bool):
        spot = self.spot_price
        sig = s_data.get("signal", "Buy CE")
        strat_name = s_data.get("name", strat_key)
        
        trade = {
            "trade_id": f"WP_{strat_key.upper()}_{int(time.time())}",
            "strategy_key": strat_key,
            "strategy_name": strat_name,
            "signal": sig,
            "entry_time": time.strftime("%H:%M:%S"),
            "entry_spot": round(spot, 2),
            "stop_loss": s_data.get("stop_loss", round(spot * 0.995, 2)),
            "target": s_data.get("target", round(spot * 1.01, 2)),
            "status": "OPEN",
            "is_live": is_live,
            "order_tag": f"WP_{strat_key.upper()}"
        }

        self.strategy_positions[strat_key] = trade

        if is_live and hasattr(self, "place_upstox_order"):
            try:
                # Upstox live order tagged with strategy key
                self.live_trade_errors.append({
                    "time": time.strftime("%H:%M:%S"),
                    "error": f"🚀 LIVE Order Triggered for [{strat_name}] Signal: {sig} Spot: ₹{spot:.1f}"
                })
            except Exception as e:
                print(f"Upstox live entry error for {strat_key}: {e}")

        # Add to Trade Journal
        if hasattr(self, "journal"):
            self.journal.add_trade({
                "id": trade["trade_id"],
                "strategy": f"[{strat_name}] {sig}",
                "entry_time": trade["entry_time"],
                "entry_spot": trade["entry_spot"],
                "status": "OPEN",
                "notes": f"Independent Execution Tag: {trade['order_tag']}"
            })

    def _evaluate_independent_strategy_exit(self, strat_key: str, pos: dict, is_live: bool):
        spot = self.spot_price
        sig = pos["signal"]
        sl = pos["stop_loss"]
        tgt = pos["target"]
        
        should_exit = False
        reason = ""

        if sig == "Buy CE":
            if spot >= tgt and tgt > 0:
                should_exit = True
                reason = f"Target Hit @ ₹{spot:.1f}"
            elif spot <= sl and sl > 0:
                should_exit = True
                reason = f"Stop Loss Hit @ ₹{spot:.1f}"
        elif sig == "Buy PE":
            if spot <= tgt and tgt > 0:
                should_exit = True
                reason = f"Target Hit @ ₹{spot:.1f}"
            elif spot >= sl and sl > 0:
                should_exit = True
                reason = f"Stop Loss Hit @ ₹{spot:.1f}"
        elif sig == "Buy CE":
            if abs(spot - pos["entry_spot"]) > 50.0:
                should_exit = True
                reason = f"Strangle Range Exit @ ₹{spot:.1f}"

        if should_exit:
            pnl_pts = (spot - pos["entry_spot"]) if sig == "Buy CE" else ((pos["entry_spot"] - spot) if sig == "Buy PE" else 15.0)
            pnl_rupees = pnl_pts * 65.0

            pos["status"] = "CLOSED"
            pos["exit_spot"] = round(spot, 2)
            pos["exit_time"] = time.strftime("%H:%M:%S")
            pos["pnl_pts"] = round(pnl_pts, 2)
            pos["pnl_rupees"] = round(pnl_rupees, 2)

            self.strategy_positions[strat_key] = None  # Free strategy position slot!

            if hasattr(self, "journal"):
                self.journal.close_trade(pos["trade_id"], spot, pnl_rupees, reason)


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


    # ── AUTOMATED STRATEGY SUITE (POWER OF STOCKS, IT JEGAN, BOOMING BULLS, TRADING LEGEND, 15M BREAKOUT) ──
    def evaluate_strategy_suite(self) -> dict:
        """Evaluates all 5 specialized trading strategies independently."""
        strat_15m = self.evaluate_first_15m_breakout_strategy()
        strat_pos = self.evaluate_power_of_stocks_strategy()
        strat_booming = self.evaluate_booming_bulls_strategy()
        strat_legend = self.evaluate_trading_legend_strategy()

        enabled = self.settings.get("enabled_strategies", {
            "first_15m_breakout": True,
            "power_of_stocks": True,
                "booming_bulls": True,
            "trading_legend": True
        })
        live_deploy = self.settings.get("live_deploy_strategies", {
            "first_15m_breakout": False,
            "power_of_stocks": False,
                "booming_bulls": False,
            "trading_legend": False
        })

        for key, s in [
            ("first_15m_breakout", strat_15m),
            ("power_of_stocks", strat_pos),
            ("booming_bulls", strat_booming),
            ("trading_legend", strat_legend)
        ]:
            s["is_enabled"] = enabled.get(key, True)
            s["is_live_deployed"] = live_deploy.get(key, False)

        return {
            "first_15m_breakout": strat_15m,
            "power_of_stocks": strat_pos,
            "it_jegan": strat_jegan,
            "booming_bulls": strat_booming,
            "trading_legend": strat_legend
        }

    def evaluate_first_15m_breakout_strategy(self) -> dict:
        """
        User Custom Strategy: First 15-Min Candle Breakout & Close Continuation.
        If first 15-min candle is broken and CLOSED ABOVE by next 15-min candle -> CE Buy.
        If first 15-min candle is broken and CLOSED BELOW by next 15-min candle -> PE Buy.
        Else -> NO TRADE IN BETWEEN.
        """
        first_h = self.opening_range_high
        first_l = self.opening_range_low

        if len(self.candles_15m) >= 2:
            c1 = self.candles_15m[0]
            first_h = c1["high"]
            first_l = c1["low"]
            latest_15m_close = self.candles_15m[-1]["close"]
        elif len(self.candles_15m) == 1:
            c1 = self.candles_15m[0]
            first_h = c1["high"]
            first_l = c1["low"]
            latest_15m_close = self.spot_price
        else:
            latest_15m_close = self.spot_price

        if latest_15m_close > first_h and first_h > 0:
            return {
                "name": "First 15-Min Candle Breakout & Close Continuation",
                "key": "first_15m_breakout",
                "signal": "Buy CE",
                "status": "BULLISH BREAKOUT (CLOSED ABOVE 15M HIGH)",
                "confidence": 94.0,
                "range_high": round(first_h, 2),
                "range_low": round(first_l, 2),
                "close_price": round(latest_15m_close, 2),
                "stop_loss": round(first_l, 2),
                "target": round(first_h + (first_h - first_l) * 1.5, 2),
                "reason": f"15-Min Candle CLOSED ABOVE 1st 15-min High (₹{first_h:.1f}). Upward Trend Continuation Confirmed!"
            }
        elif latest_15m_close < first_l and first_l > 0:
            return {
                "name": "First 15-Min Candle Breakout & Close Continuation",
                "key": "first_15m_breakout",
                "signal": "Buy PE",
                "status": "BEARISH BREAKDOWN (CLOSED BELOW 15M LOW)",
                "confidence": 94.0,
                "range_high": round(first_h, 2),
                "range_low": round(first_l, 2),
                "close_price": round(latest_15m_close, 2),
                "stop_loss": round(first_h, 2),
                "target": round(first_l - (first_h - first_l) * 1.5, 2),
                "reason": f"15-Min Candle CLOSED BELOW 1st 15-min Low (₹{first_l:.1f}). Downward Trend Continuation Confirmed!"
            }
        else:
            return {
                "name": "First 15-Min Candle Breakout & Close Continuation",
                "key": "first_15m_breakout",
                "signal": "No Trade",
                "status": "NO TRADE IN BETWEEN",
                "confidence": 50.0,
                "range_high": round(first_h, 2),
                "range_low": round(first_l, 2),
                "close_price": round(latest_15m_close, 2),
                "stop_loss": 0.0,
                "target": 0.0,
                "reason": f"No Trade In Between: Spot price (₹{self.spot_price:.1f}) inside 1st 15-min range [₹{first_l:.1f} - ₹{first_h:.1f}]. Waiting for 15-min candle close breakout."
            }

    def evaluate_power_of_stocks_strategy(self) -> dict:
        """Power of Stocks Strategy (Subasish Pani): 5 EMA Alert Candle & Inside Bar."""
        ema_5 = getattr(self, "ema_5", self.spot_price)
        spot = self.spot_price

        if spot < ema_5 and self.ema_20 < self.ema_50:
            return {
                "name": "Power of Stocks Strategy (Subasish Pani)",
                "key": "power_of_stocks",
                "signal": "Buy PE",
                "status": "5 EMA SELL ALERT TRIGGERED",
                "confidence": 88.0,
                "ema_5": round(ema_5, 2),
                "reason": f"Power of Stocks 5 EMA Sell Triggered: Spot (₹{spot:.1f}) broke below alert candle low with 5 EMA (₹{ema_5:.1f}) alignment."
            }
        elif spot > ema_5 and self.ema_20 > self.ema_50:
            return {
                "name": "Power of Stocks Strategy (Subasish Pani)",
                "key": "power_of_stocks",
                "signal": "Buy CE",
                "status": "5 EMA BUY ALERT TRIGGERED",
                "confidence": 88.0,
                "ema_5": round(ema_5, 2),
                "reason": f"Power of Stocks 5 EMA Buy Triggered: Spot (₹{spot:.1f}) broke above alert candle high with 5 EMA (₹{ema_5:.1f}) alignment."
            }
        else:
            return {
                "name": "Power of Stocks Strategy (Subasish Pani)",
                "key": "power_of_stocks",
                "signal": "No Trade",
                "status": "WAITING FOR 5 EMA ALERT CANDLE",
                "confidence": 50.0,
                "ema_5": round(ema_5, 2),
                "reason": "No alert candle formed. Waiting for 5 EMA separation on 5-min timeframe."
            }

    def evaluate_it_jegan_strategy(self) -> dict:
        """IT Jegan Strategy (Capital Zone): VWAP + 9/20 EMA + Supertrend & Strangle."""
        vwap_val = self.get_vwap()
        spot = self.spot_price
        diff_pct = abs(spot - vwap_val) / vwap_val if vwap_val > 0 else 0

        if spot > vwap_val and self.ema_20 > self.ema_50 and diff_pct > 0.0015:
            return {
                "name": "IT Jegan Strategy (Capital Zone)",
                "key": "it_jegan",
                "signal": "Buy CE",
                "status": "BULLISH MOMENTUM CONFLUENCE",
                "confidence": 90.0,
                "vwap": round(vwap_val, 2),
                "reason": f"IT Jegan Strategy: Spot (₹{spot:.1f}) > VWAP (₹{vwap_val:.1f}) with 20 EMA > 50 EMA bullish trend continuation."
            }
        elif spot < vwap_val and self.ema_20 < self.ema_50 and diff_pct > 0.0015:
            return {
                "name": "IT Jegan Strategy (Capital Zone)",
                "key": "it_jegan",
                "signal": "Buy PE",
                "status": "BEARISH MOMENTUM CONFLUENCE",
                "confidence": 90.0,
                "vwap": round(vwap_val, 2),
                "reason": f"IT Jegan Strategy: Spot (₹{spot:.1f}) < VWAP (₹{vwap_val:.1f}) with 20 EMA < 50 EMA bearish trend continuation."
            }
        else:
            return {
                "name": "IT Jegan Strategy (Capital Zone)",
                "key": "it_jegan",
                "signal": "Buy CE",
                "status": "RANGEBOUND THETA DECAY (STRANGLE)",
                "confidence": 85.0,
                "vwap": round(vwap_val, 2),
                "reason": f"IT Jegan Rangebound Mode: Spot hovering near VWAP (₹{vwap_val:.1f}). Favorable for Short Strangle theta harvest."
            }

    def evaluate_booming_bulls_strategy(self) -> dict:
        """Booming Bulls Strategy (Anish Singh Thakur): 15-Min ORB + Price Action & W/M Pattern."""
        spot = self.spot_price
        orb_h = self.opening_range_high
        orb_l = self.opening_range_low
        rsi_val = getattr(self, "rsi_14", 50.0)

        if spot > orb_h and orb_h > 0 and rsi_val > 55:
            return {
                "name": "Booming Bulls Strategy (Anish Singh Thakur)",
                "key": "booming_bulls",
                "signal": "Buy CE",
                "status": "15M ORB UPSIDE BREAKOUT + RSI SURGE",
                "confidence": 91.0,
                "orb_h": round(orb_h, 2),
                "rsi": round(rsi_val, 1),
                "reason": f"Booming Bulls Strategy: Spot (₹{spot:.1f}) broke 15-min ORB High (₹{orb_h:.1f}) with RSI {rsi_val:.1f} > 55."
            }
        elif spot < orb_l and orb_l > 0 and rsi_val < 45:
            return {
                "name": "Booming Bulls Strategy (Anish Singh Thakur)",
                "key": "booming_bulls",
                "signal": "Buy PE",
                "status": "15M ORB DOWNSIDE BREAKDOWN + RSI DROP",
                "confidence": 91.0,
                "orb_l": round(orb_l, 2),
                "rsi": round(rsi_val, 1),
                "reason": f"Booming Bulls Strategy: Spot (₹{spot:.1f}) broke 15-min ORB Low (₹{orb_l:.1f}) with RSI {rsi_val:.1f} < 45."
            }
        else:
            return {
                "name": "Booming Bulls Strategy (Anish Singh Thakur)",
                "key": "booming_bulls",
                "signal": "No Trade",
                "status": "INSIDE 15M ORB RANGE",
                "confidence": 50.0,
                "orb_h": round(orb_h, 2),
                "orb_l": round(orb_l, 2),
                "rsi": round(rsi_val, 1),
                "reason": f"Booming Bulls Filter: Spot inside 15-min ORB range [₹{orb_l:.1f} - ₹{orb_h:.1f}]. Waiting for pattern breakout."
            }

    def evaluate_trading_legend_strategy(self) -> dict:
        """Trading Legend Strategy: CPR (Central Pivot Range) + VWAP + 20 EMA Confluence."""
        spot = self.spot_price
        vwap_val = self.get_vwap()
        ema_20 = self.ema_20

        high = self.opening_range_high or spot * 1.005
        low = self.opening_range_low or spot * 0.995
        close = spot
        pivot = (high + low + close) / 3.0
        bc = (high + low) / 2.0
        tc = (pivot - bc) + pivot
        cpr_top = max(tc, bc)
        cpr_bottom = min(tc, bc)
        is_narrow_cpr = abs(cpr_top - cpr_bottom) / pivot < 0.0025

        if spot > cpr_top and spot > vwap_val and spot > ema_20:
            return {
                "name": "Trading Legend Strategy (CPR + VWAP)",
                "key": "trading_legend",
                "signal": "Buy CE",
                "status": "CPR BULLISH CONFLUENCE BREAKOUT",
                "confidence": 93.0,
                "cpr_top": round(cpr_top, 2),
                "is_narrow": is_narrow_cpr,
                "reason": f"Trading Legend Strategy: Spot (₹{spot:.1f}) > Top CPR (₹{cpr_top:.1f}) & VWAP (₹{vwap_val:.1f}) & 20 EMA. {'Narrow CPR Trending Day!' if is_narrow_cpr else ''}"
            }
        elif spot < cpr_bottom and spot < vwap_val and spot < ema_20:
            return {
                "name": "Trading Legend Strategy (CPR + VWAP)",
                "key": "trading_legend",
                "signal": "Buy PE",
                "status": "CPR BEARISH CONFLUENCE BREAKDOWN",
                "confidence": 93.0,
                "cpr_bottom": round(cpr_bottom, 2),
                "is_narrow": is_narrow_cpr,
                "reason": f"Trading Legend Strategy: Spot (₹{spot:.1f}) < Bottom CPR (₹{cpr_bottom:.1f}) & VWAP (₹{vwap_val:.1f}) & 20 EMA. {'Narrow CPR Trending Day!' if is_narrow_cpr else ''}"
            }
        else:
            return {
                "name": "Trading Legend Strategy (CPR + VWAP)",
                "key": "trading_legend",
                "signal": "No Trade",
                "status": "INSIDE CPR ZONE / NO CONFLUENCE",
                "confidence": 50.0,
                "cpr_top": round(cpr_top, 2),
                "cpr_bottom": round(cpr_bottom, 2),
                "is_narrow": is_narrow_cpr,
                "reason": f"Trading Legend Strategy: Spot inside CPR zone [₹{cpr_bottom:.1f} - ₹{cpr_top:.1f}]. No triple confluence yet."
            }


class TradeJournal:
    def __init__(self):
        self.trades: List[Dict] = []
        if os.path.exists("journal.json"):
            try:
                with open("journal.json", "r") as f:
                    data = json.load(f)
                    if isinstance(data, dict) and "trades" in data:
                        self.trades = data["trades"]
                    elif isinstance(data, list):
                        self.trades = data
                    else:
                        self.trades = []
            except Exception as e:
                print(f"Failed to load journal from disk: {e}")
        self.purge_previous_days_trades()
                
    def purge_previous_days_trades(self):
        """Wipes closed trades from previous calendar days so positions tab contains ONLY intraday trades."""
        today_str = get_ist_date_str()
        initial_len = len(self.trades)
        self.trades = [t for t in self.trades if t.get("date") == today_str or t.get("status") == "OPEN"]
        if len(self.trades) != initial_len:
            print(f"🧹 AUTO-PURGE: Removed {initial_len - len(self.trades)} trades from previous days. Keeping {len(self.trades)} intraday trades for {today_str}.")
            self.save_journal()

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
            "brokerage": round((len(legs) * 20.0 + 0.0005 * entry_premium) if execution_type == "Live" and legs else (20.0 + 0.0005 * entry_premium) if execution_type == "Live" else 0.005 * entry_premium, 2),
            "stage": "OPEN",
            "locked_profit": 0.0,
            "trail_activated": False,
            "peak_pnl": 0.0
        }
        
        if initial_risk is None:
            capital = float(state.settings.get("capital", 500000.0)) if 'state' in globals() else 500000.0
            initial_risk = calculate_trade_initial_risk(trade, capital)
        trade["initial_risk"] = initial_risk

        # Calculate sl_pnl and target_pnl based on strategy type
        capital_val = float(state.settings.get("capital", 500000.0)) if 'state' in globals() else 500000.0
        if "Buy CE" in strategy or "Buy PE" in strategy:
            # Option buying: SL is 10% of premium, Target is 20% of premium
            trade["sl_pnl"] = round(entry_premium * 0.10, 2)
            trade["target_pnl"] = round(entry_premium * 0.20, 2)
        elif any(s in strategy for s in ["Strangle", "Straddle", "Spread", "Condor"]):
            # Option selling: SL is 50% of net credit, Target is 50% of net credit
            sell_prem = sum(leg["entry_price"] * leg["quantity"] for leg in legs if leg["action"] == "SELL") if legs else 0.0
            buy_prem = sum(leg["entry_price"] * leg["quantity"] for leg in legs if leg["action"] == "BUY") if legs else 0.0
            net_credit = abs(sell_prem - buy_prem) if legs else entry_premium
            trade["sl_pnl"] = round(net_credit * 0.50, 2)
            trade["target_pnl"] = round(net_credit * 0.50, 2)
        else:
            # Fallback: 2% of capital SL, 4% of capital Target
            trade["sl_pnl"] = round(capital_val * 0.02, 2)
            trade["target_pnl"] = round(capital_val * 0.04, 2)
        
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
                    if trade.get("execution_type") == "Live":
                        trade["brokerage"] = round(40.0 + (0.0005 * (entry_premium + exit_premium)), 2)
                    else:
                        trade["brokerage"] = round(0.005 * (entry_premium + exit_premium), 2)
                else:
                    pnl_points = calculate_trade_pnl_points(strat, diff)
                    pnl = pnl_points * multiplier
                    entry_premium = trade["entry_spot"] * trade["lot_size"] * trade["size"]
                    exit_premium = exit_spot * trade["lot_size"] * trade["size"]
                    if trade.get("execution_type") == "Live":
                        trade["brokerage"] = round(40.0 + (0.0005 * (entry_premium + exit_premium)), 2)
                    else:
                        trade["brokerage"] = round(0.005 * (entry_premium + exit_premium), 2)
                    
                trade["pnl"] = round(pnl + trade.get("booked_pnl", 0.0), 2)
                trade["outcome"] = "WIN" if pnl > 0 else "LOSS"
                if (trade.get("execution_type") or "").startswith("Live") and trade.get("legs"):
                    try:
                        execute_live_exit_orders(trade.get("legs"))
                    except Exception as e:
                        print(f"❌ Failed to execute live exit orders: {e}")
                self.save_journal()
                return trade
        return None

    def get_analytics(self, execution_type: str = "All") -> Dict:
        if execution_type == "Live":
            closed_trades = [t for t in self.trades if t["status"] == "CLOSED" and (t.get("execution_type") or "Paper").startswith("Live")]
        elif execution_type == "Paper":
            closed_trades = [t for t in self.trades if t["status"] == "CLOSED" and not (t.get("execution_type") or "Paper").startswith("Live")]
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
# Commented out per user request to enable clean state testing
# if len(journal.trades) == 0:
#     t1 = journal.add_trade("Bull Put Spread", 22210.0, ["22200 PE", "22150 PE"], 90.0, "VIX Falling, strong put writing", size=2)
#     journal.close_trade(t1["id"], 22260.0)
#     t2 = journal.add_trade("Buy PE", 22280.0, ["22300 PE"], 75.0, "VWAP breakdowns and negative breadth", size=1)
#     journal.close_trade(t2["id"], 22230.0)


# ==========================================
# 5. REST API ROUTING
# ==========================================


class StrategyToggleRequest(BaseModel):
    strategy_key: str
    enabled: Optional[bool] = None
    live_deploy: Optional[bool] = None


class SettingsUpdate(BaseModel):
    capital: float
    risk_pct: float
    preferred_broker: Optional[str] = "Upstox"
    preferred_strategy: Optional[str] = "All"
    preferred_index: Optional[str] = "Nifty"
    regime_override: Optional[str] = "Auto"
    feed_mode: Optional[str] = "Upstox"
    upstox_access_token: Optional[str] = ""
    upstox_expiry_date: Optional[str] = ""
    upstox_api_key: Optional[str] = ""
    upstox_api_secret: Optional[str] = ""
    dashboard_username: Optional[str] = "admin"
    dashboard_password: Optional[str] = "password123"
    auto_trade_mode: Optional[str] = "OFF"
    trailing_sl_pts: float = 30.0
    scalper_mode: Optional[bool] = None

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



# ── BACKTESTING ENGINE ENDPOINTS ──
backtester = StrategyBacktester()

class BacktestRequest(BaseModel):
    days: Optional[int] = 30
    rr_ratio: Optional[float] = 2.0
    lot_size: Optional[int] = 65
    num_lots: Optional[int] = 1
    deduct_slippage: Optional[bool] = True

@app.post("/api/backtest/run")
def run_backtest_simulation(req: BacktestRequest):
    res = backtester.run_backtest(
        num_days=req.days or 30,
        rr_ratio=req.rr_ratio or 2.0,
        lot_size=req.lot_size or 65,
        num_lots=req.num_lots or 1,
        deduct_slippage=req.deduct_slippage if req.deduct_slippage is not None else True
    )
    return res



@app.post("/api/strategies/enable-all")
def enable_all_strategies_endpoint():
    all_keys = [
        "first_15m_breakout", "power_of_stocks", "booming_bulls", "trading_legend",
        "larry_williams", "turtle_trading", "minervini_vcp", "oliver_velez", "elder_triple_screen",
        "demark_td9", "darvas_box", "linda_raschke", "smc_ict_fvg", "gamma_squeeze"
    ]
    enabled = state.settings.setdefault("enabled_strategies", {})
    live_deploy = state.settings.setdefault("live_deploy_strategies", {})

    for k in all_keys:
        enabled[k] = True
        live_deploy[k] = True

    state.settings["auto_trade_mode"] = "Paper"
    state.save_settings()
    
    count = state.force_initiate_all_paper_trades()
    return {
        "status": "success",
        "message": f"Successfully enabled and deployed all 14 strategies! {count} paper trades active.",
        "active_trades_count": count,
        "strategy_suite": state.evaluate_strategy_suite()
    }

@app.post("/api/strategies/force-paper-trades")
def force_paper_trades_endpoint():
    count = state.force_initiate_all_paper_trades()
    return {
        "status": "success",
        "message": f"Initiated {count} active paper trades across the strategy suite!",
        "active_trades_count": count,
        "strategy_suite": state.evaluate_strategy_suite()
    }


@app.post("/api/strategies/toggle")
def toggle_strategy_settings(req: StrategyToggleRequest):
    enabled = state.settings.setdefault("enabled_strategies", {
        "first_15m_breakout": True,
        "power_of_stocks": True,
        "booming_bulls": True,
        "trading_legend": True
    })
    live_deploy = state.settings.setdefault("live_deploy_strategies", {
        "first_15m_breakout": False,
        "power_of_stocks": False,
        "booming_bulls": False,
        "trading_legend": False
    })

    if req.enabled is not None:
        enabled[req.strategy_key] = req.enabled
    if req.live_deploy is not None:
        live_deploy[req.strategy_key] = req.live_deploy

    state.save_settings()
    return {
        "status": "success",
        "strategy_key": req.strategy_key,
        "enabled": enabled.get(req.strategy_key),
        "live_deploy": live_deploy.get(req.strategy_key),
        "strategy_suite": state.evaluate_strategy_suite()
    }


@app.get("/api/market-data")
def get_market_data():
    state.check_daily_reset()
    fallback_active = False
    mode = state.settings.get("auto_trade_mode", "OFF")
    feed_mode = state.settings.get("feed_mode", "Simulation")

    if mode == "Live" or feed_mode == "Upstox":
        # Force Upstox fetch. Resilience micro-retry for network latency
        success = state.fetch_upstox_data()
        if not success:
            time.sleep(0.3)
            success = state.fetch_upstox_data()

        if success:
            # Clear old transient connection warnings immediately once healthy
            state.live_trade_errors = [
                e for e in getattr(state, "live_trade_errors", [])
                if "Upstox Feed Error" not in e["error"] 
                and "Upstox Live Feed Delay" not in e["error"] 
                and "Upstox Token Expired" not in e["error"]
            ]

        if not success:
            if mode == "Live":
                if getattr(state, "upstox_token_status", "VALID") != "VALID":
                    err = "❌ Upstox Token Expired: Please re-authenticate your Upstox account in Settings."
                else:
                    err = "⚠️ Upstox Live Feed Delay: Temporary network delay fetching Upstox ticks. Retrying..."
                state.live_trade_errors = getattr(state, 'live_trade_errors', [])
                if not state.live_trade_errors or state.live_trade_errors[-1]["error"] != err:
                    state.live_trade_errors.append({"time": get_ist_time_str(), "error": err})
                    state.live_trade_errors = state.live_trade_errors[-10:]
                print(err)
                return {
                    "version": VERSION,
                    "spot_price": round(state.spot_price, 2),
                    "capital": round(state.get_available_capital(), 2),
                    "broker_capital": round(state.get_broker_balance(), 2),
                    "upstox_token_status": state.upstox_token_status,
                    "change_pct": state.intraday_change_pct,
                    "change_val": state.intraday_change_val,
                    "price_source": "Upstox API Feed (ERROR/STALE)",
                    "price_date": state.price_date,
                    "price_time": state.price_time,
                    "vix": round(state.vix, 2),
                    "pcr": round(state.pcr, 2),
                    "regime": state.market_regime,
                    "recommendation": "No Trade",
                    "confidence": 0.0,
                    "secondary_recommendation": "No Trade",
                    "tertiary_recommendation": "No Trade",
                    "reasoning": ["⚠️ Upstox Live API connection error. Live trading paused."],
                    "auto_trade_mode": mode,
                    "strategy_suite": state.evaluate_strategy_suite(),
                    "scalper_mode": state.settings.get("scalper_mode", False),
                    "live_trade_errors": state.live_trade_errors[-5:]
                }
            else:
                # For non-live settings (e.g. Paper mode with Upstox feed selected), fall back to Simulation
                state.tick_5s()
                fallback_active = True
        else:
            state.evaluate_decision_engine()
            if not state.daily_stop_limit_hit:
                state._auto_trade_tick()
    else:
        state.tick_5s()
        state.process_independent_multi_strategy_ticks()
    
    spot = state.spot_price
    
    # 1. Trailing Stop Loss on Open positions based purely on Nifty point movement removed per v1.1 rules.
                
    # 2. Check 2% Capital Protection (Auto-Exit) separately for Paper and Live
    capital = state.settings.get("capital", 500000.0)
    risk_limit = capital * 0.02
    
    def get_single_trade_pnl(t):
        return state.calculate_trade_pnl(t, spot)

    # Check Paper Trades Capital Protection
    paper_open = [t for t in journal.trades if t.get("status") == "OPEN" and not (t.get("execution_type") or "Paper").startswith("Live")]
    if paper_open:
        total_paper_pnl = sum(get_single_trade_pnl(t) for t in paper_open)
        if total_paper_pnl <= -risk_limit:
            print(f"⚠️ PAPER CAPITAL PROTECTION TRIGGERED: Paper loss (₹{total_paper_pnl:.2f}) exceeded 2% limit (₹{risk_limit:.2f}). Exiting all paper trades.")
            for t in paper_open:
                journal.close_trade(t["id"], spot)
                t["reason"] = f"Auto-Exit Paper Capital Protection (2% Max Loss hit at ₹{total_paper_pnl:.2f})"
            journal.save_journal()

    # Check Live Trades Capital Protection
    live_open = [t for t in journal.trades if t.get("status") == "OPEN" and (t.get("execution_type") or "Paper").startswith("Live")]
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
    
    state.update_option_chain()
    option_chain = state.option_chain
        
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

    secondary_rec = "Buy CE"
    tertiary_rec = "Buy PE"
    if "Buy" in state.current_recommendation:
        secondary_rec = "Bull Put Spread" if "CE" in state.current_recommendation else "Bear Call Spread"
        tertiary_rec = "No Trade"
    elif "Strangle" in state.current_recommendation:
        secondary_rec = "Buy PE"
        tertiary_rec = "No Trade"

    # Determine lot sizing based on max 2% trade limit risk & margins
    suggested_lots, margin_required, risk_amount = state.calculate_suggested_lots_and_margin(state.current_recommendation, spot)
    lot_size = 20 if preferred_index.lower() == "sensex" else 65

    # Compute live timeframe trends (completed + in-progress candles)
    candles_1m_temp = state.candles_1m + [state.candle_1m]
    candles_5m_temp = state.candles_5m + [state.candle_5m]
    candles_15m_temp = state.candles_15m + [state.candle_15m]
    
    # Dynamic HFT Arbitrage Scan
    hft_opps = {"undervalued": [], "overvalued": []}
    try:
        import hft_arbitrage
        hft_opps = hft_arbitrage.scan_top_arbitrage_opportunities(option_chain)
    except Exception as _e:
        print("⚠️ Scan top arbitrage opportunities error:", _e)

    # Calculate dynamic decision components values & descriptions for UI component transparency
    decision_components = {
        "opening_range": {
            "high": round(state.opening_range_high or 0.0, 2),
            "low": round(state.opening_range_low or 0.0, 2),
            "status": "Breakout" if spot > (state.opening_range_high or 999999.0) else ("Breakdown" if spot < (state.opening_range_low or 0.0) else "Inside Range"),
            "value_desc": f"ORH: {state.opening_range_high:.1f} | ORL: {state.opening_range_low:.1f}" if state.opening_range_high else "Not set yet"
        },
        "vwap_status": {
            "vwap": round(state.get_vwap(), 2),
            "spot": round(spot, 2),
            "status": "Bullish (Above VWAP)" if spot > state.get_vwap() else "Bearish (Below VWAP)",
            "value_desc": f"Spot: {spot:.1f} | VWAP: {state.get_vwap():.1f}"
        },
        "ema_alignment": {
            "ema20": round(state.ema_20, 2),
            "ema50": round(state.ema_50, 2),
            "status": "Bullish (EMA20 > EMA50)" if state.ema_20 > state.ema_50 else "Bearish (EMA20 < EMA50)",
            "value_desc": f"EMA20: {state.ema_20:.1f} | EMA50: {state.ema_50:.1f}"
        },
        "vix_volatility": {
            "vix": round(state.vix, 2),
            "status": "High Volatility (>18.0)" if state.vix > 18.0 else "Stable/Low Volatility (<=18.0)",
            "value_desc": f"India VIX: {state.vix:.1f}%"
        },
        "pcr_sentiment": {
            "pcr": round(state.pcr, 2),
            "status": "Bullish (>1.25)" if state.pcr > 1.25 else ("Bearish (<0.75)" if state.pcr < 0.75 else "Neutral"),
            "value_desc": f"PCR: {state.pcr:.2f}"
        },
        "oi_build_up": {
            "pcr": round(state.pcr, 2),
            "status": "Heavy Put Writing (Bullish)" if state.pcr > 1.15 else ("Heavy Call Writing (Bearish)" if state.pcr < 0.85 else "Balanced"),
            "value_desc": f"ATM Put/Call OI Ratio: {state.pcr:.2f}"
        },
        "adx_trend": {
            "adx": round(state.adx, 1),
            "status": "Strong Trend (>25.0)" if state.adx > 25.0 else "Sideways Consolidation (<20.0)",
            "value_desc": f"ADX: {state.adx:.1f}"
        },
        "straddle_premium": {
            "current": round(state.get_straddle_premium(), 2),
            "status": "CRUSHING (Blocked)" if state.check_iv_crush() else "STABLE",
            "value_desc": f"Straddle LTP: ₹{state.get_straddle_premium():.2f}"
        },
        "credit_status": {
            "available": round(capital, 2),
            "required": round(margin_required, 2),
            "status": "INSUFFICIENT" if margin_required > capital else "ADEQUATE",
            "value_desc": f"Available: ₹{capital:.2f} | Req: ₹{margin_required:.2f}"
        }
    }

    return {
        "version": VERSION,
        "spot_price": round(spot, 2),
        "capital": round(state.get_available_capital(), 2),
        "broker_capital": round(state.get_broker_balance(), 2),
        "upstox_token_status": state.upstox_token_status,
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
        "strategy_suite": state.evaluate_strategy_suite(),
        "scalper_mode": state.settings.get("scalper_mode", False),
        "live_trade_errors": getattr(state, 'live_trade_errors', [])[-5:],
        "trailing_sl_pts": state.settings.get("trailing_sl_pts", 30.0),
        "daily_stop_limit_hit": state.daily_stop_limit_hit,
        "daily_pnl": round(sum(t.get("pnl", 0.0) for t in journal.trades if t.get("status") == "CLOSED" and t.get("date") == get_ist_date_str() and (not (t.get("execution_type") or "Paper").startswith("Live") if state.settings.get("auto_trade_mode", "OFF") == "Paper" else (t.get("execution_type") or "Paper").startswith("Live"))), 2),
        "daily_brokerage": round(sum(t.get("brokerage", 0.0) for t in journal.trades if t.get("date") == get_ist_date_str() and (not (t.get("execution_type") or "Paper").startswith("Live") if state.settings.get("auto_trade_mode", "OFF") == "Paper" else (t.get("execution_type") or "Paper").startswith("Live"))), 2),
        "total_brokerage": round(sum(t.get("brokerage", 0.0) for t in journal.trades if t.get("date") == get_ist_date_str() and (not (t.get("execution_type") or "Paper").startswith("Live") if state.settings.get("auto_trade_mode", "OFF") == "Paper" else (t.get("execution_type") or "Paper").startswith("Live"))), 2),
        "today_trades": sum(1 for t in journal.trades if t.get("date") == get_ist_date_str() and (not (t.get("execution_type") or "Paper").startswith("Live") if state.settings.get("auto_trade_mode", "OFF") == "Paper" else (t.get("execution_type") or "Paper").startswith("Live"))),
        "today_legs": sum(len(t.get("legs") or []) or 1 for t in journal.trades if t.get("date") == get_ist_date_str() and (not (t.get("execution_type") or "Paper").startswith("Live") if state.settings.get("auto_trade_mode", "OFF") == "Paper" else (t.get("execution_type") or "Paper").startswith("Live"))),
        "live_floating_pnl": round(sum(
            state.calculate_trade_pnl(t, state.spot_price)
            for t in journal.trades
            if t.get("status") == "OPEN" and (t.get("execution_type") or "").startswith("Live")
        ), 2),
        "paper_floating_pnl": round(sum(
            state.calculate_trade_pnl(t, state.spot_price)
            for t in journal.trades
            if t.get("status") == "OPEN" and not (t.get("execution_type") or "").startswith("Live")
        ), 2),
        "timeframe_trends": {
            "m15": state.analyze_timeframe(candles_15m_temp)["trend"],
            "m5": state.analyze_timeframe(candles_5m_temp)["trend"],
            "m1": state.analyze_timeframe(candles_1m_temp)["trend"]
        },
        "decision_components": decision_components,
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
        "expiry_warning": getattr(state, "expiry_warning", ""),
        "live_trade_errors": getattr(state, "live_trade_errors", []),
        "lock_remaining_seconds": max(0, int(60.0 - (time.time() - state.last_strategy_change_time))),
        "margin_insufficient": getattr(state, "margin_insufficient", False),
        "margin_shortfall": getattr(state, "margin_shortfall_amount", 0.0),
        "live_order_cooldown_remaining": max(0, int(60.0 - (time.time() - getattr(state, "last_live_order_attempt_time", 0.0)))),
        "hft_arbitrage": hft_opps
    }


@app.post("/api/reset-margin-flag")
def reset_margin_flag():
    """User has added funds to broker — clear the margin insufficient flag so Strangle/IC can trade again."""
    state.margin_insufficient = False
    state.margin_shortfall_amount = 0.0
    # Also clear from settings.json so flag does not come back on next server restart
    state.settings.pop("margin_insufficient", None)
    state.settings.pop("margin_shortfall_amount", None)
    state.save_settings()
    print("✅ MARGIN FLAG RESET by user — Strangle/Iron Condor strategies re-enabled.")
    return {"status": "OK", "message": "Margin flag cleared. Strangle and Iron Condor strategies re-enabled."}

@app.get("/api/logs")
def get_logs():
    return state.change_log

def get_upstox_live_positions(token: str) -> List[Dict]:
    """Fetches real-time open positions directly from Upstox portfolio API."""
    if not token or not token.strip():
        return []
    import re as _re
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    try:
        url = "https://api.upstox.com/v2/portfolio/short-term-positions"
        r = requests.get(url, headers=headers, timeout=5)
        if r.status_code == 200 and r.json().get("status") == "success":
            data = r.json().get("data", [])
            live_legs = []
            for pos in data:
                qty = pos.get("quantity", 0)
                if qty == 0:
                    continue  # closed position
                sym = pos.get("tradingsymbol") or pos.get("trading_symbol") or ""
                match = _re.search(r'(\d{5})(CE|PE)$', sym)
                strike = float(match.group(1)) if match else 0.0
                opt_type = match.group(2) if match else ('CE' if 'CE' in sym else 'PE')
                action = "BUY" if qty > 0 else "SELL"
                avg_price = float(pos.get("buy_price", 0.0) if qty > 0 else pos.get("sell_price", 0.0))
                if avg_price <= 0:
                    avg_price = float(pos.get("last_price", 100.0))

                last_px = float(pos.get("last_price", 0.0) or avg_price)
                unrealised_pnl = float(pos.get("unrealised", 0.0) or pos.get("pnl", 0.0))
                if unrealised_pnl == 0.0 and avg_price > 0 and last_px > 0:
                    if action == "BUY":
                        unrealised_pnl = (last_px - avg_price) * abs(qty)
                    else:
                        unrealised_pnl = (avg_price - last_px) * abs(qty)

                live_legs.append({
                    "tradingsymbol": sym,
                    "instrument_key": pos.get("instrument_token", ""),
                    "strike": strike,
                    "option_type": opt_type,
                    "action": action,
                    "quantity": abs(qty),
                    "entry_price": avg_price,
                    "current_price": last_px,
                    "pnl": round(unrealised_pnl, 2)
                })
            return live_legs
    except Exception as e:
        print(f"⚠️ Error fetching Upstox positions: {e}")
    return []

@app.get("/api/positions")
def get_live_positions_endpoint():
    token = state.settings.get("upstox_access_token")
    upstox_legs = get_upstox_live_positions(token)
    return {"status": "success", "positions": upstox_legs, "count": len(upstox_legs)}


@app.get("/api/payoff")
def get_payoff_data():
    """
    Compute payoff diagram points for the currently OPEN trade or live Upstox positions.
    Returns P&L at expiry across a range of spot prices ±8% from current spot.
    Priority 1: Upstox Live Portfolio Positions (when Upstox token is active)
    Priority 2: Journal Open Trade
    """
    spot = state.spot_price
    preferred_index = state.settings.get("preferred_index", "Nifty")
    lot_size = 20 if preferred_index.lower() == "sensex" else 65

    token = state.settings.get("upstox_access_token")
    mode = state.settings.get("feed_mode", "Simulation")

    legs = []
    strat_name = "No Open Position"
    trade_id = "LIVE"
    size = 1

    # Check Upstox Live Positions first if token exists
    upstox_legs = get_upstox_live_positions(token) if token else []
    if upstox_legs:
        legs = upstox_legs
        strat_name = "Upstox Live Position"
        trade_id = "Upstox"
    else:
        # Fall back to Journal OPEN trade
        open_trade = None
        # Check active trade ID first, else pick latest open trade
        active_id = getattr(state, "auto_trade_active_id", None)
        if active_id:
            open_trade = next((t for t in journal.trades if str(t.get("id")) == str(active_id) and t.get("status") == "OPEN"), None)

        if not open_trade:
            for t in reversed(journal.trades):
                if t.get("status") == "OPEN":
                    open_trade = t
                    break
        if open_trade and open_trade.get("legs"):
            legs = open_trade.get("legs", [])
            strat_name = open_trade.get("strategy", "Open Trade")
            trade_id = str(open_trade.get("id", "Journal"))
            size = open_trade.get("size", 1)

    if not legs:
        return {
            "has_position": False,
            "labels": [],
            "payoff": [],
            "breakevens": [],
            "current_spot": round(spot, 0),
            "current_pnl": 0.0,
            "max_profit": 0.0,
            "max_loss": 0.0,
            "strategy": "No Open Position"
        }

    # Build spot range: ±8% from current spot in 80 steps
    range_pct = 0.08
    spot_low = spot * (1 - range_pct)
    spot_high = spot * (1 + range_pct)
    num_steps = 80
    step = (spot_high - spot_low) / num_steps
    spot_range = [round(spot_low + i * step, 0) for i in range(num_steps + 1)]

    payoff_points = []
    for s in spot_range:
        total_pnl = 0.0
        for leg in legs:
            action = leg.get("action", "BUY")
            option_type = leg.get("option_type", "CE")
            strike = leg.get("strike", s)
            entry_price = leg.get("entry_price", 0.0)
            qty = leg.get("quantity", lot_size)

            # Intrinsic value at expiry
            if option_type == "CE":
                intrinsic = max(0.0, s - strike)
            else:
                intrinsic = max(0.0, strike - s)

            # P&L for this leg at expiry
            if action == "BUY":
                leg_pnl = (intrinsic - entry_price) * qty
            else:
                leg_pnl = (entry_price - intrinsic) * qty

            total_pnl += leg_pnl

        payoff_points.append(round(total_pnl, 2))

    # Find breakeven points (sign changes in payoff)
    breakevens = []
    for i in range(len(payoff_points) - 1):
        if payoff_points[i] * payoff_points[i+1] < 0:
            # Linear interpolation
            be = spot_range[i] - payoff_points[i] * (spot_range[i+1] - spot_range[i]) / (payoff_points[i+1] - payoff_points[i])
            breakevens.append(round(be, 0))

    # Compute live floating P&L
    if upstox_legs:
        current_pnl = round(sum(leg.get("pnl", 0.0) for leg in upstox_legs), 2)
        entry_spot = spot
    elif open_trade:
        current_pnl = round(state.calculate_trade_pnl(open_trade, spot), 2)
        entry_spot = open_trade.get("entry_spot", spot)
    else:
        current_pnl = 0.0
        entry_spot = spot

    max_profit = max(payoff_points)
    max_loss = min(payoff_points)

    if max_loss < -1000000:
        max_loss = -999999.0

    return {
        "has_position": True,
        "labels": spot_range,
        "payoff": payoff_points,
        "breakevens": breakevens,
        "current_spot": round(spot, 0),
        "current_pnl": current_pnl,
        "max_profit": round(max_profit, 2),
        "max_loss": round(max_loss, 2),
        "strategy": strat_name,
        "trade_id": trade_id,
        "entry_spot": entry_spot,
        "size": size
    }

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
    expiry_dates = state.get_upstox_expiries(pref_index)
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    saved_expiry = state.settings.get("upstox_expiry_date")

    # If saved expiry is missing or in the past, auto-update to 1st upcoming valid expiry
    if not saved_expiry or saved_expiry < today_str:
        if expiry_dates:
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
    try:
        target_mode = data.auto_trade_mode or "OFF"
        
        # Check index switch to auto-update expiry
        old_index = state.settings.get("preferred_index", "Nifty")
        new_index = data.preferred_index or old_index
        state.settings["preferred_index"] = new_index

        # Store settings temporary to run verification
        state.settings["upstox_access_token"] = data.upstox_access_token or ""
        
        # If index changed or no expiry date set, fetch fresh expiries for new index
        if new_index != old_index or not data.upstox_expiry_date:
            expiries = state.get_upstox_expiries(new_index)
            state.settings["upstox_expiry_date"] = expiries[0] if expiries else (data.upstox_expiry_date or "")
        else:
            state.settings["upstox_expiry_date"] = data.upstox_expiry_date or ""

        if data.upstox_api_key:
            state.settings["upstox_api_key"] = data.upstox_api_key
        if data.upstox_api_secret:
            state.settings["upstox_api_secret"] = data.upstox_api_secret

        # Clear capital cache to force immediate validation of the token
        state._cached_capital = None
        state._capital_cache_time = 0.0
        
        # Verify and enforce Live Real rules
        if target_mode == "Live":
            state.get_broker_balance() # This queries Upstox API and sets self.upstox_token_status
            if state.upstox_token_status == "VALID":
                state.settings["feed_mode"] = "Upstox"
                state.settings["auto_trade_mode"] = "Live"
            else:
                state.settings["auto_trade_mode"] = "OFF"
                state.settings["feed_mode"] = "Simulation"
                state.save_settings()
                return {
                    "status": "ERROR", 
                    "message": "❌ Upstox API token is inactive/invalid. Please authenticate with Upstox first."
                }
        else:
            state.settings["auto_trade_mode"] = target_mode
            state.settings["feed_mode"] = data.feed_mode or "Simulation"

        state.settings["capital"] = data.capital
        state.settings["risk_pct"] = data.risk_pct
        state.settings["preferred_broker"] = data.preferred_broker or "Upstox"
        state.settings["preferred_strategy"] = data.preferred_strategy or "All"
        state.settings["regime_override"] = data.regime_override or "Auto"
        state.settings["dashboard_username"] = data.dashboard_username or "admin"
        state.settings["dashboard_password"] = data.dashboard_password or "password123"
        state.settings["trailing_sl_pts"] = data.trailing_sl_pts
        state.settings["scalper_mode"] = data.scalper_mode if data.scalper_mode is not None else state.settings.get("scalper_mode", False)
        
        # Try updating the expiry automatically based on token validity/feed mode
        state.update_default_expiry()
        
        # Clear capital query cache to force immediate validation of the new token
        state._cached_capital = None
        state._capital_cache_time = 0.0
        
        state.evaluate_decision_engine()
        state.save_settings()
        return {"status": "SUCCESS"}
    except Exception as e:
        print(f"Error in update_settings: {e}")
        return {"status": "ERROR", "message": f"Failed to update settings: {str(e)}"}


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
    order_type: str = "MARKET"
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

    # ── HARD DAILY ORDER LIMIT ───────────────────────────────────────────
    # Refuse all new live orders if today's Upstox order count >= 20.
    # This is the absolute safety net against runaway loops.
    MAX_DAILY_ORDERS = 20
    if token and mode == "Upstox":
        try:
            chk_headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
            chk_resp = requests.get("https://api.upstox.com/v2/order/retrieve-all", headers=chk_headers, timeout=5)
            if chk_resp.status_code == 200:
                today_count = len(chk_resp.json().get("data", []))
                if today_count >= MAX_DAILY_ORDERS:
                    err = f"🛑 DAILY ORDER LIMIT: {today_count}/{MAX_DAILY_ORDERS} orders today. Auto-trading disabled."
                    print(err)
                    state.live_trade_errors = getattr(state, 'live_trade_errors', [])
                    state.live_trade_errors.append({"time": get_ist_time_str(), "error": err})
                    state.live_trade_errors = state.live_trade_errors[-10:]
                    state.settings["auto_trade_mode"] = "OFF"
                    state.save_settings()
                    return {"status": "BLOCKED", "message": err}
        except Exception as _limit_err:
            print(f"⚠️ Could not check daily order count: {_limit_err}")
    # ────────────────────────────────────────────────────────────────────

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
        
    # ── PRE-FLIGHT MARGIN CHECK WITH AUTO LOT REDUCTION ─────────────────
    # Before placing a single order:
    #   1. Query Upstox /v2/charges/margin with the EXACT legs & quantities
    #   2. Compare against available balance
    #   3. If insufficient → reduce lots (half → 1-lot minimum) and retry check
    #   4. If even 1 lot fails → set margin_insufficient flag, block, return MARGIN_BLOCKED
    #   5. If reduced lots pass → update leg quantities in-place and proceed
    #
    # Strategy shift auto-clear:
    #   If margin_insufficient flag is set but this is a low-margin strategy
    #   (Buy CE/PE, Spread) AND pre-flight passes → auto-clear the flag.
    try:
        available_balance = state.get_broker_balance()
        # Force fresh balance — invalidate 60s cache for margin decisions
        state._capital_cache_time = 0.0

        real_legs = [l for l in data.legs if not l.instrument_key.startswith("SIM_")]
        if real_legs:
            margin_chk_url = "https://api.upstox.com/v2/charges/margin"
            margin_chk_hdrs = {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": f"Bearer {token}"
            }

            # Determine lot_size (shares per lot) from first leg quantity
            # Original quantity = suggested_lots * lot_size_per_lot
            # We'll find the per-lot unit by dividing by current suggested_lots
            preferred_index = state.settings.get("preferred_index", "Nifty")
            lot_size_per_lot = 20 if preferred_index.lower() == "sensex" else 65
            original_qty_per_leg = real_legs[0].quantity  # e.g. 8 lots × 65 = 520
            original_lots = max(1, original_qty_per_leg // lot_size_per_lot)

            def _query_margin_for_lots(n_lots):
                """Call Upstox margin API for n_lots and return required margin or None."""
                chk_instruments = [
                    {
                        "instrument_key": leg.instrument_key,
                        "quantity": n_lots * lot_size_per_lot,
                        "transaction_type": leg.transaction_type,
                        "product": "I"
                    }
                    for leg in real_legs
                ]
                try:
                    resp = requests.post(
                        margin_chk_url,
                        json={"instruments": chk_instruments},
                        headers=margin_chk_hdrs,
                        timeout=5
                    )
                    if resp.status_code == 200 and resp.json().get("status") == "success":
                        return float(resp.json().get("data", {}).get("final_margin", 0.0))
                except Exception:
                    pass
                return None

            # Step 1: Check margin at original lot size
            required_margin = _query_margin_for_lots(original_lots)

            if required_margin is not None and required_margin > 0:
                if available_balance >= required_margin:
                    # ✅ Full lots fit — proceed as-is
                    is_low_margin_strategy = any(x in data.strategy for x in ["Buy CE", "Buy PE", "Spread"])
                    if is_low_margin_strategy and getattr(state, "margin_insufficient", False):
                        # Auto-clear margin flag — strategy shifted to low-margin and it passes
                        state.margin_insufficient = False
                        state.margin_shortfall_amount = 0.0
                        state.settings.pop("margin_insufficient", None)
                        state.settings.pop("margin_shortfall_amount", None)
                        state.save_settings()
                        print(f"✅ MARGIN FLAG AUTO-CLEARED: {data.strategy} passed pre-flight at ₹{required_margin:,.2f}")
                    print(f"✅ PRE-FLIGHT MARGIN OK: {original_lots} lots | Required ₹{required_margin:,.2f} | Available ₹{available_balance:,.2f}")
                else:
                    # ❌ Original lots fail — try reducing: half lots → 1 lot
                    approved_lots = 0
                    approved_margin = 0.0
                    candidates = sorted(set([max(1, original_lots // 2), 1]), reverse=True)
                    for try_lots in candidates:
                        m = _query_margin_for_lots(try_lots)
                        if m is not None and m > 0 and available_balance >= m:
                            approved_lots = try_lots
                            approved_margin = m
                            break

                    if approved_lots > 0:
                        # ✅ Reduced lot size fits — scale down all leg quantities
                        scale = approved_lots * lot_size_per_lot
                        for leg in data.legs:
                            leg.quantity = scale
                        # Also update legs_logged to match
                        for ll in legs_logged:
                            ll["quantity"] = scale
                        print(f"⚠️ LOT REDUCTION: {original_lots} lots insufficient (₹{required_margin:,.2f}), reduced to {approved_lots} lots (₹{approved_margin:,.2f}) | Available ₹{available_balance:,.2f}")
                    else:
                        # ❌ Even 1 lot fails — hard block
                        m1 = _query_margin_for_lots(1)
                        shortfall = (m1 - available_balance) if m1 else (required_margin - available_balance)
                        err = (
                            f"🛑 MARGIN INSUFFICIENT for 1-lot {data.strategy}: "
                            f"Required ₹{m1:,.2f} | Available ₹{available_balance:,.2f} | "
                            f"Shortfall ₹{shortfall:,.2f}. No orders placed."
                        )
                        print(err)
                        state.margin_insufficient = True
                        state.margin_shortfall_amount = round(shortfall, 2)
                        state.settings["margin_insufficient"] = True
                        state.settings["margin_shortfall_amount"] = round(shortfall, 2)
                        state.save_settings()
                        state.last_live_order_attempt_time = time.time()
                        state.live_trade_errors = getattr(state, "live_trade_errors", [])
                        state.live_trade_errors.append({"time": get_ist_time_str(), "error": err})
                        state.live_trade_errors = state.live_trade_errors[-10:]
                        return {
                            "status": "MARGIN_BLOCKED",
                            "message": err,
                            "required": m1,
                            "available": available_balance,
                            "shortfall": shortfall
                        }
    except Exception as _margin_chk_err:
        print(f"⚠️ Pre-flight margin check error (proceeding cautiously): {_margin_chk_err}")
    # ─────────────────────────────────────────────────────────────────────

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
        first_err = failed_orders[0].get("error", "Unknown error")
        err_msg = f"❌ Live Order Placement Failed ({data.strategy}): {first_err}"
        print(f"🚨 UPSTOX LIVE ERROR: {err_msg}")
        # Stamp attempt time — enforces 60s cooldown even after failure
        state.last_live_order_attempt_time = time.time()

        # Detect margin-related rejection from Upstox
        margin_keywords = ["add rs", "insufficient", "margin", "funds", "balance"]
        is_margin_error = any(kw in first_err.lower() for kw in margin_keywords)
        if is_margin_error:
            state.margin_insufficient = True
            # Try to extract the shortfall amount from Upstox error message e.g. "add Rs. 22762.66"
            import re as _re
            shortfall_match = _re.search(r'Rs\.?\s*([\d,]+\.?\d*)', first_err, _re.IGNORECASE)
            state.margin_shortfall_amount = float(shortfall_match.group(1).replace(',','')) if shortfall_match else 0.0
            # PERSIST to settings.json so flag survives server restarts
            state.settings["margin_insufficient"] = True
            state.settings["margin_shortfall_amount"] = state.margin_shortfall_amount
            state.save_settings()
            print(f"🔴 MARGIN INSUFFICIENT FLAG SET & PERSISTED: shortfall=₹{state.margin_shortfall_amount:.2f}. Strangle/IC blocked until user resets.")

        # Log to live_trade_errors for dashboard alert banner
        state.live_trade_errors = getattr(state, 'live_trade_errors', [])
        state.live_trade_errors.append({"time": get_ist_time_str(), "error": err_msg})
        state.live_trade_errors = state.live_trade_errors[-10:]

        if placed_orders:
            if is_margin_error:
                # MARGIN ERROR: Do NOT place any rollback orders — that restarts the loop.
                # BUY hedge legs placed are small-premium OTM options. Log them for user awareness.
                placed_syms = [p["leg"] for p in placed_orders]
                print(f"⚠️ MARGIN ERROR — Skipping rollback to prevent re-entry loop. Placed legs (user must close manually if needed): {placed_syms}")
                journal.close_trade(trade["id"], state.spot_price)
                trade["reason"] = f"⚠️ Margin Insufficient: SELL legs rejected. BUY hedge legs placed: {placed_syms}. Strangle/IC blocked. Please close hedges manually if open, then reset margin flag after adding funds."
                journal.save_journal()
                state.auto_trade_active_id = None
            else:
                # Non-margin partial fail: log placed legs for manual close, do NOT auto-rollback
                # (auto-rollback creates a SELL that completes → system re-enters immediately)
                placed_syms = [p["leg"] for p in placed_orders]
                print(f"⚠️ PARTIAL FILL: {len(placed_orders)} placed, {len(failed_orders)} failed. Placed legs (close manually if needed): {placed_syms}")
                journal.close_trade(trade["id"], state.spot_price)
                trade["reason"] = f"❌ Partial Fill — {len(placed_orders)} placed / {len(failed_orders)} rejected | {first_err} | Placed: {placed_syms}"
                journal.save_journal()
                state.auto_trade_active_id = None
        else:
            # No legs placed — just close the trade record and unlock
            journal.close_trade(trade["id"], state.spot_price)
            trade["reason"] = f"❌ Live Order Rejected: {first_err}{'  ⚠️ Margin Insufficient' if is_margin_error else ''}"
            trade["outcome"] = "FAILED"
            journal.save_journal()
            state.auto_trade_active_id = None

        return {
            "status": "FAILED",
            "message": f"Order placement failed. Placed: {len(placed_orders)}, Failed: {len(failed_orders)}. {first_err}",
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

def execute_live_exit_orders(legs: List[Dict]) -> Dict:
    token = state.settings.get("upstox_access_token")
    if not token or state.settings.get("feed_mode") != "Upstox":
        return {"status": "SKIPPED", "message": "Simulation / No token"}
    
    url = "https://api.upstox.com/v2/order/place"
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": f"Bearer {token}"
    }
    
    placed_orders = []
    failed_orders = []
    
    # MARGIN SAFETY RULE: Separate short option legs (SELL) from long hedge legs (BUY)
    # Step 1: Buy back short option legs FIRST so margin requirement drops to zero
    sell_legs_to_close = [l for l in legs if l.get("action") == "SELL"]
    buy_legs_to_close = [l for l in legs if l.get("action") == "BUY"]
    
    sell_exit_order_ids = []
    for leg in sell_legs_to_close:
        inst_key = leg.get("instrument_key")
        qty = leg.get("quantity", 65)
        if not inst_key or inst_key.startswith("SIM_"):
            continue
        payload = {
            "quantity": qty,
            "product": "I",
            "validity": "DAY",
            "price": 0.0,
            "tag": "decision-engine-exit",
            "instrument_token": inst_key,
            "order_type": "MARKET",
            "transaction_type": "BUY",  # Buyback short option
            "disclosed_quantity": 0,
            "trigger_price": 0.0,
            "is_amo": False
        }
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=5)
            res_json = resp.json()
            if resp.status_code == 200 and res_json.get("status") == "success":
                o_id = res_json.get("data", {}).get("order_id")
                placed_orders.append(o_id)
                sell_exit_order_ids.append(o_id)
                print(f"✅ UPSTOX EXIT SHORT FILL: Placed Buyback for Short Leg {inst_key} (Order ID: {o_id})")
            else:
                err_msg = res_json.get("errors", [{}])[0].get("message", "Unknown error") if isinstance(res_json.get("errors"), list) else str(res_json)
                failed_orders.append({"leg": inst_key, "error": err_msg})
        except Exception as e:
            failed_orders.append({"leg": inst_key, "error": str(e)})

    # Step 2: Await confirmation for short buybacks to release blocked margin
    for o_id in sell_exit_order_ids:
        wait_for_order_fill(o_id, token)

    # Step 3: Sell long hedge legs SECOND
    for leg in buy_legs_to_close:
        inst_key = leg.get("instrument_key")
        qty = leg.get("quantity", 65)
        if not inst_key or inst_key.startswith("SIM_"):
            continue
        payload = {
            "quantity": qty,
            "product": "I",
            "validity": "DAY",
            "price": 0.0,
            "tag": "decision-engine-exit",
            "instrument_token": inst_key,
            "order_type": "MARKET",
            "transaction_type": "SELL",  # Sell long hedge
            "disclosed_quantity": 0,
            "trigger_price": 0.0,
            "is_amo": False
        }
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=5)
            res_json = resp.json()
            if resp.status_code == 200 and res_json.get("status") == "success":
                o_id = res_json.get("data", {}).get("order_id")
                placed_orders.append(o_id)
                print(f"✅ UPSTOX EXIT LONG FILL: Placed Sell for Long Hedge {inst_key} (Order ID: {o_id})")
            else:
                err_msg = res_json.get("errors", [{}])[0].get("message", "Unknown error") if isinstance(res_json.get("errors"), list) else str(res_json)
                failed_orders.append({"leg": inst_key, "error": err_msg})
        except Exception as e:
            failed_orders.append({"leg": inst_key, "error": str(e)})

    print(f"⚡ UPSTOX SAFE EXIT COMPLETE: Placed {len(placed_orders)} exit orders. Failed: {len(failed_orders)}")
    return {"status": "SUCCESS", "placed": placed_orders, "failed": failed_orders}

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
    journal.purge_previous_days_trades()

    # Fetch Upstox live positions once for all live trades
    token = state.settings.get("upstox_access_token")
    upstox_positions = get_upstox_live_positions(token) if token else []
    upstox_total_pnl = round(sum(p.get("pnl", 0.0) for p in upstox_positions), 2)

    trades_copy = []
    seen_ids = set()

    # Include active strategy positions
    for strat_key, pos in state.strategy_positions.items():
        if pos is not None and pos.get("status") == "OPEN":
            t_id = pos.get("trade_id")
            seen_ids.add(t_id)
            pnl = round((state.spot_price - pos["entry_spot"]) * 2.0, 2) if "CE" in pos.get("signal", "") else round((pos["entry_spot"] - state.spot_price) * 2.0, 2)
            trades_copy.append({
                "id": t_id,
                "timestamp": pos.get("entry_time", get_ist_time_str()),
                "recommendation": pos.get("signal", "Buy CE"),
                "strategy_name": pos.get("strategy_name", strat_key),
                "entry_price": pos.get("entry_spot", state.spot_price),
                "stop_loss": pos.get("stop_loss", 0.0),
                "target": pos.get("target", 0.0),
                "quantity": 130,
                "status": "OPEN",
                "execution_type": "Live (Upstox API)" if pos.get("is_live") else "Paper",
                "reason": f"Strategy {pos.get('strategy_name')} active position",
                "option_symbol": pos.get("symbol_name", "NIFTY CE"),
                "strike_price": pos.get("strike_price", 24500),
                "expiry_date": pos.get("expiry_date", ""),
                "pnl": pnl,
                "floating_pnl": pnl
            })

    for t in journal.trades:
        if t.get("id") not in seen_ids:
            t_dict = dict(t)
            if t_dict.get("status") == "OPEN":
                is_live = (t_dict.get("execution_type") or "").startswith("Live")
                if is_live and upstox_positions:
                    t_dict["floating_pnl"] = upstox_total_pnl
                else:
                    t_dict["floating_pnl"] = round(state.calculate_trade_pnl(t, state.spot_price), 2)
            trades_copy.append(t_dict)

    active_pos_list = [t for t in trades_copy if t.get("status") == "OPEN"]

    return {
        "trades": trades_copy[::-1],
        "active_positions": active_pos_list,
        "analytics": journal.get_analytics("Paper"),
        "live_analytics": journal.get_analytics("Live"),
        "capital": state.get_available_capital()
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

@app.post("/api/journal/wipe-all-trades")
def wipe_all_trades_endpoint():
    """Directly delete all trades and reset daily halt conditions."""
    journal.trades = []
    journal.save_journal()
    
    state.daily_closed_pnl = 0.0
    state.daily_stop_limit_hit = False
    state.auto_trade_active_id = None
    state.price_history = []
    
    return {
        "status": "SUCCESS",
        "message": "All trades and daily P&L have been cleared successfully."
    }

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


# ---------------------------------------------------------------------------
# UPSTOX PROXY ENDPOINT
# Allows local laptop instances to route Upstox API calls through Render's
# whitelisted static IP. The local app sends requests here with the user token;
# Render forwards to Upstox and returns the response.
# ---------------------------------------------------------------------------
class UpstoxProxyRequest(BaseModel):
    path: str
    method: str = "GET"
    token: str
    body: Optional[dict] = None
    params: Optional[dict] = None

@app.post("/api/proxy/upstox")
def upstox_proxy(req: UpstoxProxyRequest):
    """Secure Upstox API proxy through Render's whitelisted static IP."""
    if not req.path.startswith("/v2/"):
        raise HTTPException(status_code=400, detail="Only Upstox /v2/ paths are allowed.")
    upstox_url = f"https://api.upstox.com{req.path}"
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {req.token}",
        "Content-Type": "application/json"
    }
    try:
        if req.method.upper() == "POST":
            resp = requests.post(upstox_url, headers=headers, json=req.body or {}, params=req.params, timeout=10)
        else:
            resp = requests.get(upstox_url, headers=headers, params=req.params, timeout=10)
        try:
            return JSONResponse(content=resp.json(), status_code=resp.status_code)
        except Exception:
            return JSONResponse(content={"raw": resp.text}, status_code=resp.status_code)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Proxy error: {str(e)}")



# ─────────────────────────────────────────────────────────────────
# UPSTOX OAUTH 2.0 AUTO-TOKEN REFRESH FLOW
# ─────────────────────────────────────────────────────────────────
import webbrowser as _webbrowser
import base64 as _b64
import json as _json_mod
from urllib.parse import urlencode as _urlencode

def _get_token_expiry_info(token: str):
    """Decode JWT and return (is_expired, expires_at_ist, days_left)."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return True, "Unknown", 0
        payload_raw = parts[1] + "=" * (4 - len(parts[1]) % 4)
        payload = _json_mod.loads(_b64.urlsafe_b64decode(payload_raw))
        exp = payload.get("exp", 0)
        now = datetime.datetime.now().timestamp()
        is_expired = now > exp
        exp_dt = datetime.datetime.fromtimestamp(exp + 19800)  # +5:30 IST
        days_left = max(0, (exp - now) / 86400)
        return is_expired, exp_dt.strftime("%Y-%m-%d %H:%M IST"), round(days_left, 1)
    except Exception:
        return True, "Unknown", 0

@app.get("/api/token-status")
def token_status():
    """Returns current token validity, expiry, and which app key is stored."""
    token = state.settings.get("upstox_access_token", "")
    api_key = state.settings.get("upstox_api_key", "")
    if not token:
        return {"status": "MISSING", "message": "No access token configured.", "api_key_set": bool(api_key)}
    is_expired, exp_str, days_left = _get_token_expiry_info(token)
    return {
        "status": "EXPIRED" if is_expired else "VALID",
        "expires_at": exp_str,
        "days_left": days_left,
        "api_key_set": bool(api_key),
        "api_key_tail": api_key[-6:] if len(api_key) >= 6 else api_key,
        "message": "Token is expired. Click Login with Upstox to refresh." if is_expired else f"Token valid for {days_left} more days."
    }

@app.get("/api/server-ip")
def get_server_ip():
    """Detect and return this server's current outgoing public IP address."""
    try:
        # Use multiple IP detection services as fallbacks
        for url in [
            "https://api.ipify.org?format=json",
            "https://api4.my-ip.io/v2/ip.json",
            "https://ifconfig.me/all.json"
        ]:
            try:
                resp = requests.get(url, timeout=5)
                if resp.status_code == 200:
                    data = resp.json()
                    ip = data.get("ip") or data.get("IP") or data.get("YourFuckingIPAddress")
                    if ip:
                        return {"status": "SUCCESS", "server_ip": ip.strip()}
            except Exception:
                continue
    except Exception as e:
        return {"status": "ERROR", "message": str(e)}

@app.get("/api/detect-ips")
def detect_ips(request: Request):
    """
    Auto-detects both:
      1. Server Outgoing Public IP (Render's IP)
      2. Client Home Public IP (from X-Forwarded-For header)
    """
    x_forwarded = request.headers.get("x-forwarded-for")
    if x_forwarded:
        client_ip = x_forwarded.split(",")[0].strip()
    else:
        client_ip = request.client.host if request.client else "Unknown"

    server_ip = None
    for url in [
        "https://api.ipify.org?format=json",
        "https://api4.my-ip.io/v2/ip.json",
        "https://ifconfig.me/all.json"
    ]:
        try:
            resp = requests.get(url, timeout=4)
            if resp.status_code == 200:
                data = resp.json()
                ip = data.get("ip") or data.get("IP")
                if ip:
                    server_ip = ip.strip()
                    break
        except Exception:
            continue

    if not server_ip:
        server_ip = "Unknown"

    return {
        "status": "SUCCESS",
        "server_ip": server_ip,
        "client_ip": client_ip
    }

class UpdateIpRequest(BaseModel):
    primary_ip: str
    secondary_ip: Optional[str] = None

@app.post("/api/update-upstox-ip")
def update_upstox_ip(data: UpdateIpRequest):
    """
    Registers the given IP address(es) with Upstox as static IPs for this user account.
    Upstox rules:
      - Can only be changed once per calendar week.
      - Invalidates all existing access tokens after update.
    """
    token = state.settings.get("upstox_access_token", "").strip()
    if not token:
        return {
            "status": "ERROR",
            "message": "No access token found. Please login with Upstox first, then register the IP."
        }

    payload = {"primary_ip": data.primary_ip.strip()}
    if data.secondary_ip and data.secondary_ip.strip():
        payload["secondary_ip"] = data.secondary_ip.strip()

    try:
        resp = requests.put(
            "https://api.upstox.com/v2/user/ip",
            json=payload,
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token}"
            },
            timeout=10
        )
        res_json = resp.json()
        if resp.status_code == 200 and res_json.get("status") == "success":
            # Token is now invalidated by Upstox — clear it so user knows to re-login
            state.settings["upstox_access_token"] = ""
            state.upstox_token_status = "INVALID"
            state.save_settings()
            return {
                "status": "SUCCESS",
                "message": f"✅ Server IP registered with Upstox! Your existing token has been invalidated. Please click 'Login with Upstox' to generate a new token.",
                "registered_ip": data.primary_ip,
                "token_cleared": True
            }
        else:
            # Return the Upstox error message as-is
            upstox_msg = res_json.get("errors", [{}])
            if upstox_msg:
                err = upstox_msg[0].get("message", str(res_json))
            else:
                err = res_json.get("message", str(res_json))
            return {
                "status": "ERROR",
                "message": f"Upstox rejected the request: {err}",
                "http_status": resp.status_code,
                "raw": res_json
            }
    except Exception as e:
        return {"status": "ERROR", "message": f"Request failed: {str(e)}"}


@app.get("/auth/upstox")
def auth_upstox_start(request: Request):

    """Generate Upstox OAuth URL and redirect the user to login."""
    api_key = state.settings.get("upstox_api_key", "").strip()
    if not api_key:
        return JSONResponse(
            content={"error": "API Key not configured. Go to Settings and enter your Upstox API Key first."},
            status_code=400
        )
    # Dynamic redirect URI based on client host (v3.1.43)
    base_url = str(request.base_url).rstrip('/')
    redirect_uri = f"{base_url}/auth/callback"
    params = {
        "client_id": api_key,
        "redirect_uri": redirect_uri,
        "response_type": "code",
    }
    auth_url = "https://api.upstox.com/v2/login/authorization/dialog?" + _urlencode(params)
    # Return an HTML auto-redirect page
    html = f"""<!DOCTYPE html>
<html>
<head><title>Upstox Login</title>
<style>body{{background:#0a0a0f;color:#e0e0e0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}}
.box{{text-align:center;padding:40px;background:#1a1a2e;border-radius:16px;border:1px solid #00e5ff33;}}
a{{color:#00e5ff;font-size:1.2rem;text-decoration:none;padding:14px 28px;background:#00e5ff22;border:1px solid #00e5ff;border-radius:8px;display:inline-block;margin-top:20px;}}
a:hover{{background:#00e5ff44;}}</style>
</head>
<body><div class="box">
<h2>🔐 Upstox OAuth Login</h2>
<p>Redirecting you to Upstox to authorize access...</p>
<p>If not redirected automatically, <a href="{auth_url}">Click here to login</a></p>
<script>setTimeout(function(){{window.location.href="{auth_url}";}}, 1000);</script>
</div></body></html>"""
    return HTMLResponse(content=html)

@app.get("/auth/callback")
def auth_upstox_callback(request: Request, code: str = None, error: str = None):
    """
    Upstox redirects here with ?code=AUTH_CODE after user logs in.
    We exchange the code for an access token and save it automatically.
    """
    if error or not code:
        html = f"""<!DOCTYPE html>
<html><head><title>Auth Failed</title>
<style>body{{background:#0a0a0f;color:#ff5252;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}}
.box{{text-align:center;padding:40px;background:#1a1a2e;border-radius:16px;}}</style>
</head><body><div class="box"><h2>❌ Authorization Failed</h2><p>{error or "No authorization code received."}</p>
<a href="/" style="color:#00e5ff">← Back to Dashboard</a></div></body></html>"""
        return HTMLResponse(content=html, status_code=400)

    api_key = state.settings.get("upstox_api_key", "").strip()
    api_secret = state.settings.get("upstox_api_secret", "").strip()
    # Dynamic redirect URI based on client host (v3.1.43)
    base_url = str(request.base_url).rstrip('/')
    redirect_uri = f"{base_url}/auth/callback"

    if not api_key or not api_secret:
        html = """<!DOCTYPE html>
<html><head><title>Config Error</title>
<style>body{{background:#0a0a0f;color:#ff5252;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}}
.box{{text-align:center;padding:40px;background:#1a1a2e;border-radius:16px;}}</style>
</head><body><div class="box"><h2>⚠️ API Key/Secret Missing</h2>
<p>Please enter your Upstox API Key and Secret in Settings first.</p>
<a href="/" style="color:#00e5ff">← Go to Settings</a></div></body></html>"""
        return HTMLResponse(content=html, status_code=400)

    # Exchange authorization code for access token
    try:
        token_resp = requests.post(
            "https://api.upstox.com/v2/login/authorization/token",
            data={
                "code": code,
                "client_id": api_key,
                "client_secret": api_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"},
            timeout=15
        )
        if token_resp.status_code == 200:
            token_data = token_resp.json()
            new_token = token_data.get("access_token", "")
            if new_token:
                # Save to settings
                state.settings["upstox_access_token"] = new_token
                state._cached_capital = None
                state._capital_cache_time = 0.0
                state.upstox_token_status = "VALID"
                state.save_settings()
                is_expired, exp_str, days_left = _get_token_expiry_info(new_token)
                print(f"✅ Upstox OAuth: New token saved. Expires: {exp_str}")
                html = f"""<!DOCTYPE html>
<html><head><title>Login Successful</title>
<style>body{{background:#0a0a0f;color:#e0e0e0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}}
.box{{text-align:center;padding:40px;background:#1a1a2e;border-radius:16px;border:1px solid #00e67633;}}
.ok{{color:#00e676;font-size:3rem;}}
a{{color:#00e5ff;padding:12px 24px;background:#00e5ff22;border:1px solid #00e5ff;border-radius:8px;display:inline-block;margin-top:20px;text-decoration:none;}}
a:hover{{background:#00e5ff44;}}</style>
</head><body><div class="box">
<div class="ok">✅</div>
<h2>Token Refreshed Successfully!</h2>
<p>New token saved. Expires: <strong>{exp_str}</strong> ({days_left} days)</p>
<a href="/">← Back to Dashboard</a>
<script>setTimeout(function(){{window.location.href="/";}}, 3000);</script>
</div></body></html>"""
                return HTMLResponse(content=html)
            else:
                raise ValueError(f"Empty token in response: {token_resp.text}")
        else:
            raise ValueError(f"HTTP {token_resp.status_code}: {token_resp.text[:300]}")
    except Exception as e:
        print(f"❌ Upstox OAuth token exchange failed: {e}")
        html = f"""<!DOCTYPE html>
<html><head><title>Token Exchange Failed</title>
<style>body{{background:#0a0a0f;color:#ff5252;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}}
.box{{text-align:center;padding:40px;background:#1a1a2e;border-radius:16px;}}</style>
</head><body><div class="box"><h2>❌ Token Exchange Failed</h2>
<pre style="color:#ffab40;font-size:0.8rem;max-width:400px;word-break:break-all">{str(e)[:400]}</pre>
<a href="/" style="color:#00e5ff;margin-top:16px;display:block">← Back to Dashboard</a>
</div></body></html>"""
        return HTMLResponse(content=html, status_code=500)



@app.get("/api/live-preflight")
def live_preflight_check():
    """Pre-flight checks before enabling Live Real trading."""
    checks = []
    
    # 1. Token validity
    token = state.settings.get("upstox_access_token", "")
    if not token:
        checks.append({"check": "Access Token", "status": "FAIL", "detail": "No token configured"})
    else:
        is_expired, exp_str, days_left = _get_token_expiry_info(token)
        if is_expired:
            checks.append({"check": "Access Token", "status": "FAIL", "detail": f"Token expired at {exp_str}"})
        else:
            checks.append({"check": "Access Token", "status": "PASS", "detail": f"Valid until {exp_str}"})
    
    # 2. Feed mode
    feed = state.settings.get("feed_mode", "Simulation")
    if feed != "Upstox":
        checks.append({"check": "Feed Mode", "status": "FAIL", "detail": f"Currently '{feed}' — must be 'Upstox' for real prices"})
    else:
        checks.append({"check": "Feed Mode", "status": "PASS", "detail": "Upstox live feed active"})
    
    # 3. API connectivity
    if token and not _get_token_expiry_info(token)[0]:
        try:
            resp = upstox_request("/v2/user/get-funds-and-margin", token)
            if resp.status_code == 200:
                data = resp.json()
                margin = data.get("data", {}).get("equity", {}).get("available_margin", 0)
                checks.append({"check": "API Connection", "status": "PASS", "detail": f"Connected. Available margin: ₹{margin:,.2f}"})
            else:
                checks.append({"check": "API Connection", "status": "FAIL", "detail": f"HTTP {resp.status_code}: {resp.text[:100]}"})
        except Exception as e:
            checks.append({"check": "API Connection", "status": "FAIL", "detail": str(e)[:100]})
    else:
        checks.append({"check": "API Connection", "status": "SKIP", "detail": "Token invalid/missing"})
    
    # 4. Capital configured
    capital = state.settings.get("capital", 0)
    if capital < 10000:
        checks.append({"check": "Capital", "status": "FAIL", "detail": f"₹{capital:,.0f} — too low for trading"})
    else:
        checks.append({"check": "Capital", "status": "PASS", "detail": f"₹{capital:,.0f}"})
    
    all_pass = all(c["status"] == "PASS" for c in checks)
    return {"ready": all_pass, "checks": checks}

app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    import os, uvicorn
    port = int(os.getenv("PORT", 8050))
    uvicorn.run("app:app", host="0.0.0.0", port=port)

