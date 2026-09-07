/**
 * Execution-layer guards: constraints refuse, they never resize
 * ============================================================================
 * Two rules this suite holds in place, both from the audit of 2026-09-08:
 *
 *   1. Free cash and MIN_ORDER are CONSTRAINTS at fill time, never sizing
 *      inputs. `fillDueOrders` used to clamp `min(budgetUsd, workingCash)`,
 *      so a $1,000 budget meeting $950 of free cash opened a $950 position —
 *      the last place where a downstream mechanism silently resized the
 *      10%-of-equity target, despite a comment promising the opposite.
 *   2. Every entry refusal is visible. A bare `continue` is how the Bybit bot
 *      sat at zero positions for a whole run while showing a green
 *      "SIGNAL SPOT LONG · 93%".
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  fillDueOrders,
  blockEntry,
  MIN_SIM_ENTRY_USD,
  MIN_ORDER_EXCEEDS_POSITION_TARGET,
  type PendingOrder
} from '@cde/engine/execution';
import type { SignalEvaluation } from '@cde/engine';
import { DEFAULT_PREV4H_RANGE_PARAMS, maxAdmissibleExtensionMult } from '@cde/engine/analysis';

afterEach(() => vi.restoreAllMocks());

const entryOrder = (budgetUsd: number | undefined): PendingOrder => ({
  id: 'o1',
  symbol: 'NEAR',
  type: 'SPOT',
  side: 'buy',
  signalPrice: 4.795,
  quantity: budgetUsd ? budgetUsd / 4.795 : 0,
  budgetUsd,
  fill: 'market',
  stopLoss: 4.7167,
  takeProfit1: 4.9516,
  reason: 'test',
  confidence: 93,
  executeAt: Date.now() - 1,
  createdAt: Date.now() - 1000
});

const fill = (order: PendingOrder, cash: number) =>
  fillDueOrders([order], cash, [], () => 4.795, (n: number) => n.toFixed(4));

describe('fillDueOrders — cash is a constraint, not a sizing input', () => {
  it('opens the full requested budget when cash covers it', () => {
    const result = fill(entryOrder(1_000), 1_100);
    expect(result.positions).toHaveLength(1);
    // notional = budget; the fee is charged ON TOP, never taken out of it.
    expect(result.positions[0].notionalUsd).toBeCloseTo(1_000, 6);
    expect(result.cash).toBeCloseTo(1_100 - 1_000 - result.feesAdded, 6);
  });

  it('SKIPS rather than downsizing when cash is short (the fixed bug)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = fill(entryOrder(1_000), 950);
    expect(result.positions).toHaveLength(0);
    expect(result.cash).toBe(950); // untouched
    expect(warn.mock.calls.join(' ')).toContain('never downsized');
  });

  it('the old behaviour would have opened $950 — assert it does not', () => {
    const result = fill(entryOrder(1_000), 950);
    expect(result.positions.map(p => p.notionalUsd)).not.toContain(950);
  });

  it('drops an order with no budgetUsd instead of treating it as $0', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = fill(entryOrder(undefined), 5_000);
    expect(result.positions).toHaveLength(0);
    expect(warn.mock.calls.join(' ')).toContain('no budgetUsd');
  });

  it('still refuses a budget under the $100 floor, and says so', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = fill(entryOrder(MIN_SIM_ENTRY_USD - 1), 5_000);
    expect(result.positions).toHaveLength(0);
    expect(warn.mock.calls.join(' ')).toContain('never bumped up');
  });
});

describe('blockEntry — one visible refusal surface for all four bots', () => {
  const evaluation = (): SignalEvaluation => ({
    symbol: 'NEAR',
    action: 'buy',
    tradeType: 'SPOT',
    tradeSide: 'BUY',
    confidence: 93,
    price: 4.795,
    priceChange24h: 5.06,
    reasoning: '',
    status: 'SIGNAL SPOT LONG',
    willExecute: true,
    factors: [],
    confidenceGap: 0
  });

  it('flips willExecute, preserves the strategy YES, and renders a status', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ev = evaluation();
    blockEntry(ev, MIN_ORDER_EXCEEDS_POSITION_TARGET, 'יעד מתחת לרצפה', '[path-sim]');

    expect(ev.willExecute).toBe(false);
    expect(ev.strategyDecision).toBe(true);
    expect(ev.status).toBe(`BLOCKED [${MIN_ORDER_EXCEEDS_POSITION_TARGET}]`);
    expect(ev.factors).toHaveLength(1);
    expect(ev.factors[0].impact).toBe('negative');
    expect(ev.factors[0].note).toBe('יעד מתחת לרצפה');
    expect(warn.mock.calls[0].join(' ')).toContain('[path-sim]');
  });

  it('a second block appends rather than replacing the first factor', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ev = evaluation();
    blockEntry(ev, 'MAX_CONCURRENT', 'אין מקום');
    blockEntry(ev, 'ENTRY_COOLDOWN', 'צינון');
    expect(ev.factors).toHaveLength(2);
    expect(ev.strategyDecision).toBe(true); // still the ORIGINAL yes
  });
});

describe('Path — the R:R gate and the confidence score read one band', () => {
  const p = DEFAULT_PREV4H_RANGE_PARAMS;
  const dMax = maxAdmissibleExtensionMult(p);

  it('the admissible extension is derived from minRR, not hardcoded', () => {
    // (tpRangeMult - minRR/2) / (1 + minRR) = (1 - 0.6) / 2.2
    expect(dMax).toBeCloseTo(0.181818, 6);
  });

  it('an entry exactly at the band edge still clears minRR', () => {
    const range = 1;
    const rr = (range * p.tpRangeMult - dMax * range) / (range / 2 + dMax * range);
    expect(rr).toBeGreaterThanOrEqual(p.minRR - 1e-9);
  });

  it('one hair past the edge fails minRR — the band is tight, not approximate', () => {
    const range = 1;
    const d = dMax * range + 1e-6;
    const rr = (range * p.tpRangeMult - d) / (range / 2 + d);
    expect(rr).toBeLessThan(p.minRR);
  });

  it('the breakout component can now reach full marks inside the band', () => {
    // Was `d / (range * 0.5) * 30`, capped at 10.9/30 for any admissible entry.
    const points = (d: number) => Math.min(1, d / dMax) * 30;
    expect(points(dMax)).toBeCloseTo(30, 6);
    expect(points(dMax / 2)).toBeCloseTo(15, 6);
    expect(points(0)).toBe(0);
  });

  it('maxExtensionRangeMult stays an operator cap and can only tighten', () => {
    expect(maxAdmissibleExtensionMult({ ...p, maxExtensionRangeMult: 0.05 })).toBeCloseTo(0.05, 6);
    expect(maxAdmissibleExtensionMult({ ...p, maxExtensionRangeMult: 5 })).toBeCloseTo(dMax, 6);
  });
});
