import { describe, it, expect } from 'vitest';
import {
  buildRiskPlan,
  FIXED_TP_PERCENT
} from '@cde/engine/analysis';
import { DEFAULT_INTRADAY_PARAMS } from '@cde/engine';
import { evaluatePrev4hRange, readPrev4hRangePlan, DEFAULT_PREV4H_RANGE_PARAMS } from '@cde/engine/analysis';
import type { Candle, SignalEvaluation } from '@cde/engine';
import {
  generateTrendBreakoutOrders,
  resolveScaleFractions,
  MIN_ORDER_EXCEEDS_POSITION_TARGET,
  type TrendBreakoutOrderGenContext,
  type SimPosition
} from '@cde/engine/execution';
import { applyProEntryGates, type ProGateContext, calculateTradingFee, reanchorLevel } from '@cde/engine/execution';

// ─── Helpers ────────────────────────────────────────────────────────────────

function buyEval(symbol: string, confidence: number): SignalEvaluation {
  return {
    symbol,
    action: 'buy',
    tradeType: 'SPOT',
    tradeSide: 'BUY',
    confidence,
    price: 100,
    priceChange24h: 1,
    reasoning: 'test',
    status: '',
    willExecute: false,
    factors: [],
    confidenceGap: 0
  } as SignalEvaluation;
}

const gateCtx = (over: Partial<ProGateContext> = {}): ProGateContext => ({
  positions: [],
  pending: [],
  cash: 10_000,
  equity: 10_000,
  initialAmount: 10_000,
  maxPositions: 3,
  riskLevel: 'medium',
  ...over
});

const H1_MS = 60 * 60 * 1000;
const BAR_MS = 4 * H1_MS;
const H1_COUNT = 96;

/**
 * Builds 96 H1 candles whose LAST four form a single 4H bar with the given
 * high (H) and low (L). The first 92 candles ramp monotonically from
 * `startPrice` upward so the 4H EMA(20) trends up into the last bar.
 * `now` lands one hour into the H4 window following the last bar.
 */
function buildH1ForPrevBar(H: number, L: number, startPrice: number): { h1: Candle[]; now: number } {
  const h1: Candle[] = [];
  const step = (H - startPrice - 1) / (H1_COUNT - 4);

  for (let i = 0; i < H1_COUNT; i++) {
    const ts = i * H1_MS;
    if (i < H1_COUNT - 4) {
      const close = startPrice + i * step;
      h1.push({
        timestamp: ts,
        open: close - 0.1,
        high: close + 0.1,
        low: close - 0.1,
        close,
        volume: 1000
      });
    }
  }

  // Overwrite the last 4 H1 candles to form the target H4 bar.
  const last4Start = (H1_COUNT - 4) * H1_MS;
  const range = H - L;
  for (let i = 0; i < 4; i++) {
    const ts = last4Start + i * H1_MS;
    const close = L + range * (i + 1) / 4;
    h1.push({
      timestamp: ts,
      open: close - 0.05,
      high: H,
      low: L,
      close,
      volume: 1000
    });
  }

  const windowStart = last4Start + BAR_MS;
  return { h1, now: windowStart + H1_MS };
}

// ─── Requirement #26: Required Test Cases ───────────────────────────────────

describe('Position Sizing — 10% target model', () => {
  it('Test 1: Equity = $1,000 → Target Position = $100', () => {
    const plan = buildRiskPlan({
      symbol: 'BTC',
      direction: 'LONG',
      tradeType: 'SPOT',
      setupType: 'TREND_PULLBACK',
      entryPrice: 100,
      atr5: 1,
      atr15: 1.5,
      equity: 1_000,
      openPositions: 0,
      openFutures: 0,
      currentLeveragedExposureUsd: 0,
      params: { ...DEFAULT_INTRADAY_PARAMS, positionTargetPct: 0.10 }
    });
    expect(plan.approved).toBe(true);
    expect(plan.notionalUsd).toBeCloseTo(100, 2);
    expect(plan.positionPercentOfEquity).toBeCloseTo(10, 2);
  });

  it('Test 2: Equity = $10,000 → Target Position = $1,000', () => {
    const plan = buildRiskPlan({
      symbol: 'BTC',
      direction: 'LONG',
      tradeType: 'SPOT',
      setupType: 'TREND_PULLBACK',
      entryPrice: 100,
      atr5: 1,
      atr15: 1.5,
      equity: 10_000,
      openPositions: 0,
      openFutures: 0,
      currentLeveragedExposureUsd: 0,
      params: { ...DEFAULT_INTRADAY_PARAMS, positionTargetPct: 0.10 }
    });
    expect(plan.approved).toBe(true);
    expect(plan.notionalUsd).toBeCloseTo(1000, 2);
    expect(plan.positionPercentOfEquity).toBeCloseTo(10, 2);
  });

  it('Test 3: Equity = $500, Target = $50, Minimum = $100 → SKIP', () => {
    const plan = buildRiskPlan({
      symbol: 'BTC',
      direction: 'LONG',
      tradeType: 'SPOT',
      setupType: 'TREND_PULLBACK',
      entryPrice: 100,
      atr5: 1,
      atr15: 1.5,
      equity: 500,
      openPositions: 0,
      openFutures: 0,
      currentLeveragedExposureUsd: 0,
      params: { ...DEFAULT_INTRADAY_PARAMS, positionTargetPct: 0.10, minOrderUsd: 100 }
    });
    expect(plan.approved).toBe(false);
    expect(plan.blockReason).toContain('MIN_ORDER_EXCEEDS_POSITION_TARGET');
  });
});

describe('Confidence Threshold Enforcement', () => {
  it('Test 4: Confidence = 30, medium threshold = 40 → NO_SIGNAL', () => {
    const [ev] = applyProEntryGates([buyEval('BTC', 30)], gateCtx());
    expect(ev.willExecute).toBe(false);
    expect(ev.status).toContain('BELOW_THRESHOLD');
  });
});

describe('Prev4hRange TP ladder — stop-relative floor (tp1FloorDistance)', () => {
  // TP1 = max(range-midpoint target, tp1FloorDistance) where the floor is
  // max(1.5% of entry, 1.5× the stop). With the stop at the range midpoint the
  // 1.5×stop term dominates, so gross R:R lands at a clean 1.5 regardless of
  // breakout distance or range — no longer a flat 3%.
  const wideParams = { ...DEFAULT_PREV4H_RANGE_PARAMS, minH4Bars: 2, minRR: 0, minConfidence: 0, minRangePct: 0, maxRangePct: 1 };

  it('Test 5: near-touch breakout → TP1 = entry + 1.5×stop, R:R ≈ 1.5', () => {
    const { h1, now } = buildH1ForPrevBar(104, 100, 90);
    const ev = evaluatePrev4hRange({ symbol: 'TEST', h1, currentPrice: 104.0001, now, params: wideParams });
    const plan = readPrev4hRangePlan(ev);
    expect(plan).toBeDefined();
    expect(plan!.takeProfit1 - plan!.entryRef).toBeCloseTo(1.5 * plan!.riskPerUnit, 4);
    expect(plan!.takeProfit2 - plan!.entryRef).toBeCloseTo(1.5 * (plan!.takeProfit1 - plan!.entryRef), 4);
    expect(plan!.actualRR).toBeCloseTo(1.5, 3);
  });

  it('Test 6: extended breakout → SAME 1.5×stop floor (not range-scaled)', () => {
    const range = 4;
    const { h1, now } = buildH1ForPrevBar(104, 100, 90);
    const ev = evaluatePrev4hRange({ symbol: 'TEST', h1, currentPrice: 104 + range * 0.1, now, params: wideParams });
    const plan = readPrev4hRangePlan(ev);
    expect(plan).toBeDefined();
    expect(plan!.takeProfit1 - plan!.entryRef).toBeCloseTo(1.5 * plan!.riskPerUnit, 4);
    expect(plan!.actualRR).toBeCloseTo(1.5, 3);
  });

  it('Test 7: Entry=13.3119, mid-stop=13.0723 → R:R ≈ 1.5 (was 1.67 under the flat 3% floor)', () => {
    const { h1, now } = buildH1ForPrevBar(13.2853, 12.8593, 12.5);
    const ev = evaluatePrev4hRange({ symbol: 'TEST', h1, currentPrice: 13.3119, now, params: wideParams });
    const plan = readPrev4hRangePlan(ev);
    expect(plan).toBeDefined();
    expect(plan!.actualRR).toBeCloseTo(1.5, 2);
  });
});

describe('Scale-In Fractions', () => {
  it('Test 8: Equity=$20,000, Target=$2,000 → Scale 1=$1,000, Scale 2=$600, Scale 3=$400', () => {
    // Equity high enough that all three nominal lots clear the $100 order floor,
    // so resolveScaleFractions passes 5/3/2 through untouched. (At $1,000 equity
    // the target is $100 and the nominal $50 first lot is below the floor — see
    // the resolveScaleFractions cases below for what happens there.)
    const equity = 20_000;
    const targetNotional = equity * 0.10;
    const fractions = resolveScaleFractions(targetNotional, [0.5, 0.3, 0.2]);
    expect(fractions).toEqual([0.5, 0.3, 0.2]);
    const scales = fractions.map(f => targetNotional * f);
    expect(scales[0]).toBeCloseTo(1_000, 2);
    expect(scales[1]).toBeCloseTo(600, 2);
    expect(scales[2]).toBeCloseTo(400, 2);
    expect(scales.reduce((a, b) => a + b, 0)).toBeCloseTo(targetNotional, 2);
  });

  it('Test 8b: SCALE_2 via generateTrendBreakoutOrders — notional = 3% of equity', () => {
    const equity = 5_000; // high enough that 3% ($150) > MIN_SIM_ENTRY_USD ($100)
    const entry = 100;
    const stopLoss = 99;
    const scale1Pos: SimPosition = {
      id: 'lot1',
      symbol: 'BTC',
      side: 'LONG',
      type: 'SPOT',
      quantity: 0.5,
      entryPrice: entry,
      currentPrice: entry,
      stopLoss,
      takeProfit: 102,
      takeProfit1: 102,
      confidence: 80,
      openTimestamp: Date.now() - 1000,
      highestPrice: entry,
      lowestPrice: entry,
      avgPrice: entry,
      leverage: 1,
      marginUsd: 0,
      notionalUsd: 0,
      tp1Hit: false,
      openedAt: '',
      reason: 'test',
      entryFee: 0
    };

    const ctx: TrendBreakoutOrderGenContext = {
      positions: [scale1Pos],
      pending: [],
      evaluations: [],
      executionDelaySec: 0,
      dailyDrawdownPercent: 0,
      weeklyDrawdownPercent: 0,
      cash: 10_000,
      equity,
      totalLeveragedExposureUsd: 50,
      exitCooldown: {},
      priceFor: (s: string) => s === 'BTC' ? 100.5 : undefined,
      candlesBySymbol: {},
      maxConcurrentTrades: 2,
      params: { scale2MinR: 0.5, scale3MinR: 1.0 }
    };

    const orders = generateTrendBreakoutOrders(ctx);
    const scale2 = orders.find(o => o.reason?.includes('scale 2'));
    expect(scale2).toBeDefined();
    expect(scale2!.budgetUsd).toBeCloseTo(150, 0); // 3% of $5,000
  });

  it('Test 8c: SCALE_3 via generateTrendBreakoutOrders — notional = 2% of equity', () => {
    const equity = 5_000; // 2% of $5,000 = $100 >= MIN_SIM_ENTRY_USD
    const entry = 100;
    const stopLoss = 99;
    const scale1Pos: SimPosition = {
      id: 'lot1',
      symbol: 'BTC',
      side: 'LONG',
      type: 'SPOT',
      quantity: 0.5,
      entryPrice: entry,
      currentPrice: entry,
      stopLoss,
      takeProfit: 102,
      takeProfit1: 102,
      confidence: 80,
      openTimestamp: Date.now() - 2000,
      highestPrice: entry,
      lowestPrice: entry,
      avgPrice: entry,
      leverage: 1,
      marginUsd: 0,
      notionalUsd: 0,
      tp1Hit: false,
      openedAt: '',
      reason: 'test',
      entryFee: 0
    };
    const scale2Pos: SimPosition = {
      id: 'lot2',
      symbol: 'BTC',
      side: 'LONG',
      type: 'SPOT',
      quantity: 0.3,
      entryPrice: entry,
      currentPrice: entry,
      stopLoss,
      takeProfit: 102,
      takeProfit1: 102,
      confidence: 80,
      openTimestamp: Date.now() - 1000,
      highestPrice: entry,
      lowestPrice: entry,
      avgPrice: entry,
      leverage: 1,
      marginUsd: 0,
      notionalUsd: 0,
      tp1Hit: false,
      openedAt: '',
      reason: 'test',
      entryFee: 0
    };

    const ctx: TrendBreakoutOrderGenContext = {
      positions: [scale1Pos, scale2Pos],
      pending: [],
      evaluations: [],
      executionDelaySec: 0,
      dailyDrawdownPercent: 0,
      weeklyDrawdownPercent: 0,
      cash: 10_000,
      equity,
      totalLeveragedExposureUsd: 80,
      exitCooldown: {},
      priceFor: (s: string) => s === 'BTC' ? 101 : undefined,
      candlesBySymbol: {},
      maxConcurrentTrades: 2,
      params: { scale3MinR: 1.0 }
    };

    const orders = generateTrendBreakoutOrders(ctx);
    const scale3 = orders.find(o => o.reason?.includes('scale 3'));
    expect(scale3).toBeDefined();
    expect(scale3!.budgetUsd).toBeCloseTo(100, 0); // 2% of $5,000 = $100
  });
});

describe('Market Fill Drift Recalculation', () => {
  it('Test 9: Signal Price = 100, Actual Fill = 101 → recalculate RR, fees, slippage', () => {
    const signalPrice = 100;
    const actualFill = 101;
    const sl = 98;
    const tp = 104;
    const notional = 1000;

    // Re-anchor levels using the engine's reanchorLevel (preserves signed offset)
    const reanchoredSL = reanchorLevel(actualFill, signalPrice, sl);
    const reanchoredTP = reanchorLevel(actualFill, signalPrice, tp);

    // Signal-side RR
    const signalRisk = Math.abs(signalPrice - sl);
    const signalReward = Math.abs(tp - signalPrice);
    const signalRR = signalReward / signalRisk;

    // Actual RR from re-anchored levels (offsets preserved → RR unchanged)
    const actualRisk = Math.abs(actualFill - reanchoredSL!);
    const actualReward = Math.abs(reanchoredTP! - actualFill);
    const actualRR = actualReward / actualRisk;

    // Slippage: |fill - signal| × (notional / signal_price)
    const slippage = Math.abs(actualFill - signalPrice) * (notional / signalPrice);

    // Fee (0.1% spot taker)
    const fee = calculateTradingFee(notional, 'SPOT', true);

    expect(signalRR).toBeCloseTo(2.0, 2); // 4/2 = 2.0
    expect(actualRR).toBeCloseTo(2.0, 2); // re-anchored preserves RR
    expect(slippage).toBeCloseTo(10, 2);
    expect(fee).toBeCloseTo(1, 2);
  });
});

describe('Pro Engine — 10% Fixed Allocation', () => {
  it('confidence does not affect allocation — always 10% of equity', () => {
    const [ev70] = applyProEntryGates([buyEval('LA', 70)], gateCtx());
    const [ev90] = applyProEntryGates([buyEval('LA', 90)], gateCtx());
    expect(ev70.budgetUsd).toBeCloseTo(1000, 2);
    expect(ev90.budgetUsd).toBeCloseTo(1000, 2);
    expect(ev70.budgetUsd).toBe(ev90.budgetUsd);
  });
});

/**
 * The bot that could never open a position
 * ============================================================================
 * TrendBreakout is the only one of the four sim bots with scale-in, so it was
 * the only one whose FIRST lot was a fraction (50%) of the 10% target. At the
 * $1,000 equity all four bots actually run on that is $50 against a $100 order
 * floor, and the entry was dropped by a bare `continue` — a 93%-confidence
 * SIGNAL SPOT LONG rendered green in the panel with no position and no reason
 * anywhere. Empirically: intraday 4 positions, pro 2, path 2, bybit 0.
 *
 * MIN_ORDER is still a constraint, never a sizing input — the 10% target is not
 * inflated. What adapts is how the target is SPLIT.
 */
describe('TrendBreakout — MIN_ORDER splits the target instead of killing the trade', () => {
  const target = (equity: number) => equity * 0.10;

  it('leaves 5/3/2 untouched when every lot clears the $100 floor', () => {
    expect(resolveScaleFractions(target(20_000), [0.5, 0.3, 0.2])).toEqual([0.5, 0.3, 0.2]);
  });

  it('collapses to a single full-size lot at $1,000 equity (the observed case)', () => {
    const fractions = resolveScaleFractions(target(1_000), [0.5, 0.3, 0.2]);
    expect(fractions).toEqual([1]);
    expect(target(1_000) * fractions[0]).toBeCloseTo(100, 6);
  });

  it('merges only the lots that fall short — $2,500 equity gives two $125 lots', () => {
    const fractions = resolveScaleFractions(target(2_500), [0.5, 0.3, 0.2]);
    expect(fractions).toEqual([0.5, 0.5]);
    expect(fractions.map(f => target(2_500) * f)).toEqual([125, 125]);
  });

  it('never sizes above the 10% target — fractions always sum to exactly 1', () => {
    for (const equity of [1_000, 1_500, 2_000, 2_500, 5_000, 20_000]) {
      const fractions = resolveScaleFractions(target(equity), [0.5, 0.3, 0.2]);
      expect(fractions.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    }
  });

  it('still refuses when even the whole target is under the floor', () => {
    expect(resolveScaleFractions(target(800), [0.5, 0.3, 0.2])).toEqual([]);
  });

  const signalEval = (): SignalEvaluation => ({
    symbol: 'NEAR',
    action: 'buy',
    tradeType: 'SPOT',
    tradeSide: 'BUY',
    confidence: 93,
    price: 4.795,
    priceChange24h: 5.06,
    reasoning: 'TrendBreakout LONG',
    status: 'SIGNAL SPOT LONG',
    willExecute: true,
    factors: [],
    confidenceGap: 0,
    decision: {
      direction: 'LONG',
      entryRef: 4.795,
      stopLoss: 4.716713,
      takeProfit: 4.951575,
      riskPerUnit: 0.078287
    } as never
  });

  const ctxFor = (equity: number, ev: SignalEvaluation): TrendBreakoutOrderGenContext => ({
    positions: [],
    pending: [],
    evaluations: [ev],
    executionDelaySec: 0,
    dailyDrawdownPercent: 0,
    weeklyDrawdownPercent: 0,
    cash: equity,
    equity,
    totalLeveragedExposureUsd: 0,
    exitCooldown: {},
    priceFor: (s: string) => (s === 'NEAR' ? 4.795 : undefined),
    candlesBySymbol: {},
    maxConcurrentTrades: 7
  });

  it('opens a $100 position at $1,000 equity — the exact signal that was dropped', () => {
    const ev = signalEval();
    const orders = generateTrendBreakoutOrders(ctxFor(1_000, ev));
    expect(orders).toHaveLength(1);
    expect(orders[0].side).toBe('buy');
    expect(orders[0].budgetUsd).toBeCloseTo(100, 6);
    expect(ev.willExecute).toBe(true);
    expect(ev.status).toBe('SIGNAL SPOT LONG');
  });

  it('below the floor it refuses LOUDLY — visible reason on the evaluation', () => {
    const ev = signalEval();
    const orders = generateTrendBreakoutOrders(ctxFor(800, ev));
    expect(orders).toHaveLength(0);
    expect(ev.willExecute).toBe(false);
    expect(ev.strategyDecision).toBe(true);
    expect(ev.status).toBe(`BLOCKED [${MIN_ORDER_EXCEEDS_POSITION_TARGET}]`);
    expect(ev.factors.some(f => f.value === MIN_ORDER_EXCEEDS_POSITION_TARGET)).toBe(true);
  });

  it('a full slot book reports MAX_CONCURRENT rather than vanishing', () => {
    const ev = signalEval();
    const ctx = { ...ctxFor(1_000, ev), maxConcurrentTrades: 0 };
    expect(generateTrendBreakoutOrders(ctx)).toHaveLength(0);
    expect(ev.status).toBe('BLOCKED [MAX_CONCURRENT]');
  });
});
