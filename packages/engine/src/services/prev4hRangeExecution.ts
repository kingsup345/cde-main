// Order generation for the Prev-4H Range bot ("נתיב 4H"). One position per
// symbol, no scale-in. Shares the fill/fee/slippage core (fillDueOrders), the
// entry cooldown and the drawdown / exposure constants with the other three
// sim bots — a difference in results is a difference in DECISIONS.
//
// Its own:
//   · sizing: the shared 10% target, measured against the bot's STARTING
//     capital (positionTargetPct × initialAmount, see resolveSizingBase). The stop
//     loss only MEASURES the resulting dollar risk — it never sets the size.
//     Hard-capped by the shared per-asset (PER_ASSET_EXPOSURE_CAP_PERCENT = 10%)
//     and total (MAX_TOTAL_EXPOSURE_PERCENT = 80%) caps and the $100
//     MIN_SIM_ENTRY_USD floor.
//     (This header used to describe risk-based sizing — (equity × riskPerTrade)
//     / (R / entry) — and 8%/20% caps. All three numbers were stale.)
//   · exits: SL (= range midpoint), TP (= break level ± range × tpRangeMult),
//     END OF THE 4H WINDOW (barOpenFor(openTs) + BAR_MS), and an EMA(20) 4H
//     trend flip against the position.

import { Candle, calculateEMA } from './tradeEngine';
import { aggregateToH4 } from './pathEngine';
import { barOpenFor, BAR_MS } from './pathStudy';
import type { SignalEvaluation } from './intradayBridge';
import type { SimPosition, PendingOrder } from './simExecution';
import {
  isInEntryCooldown,
  MIN_SIM_ENTRY_USD,
  MIN_ORDER_EXCEEDS_POSITION_TARGET,
  blockEntry
} from './simExecution';
import {
  isLongSide,
  reachedStop,
  reachedTarget,
  positionPnlPercent,
  TP1_EXIT_FRACTION,
  MAX_LOSS_PERCENT
} from './exitPolicy';
import {
  DAILY_DRAWDOWN_BLOCK_PERCENT,
  WEEKLY_DRAWDOWN_LOCK_PERCENT,
  PER_ASSET_EXPOSURE_CAP_PERCENT,
  MAX_TOTAL_EXPOSURE_PERCENT,
  CAPITAL_FLOOR_PCT,
  resolveSizingBase,
  isBelowCapitalFloor
} from './intradayParams';
import { DEFAULT_PREV4H_RANGE_PARAMS, Prev4hRangeParams, readPrev4hRangePlan } from './prev4hRange';

export const uid = (p: string) => `p4h-${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/** Total leveraged + spot exposure ceiling, as a percent of equity. Re-exported
 *  from the single definition in intradayParams so all four bots share it. */
export { MAX_TOTAL_EXPOSURE_PERCENT };

export interface Prev4hRangeCandleSet {
  h1: Candle[];
}

export interface Prev4hRangeOrderGenContext {
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
  totalLeveragedExposureUsd: number;
  exitCooldown: Record<string, number>;
  priceFor: (symbol: string) => number | undefined;
  /** Keyed by BASE asset — same keys the evaluations and positions use. */
  candlesBySymbol: Record<string, Prev4hRangeCandleSet | undefined>;
  maxPositions: number;
  /** SHORTs are simulated as 1x FUTURES; this caps how many can be open at
   *  once (SIM_MAX_FUTURES_POSITIONS.path). LONGs are SPOT and unaffected. */
  maxFuturesPositions: number;
  /** SimBotConfig.proLimitEntries. true → the breakout entry rests as a LIMIT
   *  at the signal price (fills on a pullback back to it, else expires); false
   *  → fires as a delayed MARKET order with adverse slippage (the default —
   *  breakout strategies normally want the fill now). */
  limitEntries?: boolean;
  params?: Partial<Prev4hRangeParams>;
}

const ENTRY_SIDES = new Set(['buy', 'sell', 'long', 'short']);

function h4EmaTrend(h1: Candle[] | undefined, emaPeriod: number): 'UP' | 'DOWN' | 'FLAT' | undefined {
  if (!h1 || h1.length < emaPeriod * 4) return undefined;
  const h4 = aggregateToH4(h1);
  if (h4.length < emaPeriod + 2) return undefined;
  const ema = calculateEMA(h4.map((c) => c.close), emaPeriod);
  const last = ema[ema.length - 1];
  const prev = ema[ema.length - 2];
  const close = h4[h4.length - 1].close;
  if (last > prev && close > last) return 'UP';
  if (last < prev && close < last) return 'DOWN';
  return 'FLAT';
}

export function generatePrev4hRangeOrders(ctx: Prev4hRangeOrderGenContext): PendingOrder[] {
  const p: Prev4hRangeParams = { ...DEFAULT_PREV4H_RANGE_PARAMS, ...(ctx.params ?? {}) };
  const now = Date.now();
  const delayMs = Math.max(0, ctx.executionDelaySec) * 1000;
  const newOrders: PendingOrder[] = [];
  const claimed = new Set(ctx.pending.filter((o) => o.positionId).map((o) => o.positionId as string));

  // ── Exits ──────────────────────────────────────────────────────────────
  const closingSymbols = new Set<string>();
  for (const pos of ctx.positions) {
    if (claimed.has(pos.id)) continue;
    const live = ctx.priceFor(pos.symbol) ?? pos.currentPrice ?? pos.entryPrice;
    // One helper for the side, and every comparison below goes through the
    // direction-aware predicates. This bot opens SHORTs as 1x futures, and a
    // hand-written `live >= stop` is exactly where that gets inverted.
    const isLong = isLongSide(pos.side);
    const pnlPct = positionPnlPercent(pos.entryPrice, live, isLong);
    let reason = '';

    // TP1 closes half and lets the rest run to TP2 (operator decision
    // 2026-09-08). Checked before the full-exit branches so a position that
    // reaches TP1 takes its partial rather than being closed whole.
    const tp1 = pos.takeProfit1;
    // `?? Infinity` would have inverted this for a SHORT (live <= Infinity is
    // always true) — an absent TP2 means "not reached", never "reached".
    const tp2Reached = pos.takeProfit2 !== undefined && reachedTarget(live, pos.takeProfit2, isLong);
    if (!pos.tp1Hit && tp1 && reachedTarget(live, tp1, isLong) && !tp2Reached) {
      closingSymbols.add(pos.symbol);
      newOrders.push({
        id: uid(`${pos.symbol}-tp1`),
        symbol: pos.symbol,
        positionId: pos.id,
        type: pos.type,
        side: 'partial_tp1',
        signalPrice: live,
        quantity: pos.quantity * TP1_EXIT_FRACTION,
        reason: `TP1 הושג ב-${tp1} (+${pnlPct.toFixed(2)}%) — סגירת ${(TP1_EXIT_FRACTION * 100).toFixed(0)}%`,
        confidence: pos.confidence,
        executeAt: now + delayMs,
        createdAt: now
      });
      continue;
    }

    if (now >= barOpenFor(pos.openTimestamp) + BAR_MS) {
      reason = 'יציאה בסוף נר ה-4H (time stop)';
    } else if (reachedStop(live, pos.stopLoss, isLong)) {
      reason = `Stop Loss ב-${pos.stopLoss} (${pnlPct.toFixed(2)}%, תקרה ${MAX_LOSS_PERCENT}%)`;
    } else if (tp2Reached) {
      reason = `TP2 הושג ב-${pos.takeProfit2} (+${pnlPct.toFixed(2)}%)`;
    } else if (pos.tp1Hit && tp1 && !reachedTarget(live, tp1, isLong)) {
      // The runner gave back TP1 — bank what is left rather than round-trip it.
      reason = `חזרה מתחת ל-TP1 אחרי יציאה חלקית (+${pnlPct.toFixed(2)}%)`;
    } else {
      const trend = h4EmaTrend(ctx.candlesBySymbol[pos.symbol]?.h1, p.emaPeriod);
      // Close only on an outright REVERSAL (trend now points the other way),
      // not on a merely-flat bar — that would churn the position out early.
      if (trend && (isLong ? trend === 'DOWN' : trend === 'UP')) {
        reason = `היפוך מגמה — EMA20 (4H) התהפך ל${isLong ? 'ירידה' : 'עלייה'}`;
      }
    }

    if (!reason) continue;
    closingSymbols.add(pos.symbol);
    newOrders.push({
      id: uid(`${pos.symbol}-exit`),
      symbol: pos.symbol,
      positionId: pos.id,
      type: pos.type,
      side: isLong ? 'close_long' : 'close_short',
      signalPrice: live,
      quantity: pos.quantity,
      reason,
      confidence: pos.confidence,
      executeAt: now + delayMs,
      createdAt: now
    });
  }

  // ── Circuit breaker — exits only past this point ───────────────────────
  if (
    ctx.dailyDrawdownPercent >= DAILY_DRAWDOWN_BLOCK_PERCENT ||
    ctx.weeklyDrawdownPercent >= WEEKLY_DRAWDOWN_LOCK_PERCENT
  ) {
    return newOrders;
  }

  // Running exposure / cash / count.
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
    const n = (ctx.priceFor(pos.symbol) ?? pos.currentPrice ?? pos.entryPrice) * pos.quantity;
    exposureByBase.set(pos.symbol, (exposureByBase.get(pos.symbol) ?? 0) + n);
    totalExposure += n;
  }
  for (const o of ctx.pending) {
    if (!ENTRY_SIDES.has(o.side)) continue;
    exposureByBase.set(o.symbol, (exposureByBase.get(o.symbol) ?? 0) + (o.budgetUsd ?? 0));
    totalExposure += o.budgetUsd ?? 0;
  }

  const openSymbols = new Set(ctx.positions.map((pos) => pos.symbol));
  const pendingEntrySymbols = new Set(ctx.pending.filter((o) => ENTRY_SIDES.has(o.side)).map((o) => o.symbol));
  let positionCount = openSymbols.size + pendingEntrySymbols.size;
  let futuresCount =
    ctx.positions.filter((pos) => pos.type === 'FUTURES').length +
    ctx.pending.filter((o) => o.type === 'FUTURES' && ENTRY_SIDES.has(o.side)).length;

  const ranked = [...ctx.evaluations]
    .filter((ev) => ev.willExecute && ev.price)
    .sort((a, b) => b.confidence - a.confidence);

  const belowFloor = isBelowCapitalFloor(ctx.initialAmount, ctx.equity);

  for (const ev of ranked) {
    if (belowFloor) {
      blockEntry(
        ev,
        'CAPITAL_FLOOR',
        `הון $${ctx.equity.toFixed(2)} מתחת ל-${(CAPITAL_FLOOR_PCT * 100).toFixed(0)}% מההון ההתחלתי $${(ctx.initialAmount ?? 0).toFixed(2)} — כניסות חדשות מושהות`,
        '[path-sim]'
      );
      continue;
    }
    const plan = readPrev4hRangePlan(ev);
    if (!plan) {
      blockEntry(ev, 'NO_PLAN', 'הערכה ללא תוכנית Prev-4H (רמות חסרות)', '[path-sim]');
      continue;
    }
    if (openSymbols.has(ev.symbol) || pendingEntrySymbols.has(ev.symbol) || closingSymbols.has(ev.symbol)) continue;
    if (isInEntryCooldown(ctx.exitCooldown[ev.symbol], now)) {
      blockEntry(ev, 'ENTRY_COOLDOWN', 'צינון אחרי יציאה קודמת בנכס הזה', '[path-sim]');
      continue;
    }
    if (positionCount >= ctx.maxPositions) {
      blockEntry(ev, 'MAX_CONCURRENT', `${positionCount}/${ctx.maxPositions} פוזיציות פתוחות — אין מקום`, '[path-sim]');
      continue;
    }

    const isLong = plan.direction === 'LONG';
    if (!isLong && futuresCount >= ctx.maxFuturesPositions) {
      blockEntry(ev, 'MAX_FUTURES', `SHORT דורש FUTURES — ${futuresCount}/${ctx.maxFuturesPositions} תפוסות`, '[path-sim]');
      continue; // SHORT = futures
    }
    // LIMIT mode rests at the plan's own discounted level; MARKET mode fires at
    // the live price. Sizing is off whichever price the order actually uses.
    const price = ctx.limitEntries ? plan.limitEntryPrice : plan.entryRef;

    // Position sizing: 10% of equity, independent of stop-loss distance.
    // SL is used only to measure the resulting dollar risk.
    const desiredNotional = sizingBase * p.positionTargetPct;

    // Both refusals below were bare `continue`s — the same blindness that hid
    // Bybit's zero-entry run. Path is spot-first with no scale-in, so its
    // target clears the floor at any equity ≥ $1,000; the exposure/cash branch
    // is the one that actually bites, and it was the one saying nothing.
    if (desiredNotional < MIN_SIM_ENTRY_USD) {
      blockEntry(
        ev,
        MIN_ORDER_EXCEEDS_POSITION_TARGET,
        `יעד הפוזיציה $${desiredNotional.toFixed(2)} (${(p.positionTargetPct * 100).toFixed(0)}% מההון) < מינימום הזמנה $${MIN_SIM_ENTRY_USD}`,
        '[path-sim]'
      );
      continue;
    }

    const assetUsed = exposureByBase.get(ev.symbol) ?? 0;
    const assetHeadroom = Math.max(0, perAssetCap - assetUsed);
    const totalHeadroom = Math.max(0, totalCap - totalExposure);
    const notional = Math.min(desiredNotional, assetHeadroom, totalHeadroom, workingCash);
    if (notional < MIN_SIM_ENTRY_USD) {
      const binding =
        assetHeadroom <= totalHeadroom && assetHeadroom <= workingCash && assetHeadroom < desiredNotional
          ? `תקרת חשיפה לנכס (${PER_ASSET_EXPOSURE_CAP_PERCENT}%) — נותרו $${assetHeadroom.toFixed(2)}`
          : totalHeadroom <= workingCash && totalHeadroom < desiredNotional
            ? `תקרת חשיפה כוללת (${MAX_TOTAL_EXPOSURE_PERCENT}%) — נותרו $${totalHeadroom.toFixed(2)}`
            : `מזומן פנוי $${workingCash.toFixed(2)}`;
      blockEntry(
        ev,
        MIN_ORDER_EXCEEDS_POSITION_TARGET,
        `${binding} < מינימום הזמנה $${MIN_SIM_ENTRY_USD}`,
        '[path-sim]'
      );
      continue;
    }

    exposureByBase.set(ev.symbol, assetUsed + notional);
    totalExposure += notional;
    workingCash -= notional;
    positionCount++;
    if (!isLong) futuresCount++;
    pendingEntrySymbols.add(ev.symbol);

    newOrders.push({
      id: uid(`${ev.symbol}-${isLong ? 'buy' : 'short'}`),
      symbol: ev.symbol,
      type: isLong ? 'SPOT' : 'FUTURES',
      side: isLong ? 'buy' : 'short',
      signalPrice: price,
      quantity: notional / price,
      budgetUsd: notional,
      leverage: 1,
      // Default MARKET: a breakout entry normally wants the fill now. LIMIT
      // (proLimitEntries on) rests at the signal price — fills only if price
      // pulls back to it (a retest), else expires.
      fill: ctx.limitEntries ? 'limit' : 'market',
      stopLoss: plan.stopLoss,
      takeProfit: plan.takeProfit,
      takeProfit1: plan.takeProfit1,
      takeProfit2: plan.takeProfit2,
      reason: ev.reasoning,
      confidence: ev.confidence,
      executeAt: now + delayMs,
      createdAt: now
    });
  }

  return newOrders;
}
