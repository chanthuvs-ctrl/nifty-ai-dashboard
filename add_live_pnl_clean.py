with open('static/script.js', 'r') as f:
    js = f.read()

target = 'if (reasonEl) {\n            reasonEl.innerText = s.reason || "Evaluating market conditions...";\n        }'

pnl_code = '''if (reasonEl) {
            reasonEl.innerText = s.reason || "Evaluating market conditions...";
        }

        // Update Live Position & Live PnL Box
        const posBadge = document.getElementById(`pos-badge-${key}`);
        const posPnl = document.getElementById(`pos-pnl-${key}`);

        if (s.active_position) {
            const p = s.active_position;
            const pnlVal = p.pnl_rupees || 0.0;
            if (posBadge) {
                posBadge.innerHTML = `<span style="color: #38bdf8;">🟢 OPEN:</span> ${p.symbol || 'NIFTY TRADE'} (${p.lots || 1} Lot)`;
            }
            if (posPnl) {
                const isWin = pnlVal >= 0;
                posPnl.innerText = `Live PnL: ${isWin ? '+' : ''}₹${pnlVal.toFixed(2)}`;
                posPnl.style.color = isWin ? '#10b981' : '#ef4444';
            }
        } else {
            if (posBadge) {
                posBadge.innerText = "⚪ NO ACTIVE POSITION";
                posBadge.style.color = "#94a3b8";
            }
            if (posPnl) {
                posPnl.innerText = "PnL: ₹0.00";
                posPnl.style.color = "#cbd5e1";
            }
        }'''

js = js.replace(target, pnl_code)

with open('static/script.js', 'w') as f:
    f.write(js)

