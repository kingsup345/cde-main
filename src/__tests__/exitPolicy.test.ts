/**
 * The shared exit policy: 4.2% loss cap, TP1 3% (half out), TP2 4.5%
 * ============================================================================
 * Operator decision 2026-09-08. Both shared numbers are CEILINGS, not
 * replacements — each bot keeps the stop and target its own strategy computes
 * and the policy only ever pulls them CLOSER. That distinction is what keeps
 * four different strategies comparable instead of collapsing three of them into
 * the fourth.
 *
 * It also covers the bug found while wiring this up: `fillDueOrders` matched a
 * `partial_tp1` order only against a position with `type === 'FUTURES'`, so
 * every partial TP1 on a SPOT position — the majority of what these bots open,
 * and what intraday has been emitting all along — matched nothing and was
 * silently dropped.
 */

import { describe, it, expect } from 'vitest';
import {
  MAX_LOSS_PERCENT,
  TP1_PERCENT,
  TP2_PERCENT,
  TP1_EXIT_FRACTION,
  positionPnlPercent,
  capStopLoss,
  stopWasCapped,
  maxLossStopLevel,
  takeProfitLevels,
  cappedTakeProfitLevels,
  reachedStop,
  reachedTarget,
  fillDueOrders,
  type PendingOrder,
  type SimPosition
} from '@cde/engine/execution';

describe('direction: every number is symmetric under LONG/SHORT', () => {
  it('a price above entry is a profit for a long and a loss for a short', () => {
    expect(positionPnlPercent(100, 103, true)).toBeCloseTo(3, 9);
    expect(positionPnlPercent(100, 103, false)).toBeCloseTo(-3, 9);
  });

  it('a price below entry is a loss for a long and a profit for a short', () => {
    expect(positionPnlPercent(100, 95.8, true)).toBeCloseTo(-4.2, 9);
    expect(positionPnlPercent(100, 95.8, false)).toBeCloseTo(4.2, 9);
  });

  it('the stop and target predicates flip with the side', () => {
    expect(reachedStop(95, 96, true)).toBe(true);    // long: price fell through
    expect(reachedStop(95, 96, false)).toBe(false);
    expect(reachedStop(97, 96, false)).toBe(true);   // short: price rose through
    expect(reachedTarget(103, 103, true)).toBe(true);
    expect(reachedTarget(97, 97, false)).toBe(true);
  });
});

describe('the 4.2% stop is a CAP — it only ever reduces risk', () => {
  it('a tighter structural stop is left exactly as the strategy set it', () => {
    // Path's range midpoint at 1% below entry risks far less than 4.2%.
    expect(capStopLoss(100, 99, true)).toBeCloseTo(99, 9);
    expect(stopWasCapped(100, 99, true)).toBe(false);
  });

  it('a looser structural stop is pulled in to exactly 4.2%', () => {
    // A wide-ATR symbol whose 1.5xATR sat 9% away.
    expect(capStopLoss(100, 91, true)).toBeCloseTo(100 - MAX_LOSS_PERCENT, 9);
    expect(stopWasCapped(100, 91, true)).toBe(true);
  });

  it('mirrors for a short — the cap is ABOVE entry there', () => {
    expect(maxLossStopLevel(100, false)).toBeCloseTo(104.2, 9);
    expect(capStopLoss(100, 101, false)).toBeCloseTo(101, 9);   // tighter, kept
    expect(capStopLoss(100, 109, false)).toBeCloseTo(104.2, 9); // looser, capped
  });

  it('a capped position can never lose more than 4.2%', () => {
    for (const structural of [80, 91, 95, 99, 99.9]) {
      const stop = capStopLoss(100, structural, true);
      expect(positionPnlPercent(100, stop, true)).toBeGreaterThanOrEqual(-MAX_LOSS_PERCENT - 1e-9);
    }
  });

  it('never returns a non-positive price, even for sub-cent assets', () => {
    expect(capStopLoss(0.00000012, -5, true)).toBeGreaterThan(0);
  });
});

describe('the 3% / 4.5% targets are a CAP for bots with their own target', () => {
  it('a nearer structural target is kept — Path keeps its RR 2.0', () => {
    // 0.5% range: target +0.5%, stop 0.25%. Replacing the target with 3% would
    // have asked the price to travel 12x the stop inside a 4H window.
    const { takeProfit1, takeProfit2 } = cappedTakeProfitLevels(100, true, 100.5);
    expect(takeProfit1).toBeCloseTo(100.5, 9);
    expect(takeProfit2).toBeCloseTo(100.75, 9); // 1.5x the structural distance
  });

  it('a further structural target is pulled in to 3% / 4.5%', () => {
    // 8% range: the strategy wanted +8%, the ceiling says 3%.
    const { takeProfit1, takeProfit2 } = cappedTakeProfitLevels(100, true, 108);
    expect(takeProfit1).toBeCloseTo(100 + TP1_PERCENT, 9);
    expect(takeProfit2).toBeCloseTo(100 + TP2_PERCENT, 9);
  });

  it('TP2 is never nearer than TP1, at any structural distance', () => {
    for (const structural of [100.1, 100.5, 101, 102, 103, 105, 110, 150]) {
      const { takeProfit1, takeProfit2 } = cappedTakeProfitLevels(100, true, structural);
      expect(takeProfit2).toBeGreaterThanOrEqual(takeProfit1 - 1e-9);
    }
  });

  it('mirrors for a short', () => {
    const near = cappedTakeProfitLevels(100, false, 99.5);
    expect(near.takeProfit1).toBeCloseTo(99.5, 9);
    expect(near.takeProfit2).toBeCloseTo(99.25, 9);
    const far = cappedTakeProfitLevels(100, false, 92);
    expect(far.takeProfit1).toBeCloseTo(100 - TP1_PERCENT, 9);
    expect(far.takeProfit2).toBeCloseTo(100 - TP2_PERCENT, 9);
  });

  it('bots with no structural target use the flat ladder', () => {
    const { takeProfit1, takeProfit2 } = takeProfitLevels(100, true);
    expect(takeProfit1).toBeCloseTo(103, 9);
    expect(takeProfit2).toBeCloseTo(104.5, 9);
  });
});

describe('partial TP1 executes on SPOT, not only on FUTURES', () => {
  const spotPosition = (): SimPosition => ({
    id: 'p1',
    symbol: 'NEAR',
    type: 'SPOT',
    side: 'BUY',
    quantity: 100,
    entryPrice: 10,
    avgPrice: 10,
    currentPrice: 10.3,
    leverage: 1,
    marginUsd: 1000,
    notionalUsd: 1000,
    stopLoss: 9.58,
    takeProfit1: 10.3,
    takeProfit2: 10.45,
    takeProfit: 10.3,
    tp1Hit: false,
    highestPrice: 10.3,
    lowestPrice: 10,
    openedAt: '',
    openTimestamp: Date.now() - 60_000,
    reason: 'test',
    confidence: 90,
    entryFee: 1
  });

  const tp1Order = (qty: number): PendingOrder => ({
    id: 'o1',
    symbol: 'NEAR',
    positionId: 'p1',
    type: 'SPOT',
    side: 'partial_tp1',
    signalPrice: 10.3,
    quantity: qty,
    reason: 'TP1',
    confidence: 90,
    executeAt: Date.now() - 1,
    createdAt: Date.now() - 1000
  });

  const run = (pos: SimPosition) =>
    fillDueOrders(
      [tp1Order(pos.quantity * TP1_EXIT_FRACTION)],
      500,
      [pos],
      () => 10.3,
      (n: number) => n.toFixed(4)
    );

  it('halves the SPOT position instead of silently dropping the order', () => {
    // The whole bug in one assertion: this used to return the position
    // untouched, with no trade and no error.
    const result = run(spotPosition());
    expect(result.newTrades).toHaveLength(1);
    expect(result.positions).toHaveLength(1);
    expect(result.positions[0].quantity).toBeCloseTo(50, 9);
    expect(result.positions[0].tp1Hit).toBe(true);
  });

  // Exit fills are market-style and carry randomised slippage, so every
  // expectation below is derived from the price the fill actually got.
  it('credits the SPOT sale proceeds to cash', () => {
    const result = run(spotPosition());
    const proceeds = result.newTrades[0].quantity * result.newTrades[0].price;
    expect(result.cash).toBeCloseTo(500 + proceeds - result.feesAdded, 6);
  });

  it('books a profit measured against the cost basis of the half sold', () => {
    const result = run(spotPosition());
    const trade = result.newTrades[0];
    expect(trade.type).toBe('SPOT');
    const proceeds = trade.quantity * trade.price;
    // proceeds − exit fee − costBasis (50 × $10) − half the $1 entry fee.
    expect(trade.pnl).toBeCloseTo(proceeds - result.feesAdded - 500 - 0.5, 6);
    expect(trade.pnl!).toBeGreaterThan(0);
  });

  it('leaves half the entry fee on the remainder — never charged twice', () => {
    const result = run(spotPosition());
    expect(result.positions[0].entryFee).toBeCloseTo(0.5, 9);
  });

  it('still works for FUTURES — margin released, pnl settled', () => {
    const futures: SimPosition = { ...spotPosition(), type: 'FUTURES', side: 'LONG', leverage: 1 };
    const result = fillDueOrders(
      [{ ...tp1Order(50), type: 'FUTURES' }],
      500,
      [futures],
      () => 10.3,
      (n: number) => n.toFixed(4)
    );
    expect(result.positions[0].quantity).toBeCloseTo(50, 9);
    expect(result.positions[0].marginUsd).toBeCloseTo(500, 9);
    const trade = result.newTrades[0];
    expect(trade.type).toBe('FUTURES');
    expect(trade.pnl).toBeCloseTo((trade.price - 10) * 50, 6);
  });

  it('halves the risk the remainder is measured against', () => {
    const withRisk: SimPosition = { ...spotPosition(), initialRiskUsd: 42 };
    const result = run(withRisk);
    expect(result.positions[0].initialRiskUsd).toBeCloseTo(21, 9);
    expect(result.newTrades[0].riskUsd).toBeCloseTo(21, 9);
  });
});
