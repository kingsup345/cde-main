/**
 * Pro LIMIT entry — the distance from market must be fillable (2026-09-11)
 * ============================================================================
 * Observed live on NEAR:
 *
 *   ביטחון 97.5%   market $2.4540
 *   כניסה מתוכננת: $2.2902        ← -6.67% below market
 *   SL $2.3769 · TP1 $2.6146 · TP2 $2.6859
 *
 * `calculateOptimalEntryPrice` weights Bollinger-lower / MA20 / VAL / POC —
 * a "where is the nearest strong support?" price with no relation to the
 * trade's own risk budget — and its only floor was `currentPrice × 0.90`,
 * i.e. up to 10% away. On a ladder targeting TP1 1.8% / SL 2.3%, waiting for a
 * 6.67% drop asks for a bigger move BEFORE the trade than the trade intends to
 * capture; the order just expires at the 2h TTL and the bot never trades.
 *
 * The discount is now capped by BOTH an absolute ceiling and a fraction of the
 * trade's own stop, so it scales with the ladder instead of being a magic
 * number. Intraday / Path / Bybit were already bounded (ATR offset floored at
 * the trigger level, and the broken level respectively) — Pro was the only one
 * hunting support with no leash.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateOptimalEntryPrice,
  proMaxEntryDiscountPercent,
  PRO_MAX_ENTRY_DISCOUNT_PCT,
  PRO_ENTRY_DISCOUNT_STOP_FRACTION,
  type ProSignalResult
} from '@cde/engine/analysis';

/** A signal whose support levels all sit far below market — the NEAR shape. */
function farSupportSignal(price: number, action: 'BUY' | 'SELL' = 'BUY'): ProSignalResult {
  return {
    action,
    buyScore: 40, sellScore: 5, holdScore: 10, totalWeight: 105,
    confidence: 97.5, atrPercent: 2.0, signals: [],
    indicators: {
      // Every support ~8-10% below market: the case that produced -6.67%.
      bollingerBands: { upper: price * 1.05, middle: price * 0.96, lower: price * 0.90, position: 'inside' },
      ma20: price * 0.94,
      volumeProfile: { poc: price * 0.92, valueAreaHigh: price * 1.01, valueAreaLow: price * 0.90, position: 'inside' },
      rsi: 51.7, volumeTrend: 'stable', macd: { macd: 0, signal: 0, histogram: 0, trend: 'bullish' },
      stochastic: { k: 50, d: 50, signal: 'neutral' }
    } as unknown as ProSignalResult['indicators']
  } as unknown as ProSignalResult;
}

describe('proMaxEntryDiscountPercent', () => {
  it('a calm-regime 2.3% stop allows ~0.69% — the stop fraction binds', () => {
    expect(proMaxEntryDiscountPercent(2.3)).toBeCloseTo(2.3 * PRO_ENTRY_DISCOUNT_STOP_FRACTION, 6);
    expect(proMaxEntryDiscountPercent(2.3)).toBeLessThan(PRO_MAX_ENTRY_DISCOUNT_PCT);
  });

  it('a wide 4.2% stop is clamped by the absolute ceiling, not the fraction', () => {
    expect(proMaxEntryDiscountPercent(4.2)).toBeCloseTo(PRO_MAX_ENTRY_DISCOUNT_PCT, 6);
  });

  it('never exceeds the absolute ceiling, for any stop', () => {
    for (const stop of [0.5, 1.8, 2.3, 4.2, 12, 50]) {
      expect(proMaxEntryDiscountPercent(stop)).toBeLessThanOrEqual(PRO_MAX_ENTRY_DISCOUNT_PCT + 1e-9);
    }
  });

  it('falls back to the ceiling when the stop is unknown', () => {
    expect(proMaxEntryDiscountPercent(undefined)).toBe(PRO_MAX_ENTRY_DISCOUNT_PCT);
    expect(proMaxEntryDiscountPercent(0)).toBe(PRO_MAX_ENTRY_DISCOUNT_PCT);
  });
});

describe('calculateOptimalEntryPrice — the NEAR case', () => {
  const market = 2.454;

  it('no longer parks the order 6.67% below market', () => {
    const entry = calculateOptimalEntryPrice(farSupportSignal(market), market, {
      maxDiscountPercent: proMaxEntryDiscountPercent(2.3) // calm-regime stop
    });
    const discountPct = ((market - entry) / market) * 100;
    expect(discountPct).toBeLessThanOrEqual(2.3 * PRO_ENTRY_DISCOUNT_STOP_FRACTION + 1e-6);
    expect(entry).toBeGreaterThan(2.43); // was 2.2902
  });

  it('still rests BELOW market so it does not fill as a market order', () => {
    const entry = calculateOptimalEntryPrice(farSupportSignal(market), market, {
      maxDiscountPercent: proMaxEntryDiscountPercent(2.3)
    });
    expect(entry).toBeLessThan(market);
  });

  it('the discount never exceeds the ladder it is trading — TP1 1.8%', () => {
    // An entry discount larger than the target is a different trade, not a
    // better fill. With a 2.3% stop the ceiling is 0.69% — well inside 1.8%.
    const entry = calculateOptimalEntryPrice(farSupportSignal(market), market, {
      maxDiscountPercent: proMaxEntryDiscountPercent(2.3)
    });
    expect(((market - entry) / market) * 100).toBeLessThan(1.8);
  });

  it('defaults to the absolute ceiling when the caller passes nothing', () => {
    const entry = calculateOptimalEntryPrice(farSupportSignal(market), market);
    const discountPct = ((market - entry) / market) * 100;
    expect(discountPct).toBeLessThanOrEqual(PRO_MAX_ENTRY_DISCOUNT_PCT + 1e-6);
  });

  it('a support level NEAR market is still honoured — the cap only clamps', () => {
    const s = farSupportSignal(market);
    // Move every support to ~0.3% below market: inside the ceiling, so it wins.
    (s.indicators as unknown as Record<string, unknown>).ma20 = market * 0.997;
    (s.indicators as unknown as { bollingerBands: { lower: number } }).bollingerBands.lower = market * 0.997;
    (s.indicators as unknown as { volumeProfile: { valueAreaLow: number; poc: number } }).volumeProfile.valueAreaLow = market * 0.997;
    (s.indicators as unknown as { volumeProfile: { valueAreaLow: number; poc: number } }).volumeProfile.poc = market * 0.997;
    const entry = calculateOptimalEntryPrice(s, market, { maxDiscountPercent: 1.0 });
    const discountPct = ((market - entry) / market) * 100;
    expect(discountPct).toBeGreaterThan(0.1);
    expect(discountPct).toBeLessThan(1.0);
  });

  it('SELL is symmetric — rests ABOVE market, same ceiling', () => {
    const entry = calculateOptimalEntryPrice(farSupportSignal(market, 'SELL'), market, { maxDiscountPercent: 1.0 });
    expect(entry).toBeGreaterThan(market);
    expect(((entry - market) / market) * 100).toBeLessThanOrEqual(1.0 + 1e-6);
  });
});
