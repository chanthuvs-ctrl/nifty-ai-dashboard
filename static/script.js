// Globals
let previousStrategy = null;
let audioCtx = null;
let marketPollingInterval = null;
let isEngineRunning = true;
let globalOptionChain = null;
let liveChart = null;
let chartStrategyChanges = [];

// Global Diagnostics Error Handler
window.addEventListener('error', function(e) {
    const msg = e.error ? (e.error.stack || e.error.message) : e.message;
    showDiagnosticError('Runtime Error: ' + msg);
});
window.addEventListener('unhandledrejection', function(e) {
    const msg = e.reason ? (e.reason.stack || e.reason.message || e.reason) : 'Unknown promise rejection';
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
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
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
}

// Trigger browser push notification
function showNotification(title, message) {
    if (typeof Notification !== 'undefined' && Notification.permission === "granted") {
        new Notification(title, { body: message });
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
        document.getElementById('hdr-nifty-spot').innerText = data.spot_price.toLocaleString('en-IN', {minimumFractionDigits: 2});
        document.getElementById('hdr-nifty-meta').innerText = `${data.price_source} | ${data.price_date} ${data.price_time}`;
        
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
        
        const baseline = isSensex ? 79996.60 : 24270.85;
        const spotDiff = data.spot_price - baseline;
        const spotPct = (spotDiff / baseline) * 100;
        const changeHdr = document.getElementById('hdr-nifty-change');
        
        // Update header ticker label and option chain title dynamically
        const spotLabel = document.getElementById('hdr-spot-label');
        if (spotLabel) spotLabel.innerText = isSensex ? 'SENSEX SPOT' : 'NIFTY SPOT';
        
        const chainTitle = document.getElementById('option-chain-title');
        if (chainTitle) chainTitle.innerText = isSensex ? 'Sensex Live Option Chain' : 'Nifty Live Option Chain';
        changeHdr.innerText = `${spotDiff >= 0 ? '+' : ''}${spotPct.toFixed(2)}%`;
        changeHdr.className = `ticker-change ${spotDiff >= 0 ? 'up' : 'down'}`;
        
        document.getElementById('hdr-vix').innerText = data.vix.toFixed(2);
        const vixStatus = document.getElementById('hdr-vix-status');
        vixStatus.innerText = data.vix > 18 ? 'Volatile' : 'Stable';
        vixStatus.className = `ticker-change ${data.vix > 18 ? 'down' : 'up'}`;
        
        document.getElementById('hdr-pcr').innerText = data.pcr.toFixed(2);
        const pcrStatus = document.getElementById('hdr-pcr-status');
        pcrStatus.innerText = data.pcr > 1.25 ? 'Bullish' : (data.pcr < 0.75 ? 'Bearish' : 'Neutral');
        pcrStatus.className = `ticker-change ${data.pcr > 1.25 ? 'up' : (data.pcr < 0.75 ? 'down' : '')}`;
        
        document.getElementById('hdr-max-pain').innerText = data.indicators.max_pain;
        
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
        let rDesc = `Spot index above VWAP: ${data.indicators.vwap}. ATR: ${data.indicators.atr}. EMA 20: ${data.indicators.ema_20}.`;
        document.getElementById('regime-desc').innerText = rDesc;
        
        // Progress Bars
        document.getElementById('txt-adx').innerText = data.indicators.adx.toFixed(1);
        document.getElementById('bar-adx').style.width = `${(data.indicators.adx / 60) * 100}%`;
        document.getElementById('txt-rsi').innerText = data.indicators.rsi.toFixed(1);
        document.getElementById('bar-rsi').style.width = `${data.indicators.rsi}%`;
        
        // 3. Circular dials PCR & VIX
        drawGauge('canvas-pcr', data.pcr, 0.4, 1.8, '', false);
        drawGauge('canvas-vix', data.vix, 9.0, 30.0, '%', true);
        document.getElementById('val-pcr').innerText = data.pcr.toFixed(2);
        document.getElementById('val-vix').innerText = `${data.vix.toFixed(1)}%`;
        
        // 4. Primary Recommendation hero card
        const recTitle = document.getElementById('rec-strategy');
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
        
        document.getElementById('confidence-text').innerText = `${data.confidence.toFixed(0)}%`;
        document.getElementById('confidence-circle').setAttribute('stroke-dasharray', `${data.confidence}, 100`);
        
        // Rec Sound Alert triggers
        if (previousStrategy !== null && previousStrategy !== data.recommendation) {
            playAlertChime();
            const notificationType = data.recommendation.includes("PE") || data.recommendation.includes("Bear") ? "bear" : (data.recommendation === "No Trade" ? "neutral" : "bull");
            showToast(data.recommendation, data.confidence, notificationType);
            showNotification("Strategy Alert Shift", `New strategy: ${data.recommendation} (Confidence: ${data.confidence}%)`);
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
        
        // 7. Bind Option Chain Table
        renderOptionChain(data.option_chain, data.spot_price, data.indicators.max_pain);
        globalOptionChain = data.option_chain;
        
        // Refresh journal list & logs
        await fetchJournal();
        await fetchLogs();
        
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

// Fetch and draw Paper/Live Trading lists
async function fetchJournal() {
    try {
        const resp = await fetch('/api/journal');
        if (resp.status === 401) {
            window.location.href = '/login';
            return;
        }
        const data = await resp.json();
        
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
        const renderActive = (tbodyId, list, typeLabel, typeColor) => {
            const body = document.getElementById(tbodyId);
            if (!body) return;
            body.innerHTML = "";
            if (list.length === 0) {
                body.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-muted)">No active ${typeLabel.toLowerCase()} trades right now.</td></tr>`;
            } else {
                list.forEach(pos => {
                    const tr = document.createElement('tr');
                    
                    const entry = pos.entry_spot;
                    const size = pos.size;
                    const lotSize = pos.lot_size || 65;
                    const multiplier = lotSize * size;
                    
                    // Sum up all leg P&Ls for exact option P&L calculation
                    const legs = ensureLegs(pos, globalOptionChain);
                    let totalPnl = 0.0;
                    legs.forEach(leg => {
                        const legLtp = getLegLtp(globalOptionChain, leg.instrument_key, leg.option_type, leg.strike) || leg.entry_price;
                        const legDiff = legLtp - leg.entry_price;
                        if (leg.action === 'BUY') {
                            totalPnl += legDiff * leg.quantity;
                        } else {
                            totalPnl -= legDiff * leg.quantity;
                        }
                    });
                    
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
                    
                    tr.innerHTML = `
                        <td>${pos.time}</td>
                        <td class="font-bold" style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">${pos.strategy} ${typeBadge} ${alertBadge}</td>
                        <td>${pos.strikes.join(', ')}</td>
                        <td>₹${entry.toFixed(2)}</td>
                        <td>${size} lot(s)</td>
                        <td>₹${currentSpot.toFixed(2)}</td>
                        <td class="font-bold ${totalPnl >= 0 ? 'text-bull' : 'text-bear'}">₹${totalPnl.toFixed(2)}</td>
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
                                <span style="font-weight: 600;">NIFTY ${leg.strike} ${leg.option_type}</span>
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
                body.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted)">No closed ${typeLabel.toLowerCase()} trade logs.</td></tr>`;
            } else {
                list.forEach(pos => {
                    const tr = document.createElement('tr');
                    const typeBadge = `<span class="badge-pro" style="background: rgba(${typeColor}, 0.12); color: rgb(${typeColor}); border: 1px solid rgb(${typeColor}); font-size: 0.58rem; padding: 2px 5px; margin-left: 6px;">${typeLabel}</span>`;
                    
                    tr.innerHTML = `
                        <td>${pos.date} ${pos.time}</td>
                        <td class="font-bold" style="display: flex; align-items: center; gap: 4px;">${pos.strategy} ${typeBadge}</td>
                        <td>₹${pos.entry_spot.toFixed(2)}</td>
                        <td>₹${pos.exit_spot.toFixed(2)}</td>
                        <td class="font-bold ${pos.pnl >= 0 ? 'text-bull' : 'text-bear'}">₹${pos.pnl.toFixed(2)}</td>
                        <td><span class="badge-pro" style="background:${pos.pnl >= 0 ? 'rgba(0,230,118,0.1)' : 'rgba(255,23,68,0.1)'}">${pos.outcome}</span></td>
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
        const legText = legs.map(l => `${l.transaction_type} ${l.quantity} Qty NIFTY ${l.instrument_key.split('|')[1] || l.instrument_key}`).join('\n');
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
            alert(`Live Trade execution failed/completed partially:\n\n${res.message}\n\nCheck logs for details.`);
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

// Toggle Upstox inputs visibility
function toggleUpstoxFields(mode) {
    const fields = document.getElementById('upstox-config-fields');
    if (mode === 'Upstox') {
        fields.style.display = 'block';
    } else {
        fields.style.display = 'none';
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
        
        const req = {
            capital: capital,
            risk_pct: risk,
            preferred_broker: broker,
            preferred_strategy: strategy,
            regime_override: regime,
            feed_mode: feedMode,
            upstox_access_token: token,
            upstox_expiry_date: expiry,
            dashboard_username: dbUser,
            dashboard_password: dbPass
        };
        
        const resp = await fetch('/api/settings', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(req)
        });
        const res = await resp.json();
        if (res.status === "SUCCESS") {
            document.getElementById('settings-modal').style.display = 'none';
            // Reload settings to get the correct dynamic expiries and active expiry date
            const settingsResp = await fetch('/api/settings');
            const newSettings = await settingsResp.json();
            await reloadExpiries(newSettings);
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

// Initialize application listeners
document.addEventListener('DOMContentLoaded', async () => {
    // Request notification permissions safely
    if (typeof Notification !== 'undefined') {
        if (Notification.permission !== "granted" && Notification.permission !== "denied") {
            Notification.requestPermission();
        }
    }
    
    // Fetch settings to populate initial state
    try {
        const resp = await fetch('/api/settings');
        const settings = await resp.json();
        
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
            document.getElementById('set-auth-user').value = settings.dashboard_username || 'admin';
            document.getElementById('set-auth-pass').value = settings.dashboard_password || 'password123';
            
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
            
            document.getElementById('settings-modal').style.display = 'flex';
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

function initLiveChart() {
    const ctx = document.getElementById('live-price-chart');
    if (!ctx) return;
    
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
    const savedState = localStorage.getItem('agy_academy_state');
    if (savedState) {
        try {
            academyState = { ...academyState, ...JSON.parse(savedState) };
        } catch (e) {
            console.error("Failed parsing saved academy state:", e);
        }
    }
    
    // Load checklist states
    const savedChecklist = localStorage.getItem('agy_checklist_state');
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
            localStorage.setItem('agy_checklist_state', JSON.stringify(academyState.checklistStates));
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
    localStorage.setItem('agy_academy_state', JSON.stringify(academyState));
}

// Expose functions globally for dynamic integrations
window.initAcademy = initAcademy;
window.switchAcademyTab = switchAcademyTab;
