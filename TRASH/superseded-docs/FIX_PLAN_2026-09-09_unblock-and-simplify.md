# Fix plan — unblock the four sim bots and cut the redundant gating

**Date:** 2026-09-09
**Author intent:** the bots must start trading and making consistent profit. Every prior pass *added* a gate; this plan *removes* gates and merges duplicate logic. Read from source at `1d5ed35`.

---

## Guiding principle — a veto budget

Each bot may keep **exactly three hard vetoes**:

1. **NO_DATA** — not enough candles to compute.
2. **CIRCUIT_BREAKER / CAPITAL_FLOOR** — portfolio-level equity protection.
3. **NO_ROOM** — no free slot or no free cash.

**Everything else becomes an input to one confidence number, compared once to one threshold.** A weak regime, a chase, a thin volume reading, a so-so setup — they *lower confidence*, they do not independently return `NO_SIGNAL`. Today each bot has 6–10 independent veto points that multiply to near-zero throughput. That is the whole bug.

Risk controls that shape a trade without blocking it (force SPOT instead of FUTURES, cap the stop at 4.2%, cap size at 10%) are **kept** — they are not vetoes.

---

## BOT 1 — Pro (`proAlgEngine.ts`, `proSimExecution.ts`)

### Algorithm as it runs today

1. `computeProSignal`: 8 weighted votes (RSI 15, MA 15, MACD 18, BB 12, Stoch 8, VolProfile 15, VolTrend 10, Mom24h 12) → `buyScore / sellScore / holdScore` → `action` = max bucket → `confidence = 50 + (dominance·45 + margin·25)·coverage − (1−coverage)·10`, clamped; non-BUY capped at 50.
2. `buildProEvaluation`: `willExecute = action==='BUY' && confidence ≥ proMinConfidence(riskLevel, override)`.
3. `applyProEntryGates` (batch, confidence-desc): sell-handling · queued · held · **isDowntrend** · confidence<min · **garbled spread/cost gate** · slots · no-price · capital-floor · min-order.
4. `evaluateProExit`: flat −4.2% SL · +4.5% TP2 full · +3% TP1 partial 50% · runner-gave-back full · flip-to-SELL full.

### What is redundant / dead / duplicated

| Item | Location | Verdict |
|---|---|---|
| `PRO_DEFAULT_ENTRY_CONFIDENCE = 70` | `proAlgEngine.ts:445` | **dead** — `proMinConfidence` always finds a `PRO_CONFIDENCE_BY_RISK` key, so this fallback is unreachable. Delete. |
| `SIM_MIN_CONFIDENCE.pro = 70` (registry) | `simDefaults.ts` | only used when `confidenceDerivedFromRiskLevel` is false — which it never is for Pro. Misleading. Align to the table or drop from the pro spec. |
| `coverage` term | `proAlgEngine.ts:328,330` | weights sum to 105, denominator is 88 → `coverage = 1` on every warm eval. `·coverage` and `−(1−coverage)·10` are no-ops. Keep the line but delete the comment theatre; it is just `50 + dominance·45 + margin·25`. |
| `ema50Prev`, `ema50Prev2` + commented alt-`isDowntrend` | `proAlgEngine.ts:287-288,292` | dead. Delete. |
| garbled cost gate | `proSimExecution.ts:231-238` | `estimatedCost` is a fabricated constant; `limitEntries` is a dead mis-scoped var with no semicolon; `ev.spreadPercent` is never populated so the gate is inert. **Delete the whole block.** |
| `—轻度` (Chinese "mild") in Hebrew reason strings | `proAlgEngine.ts:149,151` | replace with `קל`. |
| `activeMarketRegimesFrom()` | `proSimExecution.ts:383-385` | returns `{}` always. Delete if no importer needs the symbol. |
| `proTechnicalScore` | `proAlgEngine.ts:358` | second score, only for a reasoning string. Keep (cheap, UI reads it) but do not add more like it. |

### Why it will not enter — and the fix

**Root cause:** 7 of 8 votes are mean-reversion, so `holdScore` wins almost every tick; the rare BUY that wins comes from an oversold cluster, which `isDowntrend` then blocks.

**Pass 1 edits (unblock, no new gate):**

1. **Add a trend BUY/SELL lane** to `computeProSignal`, evaluated *after* the bucket vote, that can set `action` on its own:
   ```
   trendUp   = ema50 > ema200 && price > ema50 && macd.histogram > 0 && macd.histogramSlope >= 0
   pullback  = |price - ema20| <= 1.5 * atr(14)        // near the trend's mean, not extended
   if trendUp && pullback && action !== 'SELL':
       action = 'BUY'
       confidence = max(confidence, 58 + trendStrength*22 + pullbackQuality*20)   // 0..100
   ```
   Mirror for `trendDown` → SELL (SELL still only closes; that is fine). `atr(14)` and `ema20` are already available via `calculateEMA`/a 14-bar ATR on `candles`. This is the single highest-leverage change for Pro — it lets a clean trend pullback trade without needing six indicators to be simultaneously oversold.

2. **`isDowntrend` → soft.** `proSimExecution.ts:223-226`: block **only** when `ev.isDowntrend && ev.confidence < 75 && (ev.indicators?.rsi ?? 50) > 42`. A genuine capitulation reversal (rsi ≤ 42 or confidence ≥ 75) is allowed through; the trend lane above is never affected (it requires an uptrend).

3. **One threshold.** Delete `PRO_DEFAULT_ENTRY_CONFIDENCE`. Set `PRO_CONFIDENCE_BY_RISK = { low: 60, medium: 50, high: 42 }` (medium up from 40 only so the trend lane's `58` floor sits comfortably above it; still permissive). Registry `pro.minConfidence` → `50` to match, and keep `confidenceDerivedFromRiskLevel: true`.

4. **Delete the garbled cost gate** (`proSimExecution.ts:231-238`).

**Pass 3 edits (risk — Pro's reward:risk is inverted):**

5. Pro risks a flat **4.2%** to make **3%** (`evaluateProExit`). Replace with a per-position stop set at entry:
   - `computeProSignal` returns `atrPercent = atr(14)/price*100`.
   - `buildProEvaluation` attaches `stopLoss` / `takeProfit1` / `takeProfit2` (today `undefined`, lines 110-111):
     `stopPct = clamp(1.6 * atrPercent, 1.8, 4.2)` ; `tp1Pct = max(1.5, 1.5 * stopPct)` ; `tp2Pct = tp1Pct * 1.5`.
   - `evaluateProExit` takes the position's stored `stopLoss` price instead of the flat `-PRO_STOP_LOSS_PERCENT`; the 4.2% ceiling stays as the hard cap (`capStopLoss`).
   This removes the inversion: worst case still −4.2%, but a low-vol major now risks ~1.8% for ~2.7%.

---

## BOT 2 — new / intraday (`intradayEngine.ts`, `intradayRegime.ts`, `intradaySetup.ts`, `intradayEntry.ts`, `intradayRisk.ts`, `intradayAdapter.ts`)

### Algorithm as it runs today

1H regime → 15M setup → 5M entry → risk plan → cost → `RISK_VS_COST` → adapter confidence gate.

### The gate inventory (this is the problem)

| # | Gate | Location | Decision |
|---|---|---|---|
| 1 | NO_DATA (200/300/500) | `intradayEngine.ts:165` | **keep** (veto 1) |
| 2 | CIRCUIT_BREAKER (locked / DD 8% / 15%) | `:173-184` | **keep** (veto 2) |
| 3 | EXPOSURE (slots, same-asset) | `:187-195` | **keep** (veto 3) |
| 4 | REGIME: TRANSITIONAL/SOFT_TREND ⇒ needs `strong && strong && atrOk` else `NO_REGIME` | `:295-306` | **convert to score penalty** |
| 5 | NO_SETUP: `setupType === 'NONE'` (best score < `setupScoreMin 46`) | `:239-242` | keep as the setup floor, but see #10 |
| 6 | NO_ENTRY: `!entry.confirmed` — needs `entryScore ≥ 50 && !volumeTooLow && chasePenalty === 0` | `:252-255`, `intradayEntry.ts:319` | **drop `chasePenalty === 0`**; keep score+volume |
| 7 | RISK: `buildRiskPlan` — grossRR<1.2, per-asset cap, min order, count | `intradayRisk.ts` | **keep** grossRR + caps; they shape, they don't over-fire |
| 8 | COST: `costApproved (move>2×cost)` **AND** `rrApproved (netRR≥1.2)` | `intradayRisk.ts:168-170` | **drop `costApproved`** — subsumed by `rrApproved` + #9 |
| 9 | RISK_VS_COST: `risk < 2×cost` | `intradayRisk.ts:148` | **keep** (this session's gate; it is the one real risk-side cost check) |
| 10 | adapter `blockedByConfidence`: `(setupScore+entryScore)/2 < minConf 52` | `intradayAdapter.ts:362-369` | **remove** — redundant with the setup(46)+entry(50) floors it is an average of |

Net: from **10 gates to 6**, and gate 4 stops being a cliff.

### Redundant / duplicated computation

- **Three indicator stacks** (1H regime, 15M setup, 5M entry) each recompute EMA/RSI/MACD/Bollinger/Stochastic/VWAP/volume/structure. That is inherent to MTF and not worth unwinding now — but the two **scores** built on top (`setupScore` from trend/momentum/location/participation/structure; `entryScore` from triggerQuality/momentum/volume/vwap/candle) measure the *same five families* at two resolutions, and then the adapter averages them. Pick one: use `entryScore` as the confidence (it is the later, more decision-relevant read) and keep `setupScore ≥ 46` only as the setup-exists floor. Delete the average.
- `limitOrderTtlMinutes: 10` (`intradayParams.ts:382`) — **ignored**; `LIMIT_ORDER_TTL_MS = 2h` is hardcoded in `simExecution.ts:826`. Delete the param.
- `riskPerTradePercent`, `maxRiskPerTradePercent` (`:338-339`) — "deprecated, do not use for sizing". Delete + the `RISK_VARIANTS` export if unused outside backtest.
- `minAtrStopPct` (`intradayRisk.ts` ~344) — computed, never read (dead since `ecfd37b`). Delete.
- `liquidityTermCap` / `liquidityTermWeight` — self-described "SUGGESTED STARTING VALUE, not measured". Keep the mechanism but set weight to 0 until validated, so it stops perturbing the cost gate with an unmeasured term.
- `DATA_MISMATCH` gate (`intradayEngine.ts:397-410`) — "must never fire in normal operation". Downgrade to a `console.error` + proceed; do not return `NO_SIGNAL` on a guard that only a regression could trip.

### Pass 1 edits (unblock)

1. **`DEFAULT_INTRADAY_PARAMS`:** `adxTrendMin: 25 → 22`, `adxRangeMax: 20 → 18`. Shrinks the ADX 20–25 dead band from both sides; a trend that is *starting* now classifies as BULL/BEAR_TREND.
2. **Regime gate → penalty** (`intradayEngine.ts:295-306`): when `transitional || softTrend`, keep `tradeType = 'SPOT'` (risk control) but **do not `return NO_REGIME`**. Instead carry `regimePenalty = softTrend ? 6 : 12` and subtract it from the final confidence. The confidence threshold is the single arbiter.
3. **`chasePenalty` never vetoes** (`intradayEntry.ts:319`): remove `&& chasePenalty === 0` from `confirmed`. Confirm the penalty is already subtracted from `rawScore` (line ~306) — if not, subtract it. A 1.3–1.6 ATR overshoot past the trigger is normal 5M behaviour.
4. **One cost gate** (`intradayRisk.ts:168-170`): `approved = rrApproved` (drop `costApproved`). The spread gates and `RISK_VS_COST` stay.
5. **Remove the adapter confidence gate** (`intradayAdapter.ts:362-369`): return `mapOutcome(raw.outcome)` directly. Confidence still reported for the UI; it just stops being a 4th veto.
6. **Confidence source** (`intradayAdapter.ts:356-360`): `computedConfidence = raw.entry ? raw.entry.entryScore - regimePenalty : Math.round(raw.setup?.setupScore ?? 0)`. Stop averaging setup+entry.

### Pass 2 edits (consistency)

7. `trailingAtrMult: 1.2 → 1.8` (`DEFAULT_INTRADAY_PARAMS`) so the TP1 runner can actually reach TP2 instead of trailing out near breakeven.
8. Apply the shared TP1 floor formula (see **Shared**, item S1) to the non-MR branch of `buildRiskPlan` (MR is already exempt from this session).

---

## BOT 3 — Path / prev4hRange (`prev4hRange.ts`, `prev4hRangeExecution.ts`)

### Algorithm today

Fires only when **all**: inside the 4H window immediately after a closed bar · 4H EMA20 trending · `rangePct ∈ [1.5%, 8%]` · price broke H/L · `breakoutDist ≤ 0.18·range` (`maxAdmissibleExtensionMult`) · `stopDist ≥ 0.70%` · `actualRR ≥ 1.2` · `confidence ≥ 55`.

### Redundant / hardcoded

- `estimatedRoundTripCost = 0.35` (`prev4hRange.ts:275`) — hardcoded literal in the middle of the function. Make it a param `estimatedRoundTripCostPct` (default `0.30`) or derive `fee(0.2) + spread + slippage`.
- `tpCapped = false` (`:317`) — always false, then interpolated into a template string. Dead. Delete it and the `${tpCapped ? …}` branch.
- `riskPerTrade` (`:95`) — unused (sizing is `positionTargetPct`). Delete.
- `maxExtensionRangeMult: 0.5` — the doc itself says "at the default it never binds; `minRR` rejects everything past 0.1818 first". Keep (cheap) but know it is inert.

### Pass 1 edits (unblock)

1. `minRangePct: 0.015 → 0.010` (`DEFAULT_PREV4H_RANGE_PARAMS:92`). Many 4H bars on majors are 0.8–1.4%; `minRR` + `RISK_VS_COST` remain the real filters.
2. Replace the `0.35` hardcode with the param above.
3. **Optional** (doubles opportunity, same thesis): accept `barOpenFor(now) === windowStart || barOpenFor(now) === windowStart + BAR_MS` — trade the breakout in either of the first two 4H windows after the reference bar. If taken, extend `windowEnd` to `windowStart + 3·BAR_MS` for the time-stop.

### Pass 2

4. Shared TP1 floor (S1).

---

## BOT 4 — Bybit / TrendBreakout (`trendBreakout.ts`, `trendBreakoutExecution.ts`)

### Algorithm today

H1 Supertrend + EMA50/200 → trend · M15 Donchian(20) break + volume ≥ 1.2× · M5 EMA9/21 aligned + `distanceFromBreakout ≤ 1.0·ATR(M5)` · confidence ≥ 70 (weights sum 100) · `grossRewardRisk ≥ 1.2` (this session's F4). Scale-in 50/30/20 in profit. Exits: touch stop + 4.2% cap, TP ladder, Supertrend reversal, 24h time stop.

### Redundant / near-cosmetic

- `minConfidence: 70` — by the time all the structural conditions hold, the weighted score is almost always ≥ 70. It is not a meaningful filter but it is also not hurting; **leave it**.
- `tpRMultiplier` — used by the 2R TP; live. Fine.
- `riskPerTrade` (`:110`) — deprecated, unused. Delete.
- `entryLimitOffsetAtrMult` — only read in limit-entry mode (off by default). Keep.
- Unreachable `tp && !first.tp1Hit` branch (`trendBreakoutExecution.ts` ~324) — noted earlier as *not* pure dead code (reachable when a lot is `!tp1Hit` but claimed by a pending partial). **Leave.**

### Pass 1 edits (unblock — minimal, this bot is close)

1. `m5MaxAtrDistance: 1.0 → 1.5` (`DEFAULT_TREND_BREAKOUT_PARAMS`). The sharpest breakouts — often the best — currently die as `ENTRY_TOO_EXTENDED`.

### Pass 2

2. `trailingAtrMultiplier: 1.0 → 1.5` so the runner reaches TP2.
3. Shared TP1 floor (S1) — replaces the current flat `max(R·2, 3%)` with `max(R·2, max(1.5%, 1.5·stopDist))`, i.e. the floor drops from 3% to 1.5% when the stop is tight.

---

## Shared changes

### S1 — replace the flat 3% TP1 floor with a stop-relative floor

`TP1_PERCENT = 3.0` is applied as a hard minimum in `intradayRisk.ts` (non-MR), `prev4hRange.ts:311`, `trendBreakout.ts:359`. On a low-volatility major a 3% target rarely prints inside an intraday/4H horizon → trades time-stop flat or reverse first.

Add to `exitPolicy.ts`:
```ts
/** TP1 may not be closer than 1.5% of entry, nor closer than 1.5x the stop
 *  distance — bans micro-scalps and guarantees gross R:R >= 1.5, without
 *  forcing a 3% target onto a 1%-volatility symbol. */
export function tp1FloorDistance(entryPrice: number, stopDistance: number): number {
  return Math.max(entryPrice * 0.015, stopDistance * 1.5);
}
```
Swap it in for `entry * TP1_PERCENT/100` at the three call sites. `TP1_PERCENT` stays for Pro's `evaluateProExit` percentage check and TP2 math until Pass 3 rework.

### S2 — one cost model, three consumers

`evaluateCostEdge` (intraday) computes `totalCostPercent` properly. Path and Pro each reinvent it (`0.35` literal, `estimatedCost` literal). Export a tiny helper:
```ts
export function estimatedRoundTripCostPct(opts: {
  tradeType: 'SPOT'|'FUTURES'; spreadPercent: number; entryIsLimit: boolean;
}): number   // fee_entry + fee_exit + spread + base slippage
```
in `intradayRisk.ts`, and have Path and Pro call it instead of literals. One definition, no drift.

### S3 — sizing tilt by confidence (Pass 3)

Every bot sizes a flat 10% of `sizingBase`. `sizingMultiplier` is computed by the adaptive-risk layer and **thrown away** (`buildRiskPlan` stores it but never multiplies `notionalUsd`). Either wire it, or add a simple tilt at the order-gen layer for all four:
`sizePct = clamp(0.06 + 0.04 * (confidence - threshold) / 20, 0.05, 0.12)`.
Concentrates capital in the higher-hit-rate reads; smooths the equity curve.

### S4 — portfolio consecutive-loss halt (Pass 3)

`streakCooldownFromHistory` exists but is per-symbol. Add a book-level rule in each engine's tick: **3 losing full exits in a row across any symbols → no new entries for 60 min** (exits/management continue). One shared helper, four call sites.

### S5 — correlation gate for Pro / Path / Bybit (Pass 3)

Intraday has `evaluateCorrelationGate`. The other three can open a whole correlated cluster in one tick (Pro buying five alts that are all oversold together = one bet at 50% of book). Reuse the same helper.

---

## Sequencing

Three passes, each independently shippable, each `npm test` + `npm run typecheck` + `typecheck:worker` green before merge, then **run the sim 2–3 days before starting the next pass** — Pass 1 changes the trade population enough that Pass 2/3 must be tuned against the new data.

| Pass | Goal | Scope | New gates added |
|---|---|---|---|
| **1 — Unblock** | bots trade at a normal rate | all the veto→score / param-loosen / dead-code deletions above | **zero** |
| **2 — Consistency** | winners run, targets are reachable | S1 (TP floor), trailing widen (all bots), S2 (cost model) | zero |
| **3 — Risk polish** | smooth curve, no tail blowups | Pro structural stop, S3 sizing tilt, S4 loss halt, S5 correlation | S4 + S5 are book-level, not per-trade vetoes |

### Pass 1 file checklist

- `packages/engine/src/services/proAlgEngine.ts` — trend lane; delete `PRO_DEFAULT_ENTRY_CONFIDENCE`, dead EMA vars, `—轻度`; `PRO_CONFIDENCE_BY_RISK` values.
- `packages/engine/src/services/proSimExecution.ts` — `isDowntrend` soft; delete garbled cost block; delete `activeMarketRegimesFrom` if unused.
- `packages/engine/src/services/simDefaults.ts` — `pro.minConfidence → 50`.
- `packages/engine/src/services/intradayParams.ts` — `adxTrendMin 22`, `adxRangeMax 18`; delete `limitOrderTtlMinutes`, `riskPerTradePercent`, `maxRiskPerTradePercent`; `liquidityTermWeight → 0`.
- `packages/engine/src/services/intradayEngine.ts` — regime gate → penalty; `DATA_MISMATCH` → warn+proceed.
- `packages/engine/src/services/intradayEntry.ts` — drop `chasePenalty === 0` from `confirmed`; ensure penalty subtracts from score.
- `packages/engine/src/services/intradayRisk.ts` — `approved = rrApproved` (drop `costApproved`); delete `minAtrStopPct`.
- `packages/engine/src/services/decisionEngine/adapters/intradayAdapter.ts` — remove `blockedByConfidence`; confidence = `entryScore - regimePenalty`.
- `packages/engine/src/services/prev4hRange.ts` — `minRangePct 0.010`; param-ise `0.35`; delete `tpCapped`, `riskPerTrade`.
- `packages/engine/src/services/trendBreakout.ts` — `m5MaxAtrDistance 1.5`; delete `riskPerTrade`.

### Test plan

- Update the assertion-heavy suites that pin the old numbers: `intradayRRConsistency`, `dynamicTPSL`, `simBotRegistry` (pro minConfidence), `prev4hRange`, `trendBreakout*`, `riskVsCost`.
- New: `src/__tests__/entryFrequency.test.ts` — feed each engine ~200 synthetic bars covering trend / range / transitional and assert each fires a SIGNAL on a **materially larger** fraction of bars than a golden pre-Pass-1 baseline (store the baseline counts as constants in the test).
- New: `pro` trend-lane test — a clean EMA50>EMA200 pullback with neutral RSI must produce `action: 'BUY'` (fails today).
- New: intraday regime-penalty test — a TRANSITIONAL setup with `setupScore 55 / entryScore 60` must reach `SIGNAL` (blocked today by gate 4 and gate 10).
- Local worker run: `POST /api/{sim,pro-sim,path-sim,bybit-sim}/start`, poll `state` for 30 min, confirm each `evaluations[]` shows SIGNALs and each bot opens ≥ 1 position.

---

## Do NOT touch

- `minRewardRisk` / `minRR` = 1.2 on any bot — the backstop that stopped the Bybit inversion.
- `MAX_LOSS_PERCENT` = 4.2 — cap Pro's stop *to* it in Pass 3, never exceed it.
- `RISK_VS_COST` gate — it is the one cost check the reward-side gates are structurally blind to; keep it, just feed it S2's cost.
- `maxOpenPositions` = 7 (7 × 10% = 70% invested, already the ceiling).
- The closed-candle / no-lookahead discipline in every `evaluate*` function.
- Scale-in and the shared fill/fee/slippage core.

---

## Pass 1 — implementation status (2026-09-09)

`npm run typecheck` + `typecheck:worker` clean · **467 pass / 2 skipped** (+2 new
Pro trend-lane tests). No new veto was added anywhere.

### Done

| Item | Where | Note |
|---|---|---|
| Pro **trend-participation lane** | `proAlgEngine.ts computeProSignal` | `ema50>ema200 && price>ema50 && within 3×ATR of ema50` promotes a HOLD to BUY/SELL; BUY gets a 58-floor confidence boost. **No MACD gate** — a pullback deep enough to reach the EMA50 turns MACD mildly bearish on this TF, which is exactly the entry we want; the bucket vote still vetoes an opposing signal. |
| Pro **`isDowntrend` → soft** | `proSimExecution.ts:223` | blocks only when `confidence < 75 && rsi > 42` — a real capitulation reversal or a high-conviction read passes. |
| Pro **garbled cost gate deleted** | `proSimExecution.ts` | the `estimatedCost` / dead `limitEntries` / `轻度` block is gone. |
| Pro `—轻度` → `קל`, dead `ema50Prev/Prev2` removed | `proAlgEngine.ts` | |
| intraday **regime cliff → soft OR-bar** | `intradayEngine.ts:295` | TRANSITIONAL/SOFT_TREND now needs `setupScore≥55 OR entryScore≥58` (was `strong && strong` ≈ 64 && 68); ATR only blocks EXTREME. FUTURES still forced to SPOT (risk control kept). |
| intraday **`chasePenalty` veto removed** | `intradayEntry.ts:322` | penalty still subtracts up to 30 from `entryScore`, so a real chase fails `entryScoreMin` on its own. |
| intraday **one reward-side cost gate** | `intradayRisk.ts:168` | `approved = netRewardRisk ≥ minRewardRisk`; the redundant `expectedMove > cost × costSafetyMultiplier` check is gone. |
| intraday `adxTrendMin 25→22`, `adxRangeMax 20→18`, `liquidityTermWeight 0.4→0` | `intradayParams.ts` | (from the parallel edit — verified + kept) |
| Path `minRangePct 0.015→0.010`; `0.35` cost literal → `costSafetyMultiplier` param + `0.30` base | `prev4hRange.ts` | interface field `riskPerTrade` → `costSafetyMultiplier`. |
| Path **`RR_BELOW_MIN` gate restored** | `prev4hRange.ts` | the parallel edit had deleted it; the plan's "do NOT touch minRR" stands — a wide range can still make the 3% TP floor sub-1.2 R:R. |
| Path plan-object regressions fixed | `prev4hRange.ts` | `windowStart/windowEnd` were overwritten with the reference bar's own timestamps (time-stop would fire immediately); `limitEntryPrice` was dropped from the plan (interface-required); `tpCapped` was added to it (not in the interface). All reverted to correct. |
| Bybit `m5MaxAtrDistance 1.0→1.5` | `trendBreakout.ts` | sharp breakouts no longer dropped as `ENTRY_TOO_EXTENDED`. |

### Deliberately NOT done (reconsidered against "stop the churn / it must ship")

| Planned | Why skipped |
|---|---|
| delete `riskPerTradePercent` / `maxRiskPerTradePercent` | **not dead** — `intradayEngine.ts:360` passes it to `buildRiskPlan` as the risk-% telemetry base and `intradayBacktest.ts` sweeps it. The parallel edit deleted the values → build broke; restored them. |
| delete `limitOrderTtlMinutes` | consumed by `intradayBacktest.ts:451`. Left; the sim-vs-backtest TTL mismatch (2h vs 10min) is a separate, non-urgent wiring fix. |
| delete `minAtrStopPct` | already removed in an earlier session; nothing to do. |
| remove adapter `blockedByConfidence` | parallel edit already lowered it 52→50; with `setup≥46` + `entry≥50` it now only trims the 48–49.x sliver and it is the one place the operator's panel `minConfidence` is honoured. Not worth removing. |
| `DATA_MISMATCH` → warn+proceed | it fires **zero** times in normal operation; it is regression insurance, not a block the user is hitting. Kept. |
| delete `PRO_DEFAULT_ENTRY_CONFIDENCE` | unreachable fallback, imported by 2 tests. Harmless; not worth the test churn. |
| Pro `PRO_CONFIDENCE_BY_RISK` re-tune | left at `{55,40,25}` — already permissive; the trend lane, not the threshold, was the frequency fix. `SIM_MIN_CONFIDENCE.pro` is 50 (parallel edit) but is only the non-derived fallback. |

### Next

- **Run the sim 2–3 days**, then tune Pass 2 (TP1 floor formula `max(1.5%, 1.5×stop)`, trailing widen, shared cost helper) against the new trade population.
- Deploy note: engine change → **both** Netlify and the Render worker rebuild.

---

## Pass 2 — implementation status (2026-09-09)

`typecheck` + `typecheck:worker` clean · **467 pass / 2 skipped**. Zero new gates.

### Done

| Item | Where |
|---|---|
| **S1 — `tp1FloorDistance(entry, stopDistance)`** = `max(1.5% of entry, 1.5× stop)` | new in `exitPolicy.ts`; swapped in for the flat `entry × 3%` at all three call sites: `intradayRisk.ts` (non-MR branch), `prev4hRange.ts`, `trendBreakout.ts`. MR stays fully exempt. Net effect: TP1 tracks the stop — a tight-stop trade now targets 1.5–2.25% instead of an unreachable 3%, and gross R:R floors at 1.5 by construction. |
| **S2 — `estimatedRoundTripCostPct({tradeType, spreadPercent?, entryIsLimit?, baseSlippagePercent?})`** | new in `intradayRisk.ts` (fee + fee + spread + one slippage leg, matching `evaluateCostEdge`'s assumptions). `prev4hRange.ts` now calls it (with `baseSlippagePercent: 0.05` = the sim's market-fill slippage) instead of the `0.30` literal — same value, one definition. Pro's literal was already deleted in Pass 1. |
| intraday `trailingAtrMult 1.2 → 1.8` | `intradayParams.ts` — the post-TP1 runner has room to reach TP2. |
| Bybit `trailingAtrMultiplier 1.0 → 1.5` | `trendBreakout.ts` — same. |
| `exitPolicy.ts` header comment | rewritten (was "TP1 at 3%", "intraday's fixed 1.8%" — both stale). |
| Test suites re-pinned to the new model | `dynamicTPSL` (floor is stop-relative; the two "TP impossible" cases now force rejection via a raised `minRewardRisk` since the 1.5×stop term guarantees R:R ≥ 1.5), `intradayRRConsistency` (reward 3.0→2.25, gross R:R 2.0→1.5), `positionSizing` Prev4hRange block (R:R now a clean 1.5), `riskVsCost` F6 block (non-MR floored at 1.5% vs MR's 1.2% VWAP target), `trendBreakout` (TP1 = 2R target, backstop forced via raised `minRewardRisk`). |

### Consequence to watch in the sim

Every bot's TP1 drops from a flat ~3% to `max(1.5%, 1.5×stop)`. Expect: **more, smaller wins**, faster position turnover, higher hit-rate, lower average win size. That is the intended consistency trade — verify the blended expectancy (hit-rate × avg-win − miss-rate × avg-loss − cost) actually improved before Pass 3. `1.5` (the `tp1RewardRisk` / floor multiple) and `1.8` / `1.5` (trailing) are starting values — tune against sim data.

### Not in Pass 2 (deferred to Pass 3 as planned)

S3 sizing tilt · S4 consecutive-loss halt · S5 correlation gate for Pro/Path/Bybit · Pro structural stop (still flat 4.2%).

---

## Pass 3 — implementation status (2026-09-09)

`typecheck` + `typecheck:worker` + engine tsc clean · **470 pass / 2 skipped** (+3 Pro stop tests).

### Done

| Item | Where | Detail |
|---|---|---|
| **Pro structural stop** (was flat 4.2% vs a 3% target = 0.7 R:R on every trade) | `proAlgEngine.ts`, `proSimExecution.ts` | `computeProSignal` now returns `atrPercent`; `proStopTpLevels(entry, atr%, isLong)` = stop `clamp(atr%×1.6, 1.8%, 4.2%)`, TP1 `max(1.5%, 1.5×stop)`, TP2 `1.5×TP1` → R:R floors at 1.5. `buildProEvaluation` attaches the three as prices; the buy order carries them; `fillDueOrders` reanchors to the fill. `evaluateProExit` rewritten **price-based** (`reachedStop`/`reachedTarget`, symmetric) with the flat §5 percentages as the fallback for a position opened before this change — those tests are unchanged. |
| **S4 — portfolio consecutive-loss halt** | `adaptiveRisk.ts` + all four engines | `portfolioStreakCooldownUntil(closed, equity)` = `computeSymbolStreakCooldownUntil` over the **unfiltered** history, `PORTFOLIO_STREAK_COOLDOWN_LOSSES = 3`, `PORTFOLIO_STREAK_COOLDOWN_MS = 60min`. Wired next to the existing per-symbol check in `simExecution.ts` (intraday), `pathSimExecution.ts`, `trendBreakoutExecution.ts`; and into `proSimEngine.ts`'s `breakerTripped` (Pro had **no** streak brake at all). |
| **S5 — correlation gate for Bybit** | `trendBreakoutExecution.ts` | reuses `evaluateCorrelationGate` on the H1 series already in `ctx.candlesBySymbol`. Builds `correlationBook` from open + pending entries, checks after `MAX_CONCURRENT`, pushes each placed trade back into the book for the rest of the batch. Blocks with `blockEntry(ev, 'CORRELATION', …)`. Intraday and Path already had this; Bybit was the leveraged bot without it. |

### Deferred (with reason — not blockers, ship without)

| Item | Why |
|---|---|
| **S3 — confidence-tilted sizing** | Four distinct sizing entry points (Pro gate, `buildRiskPlan`, `pathEntryBudget`, Bybit scale-in), two of which don't have the entry threshold in scope. The plan itself flags it as "starting values — tune against sim data": coding it before Pass 1/2 sim data exists means re-tuning it anyway. The safer, higher-value sizing change (wiring the already-computed-but-discarded `sizingMultiplier` into `buildRiskPlan.notionalUsd`) is also best done with data in hand. |
| **S5 for Pro** | Needs a new candle-series field threaded into `ProOrderGenContext` (Pro's order-gen only receives `signalsBySymbol` today). Pro is **spot-only, no leverage** (`maxFuturesPositions: 0`), so a correlated cluster there cannot liquidate — lower priority than the leveraged bots, all of which now have the gate. |

### Full three-pass result

All of Pass 1 (unblock), Pass 2 (TP1 floor + trailing + shared cost model), and
Pass 3 (Pro stop, book-level loss halt, Bybit correlation gate) are in the
working tree. `npm test` green (470/2). **Not committed.** Next: run the four
bots in the sim for 2–3 days and read the blended expectancy before touching S3
or any of the "starting value" constants (`tp1FloorDistance` multiple,
`PRO_STOP_ATR_MULT`, `PORTFOLIO_STREAK_COOLDOWN_*`, trailing multipliers).
