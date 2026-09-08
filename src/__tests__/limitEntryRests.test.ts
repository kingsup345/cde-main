/**
 * "כניסה לפי שער (לימיט)" must actually wait
 * ============================================================================
 * With limit entries ON, path and bybit filled instantly while intraday and pro
 * genuinely rested. Measured on the live worker 2026-09-08, all four with
 * proLimitEntries=true:
 *
 *   sim (intraday)  4 orders resting 208-212s   ✓
 *   pro-sim         3 orders resting  93-212s   ✓
 *   path-sim        0 pending, positions open   ✗
 *   bybit-sim       0 pending                   ✗
 *
 * Cause: both breakout bots rested their limit at `entryRef = currentPrice`,
 * the live price at signal time. `selectFillableOrders` fills a long once
 * `live <= signalPrice`, and `<=` includes equality — so a flat tick, or a
 * price cache that had not refreshed inside the 3-second execution delay,
 * filled it at once. A limit to buy AT the market is a market order.
 *
 * Both now rest at a volatility-scaled discount below market, floored just past
 * the level they broke — the same shape intradayEntry.ts uses.
 */

import { describe, it, expect } from 'vitest';
import {
  breakoutLimitPrice,
  selectFillableOrders,
  generateTrendBreakoutOrders,
  generatePrev4hRangeOrders,
  type PendingOrder
} from '@cde/engine/execution';
import type { SignalEvaluation } from '@cde/engine';

describe('breakoutLimitPrice — a discount below market, never above it', () => {
  // LONG: market 105, broke out over 100, ATR-ish unit 10 → discount 0.15 × 10.
  const long = (market: number, offset: number, level: number, buffer = 0.2) =>
    breakoutLimitPrice(market, true, offset, level, buffer);
  const short = (market: number, offset: number, level: number, buffer = 0.2) =>
    breakoutLimitPrice(market, false, offset, level, buffer);

  it('a roomy breakout rests at the full discount', () => {
    // market 110, broken level 100: 110 − 1.5 = 108.5, well clear of 100.2.
    expect(long(110, 1.5, 100)).toBeCloseTo(108.5, 9);
  });

  it('never rests below the level that was broken — that is buying back inside', () => {
    // market 100.5, discount 1.5 would land at 99 — back under the broken 100.
    expect(long(100.5, 1.5, 100)).toBeCloseTo(100.2, 9); // level + buffer
  });

  it('a razor-fresh breakout rests AT the market, never above it', () => {
    // market 100.1 is already below level+buffer (100.2) → clamped to market.
    expect(long(100.1, 1.5, 100)).toBeCloseTo(100.1, 9);
  });

  it('the result is never above market for a long, at any input', () => {
    for (const market of [100.05, 100.1, 100.5, 101, 105, 110]) {
      expect(long(market, 1.5, 100)).toBeLessThanOrEqual(market);
    }
  });

  it('mirrors exactly for a short', () => {
    expect(short(90, 1.5, 100)).toBeCloseTo(91.5, 9);   // full premium
    expect(short(99.5, 1.5, 100)).toBeCloseTo(99.8, 9); // level − buffer
    expect(short(99.9, 1.5, 100)).toBeCloseTo(99.9, 9); // clamped to market
    for (const market of [99.95, 99.9, 99.5, 99, 95, 90]) {
      expect(short(market, 1.5, 100)).toBeGreaterThanOrEqual(market);
    }
  });

  it('a discount of zero degenerates to the market price — the old behaviour', () => {
    // This is precisely what path and bybit were doing, spelled out.
    expect(long(105, 0, 100)).toBeCloseTo(105, 9);
  });
});

describe('selectFillableOrders — why resting at the market filled instantly', () => {
  const order = (signalPrice: number): PendingOrder => ({
    id: 'o1',
    symbol: 'NEAR',
    type: 'SPOT',
    side: 'buy',
    signalPrice,
    quantity: 10,
    budgetUsd: 1000,
    fill: 'limit',
    reason: 'test',
    confidence: 90,
    executeAt: Date.now() - 1000, // delay already elapsed
    createdAt: Date.now() - 5000
  });

  it('a limit resting AT the live price fills on a completely flat tick', () => {
    // `crossed` is `live <= signalPrice`, and <= includes equality. No price
    // movement of any kind is required — this is the bug, stated as a test.
    const { due } = selectFillableOrders([order(100)], Date.now(), () => 100);
    expect(due).toHaveLength(1);
  });

  it('a limit resting BELOW the live price waits', () => {
    const { due, expired } = selectFillableOrders([order(98.5)], Date.now(), () => 100);
    expect(due).toHaveLength(0);
    expect(expired).toHaveLength(0); // still inside the 2h TTL
  });

  it('...and fills only once the market actually comes to it', () => {
    const { due } = selectFillableOrders([order(98.5)], Date.now(), () => 98.4);
    expect(due).toHaveLength(1);
  });

  it('an unfilled limit expires after the 2h TTL rather than resting forever', () => {
    const stale = { ...order(98.5), createdAt: Date.now() - 3 * 60 * 60 * 1000 };
    const { due, expired } = selectFillableOrders([stale], Date.now(), () => 100);
    expect(due).toHaveLength(0);
    expect(expired).toHaveLength(1);
  });

  it('a MARKET entry ignores the price condition entirely — unchanged', () => {
    const market = { ...order(98.5), fill: 'market' as const };
    const { due } = selectFillableOrders([market], Date.now(), () => 100);
    expect(due).toHaveLength(1);
  });
});

/**
 * End-to-end wiring: the checkbox must change WHERE the order rests, for both
 * breakout bots. Previously it changed only the fee and the slippage, which
 * quietly flattered path and bybit against intraday and pro inside a framework
 * whose whole point is that differences come from decisions, not plumbing.
 */
describe('the checkbox moves the resting price for path and bybit', () => {
  const MARKET = 4.795;
  const LIMIT = 4.70;

  const evaluation = (decision: Record<string, unknown>): SignalEvaluation => ({
    symbol: 'NEAR',
    action: 'buy',
    tradeType: 'SPOT',
    tradeSide: 'BUY',
    confidence: 93,
    price: MARKET,
    priceChange24h: 1,
    reasoning: '',
    status: 'SIGNAL SPOT LONG',
    willExecute: true,
    factors: [],
    confidenceGap: 0,
    decision: decision as never
  });

  const bybitEval = () => evaluation({
    direction: 'LONG',
    entryRef: MARKET,
    limitEntryPrice: LIMIT,
    stopLoss: 4.6,
    takeProfit: 5.1,
    riskPerUnit: 0.195
  });

  const pathEval = () => evaluation({
    direction: 'LONG',
    windowStart: Date.now() - 60_000,
    windowEnd: Date.now() + 3 * 60 * 60 * 1000,
    entryRef: MARKET,
    limitEntryPrice: LIMIT,
    stopLoss: 4.6,
    takeProfit: 5.1,
    riskPerUnit: 0.195
  });

  const common = (ev: SignalEvaluation) => ({
    positions: [],
    pending: [],
    evaluations: [ev],
    executionDelaySec: 0,
    dailyDrawdownPercent: 0,
    weeklyDrawdownPercent: 0,
    cash: 10_000,
    equity: 10_000,
    initialAmount: 10_000,
    totalLeveragedExposureUsd: 0,
    exitCooldown: {},
    priceFor: (s: string) => (s === 'NEAR' ? MARKET : undefined),
    candlesBySymbol: {}
  });

  it('bybit: limit ON rests at the discounted level, OFF fires at market', () => {
    const on = generateTrendBreakoutOrders({
      ...common(bybitEval()), maxConcurrentTrades: 7, limitEntries: true
    });
    expect(on).toHaveLength(1);
    expect(on[0].fill).toBe('limit');
    expect(on[0].signalPrice).toBeCloseTo(LIMIT, 9);
    expect(on[0].signalPrice).toBeLessThan(MARKET);

    const off = generateTrendBreakoutOrders({
      ...common(bybitEval()), maxConcurrentTrades: 7, limitEntries: false
    });
    expect(off[0].fill).toBe('market');
    expect(off[0].signalPrice).toBeCloseTo(MARKET, 9);
  });

  it('path: limit ON rests at the discounted level, OFF fires at market', () => {
    const on = generatePrev4hRangeOrders({
      ...common(pathEval()), maxPositions: 7, maxFuturesPositions: 2, limitEntries: true
    });
    expect(on).toHaveLength(1);
    expect(on[0].fill).toBe('limit');
    expect(on[0].signalPrice).toBeCloseTo(LIMIT, 9);
    expect(on[0].signalPrice).toBeLessThan(MARKET);

    const off = generatePrev4hRangeOrders({
      ...common(pathEval()), maxPositions: 7, maxFuturesPositions: 2, limitEntries: false
    });
    expect(off[0].fill).toBe('market');
    expect(off[0].signalPrice).toBeCloseTo(MARKET, 9);
  });

  it('a limit order from either bot then genuinely waits at that price', () => {
    const [order] = generateTrendBreakoutOrders({
      ...common(bybitEval()), maxConcurrentTrades: 7, limitEntries: true
    });
    const ready = { ...order, executeAt: Date.now() - 1 };
    // Market unchanged at 4.795 — nothing fills.
    expect(selectFillableOrders([ready], Date.now(), () => MARKET).due).toHaveLength(0);
    // Market comes down to the resting level — now it fills.
    expect(selectFillableOrders([ready], Date.now(), () => LIMIT).due).toHaveLength(1);
  });
});
