/**
 * Calm-regime scalp — opt-in, off by default everywhere it matters (LIVE, tests).
 * ============================================================================
 * Operator request (2026-09-11): in a QUIET market, trade a tighter ladder —
 * SL 2.3%, TP1 1.8% (fast 50% partial), TP2 3.5% — instead of each bot's own
 * dynamic (usually wider) levels, so small moves get taken instead of chased.
 * In a genuinely volatile market, change nothing: the dynamic levels already
 * reflect real ATR/structure and stay.
 *
 * "Quiet" is defined the same way in all four bots so the definition itself
 * cannot become a hidden per-bot difference: the bot's OWN dynamic stop
 * distance is compared to CALM_SL_THRESHOLD_PCT. If the dynamic stop would
 * already be at or past the threshold, volatility (or structure) is already
 * wide — a "big move" — and nothing changes. Below it, the ladder is
 * standardized to the fixed calm numbers.
 *
 * R:R note: TP1/SL = 1.8/2.3 = 0.78 — BELOW every bot's minRewardRisk gate
 * (1.2). That is deliberate: TP1 is a fast partial, not the trade's whole
 * thesis. The R:R gate in the calm branch is measured to TP2 instead
 * (3.5/2.3 = 1.52, clears 1.2) — the runner is where the edge has to live.
 * TP1 itself is never allowed to WIDEN a bot's own target — see
 * `resolveCalmTp1Percent` — MEAN_REVERSION's VWAP-driven target can be
 * tighter than 1.8%, and calm-regime must never make a target harder to
 * reach.
 */

/** Fixed stop distance in the calm branch, as a percent of entry. */
export const CALM_SL_PCT = 2.3;
/** Fixed first-target distance (50% partial) in the calm branch. Never used
 *  directly — see `resolveCalmTp1Percent`, which floors it at the bot's own
 *  (possibly tighter) dynamic target. */
export const CALM_TP1_PCT = 1.8;
/** Fixed second-target distance (the runner) in the calm branch. */
export const CALM_TP2_PCT = 3.5;
/** The dynamic stop, as a percent of entry, at or above which the calm branch
 *  does not apply — "a big move", where the bot's own ATR/structure already
 *  wants a wider stop than the calm fixed one. */
export const CALM_SL_THRESHOLD_PCT = 2.3;

/** True when the bot's own dynamic stop is tight enough for the calm ladder
 *  to apply. `dynamicSlPct` is that stop as a percent of entry (positive). */
export function isCalmRegime(dynamicSlPct: number): boolean {
  return Number.isFinite(dynamicSlPct) && dynamicSlPct < CALM_SL_THRESHOLD_PCT;
}

/** TP1 in the calm branch never WIDENS the bot's own dynamic target — only
 *  tightens it. `dynamicTp1Pct` is the bot's own TP1 as a percent of entry. */
export function resolveCalmTp1Percent(dynamicTp1Pct: number): number {
  return Number.isFinite(dynamicTp1Pct) ? Math.min(CALM_TP1_PCT, dynamicTp1Pct) : CALM_TP1_PCT;
}
