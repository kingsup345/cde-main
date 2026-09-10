/**
 * Pro — the oscillator-cluster correlation penalty
 * ============================================================================
 * RSI(14), price-vs-MA(20), Bollinger %B and Stochastic %K all read one thing:
 * how far price is stretched from its recent mean. On any dip they cast the
 * same directional vote 3-4 times, and §2's dominance/margin formula — built
 * for INDEPENDENT agreement — inflates on the echoes. A lone crowded-oscillator
 * signal used to clear the 70 bar; in mid-range, four HOLD echoes buried a real
 * MACD/volume lean.
 *
 * `aggregateProBuckets` now divides each bucket's cluster contribution by √n
 * (n = agreeing cluster members). Not a new gate — the arithmetic finally
 * measures what §2 says it measures.
 */

import { describe, it, expect } from 'vitest';
import {
  aggregateProBuckets,
  computeProSignal,
  PRO_CORRELATED_CLUSTER,
  PRO_INDICATOR_WEIGHTS,
  type ProSignalResult
} from '@cde/engine/analysis';

type Vote = Parameters<typeof aggregateProBuckets>[0][number];
const vote = (name: string, weight: number, signal: Vote['signal'], confidence: number): Vote =>
  ({ name, weight, signal, confidence, reason: '' });

// The exact names the vote* functions push, per PRO_CORRELATED_CLUSTER.
const CLUSTER = ['RSI(14)', 'MA(20)', 'Bollinger(20,2)', 'Stochastic(14,3)'] as const;
const NON_CLUSTER = ['MACD(12,26,9)', 'Volume Profile', 'מגמת נפח', 'שינוי 24ש׳'] as const;

describe('cluster membership is exactly the four oscillators', () => {
  it('PRO_CORRELATED_CLUSTER holds those four names and nothing else', () => {
    expect([...PRO_CORRELATED_CLUSTER].sort()).toEqual([...CLUSTER].sort());
  });

  it('computeProSignal really produces all four cluster names (guards a rename)', () => {
    const candles = Array.from({ length: 60 }, (_, i) => ({
      timestamp: 1_700_000_000_000 + i * 3_600_000,
      open: 100, high: 101, low: 99, close: 100 + Math.sin(i / 5), volume: 1000
    }));
    const s = computeProSignal(candles as never, 0) as ProSignalResult;
    const names = new Set(s.signals.map((v) => v.name));
    for (const c of PRO_CORRELATED_CLUSTER) expect(names.has(c)).toBe(true);
  });
});

describe('√n shrink on the agreeing cluster', () => {
  it('4 cluster members all voting BUY contribute raw / 2', () => {
    const signals = CLUSTER.map((n) => vote(n, 10, 'BUY', 100)); // raw = 4 × 10 = 40
    const { buyScore } = aggregateProBuckets(signals);
    expect(buyScore).toBeCloseTo(40 / Math.sqrt(4), 2); // 20
  });

  it('2 agreeing cluster members contribute raw / √2', () => {
    const signals = [vote('RSI(14)', 15, 'BUY', 100), vote('MA(20)', 15, 'BUY', 100)];
    const { buyScore } = aggregateProBuckets(signals);
    expect(buyScore).toBeCloseTo(30 / Math.SQRT2, 2);
  });

  it('a lone cluster member is not penalised (√1 = 1)', () => {
    const { buyScore } = aggregateProBuckets([vote('RSI(14)', 15, 'BUY', 80)]);
    expect(buyScore).toBeCloseTo(12, 2);
  });

  it('a split cluster shrinks each side by its own count', () => {
    const signals = [
      vote('RSI(14)', 10, 'BUY', 100), vote('MA(20)', 10, 'BUY', 100), // BUY raw 20 → /√2
      vote('Bollinger(20,2)', 10, 'HOLD', 100)                          // HOLD raw 10 → /√1
    ];
    const { buyScore, holdScore } = aggregateProBuckets(signals);
    expect(buyScore).toBeCloseTo(20 / Math.SQRT2, 2);
    expect(holdScore).toBeCloseTo(10, 2);
  });

  it('non-cluster indicators are never shrunk, and totalWeight is the raw sum', () => {
    const signals = NON_CLUSTER.map((n) => vote(n, 12, 'BUY', 100)); // 4 × 12 = 48, no shrink
    const { buyScore, totalWeight } = aggregateProBuckets(signals);
    expect(buyScore).toBeCloseTo(48, 2);
    expect(totalWeight).toBe(48);
  });

  it('totalWeight counts every weight regardless of the penalty', () => {
    const all = [
      ...CLUSTER.map((n) => vote(n, PRO_INDICATOR_WEIGHTS.RSI, 'BUY', 100)),
      ...NON_CLUSTER.map((n) => vote(n, 10, 'HOLD', 100))
    ];
    const { totalWeight } = aggregateProBuckets(all);
    expect(totalWeight).toBe(PRO_INDICATOR_WEIGHTS.RSI * 4 + 40);
  });
});

describe('the effect on the decision', () => {
  it('a lone crowded-oscillator BUY loses to a neutral independent set', () => {
    // 4 oscillators scream BUY; the 4 independent indicators are all HOLD.
    const signals = [
      ...CLUSTER.map((n) => vote(n, 12, 'BUY', 85)),        // raw 40.8 → /2 = 20.4
      ...NON_CLUSTER.map((n) => vote(n, 14, 'HOLD', 65))    // 4 × 14 × .65 = 36.4
    ];
    const { buyScore, holdScore } = aggregateProBuckets(signals);
    expect(holdScore).toBeGreaterThan(buyScore); // → action HOLD, no knife-catch
  });

  it('the un-penalised sum would have let that same lone cluster win', () => {
    // Sanity check that the penalty is what flipped it: without √n, buy wins.
    const rawBuy = 4 * 12 * 0.85;       // 40.8
    const rawHold = 4 * 14 * 0.65;      // 36.4
    expect(rawBuy).toBeGreaterThan(rawHold);
  });

  it('a genuine multi-factor BUY (independent + partial cluster) still dominates', () => {
    const signals = [
      vote('RSI(14)', 15, 'BUY', 75), vote('MA(20)', 15, 'BUY', 75), vote('Bollinger(20,2)', 12, 'BUY', 65),
      vote('Stochastic(14,3)', 8, 'HOLD', 60),
      vote('MACD(12,26,9)', 18, 'BUY', 85), vote('Volume Profile', 15, 'BUY', 75),
      vote('מגמת נפח', 10, 'BUY', 75), vote('שינוי 24ש׳', 12, 'BUY', 60)
    ];
    const { buyScore, holdScore, sellScore } = aggregateProBuckets(signals);
    expect(buyScore).toBeGreaterThan(holdScore + sellScore);
    // 3 cluster BUYs shrunk by √3, plus 4 full-weight independent BUYs
    expect(buyScore).toBeGreaterThan(50);
  });
});
