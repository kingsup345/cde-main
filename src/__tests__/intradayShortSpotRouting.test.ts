/**
 * SPOT cannot express a SHORT (§19) — routing guard
 * ============================================================================
 * Observed live 2026-09-11 on PUMP / LIT / XRP, all three with the same log:
 *
 *   [PUMP] 1H=TRANSITIONAL bias=NONE ADX=50.9 futuresAllowed=false
 *   [PUMP] TRANSITIONAL — Futures חסום; Spot רק עבור Setup איכותי במיוחד
 *   [PUMP] 15M=MEAN_REVERSION dir=SHORT SetupScore=58.6
 *   [PUMP] TRANSITIONAL — Spot מאושר (SS=58.6 ES=72.5)      ← routed to SPOT
 *   [PUMP] RISK — SL חייב להיות מעל מחיר הכניסה ב-SHORT     ← died here
 *
 * Three branches in `evaluateIntradayDecision` force `tradeType = 'SPOT'`
 * without consulting the setup's DIRECTION (the no-futures default, the
 * EXTREME-volatility override, and the TRANSITIONAL/SOFT_TREND quality gate).
 * A SHORT landing in any of them reached `buildRiskPlan`, whose level formula
 * keys off `tradeType === 'SPOT' || isLong` and so built LONG-shaped levels
 * (stop BELOW entry) for a SHORT — only caught three steps later by
 * `validateLevelDirection`, surfacing as an unreadable RISK rejection.
 *
 * The guard refuses it at the routing step, by name, as NO_REGIME.
 */

import { describe, it, expect } from 'vitest';
import { evaluateIntradayDecision, buildRiskPlan } from '@cde/engine/analysis';
import type { Candle } from '@cde/engine';

const TF = { '1h': 3_600_000, '15m': 900_000, '5m': 300_000 } as const;

function candlesFromCloses(closes: number[], tfMs: number, now: number, wide = 1): Candle[] {
  return closes.map((c, i) => {
    const prev = i > 0 ? closes[i - 1] : c;
    return {
      timestamp: now - (closes.length - i) * tfMs,
      open: prev,
      close: c,
      high: Math.max(prev, c) * (1 + 0.0006 * wide) + 0.001,
      low: Math.min(prev, c) * (1 - 0.0006 * wide) - 0.001,
      volume: 1000
    };
  });
}

const bearPath = (n: number, start: number, end: number, amp = 0) =>
  Array.from({ length: n }, (_, i) => start + (end - start) * (i / (n - 1)) + Math.sin(i * 0.9) * amp);

const basePortfolio = {
  portfolioValue: 10_000,
  initialAmount: 10_000,
  dailyDrawdownPercent: 0,
  weeklyDrawdownPercent: 0,
  openPositionsCount: 0,
  openFuturesPositionsCount: 0,
  totalLeveragedExposureUsd: 0,
  existingExposureByAsset: {}
};

/** A falling market — the setup detector reads SHORT off these. `wide` inflates
 *  candle range, which drives ATR / the volatility class and therefore whether
 *  FUTURES is allowed at all. */
function bearDecision(wide: number, amp: number) {
  const now = Date.now();
  return evaluateIntradayDecision({
    symbol: 'BEARCOIN',
    h1: candlesFromCloses(bearPath(240, 110, 90, amp), TF['1h'], now, wide),
    m15: candlesFromCloses(bearPath(320, 110, 90, amp * 0.5), TF['15m'], now, wide),
    m5: candlesFromCloses(bearPath(520, 110, 90, amp * 0.3), TF['5m'], now, wide),
    spreadPercent: 0.02,
    quoteVolume24h: 1e12,
    quoteVolume24hSpot: 1e12,
    portfolio: basePortfolio,
    openPositions: []
  });
}

const CASES: Array<[number, number]> = [[1, 0], [8, 0.6], [20, 2.0], [40, 5.0], [80, 9.0]];

/**
 * HONEST SCOPE: these synthetic falling markets all currently die at
 * NO_SETUP / NO_ENTRY, so they do NOT exercise the routing branch — they are a
 * standing INVARIANT sweep, not proof the guard fires. What proves the guard is
 * needed is (a) the live worker observation in the header, and (b) the
 * buildRiskPlan pair below, which shows the contradiction the guard prevents.
 * Leaving the sweep in place means a future fixture (or a looser setup
 * detector) that does reach the routing cannot regress silently.
 */
describe('invariant sweep — a SHORT must never reach a SPOT risk plan', () => {
  it('no falling-market decision ever SIGNALs as SPOT + SHORT', () => {
    for (const [wide, amp] of CASES) {
      const d = bearDecision(wide, amp);
      expect(d.tradeType === 'SPOT' && d.direction === 'SHORT' && d.outcome === 'SIGNAL').toBe(false);
    }
  });

  it('the level-direction validator never surfaces as the rejection', () => {
    // That message means a contradictory plan was BUILT. The routing guard has
    // to catch it first, so this string must never reach the operator.
    for (const [wide, amp] of CASES) {
      const logs = (bearDecision(wide, amp).logs ?? []).join('\n');
      expect(logs).not.toContain('SL חייב להיות מעל מחיר הכניסה');
      expect(logs).not.toContain('SL חייב להיות מתחת למחיר הכניסה');
    }
  });
});

describe('why the guard exists — buildRiskPlan cannot express SHORT on SPOT', () => {
  it('a SHORT with tradeType SPOT is rejected, with the stop on the wrong side', () => {
    const plan = buildRiskPlan({
      symbol: 'BEARCOIN',
      direction: 'SHORT',
      tradeType: 'SPOT', // the contradiction the routing used to produce
      setupType: 'TREND_PULLBACK',
      entryPrice: 100,
      atr5: 1,
      atr15: 1.2,
      equity: 10_000,
      openPositions: 0,
      openFutures: 0,
      currentLeveragedExposureUsd: 0,
      existingExposureByAsset: {}
    });
    expect(plan.approved).toBe(false);
    expect(plan.blockReason ?? '').toContain('SHORT');
  });

  it('the same SHORT on FUTURES is fine — stop ABOVE entry', () => {
    const plan = buildRiskPlan({
      symbol: 'BEARCOIN',
      direction: 'SHORT',
      tradeType: 'FUTURES',
      setupType: 'TREND_PULLBACK',
      entryPrice: 100,
      atr5: 1,
      atr15: 1.2,
      equity: 10_000,
      openPositions: 0,
      openFutures: 0,
      currentLeveragedExposureUsd: 0,
      existingExposureByAsset: {}
    });
    expect(plan.approved).toBe(true);
    expect(plan.stopLoss).toBeGreaterThan(plan.entryPrice);
    expect(plan.takeProfit1).toBeLessThan(plan.entryPrice);
  });
});
