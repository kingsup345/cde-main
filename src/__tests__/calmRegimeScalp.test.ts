/**
 * Calm-regime scalp — SL 2.3% / TP1 1.8% / TP2 3.5% (2026-09-11)
 * ============================================================================
 * Operator request: in a QUIET market, trade a fixed, tighter ladder instead
 * of each bot's own (usually wider) dynamic one — profit from small moves
 * instead of chasing. In a genuinely volatile market (the bot's own dynamic
 * stop is already >= CALM_SL_THRESHOLD_PCT = 2.3%), change nothing.
 *
 * TP1/SL = 1.8/2.3 = 0.78 is BELOW every bot's minRewardRisk gate (1.2) on
 * purpose — TP1 is a fast 50% partial, not the whole thesis. The R:R gate is
 * re-pointed at TP2 in the calm branch (3.5/2.3 = 1.52, clears 1.2).
 *
 * Every bot defaults the flag OFF (`calmRegimeScalp` unset) — the live bot and
 * every OTHER test in the suite never sets it, so this is purely additive.
 */

import { describe, it, expect } from 'vitest';
import {
  CALM_SL_PCT, CALM_TP1_PCT, CALM_TP2_PCT, CALM_SL_THRESHOLD_PCT,
  isCalmRegime, resolveCalmTp1Percent,
  buildRiskPlan, evaluatePrev4hRange, readPrev4hRangePlan,
  proStopTpLevels,
  evaluateTrendBreakout, readTrendBreakoutPlan,
  type RiskPlanInput
} from '@cde/engine/analysis';
import { withParams } from '@cde/engine';
import type { Candle } from '@cde/engine';

// ── the pure helpers ─────────────────────────────────────────────────────────

describe('calmRegime helpers', () => {
  it('isCalmRegime is true strictly below the threshold, false at/above it', () => {
    expect(isCalmRegime(CALM_SL_THRESHOLD_PCT - 0.01)).toBe(true);
    expect(isCalmRegime(CALM_SL_THRESHOLD_PCT)).toBe(false);
    expect(isCalmRegime(CALM_SL_THRESHOLD_PCT + 1)).toBe(false);
  });

  it('resolveCalmTp1Percent never widens the bot\'s own target — only tightens', () => {
    expect(resolveCalmTp1Percent(1.2)).toBeCloseTo(1.2, 6); // tighter dynamic target wins
    expect(resolveCalmTp1Percent(3.0)).toBeCloseTo(CALM_TP1_PCT, 6); // fixed 1.8 wins
  });

  it('the fixed ladder is internally consistent: TP1 < SL < TP2, TP2/SL clears 1.2', () => {
    expect(CALM_TP1_PCT).toBeLessThan(CALM_SL_PCT);
    expect(CALM_TP2_PCT / CALM_SL_PCT).toBeGreaterThanOrEqual(1.2);
  });
});

// ── Intraday (buildRiskPlan) ─────────────────────────────────────────────────

const baseIntradayInput: Omit<RiskPlanInput, 'entryPrice' | 'atr5' | 'atr15' | 'equity'> = {
  symbol: 'CALM',
  direction: 'LONG',
  tradeType: 'SPOT',
  setupType: 'TREND_PULLBACK',
  openPositions: 0,
  openFutures: 0,
  currentLeveragedExposureUsd: 0,
  existingExposureByAsset: {}
};

describe('Intraday — buildRiskPlan calm branch', () => {
  it('quiet market: SL≈2.3%, TP1≈1.8%, TP2≈3.5%, NOT rejected', () => {
    const entry = 100;
    const plan = buildRiskPlan({
      ...baseIntradayInput,
      entryPrice: entry,
      atr5: entry * 0.005, // tiny ATR → dynamic stop << 2.3%
      atr15: entry * 0.006,
      equity: 10_000,
      params: withParams({ calmRegimeScalp: true })
    });
    expect(plan.approved).toBe(true);
    expect(plan.riskPercent).toBeCloseTo(CALM_SL_PCT, 1);
    expect(plan.rewardPercent).toBeCloseTo(CALM_TP1_PCT, 1);
    expect(Math.abs(plan.takeProfit2 - entry) / entry * 100).toBeCloseTo(CALM_TP2_PCT, 1);
  });

  it('big move: dynamic stop already >= 2.3% → untouched, calm branch does not fire', () => {
    const entry = 100;
    const plan = buildRiskPlan({
      ...baseIntradayInput,
      entryPrice: entry,
      atr5: entry * 0.02, // large ATR
      atr15: entry * 0.022,
      equity: 10_000,
      params: withParams({ calmRegimeScalp: true, maxStopPercent: 5 })
    });
    expect(plan.approved).toBe(true);
    expect(plan.riskPercent).toBeGreaterThanOrEqual(CALM_SL_THRESHOLD_PCT);
    // Not the fixed calm TP1 — the dynamic ladder (SL × tp1RewardRisk) instead.
    expect(plan.rewardPercent).not.toBeCloseTo(CALM_TP1_PCT, 1);
  });

  it('flag off (default): identical to today — never CALM_SL_PCT regardless of ATR', () => {
    const entry = 100;
    const plan = buildRiskPlan({
      ...baseIntradayInput,
      entryPrice: entry,
      atr5: entry * 0.005,
      atr15: entry * 0.006,
      equity: 10_000,
      params: withParams({})
    });
    expect(plan.approved).toBe(true);
    expect(plan.riskPercent).not.toBeCloseTo(CALM_SL_PCT, 1);
  });
});

// ── Pro (proStopTpLevels) ────────────────────────────────────────────────────

describe('Pro — proStopTpLevels calm branch', () => {
  it('quiet market (low ATR%): SL 2.3%, TP1 1.8%, TP2 3.5%', () => {
    const entry = 100;
    const levels = proStopTpLevels(entry, 0.5, true, { calmRegimeScalp: true });
    expect((entry - levels.stopLoss) / entry * 100).toBeCloseTo(CALM_SL_PCT, 6);
    expect((levels.takeProfit1 - entry) / entry * 100).toBeCloseTo(CALM_TP1_PCT, 6);
    expect((levels.takeProfit2 - entry) / entry * 100).toBeCloseTo(CALM_TP2_PCT, 6);
  });

  it('big move (high ATR%): dynamic ladder untouched', () => {
    const entry = 100;
    const levels = proStopTpLevels(entry, 2.0, true, { calmRegimeScalp: true });
    const slPct = (entry - levels.stopLoss) / entry * 100;
    expect(slPct).toBeGreaterThanOrEqual(CALM_SL_THRESHOLD_PCT);
    expect((levels.takeProfit1 - entry) / entry * 100).not.toBeCloseTo(CALM_TP1_PCT, 1);
  });

  it('flag off (default): identical to today', () => {
    const entry = 100;
    const levels = proStopTpLevels(entry, 0.5, true);
    expect((entry - levels.stopLoss) / entry * 100).not.toBeCloseTo(CALM_SL_PCT, 1);
  });
});

// ── Path (evaluatePrev4hRange) ───────────────────────────────────────────────

const H1_MS = 60 * 60 * 1000;
const BAR_MS = 4 * H1_MS;
function h1Series(n: number, base: number, step: number, k: number): Candle[] {
  return Array.from({ length: n }, (_, i) => {
    const close = base + i * step;
    return {
      timestamp: i * H1_MS,
      open: i === 0 ? close : base + (i - 1) * step,
      high: close + k, low: close - k, close, volume: 1000
    };
  });
}
function nowInNextWindow(n: number): number {
  return (Math.floor(n / 4) - 1) * BAR_MS + BAR_MS + H1_MS;
}

describe('Path — evaluatePrev4hRange calm branch', () => {
  // Tight prev-4H range (base 50, step 0.5, k 0.2): mid-stop dist ≈ 1.0,
  // entry ≈ 103.75 → dynSlPct ≈ 0.96% — quiet.
  const N = 108;
  const TIGHT_H1 = h1Series(N, 50, 0.5, 0.2);
  const NOW = nowInNextWindow(N);

  it('quiet market (tight prev-4H range): SL≈2.3%, TP1 <= 1.8% (never widened), TP2≈3.5%, still SIGNAL', () => {
    const ev = evaluatePrev4hRange({ symbol: 'RNG', h1: TIGHT_H1, currentPrice: 103.75, now: NOW, params: { calmRegimeScalp: true } });
    expect(ev.willExecute).toBe(true);
    const plan = readPrev4hRangePlan(ev)!;
    const entry = plan.entryRef;
    expect(Math.abs(entry - plan.stopLoss) / entry * 100).toBeCloseTo(CALM_SL_PCT, 1);
    // This bot's own dynamic TP1 here is ~1.5% (tp1FloorDistance) — TIGHTER
    // than the fixed 1.8, so resolveCalmTp1Percent correctly keeps it (never
    // widens a target). The intraday/Pro tests above exercise the opposite
    // side (fixed 1.8 wins when the dynamic target is wider).
    const tp1Pct = Math.abs(plan.takeProfit1 - entry) / entry * 100;
    expect(tp1Pct).toBeGreaterThan(0);
    expect(tp1Pct).toBeLessThanOrEqual(CALM_TP1_PCT + 1e-6);
    expect(Math.abs(plan.takeProfit2 - entry) / entry * 100).toBeCloseTo(CALM_TP2_PCT, 1);
  });

  it('quiet market, flag off: identical to today (tight mid-stop, not 2.3%)', () => {
    const ev = evaluatePrev4hRange({ symbol: 'RNG', h1: TIGHT_H1, currentPrice: 103.75, now: NOW, params: {} });
    expect(ev.willExecute).toBe(true);
    const plan = readPrev4hRangePlan(ev)!;
    const entry = plan.entryRef;
    expect(Math.abs(entry - plan.stopLoss) / entry * 100).not.toBeCloseTo(CALM_SL_PCT, 1);
  });

  it('big move (wide prev-4H range, dynSl >= 2.3%): untouched', () => {
    // base 10, step 0.1, k 0.4 → mid-stop ≈ 2.8% of entry.
    const wideH1 = h1Series(N, 10, 0.1, 0.4);
    const now = nowInNextWindow(N);
    const H = wideH1[wideH1.length - 1].high;
    const ev = evaluatePrev4hRange({ symbol: 'RNG', h1: wideH1, currentPrice: H + 0.05, now, params: { calmRegimeScalp: true } });
    expect(ev.willExecute).toBe(true);
    const plan = readPrev4hRangePlan(ev)!;
    const entry = plan.entryRef;
    const dynSlPct = Math.abs(entry - plan.stopLoss) / entry * 100;
    expect(dynSlPct).toBeGreaterThanOrEqual(CALM_SL_THRESHOLD_PCT);
    expect(Math.abs(plan.takeProfit1 - entry) / entry * 100).not.toBeCloseTo(CALM_TP1_PCT, 1);
  });
});

// ── Bybit (evaluateTrendBreakout) ────────────────────────────────────────────

function ramp2(n: number, start: number, driftStep: number, spreadK: number, tf: number, volume = 1000): Candle[] {
  return Array.from({ length: n }, (_, i) => {
    const close = start + i * driftStep;
    return {
      timestamp: i * tf,
      open: i === 0 ? close : start + (i - 1) * driftStep,
      high: close + spreadK, low: close - spreadK, close, volume
    };
  });
}
const H1MS = 60 * 60 * 1000, M15MS = 15 * 60 * 1000, M5MS = 5 * 60 * 1000;

function bybitInput(spreadK: number, params: Record<string, unknown> = {}) {
  const h1 = ramp2(220, 100, 0.5, 0.6, H1MS);
  const m15 = ramp2(320, 150, 0.15, spreadK, M15MS);
  const prev = m15[m15.length - 2];
  const closeVal = prev.close + spreadK * 1.3 + 0.5;
  m15[m15.length - 1] = { timestamp: m15[m15.length - 1].timestamp, open: prev.close, high: closeVal + 0.2, low: prev.close - spreadK, close: closeVal, volume: 8000 };
  const m5 = ramp2(40, closeVal - 5, 0.13, 0.3, M5MS);
  return { symbol: 'TREND', h1, m15, m5, currentPrice: closeVal, params };
}

describe('Bybit — evaluateTrendBreakout calm branch', () => {
  it('quiet market (tight ATR(M15)): SL≈2.3%, TP1 <= 1.8% (never widened), TP2≈3.5%, still SIGNAL', () => {
    const ev = evaluateTrendBreakout(bybitInput(0.2, { calmRegimeScalp: true }));
    expect(ev.willExecute).toBe(true);
    const plan = readTrendBreakoutPlan(ev)!;
    const entry = plan.entryRef;
    expect(Math.abs(entry - plan.stopLoss) / entry * 100).toBeCloseTo(CALM_SL_PCT, 1);
    // Dynamic TP1 here (tp1FloorDistance) is ~1.5% — tighter than the fixed
    // 1.8, so it's correctly kept (never widened). See the Path test above.
    const tp1Pct = Math.abs(plan.takeProfit1 - entry) / entry * 100;
    expect(tp1Pct).toBeGreaterThan(0);
    expect(tp1Pct).toBeLessThanOrEqual(CALM_TP1_PCT + 1e-6);
    expect(Math.abs(plan.takeProfit2 - entry) / entry * 100).toBeCloseTo(CALM_TP2_PCT, 1);
  });

  it('quiet market, flag off: identical to today', () => {
    const ev = evaluateTrendBreakout(bybitInput(0.2, {}));
    expect(ev.willExecute).toBe(true);
    const plan = readTrendBreakoutPlan(ev)!;
    const entry = plan.entryRef;
    expect(Math.abs(entry - plan.stopLoss) / entry * 100).not.toBeCloseTo(CALM_SL_PCT, 1);
  });

  it('big move (wide ATR(M15), dynSl >= 2.3%): untouched — Bybit rarely enters calm branch by design', () => {
    const ev = evaluateTrendBreakout(bybitInput(1.0, { calmRegimeScalp: true }));
    expect(ev.willExecute).toBe(true);
    const plan = readTrendBreakoutPlan(ev)!;
    const entry = plan.entryRef;
    const dynSlPct = Math.abs(entry - plan.stopLoss) / entry * 100;
    expect(dynSlPct).toBeGreaterThanOrEqual(CALM_SL_THRESHOLD_PCT);
    expect(Math.abs(plan.takeProfit1 - entry) / entry * 100).not.toBeCloseTo(CALM_TP1_PCT, 1);
  });
});
