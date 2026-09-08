// Order generation, sizing, scale-in and exit management for the TrendBreakout
// bot. Shares the fill/fee/slippage core (fillDueOrders), the entry/streak
// cooldowns and the drawdown / exposure constants with the other three sim
// bots — so a difference in results is a difference in DECISIONS, not in
// plumbing. What is genuinely its own:
//
//   · sizing: the shared 10% target, measured against the bot's STARTING
//     capital (POSITION_TARGET_PCT × initialAmount, see resolveSizingBase). The stop
//     loss only MEASURES the resulting dollar risk — it never sets the size.
//     Hard-capped by the shared per-asset (PER_ASSET_EXPOSURE_CAP_PERCENT = 10%)
//     and total (MAX_TOTAL_EXPOSURE_PERCENT = 80%) limits (spec §15).
//     (This header used to describe risk-based sizing — (equity × riskPerTrade)
//     / |entry − SL| — and 8%/20% caps. All three numbers were stale.)
//   · scale-in (spec §11): the shared fill core cannot add to a position, so
//     each of the 50/30/20 % lots is its OWN SimPosition. One logical trade =
//     every lot with the same base asset + side. Lots share one logical
//     SL/TP and are closed together. At small equity the lots are merged so
//     none falls under the $100 order floor — see resolveScaleFractions.
//   · stop management (spec §12): break-even at +1R, ATR trailing from +1.5R,
//     recomputed every tick from the immutable entry + the factory-tracked
//     highest/lowest price (the codebase never mutates pos.stopLoss).
//   · exits (spec §13): effective stop — CLOSE-CONFIRMED on the last closed
//     M15 candle (a wick through the stop does not close the trade; the
//     shared 4.2% cap is the one intrabar emergency exit), TP ladder, H1
//     Supertrend reversal, 24×H1 time stop.

import { Candle, calculateATR, calculateSupertrend } from './tradeEngine';
import type { SignalEvaluation } from './intradayBridge';
import type { SimPosition, PendingOrder } from './simExecution';
import {
  isInEntryCooldown,
  MIN_SIM_ENTRY_USD,
  MIN_ORDER_EXCEEDS_POSITION_TARGET,
  blockEntry as blockEntryShared
} from './simExecution';
import {
  reachedStop,
  reachedTarget,
  positionPnlPercent,
  capStopLoss,
  maxLossStopLevel,
  TP1_EXIT_FRACTION,
  MAX_LOSS_PERCENT
} from './exitPolicy';
import {
  isInStreakCooldown,
  streakCooldownFromHistory,
  ClosedTradeRecord
} from './adaptiveRisk';
import {
  DAILY_DRAWDOWN_BLOCK_PERCENT,
  WEEKLY_DRAWDOWN_LOCK_PERCENT,
  PER_ASSET_EXPOSURE_CAP_PERCENT,
  MAX_TOTAL_EXPOSURE_PERCENT,
  CAPITAL_FLOOR_PCT,
  resolveSizingBase,
  isBelowCapitalFloor
} from './intradayParams';
import {
  DEFAULT_TREND_BREAKOUT_PARAMS,
  TrendBreakoutParams,
  readTrendBreakoutPlan
} from './trendBreakout';

export const uid = (p: string) => `tb-${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const H4_MS = 4 * 60 * 60 * 1000;

// Now defined once in simExecution.ts alongside MIN_SIM_ENTRY_USD, since all
// four bots raise it. Re-exported so existing importers keep working.
export { MIN_ORDER_EXCEEDS_POSITION_TARGET };

/**
 * The scale-in shape this equity can actually express, given that NO LOT MAY
 * BE SMALLER THAN `minLotUsd`.
 *
 * This bot is the only one of the four with scale-in, and that made it the only
 * one that could never trade at small equity: the first lot is 50% of the 10%
 * target, so at $1,000 equity it asked for $50 against a $100 floor and every
 * signal — including a 93%-confidence one — was dropped by a silent `continue`.
 * The other three bots size a single $100 lot and were unaffected, which is why
 * only this bot sat at zero positions.
 *
 * MIN_ORDER stays a CONSTRAINT, not a sizing input: the 10% target is never
 * inflated to clear the floor. What adapts is how the target is SPLIT — the
 * fractions are merged forward until each surviving lot clears the floor, so
 * the returned fractions always sum to exactly 1 (the full target, never more).
 *
 *   target $2,000 → [0.5, 0.3, 0.2]  (unchanged: 1000/600/400 all clear $100)
 *   target   $250 → [0.5, 0.5]       (125/125 — the 0.3 lot would be $75)
 *   target   $100 → [1]              (one $100 lot, no scale-in)
 *   target    $80 → []               (below the floor entirely — skip, correctly)
 *
 * Exported for the tests; pure, no side effects.
 */
export function resolveScaleFractions(
  targetNotional: number,
  fractions: number[],
  minLotUsd: number = MIN_SIM_ENTRY_USD
): number[] {
  if (!(targetNotional >= minLotUsd)) return [];
  const out: number[] = [];
  let carry = 0;
  for (const f of fractions) {
    if (!(f > 0)) continue;
    carry += f;
    if (targetNotional * carry >= minLotUsd) {
      out.push(carry);
      carry = 0;
    }
  }
  // Trailing crumbs too small to stand alone join the last lot rather than
  // being dropped — otherwise the lots would sum to less than the target.
  if (carry > 0) {
    if (out.length > 0) out[out.length - 1] += carry;
    else out.push(carry);
  }
  return out;
}

export interface TrendBreakoutCandleSet {
  h1: Candle[];
  m15: Candle[];
  m5: Candle[];
}

export interface TrendBreakoutOrderGenContext {
  positions: SimPosition[];
  pending: PendingOrder[];
  evaluations: SignalEvaluation[];
  executionDelaySec: number;
  dailyDrawdownPercent: number;
  weeklyDrawdownPercent: number;
  cash: number;
  equity: number;
  /** The bot's STARTING capital. Position size and every percent-of-capital cap
   *  are pinned to THIS, not to live equity, so a drawdown reduces how many
   *  positions fit rather than shrinking each one. Absent → size against equity
   *  (previous behaviour). See resolveSizingBase. */
  initialAmount?: number;
  /** FUTURES notional already open (from the engine factory). */
  totalLeveragedExposureUsd: number;
  exitCooldown: Record<string, number>;
  priceFor: (symbol: string) => number | undefined;
  /** Keyed by BASE asset — same keys the evaluations and positions use. */
  candlesBySymbol: Record<string, TrendBreakoutCandleSet | undefined>;
  closedTradeMetrics?: ClosedTradeRecord[];
  /** Max concurrent LOGICAL trades (base+side groups), not lots. */
  maxConcurrentTrades: number;
  /** SimBotConfig.proLimitEntries. true → every lot (fresh + scale-in) rests as
   *  a LIMIT at the signal price (fills on a pullback back to it, else expires);
   *  false → delayed MARKET fill with adverse slippage (the default — a
   *  breakout normally wants the fill now). */
  limitEntries?: boolean;
  params?: Partial<TrendBreakoutParams>;
}

interface LogicalTrade {
  base: string;
  side: 'LONG' | 'SHORT';
  lots: SimPosition[];
}

const ENTRY_SIDES = new Set(['buy', 'sell', 'long', 'short']);

function groupLogicalTrades(positions: SimPosition[]): LogicalTrade[] {
  const map = new Map<string, LogicalTrade>();
  for (const pos of positions) {
    const side: 'LONG' | 'SHORT' = pos.side === 'SHORT' || pos.side === 'SELL' ? 'SHORT' : 'LONG';
    const key = `${pos.symbol}|${side}`;
    let lt = map.get(key);
    if (!lt) {
      lt = { base: pos.symbol, side, lots: [] };
      map.set(key, lt);
    }
    lt.lots.push(pos);
  }
  // Oldest lot first — it anchors the logical entry / R.
  for (const lt of map.values()) lt.lots.sort((a, b) => a.openTimestamp - b.openTimestamp);
  return [...map.values()];
}

function positionNotional(pos: SimPosition, priceFor: (s: string) => number | undefined): number {
  const live = priceFor(pos.symbol) ?? pos.currentPrice ?? pos.entryPrice;
  // quantity already carries leverage for FUTURES (=1 here), so notional is
  // quantity × price for both position types.
  return pos.quantity * live;
}

function currentH1Supertrend(
  set: TrendBreakoutCandleSet | undefined,
  p: TrendBreakoutParams
): 'BULL' | 'BEAR' | undefined {
  if (!set || !set.h1 || set.h1.length < p.supertrendAtrPeriod + 2) return undefined;
  return calculateSupertrend(set.h1, p.supertrendAtrPeriod, p.supertrendMultiplier).direction;
}

function currentAtrM15(set: TrendBreakoutCandleSet | undefined, p: TrendBreakoutParams): number | undefined {
  if (!set || !set.m15 || set.m15.length < p.atrPeriod + 1) return undefined;
  return calculateATR(set.m15, p.atrPeriod).atr;
}

/**
 * Effective stop for a logical trade this tick — break-even at +breakEvenR,
 * ATR trailing from +trailingStartR, never looser than the entry stop.
 */
export function effectiveStop(
  lt: LogicalTrade,
  livePrice: number,
  atrM15Now: number | undefined,
  p: TrendBreakoutParams
): { stop: number; progressR: number } {
  const first = lt.lots[0];
  const isLong = lt.side === 'LONG';
  const entry0 = first.entryPrice;
  const stop0 = first.stopLoss;
  const rUnit = Math.abs(entry0 - stop0) || (Math.abs(entry0) * 0.005);

  const extreme = isLong
    ? Math.max(...lt.lots.map((l) => l.highestPrice ?? l.entryPrice), livePrice)
    : Math.min(...lt.lots.map((l) => l.lowestPrice ?? l.entryPrice), livePrice);
  const progressR = ((extreme - entry0) * (isLong ? 1 : -1)) / rUnit;

  let stop = stop0;
  if (progressR >= p.breakEvenR) {
    stop = isLong ? Math.max(stop, entry0) : Math.min(stop, entry0);
  }
  if (progressR >= p.trailingStartR && atrM15Now && atrM15Now > 0) {
    const trail = isLong
      ? extreme - p.trailingAtrMultiplier * atrM15Now
      : extreme + p.trailingAtrMultiplier * atrM15Now;
    stop = isLong ? Math.max(stop, trail) : Math.min(stop, trail);
  }
  // Never loosen past the original protective stop.
  stop = isLong ? Math.max(stop, stop0) : Math.min(stop, stop0);
  // Apply the shared 4.2% loss cap — tightens stop if needed, never loosens.
  // The signal computed structuralStop from slAtrMultiplier×ATR; trailing may
  // have loosened it, but the policy ceiling applies to all exits (operator
  // decision 2026-09-08).
  stop = capStopLoss(entry0, stop, isLong);
  return { stop, progressR };
}

export function generateTrendBreakoutOrders(ctx: TrendBreakoutOrderGenContext): PendingOrder[] {
  const p: TrendBreakoutParams = { ...DEFAULT_TREND_BREAKOUT_PARAMS, ...(ctx.params ?? {}) };
  const now = Date.now();
  const delayMs = Math.max(0, ctx.executionDelaySec) * 1000;
  const newOrders: PendingOrder[] = [];

  const trades = groupLogicalTrades(ctx.positions);
  const claimedPositionIds = new Set(
    ctx.pending.filter((o) => o.positionId).map((o) => o.positionId as string)
  );

  const blockEntry = (ev: SignalEvaluation, code: string, message: string) =>
    blockEntryShared(ev, code, message, '[bybit-sim]');

  // ── Exits (spec §13) — per logical trade; closes every lot together ──────
  const closingBaseSides = new Set<string>();
  for (const lt of trades) {
    if (lt.lots.every((l) => claimedPositionIds.has(l.id))) continue;
    const set = ctx.candlesBySymbol[lt.base];
    const live = ctx.priceFor(lt.base) ?? lt.lots[0].currentPrice ?? lt.lots[0].entryPrice;
    const isLong = lt.side === 'LONG';
    const first = lt.lots[0];
    const tp = first.takeProfit ?? first.takeProfit1;
    const atrM15Now = currentAtrM15(set, p);
    const { stop, progressR } = effectiveStop(lt, live, atrM15Now, p);

    // Stop exits are CLOSE-CONFIRMED on the last CLOSED M15 candle (operator
    // decision 2026-09-08): a wick through the stop no longer closes the trade
    // — the M15 close must sit beyond it. The forming bar is excluded upstream
    // (trendBreakout.ts header), so this close is final. The one intrabar
    // exception is the shared 4.2% hard cap below — the documented "never lose
    // more than MAX_LOSS_PERCENT" emergency brake, which still fires on touch.
    // Defensive fallback: with no M15 series the stop reverts to touch behaviour.
    const closedM15 = set?.m15?.[set.m15.length - 1];
    const confirmClose = closedM15?.close ?? live;
    const capLevel = maxLossStopLevel(first.entryPrice, isLong);

    const pnlPct = positionPnlPercent(first.entryPrice, live, isLong);
    const tp2 = first.takeProfit2;
    const tp2Reached = tp2 !== undefined && reachedTarget(live, tp2, isLong);

    // TP1 closes half of EVERY lot in the logical trade and lets the rest run
    // to TP2 (operator decision 2026-09-08). Checked before the full-exit
    // branches, and skipped once price is already past TP2 — that is a full
    // exit, not a partial. `tp1Hit` is tracked per lot by the fill core.
    const tp1 = first.takeProfit1;
    const unhitLots = lt.lots.filter((l) => !l.tp1Hit && !claimedPositionIds.has(l.id));
    if (tp1 && !tp2Reached && reachedTarget(live, tp1, isLong) && unhitLots.length > 0) {
      closingBaseSides.add(`${lt.base}|${lt.side}`);
      for (const lot of unhitLots) {
        newOrders.push({
          id: uid(`${lt.base}-tp1`),
          symbol: lt.base,
          positionId: lot.id,
          type: lot.type,
          side: 'partial_tp1',
          signalPrice: live,
          quantity: lot.quantity * TP1_EXIT_FRACTION,
          reason: `TP1 הושג ב-${tp1.toFixed(6)} (+${pnlPct.toFixed(2)}%) — סגירת ${(TP1_EXIT_FRACTION * 100).toFixed(0)}%`,
          confidence: lot.confidence,
          executeAt: now + delayMs,
          createdAt: now
        });
      }
      continue;
    }

    let reason = '';
    if (reachedStop(live, capLevel, isLong)) {
      reason = `חריגת תקרת הפסד ${MAX_LOSS_PERCENT}% בתוך נר — יציאת חירום (${pnlPct.toFixed(2)}%)`;
    } else if (reachedStop(confirmClose, stop, isLong)) {
      // "תקרה" only when the cap is what actually binds the stop (capStopLoss
      // pulled the ATR stop in) — a normal ATR stop is labelled as such.
      const atCap = Math.abs(stop - capLevel) <= Math.abs(capLevel) * 1e-9 + 1e-12;
      const stopTag = atCap ? `תקרה ${MAX_LOSS_PERCENT}%` : 'סטופ ATR';
      reason = progressR >= p.breakEvenR
        ? `Trailing/BE stop ב-${stop.toFixed(6)} (${progressR.toFixed(2)}R, סגירת נר M15)`
        : `Stop Loss ב-${stop.toFixed(6)} (${pnlPct.toFixed(2)}%, ${stopTag}, סגירת נר M15)`;
    } else if (tp2Reached) {
      reason = `TP2 הושג ב-${(tp2 as number).toFixed(6)} (+${pnlPct.toFixed(2)}%)`;
    } else if (tp && !first.tp1Hit && reachedTarget(live, tp, isLong)) {
      reason = `Take Profit ב-${tp.toFixed(6)} (+${pnlPct.toFixed(2)}%)`;
    } else {
      const stNow = currentH1Supertrend(set, p);
      if (stNow && (isLong ? stNow === 'BEAR' : stNow === 'BULL')) {
        reason = `היפוך מגמה — H1 Supertrend התהפך ל-${stNow}`;
      } else if (now - first.openTimestamp >= p.maxHoldHours * 60 * 60 * 1000) {
        reason = `Time Stop — ${p.maxHoldHours} נרות H1 (${progressR.toFixed(2)}R)`;
      }
    }

    if (!reason) continue;
    closingBaseSides.add(`${lt.base}|${lt.side}`);
    for (const lot of lt.lots) {
      if (claimedPositionIds.has(lot.id)) continue;
      newOrders.push({
        id: uid(`${lt.base}-exit`),
        symbol: lt.base,
        positionId: lot.id,
        type: lot.type,
        side: isLong ? 'close_long' : 'close_short',
        signalPrice: live,
        quantity: lot.quantity,
        reason,
        confidence: lot.confidence,
        executeAt: now + delayMs,
        createdAt: now
      });
    }
  }

  // ── Circuit breaker (spec §16) — exits only past this point ─────────────
  if (
    ctx.dailyDrawdownPercent >= DAILY_DRAWDOWN_BLOCK_PERCENT ||
    ctx.weeklyDrawdownPercent >= WEEKLY_DRAWDOWN_LOCK_PERCENT
  ) {
    return newOrders;
  }

  // Running exposure / cash / count as this batch adds orders.
  let workingCash = ctx.cash;
  // Sizing and every percent-of-capital cap read the STARTING capital, so a
  // drawdown reduces how many positions fit (cash is still a hard limit) and
  // never how big each one is. See resolveSizingBase.
  const sizingBase = resolveSizingBase(ctx.initialAmount, ctx.equity);
  const perAssetCap = sizingBase * (PER_ASSET_EXPOSURE_CAP_PERCENT / 100);
  const totalCap = sizingBase * (MAX_TOTAL_EXPOSURE_PERCENT / 100);

  const exposureByBase = new Map<string, number>();
  let totalExposure = 0;
  for (const pos of ctx.positions) {
    const n = positionNotional(pos, ctx.priceFor);
    exposureByBase.set(pos.symbol, (exposureByBase.get(pos.symbol) ?? 0) + n);
    totalExposure += n;
  }
  for (const o of ctx.pending) {
    if (!ENTRY_SIDES.has(o.side)) continue;
    const n = o.budgetUsd ?? 0;
    exposureByBase.set(o.symbol, (exposureByBase.get(o.symbol) ?? 0) + n);
    totalExposure += n;
  }

  const tradeKey = (base: string, side: 'LONG' | 'SHORT') => `${base}|${side}`;
  const openLogicalKeys = new Set(trades.map((lt) => tradeKey(lt.base, lt.side)));
  const pendingEntryKeys = new Set(
    ctx.pending
      .filter((o) => ENTRY_SIDES.has(o.side))
      .map((o) => tradeKey(o.symbol, o.side === 'sell' || o.side === 'short' ? 'SHORT' : 'LONG'))
  );
  let logicalTradeCount = openLogicalKeys.size + pendingEntryKeys.size;

  /** Places one entry lot, respecting cash + both exposure caps. Returns the
    *  notional actually committed (0 if nothing could be placed). */
  const placeLot = (opts: {
    base: string;
    side: 'LONG' | 'SHORT';
    desiredNotional: number;
    price: number;
    stopLoss: number;
    takeProfit: number;
    takeProfit1: number;
    takeProfit2: number;
    confidence: number;
    reason: string;
    scaleLabel: string;
    onBlocked?: (code: string, message: string) => void;
  }): number => {
    const isLong = opts.side === 'LONG';
    const assetUsed = exposureByBase.get(opts.base) ?? 0;
    const assetHeadroom = Math.max(0, perAssetCap - assetUsed);
    const totalHeadroom = Math.max(0, totalCap - totalExposure);
    const notional = Math.min(opts.desiredNotional, assetHeadroom, totalHeadroom, workingCash);

    // MIN_ORDER is a constraint, not a sizing input. Skip when target < floor.
    // Name the constraint that actually bound: "blocked" with no cause is the
    // state this bot sat in for a whole run.
    if (notional < MIN_SIM_ENTRY_USD) {
      const binding =
        assetHeadroom <= totalHeadroom && assetHeadroom <= workingCash && assetHeadroom < opts.desiredNotional
          ? `תקרת חשיפה לנכס (${PER_ASSET_EXPOSURE_CAP_PERCENT}%) — נותרו $${assetHeadroom.toFixed(2)}`
          : totalHeadroom <= workingCash && totalHeadroom < opts.desiredNotional
            ? `תקרת חשיפה כוללת (${MAX_TOTAL_EXPOSURE_PERCENT}%) — נותרו $${totalHeadroom.toFixed(2)}`
            : workingCash < opts.desiredNotional
              ? `מזומן פנוי $${workingCash.toFixed(2)}`
              : `גודל הלוט המבוקש $${opts.desiredNotional.toFixed(2)}`;
      opts.onBlocked?.(
        MIN_ORDER_EXCEEDS_POSITION_TARGET,
        `${binding} < מינימום הזמנה $${MIN_SIM_ENTRY_USD}`
      );
      return 0;
    }

    exposureByBase.set(opts.base, assetUsed + notional);
    totalExposure += notional;
    workingCash -= notional;

    newOrders.push({
      id: uid(`${opts.base}-${isLong ? 'buy' : 'short'}`),
      symbol: opts.base,
      type: isLong ? 'SPOT' : 'FUTURES',
      side: isLong ? 'buy' : 'short',
      signalPrice: opts.price,
      quantity: notional / opts.price,
      budgetUsd: notional,
      leverage: 1,
      fill: ctx.limitEntries ? 'limit' : 'market',
      stopLoss: opts.stopLoss,
      takeProfit: opts.takeProfit,
      takeProfit1: opts.takeProfit1,
      takeProfit2: opts.takeProfit2,
      reason: `TrendBreakout ${opts.side} ${opts.scaleLabel} · ${opts.reason}`,
      confidence: opts.confidence,
      executeAt: now + delayMs,
      createdAt: now
    });
    return notional;
  };

  // ── Scale-in for existing logical trades (spec §11) ────────────────────
  for (const lt of trades) {
    const key = tradeKey(lt.base, lt.side);
    if (closingBaseSides.has(key)) continue;
    if (pendingEntryKeys.has(key)) continue; // a lot is already queued
    const lotCount = lt.lots.length;
    // The shape this equity can express (no lot below the $100 floor), not the
    // nominal 5/3/2 — at small equity the whole target is one lot and there is
    // nothing left to scale into.
    const targetNotional = sizingBase * p.positionTargetPct;
    const scaleFractions = resolveScaleFractions(targetNotional, p.scaleFractions);
    if (lotCount >= scaleFractions.length) continue;

    const set = ctx.candlesBySymbol[lt.base];
    const stNow = currentH1Supertrend(set, p);
    const isLong = lt.side === 'LONG';
    if (stNow && (isLong ? stNow !== 'BULL' : stNow !== 'BEAR')) continue;

    const live = ctx.priceFor(lt.base) ?? lt.lots[0].currentPrice ?? lt.lots[0].entryPrice;
    const first = lt.lots[0];
    const rUnit = Math.abs(first.entryPrice - first.stopLoss) || Math.abs(first.entryPrice) * 0.005;
    const progressR = ((live - first.entryPrice) * (isLong ? 1 : -1)) / rUnit;
    if (progressR <= 0) continue; // never average down (no martingale)

    const nextScaleMinR = lotCount === 1 ? p.scale2MinR : p.scale3MinR;
    if (progressR < nextScaleMinR) continue;

    const fraction = scaleFractions[lotCount] ?? 0;
    if (!(fraction > 0)) continue;

    // Position sizing: target notional = 10% of equity, independent of SL.
    // Scale-in lots are fractions of that target notional. The total logical
    // trade never exceeds 10% equity: 5% + 3% + 2% = 10%.
    //
    // The headroom cap is what actually enforces that ceiling, and it holds
    // even when the entry collapsed the scale plan into a single full-size lot
    // (small equity) or when equity has grown since the entry: what is already
    // committed to this logical trade can never be topped up past the target.
    const committed = lt.lots.reduce(
      (sum, l) => sum + (l.avgPrice || l.entryPrice) * l.quantity,
      0
    );
    const headroom = Math.max(0, targetNotional - committed);
    const desiredNotional = Math.min(targetNotional * fraction, headroom);

    if (!(desiredNotional > 0)) continue;

    placeLot({
      base: lt.base,
      side: lt.side,
      desiredNotional,
      price: live,
      stopLoss: first.stopLoss,
      // A scale-in lot joins an existing logical trade, so it inherits that
      // trade's ladder rather than deriving a new one from its own fill.
      takeProfit: first.takeProfit ?? first.takeProfit1 ?? live,
      takeProfit1: first.takeProfit1 ?? first.takeProfit ?? live,
      takeProfit2: first.takeProfit2 ?? first.takeProfit1 ?? live,
      confidence: first.confidence,
      reason: `scale ${lotCount + 1}/${p.scaleFractions.length} ב-${progressR.toFixed(2)}R`,
      scaleLabel: `scale ${lotCount + 1}/${p.scaleFractions.length}`
    });
  }

  // ── Fresh entries (SCALE_1) from SIGNAL evaluations ────────────────────
  const ranked = [...ctx.evaluations]
    .filter((ev) => ev.willExecute && ev.price)
    .sort((a, b) => b.confidence - a.confidence);

  const belowFloor = isBelowCapitalFloor(ctx.initialAmount, ctx.equity);

  for (const ev of ranked) {
    if (belowFloor) {
      blockEntry(
        ev,
        'CAPITAL_FLOOR',
        `הון $${ctx.equity.toFixed(2)} מתחת ל-${(CAPITAL_FLOOR_PCT * 100).toFixed(0)}% מההון ההתחלתי $${(ctx.initialAmount ?? 0).toFixed(2)} — כניסות חדשות מושהות`
      );
      continue;
    }
    const plan = readTrendBreakoutPlan(ev);
    if (!plan) {
      blockEntry(ev, 'NO_PLAN', 'הערכה ללא תוכנית TrendBreakout (SL/TP חסרים)');
      continue;
    }
    const side = plan.direction;
    const key = tradeKey(ev.symbol, side);
    if (openLogicalKeys.has(key) || pendingEntryKeys.has(key)) continue; // one logical trade per base+side; blocks double-entry on the same breakout
    if (closingBaseSides.has(key)) continue;
    if (isInEntryCooldown(ctx.exitCooldown[ev.symbol], now)) {
      blockEntry(ev, 'ENTRY_COOLDOWN', 'צינון אחרי יציאה קודמת בנכס הזה');
      continue;
    }
    if (isInStreakCooldown(streakCooldownFromHistory(ctx.closedTradeMetrics ?? [], ctx.equity, ev.symbol))) {
      blockEntry(ev, 'STREAK_COOLDOWN', 'צינון אחרי רצף הפסדים');
      continue;
    }
    if (logicalTradeCount >= ctx.maxConcurrentTrades) {
      blockEntry(ev, 'MAX_CONCURRENT', `${logicalTradeCount}/${ctx.maxConcurrentTrades} עסקאות פתוחות — אין מקום`);
      continue;
    }

    // LIMIT mode rests at the plan's own discounted level; MARKET mode fires at
    // the live price. Sizing is off whichever price the order actually uses.
    const price = (ctx.limitEntries ? plan.limitEntryPrice : plan.entryRef) || ev.price;

    // Position sizing: 10% of equity, independent of stop-loss distance.
    // SL is used only to measure the resulting dollar risk.
    //
    // The first lot is the first fraction the CURRENT equity can express with
    // no lot under the $100 floor — [0.5,0.3,0.2] at $2,000+ target, a single
    // [1] lot at a $100 target. Sizing the first lot at a flat 0.5 made this
    // bot unable to open anything at all below $2,000 equity, silently.
    const targetNotional = sizingBase * p.positionTargetPct;
    const scaleFractions = resolveScaleFractions(targetNotional, p.scaleFractions);

    if (scaleFractions.length === 0) {
      blockEntry(
        ev,
        MIN_ORDER_EXCEEDS_POSITION_TARGET,
        `יעד הפוזיציה $${targetNotional.toFixed(2)} (${(p.positionTargetPct * 100).toFixed(0)}% מההון) < מינימום הזמנה $${MIN_SIM_ENTRY_USD}`
      );
      continue;
    }

    const desiredNotional = targetNotional * scaleFractions[0];

    const committed = placeLot({
      base: ev.symbol,
      side,
      desiredNotional,
      price,
      stopLoss: plan.stopLoss,
      takeProfit: plan.takeProfit,
      takeProfit1: plan.takeProfit1,
      takeProfit2: plan.takeProfit2,
      confidence: ev.confidence,
      reason: `כניסה ראשונית · SL ${plan.stopLoss.toFixed(6)} TP ${plan.takeProfit.toFixed(6)}`,
      scaleLabel: `scale 1/${scaleFractions.length}`,
      onBlocked: (code, message) => blockEntry(ev, code, message)
    });
    if (committed > 0) {
      logicalTradeCount++;
      openLogicalKeys.add(key);
      pendingEntryKeys.add(key);
    }
  }

  return newOrders;
}
