/**
 * Bybit / TrendBreakout — scale-in risk is now bounded (2026-09-09)
 * ============================================================================
 * The bot was booking losses LARGER than a clean −1R stop-out whenever a small
 * winner reversed. Cause: every scale-in lot inherited lot 0's stop, so a lot
 * added at +0.5R sat 1.5R from the shared stop; a reversal to that stop lost
 * 1.5R on 30% of the position on top of −1R on lot 0. Three fixes:
 *
 *   1. effectiveStop pulls the shared stop up so the WORST-positioned lot never
 *      risks more than rUnit (= |entry0 − stop0| ≤ 4.2% cap).
 *   2. A per-lot 4.2% emergency brake — a scaled lot hits its own −4.2% before
 *      lot 0's capLevel is reached.
 *   3. SCALE_2 / SCALE_3 moved from +0.5R / +1.0R to +1.0R / +1.5R, and TP1 is
 *      measured off the CAPPED stop so "2R" means one thing everywhere.
 */

import { describe, it, expect } from 'vitest';
import {
  generateTrendBreakoutOrders,
  trendBreakoutEffectiveStop,
  type Candle,
  type SimPosition
} from '@cde/engine/execution';
import {
  DEFAULT_TREND_BREAKOUT_PARAMS,
  evaluateTrendBreakout,
  readTrendBreakoutPlan,
  type TrendBreakoutPlan
} from '@cde/engine/analysis';

const H1 = 3_600_000;
const M15 = 15 * 60_000;

function h1Uptrend(n = 220): Candle[] {
  return Array.from({ length: n }, (_, i) => ({
    timestamp: i * H1,
    open: 100 + i * 0.5, high: 100.9 + i * 0.5, low: 99.5 + i * 0.5, close: 100.5 + i * 0.5,
    volume: 1000
  }));
}
const m15Flat = (range = 1.0, n = 30): Candle[] =>
  Array.from({ length: n }, (_, i) => ({
    timestamp: i * M15, open: 100, high: 100 + range / 2, low: 100 - range / 2, close: 100, volume: 1000
  }));

function lot(over: Partial<SimPosition> = {}): SimPosition {
  return {
    id: 'lot1', symbol: 'BTC', type: 'SPOT', side: 'LONG', quantity: 1,
    entryPrice: 100, avgPrice: 100, currentPrice: 100, leverage: 1, marginUsd: 100, notionalUsd: 100,
    stopLoss: 97.2, takeProfit1: 103, takeProfit2: 104.5, takeProfit: 103,
    tp1Hit: false, highestPrice: 100, lowestPrice: 100, openedAt: '',
    openTimestamp: Date.now() - 60_000, reason: 'test', confidence: 80, entryFee: 0,
    ...over
  };
}

function ctx(over: { positions?: SimPosition[]; price?: number; m15?: Candle[] } = {}) {
  return {
    positions: over.positions ?? [lot()],
    pending: [], evaluations: [], executionDelaySec: 0,
    dailyDrawdownPercent: 0, weeklyDrawdownPercent: 0,
    cash: 10_000, equity: 10_000, initialAmount: 10_000, totalLeveragedExposureUsd: 0,
    exitCooldown: {},
    priceFor: (s: string) => (s === 'BTC' ? over.price ?? 100 : undefined),
    candlesBySymbol: { BTC: { h1: h1Uptrend(), m15: over.m15 ?? m15Flat(), m5: [] } },
    maxConcurrentTrades: 7
  };
}

// entry 100, ATR(M15)=1.0 → rUnit = 2.8, stop0 = 97.2.
const lot0 = () => lot({ id: 'l0', entryPrice: 100, stopLoss: 97.2 });
// A scale-in lot added at +0.5R (= 101.4), which INHERITED lot 0's 97.2 stop.
const scaleLotAtHalfR = () => lot({ id: 'l1', entryPrice: 101.4, stopLoss: 97.2, highestPrice: 101.4 });

describe('effectiveStop — no lot risks more than 1R after a scale-in', () => {
  it('a scale-in lot pulls the shared stop up to (worstEntry − rUnit)', () => {
    const lt = { base: 'BTC', side: 'LONG' as const, lots: [lot0(), scaleLotAtHalfR()] };
    const { stop } = trendBreakoutEffectiveStop(lt, 101.0, 1.0, DEFAULT_TREND_BREAKOUT_PARAMS);
    // worstEntry 101.4 − rUnit 2.8 = 98.6 — up from the inherited 97.2.
    expect(stop).toBeCloseTo(98.6, 6);
    // ⇒ the +0.5R lot now risks 101.4 − 98.6 = 2.8 = exactly 1R, not 1.5R.
    expect(101.4 - stop).toBeCloseTo(2.8, 6);
  });

  it('is inert for a single-lot trade (worstEntry === entry0)', () => {
    const lt = { base: 'BTC', side: 'LONG' as const, lots: [lot0()] };
    const { stop } = trendBreakoutEffectiveStop(lt, 100.5, 1.0, DEFAULT_TREND_BREAKOUT_PARAMS);
    expect(stop).toBeCloseTo(97.2, 6);
  });

  it('mirrors on a SHORT — the shared stop is pulled DOWN toward the lowest lot', () => {
    const s0 = lot({ id: 's0', side: 'SHORT', entryPrice: 100, stopLoss: 102.8, lowestPrice: 100 });
    const s1 = lot({ id: 's1', side: 'SHORT', entryPrice: 98.6, stopLoss: 102.8, lowestPrice: 98.6 });
    const lt = { base: 'BTC', side: 'SHORT' as const, lots: [s0, s1] };
    const { stop } = trendBreakoutEffectiveStop(lt, 99.0, 1.0, DEFAULT_TREND_BREAKOUT_PARAMS);
    // worstEntry 98.6 + rUnit 2.8 = 101.4.
    expect(stop).toBeCloseTo(101.4, 6);
    expect(stop - 98.6).toBeCloseTo(2.8, 6);
  });
});

describe('a small winner that reverses no longer loses more than a clean stop', () => {
  it('the 2-lot trade exits at the tightened stop (98.6), not the inherited 97.2', () => {
    // Price back to 98.5 — below the new shared stop (98.6), above the old (97.2).
    const orders = generateTrendBreakoutOrders(
      ctx({ positions: [lot0(), scaleLotAtHalfR()], price: 98.5 }) as never
    );
    const closes = orders.filter((o) => o.side === 'close_long');
    expect(closes).toHaveLength(2); // both lots close together
    // The scale lot's realised loss: (98.5 − 101.4) / 101.4 ≈ −2.86% ≈ 1R, capped.
    expect((98.5 - 101.4) / 101.4 * 100).toBeGreaterThan(-4.2);
  });

  it('a single lot at the same price is NOT stopped (control — old stop still 97.2)', () => {
    const orders = generateTrendBreakoutOrders(ctx({ positions: [lot0()], price: 98.5 }) as never);
    expect(orders.filter((o) => o.side === 'close_long')).toHaveLength(0);
  });
});

describe('per-lot 4.2% emergency brake', () => {
  it('fires when a scaled lot is >4.2% down even though lot 0 is barely underwater', () => {
    // lot0 @100 (−1.5% at 98.5), lot1 @103 (−4.37% at 98.5). capLevel(100)=95.8
    // is not reached, but the worst lot has blown its own 4.2%.
    const l1 = lot({ id: 'l1', entryPrice: 103, stopLoss: 97.2, highestPrice: 103 });
    const orders = generateTrendBreakoutOrders(
      ctx({ positions: [lot0(), l1], price: 98.5 }) as never
    );
    const close = orders.find((o) => o.side === 'close_long');
    expect(close).toBeDefined();
    expect(close!.reason).toContain('חריגת תקרת הפסד');
  });
});

describe('SCALE_2 / SCALE_3 only after the trade has proved itself', () => {
  it('defaults moved to +1.0R / +1.5R (spec §11 deviation, 2026-09-09)', () => {
    expect(DEFAULT_TREND_BREAKOUT_PARAMS.scale2MinR).toBe(1.0);
    expect(DEFAULT_TREND_BREAKOUT_PARAMS.scale3MinR).toBe(1.5);
    expect(DEFAULT_TREND_BREAKOUT_PARAMS.scale2MinR).toBe(DEFAULT_TREND_BREAKOUT_PARAMS.breakEvenR);
    expect(DEFAULT_TREND_BREAKOUT_PARAMS.scale3MinR).toBe(DEFAULT_TREND_BREAKOUT_PARAMS.trailingStartR);
  });

  it('a trade only +0.6R in profit does NOT scale in at the new defaults', () => {
    // rUnit 2.8 → +0.6R ≈ 101.68. Old defaults (scale2MinR 0.5) would add here.
    const orders = generateTrendBreakoutOrders(ctx({ positions: [lot0()], price: 101.68 }) as never);
    expect(orders.find((o) => o.reason?.includes('scale 2'))).toBeUndefined();
  });
});

describe('TP1 is 2× the CAPPED stop — the same R everywhere', () => {
  it('on a capped-stop signal, |TP1 − entry| == 2 × |entry − stop| and grossRR == 2.0', () => {
    const h1 = h1Uptrend();
    const m15: Candle[] = Array.from({ length: 320 }, (_, i) => ({
      timestamp: i * M15, open: 150 + i * 0.15, high: 150.45 + i * 0.15, low: 149.55 + i * 0.15,
      close: 150.15 + i * 0.15, volume: 1000
    }));
    const prev = m15[m15.length - 2];
    m15[m15.length - 1] = { timestamp: m15[m15.length - 1].timestamp, open: prev.close, high: 205.2, low: prev.close - 0.2, close: 205, volume: 8000 };
    const m5 = Array.from({ length: 40 }, (_, i) => ({
      timestamp: i * 5 * 60_000, open: 200 + i * 0.13, high: 200.4 + i * 0.13, low: 199.6 + i * 0.13, close: 200.2 + i * 0.13, volume: 1000
    }));
    // slAtrMultiplier 20 forces the 4.2% cap to bind.
    const ev = evaluateTrendBreakout({ symbol: 'CAP', h1, m15, m5, currentPrice: 205, params: { slAtrMultiplier: 20 } });
    const plan = readTrendBreakoutPlan(ev) as TrendBreakoutPlan;
    expect(plan.stopCapped).toBe(true);
    const cappedR = plan.entryRef - plan.stopLoss;
    expect(cappedR).toBeCloseTo(plan.entryRef * 0.042, 4); // pinned to the cap
    expect(plan.takeProfit1 - plan.entryRef).toBeCloseTo(2 * cappedR, 6);
    expect((plan.takeProfit1 - plan.entryRef) / cappedR).toBeCloseTo(2.0, 6);
  });
});
