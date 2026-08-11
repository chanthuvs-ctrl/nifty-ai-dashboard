with open('static/index.html', 'r') as f:
    html = f.read()

import re

# List of all 14 keys
keys = [
    "first_15m_breakout", "power_of_stocks", "booming_bulls", "trading_legend",
    "larry_williams", "turtle_trading", "minervini_vcp", "oliver_velez",
    "elder_triple_screen", "demark_td9", "darvas_box", "linda_raschke",
    "smc_ict_fvg", "gamma_squeeze"
]

for k in keys:
    card_id = f'id="card-strat-{k}"'
    if card_id in html and f'id="pos-pnl-{k}"' not in html:
        pnl_box = f'''
        <div class="strat-pnl-box" id="pnl-box-{k}" style="margin-top: 8px; padding: 6px 10px; background: rgba(15, 23, 42, 0.6); border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.08); display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem;">
            <span class="pnl-pos-badge" id="pos-badge-{k}" style="color: #94a3b8; font-weight: 600;">⚪ NO ACTIVE POSITION</span>
            <span class="pnl-val-badge" id="pos-pnl-{k}" style="font-weight: 700; color: #cbd5e1;">PnL: ₹0.00</span>
        </div>'''
        
        # Insert right before the closing tag of card-strat-[k]
        pos = html.find(card_id)
        if pos != -1:
            # Find the end of reason box or card
            reason_pos = html.find(f'id="reason-{k}"', pos)
            if reason_pos != -1:
                end_reason_div = html.find('</div>', reason_pos)
                if end_reason_div != -1:
                    html = html[:end_reason_div+6] + pnl_box + html[end_reason_div+6:]
                    print(f"Added live PnL box to card {k}")

with open('static/index.html', 'w') as f:
    f.write(html)

