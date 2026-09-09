/**
 * Intraday "מנוע חדש · Multi-Timeframe" — losing-trade fixes (2026-09-10)
 * ============================================================================
 * Five findings, all addressed here:
 *
 *  1. Cost/edge gate priced every trade as a resting LIMIT fill while the sim
 *     actually fills MARKET → systematically optimistic round-trip cost.
 *     `entryIsLimit` is now threaded DecisionContext → adapter → engine; a
 *     market fill raises totalCostPercent and lowers netRewardRisk.
 *  2. REVERSAL exit had NO P&L guard (the guard the comment described was dead
 *     code) → a confirmed opposite setup closed the position at ANY loss.
 *     Now it acts only when in profit past tp1RewardRisk OR past reversalMaxLossR.
 *  4. Post-TP1 trail width is capped at `trailingMaxRMult × stopDistance` so the
 *     runner can reach TP2 on symbols where atr5 > the (structural) stop.
 *  5. The early time-stop checkpoint skips a trade that once printed a real MFE
 *     (>= timeStopStagnantMfeR) — "working, just slowly" keeps the full budget.
 */

import { describe, it, expect } from 'vitest';
import { evaluateIntradayExit, evaluateIntradayDecision } from '@cde/engine/analysis';
import { DEFAULT_INTRADAY_PARAMS, type Candle } from '@cde/engine';

// ── #1 — a SIGNAL universe, then the cost gate with each fill mode ───────────

const TF = { '1h': 3_600_000, '15m': 900_000, '5m': 300_000 } as const;

function candlesFromCloses(closes: number[], tfMs: number, now: number, vol = 1000): Candle[] {
  return closes.map((close, i) => {
    const open = i > 0 ? closes[i - 1] : close;
    return {
      timestamp: now - (closes.length - i) * tfMs,
      open,
      high: Math.max(open, close) * 1.0006 + 0.001,
      low: Math.min(open, close) * 0.9994 - 0.001,
      close,
      volume: vol
    };
  });
}
function trendPath(count: number, start: number, end: number, pbDepth = 0, pbLen = 0): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    if (pbLen > 0 && i >= count - pbLen) {
      const k = (i - (count - pbLen)) / (pbLen - 1);
      out.push(end + pbDepth * (1 - k));
    } else {
      out.push(start + (end - start) * (i / (count - 1)));
    }
  }
  return out;
}
function bullScenario(now = Date.now()) {
  const h1 = candlesFromCloses(trendPath(240, 90, 105), TF['1h'], now);
  const m15 = candlesFromCloses(trendPath(320, 90, 105, 1.0, 22), TF['15m'], now);
  const m5Closes: number[] = [];
  for (let i = 0; i < 508; i++) m5Closes.push(90 + (105.0 - 90) * (i / 507));
  m5Closes.push(104.8, 104.3, 104.1, 104.2, 104.4, 104.3, 104.5, 104.4, 104.6, 104.5, 104.7, 104.8);
  const m5 = candlesFromCloses(m5Closes, TF['5m'], now);
  const last = m5[m5.length - 1];
  const prevClose = m5Closes[m5Closes.length - 2];
  last.open = prevClose;
  last.close = m5Closes[m5Closes.length - 1];
  last.low = Math.min(prevClose, last.close) - 0.05;
  last.high = Math.max(prevClose, last.close) + 0.05;
  return { h1, m15, m5 };
}
const basePortfolio = () => ({
  portfolioValue: 10_000, initialAmount: 10_000, dailyDrawdownPercent: 0, weeklyDrawdownPercent: 0,
  openPositionsCount: 0, openFuturesPositionsCount: 0, totalLeveragedExposureUsd: 0, existingExposureByAsset: {}
});

describe('#1 — the cost gate prices the fill mode it is told', () => {
  const { h1, m15, m5 } = bullScenario();
  const run = (entryIsLimit: boolean) => evaluateIntradayDecision({
    symbol: 'BTCUSDT', h1, m15, m5, spreadPercent: 0.02, quoteVolume24h: 1e12,
    portfolio: basePortfolio(), openPositions: [], entryIsLimit
  });

  it('a MARKET entry costs more than a resting LIMIT entry — and nets a worse R:R', () => {
    const limit = run(true);
    const market = run(false);
    expect(limit.cost).toBeTruthy();
    expect(market.cost).toBeTruthy();
    expect(market.cost!.totalCostPercent).toBeGreaterThan(limit.cost!.totalCostPercent);
    expect(market.cost!.netRewardRisk).toBeLessThan(limit.cost!.netRewardRisk);
  });

  it('the limit-priced baseline still fires a SIGNAL (sanity)', () => {
    expect(run(true).outcome).toBe('SIGNAL');
  });

  it('default (omitted) keeps the LIMIT assumption — live bot / backtest unchanged', () => {
    const omitted = evaluateIntradayDecision({
      symbol: 'BTCUSDT', h1, m15, m5, spreadPercent: 0.02, quoteVolume24h: 1e12,
      portfolio: basePortfolio(), openPositions: []
    });
    expect(omitted.cost!.totalCostPercent).toBeCloseTo(run(true).cost!.totalCostPercent, 6);
  });
});

// ── #2 / #4 / #5 — exit-engine behaviour ────────────────────────────────────

const NOW = 1_700_000_000_000;
const MIN = 60_000;

type ExitPos = Parameters<typeof evaluateIntradayExit>[0];
function pos(over: Partial<ExitPos> = {}): ExitPos {
  return {
    symbol: 'BTCUSDT', type: 'SPOT', side: 'LONG',
    entryPrice: 100, quantity: 1, stopLoss: 98,
    takeProfit1: 103, takeProfit2: 105, tp1Hit: false,
    openTimestamp: NOW - 5 * MIN, plannedStopDistance: 2,
    setupType: 'TREND_PULLBACK',
    maxHoldMs: 120 * MIN,
    ...over
  };
}
const exitCtx = (price: number, extra: Record<string, unknown> = {}) => ({
  price, now: NOW, atr5: 1, params: DEFAULT_INTRADAY_PARAMS,
  portfolio: { dailyDrawdownPercent: 0, weeklyDrawdownPercent: 0 },
  ...extra
});
const confirmedShort = { direction: 'SHORT' as const, setupScore: 75, entryConfirmed: true };

describe('#2 — REVERSAL exit only acts outside the dead zone', () => {
  it('dead zone (−0.3R): a confirmed opposite setup does NOT close the position', () => {
    const d = evaluateIntradayExit(pos(), exitCtx(99.4, { reversalSignal: confirmedShort }));
    expect(d.reasonCode).not.toBe('REVERSAL');
    expect(d.shouldExit).toBe(false);
  });

  it('in profit past tp1RewardRisk (+1.75R): the confirmed reversal closes it', () => {
    const d = evaluateIntradayExit(
      pos({ tp1Hit: true, highestPrice: 103.5 }),
      exitCtx(103.5, { reversalSignal: confirmedShort })
    );
    expect(d.reasonCode).toBe('REVERSAL');
  });

  it('thesis broken (−0.7R, still above the stop): the confirmed reversal cuts it early', () => {
    const d = evaluateIntradayExit(pos(), exitCtx(98.6, { reversalSignal: confirmedShort }));
    expect(d.reasonCode).toBe('REVERSAL');
  });

  it('a weak opposite setup (score < 70) is ignored even when in profit', () => {
    const d = evaluateIntradayExit(
      pos({ tp1Hit: true, highestPrice: 103.5 }),
      exitCtx(103.5, { reversalSignal: { direction: 'SHORT', setupScore: 60, entryConfirmed: true } })
    );
    expect(d.reasonCode).not.toBe('REVERSAL');
  });
});

describe('#4 — post-TP1 trail width is capped at 1R of the stop', () => {
  it('atr5 (5) ≫ stopDistance (1): the trail sits 1R below the peak, not 1.8×atr5', () => {
    const d = evaluateIntradayExit(
      pos({ entryPrice: 100, stopLoss: 99, plannedStopDistance: 1, takeProfit1: 101.5, takeProfit2: 102.5, tp1Hit: true, highestPrice: 103 }),
      { price: 101.9, now: NOW, atr5: 5, params: DEFAULT_INTRADAY_PARAMS, portfolio: { dailyDrawdownPercent: 0, weeklyDrawdownPercent: 0 } }
    );
    expect(d.reasonCode).toBe('TRAILING_STOP');
    // peak 103 − min(1.8×5, 1.0×1) = 103 − 1 = 102  (old formula: 103 − 9 = 94, never hit)
    expect(d.trailingStopPrice).toBeCloseTo(102, 6);
  });
});

describe('#5 — the early time-stop skips a trade that once printed a real MFE', () => {
  // 54 min = 45% of the 120-min budget → at the DEFAULT checkpoint.
  it('genuinely stagnant (progress 0.1R, MFE 0.1R) is still cut', () => {
    const d = evaluateIntradayExit(pos({ openTimestamp: NOW - 60 * MIN }), exitCtx(100.2));
    expect(d.reasonCode).toBe('TIME_STOP');
  });

  it('"working slowly" (progress 0.1R now, but MFE was 0.8R) keeps the full budget', () => {
    const d = evaluateIntradayExit(
      pos({ openTimestamp: NOW - 60 * MIN, highestPrice: 101.6 }), // (101.6−100)/2 = 0.8R MFE
      exitCtx(100.2)
    );
    expect(d.reasonCode).not.toBe('TIME_STOP');
    expect(d.shouldExit).toBe(false);
  });
});
