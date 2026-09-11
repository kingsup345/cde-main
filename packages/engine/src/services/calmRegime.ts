/**
 * The fixed scalp ladder — SL 2.3% / TP1 1.8% / TP2 3.5% — and its one exception.
 * ============================================================================
 * Operator decision (2026-09-11): every sim bot trades ONE fixed ladder, so
 * small moves get taken instead of chased:
 *
 *     SL = 2.3%      TP1 = 1.8% (fast 50% partial)      TP2 = 3.5%
 *
 * TP1 is FIXED at 1.8% — it is never widened AND never narrowed to a bot's own
 * dynamic target. A previous revision floored it at `min(1.8, dynamicTp1)`,
 * which quietly gave Path and Bybit a 1.5% target; the operator wants 1.8
 * everywhere.
 *
 * THE ONE EXCEPTION — a buying surge. When a lot of buyers show up at once, a
 * flat 2.3% stop is inside the noise of the move and gets wicked out of a trade
 * that was right. Only then does the stop widen, to the bot's OWN dynamic
 * (ATR / structure) stop — the number that already reflects that symbol's real
 * volatility — clamped to [2.3%, MAX_LOSS_PERCENT].
 *
 * TP1 stays 1.8% even in a surge: the whole point is a fast small profit. That
 * does make TP1's reward:risk worse (1.8/4.2 = 0.43), which is intentional and
 * why the R:R gate in every bot is measured against TP2, not TP1 — and why TP2
 * scales with the stop (`max(3.5%, 1.2 × SL)`) so the gate stays satisfiable
 * instead of silently rejecting every surge trade.
 */

import type { Candle } from './tradeEngine';
import { computeRelativeVolume } from './tradeEngine';
import { MAX_LOSS_PERCENT } from './exitPolicy';

/** The fixed ladder, as percentages of entry. */
export const FIXED_SL_PCT = 2.3;
export const FIXED_TP1_PCT = 1.8;
export const FIXED_TP2_PCT = 3.5;

/** Last bar's volume must be at least this multiple of its own 20-bar average
 *  to count as "a lot of buyers". Volume alone is direction-blind — a spike can
 *  just as easily be a wave of SELLERS — so `isBuyingSurge` also requires the
 *  bar to close green. */
export const SURGE_REL_VOLUME = 2.0;
export const SURGE_VOLUME_LOOKBACK = 20;

/** The stop may widen only within these bounds during a surge. */
export const SURGE_MIN_SL_PCT = FIXED_SL_PCT;
export const SURGE_MAX_SL_PCT = MAX_LOSS_PERCENT;

/** TP2 must keep this reward:risk against the (possibly widened) stop, because
 *  TP2 is what every bot's R:R gate is measured on in this ladder. Matches the
 *  bots' own `minRewardRisk` / `minRR`. */
export const TP2_MIN_REWARD_RISK = 1.2;

/**
 * "A lot of buyers": the last closed bar traded at least SURGE_REL_VOLUME times
 * its own recent average volume AND closed up. Returns false when there is not
 * enough history to judge — an unknown surge is not a surge.
 */
export function isBuyingSurge(
  candles: Candle[] | undefined,
  lookback: number = SURGE_VOLUME_LOOKBACK,
  now: number = Date.now()
): boolean {
  if (!candles || candles.length < 2) return false;
  const relVolume = computeRelativeVolume(candles, lookback, now);
  if (relVolume === undefined || relVolume < SURGE_REL_VOLUME) return false;
  const last = candles[candles.length - 1];
  return last.close > last.open;
}

export interface LadderPercents {
  slPct: number;
  tp1Pct: number;
  tp2Pct: number;
  /** True when the stop was widened by a buying surge — for telemetry/logging. */
  surged: boolean;
}

/**
 * The ladder for one trade. `dynamicSlPct` is the stop the bot would have used
 * on its own (ATR / structure / range), as a percent of entry — read ONLY
 * during a surge.
 */
export function resolveLadderPercents(input: {
  dynamicSlPct?: number;
  buyingSurge?: boolean;
}): LadderPercents {
  if (!input.buyingSurge) {
    return { slPct: FIXED_SL_PCT, tp1Pct: FIXED_TP1_PCT, tp2Pct: FIXED_TP2_PCT, surged: false };
  }
  const dyn = typeof input.dynamicSlPct === 'number' && Number.isFinite(input.dynamicSlPct)
    ? input.dynamicSlPct
    : FIXED_SL_PCT;
  const slPct = Math.min(SURGE_MAX_SL_PCT, Math.max(SURGE_MIN_SL_PCT, dyn));
  return {
    slPct,
    tp1Pct: FIXED_TP1_PCT,
    tp2Pct: Math.max(FIXED_TP2_PCT, slPct * TP2_MIN_REWARD_RISK),
    surged: true
  };
}
