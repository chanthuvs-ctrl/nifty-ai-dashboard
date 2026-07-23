// Safe localStorage helper to prevent exceptions in private/WebView mode
const safeStorage = {
    getItem(key) {
        try { return safeStorage.getItem(key); } catch (e) { return null; }
    },
    setItem(key, value) {
        try { safeStorage.setItem(key, value); } catch (e) {}
    },
    removeItem(key) {
        try { safeStorage.removeItem(key); } catch (e) {}
    }
};

// Globals
let previousStrategy = null;
// Helper to sync three-state auto-trade buttons styling dynamically
function syncAutoTradeButtonVisuals(containerId, activeMode) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.querySelectorAll('button').forEach(btn => {
        const btnMode = btn.getAttribute('data-mode');
        if (btnMode === activeMode) {
            btn.classList.add('active');
            // Custom styling for active button
            if (activeMode === 'OFF') {
                btn.style.color = 'var(--text-primary)';
                btn.style.background = 'rgba(148, 163, 184, 0.15)';
                btn.style.boxShadow = 'none';
            } else if (activeMode === 'Paper') {
                btn.style.color = 'var(--neon-cyan)';
                btn.style.background = 'rgba(0, 229, 255, 0.08)';
                btn.style.boxShadow = '0 0 8px rgba(0, 229, 255, 0.2)';
            } else if (activeMode === 'Live') {
                btn.style.color = 'var(--neon-bear)';
                btn.style.background = 'rgba(235, 94, 85, 0.08)';
                btn.style.boxShadow = '0 0 10px rgba(235, 94, 85, 0.3)';
            }
        } else {
            btn.classList.remove('active');
            btn.style.color = 'var(--text-muted)';
            btn.style.background = 'none';
            btn.style.boxShadow = 'none';
        }
    });
}

function alignDashboardViewToMode(mode) {
    if (mode === 'Paper') {
        // Toggle P&L chart to paper
        const btnTogglePnl = document.getElementById('btn-toggle-pnl-type');
        if (btnTogglePnl && btnTogglePnl.getAttribute('data-pnl-type') !== 'paper') {
            btnTogglePnl.setAttribute('data-pnl-type', 'paper');
            btnTogglePnl.textContent = 'Paper P&L';
            btnTogglePnl.style.color = '#00d9f5';
            btnTogglePnl.style.borderColor = 'rgba(0, 217, 245, 0.4)';
            fetchChartData();
        }
        // Toggle journal tab to paper
        const tabPaper = document.getElementById('tab-paper');
        if (tabPaper) {
            switchJournalTab('paper');
        }
    } else if (mode === 'Live') {
        // Toggle P&L chart to real
        const btnTogglePnl = document.getElementById('btn-toggle-pnl-type');
        if (btnTogglePnl && btnTogglePnl.getAttribute('data-pnl-type') !== 'real') {
            btnTogglePnl.setAttribute('data-pnl-type', 'real');
            btnTogglePnl.textContent = 'Real P&L';
            btnTogglePnl.style.color = 'var(--neon-bull)';
            btnTogglePnl.style.borderColor = 'rgba(0, 229, 153, 0.4)';
            fetchChartData();
        }
        // Toggle journal tab to live
        const tabLive = document.getElementById('tab-live');
        if (tabLive) {
            switchJournalTab('live');
        }
    }
}

let audioCtx = null;
let marketPollingInterval = null;
let isEngineRunning = true;
let globalOptionChain = null;
let liveChart = null;
let livePnlChart = null;
let liveStraddleChart = null;
let chartStrategyChanges = [];

// Global Diagnostics Error Handler (Filtered to prevent Brave Shield and browser extension noise)
window.addEventListener('error', function(e) {
    const filename = e.filename || "";
    const msg = e.message || "";
    
    // Ignore generic third-party script loading issues
    if (msg.includes("Script error.") && !filename) {
        console.warn("Ignored third-party script error:", msg);
        return;
    }
    
    // Check if error originates from our application files
    const isAppScript = filename.includes("script.js") || 
                        filename.includes("academy_data.js") || 
                        filename.includes("chart.umd.js") || 
                        filename.includes("chartjs-plugin-annotation.js");
                        
    let stack = "";
    if (e.error && e.error.stack) {
        stack = e.error.stack;
    }
    const stackHasApp = stack.includes("script.js") || 
                        stack.includes("academy_data.js") || 
                        stack.includes("chart.umd.js") || 
                        stack.includes("chartjs-plugin-annotation.js");
                        
    // If the error filename matches the page URL itself, it is an injected inline script (Brave Shield spoofing, etc.)
    const isInlineOrInjected = filename === window.location.href || 
                               filename === window.location.origin || 
                               filename === window.location.origin + "/";
                               
    if (!isAppScript && !stackHasApp && (filename !== "" || isInlineOrInjected)) {
        console.warn("Ignored non-app script error:", msg, "at", filename);
        return;
    }

    const displayMsg = e.error ? (e.error.stack || e.error.message) : e.message;
    showDiagnosticError('Runtime Error: ' + displayMsg);
});

window.addEventListener('unhandledrejection', function(e) {
    const reason = e.reason || "";
    const msg = reason.stack || reason.message || reason.toString();
    
    // Filter out extensions and injected third-party rejections
    if (msg.includes("extension") || msg.includes("brave") || msg.includes("webkit")) {
        console.warn("Ignored non-app promise rejection:", msg);
        return;
    }
    
    showDiagnosticError('Promise Rejection: ' + msg);
});

function showDiagnosticError(message) {
    console.error("DIAGNOSTIC:", message);
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast toast-neutral';
    toast.style.borderColor = '#ff1744';
    toast.style.background = 'rgba(255, 23, 68, 0.12)';
    toast.style.borderWidth = '1px';
    toast.innerHTML = `
        <div class="toast-msg" style="width: 100%;">
            <strong style="display:block; color: #ff1744; letter-spacing:0.5px; font-size: 0.72rem;">DIAGNOSTIC ERROR</strong>
            <span style="font-family: monospace; font-size: 0.62rem; white-space: pre-wrap; display: block; max-height: 120px; overflow-y: auto; color: var(--text-primary); margin-top: 4px;">${message}</span>
        </div>
        <span class="toast-close" style="color: #ff1744;">&times;</span>
    `;
    container.appendChild(toast);
    toast.querySelector('.toast-close').addEventListener('click', () => toast.remove());
}
window.showDiagnosticError = showDiagnosticError;

// Initialize Web Audio Context on first interaction
function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

// Synthesize alert sound
function playAlertChime() {
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') {
            ctx.resume();
        }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        // Premium chime sound: short ascending beep
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, ctx.currentTime);
        osc.frequency.setValueAtTime(780, ctx.currentTime + 0.15);
        
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
    } catch (e) {
        console.warn("Audio Context blocked or failed:", e);
    }
}

// Book Profit / Loss triggered registry
const triggeredAlerts = {};
function triggerTradeAudioAlert(tradeId, type) {
    const key = `${tradeId}_${type}`;
    if (!triggeredAlerts[key]) {
        triggeredAlerts[key] = true;
        playAlertChime();
        // Also play a second beep slightly delayed for stop-losses to make it sound urgent!
        if (type === 'loss') {
            setTimeout(playAlertChime, 250);
        }
        showToast(
            type === 'profit' ? `🏆 PROFIT TARGET MET for Position #${tradeId}!` : `⚠️ STOP LOSS HIT for Position #${tradeId}!`,
            90,
            type === 'profit' ? 'bull' : 'bear'
        );
    }
}

// Circular canvas gauge drawer helper
function drawGauge(canvasId, value, minVal, maxVal, unit, isVix = false) {
    try {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const w = canvas.width;
        const h = canvas.height;
        
        ctx.clearRect(0, 0, w, h);
    
    const cx = w / 2;
    const cy = h - 10;
    const r = w / 2 - 12;
    
    // Draw background track
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI, false);
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#162436';
    ctx.stroke();
    
    // Draw color fill based on value ratio
    const ratio = Math.max(0, Math.min(1, (value - minVal) / (maxVal - minVal)));
    const endAngle = Math.PI + ratio * Math.PI;
    
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, endAngle, false);
    ctx.lineWidth = 8;
    
    // Color scheme
    let color = '#00e5ff'; // Cyan neutral
    if (isVix) {
        color = value > 20 ? '#ff1744' : (value < 13 ? '#00e676' : '#ffea00');
    } else {
        color = value > 1.25 ? '#00e676' : (value < 0.75 ? '#ff1744' : '#00e5ff');
    }
    
    ctx.strokeStyle = color;
    ctx.stroke();
    
    // Draw needle
    const needleLen = r - 5;
    const nx = cx + needleLen * Math.cos(endAngle);
    const ny = cy + needleLen * Math.sin(endAngle);
    
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx, ny);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    
    // Center point
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    } catch (e) {
        console.error("Error drawing gauge " + canvasId + ":", e);
    }
}

// Trigger browser push notification
function showNotification(title, message) {
    try {
        if (typeof Notification !== 'undefined' && Notification.permission === "granted") {
            new Notification(title, { body: message });
        }
    } catch (e) {
        console.warn("Notification error:", e);
    }
}

// Show Toast Alerts
function showToast(strategy, confidence, type = "neutral", title = "STRATEGY SHIFT DETECTED") {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let heading = title;
    if (strategy === "No Trade" && title === "STRATEGY SHIFT DETECTED") heading = "DECISION ENGINE HALT";
    
    toast.innerHTML = `
        <div class="toast-msg">
            <strong style="display:block; letter-spacing:0.5px;">${heading}</strong>
            <span>Strategy: <strong>${strategy}</strong> (Conf: ${confidence}%)</span>
        </div>
        <span class="toast-close">&times;</span>
    `;
    
    container.appendChild(toast);
    
    // Auto-remove toast
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(15px)';
        setTimeout(() => toast.remove(), 300);
    }, 6000);
    
    toast.querySelector('.toast-close').addEventListener('click', () => toast.remove());
}

// Helper to extract strike LTP from option chain
function getStrikeLTP(optionChain, strike, type) {
    const item = optionChain.find(x => x.strike === parseInt(strike));
    if (!item) return 0.05;
    return type === 'CE' ? item.call_price : item.put_price;
}

// Helper to extract strike key from option chain
function getStrikeKey(optionChain, strike, type) {
    const item = optionChain.find(x => x.strike === parseInt(strike));
    if (!item) return `NSE_INDEX|Nifty 50`; // Default index fallback
    return type === 'CE' ? item.call_instrument_key : item.put_instrument_key;
}

function makeLegCard(label, action, strike, type, ltp, key) {
    const isBuy = action === 'BUY';
    const color = isBuy ? 'var(--neon-bull)' : 'var(--neon-bear)';
    const actionSymbol = isBuy ? '🟢 BUY' : '🔴 SELL';
    const bg = isBuy ? 'rgba(0, 229, 153, 0.05)' : 'rgba(235, 94, 85, 0.05)';
    
    return `
        <div class="strategy-leg-card" data-key="${key}" data-strike="${strike}" data-option-type="${type}" data-action="${action}" style="flex: 1; min-width: 140px; max-width: 220px; background: ${bg}; border-left: 3px solid ${color}; padding: 8px 12px; border-radius: 4px; display: flex; flex-direction: column; gap: 2px;">
            <span style="font-size: 0.6rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">${label}</span>
            <span style="font-size: 0.82rem; font-weight: 700; color: ${color};">${actionSymbol} NIFTY ${strike} ${type}</span>
            <span style="font-size: 0.72rem; color: var(--text-primary); font-weight: 600;">LTP: ₹${ltp.toFixed(2)}</span>
        </div>
    `;
}

// Update recommended strategy legs display dynamically
function updateStrategyLegs(data) {
    const container = document.getElementById('rec-strategy-legs');
    if (!container) return;
    
    const rec = data.recommendation;
    const chain = data.option_chain;
    const atm = parseInt(data.strikes_suggested.ATM);
    
    let html = "";
    
    if (rec === "Buy CE") {
        const ltp = getStrikeLTP(chain, atm, 'CE');
        const key = getStrikeKey(chain, atm, 'CE');
        html = makeLegCard("Leg 1", "BUY", atm, "CE", ltp, key);
    } else if (rec === "Buy PE") {
        const ltp = getStrikeLTP(chain, atm, 'PE');
        const key = getStrikeKey(chain, atm, 'PE');
        html = makeLegCard("Leg 1", "BUY", atm, "PE", ltp, key);
    } else if (rec === "Bull Put Spread") {
        const sellStrike = atm;
        const buyStrike = atm - 100;
        const sellLtp = getStrikeLTP(chain, sellStrike, 'PE');
        const buyLtp = getStrikeLTP(chain, buyStrike, 'PE');
        const sellKey = getStrikeKey(chain, sellStrike, 'PE');
        const buyKey = getStrikeKey(chain, buyStrike, 'PE');
        
        html = makeLegCard("Leg 1 (Short)", "SELL", sellStrike, "PE", sellLtp, sellKey) +
               makeLegCard("Leg 2 (Long)", "BUY", buyStrike, "PE", buyLtp, buyKey);
    } else if (rec === "Bear Call Spread") {
        const sellStrike = atm;
        const buyStrike = atm + 100;
        const sellLtp = getStrikeLTP(chain, sellStrike, 'CE');
        const buyLtp = getStrikeLTP(chain, buyStrike, 'CE');
        const sellKey = getStrikeKey(chain, sellStrike, 'CE');
        const buyKey = getStrikeKey(chain, buyStrike, 'CE');
        
        html = makeLegCard("Leg 1 (Short)", "SELL", sellStrike, "CE", sellLtp, sellKey) +
               makeLegCard("Leg 2 (Long)", "BUY", buyStrike, "CE", buyLtp, buyKey);
    } else if (rec === "Short Strangle") {
        const peStrike = atm - 100;
        const ceStrike = atm + 100;
        const peLtp = getStrikeLTP(chain, peStrike, 'PE');
        const ceLtp = getStrikeLTP(chain, ceStrike, 'CE');
        const peKey = getStrikeKey(chain, peStrike, 'PE');
        const ceKey = getStrikeKey(chain, ceStrike, 'CE');
        
        html = makeLegCard("Leg 1 (Put)", "SELL", peStrike, "PE", peLtp, peKey) +
               makeLegCard("Leg 2 (Call)", "SELL", ceStrike, "CE", ceLtp, ceKey);
    } else if (rec === "Iron Condor") {
        const sellPe = atm - 100;
        const buyPe = atm - 200;
        const sellCe = atm + 100;
        const buyCe = atm + 200;
        const sellPeLtp = getStrikeLTP(chain, sellPe, 'PE');
        const buyPeLtp = getStrikeLTP(chain, buyPe, 'PE');
        const sellCeLtp = getStrikeLTP(chain, sellCe, 'CE');
        const buyCeLtp = getStrikeLTP(chain, buyCe, 'CE');
        const sellPeKey = getStrikeKey(chain, sellPe, 'PE');
        const buyPeKey = getStrikeKey(chain, buyPe, 'PE');
        const sellCeKey = getStrikeKey(chain, sellCe, 'CE');
        const buyCeKey = getStrikeKey(chain, buyCe, 'CE');
        
        html = makeLegCard("Leg 1 (Put Short)", "SELL", sellPe, "PE", sellPeLtp, sellPeKey) +
               makeLegCard("Leg 2 (Put Long)", "BUY", buyPe, "PE", buyPeLtp, buyPeKey) +
               makeLegCard("Leg 3 (Call Short)", "SELL", sellCe, "CE", sellCeLtp, sellCeKey) +
               makeLegCard("Leg 4 (Call Long)", "BUY", buyCe, "CE", buyCeLtp, buyCeKey);
    } else if (rec === "Directional Option Selling") {
        const isBull = data.regime.includes("Bull") || data.indicators.macd > 0;
        const sellStrike = atm;
        if (isBull) {
            const ltp = getStrikeLTP(chain, sellStrike, 'PE');
            const key = getStrikeKey(chain, sellStrike, 'PE');
            html = makeLegCard("Leg 1", "SELL", sellStrike, "PE", ltp, key);
        } else {
            const ltp = getStrikeLTP(chain, sellStrike, 'CE');
            const key = getStrikeKey(chain, sellStrike, 'CE');
            html = makeLegCard("Leg 1", "SELL", sellStrike, "CE", ltp, key);
        }
    } else {
        html = `
            <div style="font-size: 0.8rem; font-weight: 500; color: var(--text-muted); text-align: center; padding: 6px 0; width: 100%;">
                No active strategy legs recommended.
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// Core Market Data Fetching & UI Binder
async function fetchMarketData() {
    try {
        const resp = await fetch('/api/market-data');
        if (resp.status === 401) {
            window.location.href = '/login';
            return;
        }
        const data = await resp.json();
        
        // Indicator Pulse
        const indicator = document.getElementById('refresh-indicator');
        indicator.classList.add('updating');
        setTimeout(() => indicator.classList.remove('updating'), 500);
        
        // 1. Binder Header
        const versionBadge = document.getElementById('version-badge');
        if (versionBadge && data.version) {
            versionBadge.textContent = `PRODUCTION v${data.version}`;
        }
        const elSpot = document.getElementById('hdr-nifty-spot');
        if (elSpot) elSpot.innerText = data.spot_price.toLocaleString('en-IN', {minimumFractionDigits: 2});
        const elMeta = document.getElementById('hdr-nifty-meta');
        if (elMeta) elMeta.innerText = `${data.price_source} | ${data.price_date} ${data.price_time}`;
        
        // Update session status badge dynamically
        const badge = document.getElementById('engine-status-badge');
        if (badge && data.market_session) {
            let sessionText = data.market_session;
            let statusColor = "var(--neon-bull)";
            let statusBg = "rgba(0, 229, 153, 0.08)";
            
            if (sessionText.includes("Pre-Market")) {
                statusColor = "var(--neon-neutral)";
                statusBg = "rgba(255, 179, 0, 0.08)";
            } else if (sessionText.includes("Closed") || sessionText.includes("Weekend")) {
                statusColor = "var(--text-muted)";
                statusBg = "rgba(148, 163, 184, 0.08)";
            }
            
            badge.style.color = statusColor;
            badge.style.borderColor = statusColor;
            badge.style.background = statusBg;
            
            badge.innerHTML = `<span class="pulse-indicator" style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: ${statusColor}; box-shadow: 0 0 8px ${statusColor};"></span> ${sessionText.toUpperCase()}`;
        }
        
        // Handle Spot change drift mock based on index type
        const activeIndexSelect = document.getElementById('select-active-index');
        const activeIndex = activeIndexSelect ? activeIndexSelect.value : 'Nifty';
        const isSensex = activeIndex.toLowerCase() === 'sensex';
        
        const changePctVal = data.change_pct !== undefined ? data.change_pct : ((data.spot_price - (isSensex ? 79996.60 : 24270.85)) / (isSensex ? 79996.60 : 24270.85)) * 100;
        const changeAmtVal = data.change_val !== undefined ? data.change_val : data.spot_price - (isSensex ? 79996.60 : 24270.85);
        const changeHdr = document.getElementById('hdr-nifty-change');
        
        // Update header ticker label and option chain title dynamically
        const spotLabel = document.getElementById('hdr-spot-label');
        if (spotLabel) spotLabel.innerText = isSensex ? 'SENSEX SPOT' : 'NIFTY SPOT';
        
        const chainTitle = document.getElementById('option-chain-title');
        if (chainTitle) chainTitle.innerText = isSensex ? 'Sensex Live Option Chain' : 'Nifty Live Option Chain';
        if (changeHdr) {
            changeHdr.innerText = `${changeAmtVal >= 0 ? '+' : ''}${changeAmtVal.toFixed(2)} (${changePctVal >= 0 ? '+' : ''}${changePctVal.toFixed(2)}%)`;
            changeHdr.className = `ticker-change ${changeAmtVal >= 0 ? 'up' : 'down'}`;
        }
        
        const elHdrVix = document.getElementById('hdr-vix');
        if (elHdrVix) elHdrVix.innerText = data.vix.toFixed(2);
        const vixStatus = document.getElementById('hdr-vix-status');
        if (vixStatus) {
            vixStatus.innerText = data.vix > 18 ? 'Volatile' : 'Stable';
            vixStatus.className = `ticker-change ${data.vix > 18 ? 'down' : 'up'}`;
        }
        
        const elHdrPcr = document.getElementById('hdr-pcr');
        if (elHdrPcr) elHdrPcr.innerText = data.pcr.toFixed(2);
        const pcrStatus = document.getElementById('hdr-pcr-status');
        if (pcrStatus) {
            pcrStatus.innerText = data.pcr > 1.25 ? 'Bullish' : (data.pcr < 0.75 ? 'Bearish' : 'Neutral');
            pcrStatus.className = `ticker-change ${data.pcr > 1.25 ? 'up' : (data.pcr < 0.75 ? 'down' : '')}`;
        }
        
        const elMaxPain = document.getElementById('hdr-max-pain');
        if (elMaxPain) elMaxPain.innerText = data.indicators.max_pain;
        
        // Update timeframe trends
        if (data.timeframe_trends) {
            updateTrendBadge('trend-15m-badge', data.timeframe_trends.m15);
            updateTrendBadge('trend-5m-badge', data.timeframe_trends.m5);
            updateTrendBadge('trend-1m-badge', data.timeframe_trends.m1);
        }
        
        // 2. Regime & Indicators Panel
        const regimeBadge = document.getElementById('regime-badge');
        if (regimeBadge) {
            regimeBadge.innerText = data.regime.toUpperCase();
            
            // Color badge accordingly
            if (data.regime.includes("Bull")) {
                regimeBadge.style.borderColor = 'var(--neon-bull)';
                regimeBadge.style.color = 'var(--neon-bull)';
            } else if (data.regime.includes("Bear") || data.regime.includes("Breakdown")) {
                regimeBadge.style.borderColor = 'var(--neon-bear)';
                regimeBadge.style.color = 'var(--neon-bear)';
            } else {
                regimeBadge.style.borderColor = 'var(--neon-neutral)';
                regimeBadge.style.color = 'var(--neon-neutral)';
            }
        }
        
        // Setup regime description dynamically
        const elRegimeDesc = document.getElementById('regime-desc');
        if (elRegimeDesc) {
            let rDesc = `Spot index above VWAP: ${data.indicators.vwap}. ATR: ${data.indicators.atr}. EMA 20: ${data.indicators.ema_20}.`;
            elRegimeDesc.innerText = rDesc;
        }
        
        // Progress Bars
        const elTxtAdx = document.getElementById('txt-adx');
        if (elTxtAdx) elTxtAdx.innerText = data.indicators.adx.toFixed(1);
        const elBarAdx = document.getElementById('bar-adx');
        if (elBarAdx) elBarAdx.style.width = `${(data.indicators.adx / 60) * 100}%`;
        const elTxtRsi = document.getElementById('txt-rsi');
        if (elTxtRsi) elTxtRsi.innerText = data.indicators.rsi.toFixed(1);
        const elBarRsi = document.getElementById('bar-rsi');
        if (elBarRsi) elBarRsi.style.width = `${data.indicators.rsi}%`;
        
        // 3. Circular dials PCR & VIX
        drawGauge('canvas-pcr', data.pcr, 0.4, 1.8, '', false);
        drawGauge('canvas-vix', data.vix, 9.0, 30.0, '%', true);
        const elValPcr = document.getElementById('val-pcr');
        if (elValPcr) elValPcr.innerText = data.pcr.toFixed(2);
        const elValVix = document.getElementById('val-vix');
        if (elValVix) elValVix.innerText = `${data.vix.toFixed(1)}%`;
        
        // 4. Primary Recommendation hero card
        try {
            const recTitle = document.getElementById('rec-strategy');
            if (recTitle && data.recommendation) {
                recTitle.innerText = data.recommendation.toUpperCase();
                
                // Rec colors
                if (data.recommendation.includes("CE") || data.recommendation.includes("Bull")) {
                    recTitle.className = "rec-strategy-title text-bull";
                } else if (data.recommendation.includes("PE") || data.recommendation.includes("Bear")) {
                    recTitle.className = "rec-strategy-title text-bear";
                } else if (data.recommendation === "No Trade") {
                    recTitle.className = "rec-strategy-title text-gold";
                } else {
                    recTitle.className = "rec-strategy-title text-purple";
                }
            }
            
            const confVal = (data.confidence !== undefined && data.confidence !== null) ? data.confidence : 0.0;
            const elConfText = document.getElementById('confidence-text');
            if (elConfText) {
                elConfText.innerText = `${confVal.toFixed(1)}%`;
            }
            const elConfCircle = document.getElementById('confidence-circle');
            if (elConfCircle) {
                elConfCircle.setAttribute('stroke-dasharray', `${confVal}, 100`);
            }
        } catch (e) {
            console.error("Error updating recommendation hero card:", e);
        }
        
        // Rec Sound Alert triggers
        if (previousStrategy !== null && previousStrategy !== data.recommendation) {
            playAlertChime();
            const notificationType = data.recommendation.includes("PE") || data.recommendation.includes("Bear") ? "bear" : (data.recommendation === "No Trade" ? "neutral" : "bull");
            showToast(data.recommendation, data.confidence.toFixed(1), notificationType);
            showNotification("Strategy Alert Shift", `New strategy: ${data.recommendation} (Confidence: ${data.confidence.toFixed(1)}%)`);
        }
        previousStrategy = data.recommendation;
        
        // 5. Populate reasoning columns
        const listReasons = document.getElementById('list-reasons');
        listReasons.innerHTML = "";
        data.reasoning.forEach(r => {
            const li = document.createElement('li');
            li.innerText = r;
            listReasons.appendChild(li);
        });
        
        const listNegations = document.getElementById('list-negations');
        listNegations.innerHTML = "";
        data.negation.forEach(n => {
            const li = document.createElement('li');
            li.innerText = n;
            listNegations.appendChild(li);
        });
        
        // 6. Binder Trade Card
        document.getElementById('card-entry-zone').innerText = data.trade_card.entry_zone;
        document.getElementById('card-stop-loss').innerText = data.trade_card.stop_loss;
        document.getElementById('card-target').innerText = data.trade_card.target;
        document.getElementById('card-risk-reward').innerText = data.trade_card.risk_reward;
        document.getElementById('card-max-risk').innerText = data.trade_card.max_risk;
        document.getElementById('card-margin').innerText = data.trade_card.margin_required;
        document.getElementById('card-lots').innerText = `${data.trade_card.suggested_lots} Lot(s) (${data.trade_card.suggested_lots * data.trade_card.lot_size} Qty)`;
        document.getElementById('card-decay').innerText = data.trade_card.theta_decay;
        
        // Update recommended strategy legs
        updateStrategyLegs(data);
        
        // Handle Fallback Warning Banner
        const fallbackBanner = document.getElementById('fallback-warning-banner');
        if (fallbackBanner) {
            fallbackBanner.style.display = data.fallback_active ? 'flex' : 'none';
        }
        
        // Update AI Intelligence Banner on Homepage
        const bannerRecText = document.getElementById('banner-rec-text');
        if (bannerRecText) {
            const recVal = data.recommendation.toUpperCase();
            if (recVal !== "NO TRADE") {
                bannerRecText.innerText = `${recVal} (${data.confidence.toFixed(1)}% CONF)`;
            } else {
                bannerRecText.innerText = recVal;
            }
            if (data.recommendation.includes("CE") || data.recommendation.includes("Bull")) {
                bannerRecText.className = "banner-value text-bull";
            } else if (data.recommendation.includes("PE") || data.recommendation.includes("Bear")) {
                bannerRecText.className = "banner-value text-bear";
            } else {
                bannerRecText.className = "banner-value text-gold";
            }
        }
        const bannerConfText = document.getElementById('banner-conf-text');
        if (bannerConfText) bannerConfText.innerText = `${data.confidence.toFixed(1)}% Confidence`;
        
        const bannerEntryText = document.getElementById('banner-entry-text');
        if (bannerEntryText) bannerEntryText.innerText = data.trade_card.entry_zone;
        
        const bannerTargetText = document.getElementById('banner-target-text');
        if (bannerTargetText) bannerTargetText.innerText = data.trade_card.target;

        // Render dynamic confirmation lock badges
        const bannerLockText = document.getElementById('banner-lock-text');
        const cardLockStatus = document.getElementById('card-lock-status');
        
        const lockSec = data.lock_remaining_seconds || 0;
        let lockHTML = "";
        let lockClass = "";
        let lockColor = "";
        let lockBg = "";
        
        if (lockSec > 0) {
            lockHTML = `⏱️ LOCK: ${lockSec}s`;
            lockColor = "var(--neon-cyan)";
            lockBg = "rgba(0, 229, 255, 0.08)";
        } else {
            lockHTML = `✓ CONFIRMED SETUP`;
            lockColor = "var(--neon-bull)";
            lockBg = "rgba(0, 230, 118, 0.08)";
        }
        
        if (bannerLockText) {
            bannerLockText.innerText = lockHTML;
            bannerLockText.style.color = lockColor;
            bannerLockText.style.background = lockBg;
            bannerLockText.style.border = `1px solid ${lockColor}`;
        }
        
        if (cardLockStatus) {
            cardLockStatus.innerText = lockHTML;
            cardLockStatus.style.color = lockColor;
            cardLockStatus.style.background = lockBg;
            cardLockStatus.style.border = `1px solid ${lockColor}`;
        }

        // Render Option Buying strategies in custom table
        const optBuyBody = document.getElementById('option-buy-strategies-body');
        if (optBuyBody && data.option_buy_strategies) {
            optBuyBody.innerHTML = "";
            data.option_buy_strategies.forEach(strat => {
                const tr = document.createElement('tr');
                
                const isSignalActive = strat.status.includes("ACTIVE");
                const signalClass = isSignalActive ? (strat.action.includes("CE") ? "text-bull font-bold" : "text-bear font-bold") : "text-secondary";
                
                // Set dynamic glowing badges for signals
                let badgeStyle = "padding: 4px 8px; font-size: 0.7rem; border-radius: 4px; display: inline-block; font-weight: 700;";
                let badgeClass = "badge-pro";
                if (isSignalActive) {
                    if (strat.action.includes("CE")) {
                        badgeClass = "badge-pro btn-glow-green";
                    } else {
                        badgeClass = "badge-pro btn-glow-red";
                    }
                }
                
                tr.innerHTML = `
                    <td class="font-bold">${strat.name}</td>
                    <td class="${signalClass}" style="max-width: 250px;">${strat.reason}</td>
                    <td>${strat.suggested_lots} lots (${strat.suggested_lots * strat.lot_size} Qty)</td>
                    <td>${strat.stop_loss_points} points</td>
                    <td class="font-bold text-bear">${strat.risk_amount}</td>
                    <td>Trailing Stop (30 pts)</td>
                    <td>
                        <span class="${badgeClass}" style="${badgeStyle}">
                            ${strat.status}
                        </span>
                    </td>
                `;
                optBuyBody.appendChild(tr);
            });
        }
        
        // 7. Bind Option Chain Table
        renderOptionChain(data.option_chain, data.spot_price, data.indicators.max_pain);
        globalOptionChain = data.option_chain;
        
        // Refresh journal list & logs
        await fetchJournal();
        await fetchLogs();
        
        // Sync auto-trade header button group state
        const currentMode = data.auto_trade_mode || 'OFF';
        syncAutoTradeButtonVisuals('hdr-auto-trade-group', currentMode);
        
        // Sync Scalper visual state from server
        const scalperEnabled = data.scalper_mode || false;
        syncScalperButtonVisuals(scalperEnabled);

        // Update booked P&L + trade stats bar
        const bookedPnl = data.daily_pnl !== undefined ? data.daily_pnl : 0;
        const todayTrades = data.today_trades !== undefined ? data.today_trades : 0;
        const todayLegs = data.today_legs !== undefined ? data.today_legs : 0;
        const pnlEl = document.getElementById('stats-booked-pnl');
        const tradeEl = document.getElementById('stats-trade-count');
        const legEl = document.getElementById('stats-leg-count');
        if (pnlEl) {
            const isProfit = bookedPnl >= 0;
            pnlEl.textContent = (isProfit ? '+' : '') + '₹' + bookedPnl.toFixed(2);
            pnlEl.style.color = isProfit ? 'var(--neon-bull)' : 'var(--neon-bear)';
        }
        if (tradeEl) tradeEl.textContent = todayTrades;
        if (legEl) legEl.textContent = todayLegs;
        
        const capitalEl = document.getElementById('stats-broker-capital');
        const capitalLabelEl = document.getElementById('label-broker-capital');
        if (capitalEl) {
            const capitalVal = data.broker_capital !== undefined ? data.broker_capital : 0;
            capitalEl.textContent = '₹' + capitalVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        if (capitalLabelEl) {
            const hasToken = data && data.upstox_token_status && data.upstox_token_status !== "DISCONNECTED";
            capitalLabelEl.textContent = hasToken ? 'Live Balance' : 'Paper Capital';
        }

        const apiEl = document.getElementById('api-status-badge');
        if (apiEl) {
            const status = data.upstox_token_status || "DISCONNECTED";
            if (status === "VALID") {
                apiEl.textContent = "Upstox API: Active";
                apiEl.style.background = "rgba(0, 229, 153, 0.12)";
                apiEl.style.color = "var(--neon-bull)";
                apiEl.style.borderColor = "var(--neon-bull)";
                apiEl.classList.remove("pulse-red");
            } else if (status === "INVALID") {
                apiEl.textContent = "Upstox API: Token Expired";
                apiEl.style.background = "rgba(255, 23, 68, 0.12)";
                apiEl.style.color = "#ff1744";
                apiEl.style.borderColor = "#ff1744";
                apiEl.classList.add("pulse-red");
            } else {
                apiEl.textContent = "Upstox API: Token Missing";
                apiEl.style.background = "rgba(255, 255, 255, 0.05)";
                apiEl.style.color = "var(--text-muted)";
                apiEl.style.borderColor = "var(--border-color)";
                apiEl.classList.remove("pulse-red");
            }
        }

        const dailyBrokerageEl = document.getElementById('stats-daily-brokerage');
        const totalBrokerageEl = document.getElementById('stats-total-brokerage');
        if (dailyBrokerageEl) dailyBrokerageEl.textContent = '₹' + (data.daily_brokerage || 0.0).toFixed(2);
        if (totalBrokerageEl) totalBrokerageEl.textContent = '₹' + (data.total_brokerage || 0.0).toFixed(2);
        
        const dailyHaltBadge = document.getElementById('daily-halt-badge');
        if (dailyHaltBadge) {
            dailyHaltBadge.style.display = data.daily_stop_limit_hit ? 'flex' : 'none';
        }
        
    } catch (e) {
        console.error("Failed fetching live market data:", e);
    }
}

// Option Chain Grid Renderer
function renderOptionChain(chain, spot, maxPain) {
    const tbody = document.getElementById('option-chain-body');
    tbody.innerHTML = "";
    
    chain.forEach(opt => {
        const tr = document.createElement('tr');
        
        // Highlight class selection
        const isATM = Math.abs(opt.strike - spot) < 25;
        const isCallITM = opt.strike < spot;
        const isPutITM = opt.strike > spot;
        const isMaxPain = opt.strike === maxPain;
        
        if (isATM) tr.className = "atm-row";
        if (isMaxPain) tr.classList.add("max-pain-row");
        
        // Call columns
        const callOiLakhs = (opt.call_oi / 100000.0).toFixed(1);
        const callChgOi = (opt.call_change_oi / 1000.0).toFixed(1);
        const callChgClass = opt.call_change_oi >= 0 ? "text-bull" : "text-bear";
        
        tr.innerHTML = `
            <td class="${isCallITM ? 'itm-call' : ''}">${callOiLakhs}L</td>
            <td class="${isCallITM ? 'itm-call' : ''} ${callChgClass}">${callChgOi}k</td>
            <td class="${isCallITM ? 'itm-call' : ''} text-secondary">${opt.call_iv}</td>
            <td class="${isCallITM ? 'itm-call' : ''} ${opt.call_delta >= 0 ? 'text-bull' : 'text-bear'}">${opt.call_delta.toFixed(2)}</td>
            <td class="${isCallITM ? 'itm-call' : ''} text-bull font-bold">₹${opt.call_price.toFixed(2)}</td>
            <td class="${isCallITM ? 'itm-call' : ''} text-muted">${opt.call_bid.toFixed(2)} / ${opt.call_ask.toFixed(2)}</td>
            
            <td class="col-strike font-bold">${opt.strike}</td>
            
            <td class="${isPutITM ? 'itm-put' : ''} text-muted">${opt.put_bid.toFixed(2)} / ${opt.put_ask.toFixed(2)}</td>
            <td class="${isPutITM ? 'itm-put' : ''} text-bear font-bold">₹${opt.put_price.toFixed(2)}</td>
            <td class="${isPutITM ? 'itm-put' : ''} ${opt.put_delta >= 0 ? 'text-bull' : 'text-bear'}">${opt.put_delta.toFixed(2)}</td>
            <td class="${isPutITM ? 'itm-put' : ''} text-secondary">${opt.put_iv}</td>
            <td class="${isPutITM ? 'itm-put' : ''} ${opt.put_change_oi >= 0 ? 'text-bull' : 'text-bear'}">${(opt.put_change_oi/1000).toFixed(1)}k</td>
            <td class="${isPutITM ? 'itm-put' : ''}">${(opt.put_oi/100000).toFixed(1)}L</td>
        `;
        
        tbody.appendChild(tr);
    });

    // Fetch chart data after market data update
    fetchChartData();
}

// Synchronize client journal trades with server (backup & restore)
async function syncJournalWithServer(serverTrades) {
    if (safeStorage.getItem('prevent_restore') === 'true') {
        safeStorage.removeItem('nifty_journal_trades');
        safeStorage.removeItem('prevent_restore');
        return serverTrades;
    }
    if (serverTrades.length === 0) {
        safeStorage.removeItem('nifty_journal_trades');
        return serverTrades;
    }
    let localTrades = [];
    try {
        localTrades = JSON.parse(safeStorage.getItem('nifty_journal_trades')) || [];
    } catch (e) {
        console.error("Failed to parse local trades:", e);
    }
    
    // Check if we have local trades, and the server was reset (server has less than or equal to 2 trades, which are dummy trades)
    // or if the server doesn't have our latest local trade ID.
    const localIds = localTrades.map(t => t.id);
    const serverIds = serverTrades.map(t => t.id);
    
    const needsRestore = localTrades.length > 0 && (
        serverTrades.length <= 2 || // default dummy trades
        localTrades.length > serverTrades.length ||
        (localIds.length > 0 && !serverIds.includes(localIds[0]))
    );
    
    if (needsRestore && localTrades.length > serverTrades.length) {
        console.log("Restoring paper trades from local storage backup...");
        try {
            const resp = await fetch('/api/journal/sync', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ trades: localTrades })
            });
            const res = await resp.json();
            if (res.status === "SUCCESS") {
                return res.trades || [];
            }
        } catch (err) {
            console.error("Failed syncing journal backup:", err);
        }
    } else {
        // Save current server trades to local storage as backup
        safeStorage.setItem('nifty_journal_trades', JSON.stringify(serverTrades));
    }
    return serverTrades;
}

// Synchronize client settings configuration with server (backup & restore)
async function syncSettingsWithServer(serverSettings) {
    let localSettings = null;
    try {
        localSettings = JSON.parse(safeStorage.getItem('nifty_settings'));
        if (localSettings && localSettings.scalper_mode === undefined) {
            console.log("🧹 Outdated settings backup detected (missing scalper_mode). Clearing local cache...");
            safeStorage.removeItem('nifty_settings');
            localSettings = null;
        }
    } catch (e) {}
    
    // Check if server settings have empty token, but local storage has a token
    const serverToken = serverSettings.upstox_access_token;
    const localToken = localSettings ? localSettings.upstox_access_token : "";
    
    const needsRestore = localSettings && (
        (localToken && !serverToken) ||
        (localSettings.capital && localSettings.capital !== serverSettings.capital) ||
        (localSettings.risk_pct && localSettings.risk_pct !== serverSettings.risk_pct)
    );
    
    if (needsRestore) {
        console.log("Restoring dashboard settings from local storage backup...");
        try {
            const resp = await fetch('/api/settings', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(localSettings)
            });
            const res = await resp.json();
            if (res.status === "SUCCESS") {
                return localSettings;
            }
        } catch (err) {
            console.error("Failed syncing settings backup:", err);
        }
    } else {
        // Save current server settings to local storage as backup
        const cleanSettings = { ...serverSettings };
        delete cleanSettings.upcoming_expiry_dates; // Keep clean
        safeStorage.setItem('nifty_settings', JSON.stringify(cleanSettings));
    }
    return serverSettings;
}

// Fetch and draw Paper/Live Trading lists
async function fetchJournal() {
    try {
        const resp = await fetch('/api/journal');
        if (resp.status === 401) {
            window.location.href = '/login';
            return;
        }
        const data = await resp.json();
        
        // Synchronize with local storage backup
        const serverTrades = data.trades || [];
        const syncedTrades = await syncJournalWithServer(serverTrades);
        data.trades = syncedTrades;
        
        let capital = 500000;
        if (data.capital) {
            capital = parseFloat(data.capital);
        } else {
            try {
                const localSet = JSON.parse(safeStorage.getItem('nifty_settings'));
                if (localSet && localSet.capital) {
                    capital = parseFloat(localSet.capital);
                } else {
                    const capInput = document.getElementById('set-capital');
                    if (capInput) capital = parseFloat(capInput.value) || 500000;
                }
            } catch (e) {
                capital = 500000;
            }
        }
        
        // We fetch the current live Nifty spot from our header
        const currentSpotText = document.getElementById('hdr-nifty-spot').innerText.replace(/,/g, '');
        const currentSpot = parseFloat(currentSpotText) || 24270.85;
        
        // 1. Draw Analytics Widgets (Paper)
        if (data.analytics) {
            document.getElementById('an-win-rate').innerText = data.analytics.win_rate;
            document.getElementById('an-profit-factor').innerText = data.analytics.profit_factor;
            document.getElementById('an-drawdown').innerText = data.analytics.drawdown;
            document.getElementById('an-best-strat').innerText = data.analytics.best_strategy;
        }
        
        // Draw Analytics Widgets (Live)
        if (data.live_analytics) {
            document.getElementById('live-an-win-rate').innerText = data.live_analytics.win_rate;
            document.getElementById('live-an-profit-factor').innerText = data.live_analytics.profit_factor;
            document.getElementById('live-an-drawdown').innerText = data.live_analytics.drawdown;
            document.getElementById('live-an-best-strat').innerText = data.live_analytics.best_strategy;
        }
        
        // Filter trades
        const activePaper = data.trades.filter(t => t.status === "OPEN" && !(t.execution_type && t.execution_type.startsWith("Live")));
        const activeLive = data.trades.filter(t => t.status === "OPEN" && (t.execution_type && t.execution_type.startsWith("Live")));
        const closedPaper = data.trades.filter(t => t.status === "CLOSED" && !(t.execution_type && t.execution_type.startsWith("Live")));
        const closedLive = data.trades.filter(t => t.status === "CLOSED" && (t.execution_type && t.execution_type.startsWith("Live")));
        
        // Helper to render active positions
        let totalPaperPnl = 0.0;
        let totalLivePnl = 0.0;
        const renderActive = (tbodyId, list, typeLabel, typeColor) => {
            const body = document.getElementById(tbodyId);
            if (!body) return;
            body.innerHTML = "";
            if (list.length === 0) {
                body.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--text-muted)">No active ${typeLabel.toLowerCase()} trades right now.</td></tr>`;
            } else {
                list.forEach(pos => {
                    const tr = document.createElement('tr');
                    
                    const entry = pos.entry_spot;
                    const size = pos.size;
                    const lotSize = pos.lot_size || 65;
                    const multiplier = lotSize * size;
                    
                    // Sum up all leg P&Ls for exact option P&L calculation
                    const legs = ensureLegs(pos, globalOptionChain);
                    let totalPnl = pos.booked_pnl || 0.0;
                    legs.forEach(leg => {
                        const legLtp = getLegLtp(globalOptionChain, leg.instrument_key, leg.option_type, leg.strike) || leg.entry_price;
                        const legDiff = legLtp - leg.entry_price;
                        if (leg.action === 'BUY') {
                            totalPnl += legDiff * leg.quantity;
                        } else {
                            totalPnl -= legDiff * leg.quantity;
                        }
                    });
                    if (typeLabel === 'PAPER') {
                        totalPaperPnl += totalPnl;
                    } else {
                        totalLivePnl += totalPnl;
                    }
                    
                    // Target Profit / Stop Loss alerting
                    const isSpreadOrShort = pos.strategy.includes("Spread") || pos.strategy.includes("Short") || pos.strategy.includes("Condor");
                    const tpThreshold = isSpreadOrShort ? 2500 * size : 1500 * size;
                    const slThreshold = isSpreadOrShort ? -1250 * size : -750 * size;
                    
                    let alertBadge = "";
                    let btnClass = "btn-secondary";
                    let btnText = "Close";
                    
                    if (totalPnl >= tpThreshold) {
                        alertBadge = `<span class="badge-pro pulse-green" style="background: rgba(0, 230, 118, 0.15); color: #00e676; border: 1px solid #00e676; font-size: 0.58rem; padding: 2px 5px; margin-left: 6px;">🏆 BOOK PROFIT</span>`;
                        btnClass = "btn-glow-green";
                        btnText = "Book Profit";
                        triggerTradeAudioAlert(pos.id, 'profit');
                    } else if (totalPnl <= slThreshold) {
                        alertBadge = `<span class="badge-pro pulse-red" style="background: rgba(255, 23, 68, 0.15); color: #ff1744; border: 1px solid #ff1744; font-size: 0.58rem; padding: 2px 5px; margin-left: 6px;">⚠️ BOOK LOSS</span>`;
                        btnClass = "btn-glow-red";
                        btnText = "Book Loss";
                        triggerTradeAudioAlert(pos.id, 'loss');
                    }
                    
                    const typeBadge = `<span class="badge-pro" style="background: rgba(${typeColor}, 0.12); color: rgb(${typeColor}); border: 1px solid rgb(${typeColor}); font-size: 0.58rem; padding: 2px 5px; margin-left: 6px;">${typeLabel}</span>`;
                    
                    
                    const targetVal = pos.half_booked ? "50% Trailed" : `₹${(capital * 0.04).toFixed(2)}`;
                    const slVal = pos.half_booked ? "₹0.00 (Breakeven)" : `-₹${(capital * 0.02).toFixed(2)}`;
                    
                    let stageInfo = `<div style="font-size:0.65rem; color:var(--text-muted); margin-top:4px; width:100%; display:flex; gap:8px; font-weight:normal; font-family:monospace; flex-wrap:wrap;">
                        <span>Target: <strong style="color:var(--neon-cyan);">${targetVal}</strong></span>
                        <span>SL: <strong style="color:var(--neon-bear);">${slVal}</strong></span>
                        ${pos.stage ? `<span>Stage: <strong style="color:var(--neon-accent);">${pos.stage}</strong></span>` : ''}
                    </div>`;
                    
                    tr.innerHTML = `
                        <td>${pos.time}</td>
                        <td class="font-bold" style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                            <div style="display:flex; align-items:center; gap:4px; width:100%;">${pos.strategy} ${typeBadge} ${alertBadge}</div>
                            ${stageInfo}
                        </td>
                        <td>${pos.strikes.join(', ')}</td>
                        <td>₹${entry.toFixed(2)}</td>
                        <td>${size} lot(s)</td>
                        <td>₹${currentSpot.toFixed(2)}</td>
                        <td class="font-bold ${totalPnl >= 0 ? 'text-bull' : 'text-bear'}">₹${totalPnl.toFixed(2)}</td>
                        <td style="color: var(--text-muted);">₹${(pos.brokerage || 0.0).toFixed(2)}</td>
                        <td>
                            <button class="btn ${btnClass} btn-close-pos" data-id="${pos.id}" data-exit="${currentSpot}">
                                ${btnText}
                            </button>
                        </td>
                    `;
                    body.appendChild(tr);
                    
                    // Append detail row for each option leg!
                    legs.forEach(leg => {
                        const legLtp = getLegLtp(globalOptionChain, leg.instrument_key, leg.option_type, leg.strike) || leg.entry_price;
                        const legDiff = legLtp - leg.entry_price;
                        let legPnl = 0.0;
                        if (leg.action === 'BUY') {
                            legPnl = legDiff * leg.quantity;
                        } else {
                            legPnl = -legDiff * leg.quantity;
                        }
                        
                        const legTr = document.createElement('tr');
                        legTr.style.background = 'rgba(255, 255, 255, 0.015)';
                        legTr.style.fontSize = '0.76rem';
                        legTr.style.borderLeft = leg.action === 'BUY' ? '3px solid rgb(0, 217, 245)' : '3px solid rgb(255, 78, 120)';
                        
                        legTr.innerHTML = `
                            <td></td>
                            <td style="padding-left: 15px; color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
                                <span class="badge-pro" style="background: ${leg.action === 'BUY' ? 'rgba(0, 230, 118, 0.12)' : 'rgba(255, 23, 68, 0.12)'}; color: ${leg.action === 'BUY' ? '#00e676' : '#ff1744'}; padding: 1px 4px; font-size: 0.55rem; border: 1px solid ${leg.action === 'BUY' ? 'rgba(0, 230, 118, 0.3)' : 'rgba(255, 23, 68, 0.3)'}">${leg.action}</span>
                                <span style="font-weight: 600;">NIFTY ${leg.strike} ${leg.option_type} ${leg.expiry ? `(Exp: ${leg.expiry})` : ''}</span>
                            </td>
                            <td style="color: var(--text-muted); font-size: 0.65rem; font-family: monospace;">${leg.instrument_key.split('|')[1] || leg.instrument_key}</td>
                            <td style="color: var(--text-muted);">Entry: ₹${leg.entry_price.toFixed(2)}</td>
                            <td style="color: var(--text-muted);">${leg.quantity} Qty</td>
                            <td style="color: var(--text-muted);">LTP: ₹${legLtp.toFixed(2)}</td>
                            <td class="font-bold ${legPnl >= 0 ? 'text-bull' : 'text-bear'}">₹${legPnl.toFixed(2)}</td>
                            <td></td>
                        `;
                        body.appendChild(legTr);
                    });
                });
            }
        };
        
        // Helper to render closed positions
        const renderClosed = (tbodyId, list, typeLabel, typeColor) => {
            const body = document.getElementById(tbodyId);
            if (!body) return;
            body.innerHTML = "";
            if (list.length === 0) {
                body.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-muted)">No closed ${typeLabel.toLowerCase()} trade logs.</td></tr>`;
            } else {
                list.forEach(pos => {
                    const tr = document.createElement('tr');
                    const typeBadge = `<span class="badge-pro" style="background: rgba(${typeColor}, 0.12); color: rgb(${typeColor}); border: 1px solid rgb(${typeColor}); font-size: 0.58rem; padding: 2px 5px; margin-left: 6px;">${typeLabel}</span>`;
                    
                    
                    const targetVal = `₹${(capital * 0.04).toFixed(2)}`;
                    const slVal = `-₹${(capital * 0.02).toFixed(2)}`;
                    const closedInfo = `<div style="font-size:0.6rem; color:var(--text-muted); margin-top:2px; font-family:monospace;">Tgt: ${targetVal} | SL: ${slVal}</div>`;
                    
                    const netPnl = pos.pnl - (pos.brokerage || 0.0);
                    tr.innerHTML = `
                        <td>${pos.date} ${pos.time}</td>
                        <td class="font-bold" style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                            <div>${pos.strategy} ${typeBadge}</div>
                            ${closedInfo}
                        </td>
                        <td>₹${pos.entry_spot.toFixed(2)}</td>
                        <td>₹${pos.exit_spot.toFixed(2)}</td>
                        <td class="font-bold ${netPnl >= 0 ? 'text-bull' : 'text-bear'}">₹${netPnl.toFixed(2)}</td>
                        <td style="color: var(--text-muted);">₹${(pos.brokerage || 0.0).toFixed(2)}</td>
                        <td><span class="badge-pro" style="background:${netPnl >= 0 ? 'rgba(0,230,118,0.1)' : 'rgba(255,23,68,0.1)'}">${netPnl >= 0 ? 'WIN' : 'LOSS'}</span></td>
                        <td class="text-secondary">${pos.reason}</td>
                    `;
                    body.appendChild(tr);
                });
            }
        };
        
        // Render all 4 lists
        renderActive('journal-active-body', activePaper, 'PAPER', '0, 217, 245');
        renderActive('live-journal-active-body', activeLive, 'LIVE', '0, 229, 153');
        renderClosed('journal-closed-body', closedPaper, 'PAPER', '0, 217, 245');
        renderClosed('live-journal-closed-body', closedLive, 'LIVE', '0, 229, 153');
        
        // Update Header Ticker Running P&Ls
        const paperPnlElem = document.getElementById('hdr-paper-pnl');
        if (paperPnlElem) {
            paperPnlElem.innerText = (totalPaperPnl >= 0 ? '+' : '') + `₹${totalPaperPnl.toFixed(2)}`;
            if (totalPaperPnl > 0) {
                paperPnlElem.style.color = "var(--neon-bull)";
            } else if (totalPaperPnl < 0) {
                paperPnlElem.style.color = "var(--neon-bear)";
            } else {
                paperPnlElem.style.color = "var(--text-muted)";
            }
        }
        
        const livePnlElem = document.getElementById('hdr-live-pnl');
        if (livePnlElem) {
            livePnlElem.innerText = (totalLivePnl >= 0 ? '+' : '') + `₹${totalLivePnl.toFixed(2)}`;
            if (totalLivePnl > 0) {
                livePnlElem.style.color = "var(--neon-bull)";
                livePnlElem.style.textShadow = "0 0 10px rgba(0, 229, 153, 0.2)";
            } else if (totalLivePnl < 0) {
                livePnlElem.style.color = "var(--neon-bear)";
                livePnlElem.style.textShadow = "0 0 10px rgba(235, 94, 85, 0.2)";
            } else {
                livePnlElem.style.color = "var(--text-muted)";
                livePnlElem.style.textShadow = "none";
            }
        }
        
        // Add close buttons click events for both active lists
        document.querySelectorAll('.btn-close-pos').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                const exitSpot = parseFloat(e.target.getAttribute('data-exit'));
                await closePaperPosition(id, exitSpot);
            });
        });
        
    } catch (e) {
        console.error("Failed fetching paper trade journal:", e);
    }
}

// Fetch and draw Strategy Change Logs
async function fetchLogs() {
    try {
        const resp = await fetch('/api/logs');
        if (resp.status === 401) {
            window.location.href = '/login';
            return;
        }
        const logs = await resp.json();
        
        const timeline = document.getElementById('timeline-log');
        timeline.innerHTML = "";
        
        if (logs.length === 0) {
            timeline.innerHTML = `<div style="text-align:center; color:var(--text-muted); font-size:0.75rem; padding:20px 0;">No strategy shifts logged yet.</div>`;
            return;
        }
        
        // Reverse to show latest changes on top
        logs.slice().reverse().forEach((log, index) => {
            const div = document.createElement('div');
            div.className = `timeline-item ${index === 0 ? 'active-tl' : ''}`;
            
            div.innerHTML = `
                <div class="tl-time">${log.time}</div>
                <div class="tl-content">
                    <div class="tl-strategy">${log.prev_strategy} &rarr; <span class="text-bull font-bold">${log.new_strategy}</span></div>
                    <div class="tl-meta">Trigger: ${log.reason} • Conf: ${log.confidence}</div>
                    <div class="tl-meta" style="color:var(--text-muted)">${log.indicators_changed}</div>
                </div>
            `;
            timeline.appendChild(div);
        });
    } catch (e) {
        console.error("Failed fetching change log timeline:", e);
    }
}

// Add paper trade action
async function executePaperTrade() {
    try {
        // Fetch current UI stats
        const strategy = document.getElementById('rec-strategy').innerText;
        if (strategy === "NO TRADE") {
            alert("No trade can be entered when recommendation is 'No Trade' / confidence below 65%.");
            return;
        }
        
        const currentSpot = parseFloat(document.getElementById('hdr-nifty-spot').innerText.replace(/,/g, ''));
        const confidenceText = document.getElementById('confidence-text').innerText.replace('%', '');
        const confidence = parseFloat(confidenceText);
        
        // Strikes suggestion extract
        const table = document.getElementById('option-chain-table');
        const strikes = [];
        
        let lotString = document.getElementById('card-lots').innerText;
        let lots = parseInt(lotString.split(' ')[0]) || 1;
        
        // Extract option legs from DOM cards
        const legCards = document.querySelectorAll('#rec-strategy-legs .strategy-leg-card');
        const legs = [];
        const preferredIndex = document.getElementById('hdr-nifty-spot').innerText.includes('SENSEX') ? 'SENSEX' : 'NIFTY';
        const lotSize = preferredIndex === 'SENSEX' ? 20 : 65;
        const totalQuantity = lots * lotSize;
        
        legCards.forEach(card => {
            const key = card.getAttribute('data-key');
            const strike = parseFloat(card.getAttribute('data-strike'));
            const optType = card.getAttribute('data-option-type');
            const action = card.getAttribute('data-action');
            
            // Extract entry price from LTP text (e.g. "LTP: ₹123.45")
            const ltpText = card.querySelector('span:nth-child(3)').innerText;
            const entryPrice = parseFloat(ltpText.split('₹')[1]) || 0.0;
            
            legs.push({
                instrument_key: key,
                strike: strike,
                option_type: optType,
                action: action,
                entry_price: entryPrice,
                quantity: totalQuantity
            });
        });
        
        const atmVal = Math.round(currentSpot / 50.0) * 50;
        const req = {
            strategy: strategy,
            entry_spot: currentSpot,
            strikes: legs.length > 0 ? legs.map(l => `${l.action} ${l.strike} ${l.option_type}`) : [`${atmVal} Strike`],
            confidence: confidence,
            reason: `Manual execution on strategy decision engine trigger`,
            size: lots,
            legs: legs.length > 0 ? legs : null
        };
        
        // Play Audio
        getAudioContext(); // Initialize audio context
        
        const resp = await fetch('/api/journal/trade', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(req)
        });
        
        const res = await resp.json();
        if (res.status === "SUCCESS") {
            showToast(strategy, confidence, "bull", "PAPER TRADE RECORDED");
            playAlertChime();
            await fetchJournal();
        }
    } catch (e) {
        console.error("Error executing paper trade:", e);
    }
}

// Add live trade execution
async function executeLiveTrade() {
    try {
        const strategy = document.getElementById('rec-strategy').innerText;
        if (strategy === "NO TRADE") {
            alert("No live trade can be entered when recommendation is 'No Trade'.");
            return;
        }
        
        // Find all strategy-leg-card elements
        const legElements = document.querySelectorAll('.strategy-leg-card');
        if (legElements.length === 0) {
            alert("No active option legs loaded to execute.");
            return;
        }
        
        // Extract quantity from suggested lots
        let lotString = document.getElementById('card-lots').innerText;
        let lots = parseInt(lotString.split(' ')[0]) || 1;
        // Standard Nifty lot size is 65
        let totalQuantity = lots * 65;
        
        // Build legs array
        const legs = [];
        legElements.forEach(el => {
            const key = el.getAttribute('data-key');
            const strike = parseInt(el.getAttribute('data-strike'));
            const optType = el.getAttribute('data-option-type');
            const action = el.getAttribute('data-action');
            
            const ltpText = el.querySelector('span:nth-child(3)').innerText;
            const entryPrice = parseFloat(ltpText.split('₹')[1]) || 0.0;
            
            legs.push({
                instrument_key: key,
                quantity: totalQuantity,
                transaction_type: action,
                order_type: 'MARKET',
                price: entryPrice,
                strike: strike,
                option_type: optType
            });
        });
        
        // Confirm from user before live execution
        const legText = legs.map(l => `${l.transaction_type} ${l.quantity} Qty NIFTY ${l.strike || ''} ${l.option_type || ''} (Key: ${l.instrument_key.split('|')[1] || l.instrument_key})`).join('\n');
        const proceed = confirm(`⚠️ WARNING: CONFIRM LIVE TRADE EXECUTION?\n\nThis will place market orders for the following legs:\n\n${legText}\n\nDo you want to proceed?`);
        if (!proceed) return;
        
        // Play Audio
        getAudioContext();
        
        const req = {
            strategy: strategy,
            legs: legs
        };
        
        const resp = await fetch('/api/execute-live', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(req)
        });
        
        const res = await resp.json();
        if (res.status === "SUCCESS") {
            showToast("LIVE ORDER PLACED", 100, "bull", "LIVE TRADE EXECUTED");
            playAlertChime();
            alert(`Live Trade Executed successfully!\n\n${res.message}`);
            await fetchJournal();
        } else {
            showToast("LIVE ORDER FAILED", 0, "bear", "LIVE TRADE FAILED");
            let details = "";
            if (res.failed && res.failed.length > 0) {
                details = "\n\nDetails:\n" + res.failed.map(f => `- ${f.leg}: ${f.error}`).join('\n');
            }
            alert(`Live Trade execution failed/completed partially:\n\n${res.message}${details}`);
            await fetchJournal();
        }
    } catch (e) {
        console.error("Error executing live trade:", e);
        alert("Error executing live trade: " + e.message);
    }
}

// Close active position
async function closePaperPosition(tradeId, exitSpot) {
    try {
        const resp = await fetch('/api/journal/close', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                trade_id: tradeId,
                exit_spot: exitSpot
            })
        });
        const res = await resp.json();
        if (res.status === "SUCCESS") {
            playAlertChime();
            await fetchJournal();
        }
    } catch (e) {
        console.error("Error closing trade position:", e);
    }
}

// Upstox fields are always visible — this function is kept for compatibility but does nothing
function toggleUpstoxFields(mode) {
    // Fields are permanently visible; feed mode handled by select
}

// ── Step Wizard Helpers ──────────────────────────────────────────
// Toggle step body visibility (accordion)
function toggleStep(bodyId) {
    const body = document.getElementById(bodyId);
    if (!body) return;
    body.style.display = body.style.display === 'none' ? 'block' : 'none';
}

// Mark Step 2 as done (manual confirmation)
function markStep2Done() {
    try { localStorage.setItem('upstox_step2_done', '1'); } catch(e) {}
    setStepComplete(2);
    const btn = document.getElementById('btn-step2-done');
    if (btn) { btn.textContent = '✅ Redirect URL Registered'; btn.disabled = true; btn.style.opacity = '0.7'; }
    const body = document.getElementById('step2-body');
    if (body) body.style.display = 'none';
}

// Skip Step 4 (shared IP / optional)
function skipStep4() {
    try { localStorage.setItem('upstox_step4_skipped', '1'); } catch(e) {}
    setStepComplete(4);
    const status = document.getElementById('step-status-4');
    if (status) { status.textContent = '⏭️ SKIPPED'; status.style.color = 'var(--text-muted)'; }
    const resultEl = document.getElementById('ip-register-result');
    if (resultEl) {
        resultEl.style.display = 'block';
        resultEl.style.color = 'var(--text-muted)';
        resultEl.style.background = 'rgba(255,255,255,0.03)';
        resultEl.style.border = '1px dashed rgba(255,255,255,0.15)';
        resultEl.innerHTML = 'ℹ️ Step 4 skipped. You can proceed with standard Upstox Login (Step 3).';
    }
    const body = document.getElementById('step4-body');
    if (body) body.style.display = 'none';
}

// Set a step's visual to COMPLETE (green) / ACTIVE (cyan) / PENDING (gray)
function setStepState(num, state) {
    const badge = document.getElementById(`step-badge-${num}`);
    const status = document.getElementById(`step-status-${num}`);
    const card = document.getElementById(`account-step-${num}`);
    if (!badge || !status) return;
    if (state === 'complete') {
        badge.textContent = '✓';
        badge.style.background = 'rgba(0,230,118,0.2)';
        badge.style.borderColor = '#00e676';
        badge.style.color = '#00e676';
        status.textContent = '✅ DONE';
        status.style.color = '#00e676';
        if (card) card.style.borderColor = 'rgba(0,230,118,0.25)';
    } else if (state === 'active') {
        badge.textContent = num;
        badge.style.background = 'rgba(0,229,255,0.15)';
        badge.style.borderColor = 'var(--neon-cyan)';
        badge.style.color = 'var(--neon-cyan)';
        status.textContent = '▶ ACTION';
        status.style.color = 'var(--neon-cyan)';
        if (card) card.style.borderColor = 'rgba(0,229,255,0.3)';
    } else {
        badge.textContent = num;
        badge.style.background = 'rgba(255,255,255,0.04)';
        badge.style.borderColor = 'rgba(255,255,255,0.2)';
        badge.style.color = 'var(--text-muted)';
        status.textContent = num === 2 ? 'MANUAL' : (num === 4 ? 'OPTIONAL' : 'PENDING');
        status.style.color = 'var(--text-muted)';
        if (card) card.style.borderColor = 'rgba(255,255,255,0.08)';
    }
}

function setStepComplete(num) { setStepState(num, 'complete'); }
function setStepActive(num) { setStepState(num, 'active'); }
function setStepPending(num) { setStepState(num, 'pending'); }

// Evaluate and update all step visuals based on current settings
function updateAccountStepVisuals(settings, tokenStatus) {
    const hasApiKey = !!(settings && settings.upstox_api_key && settings.upstox_api_key.trim());
    const hasToken = !!(settings && settings.upstox_access_token && settings.upstox_access_token.trim());
    const tokenValid = tokenStatus && tokenStatus.status === 'VALID';
    let step2Done = false;
    try { step2Done = !!localStorage.getItem('upstox_step2_done'); } catch(e) {}
    let step4Skipped = false;
    try { step4Skipped = !!localStorage.getItem('upstox_step4_skipped'); } catch(e) {}

    // Step 1: API credentials saved
    if (hasApiKey) {
        setStepComplete(1);
        const body = document.getElementById('step1-body');
        if (body) body.style.display = 'none'; // collapse when complete
    } else {
        setStepActive(1);
        const body = document.getElementById('step1-body');
        if (body) body.style.display = 'block';
    }

    // Step 2: manual - check localStorage
    if (step2Done) {
        setStepComplete(2);
        const btn = document.getElementById('btn-step2-done');
        if (btn) { btn.textContent = '✅ Redirect URL Registered'; btn.disabled = true; btn.style.opacity = '0.7'; }
        const body = document.getElementById('step2-body');
        if (body) body.style.display = 'none';
    } else {
        setStepActive(2);
        const body = document.getElementById('step2-body');
        if (body) body.style.display = hasApiKey ? 'block' : 'none';
    }

    // Step 3: token valid
    if (tokenValid) {
        setStepComplete(3);
        const body = document.getElementById('step3-body');
        if (body) body.style.display = 'none';
    } else if (hasApiKey && step2Done) {
        setStepActive(3);
        const body = document.getElementById('step3-body');
        if (body) body.style.display = 'block';
    } else {
        setStepPending(3);
    }

    // Step 4: IP registered this session or skipped
    let ipDone = false;
    try { ipDone = !!sessionStorage.getItem('upstox_ip_registered'); } catch(e) {}
    if (step4Skipped) {
        setStepComplete(4);
        const status = document.getElementById('step-status-4');
        if (status) { status.textContent = '⏭️ SKIPPED'; status.style.color = 'var(--text-muted)'; }
        const body = document.getElementById('step4-body');
        if (body) body.style.display = 'none';
    } else if (ipDone && tokenValid) {
        setStepComplete(4);
        const body = document.getElementById('step4-body');
        if (body) body.style.display = 'none';
    } else if (tokenValid) {
        setStepActive(4);
        const body = document.getElementById('step4-body');
        if (body) body.style.display = 'block';
    } else {
        setStepPending(4);
    }
}



// Stop live feed polling
function stopEngineFeed() {
    if (!isEngineRunning) return;
    isEngineRunning = false;
    if (marketPollingInterval) {
        clearInterval(marketPollingInterval);
        marketPollingInterval = null;
    }
    
    // Update UI Badge Status
    const statusBadge = document.getElementById('engine-status-badge');
    statusBadge.style.color = 'var(--neon-bear)';
    statusBadge.style.borderColor = 'var(--neon-bear)';
    statusBadge.style.background = 'rgba(235, 94, 85, 0.08)';
    statusBadge.innerHTML = `
        <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: var(--neon-bear); box-shadow: 0 0 8px var(--neon-bear);"></span>
        ENGINE PAUSED
    `;
    
    document.getElementById('btn-engine-stop').style.display = 'none';
    document.getElementById('btn-engine-start').style.display = 'inline-flex';
    
    showToast("Decision engine updates paused", 50, "neutral");
}

// Start live feed polling
function startEngineFeed() {
    if (isEngineRunning) return;
    isEngineRunning = true;
    
    // Fetch immediately, then setup interval
    fetchMarketData();
    marketPollingInterval = setInterval(fetchMarketData, 5000);
    
    // Update UI Badge Status
    const statusBadge = document.getElementById('engine-status-badge');
    statusBadge.style.color = 'var(--neon-bull)';
    statusBadge.style.borderColor = 'var(--neon-bull)';
    statusBadge.style.background = 'rgba(0, 229, 153, 0.08)';
    statusBadge.innerHTML = `
        <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: var(--neon-bull); box-shadow: 0 0 8px var(--neon-bull);" class="pulse-indicator"></span>
        ENGINE LIVE
    `;
    
    document.getElementById('btn-engine-start').style.display = 'none';
    document.getElementById('btn-engine-stop').style.display = 'inline-flex';
    
    showToast("Decision engine updates resumed", 50, "neutral");
}

// Save Settings Config
async function saveSettings() {
    try {
        const capital = parseFloat(document.getElementById('set-capital').value);
        const risk = parseFloat(document.getElementById('set-risk').value);
        const broker = document.getElementById('set-broker').value;
        const strategy = document.getElementById('set-strategy').value;
        const regime = document.getElementById('set-regime').value;
        const feedMode = document.getElementById('set-feed-mode').value;
        const token = document.getElementById('set-upstox-token').value;
        const expiry = document.getElementById('set-upstox-expiry').value;
        const dbUser = document.getElementById('set-auth-user').value;
        const dbPass = document.getElementById('set-auth-pass').value;
        
        const activeModalBtn = document.querySelector('#modal-auto-trade-group button.active');
        const autoTradeMode = activeModalBtn ? activeModalBtn.getAttribute('data-mode') : 'OFF';
        const trailingSl = parseFloat(document.getElementById('set-trailing-sl').value) || 30.0;
        
        const req = {
            capital: capital,
            risk_pct: risk,
            preferred_broker: broker,
            preferred_strategy: strategy,
            regime_override: regime,
            feed_mode: feedMode,
            upstox_access_token: token,
            upstox_expiry_date: expiry,
            upstox_api_key: (document.getElementById('set-upstox-api-key') || {}).value || '',
            upstox_api_secret: (document.getElementById('set-upstox-api-secret') || {}).value || '',
            dashboard_username: dbUser,
            dashboard_password: dbPass,
            auto_trade_mode: autoTradeMode,
            trailing_sl_pts: trailingSl,
            scalper_mode: document.getElementById('set-scalper-mode') ? document.getElementById('set-scalper-mode').checked : false
        };
        
        const resp = await fetch('/api/settings', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(req)
        });
        const res = await resp.json();
        if (res.status === "SUCCESS") {
            // Save settings copy in localStorage as dynamic backup
            const cleanSettings = { ...req };
            safeStorage.setItem('nifty_settings', JSON.stringify(cleanSettings));
            
            // Align dashboard view to the newly saved mode (v2.6)
            alignDashboardViewToMode(autoTradeMode);
            
            document.getElementById('settings-modal').style.display = 'none';
            // Reload settings to get the correct dynamic expiries and active expiry date
            const settingsResp = await fetch('/api/settings');
            const newSettings = await settingsResp.json();
            await reloadExpiries(newSettings);
            await fetchMarketData();
        } else {
            showToast(res.message || "Failed to update settings", 300, "danger", "ERROR");
            await fetchMarketData();
        }
    } catch (e) {
        console.error("Failed saving configuration:", e);
    }
}

// Force manual override event click
async function triggerEventAction(action) {
    try {
        const resp = await fetch('/api/settings/action', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ override_type: action })
        });
        const res = await resp.json();
        if (res.status === "SUCCESS") {
            playAlertChime();
            showToast(res.recommendation, 85, "neutral");
            await fetchMarketData();
        }
    } catch (e) {
        console.error("Failed overriding live simulator event:", e);
    }
}

// Dynamic expiry dates populator
async function reloadExpiries(settings = null) {
    try {
        if (!settings) {
            const resp = await fetch('/api/settings');
            settings = await resp.json();
        }
        
        // Populate settings modal expiry dropdown
        const modalExpiry = document.getElementById('set-upstox-expiry');
        if (modalExpiry) {
            modalExpiry.innerHTML = '';
            const dates = settings.upcoming_expiry_dates || [];
            dates.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d;
                opt.innerText = d;
                modalExpiry.appendChild(opt);
            });
            modalExpiry.value = settings.upstox_expiry_date || (dates[0] || '');
        }
        
        // Populate dashboard header expiry dropdown
        const dashboardExpiry = document.getElementById('set-dashboard-expiry');
        if (dashboardExpiry) {
            dashboardExpiry.innerHTML = '';
            const dates = settings.upcoming_expiry_dates || [];
            dates.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d;
                opt.innerText = d;
                dashboardExpiry.appendChild(opt);
            });
            dashboardExpiry.value = settings.upstox_expiry_date || (dates[0] || '');
        }
    } catch (e) {
        console.error("Failed reloading expiries:", e);
    }
}

// Initialize Mobile Overlay Panels & Home Dock Click Listeners
// Initialize In-Place Dashboard Panel Toggles
function initDashboardToggles() {
    const backdrop = document.getElementById('modal-backdrop');
    
    // Click listeners for menu buttons
    document.querySelectorAll('.menu-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const panelId = btn.getAttribute('data-panel');
            const panel = document.getElementById(panelId);
            if (!panel) return;
            
            const isMobile = window.innerWidth < 1024;
            
            if (isMobile) {
                // On mobile: close all other panels and toggle off their buttons
                const wasActive = panel.classList.contains('active');
                
                // Close everything
                document.querySelectorAll('.panel').forEach(p => {
                    p.classList.remove('active');
                    p.classList.add('hidden-panel');
                });
                document.querySelectorAll('.menu-btn').forEach(b => {
                    b.classList.remove('active');
                });
                if (backdrop) backdrop.classList.remove('active');
                
                // Open only this one if it wasn't already active
                if (!wasActive) {
                    panel.classList.add('active');
                    panel.classList.remove('hidden-panel');
                    btn.classList.add('active');
                    if (backdrop) backdrop.classList.add('active');
                    if (panelId === 'panel-chart' && window.myChart) {
                        fetchChartData();
                    }
                }
            } else {
                // On desktop: toggle individual panels independently
                const isCurrentlyActive = btn.classList.toggle('active');
                if (isCurrentlyActive) {
                    panel.classList.remove('hidden-panel');
                    panel.classList.add('active');
                    if (panelId === 'panel-chart' && window.myChart) {
                        fetchChartData();
                    }
                } else {
                    panel.classList.remove('active');
                    panel.classList.add('hidden-panel');
                }
            }
        });
    });

    // Close button click listener inside panel headers
    document.querySelectorAll('.close-overlay-btn').forEach(closeBtn => {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const panel = closeBtn.closest('.panel');
            if (!panel) return;
            
            panel.classList.remove('active');
            panel.classList.add('hidden-panel');
            
            // Toggle off corresponding menu button
            const panelId = panel.id;
            const btn = document.querySelector(`.menu-btn[data-panel="${panelId}"]`);
            if (btn) {
                btn.classList.remove('active');
            }
            
            // Check if any active panels are still open on mobile
            const anyActive = document.querySelector('.panel.active');
            if (!anyActive && backdrop) {
                backdrop.classList.remove('active');
            }
        });
    });

    // Click backdrop to close active panel
    if (backdrop) {
        backdrop.addEventListener('click', () => {
            document.querySelectorAll('.panel.active').forEach(p => {
                p.classList.remove('active');
                p.classList.add('hidden-panel');
                
                const panelId = p.id;
                const btn = document.querySelector(`.menu-btn[data-panel="${panelId}"]`);
                if (btn) btn.classList.remove('active');
            });
            backdrop.classList.remove('active');
        });
    }
}

// Initialize application listeners
document.addEventListener('DOMContentLoaded', async () => {
    // Check if reset query parameter is present (v2.7.1)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('reset') === 'true') {
        safeStorage.removeItem('nifty_journal_trades');
        safeStorage.removeItem('nifty_settings');
        safeStorage.removeItem('prevent_restore');
        console.log("Cleared client local storage via reset parameter.");
        window.location.href = window.location.pathname;
        return;
    }

    // Initialize in-place panel toggles and action center
    initDashboardToggles();
    
    // Align initial active states based on viewport width
    const alignActiveStates = () => {
        const isMobile = window.innerWidth < 1024;
        const backdrop = document.getElementById('modal-backdrop');
        if (backdrop) backdrop.classList.remove('active');
        
        document.querySelectorAll('.menu-btn').forEach(btn => {
            const panelId = btn.getAttribute('data-panel');
            const panel = document.getElementById(panelId);
            if (!panel) return;
            
            if (isMobile || panelId === 'panel-chart') {
                btn.classList.remove('active');
                panel.classList.remove('active');
                panel.classList.add('hidden-panel');
            } else {
                btn.classList.add('active');
                panel.classList.add('active');
                panel.classList.remove('hidden-panel');
            }
        });
    };
    
    alignActiveStates();
    // Re-align on resize if crossing the threshold
    window.addEventListener('resize', () => {
        const isMobileNow = window.innerWidth < 1024;
        const chartBtn = document.querySelector('.menu-btn[data-panel="panel-chart"]');
        if (chartBtn) {
            const isBtnActive = chartBtn.classList.contains('active');
            if ((!isMobileNow && !isBtnActive) || (isMobileNow && isBtnActive && !document.querySelector('.panel.active'))) {
                alignActiveStates();
            }
        }
    });
    
    // Request notification permissions safely
    if (typeof Notification !== 'undefined') {
        if (Notification.permission !== "granted" && Notification.permission !== "denied") {
            Notification.requestPermission();
        }
    }
    
    // Fetch settings to populate initial state
    try {
        const resp = await fetch('/api/settings');
        let settings = await resp.json();
        
        // Sync settings with local storage backup
        settings = await syncSettingsWithServer(settings);
        
        // Populate settings modal input values immediately on load
        if (document.getElementById('set-capital')) document.getElementById('set-capital').value = settings.capital;
        if (document.getElementById('set-risk')) document.getElementById('set-risk').value = settings.risk_pct;
        if (document.getElementById('set-broker')) document.getElementById('set-broker').value = settings.preferred_broker;
        if (document.getElementById('set-strategy')) document.getElementById('set-strategy').value = settings.preferred_strategy;
        if (document.getElementById('set-regime')) document.getElementById('set-regime').value = settings.regime_override;
        if (document.getElementById('set-feed-mode')) document.getElementById('set-feed-mode').value = settings.feed_mode || 'Simulation';
        if (document.getElementById('set-upstox-token')) document.getElementById('set-upstox-token').value = settings.upstox_access_token || '';
        if (document.getElementById('set-auth-user')) document.getElementById('set-auth-user').value = settings.dashboard_username || 'admin';
        if (document.getElementById('set-auth-pass')) document.getElementById('set-auth-pass').value = settings.dashboard_password || 'password123';
        if (document.getElementById('set-trailing-sl')) document.getElementById('set-trailing-sl').value = settings.trailing_sl_pts || 30.0;
        if (document.getElementById('set-scalper-mode')) document.getElementById('set-scalper-mode').checked = settings.scalper_mode || false;
        syncScalperButtonVisuals(settings.scalper_mode || false);
        syncAutoTradeButtonVisuals('modal-auto-trade-group', settings.auto_trade_mode || 'OFF');
        
        const indexSelector = document.getElementById('select-active-index');
        if (indexSelector) {
            indexSelector.value = settings.preferred_index || 'Nifty';
            
            // Listen to index change
            indexSelector.addEventListener('change', async (e) => {
                const newIndex = e.target.value;
                const indexResp = await fetch('/api/settings/index', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ preferred_index: newIndex })
                });
                const indexRes = await indexResp.json();
                if (indexRes.status === "SUCCESS") {
                    showToast(newIndex, 100, "neutral", "ACTIVE INDEX SWITCHED");
                    // Reload settings to get new Friday/Thursday expiries
                    const settingsResp = await fetch('/api/settings');
                    const newSettings = await settingsResp.json();
                    await reloadExpiries(newSettings);
                    await fetchMarketData();
                }
            });
        }
        
        // Initial expiries populator call
        await reloadExpiries(settings);
        
        // Align dashboard view according to loaded mode (v2.6)
        alignDashboardViewToMode(settings.auto_trade_mode || 'OFF');
        
        const dashboardExpiry = document.getElementById('set-dashboard-expiry');
        if (dashboardExpiry) {
            dashboardExpiry.addEventListener('change', async (e) => {
                const newExpiry = e.target.value;
                const updateResp = await fetch('/api/settings/expiry', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ expiry_date: newExpiry })
                });
                const updateRes = await updateResp.json();
                if (updateRes.status === "SUCCESS") {
                    showToast(newExpiry, 100, "neutral", "EXPIRY DATE SHIFTED");
                    await fetchMarketData();
                }
            });
        }
    } catch (e) {
        console.error("Failed initializing dropdowns:", e);
    }
    
    // Hook up header auto-trade button group clicks
    document.querySelectorAll('#hdr-auto-trade-group button').forEach(btn => {
        btn.addEventListener('click', async () => {
            const mode = btn.getAttribute('data-mode');
            try {
                const settingsResp = await fetch('/api/settings');
                const settings = await settingsResp.json();
                
                settings.auto_trade_mode = mode;
                
                const saveResp = await fetch('/api/settings', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(settings)
                });
                const saveRes = await saveResp.json();
                if (saveRes.status === "SUCCESS") {
                    showToast(`AUTO-TRADE: ${mode.toUpperCase()}`, 100, "neutral", "SETTINGS UPDATED");
                    // Align dashboard view to the clicked mode (v2.6)
                    alignDashboardViewToMode(mode);
                    await fetchMarketData();
                } else {
                    showToast(saveRes.message || "Failed to update settings", 300, "danger", "ERROR");
                    await fetchMarketData();
                }
            } catch (err) {
                console.error("Failed saving header auto-trade setting:", err);
            }
        });
    });

    // Hook up settings modal auto-trade button selections
    document.querySelectorAll('#modal-auto-trade-group button').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.getAttribute('data-mode');
            syncAutoTradeButtonVisuals('modal-auto-trade-group', mode);
        });
    });

    // Hook up daily halt reset button
    const btnResetHalt = document.getElementById('btn-reset-halt');
    if (btnResetHalt) {
        btnResetHalt.addEventListener('click', async () => {
            try {
                // Set prevent restore flag to break any race condition restore loops
                safeStorage.setItem('prevent_restore', 'true');
                safeStorage.removeItem('nifty_journal_trades');
                
                const r = await fetch('/api/reset-daily-halt', { method: 'POST' });
                const res = await r.json();
                if (res.status === 'SUCCESS') {
                    showToast('Daily halt cleared. Auto-Paper re-enabled.', 100, 'bull', 'DAILY HALT RESET');
                    if (window.fetchJournal) {
                        await window.fetchJournal();
                    }
                    await fetchMarketData();
                }
            } catch (e) { console.error('Reset halt failed:', e); }
        });
    }

    // Hook up Start and Stop buttons
    const btnStart = document.getElementById('btn-engine-start');
    if (btnStart) btnStart.addEventListener('click', startEngineFeed);
    
    const btnStop = document.getElementById('btn-engine-stop');
    if (btnStop) btnStop.addEventListener('click', stopEngineFeed);
    
    // Listen to feed mode selection change
    const setFeedMode = document.getElementById('set-feed-mode');
    if (setFeedMode) {
        setFeedMode.addEventListener('change', (e) => {
            toggleUpstoxFields(e.target.value);
        });
    }

    // Modal buttons trigger
    const btnSettings = document.getElementById('btn-settings');
    if (btnSettings) {
        // Wipe database button click handler (v2.7.2)
        const btnWipeDatabase = document.getElementById('btn-wipe-database');
        if (btnWipeDatabase) {
            btnWipeDatabase.addEventListener('click', async () => {
                if (confirm("Are you absolutely sure you want to WIPE all trade journals, history, and reset P&L to zero? This action cannot be undone.")) {
                    try {
                        safeStorage.setItem('prevent_restore', 'true');
                        safeStorage.removeItem('nifty_journal_trades');
                        
                        const resp = await fetch('/api/journal/wipe-all-trades', { method: 'POST' });
                        const res = await resp.json();
                        if (res.status === "SUCCESS") {
                            showToast("Journal wiped successfully", 100, "neutral", "DATABASE CLEARED");
                            document.getElementById('settings-modal').style.display = 'none';
                            await fetchMarketData();
                            window.location.reload();
                        }
                    } catch (e) {
                        console.error("Failed wiping trade database:", e);
                    }
                }
            });
        }

        btnSettings.addEventListener('click', async () => {
            // Load settings first
            const resp = await fetch('/api/settings');
            const settings = await resp.json();
            
            document.getElementById('set-capital').value = settings.capital;
            document.getElementById('set-risk').value = settings.risk_pct;
            document.getElementById('set-broker').value = settings.preferred_broker;
            document.getElementById('set-strategy').value = settings.preferred_strategy;
            document.getElementById('set-regime').value = settings.regime_override;
            document.getElementById('set-feed-mode').value = settings.feed_mode || 'Simulation';
            document.getElementById('set-upstox-token').value = settings.upstox_access_token || '';
            document.getElementById('set-upstox-api-key').value = settings.upstox_api_key || '';
            document.getElementById('set-upstox-api-secret').value = settings.upstox_api_secret || '';
            document.getElementById('set-auth-user').value = settings.dashboard_username || 'admin';
            document.getElementById('set-auth-pass').value = settings.dashboard_password || 'password123';

            // Sync modal auto-trade fields
            syncAutoTradeButtonVisuals('modal-auto-trade-group', settings.auto_trade_mode || 'OFF');
            document.getElementById('set-trailing-sl').value = settings.trailing_sl_pts || 30.0;
            
            // Populate Expiry Dates list dropdown dynamically
            const expirySelect = document.getElementById('set-upstox-expiry');
            if (expirySelect) {
                expirySelect.innerHTML = '';
                const dates = settings.upcoming_expiry_dates || [];
                dates.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d;
                    opt.innerText = d;
                    expirySelect.appendChild(opt);
                });
                expirySelect.value = settings.upstox_expiry_date || (dates[0] || '');
            }
            
            toggleUpstoxFields(settings.feed_mode || 'Simulation');

            // Populate Redirect URI field
            const redirectUriField = document.getElementById('set-redirect-uri');
            if (redirectUriField) {
                redirectUriField.value = window.location.origin + '/auth/callback';
            }

            // Auto-detect & populate the server IP field
            detectServerIp();

            // Update step wizard visuals
            try {
                const tsResp = await fetch('/api/token-status');
                const tsData = await tsResp.json();
                updateAccountStepVisuals(settings, tsData);
            } catch(e) {
                updateAccountStepVisuals(settings, null);
            }

            document.getElementById('settings-modal').style.display = 'flex';
        });
    }

    // Copy Redirect URI button
    const btnCopyRedirectUri = document.getElementById('btn-copy-redirect-uri');
    if (btnCopyRedirectUri) {
        btnCopyRedirectUri.addEventListener('click', () => {
            const field = document.getElementById('set-redirect-uri');
            if (field && field.value) {
                navigator.clipboard.writeText(field.value).then(() => {
                    btnCopyRedirectUri.textContent = '✅ Copied!';
                    setTimeout(() => { btnCopyRedirectUri.textContent = '📋 Copy'; }, 2000);
                }).catch(() => {
                    field.select();
                    document.execCommand('copy');
                    btnCopyRedirectUri.textContent = '✅ Copied!';
                    setTimeout(() => { btnCopyRedirectUri.textContent = '📋 Copy'; }, 2000);
                });
            }
        });
    }

    // Clear & Switch Account button
    const btnClearAccount = document.getElementById('btn-clear-upstox-account');
    if (btnClearAccount) {
        btnClearAccount.addEventListener('click', () => {
            if (!confirm('Clear all Upstox credentials?\n\nThis will remove the API Key, API Secret, and Access Token so you can enter a new account. The system will switch to Simulation mode until you re-authenticate.')) return;
            const apiKeyEl = document.getElementById('set-upstox-api-key');
            const apiSecretEl = document.getElementById('set-upstox-api-secret');
            const tokenEl = document.getElementById('set-upstox-token');
            if (apiKeyEl) apiKeyEl.value = '';
            if (apiSecretEl) apiSecretEl.value = '';
            if (tokenEl) tokenEl.value = '';
            // Also switch feed mode to Simulation
            const feedModeEl = document.getElementById('set-feed-mode');
            if (feedModeEl) feedModeEl.value = 'Simulation';
            // Switch auto trade to OFF
            syncAutoTradeButtonVisuals('modal-auto-trade-group', 'OFF');
            showToast('Credentials cleared. Enter new account details and save.', 150, 'neutral', 'ACCOUNT CLEARED');
        });
    }

    // Helper: detect and display server IP
    async function detectServerIp() {
        const ipField = document.getElementById('set-server-ip-primary');
        if (!ipField) return;
        ipField.placeholder = 'Detecting...';
        try {
            const resp = await fetch('/api/server-ip');
            const data = await resp.json();
            if (data.status === 'SUCCESS' && data.server_ip) {
                ipField.value = data.server_ip;
            } else {
                ipField.placeholder = 'Could not detect IP';
            }
        } catch (e) {
            ipField.placeholder = 'Error detecting IP';
        }
    }

    // Detect IP on settings open (already called in the open handler above via detectServerIp())
    // Refresh IP button
    const btnDetectIp = document.getElementById('btn-detect-ip');
    if (btnDetectIp) {
        btnDetectIp.addEventListener('click', detectServerIp);
    }

    // Register Server IP with Upstox
    const btnRegisterIp = document.getElementById('btn-register-ip');
    if (btnRegisterIp) {
        btnRegisterIp.addEventListener('click', async () => {
            const primaryIp = (document.getElementById('set-server-ip-primary') || {}).value || '';
            const secondaryIp = (document.getElementById('set-server-ip-secondary') || {}).value || '';
            const resultEl = document.getElementById('ip-register-result');

            if (!primaryIp) {
                if (resultEl) { resultEl.textContent = '⚠️ No server IP detected. Click 🔄 to refresh first.'; resultEl.style.display = 'block'; resultEl.style.color = '#ffab40'; }
                return;
            }

            if (!confirm(`Register IP with Upstox?\n\nPrimary: ${primaryIp}${secondaryIp ? '\nSecondary: ' + secondaryIp : ''}\n\n⚠️ Your current access token will be INVALIDATED after this. You will need to login with Upstox again.\n\nNote: Upstox only allows IP changes ONCE per week.`)) return;

            btnRegisterIp.textContent = '⏳ Registering...';
            btnRegisterIp.disabled = true;
            if (resultEl) resultEl.style.display = 'none';

            try {
                const resp = await fetch('/api/update-upstox-ip', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ primary_ip: primaryIp, secondary_ip: secondaryIp || null })
                });
                const res = await resp.json();

                if (resultEl) {
                    resultEl.style.display = 'block';
                    if (res.status === 'SUCCESS') {
                        resultEl.style.color = '#00e676';
                        resultEl.style.background = 'rgba(0,230,118,0.06)';
                        resultEl.style.border = '1px solid rgba(0,230,118,0.2)';
                        resultEl.textContent = res.message;
                        // Clear token display since it's now invalidated
                        const tokenEl = document.getElementById('set-upstox-token');
                        if (tokenEl) tokenEl.value = '';
                        // Set sessionStorage flag and show re-login prompt
                        try { sessionStorage.setItem('upstox_ip_registered', '1'); } catch(e) {}
                        const reloginEl = document.getElementById('step4-relogin');
                        if (reloginEl) reloginEl.style.display = 'block';
                        // Update step states: step 4 waiting for re-login, step 3 now needs action
                        setStepState(4, 'active');
                        const s4status = document.getElementById('step-status-4');
                        if (s4status) { s4status.textContent = '🔐 RE-LOGIN'; s4status.style.color = '#ffab40'; }
                        setStepState(3, 'active');
                        showToast('IP registered! Please login with Upstox again to get a new token.', 200, 'neutral', 'IP REGISTERED');
                    } else {
                        const errText = res.message || 'Failed to register IP';
                        resultEl.style.display = 'block';
                        if (errText.includes('belongs to another Upstox account') || errText.includes('family member')) {
                            resultEl.style.color = '#ffab40';
                            resultEl.style.background = 'rgba(255,171,64,0.08)';
                            resultEl.style.border = '1px solid rgba(255,171,64,0.3)';
                            resultEl.innerHTML = `⚠️ <strong>Shared Server IP Detected</strong><br>` +
                                `Render's server IP is shared across hosting users, so another Upstox user registered this IP.<br>` +
                                `<div style="margin-top:6px;font-weight:700;">👉 Good news: You can SKIP this step! Upstox API works via Step 3 Login without registering server IP for standard apps.</div>` +
                                `<button onclick="skipStep4()" type="button" style="margin-top:8px;padding:6px 12px;font-size:0.7rem;font-weight:700;background:#ffab40;color:#000;border:none;border-radius:4px;cursor:pointer;">⏭️ Skip Step 4 &amp; Continue</button>`;
                        } else {
                            resultEl.style.color = '#ff5252';
                            resultEl.style.background = 'rgba(255,23,68,0.06)';
                            resultEl.style.border = '1px solid rgba(255,23,68,0.2)';
                            resultEl.textContent = '❌ ' + errText;
                        }
                    }
                }
            } catch (e) {
                if (resultEl) { resultEl.style.display = 'block'; resultEl.style.color = '#ff5252'; resultEl.textContent = '❌ Request failed: ' + e.message; }
            } finally {
                btnRegisterIp.textContent = '🌐 Register Server IP with Upstox';
                btnRegisterIp.disabled = false;
            }
        });
    }
    
    const btnCloseSettings = document.getElementById('btn-close-settings');
    if (btnCloseSettings) {
        btnCloseSettings.addEventListener('click', () => {
            document.getElementById('settings-modal').style.display = 'none';
        });
    }
    
    const btnSaveSettings = document.getElementById('btn-save-settings');
    if (btnSaveSettings) btnSaveSettings.addEventListener('click', saveSettings);
    
    // Manual Execute paper trade
    const btnExecutePaper = document.getElementById('btn-execute-paper');
    if (btnExecutePaper) btnExecutePaper.addEventListener('click', executePaperTrade);
    
    const btnExecuteLive = document.getElementById('btn-execute-live');
    if (btnExecuteLive) btnExecuteLive.addEventListener('click', executeLiveTrade);

    // Quick trade bindings on mobile home layout
    const quickPaper = document.getElementById('btn-quick-paper');
    if (quickPaper) {
        quickPaper.addEventListener('click', (e) => {
            e.stopPropagation();
            if (btnExecutePaper) btnExecutePaper.click();
        });
    }

    const quickLive = document.getElementById('btn-quick-live');
    if (quickLive) {
        quickLive.addEventListener('click', (e) => {
            e.stopPropagation();
            if (btnExecuteLive) btnExecuteLive.click();
        });
    }
    
    // Log Out button
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            try {
                const resp = await fetch('/api/logout', { method: 'POST' });
                const res = await resp.json();
                if (res.status === "SUCCESS") {
                    window.location.href = '/login';
                }
            } catch (e) {
                console.error("Logout failed:", e);
            }
        });
    }
    
    // Trigger simulation buttons
    document.querySelectorAll('.btn-action').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const action = e.target.getAttribute('data-action');
            await triggerEventAction(action);
        });
    });

    // Scalper Mode toggle button
    const btnScalper = document.getElementById('btn-scalper-toggle');
    if (btnScalper) {
        btnScalper.addEventListener('click', toggleScalperMode);
        console.log("⚡ Scalper Mode listener bound successfully.");
    }

    // Tab buttons event listeners
    const tabPaper = document.getElementById('tab-paper');
    const tabLive = document.getElementById('tab-live');
    if (tabPaper) tabPaper.addEventListener('click', () => switchJournalTab('paper'));
    if (tabLive) tabLive.addEventListener('click', () => switchJournalTab('live'));

    // Core polling loop (5 seconds ticker refresh)
    try {
        await fetchMarketData();
    } catch (err) {
        console.error("Initial fetch failed:", err);
    }
    marketPollingInterval = setInterval(fetchMarketData, 5000);
    
    // Initialize Trading Academy
    if (window.initAcademy) {
        window.initAcademy();
    }

    // Toggle P&L Chart Type (v2.5)
    const btnTogglePnlType = document.getElementById('btn-toggle-pnl-type');
    if (btnTogglePnlType) {
        btnTogglePnlType.addEventListener('click', () => {
            const currentType = btnTogglePnlType.getAttribute('data-pnl-type');
            if (currentType === 'real') {
                btnTogglePnlType.setAttribute('data-pnl-type', 'paper');
                btnTogglePnlType.textContent = 'Paper P&L';
                btnTogglePnlType.style.color = '#00d9f5';
                btnTogglePnlType.style.borderColor = 'rgba(0, 217, 245, 0.4)';
            } else {
                btnTogglePnlType.setAttribute('data-pnl-type', 'real');
                btnTogglePnlType.textContent = 'Real P&L';
                btnTogglePnlType.style.color = 'var(--neon-bull)';
                btnTogglePnlType.style.borderColor = 'rgba(0, 229, 153, 0.4)';
            }
            fetchChartData();
        });
    }

    // Toggle live option chain visibility (v2.2)
    const btnToggleOptions = document.getElementById('btn-toggle-options');
    const optionsPanelContent = document.getElementById('options-panel-content');
    if (btnToggleOptions && optionsPanelContent) {
        btnToggleOptions.addEventListener('click', () => {
            if (optionsPanelContent.style.display === 'none') {
                optionsPanelContent.style.display = 'block';
                btnToggleOptions.textContent = 'Hide Chain';
                btnToggleOptions.style.background = 'rgba(0, 229, 153, 0.15)';
                btnToggleOptions.style.color = 'var(--neon-bull)';
                btnToggleOptions.style.boxShadow = '0 0 8px rgba(0, 229, 153, 0.2)';
            } else {
                optionsPanelContent.style.display = 'none';
                btnToggleOptions.textContent = 'Show Chain';
                btnToggleOptions.style.background = 'none';
                btnToggleOptions.style.color = 'var(--text-muted)';
                btnToggleOptions.style.boxShadow = 'none';
            }
        });
    }
});

// Journal tab navigation logic
function switchJournalTab(tab) {
    const tabPaper = document.getElementById('tab-paper');
    const tabLive = document.getElementById('tab-live');
    const paperContent = document.getElementById('journal-paper-content');
    const liveContent = document.getElementById('journal-live-content');
    const panelTitle = document.getElementById('journal-panel-title');
    
    if (!tabPaper || !tabLive) return;
    
    if (tab === 'live') {
        tabPaper.classList.remove('active');
        tabLive.classList.add('active');
        if (paperContent) paperContent.style.display = 'none';
        if (liveContent) liveContent.style.display = 'grid';
        if (panelTitle) panelTitle.innerText = "Live Trading Positions & Session Analytics";
    } else {
        tabPaper.classList.add('active');
        tabLive.classList.remove('active');
        if (paperContent) paperContent.style.display = 'grid';
        if (liveContent) liveContent.style.display = 'none';
        if (panelTitle) panelTitle.innerText = "Paper Trading Positions & Session Analytics";
    }
}

// Option trade P&L points calculator (synchronized with backend)
function calculateTradePnlPoints(strategy, diff) {
    const strat = strategy.toUpperCase();
    if (strat.includes("SHORT STRANGLE")) {
        if (Math.abs(diff) <= 100) {
            return 50.0 - (Math.abs(diff) * 0.15);
        } else {
            return 35.0 - (Math.abs(diff) - 100) * 1.5;
        }
    } else if (strat.includes("IRON CONDOR")) {
        if (Math.abs(diff) <= 80) {
            const pts = 30.0 - (Math.abs(diff) * 0.1);
            return Math.max(-50.0, pts);
        } else {
            const pts = 22.0 - (Math.abs(diff) - 80) * 1.2;
            return Math.max(-50.0, pts);
        }
    } else if (strat.includes("BULL PUT")) {
        if (diff >= 0) {
            return Math.min(20.0, 5.0 + diff * 0.15);
        } else {
            return Math.max(-30.0, diff * 0.5);
        }
    } else if (strat.includes("BEAR CALL")) {
        if (diff <= 0) {
            return Math.min(20.0, 5.0 - diff * 0.15);
        } else {
            return Math.max(-30.0, -diff * 0.5);
        }
    } else if (strat.includes("BULL CALL")) {
        return Math.min(50.0, Math.max(-30.0, diff * 0.4));
    } else if (strat.includes("BEAR PUT")) {
        return Math.min(50.0, Math.max(-30.0, -diff * 0.4));
    } else if (strat.includes("BUY CE") || strat.includes("LONG CE")) {
        if (diff >= 0) {
            return diff * 0.6;
        } else {
            return Math.max(-80.0, diff * 0.8);
        }
    } else if (strat.includes("BUY PE") || strat.includes("LONG PE")) {
        if (diff <= 0) {
            return -diff * 0.6;
        } else {
            return Math.max(-80.0, -diff * 0.8);
        }
    } else {
        if (strat.includes("CE") || strat.includes("BULL")) {
            return diff * 0.5;
        } else if (strat.includes("PE") || strat.includes("BEAR")) {
            return -diff * 0.5;
        } else {
            return 10.0;
        }
    }
}

// Helper to search Option LTP from global option chain
function getLegLtp(optionChain, instrumentKey, optType, strike) {
    if (!optionChain || optionChain.length === 0) return null;
    
    // 1. Match by exact instrument key
    for (let i = 0; i < optionChain.length; i++) {
        const item = optionChain[i];
        if (item.call_instrument_key === instrumentKey) return item.call_price;
        if (item.put_instrument_key === instrumentKey) return item.put_price;
    }
    
    // 2. Fallback to strike & type search
    for (let i = 0; i < optionChain.length; i++) {
        const item = optionChain[i];
        if (parseInt(item.strike) === parseInt(strike)) {
            if (optType === 'CE') return item.call_price;
            if (optType === 'PE') return item.put_price;
        }
    }
    return null;
}

// Generate or parse strategy legs
function ensureLegs(pos, optionChain) {
    if (pos.legs && pos.legs.length > 0) {
        return pos.legs;
    }
    
    const legs = [];
    const entry = pos.entry_spot;
    const atm = Math.round(entry / 50) * 50;
    const lotSize = pos.lot_size || 65;
    const qty = lotSize * pos.size;
    const strat = pos.strategy.toUpperCase();
    
    if (strat.includes("BULL PUT")) {
        legs.push({
            strike: atm,
            option_type: 'PE',
            action: 'SELL',
            entry_price: 65.0,
            quantity: qty,
            instrument_key: `SIM_PUT_${atm}`
        });
        legs.push({
            strike: atm - 100,
            option_type: 'PE',
            action: 'BUY',
            entry_price: 35.0,
            quantity: qty,
            instrument_key: `SIM_PUT_${atm - 100}`
        });
    } else if (strat.includes("BEAR CALL")) {
        legs.push({
            strike: atm,
            option_type: 'CE',
            action: 'SELL',
            entry_price: 65.0,
            quantity: qty,
            instrument_key: `SIM_CE_${atm}`
        });
        legs.push({
            strike: atm + 100,
            option_type: 'CE',
            action: 'BUY',
            entry_price: 35.0,
            quantity: qty,
            instrument_key: `SIM_CE_${atm + 100}`
        });
    } else if (strat.includes("SHORT STRANGLE")) {
        legs.push({
            strike: atm - 100,
            option_type: 'PE',
            action: 'SELL',
            entry_price: 80.0,
            quantity: qty,
            instrument_key: `SIM_PUT_${atm - 100}`
        });
        legs.push({
            strike: atm + 100,
            option_type: 'CE',
            action: 'SELL',
            entry_price: 80.0,
            quantity: qty,
            instrument_key: `SIM_CALL_${atm + 100}`
        });
    } else if (strat.includes("IRON CONDOR")) {
        legs.push({
            strike: atm - 100,
            option_type: 'PE',
            action: 'SELL',
            entry_price: 70.0,
            quantity: qty,
            instrument_key: `SIM_PUT_${atm - 100}`
        });
        legs.push({
            strike: atm - 200,
            option_type: 'PE',
            action: 'BUY',
            entry_price: 30.0,
            quantity: qty,
            instrument_key: `SIM_PUT_${atm - 200}`
        });
        legs.push({
            strike: atm + 100,
            option_type: 'CE',
            action: 'SELL',
            entry_price: 70.0,
            quantity: qty,
            instrument_key: `SIM_CALL_${atm + 100}`
        });
        legs.push({
            strike: atm + 200,
            option_type: 'CE',
            action: 'BUY',
            entry_price: 30.0,
            quantity: qty,
            instrument_key: `SIM_CALL_${atm + 200}`
        });
    } else if (strat.includes("PE") || strat.includes("BEAR")) {
        legs.push({
            strike: atm,
            option_type: 'PE',
            action: (strat.includes("BUY") || strat.includes("LONG")) ? 'BUY' : 'SELL',
            entry_price: 110.0,
            quantity: qty,
            instrument_key: `SIM_PUT_${atm}`
        });
    } else {
        legs.push({
            strike: atm,
            option_type: 'CE',
            action: (strat.includes("BUY") || strat.includes("LONG")) ? 'BUY' : 'SELL',
            entry_price: 110.0,
            quantity: qty,
            instrument_key: `SIM_CALL_${atm}`
        });
    }
    return legs;
}

// ==========================================
// LIVE PRICE CHART WITH STRATEGY ANNOTATIONS
// ==========================================

function initLivePnlChart() {
    if (livePnlChart) return;
    const ctx = document.getElementById('live-pnl-chart');
    if (!ctx) return;
    try {
        const existing = Chart.getChart(ctx);
        if (existing) existing.destroy();
    } catch(e) {}
    
    livePnlChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Session P&L (INR)',
                    data: [],
                    borderColor: '#00e5ff',
                    backgroundColor: 'rgba(0, 229, 255, 0.05)',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    fill: true,
                    tension: 0.2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += (context.parsed.y >= 0 ? '+' : '') + '₹' + context.parsed.y.toFixed(2);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.04)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#64748b',
                        font: { size: 9 },
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 8
                    }
                },
                y: {
                    display: true,
                    position: 'right',
                    grid: {
                        color: 'rgba(255, 255, 255, 0.04)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#64748b',
                        font: { size: 9 },
                        callback: function(value) {
                            return (value >= 0 ? '+' : '') + '₹' + value.toLocaleString('en-IN');
                        }
                    }
                }
            }
        }
    });
}
// ==========================================
// RENDER AI DECISION COMPONENTS MATRIX (v3.1.8)
// ==========================================
function renderDecisionMatrix(components) {
    const container = document.getElementById('decision-matrix-container');
    if (!container) return;
    container.innerHTML = "";
    
    const fields = [
        { key: "opening_range", label: "Opening Range", icon: "📐" },
        { key: "vwap_status", label: "VWAP Status", icon: "📈" },
        { key: "ema_alignment", label: "EMA Alignment", icon: "🔗" },
        { key: "vix_volatility", label: "Volatility (VIX)", icon: "⚡" },
        { key: "pcr_sentiment", label: "Sentiment (PCR)", icon: "🎯" },
        { key: "oi_build_up", label: "OI Build-Up", icon: "📊" },
        { key: "adx_trend", label: "ADX Trend Strength", icon: "🏎️" },
        { key: "straddle_premium", label: "Straddle Premium", icon: "📉" },
        { key: "credit_status", label: "Credit & Margin", icon: "💰" }
    ];
    
    fields.forEach(f => {
        const data = components[f.key];
        if (!data) return;
        
        let statusColor = "var(--text-muted)";
        if (data.status.includes("Bullish") || data.status.includes("ADEQUATE") || data.status.includes("Breakout")) {
            statusColor = "var(--neon-bull)";
        } else if (data.status.includes("Bearish") || data.status.includes("INSUFFICIENT") || data.status.includes("Breakdown") || data.status.includes("Blocked") || data.status.includes("CRUSHING")) {
            statusColor = "var(--neon-bear)";
        } else if (data.status.includes("Neutral") || data.status.includes("Inside Range") || data.status.includes("STABLE") || data.status.includes("Balanced")) {
            statusColor = "var(--neon-neutral)";
        }
        
        const card = document.createElement('div');
        card.style.background = "rgba(15, 23, 42, 0.4)";
        card.style.border = "1px solid var(--border-color)";
        card.style.borderRadius = "4px";
        card.style.padding = "6px 8px";
        card.style.display = "flex";
        card.style.flexDirection = "column";
        card.style.gap = "2px";
        card.style.boxSizing = "border-box";
        
        card.innerHTML = `
            <span style="font-size: 0.58rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${f.icon} ${f.label}</span>
            <span style="font-size: 0.7rem; font-weight: 800; color: ${statusColor};">${data.status}</span>
            <span style="font-size: 0.6rem; color: rgba(255,255,255,0.5); font-family: var(--font-mono);">${data.value_desc}</span>
        `;
        container.appendChild(card);
    });
}

// ==========================================
// LIVE ATM STRADDLE PREMIUM CHART (v3.1.8)
// ==========================================
function initLiveStraddleChart() {
    if (liveStraddleChart) return;
    const ctx = document.getElementById('live-straddle-chart');
    if (!ctx) return;
    try {
        const existing = Chart.getChart(ctx);
        if (existing) existing.destroy();
    } catch(e) {}
    
    liveStraddleChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Straddle Premium (INR)',
                    data: [],
                    borderColor: '#ffc107',
                    backgroundColor: 'rgba(255, 193, 7, 0.05)',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    fill: true,
                    tension: 0.2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return '₹' + context.parsed.y.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: { color: 'rgba(255, 255, 255, 0.04)', drawBorder: false },
                    ticks: { color: '#64748b', font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }
                },
                y: {
                    display: true,
                    position: 'right',
                    grid: { color: 'rgba(255, 255, 255, 0.04)', drawBorder: false },
                    ticks: { color: '#64748b', font: { size: 9 }, callback: function(value) { return '₹' + value; } }
                }
            }
        }
    });
}


function initLiveChart() {
    if (liveChart) return;
    const ctx = document.getElementById('live-price-chart');
    if (!ctx) return;
    try {
        const existing = Chart.getChart(ctx);
        if (existing) existing.destroy();
    } catch(e) {}
    
    liveChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Spot Price',
                    data: [],
                    borderColor: '#00e5ff',
                    backgroundColor: 'rgba(0, 229, 255, 0.05)',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    fill: true,
                    tension: 0.3,
                    order: 1
                },
                {
                    label: 'VWAP',
                    data: [],
                    borderColor: '#ffea00',
                    borderWidth: 1.5,
                    borderDash: [6, 3],
                    pointRadius: 0,
                    fill: false,
                    tension: 0.3,
                    order: 2
                },
                {
                    label: 'EMA 20',
                    data: [],
                    borderColor: '#00e676',
                    borderWidth: 1,
                    borderDash: [4, 4],
                    pointRadius: 0,
                    fill: false,
                    tension: 0.3,
                    order: 3
                },
                {
                    label: 'EMA 50',
                    data: [],
                    borderColor: '#b388ff',
                    borderWidth: 1,
                    borderDash: [4, 4],
                    pointRadius: 0,
                    fill: false,
                    tension: 0.3,
                    order: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(10, 17, 28, 0.95)',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    titleColor: '#94a3b8',
                    titleFont: { size: 11, weight: '600' },
                    bodyColor: '#e2e8f0',
                    bodyFont: { size: 12 },
                    padding: 10,
                    callbacks: {
                        label: function(context) {
                            const val = context.parsed.y;
                            return `${context.dataset.label}: ${val.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
                        }
                    }
                },
                annotation: {
                    annotations: {}
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: {
                        color: 'rgba(255,255,255,0.04)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#64748b',
                        font: { size: 10 },
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 15
                    }
                },
                y: {
                    display: true,
                    position: 'right',
                    grid: {
                        color: 'rgba(255,255,255,0.04)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#64748b',
                        font: { size: 10 },
                        callback: function(value) {
                            return value.toLocaleString('en-IN');
                        }
                    }
                }
            },
            animation: {
                duration: 300
            }
        }
    });
}

async function fetchChartData() {
    try {
        const resp = await fetch('/api/chart-data');
        if (resp.status === 401) {
            window.location.href = '/login';
            return;
        }
        const data = await resp.json();
        
        if (!liveChart) {
            initLiveChart();
        }
        if (!liveChart) return;
        
        const history = data.price_history || [];
        const changes = data.strategy_changes || [];
        
        // Update chart data
        const labels = history.map(p => p.time);
        const prices = history.map(p => p.price);
        const vwaps = history.map(p => p.vwap);
        const ema20s = history.map(p => p.ema20);
        const ema50s = history.map(p => p.ema50);
        
        liveChart.data.labels = labels;
        liveChart.data.datasets[0].data = prices;
        liveChart.data.datasets[1].data = vwaps;
        liveChart.data.datasets[2].data = ema20s;
        liveChart.data.datasets[3].data = ema50s;
        
        if (!livePnlChart) {
            initLivePnlChart();
        }
        if (livePnlChart) {
            const btnToggle = document.getElementById('btn-toggle-pnl-type');
            const pnlType = btnToggle ? btnToggle.getAttribute('data-pnl-type') : 'real';
            
            const pnls = history.map(p => {
                if (pnlType === 'paper') {
                    return p.paper_pnl !== undefined ? p.paper_pnl : (p.pnl || 0.0);
                } else {
                    return p.real_pnl !== undefined ? p.real_pnl : (p.pnl || 0.0);
                }
            });
            
            livePnlChart.data.labels = labels;
            livePnlChart.data.datasets[0].data = pnls;
            
            const lastPnl = pnls[pnls.length - 1] || 0.0;
            if (lastPnl >= 0) {
                livePnlChart.data.datasets[0].borderColor = '#00e676';
                livePnlChart.data.datasets[0].backgroundColor = 'rgba(0, 230, 118, 0.05)';
            } else {
                livePnlChart.data.datasets[0].borderColor = '#ff1744';
                livePnlChart.data.datasets[0].backgroundColor = 'rgba(255, 23, 68, 0.05)';
            }
            
            livePnlChart.update('none');
        }
        
        if (!liveStraddleChart) {
            initLiveStraddleChart();
        }
        if (liveStraddleChart) {
            const straddlePremiums = history.map(p => p.straddle_premium || 0.0);
            liveStraddleChart.data.labels = labels;
            liveStraddleChart.data.datasets[0].data = straddlePremiums;
            liveStraddleChart.update('none');
        }
        
        // Build strategy change annotations
        const annotations = {};
        changes.forEach((change, idx) => {
            // Find the closest label index for this change's time
            const changeTime = change.time;
            const labelIdx = labels.indexOf(changeTime);
            if (labelIdx < 0) return; // Skip if time not in current chart range
            
            const strat = change.new_strategy || '';
            const isBull = strat.includes('CE') || strat.includes('Bull');
            const isBear = strat.includes('PE') || strat.includes('Bear');
            const color = isBull ? '#00e676' : (isBear ? '#ff1744' : '#ffea00');
            
            annotations[`line_${idx}`] = {
                type: 'line',
                xMin: changeTime,
                xMax: changeTime,
                borderColor: color,
                borderWidth: 1.5,
                borderDash: [4, 3],
                label: {
                    display: true,
                    content: strat,
                    position: 'start',
                    backgroundColor: 'rgba(10, 17, 28, 0.85)',
                    color: color,
                    font: { size: 9, weight: '700', family: "'Roboto Mono', monospace" },
                    padding: { top: 3, bottom: 3, left: 5, right: 5 },
                    borderRadius: 3
                }
            };
        });
        
        liveChart.options.plugins.annotation.annotations = annotations;
        liveChart.update('none'); // Update without animation for performance
        
        // Update strategy strip below chart
        updateChartStrategyStrip(data.current_strategy, data.current_confidence, changes);
        
    } catch (e) {
        console.warn('Chart data fetch error:', e);
        if (window.showDiagnosticError) {
            window.showDiagnosticError('Chart Data Error: ' + (e.stack || e.message || e));
        }
    }
}

function updateChartStrategyStrip(currentStrategy, currentConfidence, changes) {
    // Current strategy badge
    const stratName = document.getElementById('chart-strat-name');
    const stratConf = document.getElementById('chart-strat-conf');
    const stratCard = document.getElementById('chart-current-strat');
    
    if (stratName) stratName.textContent = currentStrategy || '—';
    if (stratConf) stratConf.textContent = `${currentConfidence}% Confidence`;
    
    // Color the current strategy card
    if (stratCard) {
        const isBull = currentStrategy && (currentStrategy.includes('CE') || currentStrategy.includes('Bull'));
        const isBear = currentStrategy && (currentStrategy.includes('PE') || currentStrategy.includes('Bear'));
        const isNoTrade = currentStrategy === 'No Trade';
        
        if (isBull) {
            stratCard.style.borderColor = 'rgba(0, 229, 118, 0.3)';
            stratCard.style.background = 'rgba(0, 229, 118, 0.06)';
            if (stratName) stratName.style.color = 'var(--neon-bull)';
        } else if (isBear) {
            stratCard.style.borderColor = 'rgba(235, 94, 85, 0.3)';
            stratCard.style.background = 'rgba(235, 94, 85, 0.06)';
            if (stratName) stratName.style.color = 'var(--neon-bear)';
        } else if (isNoTrade) {
            stratCard.style.borderColor = 'rgba(255, 234, 0, 0.3)';
            stratCard.style.background = 'rgba(255, 234, 0, 0.06)';
            if (stratName) stratName.style.color = 'var(--neon-neutral)';
        } else {
            stratCard.style.borderColor = 'rgba(179, 136, 255, 0.3)';
            stratCard.style.background = 'rgba(179, 136, 255, 0.06)';
            if (stratName) stratName.style.color = '#b388ff';
        }
    }
    
    // Change timeline chips (most recent first, last 10)
    const timeline = document.getElementById('chart-change-timeline');
    if (!timeline) return;
    
    timeline.innerHTML = '';
    const recentChanges = changes.slice(-10).reverse();
    
    recentChanges.forEach(change => {
        const strat = change.new_strategy || '';
        const isBull = strat.includes('CE') || strat.includes('Bull');
        const isBear = strat.includes('PE') || strat.includes('Bear');
        const chipClass = isBull ? 'chip-bull' : (isBear ? 'chip-bear' : 'chip-neutral');
        
        const chip = document.createElement('div');
        chip.className = `chart-change-chip ${chipClass}`;
        chip.innerHTML = `
            <span class="ccc-time">${change.time}</span>
            <span class="ccc-strat">${strat}</span>
            <span class="ccc-reason">${change.reason || ''} • ${change.confidence || ''}</span>
        `;
        timeline.appendChild(chip);
    });
}




// ==========================================
// TRADING ACADEMY CLIENT CONTROLLER
// ==========================================

let academyState = {
    currentModuleId: 1,
    currentTab: 'read',
    completedModules: {}, // { moduleId: true }
    quizScores: {}, // { moduleId: score }
    currentScenarioIndex: 1, // 1 to 500
    checklistStates: {}, // { itemId: boolean }
    scenarioAnswers: {} // { scenarioIndex: optionIndex }
};

// Procedural Scenario Templates
const SCENARIO_TEMPLATES = [
    {
        title: "Nifty SSL Sweep Reversal",
        q: "Where did the Sell-Side Liquidity (SSL) sweep occur on this chart?",
        options: [
            "At Candle 15, piercing the yesterday's low support and reversing",
            "At the POC volume node near Candle 5",
            "Above the Value Area High resistance at Candle 8",
            "At the opening high candle"
        ],
        correct: 0,
        explanation: "Candle 15 shows a long lower wick piercing the support level (yesterday's low), triggering stop-losses (SSL) before bulls aggressively drive the price higher to close inside the range.",
        type: "sweep",
        basePrice: 22120,
        trend: "down_then_up"
    },
    {
        title: "Nifty Value Area Breakout Test",
        q: "What does price testing the VAH at Candle 12 indicate?",
        options: [
            "A failed breakout requiring immediate short position",
            "An institutional retest of the breakout level, acting as support",
            "Low market interest in Nifty options",
            "A shift in options max pain strike"
        ],
        correct: 1,
        explanation: "After breaking above the Value Area High (VAH) at Candle 8, Candle 12 retraces to test VAH from above. Institutions defend this cost basis, establishing it as new support.",
        type: "profile",
        basePrice: 22250,
        trend: "breakout_and_retest"
    },
    {
        title: "Anchored VWAP Support Bounce",
        q: "Why is the Anchored VWAP line serving as strong support at Candle 14?",
        options: [
            "It represents the average cost basis of participants since the major swing low anchor point",
            "It is a simple mathematical average of highs and lows",
            "It is based on the options open interest",
            "It reflects the retail trader sentiment only"
        ],
        correct: 0,
        explanation: "By anchoring VWAP to the major swing low of the day, we highlight the institutional volume-weighted cost basis. Tests of this line (Candle 14) typically trigger buying from large players defending their position.",
        type: "vwap",
        basePrice: 22050,
        trend: "vwap_support"
    },
    {
        title: "Footprint Aggressive Buy Imbalance",
        q: "At Candle 10, what does the green highlighted footprint cluster tell us?",
        options: [
            "Aggressive sellers are trapping passive buyers",
            "Strong diagonal buying imbalance (>300%), showing aggressive market order demand",
            "Low volume and consolidation",
            "A drop in implied volatility"
        ],
        correct: 1,
        explanation: "The diagonal ask volume exceeds bid volume by more than 300%, marking an aggressive buying imbalance. This confirms institutional initiative to bid up prices.",
        type: "footprint",
        basePrice: 22180,
        trend: "bullish_imbalance"
    },
    {
        title: "SMC Order Block & FVG Mitigation",
        q: "What occurs inside the FVG box between Candle 6 and 9?",
        options: [
            "Market structure continuation breakdown",
            "Price retraces to fill the Fair Value Gap (mitigation) before resuming the upward trend",
            "Sellers absorbing all bids",
            "Nothing, this represents standard market noise"
        ],
        correct: 1,
        explanation: "The rapid displacement at Candle 5 leaves a Fair Value Gap (FVG). Price returns to fill this inefficiency at Candle 8, mitigating the imbalance before resuming the bullish expansion.",
        type: "smc",
        basePrice: 22090,
        trend: "fvg_retest"
    }
];

// Initialize Academy
function initAcademy() {
    console.log("Initializing Trading Academy Module...");
    
    // Load state from localStorage
    const savedState = safeStorage.getItem('agy_academy_state');
    if (savedState) {
        try {
            academyState = { ...academyState, ...JSON.parse(savedState) };
        } catch (e) {
            console.error("Failed parsing saved academy state:", e);
        }
    }
    
    // Load checklist states
    const savedChecklist = safeStorage.getItem('agy_checklist_state');
    if (savedChecklist) {
        try {
            academyState.checklistStates = JSON.parse(savedChecklist);
        } catch (e) {}
    }
    
    // Hook Navigation View Toggles
    const btnNavDashboard = document.getElementById('btn-nav-dashboard');
    const btnNavAcademy = document.getElementById('btn-nav-academy');
    const viewDashboard = document.getElementById('dashboard-view');
    const viewAcademy = document.getElementById('academy-view');
    
    if (btnNavDashboard && btnNavAcademy) {
        btnNavDashboard.addEventListener('click', () => {
            btnNavDashboard.classList.add('active');
            btnNavAcademy.classList.remove('active');
            if (viewDashboard) viewDashboard.classList.remove('hidden');
            if (viewAcademy) viewAcademy.classList.add('hidden');
        });
        
        btnNavAcademy.addEventListener('click', () => {
            btnNavDashboard.classList.remove('active');
            btnNavAcademy.classList.add('active');
            if (viewDashboard) viewDashboard.classList.add('hidden');
            if (viewAcademy) viewAcademy.classList.remove('hidden');
            // Auto trigger rendering of current active module inside Academy
            renderActiveModule();
        });
    }
    
    // Hook Academy Main Header Tabs
    document.querySelectorAll('.academy-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const selectedTab = e.target.getAttribute('data-tab');
            switchAcademyTab(selectedTab);
        });
    });
    
    // Difficulty Filter Listener
    const difficultyFilter = document.getElementById('academy-difficulty-filter');
    if (difficultyFilter) {
        difficultyFilter.addEventListener('change', (e) => {
            renderModuleList(e.target.value);
        });
    }
    
    // Scenario Practice Nav Buttons
    const btnPrevScenario = document.getElementById('btn-prev-scenario');
    const btnNextScenario = document.getElementById('btn-next-scenario');
    const selectScenario = document.getElementById('select-chart-scenario');
    
    if (btnPrevScenario) {
        btnPrevScenario.addEventListener('click', () => {
            if (academyState.currentScenarioIndex > 1) {
                academyState.currentScenarioIndex--;
                if (selectScenario) selectScenario.value = academyState.currentScenarioIndex;
                loadScenario(academyState.currentScenarioIndex);
            }
        });
    }
    
    if (btnNextScenario) {
        btnNextScenario.addEventListener('click', () => {
            if (academyState.currentScenarioIndex < 500) {
                academyState.currentScenarioIndex++;
                if (selectScenario) selectScenario.value = academyState.currentScenarioIndex;
                loadScenario(academyState.currentScenarioIndex);
            }
        });
    }
    
    if (selectScenario) {
        // Populate 500 choices
        selectScenario.innerHTML = '';
        for (let i = 1; i <= 500; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.innerText = `Chart Setup #${i}`;
            selectScenario.appendChild(opt);
        }
        selectScenario.addEventListener('change', (e) => {
            academyState.currentScenarioIndex = parseInt(e.target.value);
            loadScenario(academyState.currentScenarioIndex);
        });
    }
    
    // Chart Overlay Checkboxes Toggles
    ['chk-show-profile', 'chk-show-vwap', 'chk-show-footprint', 'chk-show-sweeps'].forEach(id => {
        const chk = document.getElementById(id);
        if (chk) {
            chk.addEventListener('change', () => {
                renderSVGChart(academyState.currentScenarioIndex);
            });
        }
    });
    
    // Checklist Row Clicks
    document.querySelectorAll('.checklist-item-row').forEach(row => {
        const itemId = row.getAttribute('data-id');
        // Restore check state
        if (academyState.checklistStates[itemId]) {
            row.classList.add('checked');
        }
        row.addEventListener('click', () => {
            row.classList.toggle('checked');
            academyState.checklistStates[itemId] = row.classList.contains('checked');
            safeStorage.setItem('agy_checklist_state', JSON.stringify(academyState.checklistStates));
        });
    });
    
    // Next/Proceed Buttons inside academy footer
    const btnNextRead = document.getElementById('btn-academy-next-read');
    if (btnNextRead) {
        btnNextRead.addEventListener('click', () => {
            switchAcademyTab('chart');
        });
    }
    
    const btnNextChart = document.getElementById('btn-academy-next-chart');
    if (btnNextChart) {
        btnNextChart.addEventListener('click', () => {
            switchAcademyTab('quiz');
        });
    }
    
    const btnNextModule = document.getElementById('btn-academy-next-module');
    if (btnNextModule) {
        btnNextModule.addEventListener('click', () => {
            if (academyState.currentModuleId < window.ACADEMY_DATA.modules.length) {
                academyState.currentModuleId++;
                renderActiveModule();
                switchAcademyTab('read');
            } else {
                showToast("ALL MODULES COMPLETED", 100, "bull", "ACADEMY CLEAR");
            }
        });
    }
    
    // Pine Script generator button
    const btnGeneratePine = document.getElementById('btn-generate-pinescript');
    if (btnGeneratePine) {
        btnGeneratePine.addEventListener('click', generatePineScript);
    }
    
    const btnCopyPine = document.getElementById('btn-copy-pine-code');
    if (btnCopyPine) {
        btnCopyPine.addEventListener('click', () => {
            const codeBlock = document.getElementById('pine-code-block');
            if (codeBlock) {
                navigator.clipboard.writeText(codeBlock.textContent);
                showToast("CODE COPIED TO CLIPBOARD", 100, "neutral", "PINE GENERATOR");
            }
        });
    }
    
    // Initial Render of UI parts
    renderModuleList("All");
    renderCheatSheets();
    renderActiveModule();
}

// Switch Academy Main Tabs
function switchAcademyTab(tabName) {
    academyState.currentTab = tabName;
    
    // Set tab active styles
    document.querySelectorAll('.academy-tab').forEach(t => {
        if (t.getAttribute('data-tab') === tabName) {
            t.classList.add('active');
        } else {
            t.classList.remove('active');
        }
    });
    
    // Toggle section panels
    const sections = {
        'read': 'academy-sec-read',
        'chart': 'academy-sec-chart',
        'quiz': 'academy-sec-quiz',
        'cheatsheet': 'academy-sec-cheatsheet',
        'checklist': 'academy-sec-checklist',
        'templates': 'academy-sec-templates',
        'ai': 'academy-sec-ai'
    };
    
    Object.keys(sections).forEach(key => {
        const secEl = document.getElementById(sections[key]);
        if (secEl) {
            if (key === tabName) {
                secEl.classList.remove('hidden');
            } else {
                secEl.classList.add('hidden');
            }
        }
    });
    
    // If opening chart tab, make sure it renders
    if (tabName === 'chart') {
        loadScenario(academyState.currentScenarioIndex);
    }
}

// Render Sidebar Module Cards
function renderModuleList(difficultyFilter) {
    const listContainer = document.getElementById('academy-module-list');
    if (!listContainer) return;
    
    listContainer.innerHTML = '';
    const modules = window.ACADEMY_DATA.modules;
    
    modules.forEach(mod => {
        if (difficultyFilter !== 'All' && mod.difficulty !== difficultyFilter) return;
        
        const isCompleted = academyState.completedModules[mod.id];
        const isActive = academyState.currentModuleId === mod.id;
        
        const card = document.createElement('div');
        card.className = `module-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`;
        card.setAttribute('data-id', mod.id);
        
        const diffClass = `diff-${mod.difficulty.toLowerCase()}`;
        
        card.innerHTML = `
            <div class="module-meta-row">
                <span class="module-difficulty ${diffClass}">${mod.difficulty}</span>
                <span class="module-status">${isCompleted ? '✓ Completed' : mod.estimatedTime}</span>
            </div>
            <div class="module-title">M${mod.id.toString().padStart(2, '0')}: ${mod.title}</div>
        `;
        
        card.addEventListener('click', () => {
            academyState.currentModuleId = mod.id;
            renderActiveModule();
            // Reset to read tab
            switchAcademyTab('read');
        });
        
        listContainer.appendChild(card);
    });
    
    // Update progress tracker
    const totalCount = modules.length;
    const completedCount = Object.keys(academyState.completedModules).length;
    const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    
    const progressPercent = document.getElementById('academy-progress-percent');
    const progressBar = document.getElementById('academy-progress-bar');
    
    if (progressPercent) progressPercent.textContent = `${pct}% (${completedCount}/${totalCount})`;
    if (progressBar) progressBar.style.width = `${pct}%`;
}

// Render active reading details and quiz setup
function renderActiveModule() {
    // 1. Highlight in sidebar
    document.querySelectorAll('.module-item').forEach(card => {
        const cid = parseInt(card.getAttribute('data-id'));
        if (cid === academyState.currentModuleId) {
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }
    });
    
    const activeMod = window.ACADEMY_DATA.modules.find(m => m.id === academyState.currentModuleId);
    if (!activeMod) return;
    
    // 2. Render Reading content
    const materialBody = document.getElementById('academy-material-body');
    if (materialBody) {
        materialBody.innerHTML = `
            <h2 style="font-family:var(--font-mono); font-size:1.4rem; color:var(--neon-neutral); margin-bottom:12px;">M${activeMod.id.toString().padStart(2, '0')}: ${activeMod.title}</h2>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:20px; text-transform:uppercase;">Difficulty: ${activeMod.difficulty} • Duration: ${activeMod.estimatedTime}</div>
            <div class="academy-reading-content">
                ${activeMod.content}
                
                <div class="horizontal-divider" style="margin:25px 0;"></div>
                <h3>Active Assignment & Practice Exercises</h3>
                <p style="font-style: italic; color:var(--text-secondary); background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); padding: 12px; border-radius:4px;">
                    ${activeMod.exercises}
                </p>
                <p style="font-style: italic; color:var(--text-secondary); background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); padding: 12px; border-radius:4px; margin-top:8px;">
                    ${activeMod.assignment}
                </p>
            </div>
        `;
    }
    
    // 3. Render Quiz content
    renderActiveQuiz(activeMod);
    
    // Save State
    saveAcademyState();
}

// Render dynamic quiz module questions
function renderActiveQuiz(module) {
    const wrapper = document.getElementById('quiz-questions-wrapper');
    const summary = document.getElementById('quiz-score-summary');
    const quizTitle = document.getElementById('lbl-quiz-chapter-title');
    
    if (!wrapper || !summary) return;
    
    if (quizTitle) quizTitle.textContent = `Module ${module.id} Review Quiz`;
    
    wrapper.innerHTML = '';
    summary.classList.add('hidden');
    
    const quizList = module.quiz || [];
    
    quizList.forEach((qItem, idx) => {
        const qBox = document.createElement('div');
        qBox.className = 'quiz-question-box';
        qBox.style.marginBottom = '16px';
        
        qBox.innerHTML = `
            <div class="quiz-question-text">Q${idx + 1}: ${qItem.question}</div>
            <div class="quiz-options-list" id="quiz-opts-m${module.id}-q${idx}">
                <!-- Options -->
            </div>
            <div class="quiz-explanation-box hidden" id="quiz-explain-m${module.id}-q${idx}">
                <strong>Explanation:</strong>
                <span>${qItem.explanation}</span>
            </div>
        `;
        
        const optionsList = qBox.querySelector(`#quiz-opts-m${module.id}-q${idx}`);
        const explanationBox = qBox.querySelector(`#quiz-explain-m${module.id}-q${idx}`);
        
        qItem.options.forEach((opt, optIdx) => {
            const optDiv = document.createElement('div');
            optDiv.className = 'quiz-option';
            optDiv.innerHTML = `
                <div class="quiz-option-dot"></div>
                <span>${opt}</span>
            `;
            
            optDiv.addEventListener('click', () => {
                // If already checked, return
                if (optionsList.querySelector('.correct') || optionsList.querySelector('.incorrect')) return;
                
                // Highlight option selected
                if (optIdx === qItem.correctIndex) {
                    optDiv.classList.add('correct');
                    explanationBox.classList.remove('hidden');
                    // Add success effect
                    showToast("CORRECT ANSWER!", 100, "bull", "QUIZ CHALLENGE");
                } else {
                    optDiv.classList.add('incorrect');
                    explanationBox.classList.remove('hidden');
                    // Mark correct option
                    const correctDiv = optionsList.children[qItem.correctIndex];
                    if (correctDiv) correctDiv.classList.add('correct');
                    showToast("INCORRECT ANSWER", 100, "bear", "QUIZ CHALLENGE");
                }
                
                // Check if all questions are answered
                checkQuizCompletion(module);
            });
            
            optionsList.appendChild(optDiv);
        });
        
        wrapper.appendChild(qBox);
    });
}

// Verify if quiz was completed
function checkQuizCompletion(module) {
    const wrapper = document.getElementById('quiz-questions-wrapper');
    const totalQ = module.quiz.length;
    let answeredCount = 0;
    let correctCount = 0;
    
    wrapper.querySelectorAll('.quiz-options-list').forEach(list => {
        const correct = list.querySelector('.correct');
        const incorrect = list.querySelector('.incorrect');
        if (correct || incorrect) {
            answeredCount++;
            if (correct && !incorrect) {
                correctCount++;
            }
        }
    });
    
    if (answeredCount === totalQ) {
        // Complete!
        academyState.completedModules[module.id] = true;
        academyState.quizScores[module.id] = correctCount;
        
        const summary = document.getElementById('quiz-score-summary');
        const scoreText = document.getElementById('lbl-quiz-score-text');
        
        if (summary) summary.classList.remove('hidden');
        if (scoreText) scoreText.textContent = `You scored ${correctCount}/${totalQ} (${Math.round((correctCount/totalQ)*100)}%). Chapter cleared! Progress saved.`;
        
        // Re-render sidebar to show checkmarks
        renderModuleList("All");
        saveAcademyState();
    }
}

// Generate Pine Script strategy files
function generatePineScript() {
    const strategy = document.getElementById('ai-strategy-select').value;
    const risk = parseFloat(document.getElementById('ai-risk-pct').value) || 1.0;
    const sl = parseInt(document.getElementById('ai-sl-pts').value) || 15;
    const tp = parseInt(document.getElementById('ai-tp-pts').value) || 45;
    
    let code = `//@version=5
strategy("Institutional Nifty System [AI Generated]", overlay=true, initial_capital=500000, default_qty_type=strategy.percent_of_equity, default_qty_value=100)

// Strategy Inputs
risk_pct = input.float(${risk}, "Risk Per Trade %", minval=0.5, maxval=5.0)
sl_points = input.int(${sl}, "Stop Loss Points", minval=5)
tp_points = input.int(${tp}, "Take Profit Points", minval=10)

// Core Market Data
vix = request.security("NSE:INDIAVIX", timeframe.period, close)

`;
    
    if (strategy === 'sweep') {
        code += `// --- LIQUIDITY SWEEP SETUP logic ---
yesterday_high = request.security(syminfo.tickerid, "D", high[1])
yesterday_low = request.security(syminfo.tickerid, "D", low[1])

// Detect Sweep
bullish_sweep = low < yesterday_low and close > yesterday_low
bearish_sweep = high > yesterday_high and close < yesterday_high

// Execution Condition
if (bullish_sweep and not na(vix) and vix < 20)
    strategy.entry("Long Sweep", strategy.long, comment="Sweep support SL")
    strategy.exit("Exit Long", "Long Sweep", loss=sl_points * 50, profit=tp_points * 50) // Nifty Multiplier 50

if (bearish_sweep and not na(vix) and vix < 20)
    strategy.entry("Short Sweep", strategy.short, comment="Sweep resistance SL")
    strategy.exit("Exit Short", "Short Sweep", loss=sl_points * 50, profit=tp_points * 50)
    
plot(yesterday_high, color=color.red, title="Yesterday High")
plot(yesterday_low, color=color.green, title="Yesterday Low")
`;
    } else if (strategy === 'vwap') {
        code += `// --- ANCHORED VWAP SUPPORT BOUNCE logic ---
// Custom anchored vwap function
var float vwap_sum = 0.0
var float vol_sum = 0.0
var int start_bar = 0

// Reset anchor from weekly swing low (simulated swing condition)
new_anchor = ta.pivotlow(low, 10, 10)
if (not na(new_anchor))
    vwap_sum := 0.0
    vol_sum := 0.0
    start_bar := bar_index

// Calculate Anchored VWAP
if (bar_index >= start_bar)
    vwap_sum := vwap_sum + (src * volume)
    vol_sum := vol_sum + volume
anchored_vwap = vol_sum > 0 ? vwap_sum / vol_sum : na

// Entry condition on VWAP Pullback Bounce
bounce_long = ta.crossover(close, anchored_vwap) and close[1] <= anchored_vwap
if (bounce_long)
    strategy.entry("VWAP Bounce", strategy.long, comment="Anchored VWAP Test")
    strategy.exit("Exit Bounce", "VWAP Bounce", loss=sl_points * 50, profit=tp_points * 50)

plot(anchored_vwap, color=color.orange, style=plot.style_line, title="Anchored VWAP")
`;
    } else if (strategy === 'profile') {
        code += `// --- VOLUME PROFILE VALUE AREA BREAKOUT logic ---
// Simple mock Value Area lines based on daily averages
vah_sim = ta.ema(high, 50) + (ta.atr(14) * 0.5)
val_sim = ta.ema(low, 50) - (ta.atr(14) * 0.5)

breakout_up = ta.crossover(close, vah_sim)
breakout_down = ta.crossunder(close, val_sim)

if (breakout_up)
    strategy.entry("VAH Breakout", strategy.long, comment="Profile Expansion Upside")
    strategy.exit("Exit Long", "VAH Breakout", loss=sl_points * 50, profit=tp_points * 50)

if (breakout_down)
    strategy.entry("VAL Breakdown", strategy.short, comment="Profile Expansion Downside")
    strategy.exit("Exit Short", "VAL Breakdown", loss=sl_points * 50, profit=tp_points * 50)
    
plot(vah_sim, color=color.purple, title="Value Area High")
plot(val_sim, color=color.purple, title="Value Area Low")
`;
    } else {
        code += `// --- FOOTPRINT AGGRESSIVE IMBALANCE logic ---
// Cluster aggressive imbalance simulation using volume rate of change
buy_imbalance = volume > ta.sma(volume, 20) * 1.5 and close > open + ta.atr(14)*0.5
sell_imbalance = volume > ta.sma(volume, 20) * 1.5 and close < open - ta.atr(14)*0.5

if (buy_imbalance)
    strategy.entry("Aggressive Imbalance Buy", strategy.long, comment="Imbalance demand")
    strategy.exit("Exit Long", "Aggressive Imbalance Buy", loss=sl_points * 50, profit=tp_points * 50)

if (sell_imbalance)
    strategy.entry("Aggressive Imbalance Sell", strategy.short, comment="Imbalance supply")
    strategy.exit("Exit Short", "Aggressive Imbalance Sell", loss=sl_points * 50, profit=tp_points * 50)
`;
    }
    
    const codeBlock = document.getElementById('pine-code-block');
    if (codeBlock) codeBlock.textContent = code;
    
    showToast("PINE SCRIPT COMPILED SUCCESSFULLY", 100, "neutral", "PINE GENERATOR");
}

// Render static cheat sheet cards from data
function renderCheatSheets() {
    const container = document.getElementById('academy-cheatsheet-cards');
    if (!container) return;
    
    container.innerHTML = '';
    window.ACADEMY_DATA.cheatSheets.forEach(sheet => {
        const card = document.createElement('div');
        card.className = 'checklist-card';
        card.style.gridColumn = 'span 1';
        
        // Convert mock markdown table to html tables
        let markdownContent = sheet.content;
        let htmlTable = markdownContent.replace(/\|/g, '<td>').replace(/\n/g, '</tr><tr>');
        // Simple clean up
        htmlTable = `<table class="academy-table"><tbody>${htmlTable}</tbody></table>`;
        // Replace header delimiter td row
        htmlTable = htmlTable.replace(/<tr><td>\s*---\s*<\/td>.*?<\/tr>/g, '');
        // Wrap first row inside tr as th
        htmlTable = htmlTable.replace(/<tr><td>(.*?)<\/td><td>(.*?)<\/td><td>(.*?)<\/td>/, '<thead><tr><th>$1</th><th>$2</th><th>$3</th></tr></thead><tbody><tr>');
        
        card.innerHTML = `
            <h4>${sheet.title}</h4>
            <div style="overflow-x:auto;">
                ${htmlTable}
            </div>
        `;
        container.appendChild(card);
    });
}

// Load dynamic chart scenario
function loadScenario(index) {
    const selector = document.getElementById('select-chart-scenario');
    if (selector) selector.value = index;
    
    // Choose template based on index seed
    const templateIndex = (index - 1) % SCENARIO_TEMPLATES.length;
    const template = SCENARIO_TEMPLATES[templateIndex];
    
    const titleEl = document.getElementById('lbl-scenario-title');
    const descEl = document.getElementById('lbl-scenario-desc');
    const qEl = document.getElementById('lbl-chart-q');
    
    if (titleEl) titleEl.innerText = `Scenario #${index}: ${template.title}`;
    if (descEl) descEl.innerText = `Review the candles below (simulated seed #${index}) and click to identify the setup indicators.`;
    if (qEl) qEl.innerText = template.q;
    
    renderSVGChart(index);
    renderScenarioQuiz(index, template);
}

// Render dynamic chart quiz options
function renderScenarioQuiz(index, template) {
    const optsContainer = document.getElementById('chart-q-options');
    const explanationBox = document.getElementById('chart-q-explanation');
    
    if (!optsContainer || !explanationBox) return;
    
    optsContainer.innerHTML = '';
    explanationBox.classList.add('hidden');
    
    const savedAns = academyState.scenarioAnswers[index];
    
    template.options.forEach((opt, optIdx) => {
        const optDiv = document.createElement('div');
        optDiv.className = 'quiz-option';
        optDiv.innerHTML = `
            <div class="quiz-option-dot"></div>
            <span>${opt}</span>
        `;
        
        // Restore saved answer state
        if (savedAns !== undefined) {
            if (optIdx === template.correct) {
                optDiv.classList.add('correct');
            } else if (optIdx === savedAns) {
                optDiv.classList.add('incorrect');
            }
        }
        
        optDiv.addEventListener('click', () => {
            if (optsContainer.querySelector('.correct') || optsContainer.querySelector('.incorrect')) return;
            
            academyState.scenarioAnswers[index] = optIdx;
            saveAcademyState();
            
            if (optIdx === template.correct) {
                optDiv.classList.add('correct');
                showToast("CORRECT SCENARIO ANALYSIS", 100, "bull", "PRACTICE ARENA");
            } else {
                optDiv.classList.add('incorrect');
                const correctDiv = optsContainer.children[template.correct];
                if (correctDiv) correctDiv.classList.add('correct');
                showToast("INCORRECT ANALYSIS", 100, "bear", "PRACTICE ARENA");
            }
            
            explanationBox.innerHTML = `<strong>Explanation:</strong><span>${template.explanation}</span>`;
            explanationBox.classList.remove('hidden');
        });
        
        optsContainer.appendChild(optDiv);
    });
    
    if (savedAns !== undefined) {
        explanationBox.innerHTML = `<strong>Explanation:</strong><span>${template.explanation}</span>`;
        explanationBox.classList.remove('hidden');
    }
}

// Procedural SVG Chart Drawer
function renderSVGChart(index) {
    const svg = document.getElementById('academy-chart-svg');
    if (!svg) return;
    
    svg.innerHTML = '';
    
    // Toggle indicator state options
    const showProfile = document.getElementById('chk-show-profile') ? document.getElementById('chk-show-profile').checked : true;
    const showVWAP = document.getElementById('chk-show-vwap') ? document.getElementById('chk-show-vwap').checked : true;
    const showFootprint = document.getElementById('chk-show-footprint') ? document.getElementById('chk-show-footprint').checked : true;
    const showSweeps = document.getElementById('chk-show-sweeps') ? document.getElementById('chk-show-sweeps').checked : true;
    
    const templateIndex = (index - 1) % SCENARIO_TEMPLATES.length;
    const template = SCENARIO_TEMPLATES[templateIndex];
    
    const basePrice = template.basePrice + (index * 2) % 60;
    
    // Draw background grids
    const gridColor = "rgba(255,255,255,0.03)";
    const textColor = "#607d8b";
    
    for (let x = 80; x < 800; x += 60) {
        svg.innerHTML += `<line x1="${x}" y1="10" x2="${x}" y2="340" stroke="${gridColor}" stroke-width="1" />`;
    }
    for (let y = 30; y < 340; y += 40) {
        svg.innerHTML += `<line x1="40" y1="${y}" x2="780" y2="${y}" stroke="${gridColor}" stroke-width="1" />`;
    }
    
    // Generate Candles (20 candles)
    let price = basePrice;
    let candles = [];
    let mathRandom = (seed) => {
        let x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    };
    
    for (let i = 0; i < 20; i++) {
        let seed = index * 7 + i * 31;
        let change = (mathRandom(seed) - 0.45) * 12;
        
        // Build specific structural behavior based on templates
        if (template.type === "sweep" && i === 14) {
            change = -25; // sharp sweep low
        } else if (template.type === "sweep" && i === 15) {
            change = 30; // reversal
        } else if (template.type === "breakout_and_retest" && i > 5 && i < 9) {
            change = 18; // breakout
        } else if (template.type === "breakout_and_retest" && i === 11) {
            change = -12; // pull back to retest VAH
        }
        
        let open = price;
        let close = price + change;
        let high = Math.max(open, close) + mathRandom(seed + 1) * 6;
        let low = Math.min(open, close) - mathRandom(seed + 2) * 6;
        
        if (template.type === "sweep" && i === 14) {
            low = open - 35; // extreme pinbar wick
        }
        
        price = close;
        candles.push({ open, high, low, close, idx: i });
    }
    
    // Map pricing to screen heights (y)
    let minPrice = Math.min(...candles.map(c => c.low)) - 10;
    let maxPrice = Math.max(...candles.map(c => c.high)) + 10;
    let priceRange = maxPrice - minPrice;
    
    let getX = (idx) => 70 + idx * 35;
    let getY = (prc) => 310 - ((prc - minPrice) / priceRange) * 260;
    
    // Draw horizontal guidelines for reference values
    let priceTickCount = 6;
    for (let i = 0; i <= priceTickCount; i++) {
        let prc = minPrice + (priceRange / priceTickCount) * i;
        let y = getY(prc);
        svg.innerHTML += `
            <text x="25" y="${y + 4}" fill="${textColor}" font-size="8" font-family="monospace" text-anchor="middle">${Math.round(prc)}</text>
            <line x1="50" y1="${y}" x2="780" y2="${y}" stroke="rgba(255,255,255,0.015)" stroke-width="1" />
        `;
    }
    
    // Draw Volume Profile bars on the left (if enabled)
    if (showProfile) {
        // Group prices into 10 buckets
        let buckets = Array(10).fill(0);
        candles.forEach(c => {
            let bucketIdx = Math.min(9, Math.floor(((c.close - minPrice) / priceRange) * 10));
            buckets[bucketIdx] += 15; // weight
        });
        
        buckets.forEach((wt, bIdx) => {
            let pLow = minPrice + (priceRange / 10) * bIdx;
            let pHigh = minPrice + (priceRange / 10) * (bIdx + 1);
            let yCenter = getY((pLow + pHigh) / 2);
            let barW = Math.min(200, wt * 8);
            
            // Draw profile bar
            let isPoc = bIdx === 4; // Mock POC bucket
            let color = isPoc ? "rgba(0, 229, 255, 0.15)" : "rgba(144, 164, 174, 0.08)";
            let stroke = isPoc ? "rgba(0, 229, 255, 0.4)" : "transparent";
            
            svg.innerHTML += `
                <rect x="50" y="${yCenter - 10}" width="${barW}" height="18" fill="${color}" stroke="${stroke}" stroke-width="1" rx="2" />
            `;
            
            if (isPoc) {
                // Draw horizontal line for POC
                svg.innerHTML += `
                    <line x1="50" y1="${yCenter}" x2="780" y2="${yCenter}" stroke="var(--neon-neutral)" stroke-dasharray="3,3" stroke-width="1" />
                    <text x="760" y="${yCenter - 6}" fill="var(--neon-neutral)" font-size="8" font-family="monospace" text-anchor="end">POC: ${Math.round((pLow+pHigh)/2)}</text>
                `;
            }
        });
    }
    
    // Draw Liquidity Sweeps Area (if enabled)
    if (showSweeps && template.type === "sweep") {
        let sweptCandle = candles[14];
        let sweepX = getX(14);
        let sweepY = getY(sweptCandle.low);
        
        svg.innerHTML += `
            <rect x="${sweepX - 10}" y="${sweepY - 5}" width="20" height="${getY(sweptCandle.low) - getY(sweptCandle.high) + 15}" fill="rgba(255, 23, 68, 0.08)" stroke="var(--neon-bear)" stroke-dasharray="2,2" stroke-width="1" rx="2" />
            <text x="${sweepX}" y="${sweepY + 16}" fill="var(--neon-bear)" font-size="8" font-family="monospace" text-anchor="middle" font-weight="bold">SSL SWEEP</text>
        `;
    }
    
    // Draw Anchored VWAP line (if enabled)
    if (showVWAP) {
        let vwapPoints = [];
        let vwapAnchorIdx = 3;
        let cumulativePrc = 0;
        let cumulativeVol = 0;
        
        for (let i = vwapAnchorIdx; i < 20; i++) {
            cumulativePrc += candles[i].close * (100 + i * 15);
            cumulativeVol += (100 + i * 15);
            let vwapVal = cumulativePrc / cumulativeVol;
            vwapPoints.push({ x: getX(i), y: getY(vwapVal) });
        }
        
        // Draw VWAP curve path
        if (vwapPoints.length > 0) {
            let pathD = `M ${vwapPoints[0].x} ${vwapPoints[0].y} ` + vwapPoints.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ");
            svg.innerHTML += `
                <path d="${pathD}" fill="none" stroke="var(--neon-gold)" stroke-width="1.8" />
                <circle cx="${vwapPoints[0].x}" cy="${vwapPoints[0].y}" r="3.5" fill="var(--neon-gold)" stroke="#060b13" stroke-width="1" />
                <text x="${vwapPoints[0].x - 6}" y="${vwapPoints[0].y - 6}" fill="var(--neon-gold)" font-size="7" font-family="monospace">VWAP ANCHOR</text>
            `;
        }
    }
    
    // Draw Candles & Footprints
    candles.forEach((c) => {
        let x = getX(c.idx);
        let yOpen = getY(c.open);
        let yClose = getY(c.close);
        let yHigh = getY(c.high);
        let yLow = getY(c.low);
        
        let isBull = c.close >= c.open;
        let candleColor = isBull ? "var(--neon-bull)" : "var(--neon-bear)";
        let bodyW = 16;
        
        // Draw Wicks
        svg.innerHTML += `
            <line x1="${x}" y1="${yHigh}" x2="${x}" y2="${yLow}" stroke="${candleColor}" stroke-width="1.5" />
        `;
        
        // Draw Body
        let bodyY = Math.min(yOpen, yClose);
        let bodyH = Math.max(2, Math.abs(yOpen - yClose));
        
        let fillStyle = isBull ? "rgba(0, 230, 118, 0.18)" : "rgba(255, 23, 68, 0.18)";
        
        svg.innerHTML += `
            <rect x="${x - bodyW/2}" y="${bodyY}" width="${bodyW}" height="${bodyH}" fill="${fillStyle}" stroke="${candleColor}" stroke-width="1.5" rx="1" />
        `;
        
        // Draw Footprint details inside/beside the candles (if enabled)
        if (showFootprint) {
            let bidSize = Math.round(15 + mathRandom(index + c.idx) * 85);
            let askSize = Math.round(15 + mathRandom(index + c.idx + 3) * 85);
            
            // Build footprint imbalance mock
            let isImbalance = false;
            if (isBull && askSize > bidSize * 2.5) {
                isImbalance = true;
            } else if (!isBull && bidSize > askSize * 2.5) {
                isImbalance = true;
            }
            
            let fpColor = isImbalance ? (isBull ? "var(--neon-bull)" : "var(--neon-bear)") : "rgba(255,255,255,0.4)";
            let delta = askSize - bidSize;
            
            // Print footprints values vertically aligned
            svg.innerHTML += `
                <text x="${x + 12}" y="${bodyY + bodyH/2 - 4}" fill="${fpColor}" font-size="6" font-family="monospace">${bidSize}x${askSize}</text>
                <text x="${x + 12}" y="${bodyY + bodyH/2 + 3}" fill="${delta >= 0 ? 'var(--neon-bull)' : 'var(--neon-bear)'}" font-size="5" font-family="monospace">Δ ${delta >= 0 ? '+' : ''}${delta}</text>
            `;
        }
        
        // Print Candle indices along X-axis
        if (c.idx % 2 === 0) {
            svg.innerHTML += `
                <text x="${x}" y="330" fill="${textColor}" font-size="7" font-family="monospace" text-anchor="middle">C${c.idx}</text>
            `;
        }
    });
}

// Save Academy state to localStorage
function saveAcademyState() {
    safeStorage.setItem('agy_academy_state', JSON.stringify(academyState));
}

// Expose functions globally for dynamic integrations
window.initAcademy = initAcademy;
window.switchAcademyTab = switchAcademyTab;


// Update visual styling of timeframe trend badges dynamically
function updateTrendBadge(id, trend) {
    const badge = document.getElementById(id);
    if (!badge) return;
    
    badge.innerText = trend;
    badge.className = ""; // clear classes
    
    if (trend === "Bullish") {
        badge.style.color = "var(--neon-bull)";
        badge.style.background = "rgba(0, 229, 153, 0.1)";
        badge.style.border = "1px solid rgba(0, 229, 153, 0.2)";
    } else if (trend === "Bearish") {
        badge.style.color = "var(--neon-bear)";
        badge.style.background = "rgba(235, 94, 85, 0.1)";
        badge.style.border = "1px solid rgba(235, 94, 85, 0.2)";
    } else if (trend.includes("Bullish")) {
        badge.style.color = "rgba(0, 229, 153, 0.8)";
        badge.style.background = "rgba(0, 229, 153, 0.05)";
        badge.style.border = "1px solid rgba(0, 229, 153, 0.1)";
    } else if (trend.includes("Bearish")) {
        badge.style.color = "rgba(235, 94, 85, 0.8)";
        badge.style.background = "rgba(235, 94, 85, 0.05)";
        badge.style.border = "1px solid rgba(235, 94, 85, 0.1)";
    } else {
        badge.style.color = "var(--text-muted)";
        badge.style.background = "rgba(255, 255, 255, 0.05)";
        badge.style.border = "1px solid rgba(255, 255, 255, 0.1)";
    }
}


// ─── Upstox Token Status Banner ────────────────────────────────
async function updateTokenStatusBanner() {
    const dot = document.getElementById('token-status-dot');
    const label = document.getElementById('token-status-label');
    const expiry = document.getElementById('token-status-expiry');
    if (!dot || !label) return;
    try {
        const resp = await fetch('/api/token-status');
        if (!resp.ok) return;
        const d = await resp.json();
        if (d.status === 'VALID') {
            dot.style.background = '#00e676';
            dot.style.boxShadow = '0 0 6px #00e676';
            label.style.color = '#00e676';
            label.textContent = '🟢 Token Valid';
            if (expiry) expiry.textContent = `Expires: ${d.expires_at} (${d.days_left} days)`;
        } else if (d.status === 'EXPIRED') {
            dot.style.background = '#ff1744';
            dot.style.boxShadow = '0 0 6px #ff1744';
            label.style.color = '#ff1744';
            label.textContent = '🔴 Token Expired — Click Login with Upstox';
            if (expiry) expiry.textContent = `Expired at: ${d.expires_at}`;
        } else if (d.status === 'MISSING') {
            dot.style.background = '#ffab40';
            dot.style.boxShadow = '0 0 6px #ffab40';
            label.style.color = '#ffab40';
            label.textContent = '⚠️ No Token — Enter API Key then click Login with Upstox';
            if (expiry) expiry.textContent = '';
        }
        // Show/highlight Login button if token missing or expired
        const loginBtn = document.getElementById('btn-login-upstox');
        if (loginBtn) {
            if (d.status !== 'VALID') {
                loginBtn.style.background = 'linear-gradient(135deg, #ff174422, #ff572222)';
                loginBtn.style.borderColor = '#ff1744';
                loginBtn.style.color = '#ff5252';
                loginBtn.classList.add('pulse-red');
            } else {
                loginBtn.style.background = 'linear-gradient(135deg,#00e5ff22,#7c4dff22)';
                loginBtn.style.borderColor = '#00e5ff';
                loginBtn.style.color = '#00e5ff';
                loginBtn.classList.remove('pulse-red');
            }
        }
    } catch(e) {
        if (label) { label.textContent = 'Token status unavailable'; }
    }
}
window.updateTokenStatusBanner = updateTokenStatusBanner;


// ─── Session Timer: Shows IST clock + countdown to trade close ───
function updateSessionTimer() {
    const clockEl = document.getElementById('session-clock');
    const countdownEl = document.getElementById('session-countdown');
    const timerBox = document.getElementById('session-timer-box');
    if (!clockEl || !countdownEl) return;
    
    // IST = UTC + 5:30
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const ist = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + istOffset);
    
    const h = ist.getHours();
    const m = ist.getMinutes();
    const s = ist.getSeconds();
    const dayOfWeek = ist.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Format date string for holiday check: YYYY-MM-DD
    const yyyy = ist.getFullYear();
    const mm = (ist.getMonth() + 1).toString().padStart(2, '0');
    const dd = ist.getDate().toString().padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    
    // Standard NSE Trading Holidays for 2026
    const nseHolidays2026 = {
        "2026-01-26": "Republic Day",
        "2026-03-06": "Holi",
        "2026-03-27": "Ramzan Id",
        "2026-04-02": "Mahavir Jayanti",
        "2026-04-03": "Good Friday",
        "2026-04-14": "Ambedkar Jayanti",
        "2026-05-01": "Maharashtra Day",
        "2026-10-02": "Gandhi Jayanti",
        "2026-10-20": "Dussehra",
        "2026-11-09": "Diwali Laxmi Puja",
        "2026-11-10": "Diwali Balipratipada",
        "2026-11-24": "Gurunanak Jayanti",
        "2026-12-25": "Christmas Day"
    };

    const timeStr = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    clockEl.textContent = timeStr;
    
    // 1. Weekend Check
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        countdownEl.textContent = `☕ Weekend (Market Closed)`;
        countdownEl.style.color = '#ffab40';
        clockEl.style.color = 'var(--text-muted)';
        if (timerBox) timerBox.style.borderColor = 'rgba(255,171,64,0.15)';
        return;
    }
    
    // 2. Holiday Check
    if (nseHolidays2026[dateStr]) {
        countdownEl.textContent = `🏖️ Holiday: ${nseHolidays2026[dateStr]}`;
        countdownEl.style.color = '#ffab40';
        clockEl.style.color = 'var(--text-muted)';
        if (timerBox) timerBox.style.borderColor = 'rgba(255,171,64,0.15)';
        return;
    }
    
    const currentSeconds = h * 3600 + m * 60 + s;
    const tradeStart = 9 * 3600 + 20 * 60;   // 09:20:00 (33600s)
    const posClose = 15 * 3600 + 15 * 60;    // 15:15:00 (54900s)
    
    if (currentSeconds < tradeStart) {
        const secsLeft = tradeStart - currentSeconds;
        const minsLeft = Math.floor(secsLeft / 60);
        const hLeft = Math.floor(minsLeft / 60);
        const mLeft = minsLeft % 60;
        countdownEl.textContent = `Market opens in ${hLeft}h ${mLeft}m`;
        countdownEl.style.color = '#ffab40';
        if (timerBox) {
            timerBox.style.borderColor = 'rgba(255,171,64,0.3)';
            timerBox.style.background = 'none';
        }
    } else if (currentSeconds < posClose) {
        const secsLeft = posClose - currentSeconds;
        
        // Format as Hh Mm Ss
        const hLeft = Math.floor(secsLeft / 3600);
        const mLeft = Math.floor((secsLeft % 3600) / 60);
        const sLeft = secsLeft % 60;
        
        const hStr = hLeft > 0 ? `${hLeft}h ` : '';
        const mStr = `${mLeft.toString().padStart(2, '0')}m `;
        const sStr = `${sLeft.toString().padStart(2, '0')}s`;
        
        if (secsLeft < 900) { // Less than 15 minutes left
            countdownEl.textContent = `⚠️ Trade ends in ${hStr}${mStr}${sStr}`;
            countdownEl.style.color = '#ff1744';
            clockEl.style.color = '#ff1744';
            if (timerBox) {
                timerBox.style.borderColor = 'rgba(255,23,68,0.5)'; 
                timerBox.style.background = 'rgba(255,23,68,0.08)';
            }
        } else {
            countdownEl.textContent = `Trade ends in ${hStr}${mStr}${sStr}`;
            countdownEl.style.color = '#00e676';
            clockEl.style.color = '#00e676';
            if (timerBox) {
                timerBox.style.borderColor = 'rgba(0,230,118,0.3)';
                timerBox.style.background = 'none';
            }
        }
    } else if (currentSeconds < 15 * 3600 + 30 * 60) { // Up to 15:30
        countdownEl.textContent = '🔴 Positions closed. No trading.';
        countdownEl.style.color = '#ff5252';
        clockEl.style.color = '#ff5252';
        if (timerBox) {
            timerBox.style.borderColor = 'rgba(255,82,82,0.3)';
            timerBox.style.background = 'none';
        }
    } else {
        countdownEl.textContent = 'Market closed';
        countdownEl.style.color = 'var(--text-muted)';
        clockEl.style.color = 'var(--text-muted)';
        if (timerBox) {
            timerBox.style.borderColor = 'var(--border-color)';
            timerBox.style.background = 'none';
        }
    }
}

setInterval(updateSessionTimer, 1000);
updateSessionTimer();

// ─── Scalper Mode UI Logic ───
function syncScalperButtonVisuals(enabled) {
    const btn = document.getElementById('btn-scalper-toggle');
    const chk = document.getElementById('set-scalper-mode');
    if (chk) chk.checked = enabled;
    if (!btn) return;
    
    btn.setAttribute('data-enabled', enabled.toString());
    if (enabled) {
        btn.textContent = '⚡ Scalper ON';
        btn.style.background = 'rgba(0, 229, 255, 0.15)';
        btn.style.borderColor = '#00e5ff';
        btn.style.color = '#00e5ff';
        btn.style.boxShadow = '0 0 10px rgba(0, 229, 255, 0.4)';
    } else {
        btn.textContent = '⚡ Scalper OFF';
        btn.style.background = 'rgba(10, 18, 30, 0.6)';
        btn.style.borderColor = 'var(--border-color)';
        btn.style.color = 'var(--text-color)';
        btn.style.boxShadow = 'none';
    }
}

async function toggleScalperMode() {
    const btn = document.getElementById('btn-scalper-toggle');
    if (!btn) return;
    
    const currentlyEnabled = btn.getAttribute('data-enabled') === 'true';
    const targetState = !currentlyEnabled;
    
    // First, show toast
    showToast(targetState ? "ENABLED" : "DISABLED", 150, targetState ? "success" : "neutral", "⚡ SCALPER MODE");
    
    try {
        // Fetch current settings, modify scalper_mode, and post back
        const settingsResp = await fetch('/api/settings');
        const settings = await settingsResp.json();
        
        settings.scalper_mode = targetState;
        
        // Post update
        const resp = await fetch('/api/settings', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(settings)
        });
        const res = await resp.json();
        if (res.status === "SUCCESS") {
            // Store backup
            safeStorage.setItem('nifty_settings', JSON.stringify(settings));
            syncScalperButtonVisuals(targetState);
        }
    } catch(e) {
        console.error("Failed toggling scalper mode:", e);
    }
}
