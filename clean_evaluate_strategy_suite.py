with open('app.py', 'r') as f:
    content = f.read()

clean_suite = '''    def evaluate_strategy_suite(self) -> dict:
        """Evaluates all 14 specialized trading strategies independently."""
        all_strats = [
            ("first_15m_breakout", self.evaluate_first_15m_breakout_strategy()),
            ("power_of_stocks", self.evaluate_power_of_stocks_strategy()),
            ("booming_bulls", self.evaluate_booming_bulls_strategy()),
            ("trading_legend", self.evaluate_trading_legend_strategy()),
            ("larry_williams", self.evaluate_larry_williams_strategy()),
            ("turtle_trading", self.evaluate_turtle_trading_strategy()),
            ("minervini_vcp", self.evaluate_minervini_vcp_strategy()),
            ("oliver_velez", self.evaluate_oliver_velez_strategy()),
            ("elder_triple_screen", self.evaluate_elder_triple_screen_strategy()),
            ("demark_td9", self.evaluate_demark_td9_strategy()),
            ("darvas_box", self.evaluate_darvas_box_strategy()),
            ("linda_raschke", self.evaluate_linda_raschke_strategy()),
            ("smc_ict_fvg", self.evaluate_smc_ict_fvg_strategy()),
            ("gamma_squeeze", self.evaluate_gamma_squeeze_strategy())
        ]

        enabled = self.settings.get("enabled_strategies", {})
        live_deploy = self.settings.get("live_deploy_strategies", {})

        res = {}
        for key, s in all_strats:
            s["is_enabled"] = enabled.get(key, True) if key in enabled else True
            s["is_live_deployed"] = live_deploy.get(key, True) if key in live_deploy else True
            res[key] = s

        return res'''

pos_start = content.find('def evaluate_strategy_suite(self)')
if pos_start != -1:
    pos_end = content.find('def sync_settings_strategies(self)', pos_start)
    if pos_end == -1: pos_end = content.find('def force_initiate_all_paper_trades', pos_start)
    if pos_end != -1:
        content = content[:pos_start] + clean_suite + '\n\n    ' + content[pos_end:]
        print("Replaced evaluate_strategy_suite with clean 14-strategy evaluator!")

with open('app.py', 'w') as f:
    f.write(content)

