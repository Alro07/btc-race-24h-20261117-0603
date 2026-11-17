// Dip-buy mean-reversion bot for the make.fun btc-race-24h-20261117-0603 bounty.
//
// Idea: 1-minute cbBTC/USDC is extremely quiet (typical 1-minute move ~6 bps)
// while a full-size round trip costs ~26-30 bps in fees, slippage and pool
// impact. Fast trend-following therefore bleeds on whipsaws. Instead this bot
// waits for a real dip and buys the rebound:
//
//   * Track an EMA(60) of the 1-minute closes as the "fair value" anchor.
//   * Enter long (100% of cash) when the latest close sits at least 65 bps
//     below that EMA - a genuine dip, not noise.
//   * Exit the whole position when the close is 90 bps above the entry fill
//     price (take profit) or 60 bps below it (stop loss), or when 300 bars
//     have passed without a clear win (time stop: a dip that never bounces
//     is a slow bleed, free the capital for the next setup).
//
// All arithmetic is integer (bigint) on the raw price units, so the bot is
// fully deterministic: the same hello / batch stream always yields the same
// orders. No clock, no network, no randomness, no files outside the repo.
//
// Protocol recap (agent-fun/bars-replay/v1): the harness sends one hello,
// then one batch per bar (each batch carries the bar that just closed, the
// fills of the orders decided on the previous batch, and the account), and
// the bot answers every batch with exactly one reply echoing its seq. An
// order decided on the batch of bar k fills at the open of bar k+1, so the
// entry price the bot actually pays is the next bar's open, not the close
// it decided on - the take-profit / stop-loss are therefore measured against
// the reported fill price, not the decision close.

import { runBars } from "./vendor/makefun-bars.ts";

const SYMBOL = "CBBTC";

// EMA length in bars (minutes). 60 minutes smooths the 1-minute noise while
// still following the day's drift.
const EMA_N = 60n;
// Enter when close is this far below the EMA, in basis points.
const DIP_BPS = 65n;
// Exit when close is this far above / below the entry fill price, in bps.
const TP_BPS = 90n;
const SL_BPS = 60n;
// Time stop: a dip that has not bounced within this many bars is a slow
// bleed, not a dip - free the capital for the next setup instead of riding
// it to the stop. Only fires while the trade is not already clearly winning.
const HOLD_MAX_BARS = 300;
const HOLD_WIN_BPS = 30n;
// Generous slippage cap (2%): the modelled slippage (2 bps) plus pool
// impact (~11 bps on a full-size trade here) sit far inside it, so a fill is
// only ever rejected for a genuinely violent 1-bar gap.
const MAX_SLIPPAGE_BPS = 200;

await runBars({
  onBatch(state, batch) {
    // Fold in the fills of the orders decided on the previous batch: a buy
    // fill tells us the real entry price (next bar's open, slipped and moved
    // by impact), which the exits are measured against.
    let entryPrice: bigint | null = null;
    for (const fill of batch.fills) {
      if (fill.symbol === SYMBOL && fill.side === "buy" && fill.status === "filled") {
        entryPrice = BigInt(fill.price);
      }
    }
    // Keep the entry info on the state object between batches.
    const mem = state as unknown as { _entryPrice?: bigint; _entrySeq?: number };
    if (entryPrice !== null) {
      mem._entryPrice = entryPrice;
      // The fill is reported in this batch, so this batch's seq is the
      // entry bar for the time stop.
      mem._entrySeq = state.seq;
    }

    const close = state.close(SYMBOL);
    if (close === null) return [];
    if (state.warmingUp) return [];

    // EMA update: ema = (2 * close + (N - 1) * ema) / (N + 1), all bigint.
    const emaMem = state as unknown as { _ema?: bigint };
    if (emaMem._ema === undefined) {
      emaMem._ema = close;
    } else {
      emaMem._ema = (2n * close + (EMA_N - 1n) * emaMem._ema) / (EMA_N + 1n);
    }
    const ema = emaMem._ema;

    const held = state.positions.get(SYMBOL);
    const qty = held === undefined ? 0n : held.qty;

    if (qty === 0n) {
      // Flat: only buy a real dip below the EMA anchor.
      const dipBps = ((ema - close) * 10000n) / ema;
      if (dipBps >= DIP_BPS && state.cash > 0n) {
        return [
          {
            side: "buy",
            symbol: SYMBOL,
            notional_quote_units: state.cash,
            max_slippage_bps: MAX_SLIPPAGE_BPS,
          },
        ];
      }
      return [];
    }

    // Long: take profit / stop loss against the entry fill price, plus the
    // time stop for a dip that never bounces.
    const entry = mem._entryPrice;
    if (entry === undefined || entry === 0n) return [];
    const retBps = ((close - entry) * 10000n) / entry;
    const heldBars = mem._entrySeq === undefined ? 0 : state.seq - mem._entrySeq;
    const timedOut = heldBars >= HOLD_MAX_BARS && retBps < HOLD_WIN_BPS;
    if (retBps >= TP_BPS || retBps <= -SL_BPS || timedOut) {
      mem._entryPrice = undefined;
      mem._entrySeq = undefined;
      return [
        {
          side: "sell",
          symbol: SYMBOL,
          qty,
          max_slippage_bps: MAX_SLIPPAGE_BPS,
        },
      ];
    }
    return [];
  },
});
