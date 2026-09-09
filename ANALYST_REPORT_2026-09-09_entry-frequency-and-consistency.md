# Analyst report — why Pro & "new" over-abstain, and how to make all four sim bots trade more consistently

**Date:** 2026-09-09
**Scope:** the four simulation bots as they run *today* (`db9e864`..`1d5ed35`), read from source, not from `BOTS_REFERENCE.md` / `*_SPEC.md` (both partly stale).
**Ask:** the user reports Pro and the "new" (intraday MTF) bot are "very afraid to enter." Diagnose, then propose changes that both *lower risk* and *produce more consistent profit*.

---

## 0. TL;DR

| Bot | Why it under-trades | Biggest risk flaw | One change with the most leverage |
|---|---|---|---|
| **Pro** | 7 of 8 indicators are mean-reversion → `HOLD` wins almost every tick; `isDowntrend` then blocks the oversold dips that are its only real signal | flat **4.2% stop vs 3% TP** = risking 1.4× the target on every trade (RR 0.71) | add a trend-following BUY path + make `isDowntrend` a penalty, not a block |
| **new / intraday** | the regime bucket is a **cliff**: full trading only at ADX>25 fully-aligned; the ADX 20–25 band forces `strong && strong` | `chasePenalty === 0` hard gate rejects normal 5M overshoot | `adxTrendMin 25→22`, relax the TRANSITIONAL quality bar, `chasePenalty` becomes a score penalty |
| **Path (prev4hRange)** | fires only in the *one* 4H window after a closed bar, `range ∈ [1.5%,8%]`, break `≤ 0.18·range` | hardcoded `estimatedRoundTripCost = 0.35` | lower `minRangePct` to 1.0%, derive the cost |
| **Bybit (TrendBreakout)** | healthiest post-fixes; `minConfidence 70` is near-cosmetic (always cleared once the structure lines up) | `ENTRY_TOO_EXTENDED` drops fast breakouts | mostly fine — soften the extension cap |

**The single cross-cutting problem: the 3% TP1 floor.** Pro, Path and Bybit all now floor TP1 at `TP1_PERCENT = 3%`. On a major with ~1% daily-range volatility, "profit minimum 3%" means most trades time-stop out flat or reverse before they ever get there. It was added to kill +0.5% scalps; 3% is the wrong number for an intraday/4H horizon. Replace with `max(1.5%, 1.5 × stopDistance)`.

---

## 1. Pro — `proAlgEngine.ts` + `proSimExecution.ts`

### 1.1 The signal is structurally a capitulation-dip buyer

`computeProSignal` runs 8 weighted votes. Reading each vote's BUY condition:

| Indicator | wt | votes BUY when… | family |
|---|---|---|---|
| RSI(14) | 15 | `rsi ≤ 35` | mean-reversion |
| MA(20) | 15 | `price < MA20` | mean-reversion |
| MACD | 18 | `bullish && histogram > 0` | **trend** |
| Bollinger | 12 | at/below lower band | mean-reversion |
| Stochastic | 8 | `k < 25` | mean-reversion |
| Volume Profile | 15 | below value area | mean-reversion |
| Volume Trend | 10 | rising vol + price up | weak trend |
| Momentum 24h | 12 | `< −3%` | mean-reversion |

In a flat or rising market, RSI ≈ 45–60, price near MA20, Stoch mid, %B mid, price in value area, 24h within ±3% → **six indicators vote HOLD**. `holdScore` becomes `maxScore`, `action = HOLD`, `willExecute = false`. Pro only produces a BUY when several oversold readings coincide — i.e. a sharp drop.

### 1.2 …and then `isDowntrend` blocks exactly that

`applyProEntryGates` line 223:

```ts
if (ev.isDowntrend) {   // ema50 < ema200 && price < ema50
  return gateResult(ev, 'NO_SIGNAL [DOWNTREND_FILTER]', 'קניית Oversold חסומה…', false, …);
}
```

Oversold clusters *occur in downtrends*. So Pro can only buy an oversold reading that is **not** in a downtrend = an oversold pullback inside an uptrend. That is a thin slice of market time, and it is the whole reason Pro sits on its hands.

### 1.3 The confidence threshold is **not** the bottleneck

`proMinConfidence('medium', 0)` → `PRO_CONFIDENCE_BY_RISK.medium` = **40**. Any BUY that wins the bucket vote scores ~60–65 on the §2 formula (`50 + (dominance·45 + margin·25)·coverage`). So raising or lowering the threshold changes almost nothing — the gate that actually blocks is `action === 'BUY'` never being true, plus `isDowntrend`.

### 1.4 Risk flaw — flat 4.2% stop against a 3% target

`evaluateProExit`: `changePercent <= -PRO_STOP_LOSS_PERCENT (4.2)` → full exit. `PRO_TAKE_PROFIT_PERCENT = 3`, TP2 = 4.5%. There is **no volatility scaling** — every Pro trade risks a fixed 4.2% to make 3% (gross RR 0.71 at TP1). Blended winner ≈ `0.5·3% + 0.5·4.5% = 3.75%`; loser = 4.2%. Break-even win rate ≈ 53% *before* costs — the same reward:risk inversion that was fixed in Bybit, still live in Pro.

### 1.5 Cruft introduced by the last parallel session (`db9e864`/`6c300cd`)

`proSimExecution.ts:231-238`:

```ts
const spreadPercent = ev.spreadPercent ?? 0;              // ev.spreadPercent is NEVER set
const limitEntries = ctx.pending.some(p => p.fill === 'limit')  // dead var, wrong semantics, no semicolon
const estimatedCost = spreadPercent + 0.20 + 0.08;       // fabricated constant
if (spreadPercent > 0.25 || estimatedCost > 0.45) { … }  // would kill spread > 0.17% if spreadPercent were populated
```

Inert today (spreadPercent unset → `0.28 < 0.45`), but it is broken code waiting to fire, and `proAlgEngine.ts:149,151` now emit `—轻度 oversold` (Chinese "mild") into Hebrew reason strings. Clean both.

---

## 2. new / intraday — `intradayEngine.ts` gate chain

Gate order (each returns `NO_SIGNAL`):
`NO_DATA → CIRCUIT_BREAKER → EXPOSURE → REGIME → VOLATILITY → NO_SETUP → NO_ENTRY → RISK → COST → RISK_VS_COST → DATA_MISMATCH`

### 2.1 The regime bucket is a cliff (`intradayRegime.ts`)

```
BULL_TREND : ADX>25 && ema20>ema50 && Supertrend BULL
BEAR_TREND : ADX>25 && ema20<ema50 && Supertrend BEAR
RANGING    : ADX<20
SOFT_TREND : ADX≥22 && EMA "not opposing" the Supertrend
TRANSITIONAL: everything else (ADX 20–22, or ADX≥25 misaligned)
```

- **Full menu** only in BULL/BEAR_TREND, *and* `atr.bucket ∉ {HIGH, EXTREME}` for futures.
- **RANGING** → MEAN_REVERSION setups only.
- **TRANSITIONAL / SOFT_TREND** → Spot only, and the engine (lines 295-306) demands
  `setup.strong (score ≥ 64) && entry.strong (score ≥ 68) && atrPercentile < 70–80`.

Markets spend a large share of time at ADX 20–25 or in a not-quite-aligned trend. There, the bot needs a near-perfect setup *and* a near-perfect entry simultaneously. That is the "afraid to enter."

### 2.2 `chasePenalty === 0` is a hard entry gate (`intradayEntry.ts:301,319`)

```ts
const chasePenalty = !isMeanReversion && beyondLevelAtr > params.maxChaseAtr   // 1.2
  ? clamp((beyondLevelAtr - 1.2) * 25, 0, 30) : 0;
…
const confirmed = gatesPassed && entryScore >= 50 && !volumeTooLow && !meanRevVolumeTooLow && chasePenalty === 0;
```

Any trigger where price sits **> 1.2 × ATR5** past the level → `confirmed = false`, entry dead. On a 5M candle a 1.3–1.6 ATR overshoot past the trigger is ordinary, not a chase. This silently discards a large fraction of otherwise-valid TREND_PULLBACK / BREAKOUT_RETEST entries.

### 2.3 Futures blocked in HIGH volatility

`futuresAllowed = trending && atr.bucket ∉ {HIGH, EXTREME}`. Trends frequently run *in* HIGH volatility. The `allowShortDuringHighVolatility` carve-out (now covers LONG too, engine lines 265-281) partly compensates for `regime.trending`, but not for the TRANSITIONAL/SOFT_TREND quality gate, which still forces SPOT.

### 2.4 The cost gates are *not* the main blocker (but worth knowing)

Typical SPOT trade: `totalCostPercent ≈ 0.26%` (limit-entry assumption). With TP1 floored at 3% and stop clamped to ≤ 1.5%:
- `costApproved` (`move > 2 × cost` → `> 0.52%`): always passes.
- `rrApproved` (`netRR ≥ 1.2`): `(3 − 0.26) / risk ≥ 1.2` → risk ≲ 2.3% → always passes (1.5% clamp).
- `RISK_VS_COST` (`risk < 2 × 0.26% = 0.52%` → reject): only bites the lowest-ATR symbols. Intended.

So the RISK/COST stack is fine. Regime + setup + entry is where the funnel collapses.

### 2.5 What already helps (keep)

`SIM_INTRADAY_PARAMS_OVERRIDE`: `maxOpenPositions: 7`, wider `maxHoldMinutes`, `timeStopFraction: 0.7`, `useFixedSizingBase`, and (this session) the MEAN_REVERSION stop floor + `RISK_VS_COST` + MR exempt from the 3% TP floor. Good foundation.

---

## 3. Path — `prev4hRange.ts`

Fires only when **all** of: inside the 4H window immediately after a closed bar (`barOpenFor(now) === windowStart`); `trendUp`/`trendDown` on 4H EMA20; `rangePct ∈ [1.5%, 8%]`; broken H/L; `breakoutDist ≤ 0.18 × range` (`maxAdmissibleExtensionMult` at defaults); `stopDistancePct ≥ 0.70%`; `actualRR ≥ 1.2`; `confidence ≥ 55`.

- **`estimatedRoundTripCost = 0.35` hardcoded** (line 275). Should be `fees + spread + slippage` or a param.
- `minRangePct: 1.5%` is high for a 4H bar on majors (often 0.8–1.4%). Lowering to ~1.0% roughly doubles the candidate rate; `minRR` and `RISK_VS_COST` are the real filters.
- TP1 floored at 3% (§ cross-cutting).
- Design intent is a low-frequency comparison peer — do **not** over-loosen; the two changes above are enough.

---

## 4. Bybit — `trendBreakout.ts` / `trendBreakoutExecution.ts`

Post this session's fixes (F4 `minRewardRisk 1.2`, parallel 2R TP, SL model): the healthiest of the four.

- `minConfidence: 70` is **near-cosmetic** — by the time a signal reaches the SIGNAL candidate (H1 trend aligned + Donchian broke + volume ≥ 1.2× + M5 aligned + `distanceFromBreakout ≤ 1.0 × ATR5`), the weighted score is almost always ≥ 70. Fine to leave; it is not why Bybit under-trades (it doesn't, much).
- `ENTRY_TOO_EXTENDED` (`distanceFromBreakout > 1.0 × ATR5`) drops fast breakouts — same "no-chase" tension as intraday. Widening to `1.5 × ATR5` recovers the sharpest (often best) breakouts.
- Scale-in only adds in profit, shares lot-0's stop — acceptable.

---

## 5. Recommendations

### Priority 1 — stop over-abstaining (low risk, high leverage)

**Pro**
1. **Trend-following BUY path.** When `MACD bullish && ema50 > ema200 && price > ema50 && price pulled back to within ~1×ATR of ema20`, emit a BUY with confidence from trend strength, *bypassing* the dominance vote (which structurally can't produce a trend BUY). This is the single biggest fix for Pro's frequency.
2. **`isDowntrend` → penalty, not block.** Multiply confidence by 0.7 instead of returning `NO_SIGNAL`; keep the hard block only when `rsi > 45` (i.e. block knife-catching that isn't even oversold).
3. **HOLD tie-break.** Allow a BUY when `buyScore ≥ holdScore × 0.9 && buyScore > sellScore`.
4. **Delete the garbled cost gate** (`proSimExecution.ts:231-238`) and the `—轻度` strings. If a spread gate is wanted, populate `ev.spreadPercent` from `snap.liquidity` and reject `> maxSpreadPercent (0.12%)`, matching intraday.

**intraday**
5. `adxTrendMin: 25 → 22` (or accept BULL/BEAR_TREND at ADX ≥ 22 when EMA + Supertrend both aligned). Catches trend *starts*, not just mature moves.
6. Relax the TRANSITIONAL/SOFT_TREND quality bar: `setup.setupScore ≥ 55 && entry.entryScore ≥ 58` (between `min` and `strong`), or require `strong` on **one** of the two, not both.
7. `chasePenalty === 0` → `chasePenalty <= 15`; let the penalty only *reduce* `entryScore`. A 1.3–1.6 ATR overshoot is normal.
8. Fold the `allowShortDuringHighVolatility` carve-out into `futuresAllowed` so HIGH-vol trends can use leverage consistently (EXTREME still blocked).

**Path**
9. `minRangePct: 1.5% → 1.0%`; derive `estimatedRoundTripCost` from fees+spread+slippage (or make it a param).

**Bybit**
10. `m5MaxAtrDistance: 1.0 → 1.5` so the sharpest breakouts aren't dropped as `ENTRY_TOO_EXTENDED`.

### Priority 2 — consistency of profit

11. **Replace the flat 3% TP1 floor** (`TP1_PERCENT`) with `max(1.5%, 1.5 × stopDistance)` everywhere it is applied (Pro, Path, Bybit, and intraday non-MR — MR is already exempt this session). Still bans micro-scalps, still guarantees gross RR ≥ 1.5, but a clean 1.8–2.5% move becomes a booked win instead of a round-trip.
12. **Widen the post-TP1 trail** so runners reach TP2: intraday `trailingAtrMult 1.2 → 1.8`; Bybit `trailingAtrMultiplier 1.0 → 1.5`. Today the runner half usually trails out near breakeven-plus and TP2 is mostly theoretical.
13. **Confidence-tilted sizing.** 7% of `sizingBase` at the entry threshold, 10% at +15, 12% at +30. Concentrates capital in higher-hit-rate setups; smooths the curve. (Or finally wire `sizingMultiplier` into `buildRiskPlan.notionalUsd` — it is computed and thrown away today.)

### Priority 3 — risk prevention

14. **Pro stop → ATR/structural, capped at 4.2%** (not a flat 4.2%). Mirror `capStopLoss`. This removes Pro's reward:risk inversion — the highest-impact risk fix in the set.
15. **Portfolio-level consecutive-loss halt.** 3 losing full exits in a row → pause *all* new entries for 60 min. `streakCooldownFromHistory` exists but is per-symbol; a bad regime bleeds the book through many symbols.
16. **Correlation gate for Pro / Path / Bybit.** Intraday has `evaluateCorrelationGate`; the other three can open a whole correlated cluster at once (e.g. Pro buying 5 alts that are all oversold together in one market-wide dip = 50% of capital on one bet).
17. **Soft drawdown throttle.** At 4% daily DD → halve position size; at 6% → only `strong` setups. Turns the 8%/15% cliffs into a ramp.

### Sequencing

Do P1 first and **run the sim for several days before P2/P3** — P1 alone changes the trade population enough that P2/P3 should be tuned against the new data, not the old. `minStopCostMultiple`, the new TP floor formula, and the sizing tilt are all "suggested starting values" that need `scripts/abBacktest.ts` validation.

---

## 6. What NOT to change

- Don't lower `minRewardRisk` / `minRR` (1.2) on any bot — that gate is what stopped the Bybit inversion; keep it as the backstop.
- Don't remove the 4.2% `MAX_LOSS_PERCENT` cap — cap Pro's stop *to* it, don't exceed it.
- Don't turn Path into a high-frequency bot — it exists as a slow, structural comparison peer.
- Don't raise `maxOpenPositions` past 7 (7 × 10% = 70% invested is already the ceiling under `MAX_TOTAL_EXPOSURE_PERCENT`).
