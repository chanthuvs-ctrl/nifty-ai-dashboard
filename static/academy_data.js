// Trading Academy Curriculum and Content Database
const ACADEMY_DATA = {
    modules: [
        {
            id: 1,
            title: "Introduction to Nifty & Market Structure",
            difficulty: "Beginner",
            estimatedTime: "25 mins",
            description: "Master the foundational structures of the Nifty 50, types of market movements, and understanding candlestick anatomy.",
            content: `
                <h3>Nifty 50 & Indian Market Foundations</h3>
                <p>The <strong>Nifty 50</strong> is the benchmark index of the National Stock Exchange of India (NSE), consisting of the 50 largest and most actively traded stocks. For options and order flow traders, Nifty represents high liquidity, tight bid-ask spreads, and reliable technical patterns.</p>
                
                <h3>Market Structure Types</h3>
                <ul>
                    <li><strong>Trending Market (Bullish/Bearish):</strong> Defined by Higher Highs (HH) & Higher Lows (HL) in an uptrend, or Lower Lows (LL) & Lower Highs (LH) in a downtrend.</li>
                    <li><strong>Range-Bound Market:</strong> Price moves sideways between established horizontal Support and Resistance zones. Breakout strategies fail here; mean reversion rules.</li>
                    <li><strong>Expansion vs. Contraction:</strong> Markets cycle from contraction (low volatility range build-up) to expansion (high volatility trend breakouts).</li>
                </ul>

                <div class="tip-box">
                    <strong>Real Market Example:</strong> On typical trend-day expansions in Nifty (often triggered by global news or earnings of heavyweight stocks like HDFC Bank or Reliance), the index breaks the opening 15-minute high and trends one way all day, supported by heavy institutional volumes.
                </div>

                <h3>Anatomy of a Candlestick</h3>
                <p>Every candle shows the battle between bulls and bears over a specific time frame (1m, 5m, 15m, 1h, Daily):</p>
                <ul>
                    <li><strong>Body:</strong> The range between Open and Close.</li>
                    <li><strong>Wicks/Shadows:</strong> The rejection of highs or lows. Long bottom wicks indicate bullish rejection; long top wicks show bearish rejection.</li>
                </ul>
            `,
            quiz: [
                {
                    question: "What constitutes a healthy bullish market structure?",
                    options: [
                        "Equal Highs and Lower Lows",
                        "Higher Highs and Higher Lows",
                        "Lower Highs and Lower Lows",
                        "Sideways consolidations"
                    ],
                    correctIndex: 1,
                    explanation: "A bullish trend is characterized by a series of Higher Highs (HH) and Higher Lows (HL) as demand pushes price up and buyers support retracements at higher price levels."
                },
                {
                    question: "Nifty 50 is an index composed of how many stocks?",
                    options: [
                        "30",
                        "50",
                        "100",
                        "500"
                    ],
                    correctIndex: 1,
                    explanation: "Nifty 50 represents the top 50 largest and most liquid companies listed on the National Stock Exchange (NSE)."
                }
            ],
            exercises: "Exercise: Open a Nifty 5m chart. Mark the last 5 swings. Identify whether the market is currently printing Higher Highs/Higher Lows or Lower Highs/Lower Lows. Write down your classification (Bullish, Bearish, or Range Bound).",
            assignment: "Assignment: Draw and label the parts of a bearish pin bar candlestick showing top wick rejection. Explain why this happens in terms of supply and demand."
        },
        {
            id: 2,
            title: "TradingView Workspace Optimization",
            difficulty: "Beginner",
            estimatedTime: "20 mins",
            description: "Learn how to optimize your TradingView workspace, set custom indicators, and structure key layouts.",
            content: `
                <h3>Setting Up Your TradingView Canvas</h3>
                <p>A professional workspace minimizes clutter. Use a dark theme to reduce eye strain during long hours. Clean layouts allow faster decision making.</p>
                
                <h3>Essential Chart Configurations</h3>
                <ul>
                    <li><strong>Timeframes:</strong> Keep a multi-timeframe grid open. Standard day trading layout: 15m (macro structure), 5m (execution), 1m (fine-tuning/confirmation).</li>
                    <li><strong>Volume Indicator:</strong> Color-code your volume by candle close. Enable Volume Moving Average (20-period) to instantly spot above-average institutional volume.</li>
                    <li><strong>Key Indicators:</strong> Load VWAP (Volume Weighted Average Price) with standard deviation bands, and EMA 20/50/200 for dynamic trend filters.</li>
                </ul>

                <div class="tip-box">
                    <strong>TradingView Shortcut Tip:</strong> Pressing <code>[Option + P]</code> (Mac) or <code>[Alt + P]</code> (Windows) changes your chart style to percentage. Pressing <code>[Option + I]</code> or <code>[Alt + I]</code> reverses your chart scale, which is an excellent psychological trick to verify if a short setup looks equally clean as a long setup.
                </div>
            `,
            quiz: [
                {
                    question: "Which timeframe combination is recommended for multi-timeframe analysis in day trading?",
                    options: [
                        "Daily, Weekly, Monthly",
                        "15-minute (Macro), 5-minute (Execution), 1-minute (Entry)",
                        "1-minute, 3-minute, 5-minute only",
                        "4-hour, 1-hour, 15-minute only"
                    ],
                    correctIndex: 1,
                    explanation: "Using 15m for structural bias, 5m for primary intraday execution, and 1m for entries helps reduce noise while keeping structural context clear."
                }
            ],
            exercises: "Exercise: Save a custom template in TradingView named 'Nifty Day Trading'. Set dark mode, hide gridlines, and add volume with a 20 SMA.",
            assignment: "Assignment: Set up a layout split screen in TradingView containing Nifty Spot on the left and India VIX on the right. Note how spot price reacts when VIX spikes."
        },
        {
            id: 3,
            title: "Dhan DEXT T3 Order Flow Setup",
            difficulty: "Intermediate",
            estimatedTime: "30 mins",
            description: "A complete integration guide for utilizing the Dhan DEXT T3 platform to analyze real-time order flow.",
            content: `
                <h3>Dhan DEXT T3 Platform Architecture</h3>
                <p>The <strong>Dhan DEXT T3</strong> terminal provides advanced execution and data analytics tools. For Indian traders, it offers direct order book insights and lightning-fast execution pipelines directly from charts.</p>
                
                <h3>Configuring the Order Flow Terminal</h3>
                <ul>
                    <li><strong>T3 Order Depth (DOM):</strong> The Depth of Market showing pending buy and sell limit orders. Look for high limit size blocks (potential support/resistance).</li>
                    <li><strong>Tick-by-Tick Feeds:</strong> Ensure tick data is active. This allows the system to build accurate footprints, as standard candle charts only show summarized OHLC data.</li>
                    <li><strong>Basket Orders:</strong> Set up pre-configured option baskets (e.g. Bull Put spreads, Iron Condors) to execute all legs in one click, minimizing slippage.</li>
                </ul>

                <div class="tip-box">
                    <strong>Dhan Setup Rule:</strong> In Dhan DEXT, navigate to Settings -> Trading. Enable 'Instant Order Placement' and set the default option lot size for Nifty. This lets you press Buy/Sell buttons on the DOM and get filled in milliseconds.
                </div>
            `,
            quiz: [
                {
                    question: "Why is tick-by-tick data crucial for Order Flow trading?",
                    options: [
                        "It shows historical closing prices.",
                        "It provides every individual trade's execution details (size and price), allowing footprint creation.",
                        "It helps draw Fibonacci retracements.",
                        "It makes the chart load faster."
                    ],
                    correctIndex: 1,
                    explanation: "Tick-by-tick feeds supply raw execution data. Without it, you cannot aggregate buying and selling volumes at individual prices to create footprint and imbalance charts."
                }
            ],
            exercises: "Exercise: Open Dhan DEXT. Set up a DOM sidebar layout. Watch the bids/asks shift during a Nifty market open (09:15 AM) and note down the price with the largest order block.",
            assignment: "Assignment: Create a step-by-step guide for yourself on how to execute an option spread basket order on Dhan DEXT with pre-defined stops."
        },
        {
            id: 4,
            title: "GoCharting Order Flow Platform Guide",
            difficulty: "Intermediate",
            estimatedTime: "25 mins",
            description: "How to configure footprint charts, cumulative delta, and volume profile using GoCharting.",
            content: `
                <h3>GoCharting Platform Overview</h3>
                <p><strong>GoCharting</strong> is one of the premier web-based charting engines offering native Indian NSE order flow feeds without expensive desktop software.</p>
                
                <h3>Key Setup Configurations</h3>
                <ol>
                    <li><strong>Chart Type:</strong> Select 'Footprint' or 'Cluster' chart in the chart drop-down.</li>
                    <li><strong>Cluster Style:</strong> Set to 'Bid x Ask' to see the exact passive vs aggressive trading matches at each price level.</li>
                    <li><strong>Delta Profile Panel:</strong> Enable Cumulative Delta at the bottom to watch the net aggressive buying/selling across the day.</li>
                </ol>

                <div class="tip-box">
                    <strong>Imbalance Configuration:</strong> In GoCharting settings, turn on 'Diagonal Bid/Ask Imbalance'. Set the ratio threshold to <strong>300% (3.0x)</strong>. This will highlight active buyer or seller dominance in bright green or red boxes.
                </div>
            `,
            quiz: [
                {
                    question: "What is the recommended diagonal imbalance ratio threshold in GoCharting?",
                    options: [
                        "100%",
                        "150%",
                        "300%",
                        "500%"
                    ],
                    correctIndex: 2,
                    explanation: "A 300% threshold means aggressive buying volume must be at least three times the diagonal aggressive selling volume to qualify as an imbalance."
                }
            ],
            exercises: "Exercise: Set up a cluster chart in GoCharting for Nifty continuous futures. Change style to Imbalance and adjust colors to Neon Green (Bulls) and Neon Red (Bears).",
            assignment: "Assignment: Explain the difference between horizontal volume profile and vertical cumulative delta. Write a short paragraph on what each represents."
        },
        {
            id: 5,
            title: "Volume Profile Playbook (VAH, VAL, POC)",
            difficulty: "Intermediate",
            estimatedTime: "30 mins",
            description: "Master Volume Profile analysis. Learn to locate Point of Control, Value Area High, and Value Area Low.",
            content: `
                <h3>The Volume Profile Concept</h3>
                <p>Standard volume shows volume per unit of <strong>time</strong>. Volume Profile shows volume per unit of <strong>price</strong>. It reveals where institutions spent money.</p>
                
                <h3>Anatomy of the Profile</h3>
                <ul>
                    <li><strong>POC (Point of Control):</strong> The price level with the absolute highest executed volume during the profile period. Acts as a strong magnetic pull.</li>
                    <li><strong>Value Area (VA):</strong> The price range where 70% of the day's volume was traded.</li>
                    <li><strong>VAH (Value Area High):</strong> The upper boundary of the Value Area.</li>
                    <li><strong>VAL (Value Area Low):</strong> The lower boundary of the Value Area.</li>
                    <li><strong>HVN (High Volume Nodes):</strong> Price levels where heavy trading occurred, acting as support/resistance.</li>
                    <li><strong>LVN (Low Volume Nodes):</strong> Price levels where buyers and sellers rejected trading quickly. Price usually sweeps through LVNs rapidly.</li>
                </ul>

                <div class="tip-box">
                    <strong>Playbook Rule:</strong> In a value area shift, if price opens inside yesterday's Value Area, mean reversion is highly probable (fade VAH and VAL). If price opens outside yesterday's Value Area and holds, look for a strong trend day in that direction.
                </div>
            `,
            quiz: [
                {
                    question: "What does the Point of Control (POC) represent in a Volume Profile?",
                    options: [
                        "The absolute high price of the session",
                        "The price level with the highest volume traded",
                        "The lowest volume node of the day",
                        "The opening price of the session"
                    ],
                    correctIndex: 1,
                    explanation: "POC is the price node representing the highest concentration of trading activity (volume), showing maximum consensus of value."
                },
                {
                    question: "What percentage of volume is contained within the standard Value Area?",
                    options: [
                        "50%",
                        "70%",
                        "90%",
                        "100%"
                    ],
                    correctIndex: 1,
                    explanation: "By convention, the Value Area covers the price levels where 70% (technically 68.2%, mimicking one standard deviation) of the total volume was executed."
                }
            ],
            exercises: "Exercise: Open the interactive chart simulator. Select 'Volume Profile' layout. Locate the POC line and notice how price reacts when it pulls back to this level.",
            assignment: "Assignment: Write a short playbook guide describing the '80% Rule' of Volume Profile (what happens when price enters and holds inside yesterday's value area)."
        },
        {
            id: 6,
            title: "Anchored VWAP Playbook & S/R Zones",
            difficulty: "Intermediate",
            estimatedTime: "30 mins",
            description: "How to anchor VWAP from key structural events to identify institutional buy and sell zones.",
            content: `
                <h3>Why Anchor the VWAP?</h3>
                <p>Standard VWAP resets daily at market open. While useful, it ignores longer-term institutional reference points. By **anchoring** VWAP to major structural events, we can view the average price institutions paid since that event.</p>
                
                <h3>Key Anchoring Events</h3>
                <ul>
                    <li><strong>Major Swing Highs/Lows:</strong> Anchoring to a swing low shows support from the start of a trend.</li>
                    <li><strong>Earnings / Major News:</strong> Anchoring from the release candle shows the market response average.</li>
                    <li><strong>Market Open of Trend Days:</strong> Anchor to the 09:15 AM candle of a known trend day.</li>
                </ul>

                <div class="tip-box">
                    <strong>Anchor VWAP Setup:</strong> When Nifty breaks out from a consolidative range, anchor a VWAP to the breakout candle. On subsequent pullbacks, this Anchored VWAP line will act as a major support zone where bulls will step in.
                </div>
            `,
            quiz: [
                {
                    question: "From which point should you anchor the VWAP to find key support during an uptrend?",
                    options: [
                        "The highest point of the previous month",
                        "The swing low that started the bullish move",
                        "Randomly from the middle of the range",
                        "Only from the close of the day"
                    ],
                    correctIndex: 1,
                    explanation: "Anchoring from the swing low represents the collective cost basis of all participants who drove the bullish expansion from its origin. It serves as institutional support."
                }
            ],
            exercises: "Exercise: Locate the Anchored VWAP tool in TradingView. Find a major Nifty swing low from last week and anchor it. Highlight the times price tested this line.",
            assignment: "Assignment: Describe how you would use Anchored VWAP to verify if a breakout is real vs. a fakeout based on whether price remains above or below the anchor line."
        },
        {
            id: 7,
            title: "Liquidity Sweep Handbook",
            difficulty: "Intermediate",
            estimatedTime: "35 mins",
            description: "Identify liquidity pools, stop runs, and sweep reversals in Nifty intraday structures.",
            content: `
                <h3>Understanding Liquidity Pools</h3>
                <p>Institutions trade in massive block sizes. To buy, they need selling volume. To sell, they need buying volume. They find this counter-liquidity where retail traders place their stop losses (Liquidity Pools).</p>
                
                <h3>Types of sweeps</h3>
                <ul>
                    <li><strong>Buy-Side Liquidity (BSL):</strong> Located above equal highs, swing highs, and yesterday's high. Stop losses of shorts (buy stops) reside here.</li>
                    <li><strong>Sell-Side Liquidity (SSL):</strong> Located below equal lows, swing lows, and yesterday's low. Stop losses of longs (sell stops) reside here.</li>
                    <li><strong>The Sweep (Stop Hunt):</strong> Price pierces these highs/lows to trigger the stops (converting them to market orders) and then immediately reverses.</li>
                </ul>

                <div class="tip-box">
                    <strong>Trading Reversal Sign:</strong> A clean Liquidity Sweep displays a long candle wick piercing a key level, followed by an immediate close back inside the range, accompanied by high volume/delta divergence.
                </div>
            `,
            quiz: [
                {
                    question: "What happens during a bullish Sell-Side Liquidity (SSL) sweep?",
                    options: [
                        "Price breaks below a swing low, holds, and continues falling.",
                        "Price spikes below a swing low to trigger long stops, then quickly closes back above the level to reverse upwards.",
                        "Price consolidates in a tight range.",
                        "Institutions close all their positions."
                    ],
                    correctIndex: 1,
                    explanation: "A sweep triggers retail stop-losses (sell orders), providing the large buy liquidity institutions require to fill their buy positions before driving price higher."
                }
            ],
            exercises: "Exercise: Practice finding SSL sweeps in the Chart Playground. Spot the candle that swept the low and count how many ticks it went below support before reversing.",
            assignment: "Assignment: Outline a trading plan for entry, stop loss, and target based on a 'Yesterday's Low Sweep' pattern on Nifty 5m."
        },
        {
            id: 8,
            title: "Footprint & Delta Handbook",
            difficulty: "Advanced",
            estimatedTime: "40 mins",
            description: "Deep dive into Order Flow Footprint analysis. Read aggressive buyers versus sellers in real-time.",
            content: `
                <h3>Demystifying the Footprint Chart</h3>
                <p>Footprint charts reveal the micro-structure of a candle. Instead of a single bar, it shows a grid of price blocks containing <strong>Bid Volume x Ask Volume</strong>.</p>
                
                <h3>Footprint Key Metrics</h3>
                <ul>
                    <li><strong>Bid (Left Side):</strong> Passive buyers / Aggressive sellers executing via market sell orders.</li>
                    <li><strong>Ask (Right Side):</strong> Passive sellers / Aggressive buyers executing via market buy orders.</li>
                    <li><strong>Delta:</strong> The net difference between aggressive buyers and sellers inside that candle (Ask Vol - Bid Vol).</li>
                    <li><strong>Cumulative Delta:</strong> Running total of delta throughout the trading session.</li>
                </ul>

                <div class="tip-box">
                    <strong>Interpretation Rule:</strong> If price is rising but Cumulative Delta is making lower lows, it indicates **Delta Divergence**. Aggressive sellers are hitting the bids, but passive buyers are absorbing their orders. A reversal is close.
                </div>
            `,
            quiz: [
                {
                    question: "If a candle has a Bid Volume of 5,000 and an Ask Volume of 8,000, what is its Delta?",
                    options: [
                        "-3,000",
                        "+3,000",
                        "13,000",
                        "1.6"
                    ],
                    correctIndex: 1,
                    explanation: "Delta = Ask Volume - Bid Volume. In this case, 8,000 - 5,000 = +3,000, indicating aggressive buying dominance."
                },
                {
                    question: "What does Delta Divergence indicate?",
                    options: [
                        "A strong continuation of the current trend",
                        "A mismatch between aggressive trade direction and price action, suggesting absorption/impending reversal",
                        "The market is about to close",
                        "Low volume in the options chain"
                    ],
                    correctIndex: 1,
                    explanation: "Delta Divergence (e.g., negative delta but price closes higher) shows that aggressive orders are failing to push price, indicating passive absorption by large limit orders."
                }
            ],
            exercises: "Exercise: Open a Footprint cluster in the playground. Identify the candle with the highest positive delta. Check if the price closed near the high.",
            assignment: "Assignment: Draw a representation of a bullish footprint cluster showing buying imbalances on the ask side."
        },
        {
            id: 9,
            title: "Footprint Imbalances & Absorption",
            difficulty: "Advanced",
            estimatedTime: "35 mins",
            description: "Advanced order flow setups including trapped traders, buying/selling imbalances, and absorption zones.",
            content: `
                <h3>Aggressive Imbalances</h3>
                <p>Imbalances compare buying volume at one price level with selling volume at the price level **diagonally below it**. An imbalance occurs when this ratio exceeds 3:1.</p>
                
                <h3>Trapped Traders & Absorption</h3>
                <ul>
                    <li><strong>Trapped Buyers:</strong> Large positive delta clusters at the very top of a bullish candle, but the candle closes red. These buyers are immediately in drawdown and will be forced to sell.</li>
                    <li><strong>Trapped Sellers:</strong> Large negative delta clusters at the very bottom of a bearish candle, but the candle closes green.</li>
                    <li><strong>Absorption:</strong> Large market orders are absorbed by institutional limit orders (block orders). Price refuses to move past a level despite high volume.</li>
                </ul>
            `,
            quiz: [
                {
                    question: "Where do you look to find 'Trapped Buyers' on a footprint candle?",
                    options: [
                        "At the very bottom of a bearish candle",
                        "At the very top of a bullish candle that subsequently closes red or fails to follow through",
                        "In the exact middle of a range candle",
                        "Only during pre-market hours"
                    ],
                    correctIndex: 1,
                    explanation: "Trapped buyers enter aggressively at the highs (expecting a breakout), but their orders are absorbed by passive sellers, resulting in price turning down and leaving them trapped."
                }
            ],
            exercises: "Exercise: Review the interactive chart simulator. Switch to 'Footprint Delta' view. Locate where a heavy imbalance occurred and check if it formed an order block support.",
            assignment: "Assignment: Explain how you would trade a Trapped Sellers setup. Write entry criteria, stop placement, and target."
        },
        {
            id: 10,
            title: "Institutional Trading & SMC",
            difficulty: "Advanced",
            estimatedTime: "40 mins",
            description: "Master Smart Money Concepts (SMC): Order Blocks, Fair Value Gaps (FVG), and Market Structure Shifts (MSS).",
            content: `
                <h3>Smart Money Concepts (SMC) Foundations</h3>
                <p>SMC models market movements around institutional operations. Price moves to mitigate order imbalances and sweep retail liquidity.</p>
                
                <h3>Core SMC Concepts</h3>
                <ul>
                    <li><strong>Order Block (OB):</strong> The last candle before a rapid expansion that breaks structure. It represents institutional buy/sell zones.</li>
                    <li><strong>Fair Value Gap (FVG):</strong> A 3-candle imbalance where the wicks of candle 1 and candle 3 do not overlap, leaving a structural gap. Price tends to retrace to fill these gaps.</li>
                    <li><strong>Change of Character (CHoCH) vs. Break of Structure (BOS):</strong> BOS is a trend continuation breakout. CHoCH is the first sign of a structural shift/trend reversal.</li>
                </ul>

                <div class="tip-box">
                    <strong>Entry Strategy:</strong> Wait for a Liquidity Sweep -> Market Structure Shift (CHoCH) -> Entry on the retest of the freshly created Order Block or FVG.
                </div>
            `,
            quiz: [
                {
                    question: "What is a Fair Value Gap (FVG)?",
                    options: [
                        "A gap between today's open and yesterday's close",
                        "A 3-candle structural imbalance where the wicks of candle 1 and 3 do not meet, leaving a price inefficiency",
                        "An options pricing model gap",
                        "A trendline breakout indicator"
                    ],
                    correctIndex: 1,
                    explanation: "An FVG is an inefficiency in price delivery where aggressive market orders drive price quickly, leaving unfilled passive liquidity that the market tends to revisit."
                }
            ],
            exercises: "Exercise: Practice spotting FVGs on the Nifty chart. Mark the boundaries of the gap and observe how price fills the zone before reversing.",
            assignment: "Assignment: Sketch a complete CHoCH reversal pattern from bearish to bullish. Mark the swing high, the sweep, the breakout candle (CHoCH), and the order block."
        },
        {
            id: 11,
            title: "Nifty Options: Buying vs Selling",
            difficulty: "Advanced",
            estimatedTime: "30 mins",
            description: "Analyze the mathematical edge, pros, and cons of Option Buying versus Option Selling in Nifty.",
            content: `
                <h3>The Great Debate: Buying vs. Selling</h3>
                <p>Trading options in Nifty requires deciding between buying premium or selling (writing) premium. Each has distinct mathematical characteristics.</p>
                
                <h3>Comparison Grid</h3>
                <table class="academy-table">
                    <thead>
                        <tr>
                            <th>Metric</th>
                            <th>Option Buying</th>
                            <th>Option Selling</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Win Rate</strong></td>
                            <td>Lower (~33%)</td>
                            <td>Higher (~67%)</td>
                        </tr>
                        <tr>
                            <td><strong>Capital Required</strong></td>
                            <td>Low (Premium only)</td>
                            <td>High (Margin required)</td>
                        </tr>
                        <tr>
                            <td><strong>Time Decay (Theta)</strong></td>
                            <td>Works against you</td>
                            <td>Works for you (Profits)</td>
                        </tr>
                        <tr>
                            <td><strong>Risk Profile</strong></td>
                            <td>Defined (Loss capped)</td>
                            <td>Undefined (Unless hedged)</td>
                        </tr>
                    </tbody>
                </table>
            `,
            quiz: [
                {
                    question: "Which factor benefits Option Sellers daily in a flat market?",
                    options: [
                        "Vega (Volatility)",
                        "Theta (Time Decay)",
                        "Delta (Price Direction)",
                        "Gamma (Acceleration)"
                    ],
                    correctIndex: 1,
                    explanation: "Theta decay reduces the premium value of an option every day. For option writers (sellers), this decay represents profit as long as the market remains stable or moves in their favor."
                }
            ],
            exercises: "Exercise: Select an at-the-money (ATM) Nifty call option. Write down its price at 09:30 AM and 03:00 PM on a flat day. Notice the Theta decay.",
            assignment: "Assignment: Write a short essay on why option buyers must have high momentum and speed of execution to be profitable, despite lower margins."
        },
        {
            id: 12,
            title: "Directional Option Spreads",
            difficulty: "Advanced",
            estimatedTime: "35 mins",
            description: "Learn to build and manage Bull Call Spreads, Bear Put Spreads, and Ratio Spreads on Nifty.",
            content: `
                <h3>Mitigating Risk with Option Spreads</h3>
                <p>Naked option buying exposes you to high Theta decay. Naked option selling exposes you to unlimited tail risk. **Spreads** bridge this gap by combining buy and sell legs.</p>
                
                <h3>Directional Spreads Playbook</h3>
                <ul>
                    <li><strong>Bull Call Spread:</strong> Buy ATM Call + Sell OTM Call. Reduces cost basis and Theta decay, but caps maximum profit.</li>
                    <li><strong>Bear Put Spread:</strong> Buy ATM Put + Sell OTM Put. Protective strategy for directional downturns.</li>
                    <li><strong>Bull Put Spread (Credit):</strong> Sell ATM Put + Buy OTM Put. Receives net credit, profitable if price stays flat or rises.</li>
                </ul>

                <div class="tip-box">
                    <strong>Nifty Spread Margin Tip:</strong> By executing the BUY leg first in your basket order, Indian brokers like Dhan will automatically grant margin benefits, reducing the spread margin requirement from 1.2 Lakhs to under 35,000 INR.
                </div>
            `,
            quiz: [
                {
                    question: "What is the primary benefit of a Bull Call Spread compared to a Naked Call Buy?",
                    options: [
                        "It has unlimited profit potential.",
                        "It reduces the cost of the trade and mitigates Theta decay by selling an OTM call.",
                        "It requires zero margin.",
                        "It has a 100% win rate."
                    ],
                    correctIndex: 1,
                    explanation: "By selling a further out-of-the-money (OTM) call, you collect premium which offsets the cost of the long call and offsets some of the negative effects of time decay."
                }
            ],
            exercises: "Exercise: Set up a Bull Call Spread on the interactive journal template. Enter strikes, premiums, and compute the maximum risk/reward ratio.",
            assignment: "Assignment: Draw the payoff diagram of a Bear Put Spread showing break-even point, max loss, and max profit."
        },
        {
            id: 13,
            title: "Non-Directional Option Strategies",
            difficulty: "Advanced",
            estimatedTime: "40 mins",
            description: "How to deploy Iron Condors, Straddles, and Strangles, and manage adjustments during volatile sessions.",
            content: `
                <h3>Mean Reversion & Volatility Playbook</h3>
                <p>Range-bound regimes represent 60-70% of market sessions. Non-directional strategies allow you to profit when the market goes nowhere.</p>
                
                <h3>Key Strategies</h3>
                <ul>
                    <li><strong>Iron Condor:</strong> Sell OTM Put Spread + Sell OTM Call Spread. Highly defined risk, perfect for low VIX regimes.</li>
                    <li><strong>Short Straddle:</strong> Sell ATM Call + Sell ATM Put. High profit potential but exposed to large directional moves. Must be adjusted actively.</li>
                    <li><strong>Short Strangle:</strong> Sell OTM Call + Sell OTM Put. Offers wider buffer zones.</li>
                </ul>

                <div class="tip-box">
                    <strong>Strangle Adjustment Rule:</strong> If Nifty breaks out upside and tests your Call strike, roll up your Put strike to collect more premium, neutralising Delta back to zero.
                </div>
            `,
            quiz: [
                {
                    question: "An Iron Condor is composed of which combination?",
                    options: [
                        "Buy Call, Sell Put",
                        "Sell OTM Put Spread + Sell OTM Call Spread",
                        "Buy ATM Straddle",
                        "Sell futures and buy ATM calls"
                    ],
                    correctIndex: 1,
                    explanation: "An Iron Condor sells both call and put spreads far out of the money, capping maximum risk on both sides while benefiting from Theta decay inside the range."
                }
            ],
            exercises: "Exercise: Use the Option Chain view in the dashboard. Identify the strikes for a Nifty Iron Condor that yields a 1:1 risk-to-reward ratio.",
            assignment: "Assignment: Write an adjustment playbook for a Short Straddle when Nifty gaps up 1.5% at the open."
        },
        {
            id: 14,
            title: "Advanced Option Greeks & VIX Dynamics",
            difficulty: "Advanced",
            estimatedTime: "35 mins",
            description: "Master Delta, Gamma, Vega, Theta, and how India VIX shifts option pricing.",
            content: `
                <h3>The Engine of Option Pricing: Greeks</h3>
                <p>Understanding Greeks is essential to manage risk. They measure options sensitivity to price, time, and volatility changes.</p>
                
                <h3>The Greeks Breakdown</h3>
                <ul>
                    <li><strong>Delta:</strong> Measures option sensitivity to spot price changes. Range: 0 to 1 for Calls, -1 to 0 for Puts.</li>
                    <li><strong>Gamma:</strong> The acceleration of Delta. High Gamma near expiry can cause option prices to spike wildly (Hero-Zero trades).</li>
                    <li><strong>Theta:</strong> Time decay per day. Accelerates rapidly in the last 48 hours before expiry.</li>
                    <li><strong>Vega:</strong> Sensitivity to Volatility (VIX). If VIX rises, all option premiums inflate.</li>
                </ul>
            `,
            quiz: [
                {
                    question: "Which Greek represents the acceleration/rate of change of Delta?",
                    options: [
                        "Vega",
                        "Theta",
                        "Gamma",
                        "Rho"
                    ],
                    correctIndex: 2,
                    explanation: "Gamma measures the rate of change of Delta. A high Gamma means Delta will change rapidly with small movements in the spot price, characteristic of short-dated ATM options."
                }
            ],
            exercises: "Exercise: Look at the dashboard option chain. Compare the Gamma values of weekly options versus monthly options. Note the difference.",
            assignment: "Assignment: Explain why option buyers lose money when VIX crashes sharply (e.g., post-budget or post-election), even if they got the price direction right."
        },
        {
            id: 15,
            title: "Risk Management Framework",
            difficulty: "Professional",
            estimatedTime: "30 mins",
            description: "Set up position sizing, calculate risk-reward ratios, and manage daily drawdown limits.",
            content: `
                <h3>Capital Preservation: The Golden Rule</h3>
                <p>Even a strategy with an 80% win rate will bankrupt you without risk management. You must structure trade parameters to survive series of losses.</p>
                
                <h3>Professional Risk Constraints</h3>
                <ul>
                    <li><strong>1% Rule:</strong> Never risk more than 1% of your total trading capital on a single trade.</li>
                    <li><strong>Risk-to-Reward (R:R):</strong> Target a minimum of 1:2. This allows you to remain profitable even with a 40% win rate.</li>
                    <li><strong>Daily Drawdown Cap:</strong> Set a hard limit (e.g., 2% of capital). If reached, close the terminal and walk away.</li>
                </ul>

                <div class="tip-box">
                    <strong>Example Position Size:</strong> Capital = 5,00,000 INR. 1% Risk = 5,000 INR. If your trade setup stop-loss is 10 points on Nifty (500 INR per lot), your maximum position size is 10 lots (500 qty).
                </div>
            `,
            quiz: [
                {
                    question: "If your capital is 10,00,000 INR, and you follow the 1% risk rule, what is your maximum risk per trade?",
                    options: [
                        "1,000 INR",
                        "10,000 INR",
                        "1,00,000 INR",
                        "50,000 INR"
                    ],
                    correctIndex: 1,
                    explanation: "1% of 10,00,000 INR is 10,000 INR. This is the maximum loss you should accept if your stop-loss is triggered."
                }
            ],
            exercises: "Exercise: Fill in the settings panel in the dashboard. Set Capital to 5,00,000 and Risk % to 1.5. Save and check the resulting position sizes.",
            assignment: "Assignment: Calculate the required win rate to break even if your average risk-to-reward ratio is 1:3."
        },
        {
            id: 16,
            title: "Trading Psychology & Emotional Discipline",
            difficulty: "Professional",
            estimatedTime: "25 mins",
            description: "Understand cognitive biases, combat FOMO/revenge trading, and develop professional consistency.",
            content: `
                <h3>The Psychological Battle</h3>
                <p>Trading is a game of probability. The human brain, however, is wired for certainty and survival, leading to systematic trading errors.</p>
                
                <h3>Major Cognitive Biases</h3>
                <ul>
                    <li><strong>Loss Aversion:</strong> Holding losing trades hoping they return to break-even, resulting in catastrophic losses.</li>
                    <li><strong>FOMO (Fear of Missing Out):</strong> Chasing price after a large move, entering at the worst possible price.</li>
                    <li><strong>Revenge Trading:</strong> Increasing position size after a loss to 'win back' money, causing account blowups.</li>
                </ul>

                <div class="tip-box">
                    <strong>Psychology Hack:</strong> Treat losses as a standard operating cost, identical to rent for a physical business. A stop-loss execution is not a failure; it is a business expense.
                </div>
            `,
            quiz: [
                {
                    question: "Which emotional response leads to increasing position sizes after a loss to recover capital quickly?",
                    options: [
                        "Loss aversion",
                        "Revenge trading",
                        "FOMO",
                        "Recency bias"
                    ],
                    correctIndex: 1,
                    explanation: "Revenge trading is triggered by anger and rejection of a loss, forcing the trader to over-leverage to recover money quickly, typically resulting in further losses."
                }
            ],
            exercises: "Exercise: Write down your personal 'Trading Rules' (e.g. Max 3 trades a day, no trading after 02:30 PM). Print it and place it at your desk.",
            assignment: "Assignment: Write a short paragraph describing a time you revenge traded or chased a trade, what bias triggered it, and how you will prevent it."
        },
        {
            id: 17,
            title: "AI-Assisted Trading & Pine Script",
            difficulty: "Professional",
            estimatedTime: "35 mins",
            description: "Utilize LLMs for strategy generation, pine script creation, and automating market regime scoring.",
            content: `
                <h3>The AI Integration Era</h3>
                <p>Modern traders use artificial intelligence to automate research, write backtesting scripts, and score market regimes quickly.</p>
                
                <h3>AI Framework Applications</h3>
                <ul>
                    <li><strong>Pine Script Generation:</strong> Prompts to generate TradingView indicator code (e.g., custom VWAP/imbalance indicators).</li>
                    <li><strong>Regime Scoring:</strong> Feeding market data (VIX, PCR, ADX, structure) into logic scripts to determine leverage settings.</li>
                    <li><strong>Backtest Analysis:</strong> Uploading trading logs to identify weak spots, bad hours, or poor risk-reward trades.</li>
                </ul>
            `,
            quiz: [
                {
                    question: "How can AI assist in day-to-day Nifty trading strategies?",
                    options: [
                        "By predicting the future with 100% accuracy",
                        "By writing backtest scripts, checking historical regimes, and generating code for alerts",
                        "By replacing human discipline entirely",
                        "By trading without capital"
                    ],
                    correctIndex: 1,
                    explanation: "AI serves as a powerful coding and analysis assistant, automating repetitive tasks like drafting Pine Script backtesters and parsing complex log data."
                }
            ],
            exercises: "Exercise: Use the AI Coding Lab tab to select strategy criteria and generate a draft of a Pine Script strategy.",
            assignment: "Assignment: Design a prompt for an LLM to build a backtesting Pine Script for a Nifty Liquidity Sweep strategy."
        },
        {
            id: 18,
            title: "Daily Trading Checklist & Routines",
            difficulty: "Professional",
            estimatedTime: "30 mins",
            description: "Structure your pre-market, active session, and post-market review checklists for optimal performance.",
            content: `
                <h3>The Professional Routine</h3>
                <p>Consistency comes from systems, not luck. Successful traders run identical routines day in, day out.</p>
                
                <h3>The Three-Phase Routine</h3>
                <ol>
                    <li><strong>Pre-Market Prep (08:30 - 09:15 AM):</strong> Check global cues (SGX Nifty / GIFT Nifty, US markets), mark key levels (yesterday's high/low, POC, VA boundaries), read VIX, and check option chain PCR.</li>
                    <li><strong>Active Session Rules (09:15 AM - 03:30 PM):</strong> Stick to your setups, execute without hesitation, and avoid overtrading.</li>
                    <li><strong>Post-Market Review (03:45 - 04:30 PM):</strong> Journal all trades, screenshot setups, document mistakes, and reset.</li>
                </ol>
            `,
            quiz: [
                {
                    question: "Which of the following is a critical pre-market task?",
                    options: [
                        "Executing market orders at 09:16 AM immediately",
                        "Marking key horizontal levels (high/low, POC) and reviewing global index cues",
                        "Checking option premiums for next week's expiry only",
                        "None of the above"
                    ],
                    correctIndex: 1,
                    explanation: "Establishing structural levels and analyzing the market state before trading commences ensures you act based on a pre-defined plan rather than reacting emotionally to fast tick movements."
                }
            ],
            exercises: "Exercise: Open the 'Daily Checklist' tab. Run through the pre-market checklist for today's market conditions.",
            assignment: "Assignment: Create a personalized post-market log checklist including screenshot archiving and emotional rating."
        },
        {
            id: 19,
            title: "Professional Journaling Templates",
            difficulty: "Professional",
            estimatedTime: "25 mins",
            description: "How to maintain a professional trade journal, identify leakages, and track key metrics.",
            content: `
                <h3>Why Journal?</h3>
                <p>If you don't measure, you cannot improve. A trade journal is your performance mirror. It exposes your leaks (e.g., losing money on Thursdays, over-leverage, premature exits).</p>
                
                <h3>Key Journaling Metrics</h3>
                <ul>
                    <li><strong>Win Rate:</strong> Percentage of profitable trades.</li>
                    <li><strong>Profit Factor:</strong> Gross Profits / Gross Losses. (Target: > 1.5).</li>
                    <li><strong>Average R:R:</strong> Average risk to reward ratio realized.</li>
                    <li><strong>Mistake Tags:</strong> Labeling trades with tags like 'FOMO', 'Chasing', 'Stopped Early', 'Rules Followed'.</li>
                </ul>
            `,
            quiz: [
                {
                    question: "What is the formula for calculating 'Profit Factor'?",
                    options: [
                        "Total Wins / Total Trades",
                        "Gross Profits / Gross Losses",
                        "Max Profit / Max Drawdown",
                        "Capital / Loss Size"
                    ],
                    correctIndex: 1,
                    explanation: "Profit Factor is the ratio of gross profits divided by gross losses. A value above 1.5 indicates a highly viable, robust trading methodology."
                }
            ],
            exercises: "Exercise: Open the Journal Template. Populate it with 3 hypothetical trades (one win, one loss, one break-even) and analyze the analytics output.",
            assignment: "Assignment: Draft a template structure for a weekly performance review. What questions will you ask yourself every Friday?"
        },
        {
            id: 20,
            title: "Master Review & Capstone Challenge",
            difficulty: "Professional",
            estimatedTime: "40 mins",
            description: "Verify your knowledge with a comprehensive trading scenario review and final academy exam.",
            content: `
                <h3>The Final Stage</h3>
                <p>Congratulations on completing the curriculum! You have reviewed market structure, order flow setup, footprint delta, liquidity sweeps, option strategies, risk management, and journaling.</p>
                
                <h3>The Capstone Scenario</h3>
                <p>Imagine Nifty opens at 22,100, which is below yesterday's Value Area Low. Global cues are slightly negative, and India VIX spikes 5%. At 09:45 AM, price sweeps a major swing low at 22,050 and immediately prints a bullish footprint candle with a massive buying imbalance on the ask side (delta turns positive +45,000).</p>
                <p><strong>What is the trade?</strong> This is a classic **Sell-Side Liquidity Sweep** matching institutional buying. You buy ATM calls or write PE spreads, placing stops just below the swept low (22,045), targeting the POC level at 22,120.</p>
            `,
            quiz: [
                {
                    question: "In the Capstone Scenario described, what confirms the reversal after the liquidity sweep?",
                    options: [
                        "VIX continuing to rise",
                        "A bullish footprint candle with positive delta and buying imbalances on the ask side",
                        "Price breaking further down below 22,000",
                        "The option chain showing call writing"
                    ],
                    correctIndex: 1,
                    explanation: "Aggressive buyers stepping in (positive delta and ask imbalances) after a liquidity sweep confirms that institutions are actively absorbing sell orders and driving the reversal."
                }
            ],
            exercises: "Exercise: Take the final exam. Score 100% to unlock your professional master trading certificate.",
            assignment: "Assignment: Write a 1-page Trading Business Plan detailing your chosen strategy, risk parameters, daily schedule, and journaling rules."
        }
    ],
    cheatSheets: [
        {
            title: "Volume Profile Cheat Sheet",
            content: `
| Term | Meaning | Trading Action |
| --- | --- | --- |
| **POC** | Highest volume price | Magnetic pull. Expect consolidation. |
| **VAH** | Value Area High (70% top) | Resistance in ranges. Breakout trigger in trends. |
| **VAL** | Value Area Low (70% bottom) | Support in ranges. Breakdown trigger in trends. |
| **HVN** | High Volume Node | Strong price acceptance. Acts as S/R. |
| **LVN** | Low Volume Node | Price rejection. Expect rapid sweep through area. |
            `
        },
        {
            title: "Order Flow Footprint Patterns",
            content: `
| Pattern | Footprint Appearance | Bias | Action |
| --- | --- | --- | --- |
| **Buying Imbalance** | Ask side > 300% diagonal Bid side | Bullish | Buy pullbacks to imbalance |
| **Selling Imbalance** | Bid side > 300% diagonal Ask side | Bearish | Short pullbacks to imbalance |
| **Trapped Buyers** | High positive delta at top wick + red close | Bearish | Short below candle low |
| **Trapped Sellers** | High negative delta at bottom wick + green close | Bullish | Buy above candle high |
            `
        },
        {
            title: "Option Greeks Quick Ref",
            content: `
| Greek | Measures | Day Trader's View |
| --- | --- | --- |
| **Delta** | Sensitivity to price change | ATM is ~0.50. Buy deep ITM for higher sensitivity. |
| **Gamma** | Rate of change of Delta | Highest near expiry. Good for momentum, bad for sellers. |
| **Theta** | Time decay per day | Elevates exponentially near expiry. Writers benefit. |
| **Vega** | Volatility sensitivity | Spikes in VIX inflate premiums. Buy low VIX, sell high VIX. |
            `
        }
    ]
};

// Expose to window object for frontend script usage
window.ACADEMY_DATA = ACADEMY_DATA;
