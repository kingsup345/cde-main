/**
 * Slot preemption — a resting (unfilled) entry order is a reservation, not a
 * position. When every slot is taken by reservations, a clearly stronger fresh
 * candidate may evict the weakest one and take its slot; a filled position is
 * never touched. Shared by all four sim engines (Pro / intraday / Path / Bybit)
 * and applied identically in the Render worker and the browser fallback.
 */

import { describe, it, expect } from 'vitest';
import {
  pickPreemptibleEntryOrder,
  applySlotPreemptions,
  SLOT_PREEMPT_MARGIN,
  type PendingOrder
} from '@cde/engine/execution';

const order = (id: string, confidence: number, side: PendingOrder['side'] = 'buy'): PendingOrder =>
  ({ id, symbol: id.toUpperCase(), side, confidence } as unknown as PendingOrder);

describe('pickPreemptibleEntryOrder', () => {
  it('returns the weakest resting ENTRY order when the candidate clears the margin', () => {
    const pending = [order('a', 82), order('b', 60), order('c', 71)];
    expect(pickPreemptibleEntryOrder(65 + SLOT_PREEMPT_MARGIN, pending, new Set())).toBe('b');
  });

  it('returns null when the candidate does not beat the weakest by the margin', () => {
    const pending = [order('a', 80), order('b', 62)];
    expect(pickPreemptibleEntryOrder(62 + SLOT_PREEMPT_MARGIN - 0.1, pending, new Set())).toBeNull();
    expect(pickPreemptibleEntryOrder(62 + SLOT_PREEMPT_MARGIN, pending, new Set())).toBe('b');
  });

  it('skips orders already claimed earlier in the same batch', () => {
    const pending = [order('a', 50), order('b', 55)];
    const claimed = new Set(['a']);
    // 'a' is spoken for → next weakest is 'b' (55); 70 >= 60 so it evicts 'b'.
    expect(pickPreemptibleEntryOrder(70, pending, claimed)).toBe('b');
    // and if 'b' is also claimed, nothing is left to give.
    claimed.add('b');
    expect(pickPreemptibleEntryOrder(99, pending, claimed)).toBeNull();
  });

  it('ignores EXIT orders — only entries (buy/sell/long/short) are reservations', () => {
    const pending = [order('x', 10, 'close_long'), order('y', 10, 'partial_tp1')];
    expect(pickPreemptibleEntryOrder(99, pending, new Set())).toBeNull();
  });

  it('no resting entries at all → null', () => {
    expect(pickPreemptibleEntryOrder(99, [], new Set())).toBeNull();
  });
});

describe('applySlotPreemptions', () => {
  const pending = [order('keep', 70), order('victim', 55)];

  it('cancels the incumbent only when the replacement actually placed this tick', () => {
    const evaluations = [{ symbol: 'NEW', preemptsOrderId: 'victim' }];
    const res = applySlotPreemptions(pending, evaluations, new Set(['NEW']));
    expect(res.cancelledIds).toEqual(['victim']);
    expect(res.pending.map((o) => o.id)).toEqual(['keep']);
  });

  it('leaves the incumbent alone when the replacement was refused downstream', () => {
    const evaluations = [{ symbol: 'NEW', preemptsOrderId: 'victim' }];
    const res = applySlotPreemptions(pending, evaluations, new Set()); // NEW not placed
    expect(res.cancelledIds).toEqual([]);
    expect(res.pending).toBe(pending); // same reference, untouched
  });

  it('is a no-op when no evaluation carries a preemption', () => {
    const res = applySlotPreemptions(pending, [{ symbol: 'NEW' }], new Set(['NEW']));
    expect(res.cancelledIds).toEqual([]);
    expect(res.pending).toBe(pending);
  });
});
