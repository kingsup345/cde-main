/**
 * RISK_VS_COST gate + MEAN_REVERSION stop floor
 * ============================================================================
 * Two linked fixes for the same pathology (report F1/F2):
 *
 *   · buildRiskPlan takes the TIGHTER of the ATR and structure stop, floored at
 *     minStopPercent (0.12%). A MEAN_REVERSION setup's stopReference is the
 *     swing over just the last 6 5M candles in a RANGING regime, so the
 *     structural branch nearly always wins and the stop floors at 0.12% —
 *     smaller than the ~0.4% round-trip cost, which makes every exit a loss.
 *
 *   · netRewardRisk = (reward - cost) / risk divides BY the risk, so a smaller
 *     stop makes that score BETTER. The reward-side gates are structurally
 *     blind to a stop too tight to survive its own round trip.
 *
 * Fix 1: meanReversionMinStopAtrMult / meanReversionMinStopPercent widen the MR
 *        stop in buildRiskPlan (were declared + set in SIM_INTRADAY_PARAMS_
 *        OVERRIDE but read nowhere).
 * Fix 2: evaluateCostEdge rejects riskPercent < minStopCostMultiple × cost with
 *        blockGate 'RISK_VS_COST'.
 */

import { describe, it, expect } from 'vitest';
import { buildRiskPlan, evaluateCostEdge, type RiskPlanInput } from '@cde/engine/analysis';
import { DEFAULT_INTRADAY_PARAMS, withParams } from '@cde/engine';

const baseRiskInput: Omit<RiskPlanInput, 'entryPrice' | 'atr5' | 'atr15' | 'equity'> = {
  symbol: 'RNG',
  direction: 'LONG',
  tradeType: 'SPOT',
  setupType: 'MEAN_REVERSION',
  openPositions: 0,
  openFutures: 0,
  currentLeveragedExposureUsd: 0,
  existingExposureByAsset: {}
};

describe('RISK_VS_COST gate (evaluateCostEdge)', () => {
  it('rejects a stop smaller than minStopCostMultiple × round-trip cost', () => {
    const entry = 100;
    // 0.15% stop, 3% target — sails past minRewardRisk, but the round trip
    // (~0.27% modelled) is nearly twice the stop.
    const cost = evaluateCostEdge({
      tradeType: 'SPOT',
      entryPrice: entry,
      stopLoss: entry * (1 - 0.0015),
      takeProfit1: entry * (1 + 0.03),
      spreadPercent: 0.02,
      atrPercentile: 40,
      entryIsLimit: true,
      params: DEFAULT_INTRADAY_PARAMS
    });
    expect(cost.approved).toBe(false);
    expect(cost.blockGate).toBe('RISK_VS_COST');
    expect(cost.netRewardRisk).toBeGreaterThan(DEFAULT_INTRADAY_PARAMS.minRewardRisk); // reward-side gate was blind to it
  });

  it('approves the same trade once the stop clears the cost multiple', () => {
    const entry = 100;
    const cost = evaluateCostEdge({
      tradeType: 'SPOT',
      entryPrice: entry,
      stopLoss: entry * (1 - 0.012), // 1.2% stop
      takeProfit1: entry * (1 + 0.03),
      spreadPercent: 0.02,
      atrPercentile: 40,
      entryIsLimit: true,
      params: DEFAULT_INTRADAY_PARAMS
    });
    expect(cost.blockGate).not.toBe('RISK_VS_COST');
    expect(cost.approved).toBe(true);
  });

  it('minStopCostMultiple is configurable', () => {
    const entry = 100;
    const args = {
      tradeType: 'SPOT' as const,
      entryPrice: entry,
      stopLoss: entry * (1 - 0.008), // 0.8% stop
      takeProfit1: entry * (1 + 0.03),
      spreadPercent: 0.02,
      atrPercentile: 40,
      entryIsLimit: true
    };
    // 0.8% stop passes at 2.0× (~0.27% cost) but fails at 4.0×.
    expect(evaluateCostEdge({ ...args, params: withParams({ minStopCostMultiple: 2.0 }) }).blockGate).not.toBe('RISK_VS_COST');
    expect(evaluateCostEdge({ ...args, params: withParams({ minStopCostMultiple: 4.0 }) }).blockGate).toBe('RISK_VS_COST');
  });
});

describe('MEAN_REVERSION stop floor (buildRiskPlan)', () => {
  const entry = 100;
  // Tight structural stop: 6-candle swing just below entry in a low-ATR
  // RANGING tape → the structure branch wins and the stop lands well under the
  // round-trip cost without the MR floor.
  const tightStructure = { entryPrice: entry, stopReference: entry * (1 - 0.002), atr5: entry * 0.0025, atr15: entry * 0.003, equity: 10_000 };
  const unknobbed = buildRiskPlan({ ...baseRiskInput, ...tightStructure, params: withParams({}) });

  it('without the MR knobs, the stop lands below 0.4% (tighter than the round trip)', () => {
    expect(unknobbed.approved).toBe(true);
    expect(unknobbed.stopDistancePercent).toBeLessThan(0.4);
  });

  it('meanReversionMinStopPercent widens the stop', () => {
    const plan = buildRiskPlan({
      ...baseRiskInput, ...tightStructure,
      params: withParams({ meanReversionMinStopPercent: 0.25 })
    });
    expect(plan.approved).toBe(true);
    expect(plan.stopDistancePercent).toBeGreaterThanOrEqual(0.25);
  });

  it('meanReversionMinStopAtrMult widens the stop', () => {
    // 1.6 × atr5(0.25%) = 0.40% floor
    const plan = buildRiskPlan({
      ...baseRiskInput, ...tightStructure,
      params: withParams({ meanReversionMinStopAtrMult: 1.6 })
    });
    expect(plan.approved).toBe(true);
    expect(plan.stopDistancePercent).toBeGreaterThanOrEqual(0.39);
  });

  it('the MR floor never breaches maxStopPercent', () => {
    const plan = buildRiskPlan({
      ...baseRiskInput,
      entryPrice: entry, stopReference: entry * (1 - 0.002),
      atr5: entry * 0.05, atr15: entry * 0.05, equity: 10_000, // huge ATR
      params: withParams({ meanReversionMinStopAtrMult: 1.6, meanReversionMinStopPercent: 0.25 })
    });
    if (plan.approved) {
      expect(plan.stopDistancePercent).toBeLessThanOrEqual(DEFAULT_INTRADAY_PARAMS.maxStopPercent + 1e-6);
    }
  });

  it('only MEAN_REVERSION is affected — TREND_PULLBACK ignores the knobs', () => {
    const plan = buildRiskPlan({
      ...baseRiskInput, ...tightStructure,
      setupType: 'TREND_PULLBACK',
      params: withParams({ meanReversionMinStopPercent: 0.25, meanReversionMinStopAtrMult: 1.6 })
    });
    expect(plan.approved).toBe(true);
    expect(plan.stopDistancePercent).toBeCloseTo(unknobbed.stopDistancePercent, 5);
  });
});

describe('MEAN_REVERSION is exempt from the TP1 floor (F6)', () => {
  const entry = 100;
  // Tight SL (~0.65%) so 1.5×stop < 1.5%, plus a near VWAP target (1.2% away).
  // Non-MR then gets the 1.5% absolute floor term of tp1FloorDistance; MR is
  // exempt and rides the 1.2% structural (VWAP) target.
  const near = {
    entryPrice: entry,
    atr5: entry * 0.003, atr15: entry * 0.003, equity: 10_000,
    stopReference: entry * (1 - 0.006),
    targetReference: entry * (1 + 0.012)
  };

  it('MR TP1 tracks the structural / ATR target, below the non-MR floor', () => {
    const plan = buildRiskPlan({
      ...baseRiskInput, ...near,
      params: withParams({ meanReversionMinStopPercent: 0.25 })
    });
    expect(plan.approved).toBe(true);
    expect(plan.rewardPercent).toBeLessThan(1.5);
    expect(plan.grossRewardRisk).toBeGreaterThanOrEqual(DEFAULT_INTRADAY_PARAMS.tp1RewardRisk - 0.01);
  });

  it('the same inputs as TREND_PULLBACK carry the stop-relative floor (>= 1.5%)', () => {
    const mr = buildRiskPlan({ ...baseRiskInput, ...near, params: withParams({ meanReversionMinStopPercent: 0.25 }) });
    const tp = buildRiskPlan({ ...baseRiskInput, ...near, setupType: 'TREND_PULLBACK', params: withParams({}) });
    expect(tp.approved).toBe(true);
    expect(tp.rewardPercent).toBeGreaterThanOrEqual(1.5 - 0.01);
    expect(tp.rewardPercent).toBeGreaterThan(mr.rewardPercent); // non-MR floored higher than MR's VWAP target
  });
});
