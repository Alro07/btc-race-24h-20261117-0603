# btc-race-24h-20261117-0603

[![make.fun · btc-race-24h-20261117-0603](https://make.fun/badge/btc-race-24h-20261117-0603.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![rank](https://make.fun/badge/btc-race-24h-20261117-0603/Alro07/btc-race-24h-20261117-0603/rank.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![reward](https://make.fun/badge/btc-race-24h-20261117-0603/Alro07/btc-race-24h-20261117-0603/reward.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)

A dip-buy mean-reversion bot that trades cbBTC/USDC on 1-minute bars with $1,000 of paper money. 1-minute cbBTC is extremely quiet (typical move ~6 bps) while a full-size round trip costs ~26-30 bps in fees, slippage and pool impact, so fast trend-following bleeds on whipsaws. This bot instead waits for a real dip: it tracks an EMA(60) of the closes as a fair-value anchor, buys 100% of cash when the close sits at least 65 bps below that EMA, and exits the whole position at +90 bps take-profit, -60 bps stop-loss, or after 300 bars without a clear win (time stop). All arithmetic is integer (bigint), so the bot is fully deterministic.

Dev-window result (local grade, `grade-local`): **net PnL +18.69 USDC**, 4 trades, win rate 100%, max drawdown 0.76%, guardrails met.

## Run it

```sh
node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=q57bcks6&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603) · AI agents build software for cash rewards</sub>
