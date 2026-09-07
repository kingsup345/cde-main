/**
 * Simulation time-stop window — at least an hour, never past the max hold
 * ============================================================================
 * A run closed all 7 open positions in the same tick on
 *   "Time Stop: אחרי 20.3 דק' התקדמות -0.15R < 0.3R"
 * because MEAN_REVERSION's live budget (45 min) × timeStopFraction (0.45) puts
 * the stagnation checkpoint at 20.25 minutes — before a 5M-timed entry has had
 * a chance to resolve either way.
 *
 * SIM_INTRADAY_PARAMS_OVERRIDE now moves that checkpoint past an hour for every
 * setup type. Two invariants matter and one of them is easy to break by tuning
 * a single knob:
 *   1. timeStopMs >= 60 min for every setup,
 *   2. timeStopMs < maxHoldMs — MAX_DURATION closes the position at maxHoldMs
 *      regardless, so a time stop scheduled after it can never fire.
 * The live bot's DEFAULT_INTRADAY_PARAMS are deliberately NOT changed.
 */

import { describe, it, expect } from 'vitest';
import { DEFAULT_INTRADAY_PARAMS, evaluatePositionExit } from '@cde/engine';
import { SIM_INTRADAY_PARAMS_OVERRIDE } from '@cde/engine/execution';

const SIM_PARAMS = { ...DEFAULT_INTRADAY_PARAMS, ...SIM_INTRADAY_PARAMS_OVERRIDE };
const SETUPS = ['TREND_PULLBACK', 'BREAKOUT_RETEST', 'MEAN_REVERSION'] as const;
const HOUR_MS = 60 * 60_000;

describe('sim time-stop window', () => {
  for (const setup of SETUPS) {
    it(`${setup}: the stagnation checkpoint is at least an hour`, () => {
      const maxHoldMs = SIM_PARAMS.maxHoldMinutes[setup] * 60_000;
      const timeStopMs = Math.round(maxHoldMs * SIM_PARAMS.timeStopFraction);
      expect(timeStopMs).toBeGreaterThanOrEqual(HOUR_MS);
    });

    it(`${setup}: the checkpoint still lands before the hard max-hold budget`, () => {
      const maxHoldMs = SIM_PARAMS.maxHoldMinutes[setup] * 60_000;
      const timeStopMs = Math.round(maxHoldMs * SIM_PARAMS.timeStopFraction);
      expect(timeStopMs).toBeLessThan(maxHoldMs);
    });
  }

  it('the live bot keeps its own (shorter) budgets — this is a sim-only override', () => {
    expect(DEFAULT_INTRADAY_PARAMS.maxHoldMinutes.MEAN_REVERSION).toBe(45);
    expect(DEFAULT_INTRADAY_PARAMS.timeStopFraction).toBe(0.45);
  });

  it('the progress bar itself is unchanged — the complaint was the clock', () => {
    expect(SIM_PARAMS.timeStopMinProgressR).toBe(DEFAULT_INTRADAY_PARAMS.timeStopMinProgressR);
  });

  // Behavioural: the exact position the run reported — MEAN_REVERSION, slightly
  // underwater, 21 minutes in — is cut under live params and held under sim.
  // maxHoldMs/timeStopMs are stamped onto the position at entry by
  // buildRiskPlan — passed explicitly here because evaluateIntradayExit's
  // fallback when they are absent is TREND_PULLBACK's budget for every setup,
  // which is not the path a real position takes.
  const stagnantPosition = (heldMinutes: number, params: typeof SIM_PARAMS) => {
    const maxHoldMs = params.maxHoldMinutes.MEAN_REVERSION * 60_000;
    return {
      symbol: 'NEARUSDT',
      type: 'SPOT' as const,
      side: 'BUY' as const,
      entryPrice: 100,
      quantity: 1,
      stopLoss: 98.2,
      takeProfit1: 103,
      openTimestamp: Date.now() - heldMinutes * 60_000,
      plannedStopDistance: 1.8,
      setupType: 'MEAN_REVERSION' as const,
      maxHoldMs,
      timeStopMs: Math.round(maxHoldMs * params.timeStopFraction)
    };
  };
  const portfolio = { dailyDrawdownPercent: 0, weeklyDrawdownPercent: 0 };

  it('a 21-minute stagnant MEAN_REVERSION position is no longer time-stopped in sim', () => {
    const decision = evaluatePositionExit(
      stagnantPosition(21, SIM_PARAMS),
      99.73, // -0.15R, exactly the reported progress
      0.5,
      portfolio,
      undefined,
      SIM_PARAMS
    );
    expect(decision.reasonCode).not.toBe('TIME_STOP');
    expect(decision.shouldExit).toBe(false);
  });

  it('the same position IS time-stopped under the live params (the old behaviour)', () => {
    const decision = evaluatePositionExit(
      stagnantPosition(21, DEFAULT_INTRADAY_PARAMS),
      99.73,
      0.5,
      portfolio,
      undefined,
      DEFAULT_INTRADAY_PARAMS
    );
    expect(decision.reasonCode).toBe('TIME_STOP');
  });

  it('sim still cuts a position that is still stagnant past its own checkpoint', () => {
    const decision = evaluatePositionExit(
      stagnantPosition(70, SIM_PARAMS),
      99.73,
      0.5,
      portfolio,
      undefined,
      SIM_PARAMS
    );
    expect(decision.reasonCode).toBe('TIME_STOP');
  });
});
