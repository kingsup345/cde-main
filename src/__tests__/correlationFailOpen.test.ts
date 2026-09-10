/**
 * The correlation gate must not fail OPEN when it cannot measure
 * ============================================================================
 * Measured on the live worker 2026-09-10, from the four bots' real trade log:
 *
 *   intraday  6 entries in 4 minutes, $6,000 = 60% of equity, all LONG.
 *             All six stopped out between minute 16 and 36: -$102.22 of the
 *             bot's -$107.25 total run.
 *   path      3 simultaneous $1,000 entries on its first tick.
 *
 * Two separate defects produced that:
 *
 *  1. `evaluateCorrelationGate` returns `{ allowed: true, abstained: true }`
 *     when it has no overlapping candle history to judge with — and every
 *     caller read `allowed` and dropped `abstained` on the floor. "I could not
 *     check" executed as "these are independent", and it abstains hardest at
 *     COLD START, which is exactly when all slots are free and sizing is at
 *     full target.
 *  2. `prev4hRangeExecution` had no correlation check at all, despite
 *     trendBreakoutExecution's comment claiming "the same helper the intraday
 *     and Path bots use".
 *
 * The cold start must still be allowed to begin — a gate that blocked from an
 * empty book would deadlock forever, since history only accrues once positions
 * exist. So unverified stacking is capped at the same number the VERIFIED path
 * allows (DEFAULT_MAX_CORRELATED = 3).
 */

import { describe, it, expect } from 'vitest';
import {
  blocksOnAbstention,
  abstentionBlockReason,
  evaluateCorrelationGate,
  DEFAULT_MAX_CORRELATED
} from '@cde/engine';
import { generatePrev4hRangeOrders } from '@cde/engine/execution';
import type { SignalEvaluation } from '@cde/engine';

describe('blocksOnAbstention — the decision an abstained gate should drive', () => {
  const abstained = { allowed: true, abstained: true };
  const measured = { allowed: true, abstained: false };
  const blocked = { allowed: false, abstained: false };

  it('lets a cold start BEGIN — an empty or small book is never blocked', () => {
    for (let held = 0; held < DEFAULT_MAX_CORRELATED; held++) {
      expect(blocksOnAbstention(abstained, held)).toBe(false);
    }
  });

  it('blocks the entry that would take an UNVERIFIED book past the cap', () => {
    expect(blocksOnAbstention(abstained, DEFAULT_MAX_CORRELATED)).toBe(true);
    expect(blocksOnAbstention(abstained, DEFAULT_MAX_CORRELATED + 3)).toBe(true);
  });

  it('never fires when the gate actually measured the pairing', () => {
    expect(blocksOnAbstention(measured, 99)).toBe(false);
  });

  it('never fires when the gate already blocked — that path owns the reason', () => {
    expect(blocksOnAbstention(blocked, 99)).toBe(false);
  });

  it('honours an explicit cap', () => {
    expect(blocksOnAbstention(abstained, 1, 1)).toBe(true);
    expect(blocksOnAbstention(abstained, 1, 2)).toBe(false);
  });

  it('the reason names both numbers so the block is auditable', () => {
    const reason = abstentionBlockReason(3, 3);
    expect(reason).toContain('3');
    expect(reason).toMatch(/קורלציה/);
  });
});

describe('evaluateCorrelationGate still reports abstention the same way', () => {
  it('abstains — not allows-on-evidence — when the book has no candle history', () => {
    const gate = evaluateCorrelationGate({
      symbol: 'AAA',
      direction: 'LONG',
      held: [{ symbol: 'BBB', direction: 'LONG' }],
      candlesBySymbol: {}
    });
    expect(gate.allowed).toBe(true);
    expect(gate.abstained).toBe(true);
  });

  it('does NOT abstain on an empty book — there is genuinely nothing to correlate', () => {
    const gate = evaluateCorrelationGate({
      symbol: 'AAA', direction: 'LONG', held: [], candlesBySymbol: {}
    });
    expect(gate.abstained).toBe(false);
    expect(blocksOnAbstention(gate, 0)).toBe(false);
  });
});

// ── path now has a correlation gate at all ──────────────────────────────────

const MARKET = 4.795;

const pathEval = (symbol: string): SignalEvaluation => ({
  symbol,
  action: 'buy',
  tradeType: 'SPOT',
  tradeSide: 'BUY',
  confidence: 93,
  price: MARKET,
  priceChange24h: 1,
  reasoning: '',
  status: 'SIGNAL SPOT LONG',
  willExecute: true,
  factors: [],
  confidenceGap: 0,
  decision: {
    direction: 'LONG',
    windowStart: Date.now() - 60_000,
    windowEnd: Date.now() + 3 * 60 * 60 * 1000,
    entryRef: MARKET,
    limitEntryPrice: 4.7,
    stopLoss: 4.6,
    takeProfit: 5.1,
    riskPerUnit: 0.195
  } as never
});

const heldPosition = (symbol: string) => ({
  id: `p-${symbol}`, symbol, type: 'SPOT' as const, side: 'BUY' as const,
  quantity: 1, entryPrice: MARKET, avgPrice: MARKET, currentPrice: MARKET,
  leverage: 1, marginUsd: 1000, notionalUsd: 1000, stopLoss: 4.6,
  takeProfit: 5.1, takeProfit1: 5.1, takeProfit2: 5.3, tp1Hit: false,
  openedAt: '', openTimestamp: Date.now() - 1000, reason: '', confidence: 90, entryFee: 0
});

const pathCtx = (symbols: string[], held: string[]) => ({
  positions: held.map(heldPosition),
  pending: [],
  evaluations: symbols.map(pathEval),
  executionDelaySec: 0,
  dailyDrawdownPercent: 0,
  weeklyDrawdownPercent: 0,
  cash: 100_000,
  equity: 100_000,
  initialAmount: 100_000,
  totalLeveragedExposureUsd: 0,
  exitCooldown: {},
  priceFor: () => MARKET,
  candlesBySymbol: {},          // ← no history: the gate must ABSTAIN
  maxPositions: 20,
  maxFuturesPositions: 5
});

describe('path — the missing correlation gate', () => {
  const entriesFrom = (orders: { side: string }[]) =>
    orders.filter((o) => o.side === 'buy' || o.side === 'short');

  it('a cold first tick can still open, up to the unverified cap', () => {
    const orders = generatePrev4hRangeOrders(pathCtx(['AAA', 'BBB', 'CCC'], []));
    expect(entriesFrom(orders)).toHaveLength(DEFAULT_MAX_CORRELATED);
  });

  it('the entry PAST the unverified cap is refused — was 6 simultaneous longs', () => {
    const orders = generatePrev4hRangeOrders(pathCtx(['AAA', 'BBB', 'CCC', 'DDD', 'EEE', 'FFF'], []));
    expect(entriesFrom(orders)).toHaveLength(DEFAULT_MAX_CORRELATED);
  });

  it('a book already at the cap adds nothing more it cannot verify', () => {
    const orders = generatePrev4hRangeOrders(pathCtx(['DDD'], ['AAA', 'BBB', 'CCC']));
    expect(entriesFrom(orders)).toHaveLength(0);
  });

  it('the refusal is tagged CORRELATION, not swallowed silently', () => {
    const ctx = pathCtx(['DDD'], ['AAA', 'BBB', 'CCC']);
    generatePrev4hRangeOrders(ctx);
    expect(ctx.evaluations[0].status).toMatch(/CORRELATION/);
    expect(ctx.evaluations[0].willExecute).toBe(false);
  });
});
