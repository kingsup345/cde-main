/**
 * MEASUREMENT ONLY — changes nothing. Quantifies the `calculateEMA` seeding
 * defect on real market data so the fix can be decided on numbers.
 *
 * The defect (ANALYST_REPORT_2026-09-08_audit-verification.md §1):
 * `tradeEngine.calculateEMA` writes its SMA seed at index 0 instead of index
 * `period - 1`, then runs the recursion from i = 1. A second, textbook-correct
 * implementation exists at `utils/advancedTechnicalAnalysis.ts:204` that no bot
 * uses. This script runs both over the same candles and reports where the two
 * disagree enough to change a DECISION, not merely a displayed number.
 *
 * What it measures, per symbol:
 *   · the relative gap in the last EMA value, per period the bots actually use
 *   · TrendBreakout's H1 direction gate (ema50 > ema200) — does it flip?
 *   · TrendBreakout's confidence spread term, whose full scale is a 2% spread
 *     (clamp01(|ema50-ema200|/ema200 / 0.02) * 20) — how many of its 20 points
 *     move?
 *   · Path's 4H EMA20 trend filter (rising + close above) — does it flip?
 *
 * Usage:  npx tsx scripts/emaSeedingImpact.ts [SYMBOL ...]
 * Data:   pulled from the public Bybit kline endpoint, no credentials needed.
 */

// ── The two implementations, copied verbatim so the script is self-contained
//    and keeps reporting the true delta even after the source is fixed. ──────

/** tradeEngine.ts:112 — the one all four bots use today. */
function emaShipped(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const ema: number[] = [];
  let sum = 0;
  const initialCount = Math.min(period, values.length);
  for (let i = 0; i < initialCount; i++) sum += values[i];
  ema.push(sum / initialCount); // ← index 0, not period-1
  for (let i = 1; i < values.length; i++) ema.push(values[i] * k + ema[i - 1] * (1 - k));
  return ema;
}

/** utils/advancedTechnicalAnalysis.ts:204 — textbook, unused by any bot. */
function emaTextbook(values: number[], period: number): number[] {
  const ema: number[] = new Array(values.length).fill(NaN);
  if (values.length < period || period <= 0) return ema;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  ema[period - 1] = sum / period;
  const k = 2 / (period + 1);
  for (let i = period; i < values.length; i++) ema[i] = values[i] * k + ema[i - 1] * (1 - k);
  return ema;
}

const last = (xs: number[]) => xs[xs.length - 1];
const pct = (a: number, b: number) => ((a - b) / b) * 100;

interface Candle { openTime: number; open: number; high: number; low: number; close: number }

async function fetchKlines(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${symbol} ${interval}: HTTP ${res.status}`);
  const json = (await res.json()) as { retCode: number; retMsg: string; result?: { list?: string[][] } };
  if (json.retCode !== 0) throw new Error(`${symbol} ${interval}: ${json.retMsg}`);
  // Bybit returns newest-first; the engines expect oldest-first.
  return (json.result?.list ?? [])
    .map((r) => ({ openTime: Number(r[0]), open: Number(r[1]), high: Number(r[2]), low: Number(r[3]), close: Number(r[4]) }))
    .sort((a, b) => a.openTime - b.openTime);
}

/** H1 -> fully-closed 4H bars, same rule as pathEngine.aggregateToH4. */
function toH4(h1: Candle[]): Candle[] {
  const BAR = 4 * 60 * 60 * 1000;
  const buckets = new Map<number, Candle[]>();
  for (const c of h1) {
    const start = Math.floor(c.openTime / BAR) * BAR;
    (buckets.get(start) ?? buckets.set(start, []).get(start)!).push(c);
  }
  return [...buckets.entries()]
    .filter(([, cs]) => cs.length === 4) // complete bars only
    .sort((a, b) => a[0] - b[0])
    .map(([start, cs]) => ({
      openTime: start,
      open: cs[0].open,
      high: Math.max(...cs.map((c) => c.high)),
      low: Math.min(...cs.map((c) => c.low)),
      close: cs[cs.length - 1].close
    }));
}

const SPREAD_FULL_SCALE = 0.02; // trendBreakout.ts: clamp01(spread / 0.02) * 20
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const spreadPoints = (ema50: number, ema200: number) =>
  clamp01(Math.abs(ema50 - ema200) / ema200 / SPREAD_FULL_SCALE) * 20;

async function main() {
  const symbols = process.argv.slice(2);
  const list = symbols.length ? symbols : ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'NEARUSDT', 'AAVEUSDT', 'UNIUSDT', 'BNBUSDT'];

  console.log('EMA seeding impact — shipped (tradeEngine) vs textbook');
  console.log('Nothing is modified. See ANALYST_REPORT_2026-09-08_audit-verification.md §1.\n');

  let gateFlips = 0;
  let trendFlips = 0;
  let maxPointSwing = 0;

  for (const symbol of list) {
    let h1: Candle[];
    try {
      h1 = await fetchKlines(symbol, '60', 260); // TIMEFRAME_SPECS['1h'].targetCandles
    } catch (err) {
      console.log(`${symbol}: skipped — ${(err as Error).message}\n`);
      continue;
    }
    if (h1.length < 200) {
      console.log(`${symbol}: skipped — only ${h1.length} H1 candles\n`);
      continue;
    }

    const closes = h1.map((c) => c.close);
    const s50 = last(emaShipped(closes, 50));
    const t50 = last(emaTextbook(closes, 50));
    const s200 = last(emaShipped(closes, 200));
    const t200 = last(emaTextbook(closes, 200));
    const close = last(closes);

    // TrendBreakout's H1 direction gate (trendBreakout.ts:282-283)
    const shippedBull = s50 > s200 && close > s50;
    const textbookBull = t50 > t200 && close > t50;
    const shippedBear = s50 < s200 && close < s50;
    const textbookBear = t50 < t200 && close < t50;
    const gateFlipped = shippedBull !== textbookBull || shippedBear !== textbookBear;
    if (gateFlipped) gateFlips++;

    const ptsShipped = spreadPoints(s50, s200);
    const ptsTextbook = spreadPoints(t50, t200);
    const swing = Math.abs(ptsShipped - ptsTextbook);
    maxPointSwing = Math.max(maxPointSwing, swing);

    // Path's 4H EMA20 filter (prev4hRange.ts)
    const h4 = toH4(h1);
    let pathLine = `  4H EMA20: only ${h4.length} closed 4H bars — skipped`;
    if (h4.length >= 24) {
      const h4c = h4.map((c) => c.close);
      const sSeries = emaShipped(h4c, 20);
      const tSeries = emaTextbook(h4c, 20);
      const prevClose = h4[h4.length - 1].close;
      const sUp = last(sSeries) > sSeries[sSeries.length - 2] && prevClose > last(sSeries);
      const tUp = last(tSeries) > tSeries[tSeries.length - 2] && prevClose > last(tSeries);
      const sDn = last(sSeries) < sSeries[sSeries.length - 2] && prevClose < last(sSeries);
      const tDn = last(tSeries) < tSeries[tSeries.length - 2] && prevClose < last(tSeries);
      const flipped = sUp !== tUp || sDn !== tDn;
      if (flipped) trendFlips++;
      pathLine =
        `  4H EMA20 (${h4.length} bars): gap ${pct(last(sSeries), last(tSeries)).toFixed(3)}%` +
        `  trend shipped=${sUp ? 'UP' : sDn ? 'DOWN' : 'FLAT'} textbook=${tUp ? 'UP' : tDn ? 'DOWN' : 'FLAT'}` +
        `  ${flipped ? '⚠️ FLIPPED' : 'same'}`;
    }

    console.log(`${symbol}  (${h1.length} H1 candles, close ${close})`);
    console.log(`  EMA50 : shipped ${s50.toFixed(6)}  textbook ${t50.toFixed(6)}  gap ${pct(s50, t50).toFixed(3)}%`);
    console.log(`  EMA200: shipped ${s200.toFixed(6)}  textbook ${t200.toFixed(6)}  gap ${pct(s200, t200).toFixed(3)}%`);
    console.log(
      `  H1 direction gate: shipped=${shippedBull ? 'LONG' : shippedBear ? 'SHORT' : 'none'}` +
      `  textbook=${textbookBull ? 'LONG' : textbookBear ? 'SHORT' : 'none'}  ${gateFlipped ? '⚠️ FLIPPED' : 'same'}`
    );
    console.log(
      `  confidence spread term: shipped ${ptsShipped.toFixed(1)}/20  textbook ${ptsTextbook.toFixed(1)}/20` +
      `  swing ${swing.toFixed(1)} pts`
    );
    console.log(pathLine + '\n');
  }

  console.log('─'.repeat(72));
  console.log(`Direction gates flipped : ${gateFlips}/${list.length}`);
  console.log(`Path 4H trend flipped   : ${trendFlips}/${list.length}`);
  console.log(`Largest confidence swing: ${maxPointSwing.toFixed(1)} of 20 points`);
  console.log('\nA flipped gate is a trade the bot would or would not have taken.');
  console.log('A large point swing moves confidence across the 60-point entry floor.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
