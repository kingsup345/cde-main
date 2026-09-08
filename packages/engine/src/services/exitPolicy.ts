// Exit policy shared by all four simulation bots.
// ============================================================================
// Operator decision (2026-09-08): every bot obeys the same three numbers —
//
//   · a position may never lose more than MAX_LOSS_PERCENT (4.2%),
//   · TP1 at TP1_PERCENT (3%) closes TP1_EXIT_FRACTION (half) of it,
//   · the remainder runs to TP2_PERCENT (4.5%).
//
// The stop is a CAP, not a replacement. Each bot keeps the stop its own
// strategy computes — Path's range midpoint, Bybit's ATR multiple, intraday's
// fixed 1.8% — and this module only pulls it in when it would have risked more
// than 4.2%. That distinction is the point: the four bots exist to be compared,
// and a shared stop level would erase three of the four differences that make
// the comparison mean anything. What is shared is the ceiling on damage.
//
// Every function here takes `isLong` explicitly and is symmetric under it.
// That is not decoration: `evaluateProExit` computed
// `(current - entry) / entry`, which is the LONG formula, and Path and Bybit
// both open SHORTs as 1x futures. On a short that expression has the wrong
// sign, so a profitable short reads as a loss and trips the stop.

/** Hard ceiling on the loss a single position may carry, in percent of entry. */
export const MAX_LOSS_PERCENT = 4.2;
/** First target. Closes TP1_EXIT_FRACTION of the position. */
export const TP1_PERCENT = 3.0;
/** Second target for whatever TP1 left running. */
export const TP2_PERCENT = 4.5;
/** Share of the position closed at TP1. */
export const TP1_EXIT_FRACTION = 0.5;

/**
 * Profit/loss of an open position, in percent of entry — positive means the
 * trade is winning, for BOTH directions.
 *
 *   LONG :  (price - entry) / entry
 *   SHORT:  (entry - price) / entry
 */
export function positionPnlPercent(entryPrice: number, price: number, isLong: boolean): number {
  if (!(entryPrice > 0)) return 0;
  const raw = (price - entryPrice) / entryPrice;
  return (isLong ? raw : -raw) * 100;
}

/**
 * The furthest the stop may sit from entry: entry × (1 ∓ MAX_LOSS_PERCENT).
 * Below it for a long, above it for a short.
 */
export function maxLossStopLevel(
  entryPrice: number,
  isLong: boolean,
  maxLossPercent: number = MAX_LOSS_PERCENT
): number {
  const factor = maxLossPercent / 100;
  return isLong ? entryPrice * (1 - factor) : entryPrice * (1 + factor);
}

/**
 * A strategy's own stop, pulled in when it would have risked more than the cap.
 * A TIGHTER structural stop is always kept as-is — the cap only ever reduces
 * risk, it never loosens a stop the strategy wanted closer.
 *
 *   LONG : stop below the cap level → raise it to the cap level
 *   SHORT: stop above the cap level → lower it to the cap level
 */
export function capStopLoss(
  entryPrice: number,
  structuralStop: number,
  isLong: boolean,
  maxLossPercent: number = MAX_LOSS_PERCENT
): number {
  const capLevel = maxLossStopLevel(entryPrice, isLong, maxLossPercent);
  const capped = isLong ? Math.max(structuralStop, capLevel) : Math.min(structuralStop, capLevel);
  // A stop must stay a positive price even for sub-cent assets.
  return Math.max(capped, 1e-8);
}

/** True when the strategy's own stop was looser than the cap and got pulled in. */
export function stopWasCapped(
  entryPrice: number,
  structuralStop: number,
  isLong: boolean,
  maxLossPercent: number = MAX_LOSS_PERCENT
): boolean {
  const capLevel = maxLossStopLevel(entryPrice, isLong, maxLossPercent);
  return isLong ? structuralStop < capLevel : structuralStop > capLevel;
}

/** TP1 / TP2 as absolute price levels, correct for both directions. */
export function takeProfitLevels(
  entryPrice: number,
  isLong: boolean,
  tp1Percent: number = TP1_PERCENT,
  tp2Percent: number = TP2_PERCENT
): { takeProfit1: number; takeProfit2: number } {
  const s = isLong ? 1 : -1;
  return {
    takeProfit1: Math.max(entryPrice * (1 + s * tp1Percent / 100), 1e-8),
    takeProfit2: Math.max(entryPrice * (1 + s * tp2Percent / 100), 1e-8)
  };
}

/**
 * TP ladder for a bot that computes its OWN target, with the shared percentages
 * acting as a CEILING rather than a replacement — the mirror image of how
 * `capStopLoss` treats the stop.
 *
 * Path's target is `H + range`, and its stop is the range midpoint: half the
 * range. That pairing is what makes its reward:risk a constant 2.0 at every
 * range width. Overwriting the target with a flat 3% while leaving the stop
 * range-derived breaks the pairing in both directions —
 *
 *   range 0.5% → stop 0.25%, flat target 3%  → RR 12, price must travel 12x
 *                the stop inside a 4H window: effectively unreachable
 *   range 8%   → stop 4%,    flat target 3%  → RR 0.75, target nearer than stop
 *
 * Capping instead of replacing keeps RR 2.0 wherever the strategy's own target
 * is the closer one, and pulls it in to 3% when the structure asked for more.
 *
 * TP2 scales the structural distance by the same TP2/TP1 ratio, so a bot whose
 * target sits under the cap still gets a genuine runner rather than a second
 * exit at the first one. The result is always TP2 >= TP1.
 */
export function cappedTakeProfitLevels(
  entryPrice: number,
  isLong: boolean,
  structuralTakeProfit: number,
  tp1Percent: number = TP1_PERCENT,
  tp2Percent: number = TP2_PERCENT
): { takeProfit1: number; takeProfit2: number } {
  const structuralDistance = Math.abs(structuralTakeProfit - entryPrice);
  const tp1Distance = Math.min(structuralDistance, entryPrice * tp1Percent / 100);
  const tp2Distance = Math.min(
    structuralDistance * (tp2Percent / tp1Percent),
    entryPrice * tp2Percent / 100
  );
  const s = isLong ? 1 : -1;
  return {
    takeProfit1: Math.max(entryPrice + s * tp1Distance, 1e-8),
    takeProfit2: Math.max(entryPrice + s * tp2Distance, 1e-8)
  };
}

/** Has `price` reached `level` in the direction that profits this position? */
export function reachedTarget(price: number, level: number, isLong: boolean): boolean {
  return isLong ? price >= level : price <= level;
}

/** Has `price` reached `stop` in the direction that hurts this position? */
export function reachedStop(price: number, stop: number, isLong: boolean): boolean {
  return isLong ? price <= stop : price >= stop;
}

/** Normalises the many side spellings the four bots use into one boolean. */
export function isLongSide(side: string): boolean {
  return side === 'LONG' || side === 'BUY' || side === 'buy' || side === 'long';
}
