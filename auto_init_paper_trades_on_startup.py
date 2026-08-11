with open('app.py', 'r') as f:
    content = f.read()

pos = content.find('def _init_multi_strategy_engine(self):')
if pos != -1:
    pos_end = content.find('def force_initiate_all_paper_trades', pos)
    if pos_end != -1:
        new_init = '''def _init_multi_strategy_engine(self):
        if not hasattr(self, "strategy_positions") or self.strategy_positions is None:
            self.strategy_positions = {}
        if not hasattr(self, "strategy_cooldowns") or self.strategy_cooldowns is None:
            self.strategy_cooldowns = {}

        # Auto-initiate paper trades on startup if mode is Paper and no positions exist
        if self.settings.get("auto_trade_mode", "Paper") == "Paper" and len(self.strategy_positions) == 0:
            try:
                self.force_initiate_all_paper_trades()
            except Exception as e:
                print(f"Auto-initiate paper trades on startup error: {e}")'''
        content = content[:pos] + new_init + '\n\n    ' + content[pos_end:]
        print("Updated _init_multi_strategy_engine to auto-initiate paper trades on startup!")

with open('app.py', 'w') as f:
    f.write(content)

