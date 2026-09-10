/**
 * A resting entry may not outlive the thesis that produced it
 * ============================================================================
 * `LIMIT_ORDER_TTL_MS` was a flat 2h for all four sim bots. That is wrong in
 * both directions:
 *
 *   Intraday    max hold is 45-120 min, so a 2h resting order could wait LONGER
 *               than the trade it was opening would have lasted — and fill on a
 *               5-minute entry confirmation two hours stale.
 *   Prev-4H     the position is time-stopped at the end of the SAME 4H bar the
 *               setup was armed in. An order filling at 3h50m opens a trade with
 *               ten minutes left to reach a target sized off the whole range.
 *   Pro         no time stop at all — 2h is genuinely right. Keeps the default.
 *
 * `PendingOrder.expiresAt` lets an engine that knows its own horizon state it;
 * `orderExpiryAt` falls back to the flat TTL for everything that does not.
 */

import { describe, it, expect } from 'vitest';
import {
  orderExpiryAt,
  selectFillableOrders,
  generatePrev4hRangeOrders,
  LIMIT_ORDER_TTL_MS,
  ENTRY_TTL_HOLD_FRACTION,
  type PendingOrder
} from '@cde/engine/execution';
import type { SignalEvaluation } from '@cde/engine';

const HOUR = 60 * 60 * 1000;

describe('orderExpiryAt — the horizon an order actually dies on', () => {
  it('falls back to the flat 2h TTL when the engine set no horizon', () => {
    expect(orderExpiryAt({ createdAt: 1_000 })).toBe(1_000 + LIMIT_ORDER_TTL_MS);
    expect(orderExpiryAt({ createdAt: 1_000, expiresAt: undefined }))
      .toBe(1_000 + LIMIT_ORDER_TTL_MS);
  });

  it('uses the engine horizon when it set one', () => {
    expect(orderExpiryAt({ createdAt: 1_000, expiresAt: 5_000 })).toBe(5_000);
  });

  it('ignores a non-finite horizon rather than producing NaN', () => {
    expect(orderExpiryAt({ createdAt: 1_000, expiresAt: NaN })).toBe(1_000 + LIMIT_ORDER_TTL_MS);
  });
});

describe('selectFillableOrders honours the per-order horizon', () => {
  const restingOrder = (createdAt: number, expiresAt?: number): PendingOrder => ({
    id: 'o1', symbol: 'AAA', type: 'SPOT', side: 'buy',
    signalPrice: 90,             // market stays at 100 → never crosses, so it can only expire
    quantity: 1, fill: 'limit',
    reason: '', confidence: 80,
    executeAt: createdAt, createdAt, expiresAt
  });
  const market = () => 100;

  it('a 30-minute horizon cancels at 30 minutes, not at 2 hours', () => {
    const now = 10 * HOUR;
    const order = restingOrder(now - 31 * 60_000, now - 31 * 60_000 + 30 * 60_000);
    const { due, expired } = selectFillableOrders([order], now, market);
    expect(due).toHaveLength(0);
    expect(expired).toHaveLength(1);
  });

  it('...and does NOT cancel one minute before its horizon', () => {
    const now = 10 * HOUR;
    const order = restingOrder(now - 29 * 60_000, now - 29 * 60_000 + 30 * 60_000);
    const { due, expired } = selectFillableOrders([order], now, market);
    expect(due).toHaveLength(0);
    expect(expired).toHaveLength(0);   // still resting
  });

  it('an order with no horizon still rests the full flat 2h — Pro is unchanged', () => {
    const now = 10 * HOUR;
    const justUnder = restingOrder(now - LIMIT_ORDER_TTL_MS + 60_000);
    expect(selectFillableOrders([justUnder], now, market).expired).toHaveLength(0);

    const justOver = restingOrder(now - LIMIT_ORDER_TTL_MS - 1);
    expect(selectFillableOrders([justOver], now, market).expired).toHaveLength(1);
  });

  it('the horizon never force-fills — a crossed price still fills before it', () => {
    const now = 10 * HOUR;
    const order = restingOrder(now - 60_000, now + 60_000);
    const { due } = selectFillableOrders([order], now, () => 89);   // crossed below 90
    expect(due).toHaveLength(1);
  });
});

describe('ENTRY_TTL_HOLD_FRACTION — intraday cannot outlive its own trade', () => {
  it('is strictly less than one hold budget', () => {
    expect(ENTRY_TTL_HOLD_FRACTION).toBeGreaterThan(0);
    expect(ENTRY_TTL_HOLD_FRACTION).toBeLessThan(1);
  });

  it('a 90-minute setup rests less time than the trade would have lived', () => {
    const maxHoldMs = 90 * 60_000;
    const rest = maxHoldMs * ENTRY_TTL_HOLD_FRACTION;
    expect(rest).toBeLessThan(maxHoldMs);
    expect(rest).toBeLessThan(LIMIT_ORDER_TTL_MS);   // and less than the old flat TTL
  });
});

// ── path: the order dies with its 4H window ────────────────────────────────

const MARKET = 4.795;

const pathCtx = (windowEnd: number) => ({
  positions: [],
  pending: [],
  evaluations: [{
    symbol: 'NEAR', action: 'buy', tradeType: 'SPOT', tradeSide: 'BUY',
    confidence: 93, price: MARKET, priceChange24h: 1, reasoning: '',
    status: 'SIGNAL SPOT LONG', willExecute: true, factors: [], confidenceGap: 0,
    decision: {
      direction: 'LONG',
      windowStart: Date.now() - 60_000,
      windowEnd,
      entryRef: MARKET, limitEntryPrice: 4.7,
      stopLoss: 4.6, takeProfit: 5.1, riskPerUnit: 0.195
    } as never
  } as SignalEvaluation],
  executionDelaySec: 0,
  dailyDrawdownPercent: 0, weeklyDrawdownPercent: 0,
  cash: 10_000, equity: 10_000, initialAmount: 10_000,
  totalLeveragedExposureUsd: 0, exitCooldown: {},
  priceFor: () => MARKET,
  candlesBySymbol: {},
  maxPositions: 7, maxFuturesPositions: 2,
  limitEntries: true
});

describe('path — the resting order dies with the 4H window', () => {
  it('expires at the window end when that is sooner than the flat TTL', () => {
    const windowEnd = Date.now() + 40 * 60_000;      // 40 minutes of window left
    const [order] = generatePrev4hRangeOrders(pathCtx(windowEnd));
    expect(order.fill).toBe('limit');
    expect(order.expiresAt).toBe(windowEnd);
    expect(orderExpiryAt(order)).toBeLessThan(order.createdAt + LIMIT_ORDER_TTL_MS);
  });

  it('never rests longer than the flat TTL even on a freshly armed window', () => {
    const windowEnd = Date.now() + 4 * HOUR;          // whole bar ahead
    const [order] = generatePrev4hRangeOrders(pathCtx(windowEnd));
    expect(order.expiresAt).toBeLessThanOrEqual(order.createdAt + LIMIT_ORDER_TTL_MS);
  });

  it('an order armed late in the window is cancelled once the window closes', () => {
    const windowEnd = Date.now() + 5 * 60_000;
    const [order] = generatePrev4hRangeOrders(pathCtx(windowEnd));
    // Market never reaches the resting limit; step past the window end.
    const { due, expired } = selectFillableOrders([order], windowEnd + 1, () => MARKET);
    expect(due).toHaveLength(0);
    expect(expired).toHaveLength(1);
  });
});
