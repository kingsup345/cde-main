/**
 * Prev-4H Range ("נתיב 4H") — adverse-selection + early-exit fixes (2026-09-10)
 * ============================================================================
 *  1. `breakout` confidence component INVERTED — a clean touch of H/L now
 *     scores high, an extended entry low. Order priority is confidence-desc
 *     under limited slots/cash, so the old formula filled the worst admissible
 *     setups first and, near the 55 floor, could reject the clean ones.
 *  2. `rangeScore` is monotonic in bandPos — a tight reference range (tight
 *     `mid` stop → a TP1 reachable inside the one 4H window) scores highest.
 *  3. After TP1 the runner is protected at BREAK-EVEN and rides to TP2 / the 4H
 *     time stop / an EMA reversal — it is no longer closed on the first tick
 *     back below TP1.
 */

import { describe, it, expect } from 'vitest';
import { evaluatePrev4hRange, readPrev4hRangePlan, type Prev4hRangePlan } from '@cde/engine/analysis';
import { generatePrev4hRangeOrders, type Prev4hRangeOrderGenContext } from '@cde/engine/execution';
import type { SimPosition } from '@cde/engine/execution';
import type { SignalEvaluation } from '@cde/engine';

const H1_MS = 60 * 60 * 1000;
const BAR_MS = 4 * H1_MS;

interface C { timestamp: number; open: number; high: number; low: number; close: number; volume: number }
function h1Series(n: number, base: number, step: number): C[] {
  return Array.from({ length: n }, (_, i) => {
    const close = base + i * step;
    return {
      timestamp: i * H1_MS,
      open: i === 0 ? close : base + (i - 1) * step,
      high: close + 0.2, low: close - 0.2, close, volume: 1000
    };
  });
}
function nowInNextWindow(n: number): number {
  return (Math.floor(n / 4) - 1) * BAR_MS + BAR_MS + H1_MS;
}

// prev 4H bar of h1Series(108, 50, 0.5): H=103.7, L=101.8, mid=102.75, range=1.9.
// maxExtension ≈ 0.1818 × 1.9 ≈ 0.345.
const N = 108;
const H1 = h1Series(N, 50, 0.5);
const NOW = nowInNextWindow(N);
const evalAt = (price: number, params = {}) =>
  evaluatePrev4hRange({ symbol: 'RNG', h1: H1, currentPrice: price, now: NOW, params });

describe('#1 — a clean touch outranks an extended entry', () => {
  it('confidence(clean touch d≈0.05) > confidence(extended d≈0.30), both still SIGNAL', () => {
    const clean = evalAt(103.75);   // d ≈ 0.05  (≈ 15% of maxExtension)
    const extended = evalAt(104.00); // d ≈ 0.30  (≈ 87% of maxExtension)
    expect(clean.willExecute).toBe(true);
    expect(extended.willExecute).toBe(true);
    expect(clean.confidence).toBeGreaterThan(extended.confidence);
  });

  it('the breakout component itself is now high for a clean touch, low for an extended one', () => {
    const clean = readPrev4hRangePlan(evalAt(103.75)) as Prev4hRangePlan;
    const extended = readPrev4hRangePlan(evalAt(104.00)) as Prev4hRangePlan;
    expect(clean.components.breakout).toBeGreaterThan(20);
    expect(extended.components.breakout).toBeLessThan(10);
  });
});

describe('#2 — rangeScore rewards a tight reference range', () => {
  it('a near-floor bandPos scores ~10; a near-cap bandPos scores ~0', () => {
    // actual rangePct ≈ 1.84%. Squeeze the band so it lands near 0 vs near 1.
    const tight = readPrev4hRangePlan(evalAt(103.75, { minRangePct: 0.017, maxRangePct: 0.08 })) as Prev4hRangePlan;
    const wide = readPrev4hRangePlan(evalAt(103.75, { minRangePct: 0.005, maxRangePct: 0.02 })) as Prev4hRangePlan;
    expect(tight.components.range).toBeGreaterThan(8);
    expect(wide.components.range).toBeLessThan(3);
    expect(tight.components.range).toBeGreaterThan(wide.components.range);
  });
});

// ── #3 — runner break-even ─────────────────────────────────────────────────

function pos(over: Partial<SimPosition> = {}): SimPosition {
  return {
    id: 'p1', symbol: 'RNG', type: 'SPOT', side: 'BUY', quantity: 1,
    entryPrice: 100, avgPrice: 100, currentPrice: 100, leverage: 1,
    marginUsd: 100, notionalUsd: 100, stopLoss: 98,
    takeProfit: 105, takeProfit1: 105, takeProfit2: 107.5, tp1Hit: false,
    openedAt: '', openTimestamp: Date.now() - 1000, reason: '', confidence: 60, entryFee: 0,
    ...over
  };
}
const ctx = (positions: SimPosition[], price: number): Prev4hRangeOrderGenContext => ({
  positions, pending: [], evaluations: [] as SignalEvaluation[],
  executionDelaySec: 0, dailyDrawdownPercent: 0, weeklyDrawdownPercent: 0,
  cash: 9900, equity: 10000, totalLeveragedExposureUsd: 0, exitCooldown: {},
  priceFor: () => price, candlesBySymbol: {}, maxPositions: 5, maxFuturesPositions: 2
});

describe('#3 — the runner survives a dip below TP1 and is capped at break-even', () => {
  it('tp1Hit, price back below TP1 but above entry → NOT closed (was: hair-trigger exit)', () => {
    const orders = generatePrev4hRangeOrders(ctx([pos({ tp1Hit: true })], 104));
    expect(orders.filter((o) => o.positionId === 'p1')).toHaveLength(0);
  });

  it('tp1Hit, price back to entry → closed as a BREAK-EVEN stop, not a loss', () => {
    const orders = generatePrev4hRangeOrders(ctx([pos({ tp1Hit: true })], 99.9));
    const close = orders.find((o) => o.positionId === 'p1');
    expect(close?.side).toBe('close_long');
    expect(close?.reason).toContain('Break-even');
  });

  it('pre-TP1 stop-out is unchanged — mid-range stop still fires as Stop Loss', () => {
    const orders = generatePrev4hRangeOrders(ctx([pos({ tp1Hit: false })], 97.9));
    const close = orders.find((o) => o.positionId === 'p1');
    expect(close?.side).toBe('close_long');
    expect(close?.reason).toContain('Stop Loss');
  });

  it('tp1Hit runner still takes TP2 when it prints', () => {
    const orders = generatePrev4hRangeOrders(ctx([pos({ tp1Hit: true })], 108));
    const close = orders.find((o) => o.positionId === 'p1');
    expect(close?.reason).toContain('TP2');
  });
});
